import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { auth } from '../lib/firebase';
const base=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
type Usage={used:number;limit:number|null;remaining:number|null};
type Quota={word:Usage;example:Usage;pro:boolean;enabled:boolean};
export function AudioQuota({userId}:{userId?:string}){
 const [quota,setQuota]=useState<Quota|null>(null);
 useEffect(()=>{
  let active=true;
  async function refresh(){
   const user=auth?.currentUser;if(!user||user.uid!==userId)return;
   try{const token=await user.getIdToken();const response=await fetch(base+'/api/audio/quota',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json() as Quota;if(!data.word||!data.example)throw new Error();if(active)setQuota(data);}catch{if(active)setQuota(null);}
  }
  setQuota(null);void refresh();const update=()=>{void refresh();};
  window.addEventListener('azuki-audio-quota',update);window.addEventListener('azuki-billing-updated',update);window.addEventListener('focus',update);
  const timer=window.setInterval(update,60000);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('azuki-audio-quota',update);window.removeEventListener('azuki-billing-updated',update);window.removeEventListener('focus',update);};
 },[userId]);
 if(!userId)return null;
 return <div className="sidebar-audio-usage">{(['word','example'] as const).map(kind=>{
 const usage=quota?.[kind],label=kind==='word'?'単語音声の生成数':'例文音声の生成数';
 return <div className="storage-note audio-quota" role="status" key={kind}><span><Volume2 size={16}/>{label}</span>{usage?<><p>{usage.used.toLocaleString()} / {usage.limit===null?'無制限':usage.limit.toLocaleString()} 個</p>{usage.limit!==null&&<div className="usage-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={Math.min(usage.limit,usage.used)}><span style={{width:`${Math.min(100,usage.used/usage.limit*100)}%`}}/></div>}{usage.remaining===0&&<small>本日の新規生成は上限に達しました</small>}</>:<p>生成数を確認できません</p>}</div>;
 })}<small className="audio-quota-caption">生成済み音声の再生は枠に含みません。毎日9時にリセット。</small></div>;
}
