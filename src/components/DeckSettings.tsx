import { useRef, useState, type ReactNode } from 'react';
import { Settings2, X } from 'lucide-react';
import { ThemePicker } from './ThemePicker';
import type { Deck } from '../../shared/model';
import type { DeckTheme } from '../../shared/deckThemes';
export function DeckSettings({deck,save,onSaved,renderTrigger}:{renderTrigger?:(open:()=>void)=>ReactNode;deck:Deck;save:(id:string,theme:DeckTheme)=>Promise<Deck>;onSaved:(deck:Deck)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function change(theme:DeckTheme){if(busy)return;setBusy(true);setError('');try{onSaved(await save(deck.id,theme));}catch(e){setError(e instanceof Error?e.message:'保存できませんでした。');}finally{setBusy(false);}}
 return <>
  {renderTrigger?renderTrigger(()=>{setError('');dialog.current?.showModal();}):<button className="button secondary" onClick={()=>{setError('');dialog.current?.showModal();}}><Settings2 size={17}/>単語帳の設定</button>}
  <dialog ref={dialog} className="deck-settings-dialog" aria-labelledby="deck-settings-title">
   <div className="deck-settings-heading"><h2 id="deck-settings-title">単語帳の設定</h2><button className="icon-button" aria-label="設定を閉じる" onClick={()=>dialog.current?.close()}><X size={20}/></button></div>
   <p className="muted">{deck.title}</p>
   <ThemePicker value={deck.theme} onChange={theme=>void change(theme)} disabled={busy}/>
   {busy&&<p role="status">保存しています…</p>}
   {error&&<p className="error-box" role="alert">{error}</p>}
  </dialog>
 </>;
}
