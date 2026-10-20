import { useEffect, useState } from 'react';
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
 return <div className="audio-quota" role="status">{quota ? <><span>{quota.remaining===0?'本日の音声生成は上限に達しました':<>今日の音声生成：あと <strong>{quota.remaining}</strong> 語 / {quota.limit}語</>}</span><small>{quota.remaining===0?'生成済み音声は引き続き再生できます。':''}毎日9時にリセット</small></> : <span>音声生成の残り回数を確認できません</span>}</div>;
}
