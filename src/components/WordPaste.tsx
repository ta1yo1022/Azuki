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
export function WordPaste({draft,setDraft,onPreview,onBusy}:{draft:WordPasteDraft;setDraft:Dispatch<SetStateAction<WordPasteDraft>>;onPreview:(words:WordInput[])=>void;onBusy:(value:boolean)=>void}){
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
   const terms=parseVocabulary(draft.raw);
   setDraft(old=>({...old,rows:terms.map(term=>old.rows.find(row=>row.term===term)??{term,meaning:'',text:'',translation:'',generated:false})}));
   setPage(0);setEditingInput(false);
  }catch(e){setError(e instanceof Error?e.message:'TOONの形式を確認してください。');}
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
    const key=JSON.stringify(selection),requestId=pending.current.get(key)??crypto.randomUUID();pending.current.set(key,requestId);
    setProgress(`${done} / ${targets.length}語の意味・例文を生成しました`);
    try{
     const result=await vocabularyRepository.generate(requestId,selection);pending.current.delete(key);
     if(!mounted.current)return;
     setDraft(old=>({...old,rows:old.rows.map(row=>{const example=result.examples.find(item=>item.term===row.term);return example?{...row,meaning:example.meaning,text:example.text,translation:example.translation,generated:true}:row;})}));
     done+=result.examples.length;
     if(result.failed.length){setError(`${result.failed.join('、')}の内容を確認できませんでした。この分の生成枠は使用していません。スペルなどを確認してください。`);break;}
    }catch(e){if(e instanceof PublishConflict&&e.code!=='VOCABULARY_PENDING')pending.current.delete(key);throw e;}
   }
   if(mounted.current)setProgress(`${done}語の意味・例文を生成しました。内容を確認・編集してから追加してください。`);
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'意味・例文を生成できませんでした。');}
  finally{if(mounted.current){working(false);setStopping(false);refresh();}}
 }
 const pageSize=25,pageCount=Math.max(1,Math.ceil(draft.rows.length/pageSize)),currentPage=Math.min(page,pageCount-1),firstRow=currentPage*pageSize;
 const tableScroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(tableScroll.current)tableScroll.current.scrollTop=0;},[currentPage]);
 const visibleRows=draft.rows.slice(firstRow,firstRow+pageSize);
 const canSave=draft.rows.length>0&&draft.rows.every(row=>row.meaning.trim());
 return <div className="word-paste-panel">
  {editingInput?<><label htmlFor="vocabulary-input">英単語のTOON</label>
  <textarea id="vocabulary-input" value={draft.raw} disabled={busy} spellCheck={false} placeholder={'words[3]: agree,curious,improve'} onChange={event=>setDraft(old=>({...old,raw:event.target.value}))}/>
  <div className="word-paste-input-footer"><small>単語だけのTOONを500語まで。例：words[3]: agree,curious,improve</small><button className="button secondary" disabled={busy||!draft.raw.trim()} onClick={readToon}>TOONを読み込む</button></div>
  </>:<div className="word-paste-summary"><strong>{draft.rows.length}語を読み込みました</strong><button className="text-button" disabled={busy} onClick={()=>setEditingInput(true)}>入力を変更</button></div>}
  {draft.rows.length>0&&<>
   <div className="word-generation-tools">
    <div><strong><Sparkles size={17}/>AIで意味・例文を作る <span className="word-pro-badge">Pro</span></strong><p>意味を自動で選び、例文と日本語訳をまとめて作ります。</p>
     {quota?.pro&&<small role="status" className="word-quota"><span>今週あと{quota.remaining} / {quota.limit}語{quota.reserved?`（${quota.reserved}語を処理中）`:''}</span><span>毎週月曜0時（日本時間）にリセット</span></small>}
     {quota?.pro&&quota.remaining===0&&<p role="status">今週の生成上限に達しました。生成済みの内容は引き続き編集・保存できます。</p>}
    </div>
    {loading?<span role="status">生成枠を確認中…</span>:quotaError?<button className="text-button" onClick={refresh}>{quotaError} 再確認</button>:!quota?.pro?<Link className="button secondary" to="/plans">Proを見る</Link>:<button className="button primary" disabled={busy||!count||!quota.available} onClick={()=>void generate()}><Sparkles size={16}/>{!quota.available?'生成機能は準備中':!missing.length?'生成済み':!count?'今週の上限に到達':`${count}語の意味・例文を生成`}</button>}
   </div>
   {busy&&progress&&<button className="text-button" disabled={stopping} onClick={()=>{stop.current=true;setStopping(true);}}>{stopping?'いまの生成が終わったら停止します':'生成を停止'}</button>}
   {progress&&<p role="status" className="word-generation-progress">{progress}</p>}
   <p className="word-paste-review-note">生成後に、意味・例文・訳を確認して編集してください。作り直した分も生成枠に含まれます。</p>
   <div className="vocabulary-table-toolbar"><span>{firstRow+1}〜{Math.min(firstRow+pageSize,draft.rows.length)} / {draft.rows.length}語</span><small>表の中で直接編集できます<span className="vocabulary-mobile-hint">。横にスクロールできます</span></small></div>
   <div ref={tableScroll} className="vocabulary-table-scroll" role="region" aria-label="単語の編集表" tabIndex={0}>
    <table className="vocabulary-edit-table">
     <caption className="sr-only">単語・意味・例文・日本語訳の編集</caption>
     <colgroup><col className="vocabulary-term-col"/><col className="vocabulary-meaning-col"/><col className="vocabulary-example-col"/><col className="vocabulary-translation-col"/><col className="vocabulary-actions-col"/></colgroup>
     <thead><tr><th scope="col">単語</th><th scope="col">意味</th><th scope="col">例文</th><th scope="col">例文の日本語訳</th><th scope="col">操作</th></tr></thead>
     <tbody>{visibleRows.map((row,offset)=>{const index=firstRow+offset;return <tr key={row.term}>
      <th scope="row"><span className="vocabulary-row-number">{index+1}</span><strong>{row.term}</strong></th>
      <td><textarea aria-label={`${row.term}の意味`} maxLength={1000} disabled={busy} value={row.meaning} placeholder="意味を入力" onChange={event=>update(index,{meaning:event.target.value})}/></td>
      <td><textarea aria-label={`${row.term}の例文`} maxLength={1000} disabled={busy} value={row.text} placeholder="例文を入力" onChange={event=>update(index,{text:event.target.value})}/></td>
      <td><textarea aria-label={`${row.term}の例文の日本語訳`} maxLength={1000} disabled={busy} value={row.translation} placeholder="日本語訳を入力" onChange={event=>update(index,{translation:event.target.value})}/></td>
      <td><div className="vocabulary-row-actions">{row.generated&&quota?.pro&&<button className="text-button" aria-label={`${row.term}の意味・例文を作り直す`} disabled={busy||!quota.remaining||!quota.available} onClick={()=>void generate([row])}>作り直す</button>}<button className="icon-button" aria-label={`${row.term}を除外`} disabled={busy} onClick={()=>setDraft(old=>({...old,rows:old.rows.filter((_,i)=>i!==index)}))}><X size={17}/></button></div></td>
     </tr>;})}</tbody>
    </table>
   </div>
   {pageCount>1&&<nav className="vocabulary-table-pages" aria-label="単語編集のページ"><button className="button secondary" disabled={busy||currentPage===0} onClick={()=>setPage(currentPage-1)}>前の25語</button><select aria-label="編集するページ" value={currentPage} disabled={busy} onChange={event=>setPage(Number(event.target.value))}>{Array.from({length:pageCount},(_,i)=><option key={i} value={i}>{i+1} / {pageCount}ページ</option>)}</select><button className="button secondary" disabled={busy||currentPage===pageCount-1} onClick={()=>setPage(currentPage+1)}>次の25語</button></nav>}

   <div className="word-paste-input-footer"><small>意味の参考：EJDict（CC0）。辞書にない語の意味はAIが生成します。誤りが含まれる場合があります。</small><button className="button primary" disabled={busy||!canSave} onClick={()=>onPreview(draft.rows.map(row=>({word:row.term,meaning:row.meaning.trim(),tags:[],...(row.text.trim()?{examples:[{text:row.text.trim(),translation:row.translation.trim()}]}:{})})))}>この{draft.rows.length}語で単語帳を作る</button></div>
  </>}
  {error&&<p className="error-box" role="alert">{error}</p>}
 </div>;
}
