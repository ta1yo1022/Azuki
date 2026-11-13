import {ManualWords} from './ManualWords';
import {newManualDraft} from '../lib/manualWords';
import {useI18n,messageText} from '../lib/i18n';
import {LANGUAGES,type Language} from '../../shared/languages';
import { DeckMetadataFields } from './DeckMetadataFields';
import { ThemePicker } from './ThemePicker';
import { WordPaste,emptyWordPaste } from './WordPaste';
import type { DeckTheme } from '../../shared/deckThemes';
import { Link, useSearchParams } from "react-router-dom";
import { useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Code2,
  FileText,
  LockKeyhole,
  Upload,
  ArrowLeft,
} from "lucide-react";
import {
  LIMITS,
  parseDeck,
  wordExamples,
  type DeckInput,
} from "../../shared/model";
import { parseImportWords, WORDS_EXAMPLE_TOON } from "../lib/importWords";
type Props = {
  onClose: () => void;
  onImport: (input: DeckInput) => Promise<void>;
};
export function ImportPage({ onClose, onImport }: Props) {
 const t=useI18n();
  const [params] = useSearchParams();
  const file = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "paste" | "words" | "manual">(params.get("tab") === "paste" ? "paste" : params.get('tab')==='file'?'file':params.get('tab')==='manual'?'manual':'words');
  const [wordDraft,setWordDraft]=useState(emptyWordPaste);
  const [manualDraft,setManualDraft]=useState(newManualDraft);
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
  const [language,setLanguage]=useState<Language>('en');
  const [meaningLanguage,setMeaningLanguage]=useState<Language>('ja');
  const [theme,setTheme]=useState<DeckTheme>('azuki');
  const [description, setDescription] = useState("");
  function showPreview(text: string) {
    setPreview({ schemaVersion: 1, title: "", description: "", textbookTags: [], words: parseImportWords(text) });
  }
  async function readFile(selected?: File) {
    if (!selected) return;
    setError("");
    setPreview(null);
    if (selected.size > LIMITS.bytes) {
      setError(messageText("TOONファイルは512KB以内にしてください。"));
      return;
    }
    try {
      const text = await selected.text();
      setRaw(text);
      setName(selected.name);
      showPreview(text);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : messageText("ファイルを読み込めませんでした。"),
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
      if (category === "textbook" && !textbookName.trim()) throw new Error(messageText("教材名を入力してください。"));
      const textbookTags = category === "textbook" ? [{ name: textbookName.trim(), edition: edition.trim() }]
        : category ? [{ name: category }] : [];
      await onImport(parseDeck(JSON.stringify({ ...preview, theme, language,meaningLanguage,title: category === "textbook" ? textbookName.trim() : title, description, textbookTags })));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="import-page" aria-labelledby="import-title">
      <button className="back-button" disabled={busy} onClick={onClose}><ArrowLeft size={16}/>{t("単語帳に戻る")}</button>
      <div className="import-page-content">
        <header className="import-page-heading"><h1 id="import-title">{t("単語帳を作成")}</h1></header>
        <div className="import-steps">
          <span className={!preview ? "current" : "complete"}>
            <i>{preview ? <Check size={13} /> : "1"}</i>{(tab==='words'||tab==='manual')?t("単語を入力"):t("TOONを選ぶ")}
          </span>
          <span className={preview ? "current" : ""}>
            <i>2</i>{t("内容を確認")} </span>
        </div>
        {!preview ? (
          <>
            {(tab==='paste'||tab==='file')&&<Link className="import-guide-link" to="/guide/create">
              <strong>{t("オリジナル英単語帳の作り方 →")}</strong>
              <span>{t("画像や学びたい単語から、ChatGPT・Geminiで作る")}</span>
            </Link>}
            <div className="tabs" role="tablist" aria-label={t("取り込み方法")}>
              <button role="tab" aria-selected={tab==='words'} className={tab==='words'?'active':''} disabled={busy} onClick={()=>{setError('');setTab('words');}}>{t("単語から作成")}</button>
              <button role="tab" aria-selected={tab==='manual'} disabled={busy} className={tab==='manual'?'active':''} onClick={()=>{setError('');setTab('manual');}}>{t('自分で入力')}</button>
              <button
                role="tab"
                aria-selected={tab === "file"}
                disabled={busy}
                className={tab === "file" ? "active" : ""}
                onClick={() => {setError("");setTab("file");}}
              >
                <Upload size={17} /> {t("ファイルを選択")} </button>
              <button
                role="tab"
                aria-selected={tab === "paste"}
                disabled={busy}
                className={tab === "paste" ? "active" : ""}
                onClick={() => {setError("");setTab("paste");}}
              >
                <Code2 size={18} /> {t("TOONを貼り付け")} </button>
            </div>
            <div className="deck-language-fields"><label>{t("学習する言語")}<select aria-label={t("学習する言語")} disabled={busy} value={language} onChange={e=>{setLanguage(e.target.value as Language);setWordDraft(old=>({...old,rows:old.rows.map(row=>({...row,generated:false}))}));}}>{LANGUAGES.map(item=><option key={item.code} value={item.code}>{t(item.name)}</option>)}</select></label><label>{t("意味・訳の言語")}<select aria-label={t("意味・訳の言語")} disabled={busy} value={meaningLanguage} onChange={e=>{setMeaningLanguage(e.target.value as Language);setWordDraft(old=>({...old,rows:old.rows.map(row=>({...row,generated:false}))}));}}>{LANGUAGES.map(item=><option key={item.code} value={item.code}>{t(item.name)}</option>)}</select></label></div>
            {tab==='manual'?<ManualWords draft={manualDraft} setDraft={setManualDraft} language={language} meaningLanguage={meaningLanguage} onPreview={words=>{setName('');setPreview({schemaVersion:1,title:'',description:'',textbookTags:[],words});}}/>:tab==='words'?<WordPaste language={language} meaningLanguage={meaningLanguage} draft={wordDraft} setDraft={setWordDraft} onBusy={setBusy} onPreview={words=>{setName('');setPreview({schemaVersion:1,title:'',description:'',textbookTags:[],words});}}/>:tab === "file" ? (
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
                  <FileText size={32} strokeWidth={1.3} />
                </span>
                <strong>{t("TOONファイルをここにドロップ")}</strong>
                <span>{t("または")}</span>
                <button
                  className="button secondary"
                  onClick={() => file.current?.click()}
                > {t("ファイルを選ぶ")} </button>
                <small>{t(".toon ／ 512KB・5,000語まで")}</small>
                <input
                  ref={file}
                  type="file"
                  accept=".toon,text/toon,text/plain"
                  aria-label={t("TOONファイル")}
                  className="visually-hidden"
                  onChange={(e) => void readFile(e.target.files?.[0])}
                />
              </div>
            ) : (
              <div className="paste-panel">
                <label htmlFor="toon-input">{t("単語帳のTOON")}</label>
                <textarea
                  id="toon-input"
                  spellCheck={false}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={
                    WORDS_EXAMPLE_TOON
                  }
                />
              </div>
            )}
            {(tab==='file'||tab==='paste')&&<div className="format-hint">
              <div>
                <strong>{t("はじめての方へ")}</strong>
                <p>{t("TOONには英単語・意味・例文を入れます。名前とカテゴリは次の画面で設定します。")}</p>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setRaw(WORDS_EXAMPLE_TOON);
                  setName("");
                  setTab("paste");
                  setError("");
                }}
              > {t("サンプルを使う")} </button>
            </div>}
          </>
        ) : (
          <div className="import-preview">
            <div className="import-summary" role="status">
              <CheckCircle2 size={20} aria-hidden="true" />
              <div><strong>{t("単語を読み込みました")}</strong>{name && <span>{name}</span>}</div>
              <span className="import-word-count">{preview.words.length}<small>{t("語")}</small></span>
            </div>
            <ThemePicker value={theme} onChange={setTheme} disabled={busy} />
            <fieldset className="import-classification" disabled={busy}>
              <legend className="visually-hidden">{t("単語帳の設定")}</legend>
              <DeckMetadataFields prefix="import" value={{title,description,category,textbookName,edition,language,meaningLanguage}} onChange={value=>{setLanguage(value.language??'en');setMeaningLanguage(value.meaningLanguage??'ja');setTitle(value.title);setDescription(value.description);setCategory(value.category);setTextbookName(value.textbookName);setEdition(value.edition);}} />
            </fieldset>
            <div className="import-preview-heading"><h3>{t("単語のプレビュー")}</h3><span>{preview.words.length > 5 ? t("先頭の5語") : t("{0}語", preview.words.length)}</span></div>
            <div className="preview-words">
              <div className="table-label">
                <span>{t("英単語")}</span>
                <span>{t("意味")}</span>
              </div>
              {preview.words.slice(0, 5).map((w, i) => (
                <div className="preview-word" key={i}>
                  <strong>{w.word}</strong>
                  <span>{w.meaning}</span>
                  {wordExamples(w).length>0&&<div className="import-example-preview"><small>{t("例文")}</small>{wordExamples(w).map((example,index)=><div key={index}><p lang={language}>{example.text}</p>{example.translation?<p lang={meaningLanguage} className="muted">{example.translation}</p>:<p className="muted">{t("訳は未入力です")}</p>}</div>)}</div>}
                </div>
              ))}
              {preview.words.length > 5 && (
                <p className="more-note">{t("ほか")} {preview.words.length - 5} {t("語")}</p>
              )}
            </div>
            <div className="privacy-note">
              <LockKeyhole size={16} />
              <span>{t("まずは非公開で保存。あとから公開できます。")}</span>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="error-box">
            {t(error)}
          </p>
        )}
        {(preview||tab==='file'||tab==='paste')&&<footer className="import-page-footer">
          {preview&&<button
            className="button ghost"
            disabled={busy}
            onClick={() => setPreview(null)}
          > {t("入力に戻る")} </button>}
          {preview ? (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? t("登録しています…") : t("{0}語を登録する", preview.words.length)}
            </button>
          ) : tab!=='words' ? (
            <button
              className="button primary"
              disabled={!raw.trim()}
              onClick={validate}
            > {t("内容を確認")} </button>
          ) : null}
        </footer>}
      </div>
    </section>
  );
}
