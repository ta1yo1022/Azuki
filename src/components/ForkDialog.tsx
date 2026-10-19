import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { LIMITS, parseDeck, type Deck, type DeckInput, type Word, type WordPage } from "../../shared/model";
import { publicRepository } from "../lib/repository";

export function ForkDialog({deck,onClose,onSave,reader=publicRepository}:{deck:Deck;onClose:()=>void;onSave:(input:DeckInput)=>Promise<void>;reader?:{words:(id:string,q:string,cursor:number,signal?:AbortSignal)=>Promise<WordPage>}}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [words,setWords]=useState<Word[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [raw,setRaw]=useState("");
  const [title,setTitle]=useState(`${deck.title.slice(0,72)}（編集版）`);
  const [description,setDescription]=useState(deck.description);
  const [preview,setPreview]=useState<DeckInput|null>(null);
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  useEffect(()=>{
    dialog.current?.showModal();
    const controller=new AbortController();
    void (async()=>{
      try {
        const all:Word[]=[];let cursor:number|null=0;
        while(cursor!==null) {
          const page=await reader.words(deck.id,"",cursor,controller.signal);
          if (!page.words.length || (page.nextCursor!==null && page.nextCursor<=cursor)) throw new Error("単語を読み込めませんでした。開き直してください。");
          all.push(...page.words);cursor=page.nextCursor;
          if(all.length>deck.wordCount) throw new Error("単語帳が更新されました。開き直してください。");
        }
        if(controller.signal.aborted)return;
        if(all.length!==deck.wordCount)throw new Error("単語帳が更新されました。開き直してください。");
        setWords(all);
        const exported=all.map(({word,meaning,example,examples,tags})=>({word,meaning,...(examples?.length ? {examples} : {example:example??""}),tags}));
        const pretty=JSON.stringify(exported,null,2);
        // Keep translated, large standard books within the existing JSON byte limit.
        setRaw(new TextEncoder().encode(pretty).length < LIMITS.bytes-2048 ? pretty : JSON.stringify(exported));
      } catch(e) {if(!controller.signal.aborted)setError((e as Error).message);}
      finally {if(!controller.signal.aborted)setLoading(false);}
    })();
    return ()=>controller.abort();
  },[deck.id]);
  function validate() {
    setError("");
    try {
      if(new TextEncoder().encode(raw).length>LIMITS.bytes)throw new Error("JSONは512KB以内にしてください。");
      let value:unknown;try {value=JSON.parse(raw);} catch {throw new Error("JSONの形式を確認してください。");}
      setPreview(parseDeck(JSON.stringify({schemaVersion:1,title,description,textbookTags:deck.textbookTags,words:value}),{maxWords:LIMITS.forkWords,allowExampleVariants:true}));
    } catch(e){setError((e as Error).message);}
  }
  async function submit() {
    if(!preview || busyRef.current)return;
    busyRef.current=true;setBusy(true);setError("");
    try {await onSave(preview);onClose();}catch(e){setError((e as Error).message);}
    finally{busyRef.current=false;setBusy(false);}
  }
  return <dialog ref={dialog} className="import-dialog fork-dialog" aria-labelledby="fork-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <header className="fork-header"><div><span className="eyebrow">JSONから編集</span><h2 id="fork-title">単語帳をフォーク</h2></div><button className="icon-button" aria-label="閉じる" disabled={busy} onClick={onClose}><X size={22}/></button></header>
    <div className="fork-body">
      <p className="muted">コピー元：{deck.title}。元の単語帳は変更せず、自分の単語帳として非公開で保存します。保存した単語数は個人の登録上限に含まれます。</p>
      {loading ? <p role="status">単語を読み込んでいます…</p> : words.length>0 && <>
        {preview ? <section aria-label="フォークの確認"><h3>{preview.title}</h3><p>{preview.words.length}語を登録します。教材タグはコピー元から引き継ぎます。</p><p>{preview.description}</p><ul>{preview.words.slice(0,5).map((word,i)=><li key={i}>{word.word} — {word.meaning}</li>)}</ul>{preview.words.length>5 && <p className="muted">ほか{preview.words.length-5}語</p>}</section> : <>
          <label>単語帳の名前<input value={title} maxLength={80} onChange={e=>setTitle(e.target.value)} /></label>
          <label>説明（任意）<textarea value={description} maxLength={240} rows={2} onChange={e=>setDescription(e.target.value)} /></label>
          <label>単語のJSON<textarea className="fork-json" value={raw} spellCheck={false} rows={14} onChange={e=>setRaw(e.target.value)} /></label>
          <p className="muted">英単語・代表的な意味・例文・単語タグを編集できます。選んだ単語帳の全語が入っています。標準単語帳の「その他の意味」と用法注記はコピーされません。</p>
        </>}
      </>}
      {error && <p className="error-box" role="alert">{error}</p>}
    </div>
    <footer className="fork-footer">{preview ? <><button className="button secondary" disabled={busy} onClick={()=>{setPreview(null);setError("");}}>編集に戻る</button><button className="button primary" disabled={busy} onClick={()=>void submit()}>{busy?"保存しています…":"フォークを保存"}</button></> : <><button className="button secondary" onClick={onClose}>キャンセル</button><button className="button primary" disabled={loading || !words.length} onClick={validate}>内容を確認</button></>}</footer>
  </dialog>;
}
