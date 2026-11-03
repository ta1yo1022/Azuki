import {languageName} from '../lib/i18n';
import {useI18n,messageText} from '../lib/i18n';
import {type Language} from '../../shared/languages';
import { useEffect,useRef,useState,type Dispatch,type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles,X } from 'lucide-react';
import { EXAMPLE_BATCH_LIMIT,parseVocabulary } from '../../shared/vocabulary';
import type { WordInput } from '../../shared/model';
import { vocabularyRepository,useVocabularyQuota } from '../lib/vocabulary';
import { PublishConflict } from '../lib/repository';
type Row={term:string;meaning:string;text:string;translation:string;generated:boolean};
export type WordPasteDraft={raw:string;rows:Row[]};
export const emptyWordPaste:WordPasteDraft={raw:'',rows:[]};
export function WordPaste({draft,setDraft,onPreview,onBusy,language='en',meaningLanguage='ja'}:{language?:Language;meaningLanguage?:Language;draft:WordPasteDraft;setDraft:Dispatch<SetStateAction<WordPasteDraft>>;onPreview:(words:WordInput[])=>void;onBusy:(value:boolean)=>void}){
 const t=useI18n();
 const {quota,loading,error:quotaError,refresh}=useVocabularyQuota();
 const [page,setPage]=useState(0);
 const [editingInput,setEditingInput]=useState(draft.rows.length===0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(''),[stopping,setStopping]=useState(false);
 const stop=useRef(false),mounted=useRef(true),pending=useRef(new Map<string,string>());
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
 function working(value:boolean){setBusy(value);onBusy(value);}
 function update(index:number,value:Partial<Row>){setDraft(old=>({...old,rows:old.rows.map((row,i)=>i===index?{...row,...value}:row)}));}
 function readToon(){
  if(busy)return;setError('');setProgress('');
  try{
   const terms=parseVocabulary(draft.raw,language);
   setDraft(old=>({...old,rows:terms.map(term=>old.rows.find(row=>row.term===term)??{term,meaning:'',text:'',translation:'',generated:false})}));
   setPage(0);setEditingInput(false);
  }catch(e){setError(e instanceof Error?e.message:messageText("TOONの形式を確認してください。"));}
 }
 const missing=draft.rows.filter(row=>!row.generated);
 const count=Math.min(missing.length,quota?.remaining??0);
 async function generate(again?:Row[]){
  const targets=(again??missing).slice(0,quota?.remaining??0);
  if(busy||!quota?.pro||!quota.available||!targets.length)return;
  working(true);setError('');setStopping(false);stop.current=false;let done=0;
  try{
   for(let offset=0;offset<targets.length&&!stop.current;offset+=EXAMPLE_BATCH_LIMIT){
    const selection=targets.slice(offset,offset+EXAMPLE_BATCH_LIMIT).map(row=>({term:row.term}));
    const key=JSON.stringify({selection,language,meaningLanguage}),requestId=pending.current.get(key)??crypto.randomUUID();pending.current.set(key,requestId);
    setProgress(t("{0} / {1}語の意味・例文を生成しました", done, targets.length));
    try{
     const result=await vocabularyRepository.generate(requestId,selection,language,meaningLanguage);pending.current.delete(key);
     if(!mounted.current)return;
     setDraft(old=>({...old,rows:old.rows.map(row=>{const example=result.examples.find(item=>item.term===row.term);return example?{...row,meaning:example.meaning,text:example.text,translation:example.translation,generated:true}:row;})}));
     done+=result.examples.length;
     if(result.failed.length){setError(messageText("{0}の内容を確認できませんでした。この分の生成枠は使用していません。スペルなどを確認してください。", result.failed.join('、')));break;}
    }catch(e){if(e instanceof PublishConflict&&e.code!=='VOCABULARY_PENDING')pending.current.delete(key);throw e;}
   }
   if(mounted.current)setProgress(t("{0}語の意味・例文を生成しました。内容を確認・編集してから追加してください。", done));
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:messageText("意味・例文を生成できませんでした。"));}
  finally{if(mounted.current){working(false);setStopping(false);refresh();}}
 }
 const pageSize=25,pageCount=Math.max(1,Math.ceil(draft.rows.length/pageSize)),currentPage=Math.min(page,pageCount-1),firstRow=currentPage*pageSize;
 const tableScroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(tableScroll.current)tableScroll.current.scrollTop=0;},[currentPage]);
 const visibleRows=draft.rows.slice(firstRow,firstRow+pageSize);
 const canSave=draft.rows.length>0&&draft.rows.every(row=>row.meaning.trim());
 return <div className="word-paste-panel">
  {editingInput?<><label htmlFor="vocabulary-input">{t("単語のTOON")}</label>
  <textarea id="vocabulary-input" value={draft.raw} disabled={busy} spellCheck={false} placeholder={language==='th'?'words[3]: สวัสดี,ขอบคุณ,เรียน':language==='zh'?'words[3]: 你好,谢谢,学习':language==='ja'?'words[3]: こんにちは,ありがとう,学ぶ':'words[3]: agree,curious,improve'} onChange={event=>setDraft(old=>({...old,raw:event.target.value}))}/>
  <div className="word-paste-input-footer"><small>{t("単語だけのTOONを500語まで登録できます。")}</small><button className="button secondary" disabled={busy||!draft.raw.trim()} onClick={readToon}>{t("TOONを読み込む")}</button></div>
  </>:<div className="word-paste-summary"><strong>{draft.rows.length}{t("語を読み込みました")}</strong><button className="text-button" disabled={busy} onClick={()=>setEditingInput(true)}>{t("入力を変更")}</button></div>}
  {draft.rows.length>0&&<>
   <div className="word-generation-tools">
    <div><strong><Sparkles size={17}/>{t("AIで意味・例文を作る")} <span className="word-pro-badge">Pro</span></strong><p>{t(languageName(language))}{t("の例文と、")}{t(languageName(meaningLanguage))}{t("の意味・訳をまとめて作ります。")}</p>
     {quota?.pro&&<small role="status" className="word-quota"><span>{t("今週あと")}{quota.remaining} / {quota.limit}{t("語")}{quota.reserved?t("（{0}語を処理中）", quota.reserved):''}</span><span>{t("毎週月曜0時（日本時間）にリセット")}</span></small>}
     {quota?.pro&&quota.remaining===0&&<p role="status">{t("今週の生成上限に達しました。生成済みの内容は引き続き編集・保存できます。")}</p>}
    </div>
    {loading?<span role="status">{t("生成枠を確認中…")}</span>:quotaError?<button className="text-button" onClick={refresh}>{t(quotaError)} {t("再確認")}</button>:!quota?.pro?<Link className="button secondary" to="/plans">{t("Proを見る")}</Link>:<button className="button primary" disabled={busy||!count||!quota.available} onClick={()=>void generate()}><Sparkles size={16}/>{!quota.available?t("生成機能は準備中"):!missing.length?t("生成済み"):!count?t("今週の上限に到達"):t("{0}語の意味・例文を生成", count)}</button>}
   </div>
   {busy&&progress&&<button className="text-button" disabled={stopping} onClick={()=>{stop.current=true;setStopping(true);}}>{stopping?t("いまの生成が終わったら停止します"):t("生成を停止")}</button>}
   {progress&&<p role="status" className="word-generation-progress">{progress}</p>}
   <p className="word-paste-review-note">{t("生成後に、意味・例文・訳を確認して編集してください。作り直した分も生成枠に含まれます。")}</p>
   <div className="vocabulary-table-toolbar"><span>{firstRow+1}〜{Math.min(firstRow+pageSize,draft.rows.length)} / {draft.rows.length}{t("語")}</span><small>{t("表の中で直接編集できます")}<span className="vocabulary-mobile-hint">{t("。横にスクロールできます")}</span></small></div>
   <div ref={tableScroll} className="vocabulary-table-scroll" role="region" aria-label={t("単語の編集表")} tabIndex={0}>
    <table className="vocabulary-edit-table">
     <caption className="sr-only">{t("単語・意味・例文・訳の編集")}</caption>
     <colgroup><col className="vocabulary-term-col"/><col className="vocabulary-meaning-col"/><col className="vocabulary-example-col"/><col className="vocabulary-translation-col"/><col className="vocabulary-actions-col"/></colgroup>
     <thead><tr><th scope="col">{t("単語")}</th><th scope="col">{t("意味")}</th><th scope="col">{t("例文")}</th><th scope="col">{t("例文の訳")}</th><th scope="col">{t("操作")}</th></tr></thead>
     <tbody>{visibleRows.map((row,offset)=>{const index=firstRow+offset;return <tr key={row.term}>
      <th scope="row"><span className="vocabulary-row-number">{index+1}</span><strong>{row.term}</strong></th>
      <td><textarea aria-label={t("{0}の意味", row.term)} maxLength={1000} disabled={busy} value={row.meaning} placeholder={t("意味を入力")} onChange={event=>update(index,{meaning:event.target.value})}/></td>
      <td><textarea aria-label={t("{0}の例文", row.term)} maxLength={1000} disabled={busy} value={row.text} placeholder={t("例文を入力")} onChange={event=>update(index,{text:event.target.value})}/></td>
      <td><textarea aria-label={t("{0}の例文の{1}", row.term, meaningLanguage==='ja'?t("日本語訳"):t("訳"))} maxLength={1000} disabled={busy} value={row.translation} placeholder={t("訳を入力")} onChange={event=>update(index,{translation:event.target.value})}/></td>
      <td><div className="vocabulary-row-actions">{row.generated&&quota?.pro&&<button className="text-button" aria-label={t("{0}の意味・例文を作り直す", row.term)} disabled={busy||!quota.remaining||!quota.available} onClick={()=>void generate([row])}>{t("作り直す")}</button>}<button className="icon-button" aria-label={t("{0}を除外", row.term)} disabled={busy} onClick={()=>setDraft(old=>({...old,rows:old.rows.filter((_,i)=>i!==index)}))}><X size={17}/></button></div></td>
     </tr>;})}</tbody>
    </table>
   </div>
   {pageCount>1&&<nav className="vocabulary-table-pages" aria-label={t("単語編集のページ")}><button className="button secondary" disabled={busy||currentPage===0} onClick={()=>setPage(currentPage-1)}>{t("前の25語")}</button><select aria-label={t("編集するページ")} value={currentPage} disabled={busy} onChange={event=>setPage(Number(event.target.value))}>{Array.from({length:pageCount},(_,i)=><option key={i} value={i}>{i+1} / {pageCount}{t("ページ")}</option>)}</select><button className="button secondary" disabled={busy||currentPage===pageCount-1} onClick={()=>setPage(currentPage+1)}>{t("次の25語")}</button></nav>}

   <div className="word-paste-input-footer"><small>{language==='en'&&meaningLanguage==='ja'?t("意味の参考：EJDict（CC0）。"):''}{t("意味・例文はAIが生成します。誤りが含まれる場合があります。")}</small><button className="button primary" disabled={busy||!canSave} onClick={()=>onPreview(draft.rows.map(row=>({word:row.term,meaning:row.meaning.trim(),tags:[],...(row.text.trim()?{examples:[{text:row.text.trim(),translation:row.translation.trim()}]}:{})})))}>{t("この{0}語で単語帳を作る",draft.rows.length)}</button></div>
  </>}
  {error&&<p className="error-box" role="alert">{t(error)}</p>}
 </div>;
}
