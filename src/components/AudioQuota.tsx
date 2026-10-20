import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { auth } from '../lib/firebase';
const base=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
export function AudioQuota({userId}:{userId?:string}){
 const [quota,setQuota]=useState<{remaining:number;limit:number}|null>(null);
 useEffect(()=>{
  let active=true;
  async function refresh(){
   const user=auth?.currentUser;if(!user||user.uid!==userId)return;
   try{const token=await user.getIdToken();const response=await fetch(base+'/api/audio/quota',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json() as {remaining:number;limit:number};if(!Number.isInteger(data.remaining)||!Number.isInteger(data.limit))throw new Error();if(active)setQuota(data);}catch{if(active)setQuota(null);}
  }
  setQuota(null);void refresh();
  const update=()=>{void refresh();};
  window.addEventListener('azuki-audio-quota',update);window.addEventListener('focus',update);
  const timer=window.setInterval(update,60000);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('azuki-audio-quota',update);window.removeEventListener('focus',update);};
 },[userId]);
 if(!userId)return null;
 return <div className="storage-note audio-quota" role="status">
  <span><Volume2 size={16} />単語音声の生成数</span>
  {quota ? <>
   <p>{(quota.limit-quota.remaining).toLocaleString()} / {quota.limit.toLocaleString()} 語</p>
   <div className="usage-track" role="progressbar" aria-label="本日の単語音声の生成数" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.limit-quota.remaining}><span style={{width:`${Math.min(100,Math.max(0,(quota.limit-quota.remaining)/quota.limit*100))}%`}} /></div>
   <small>{quota.remaining===0?'本日の上限に達しました。生成済み音声は再生できます。':'毎日9時にリセット'}</small>
  </> : <p>生成数を確認できません</p>}
 </div>;
}
