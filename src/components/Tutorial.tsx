import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { Brand } from "./Brand";

const seenThisSession = new Set<string>();
const storageKey = (owner: string) => `azuki.tutorial.v1.${owner}`;
function hasSeen(owner: string) {
  if (seenThisSession.has(owner)) return true;
  try { return localStorage.getItem(storageKey(owner)) === "done"; } catch { return false; }
}
const steps = [
  { title: "Azukiへようこそ", text: "自分の単語帳を作ったり、公開単語帳を保存したりして、カードで練習できます。画面の使い方をご案内します。", target: "" },
  { title: "単語帳を追加する", text: "ここからJSONを貼り付けて登録できます。作成画面の「オリジナル英単語帳の作り方」には、画像や学びたい単語からAIで作るためのプロンプトがあります。", target: "add" },
  { title: "自分の例文も登録できます", text: "英単語・日本語の意味・英語の例文をJSONにまとめて登録できます。作成ガイドの「自分で考えた単語・例文を登録する」にコピーできるひな形があります。保存後は単語の行をタップして例文を確認できます。", target: "add" },
  { title: "公開単語帳を探す", text: "運営やほかの人が公開した単語帳を探せます。気に入ったものは自分のライブラリに保存できます。", target: "explore" },
  { title: "単語帳を探して、カードで練習", text: "保存した単語帳は、名前や教材タグで検索できます。単語帳を開いて「カードで学習」を選ぶと、1語ずつ練習できます。", target: "search" },
  { title: "設定はプロフィールアイコンから", text: "出題順やカードの向き、学習開始前の設定画面を表示するかを変更できます。このチュートリアルも設定から見直せます。", target: "profile" },
];

export function Tutorial({ owner, replay = false, onFinish }: { owner: string; replay?: boolean; onFinish: () => void }) {
  const [open, setOpen] = useState(() => replay || !hasSeen(owner));
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState("forward");
  const previousPanel = useRef<{ left: number; top: number } | null>(null);
  const panelAnimation = useRef<Animation | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const current = steps[step];
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const overflow = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      window.scrollTo(0, scrollY);
      previous?.focus({ preventScroll: true });
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    function position() {
      const candidates = [...document.querySelectorAll<HTMLElement>(`[data-tour="${current.target}"]`)];
      if (current.target === "profile") candidates.reverse();
      const target = candidates.find(el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0);
      if (!target) { setRect(null); return; }
      if (target.closest(".sidebar")) target.scrollIntoView({ block: "nearest", behavior: "instant" });
      const box = target.getBoundingClientRect();
      const panelHeight = panel.current?.getBoundingClientRect().height ?? 280;
      // Keep the highlighted control above the bottom sheet on narrow screens.
      if (box.bottom > window.innerHeight - panelHeight - 36 || box.top < 12) {
        window.scrollBy(0, box.top - 24);
      }
      const next = target.getBoundingClientRect();
      setRect({ top: next.top - 6, left: next.left - 6, width: next.width + 12, height: next.height + 12 });
    }
    position();
    title.current?.focus({ preventScroll: true });
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [current, open]);
  useLayoutEffect(() => {
    const element = panel.current;
    const previous = previousPanel.current;
    previousPanel.current = null;
    if (!element || !previous || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const next = element.getBoundingClientRect();
    const dx = previous.left - next.left;
    const dy = previous.top - next.top;
    if (dx || dy) {
      panelAnimation.current = element.animate?.([
        { translate: `${dx}px ${dy}px` },
        { translate: "0px 0px" },
      ], { duration: 320, easing: "cubic-bezier(.22,1,.36,1)" }) ?? null;
    }
  }, [step]);
  useEffect(() => () => panelAnimation.current?.cancel(), []);
  function changeStep(next: number) {
    const box = panel.current?.getBoundingClientRect();
    previousPanel.current = box ? { left: box.left, top: box.top } : null;
    panelAnimation.current?.cancel();
    setDirection(next > step ? "forward" : "backward");
    setStep(next);
  }
  function finish() {
    seenThisSession.add(owner);
    try { localStorage.setItem(storageKey(owner), "done"); } catch { /* Session memory still prevents repeated automatic prompts. */ }
    dialog.current?.close();
    setOpen(false);
    onFinish();
  }
  if (!open) return null;
  return <dialog className="tutorial-overlay" ref={dialog} aria-labelledby="tutorial-title" aria-describedby="tutorial-description" onCancel={e => { e.preventDefault(); finish(); }}>
    {rect ? <div className="tutorial-spotlight" style={rect} aria-hidden="true" /> : <div className="tutorial-shade" aria-hidden="true" />}
    <section className={`tutorial-panel ${!current.target ? "tutorial-welcome" : ""}`} ref={panel}>
      <div className="tutorial-top"><Brand /><button className="icon-button" aria-label="チュートリアルを閉じる" onClick={finish}><X size={20} /></button></div>
      <p className="tutorial-count" aria-live="polite">{step + 1} / {steps.length}</p>
      <div key={step} className={`tutorial-copy tutorial-copy-${direction}`}>
      <h2 id="tutorial-title" tabIndex={-1} ref={title}>{current.title}</h2>
      <p id="tutorial-description">{current.text}</p>
      </div>
      <div className="tutorial-actions">
        <button className="text-button" onClick={finish}>スキップ</button>
        <div>{step > 0 && <button className="button secondary" onClick={() => changeStep(step - 1)}>戻る</button>}
          <button className="button primary" onClick={() => step === steps.length - 1 ? finish() : changeStep(step + 1)}>{step === steps.length - 1 ? "はじめる" : "次へ"}<ArrowRight size={16} /></button></div>
      </div>
    </section>
  </dialog>;
}
