import { DeckMetadataFields, DECK_CATEGORIES, type MetadataFields } from './DeckMetadataFields';
import { useRef, useState, type ReactNode } from 'react';
import { Settings2, X } from 'lucide-react';
import { ThemePicker } from './ThemePicker';
import type { Deck } from '../../shared/model';
import type { DeckSettingsInput } from '../lib/repository';
export function DeckSettings({deck,save,onSaved,renderTrigger}:{renderTrigger?:(open:()=>void)=>ReactNode;deck:Deck;save:(id:string,values:DeckSettingsInput)=>Promise<Deck>;onSaved:(deck:Deck)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 function fields():MetadataFields{const tag=deck.textbookTags[0];return {title:deck.title,description:deck.description,category:tag?(DECK_CATEGORIES.includes(tag.name)&&!tag.edition&&!tag.chapter?tag.name:'textbook'):'',textbookName:tag?.name??'',edition:tag?.edition??''};}
 const [metadata,setMetadata]=useState<MetadataFields>(fields);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [values,setValues]=useState<DeckSettingsInput>({title:deck.title,description:deck.description,textbookTags:deck.textbookTags,theme:deck.theme});
 function open(){setError('');setMetadata(fields());setValues({title:deck.title,description:deck.description,textbookTags:deck.textbookTags,theme:deck.theme});dialog.current?.showModal();}
 async function submit(){if(busy)return;setBusy(true);setError('');try{if(metadata.category==='textbook'&&!metadata.textbookName.trim())throw new Error('教材名を入力してください。');onSaved(await save(deck.id,{...values,title:metadata.category==='textbook'?metadata.textbookName.trim():metadata.title,description:metadata.description,textbookTags:metadata.category==='textbook'?[{name:metadata.textbookName.trim(),edition:metadata.edition.trim()}]:metadata.category?[{name:metadata.category}]:[]}));dialog.current?.close();}catch(e){setError(e instanceof Error?e.message:'保存できませんでした。');}finally{setBusy(false);}}

 return <>
  {renderTrigger?renderTrigger(open):<button className="button secondary" onClick={open}><Settings2 size={17}/>単語帳の設定</button>}
  <dialog ref={dialog} className="deck-settings-dialog" aria-labelledby="deck-settings-title" onCancel={event=>{if(busy)event.preventDefault();}}>
   <form onSubmit={event=>{event.preventDefault();void submit();}}>
    <div className="deck-settings-heading"><h2 id="deck-settings-title">単語帳の設定</h2><button type="button" disabled={busy} className="icon-button" aria-label="設定を閉じる" onClick={()=>dialog.current?.close()}><X size={20}/></button></div>
    <fieldset className="deck-settings-fields" disabled={busy}>
     <DeckMetadataFields prefix="deck-settings" value={metadata} onChange={setMetadata}/>
     <ThemePicker value={values.theme} onChange={theme=>setValues({...values,theme})} disabled={busy}/>
    </fieldset>
    {error&&<p className="error-box" role="alert">{error}</p>}
    <div className="deck-settings-footer"><button type="button" className="button secondary" disabled={busy} onClick={()=>dialog.current?.close()}>キャンセル</button><button className="button primary" disabled={busy}>{busy?'保存しています…':'変更を保存'}</button></div>
   </form>
  </dialog>
 </>;
}
