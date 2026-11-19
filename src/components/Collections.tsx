import {useEffect,useRef,useState} from 'react';
import {FolderOpen,Plus,Settings2,X} from 'lucide-react';
import type {Deck} from '../../shared/model';
import {collectionsRepository,type Collection} from '../lib/collections';
import {favoritesRepository,type Favorite} from '../lib/repository';
import {useI18n} from '../lib/i18n';
export function Collections({decks,revision,onFilter}:{decks:Deck[];revision:number;onFilter:(ids:string[]|null)=>void}){
 const t=useI18n(),dialog=useRef<HTMLDialogElement>(null);
 const [items,setItems]=useState<Collection[]>([]),[favorites,setFavorites]=useState<Favorite[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [editing,setEditing]=useState<string>(),[name,setName]=useState(''),[ids,setIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[formError,setFormError]=useState(''),[confirmDelete,setConfirmDelete]=useState(false),[query,setQuery]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');Promise.all([collectionsRepository.list(),favoritesRepository.list()]).then(([groups,saved])=>{if(active){setItems(groups);setFavorites(saved);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[decks,revision,retry]);
 useEffect(()=>{onFilter(selected?items.find(item=>item.id===selected)?.deckIds??[]:null);},[items,selected,onFilter]);
 function open(item?:Collection){setEditing(item?.id);setName(item?.name??'');setIds(item?.deckIds??[]);setFormError('');setConfirmDelete(false);setQuery('');dialog.current?.showModal();}
 const books=new Map<string,string>([...favorites.map(item=>[item.id,item.deck?.title??t('この単語帳は現在開けません')] as [string,string]),...decks.map(deck=>[deck.id,deck.title] as [string,string])]);
 async function save(){if(busy)return;setBusy(true);setFormError('');try{const item=await collectionsRepository.save({id:editing,name,deckIds:ids.filter(id=>books.has(id))});setItems(prev=>editing?prev.map(old=>old.id===editing?item:old):[...prev,item]);setSelected(item.id);dialog.current?.close();}catch(e){setFormError(e instanceof Error?e.message:t('保存できませんでした。'));}finally{setBusy(false);}}
 async function remove(){if(!editing||busy)return;setBusy(true);setFormError('');try{await collectionsRepository.remove(editing);setItems(prev=>prev.filter(item=>item.id!==editing));if(selected===editing)setSelected('');dialog.current?.close();}catch(e){setFormError(e instanceof Error?e.message:t('削除できませんでした。'));}finally{setBusy(false);}}
 return <section className="collections-section" aria-label={t('コレクション')}>
  <div className="collections-heading"><h2><FolderOpen size={20}/>{t('コレクション')}</h2><button className="text-button" disabled={loading||Boolean(error)} onClick={()=>open()}><Plus size={16}/>{t('新しく作る')}</button></div>
  {loading?<p className="muted">{t('読み込んでいます…')}</p>:error?<p role="alert">{t(error)} <button onClick={()=>setRetry(n=>n+1)}>{t('再読み込み')}</button></p>:<div className="collection-filters"><button className={`filter-chip ${!selected?'selected':''}`} aria-pressed={!selected} onClick={()=>setSelected('')}>{t('すべて')}</button>{items.map(item=><button className={`filter-chip ${selected===item.id?'selected':''}`} aria-pressed={selected===item.id} key={item.id} onClick={()=>setSelected(item.id)}>{item.name}<span>{item.deckIds.length}</span></button>)}{selected&&<button className="text-button" onClick={()=>open(items.find(item=>item.id===selected))}><Settings2 size={16}/>{t('コレクションを編集')}</button>}</div>}
  {!loading&&!error&&!items.length&&<p className="muted">{t('単語帳を用途別に整理できます。同じ単語帳を複数のコレクションに追加できます。')}</p>}
  <dialog ref={dialog} className="deck-settings-dialog collection-dialog" aria-labelledby="collection-dialog-title" onCancel={e=>{if(busy)e.preventDefault();}} onClick={e=>{if(e.target===e.currentTarget&&!busy)dialog.current?.close();}}>
   <form onSubmit={e=>{e.preventDefault();void save();}}>
    <div className="deck-settings-heading"><h2 id="collection-dialog-title">{t(editing?'コレクションを編集':'コレクションを作成')}</h2><button type="button" className="icon-button" aria-label={t('閉じる')} disabled={busy} onClick={()=>dialog.current?.close()}><X size={20}/></button></div>
    <fieldset disabled={busy} className="collection-fields"><label>{t('コレクション名')}<input value={name} maxLength={60} required onChange={e=>setName(e.target.value)} autoFocus/></label><label>{t('単語帳を検索')}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><p className="muted">{t('選択した単語帳：{0}冊',ids.length)}</p><div className="collection-book-list">{[...books].filter(([,title])=>title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(([id,title])=><label key={id}><input type="checkbox" checked={ids.includes(id)} onChange={e=>setIds(prev=>e.target.checked?[...prev,id]:prev.filter(value=>value!==id))}/><span>{title}</span></label>)}{!books.size&&<p>{t('まず単語帳を追加するか、お気に入りに登録してください。')}</p>}</div></fieldset>
    {formError&&<p className="error-box" role="alert">{t(formError)}</p>}
    {confirmDelete&&<div className="collection-delete-confirm"><p>{t('コレクションを削除しますか？単語帳は削除されません。')}</p><button type="button" className="text-button" disabled={busy} onClick={()=>void remove()}>{t('コレクションを削除')}</button><button type="button" className="text-button" disabled={busy} onClick={()=>setConfirmDelete(false)}>{t('戻る')}</button></div>}
    <div className="deck-settings-footer">{editing&&!confirmDelete&&<button type="button" className="text-button" disabled={busy} onClick={()=>setConfirmDelete(true)}>{t('コレクションを削除')}</button>}<button className="button primary" disabled={busy||!name.trim()}>{t(busy?'保存しています…':'保存')}</button></div>
   </form>
  </dialog>
 </section>;
}
