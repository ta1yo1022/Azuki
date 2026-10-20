import { useRef, useState, type ReactNode } from 'react';
import { Settings2, X, Plus, Trash2 } from 'lucide-react';
import { ThemePicker } from './ThemePicker';
import type { Deck } from '../../shared/model';
import type { DeckSettingsInput } from '../lib/repository';
export function DeckSettings({deck,save,onSaved,renderTrigger}:{renderTrigger?:(open:()=>void)=>ReactNode;deck:Deck;save:(id:string,values:DeckSettingsInput)=>Promise<Deck>;onSaved:(deck:Deck)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [values,setValues]=useState<DeckSettingsInput>({title:deck.title,description:deck.description,textbookTags:deck.textbookTags,theme:deck.theme});
 function open(){setError('');setValues({title:deck.title,description:deck.description,textbookTags:deck.textbookTags,theme:deck.theme});dialog.current?.showModal();}
 async function submit(){if(busy)return;setBusy(true);setError('');try{onSaved(await save(deck.id,values));dialog.current?.close();}catch(e){setError(e instanceof Error?e.message:'保存できませんでした。');}finally{setBusy(false);}}
 function tagField(index:number,key:'name'|'edition'|'chapter',text:string){setValues(prev=>({...prev,textbookTags:prev.textbookTags.map((tag,i)=>i===index?{...tag,[key]:text}:tag)}));}
 return <>
  {renderTrigger?renderTrigger(open):<button className="button secondary" onClick={open}><Settings2 size={17}/>単語帳の設定</button>}
  <dialog ref={dialog} className="deck-settings-dialog" aria-labelledby="deck-settings-title" onCancel={event=>{if(busy)event.preventDefault();}}>
   <form onSubmit={event=>{event.preventDefault();void submit();}}>
    <div className="deck-settings-heading"><h2 id="deck-settings-title">単語帳の設定</h2><button type="button" disabled={busy} className="icon-button" aria-label="設定を閉じる" onClick={()=>dialog.current?.close()}><X size={20}/></button></div>
    <fieldset className="deck-settings-fields" disabled={busy}>
     <label>単語帳の名前<input required maxLength={80} value={values.title} onChange={e=>setValues({...values,title:e.target.value})}/></label>
     <label>説明<textarea rows={3} maxLength={240} value={values.description} onChange={e=>setValues({...values,description:e.target.value})}/></label>
     <div className="deck-settings-tags-heading"><strong>教材タグ</strong><button type="button" className="text-button" disabled={values.textbookTags.length>=6} onClick={()=>setValues({...values,textbookTags:[...values.textbookTags,{name:''}]})}><Plus size={15}/>追加</button></div>
     {values.textbookTags.map((tag,index)=><div className="deck-settings-tag" key={index}>
      <label>教材名<input required maxLength={80} value={tag.name} onChange={e=>tagField(index,'name',e.target.value)}/></label>
      <div><label>版<input maxLength={40} value={tag.edition??''} onChange={e=>tagField(index,'edition',e.target.value)}/></label><label>章・範囲<input maxLength={40} value={tag.chapter??''} onChange={e=>tagField(index,'chapter',e.target.value)}/></label><button type="button" className="icon-button" aria-label={`教材タグ${index+1}を削除`} onClick={()=>setValues({...values,textbookTags:values.textbookTags.filter((_,i)=>i!==index)})}><Trash2 size={17}/></button></div>
     </div>)}
     <ThemePicker value={values.theme} onChange={theme=>setValues({...values,theme})} disabled={busy}/>
    </fieldset>
    {error&&<p className="error-box" role="alert">{error}</p>}
    <div className="deck-settings-footer"><button type="button" className="button secondary" disabled={busy} onClick={()=>dialog.current?.close()}>キャンセル</button><button className="button primary" disabled={busy}>{busy?'保存しています…':'変更を保存'}</button></div>
   </form>
  </dialog>
 </>;
}
