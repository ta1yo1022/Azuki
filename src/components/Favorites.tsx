import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, X } from 'lucide-react';
import { favoritesRepository, type Favorite } from '../lib/repository';
import { auth, googleSignIn } from '../lib/firebase';

export function FavoriteButton({id,userId}:{id:string;userId?:string}) {
  const [saved,setSaved]=useState(false),[ready,setReady]=useState(!userId),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const revision=useRef(0);
  useEffect(()=>{
    const current=++revision.current;
    let active=true;setSaved(false);setReady(!userId);setError('');
    if(userId)favoritesRepository.list().then(items=>{if(active&&current===revision.current){setSaved(items.some(item=>item.id===id));setReady(true);}}).catch(e=>{if(active&&current===revision.current)setError(e.message);});
    return()=>{active=false;};
  },[id,userId]);
  async function toggle(){
    ++revision.current;setBusy(true);setError('');
    try {
      if(!auth?.currentUser)await googleSignIn();
      // Signing in always adds idempotently; toggling off requires a known saved state.
      if(!userId){await favoritesRepository.add(id);setSaved(true);}
      else if(saved){await favoritesRepository.remove(id);setSaved(false);}
      else {await favoritesRepository.add(id);setSaved(true);}
      ++revision.current;setReady(true);
    }catch(e){setError(e instanceof Error?e.message:'お気に入りを更新できませんでした。');}
    finally{setBusy(false);}
  }
  return <div className="favorite-action"><button className="button secondary" aria-pressed={saved} disabled={busy||(!ready&&!error)} onClick={()=>void toggle()}><Star size={17} fill={saved?'currentColor':'none'}/>{busy?'更新しています…':saved?'お気に入り登録済み':'お気に入りに登録'}</button>{error&&<p role="alert" className="error-box">{error} <button onClick={()=>void toggle()} disabled={busy}>再試行</button></p>}</div>;
}

export function Favorites({owner}:{owner:string}){
  const [items,setItems]=useState<Favorite[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;setItems([]);setLoading(true);setError('');
    favoritesRepository.list().then(result=>{if(active)setItems(result);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[owner,retry]);
  async function remove(id:string){setBusy(id);setError('');try{await favoritesRepository.remove(id);setItems(prev=>prev.filter(item=>item.id!==id));}catch(e){setError(e instanceof Error?e.message:'解除できませんでした。');}finally{setBusy('');}}
  return <section className="favorites-section" aria-labelledby="favorites-heading"><div className="favorites-heading"><h2 id="favorites-heading"><Star size={20}/>お気に入り</h2><Link to="/explore">公開単語帳を探す →</Link></div><p className="muted">コピーせず、元の単語帳を開きます。保存上限には含まれません。</p>{loading?<p>お気に入りを読み込んでいます…</p>:items.length?<div className="favorites-grid">{items.map(item=><article className="favorite-card" key={item.id}>{item.deck?<Link to={`/shared/${encodeURIComponent(item.id)}`}><span className="eyebrow">{item.deck.isOfficial?'Azuki運営 発行':'公開単語帳'}</span><h3>{item.deck.title}</h3><span className="muted">{item.deck.wordCount.toLocaleString()} 語 · 元の単語帳を読む →</span></Link>:<div><h3>この単語帳は現在開けません</h3><p className="muted">非公開または削除されています。</p></div>}<button className="icon-button" aria-label={`${item.deck?.title??'開けない単語帳'}をお気に入りから外す`} disabled={Boolean(busy)} onClick={()=>void remove(item.id)}><X size={18}/></button></article>)}</div>:<p className="muted">気になる公開単語帳を、お気に入りに登録できます。</p>}{error&&<p role="alert" className="error-box">{error} <button onClick={()=>setRetry(n=>n+1)}>再読み込み</button></p>}</section>;
}
