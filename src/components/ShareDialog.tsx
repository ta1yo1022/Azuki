import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Globe, LockKeyhole, X } from "lucide-react";
import type { Deck } from "../../shared/model";
import { DeckLineage } from "./DeckLineage";
import { Link } from "react-router-dom";
import { PublishConflict, sharedDeckUrl } from "../lib/repository";

export function ShareDialog({
  deck,
  demo,
  onClose,
  onVisibility,
}: {
  deck: Deck;
  demo: boolean;
  onClose: () => void;
  onVisibility: (visibility: Deck["visibility"]) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existingDeckId, setExistingDeckId] = useState<string>();
  const [copied, setCopied] = useState(false);
  const isPublic = deck.visibility === "public";
  const url = sharedDeckUrl(deck.id);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function change() {
    if (busy || demo) return;
    setBusy(true);
    setError("");
    setExistingDeckId(undefined);
    setCopied(false);
    try {
      await onVisibility(isPublic ? "private" : "public");
    } catch (e) {
      setError(e instanceof Error ? e.message : "設定を変更できませんでした。");
      if (e instanceof PublishConflict) setExistingDeckId(e.existingDeckId);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(
        "コピーできませんでした。下のリンクを選択してコピーしてください。",
      );
    }
  }
  return (
    <dialog
      ref={ref}
      className="share-dialog"
      aria-labelledby="share-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-header">
        <div>
          
          <h2 id="share-title">単語帳を共有</h2>
        </div>
        <button
          className="icon-button"
          aria-label="共有画面を閉じる"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p className="share-deck-title">{deck.title}</p>
      <DeckLineage deck={deck} />
      {deck.sourceDeck && <p className="share-copy-note">{deck.unchangedCopy ? "保存したままのコピーは再公開できません。単語・意味・例文を編集すると派生版として公開できます。タイトルやタグだけの変更は対象になりません。" : "コピー元を表示した派生版として公開します。同じ内容が公開されている場合は、そちらをご案内します。"}</p>}
      {demo ? (
        <div className="share-explanation">
          <LockKeyhole size={24} />
          <h3>共有にはGoogleログインが必要です</h3>
          <p>
            お試しモードの単語帳は、この端末だけに保存されています。Googleログイン後にTOONを登録すると、共有できるようになります。
          </p>
        </div>
      ) : (
        <>
          <div className={`share-explanation ${isPublic ? "is-public" : ""}`}>
            {isPublic ? <Globe size={24} /> : <LockKeyhole size={24} />}
            <h3>
              {isPublic ? "この単語帳は公開中です" : "この単語帳は非公開です"}
            </h3>
            <p>
              {isPublic
                ? "ログインなしで閲覧できます。検索ではコピーや派生版を元の単語帳とまとめて表示します。他のユーザーは自分の単語帳にコピーを保存できます。"
                : "現在はあなただけが閲覧できます。公開すると、単語・意味・例文・教材タグを誰でも閲覧でき、他のユーザーはコピーを保存できます。"}
            </p>
            <p className="muted">
              Googleアカウントの名前やメールアドレスは表示されません。
            </p>
          </div>
          {isPublic && (
            <div className="share-link-section">
              <label htmlFor="share-link">共有リンク</label>
              <input
                id="share-link"
                className="share-link-input"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="share-link-actions">
                <button
                  className="button primary"
                  onClick={() => void copy()}
                  disabled={busy}
                >
                  {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                  {copied ? "コピーしました" : "リンクをコピー"}
                </button>
                <a
                  className="text-button"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  共有ページを開く <ExternalLink size={15} />
                </a>
              </div>
            </div>
          )}
          <div className="share-visibility-actions">
            {!isPublic && <p className="share-copyright-note">公開する権利のある内容だけを掲載してください。教材名の入力やAIによる編集は、転載の許可を意味しません。<Link to="/copyright" target="_blank" rel="noreferrer">著作権・権利侵害への対応を確認 ↗</Link></p>}
            {isPublic && (
              <p>
                非公開に戻すと、検索結果と共有リンクから閲覧できなくなります。すでに他のユーザーが保存したコピーは残ります。
              </p>
            )}
            <button
              className={`button ${isPublic ? "secondary" : "primary"}`}
              disabled={busy || (!isPublic && Boolean(deck.unchangedCopy))}
              onClick={() => void change()}
            >
              {isPublic ? <LockKeyhole size={17} /> : <Globe size={17} />}
              {busy
                ? "変更しています…"
                : isPublic
                  ? "非公開に戻す"
                  : deck.sourceDeck ? "派生版として公開" : "公開して共有する"}
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      {existingDeckId && <Link className="text-button" to={`/shared/${encodeURIComponent(existingDeckId)}`}>公開中の単語帳を見る</Link>}
      <span role="status" className="visually-hidden">
        {copied ? "共有リンクをコピーしました" : ""}
      </span>
    </dialog>
  );
}
