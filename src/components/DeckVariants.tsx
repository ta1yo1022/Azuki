import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Deck } from "../../shared/model";
import { publicRepository } from "../lib/repository";
export function DeckVariants({ deck }: { deck: Deck }) {
  const [params, setParams] = useSearchParams();
  const open = params.get("variants") === "1";
  const [items, setItems] = useState<Deck[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const gen = ++generation.current;
    if (!open) return;
    const controller = new AbortController();
    setBusy(true); setError(""); setItems([]); setNext(null);
    publicRepository.variants(deck.id, null, controller.signal).then(page => {
      if (gen === generation.current) { setItems(page.decks); setNext(page.nextCursor); }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (gen === generation.current) setBusy(false); });
    return () => { controller.abort(); generation.current++; };
  }, [deck.id, open, retry]);
  async function more() {
    if (busy || !next) return;
    const gen = generation.current; setBusy(true); setError("");
    try {
      const page = await publicRepository.variants(deck.id, next);
      if (gen === generation.current) { setItems(prev => [...prev, ...page.decks]); setNext(page.nextCursor); }
    } catch(e) { if (gen === generation.current) setError(e instanceof Error ? e.message : "読み込めませんでした。"); }
    finally { if (gen === generation.current) setBusy(false); }
  }
  if (!deck.variantCount && !open) return null;
  return <section className="deck-variants">
    <button className="text-button" aria-expanded={open} onClick={() => setParams(prev => { const p = new URLSearchParams(prev); if (open) p.delete("variants"); else p.set("variants", "1"); return p; })}>{open ? "派生版を閉じる" : `派生版を見る（${deck.variantCount}冊）`}</button>
    {open && <div><p>単語・意味・例文が異なる公開版です。同じ内容のコピーはまとめています。</p>
      {items.map(item => <Link className="variant-item" key={item.id} to={`/shared/${encodeURIComponent(item.id)}`}><strong>{item.title}</strong><span>{item.wordCount}語</span><span>{item.description}</span></Link>)}
      {busy && <p role="status">派生版を読み込んでいます…</p>}
      {error && <p role="alert">{error} <button className="text-button" onClick={() => next ? void more() : setRetry(n=>n+1)}>再読み込み</button></p>}
      {!busy && !error && !items.length && <p>公開されている派生版はありません。</p>}
      {next && <button className="button secondary" disabled={busy} onClick={() => void more()}>続きを表示</button>}
    </div>}
  </section>;
}
