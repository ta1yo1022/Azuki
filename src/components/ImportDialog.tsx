import { DeckMetadataFields } from './DeckMetadataFields';
import { ThemePicker } from './ThemePicker';
import type { DeckTheme } from '../../shared/deckThemes';
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Code2,
  FileJson,
  LockKeyhole,
  Upload,
  X,
} from "lucide-react";
import {
  LIMITS,
  parseDeck,
  type DeckInput,
} from "../../shared/model";
import { parseImportWords, WORDS_EXAMPLE_JSON } from "../lib/importWords";
type Props = {
  onClose: () => void;
  onImport: (input: DeckInput) => Promise<void>;
};
export function ImportDialog({ onClose, onImport }: Props) {
  const location = useLocation();
  const [params] = useSearchParams();
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "paste">(params.get("tab") === "paste" ? "paste" : "file");
  const [raw, setRaw] = useState("");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<DeckInput | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [category, setCategory] = useState("");
  const [textbookName, setTextbookName] = useState("");
  const [edition, setEdition] = useState("");
  const [title, setTitle] = useState("");
  const [theme,setTheme]=useState<DeckTheme>('azuki');
  const [description, setDescription] = useState("");
  function showPreview(text: string) {
    setPreview({ schemaVersion: 1, title: "", description: "", textbookTags: [], words: parseImportWords(text) });
  }
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function readFile(selected?: File) {
    if (!selected) return;
    setError("");
    setPreview(null);
    if (selected.size > LIMITS.bytes) {
      setError("JSONファイルは512KB以内にしてください。");
      return;
    }
    try {
      const text = await selected.text();
      setRaw(text);
      setName(selected.name);
      showPreview(text);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "ファイルを読み込めませんでした。",
      );
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  function validate() {
    setError("");
    try {
      showPreview(raw);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit() {
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    try {
      if (category === "textbook" && !textbookName.trim()) throw new Error("教材名を入力してください。");
      const textbookTags = category === "textbook" ? [{ name: textbookName.trim(), edition: edition.trim() }]
        : category ? [{ name: category }] : [];
      await onImport(parseDeck(JSON.stringify({ ...preview, theme, title: category === "textbook" ? textbookName.trim() : title, description, textbookTags })));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="import-dialog"
      aria-labelledby="import-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current && !busy) onClose();
      }}
    >
      <div className="dialog-inner">
        <header className="dialog-header">
          <div>
            
            <h2 id="import-title">単語帳を追加</h2>
          </div>
          <button
            className="icon-button"
            aria-label="閉じる"
            disabled={busy}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className="import-steps">
          <span className={!preview ? "current" : "complete"}>
            <i>{preview ? <Check size={13} /> : "1"}</i>JSONを選ぶ
          </span>
          <span className={preview ? "current" : ""}>
            <i>2</i>内容を確認
          </span>
        </div>
        {!preview ? (
          <>
            <Link className="import-guide-link" to="/guide/create">
              <strong>オリジナル英単語帳の作り方 →</strong>
              <span>画像や学びたい単語から、ChatGPT・Geminiで作る</span>
            </Link>
            <div className="tabs" role="tablist" aria-label="取り込み方法">
              <button
                role="tab"
                aria-selected={tab === "file"}
                className={tab === "file" ? "active" : ""}
                onClick={() => setTab("file")}
              >
                <Upload size={17} />
                ファイルを選択
              </button>
              <button
                role="tab"
                aria-selected={tab === "paste"}
                className={tab === "paste" ? "active" : ""}
                onClick={() => setTab("paste")}
              >
                <Code2 size={18} />
                JSONを貼り付け
              </button>
            </div>
            {tab === "file" ? (
              <div
                className={`dropzone ${drag ? "dragover" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  void readFile(e.dataTransfer.files[0]);
                }}
              >
                <span className="upload-symbol">
                  <FileJson size={32} strokeWidth={1.3} />
                </span>
                <strong>JSONファイルをここにドロップ</strong>
                <span>または</span>
                <button
                  className="button secondary"
                  onClick={() => file.current?.click()}
                >
                  ファイルを選ぶ
                </button>
                <small>.json ／ 512KB・5,000語まで</small>
                <input
                  ref={file}
                  type="file"
                  accept=".json,application/json"
                  aria-label="JSONファイル"
                  className="visually-hidden"
                  onChange={(e) => void readFile(e.target.files?.[0])}
                />
              </div>
            ) : (
              <div className="paste-panel">
                <label htmlFor="json-input">単語帳のJSON</label>
                <textarea
                  id="json-input"
                  spellCheck={false}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={
                    WORDS_EXAMPLE_JSON
                  }
                />
              </div>
            )}
            <div className="format-hint">
              <div>
                <strong>はじめての方へ</strong>
                <p>JSONには英単語・意味・例文を入れます。名前とカテゴリは次の画面で設定します。</p>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setRaw(WORDS_EXAMPLE_JSON);
                  setTab("paste");
                  setError("");
                }}
              >
                サンプルを使う
              </button>
            </div>
          </>
        ) : (
          <div className="import-preview">
            <div className="import-summary" role="status">
              <CheckCircle2 size={20} aria-hidden="true" />
              <div><strong>単語を読み込みました</strong>{name && <span>{name}</span>}</div>
              <span className="import-word-count">{preview.words.length}<small>語</small></span>
            </div>
            <ThemePicker value={theme} onChange={setTheme} disabled={busy} />
            <fieldset className="import-classification" disabled={busy}>
              <legend className="visually-hidden">単語帳の設定</legend>
              <DeckMetadataFields prefix="import" value={{title,description,category,textbookName,edition}} onChange={value=>{setTitle(value.title);setDescription(value.description);setCategory(value.category);setTextbookName(value.textbookName);setEdition(value.edition);}} />
            </fieldset>
            <div className="import-preview-heading"><h3>単語のプレビュー</h3><span>{preview.words.length > 5 ? "先頭の5語" : `${preview.words.length}語`}</span></div>
            <div className="preview-words">
              <div className="table-label">
                <span>英単語</span>
                <span>意味</span>
              </div>
              {preview.words.slice(0, 5).map((w, i) => (
                <div className="preview-word" key={i}>
                  <strong>{w.word}</strong>
                  <span>{w.meaning}</span>
                </div>
              ))}
              {preview.words.length > 5 && (
                <p className="more-note">ほか {preview.words.length - 5} 語</p>
              )}
            </div>
            <div className="privacy-note">
              <LockKeyhole size={16} />
              <span>まずは非公開で保存。あとから公開できます。</span>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        <footer className="dialog-footer">
          <button
            className="button ghost"
            disabled={busy}
            onClick={() => (preview ? setPreview(null) : onClose())}
          >
            {preview ? "入力に戻る" : "キャンセル"}
          </button>
          {preview ? (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? "登録しています…" : `${preview.words.length}語を登録する`}
            </button>
          ) : (
            <button
              className="button primary"
              disabled={!raw.trim()}
              onClick={validate}
            >
              内容を確認
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
