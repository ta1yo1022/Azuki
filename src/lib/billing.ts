import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
export type BillingStatus={enabled:boolean;pro:boolean;testMode:boolean;monthlyPrice:number;status:string|null;periodEnd:number|null;cancelAtPeriodEnd:boolean;checkoutAvailable:boolean};
const base=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
export async function billingRequest<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const user=auth?.currentUser;
 const headers=new Headers();if(user)headers.set('Authorization',`Bearer ${await user.getIdToken()}`);
 if(body)headers.set('Content-Type','application/json');
 const response=await fetch(base+'/api/billing/'+path,{method,headers,cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json() as T&{error?:string};
 if(!response.ok)throw new Error(data.error??'契約状況を確認できませんでした。');
 return data;
}
export function useBilling(){
 const [status,setStatus]=useState<BillingStatus|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true,version=0;
  const refresh=async()=>{const current=++version;setLoading(true);try{const result=await billingRequest<BillingStatus>(auth?.currentUser?'status':'public');if(active&&version===current){setStatus(result);setError('');}}catch(e){if(active&&version===current){setStatus(null);setError(e instanceof Error?e.message:'契約を確認できませんでした。');}}finally{if(active&&version===current)setLoading(false);}};
  const update=()=>{void refresh();};
  const unsubscribe=auth?onAuthStateChanged(auth,update):(update(),()=>{});
  const timer=window.setInterval(update,60000);
  window.addEventListener('azuki-billing-updated',update);window.addEventListener('focus',update);
  return()=>{active=false;clearInterval(timer);unsubscribe();window.removeEventListener('azuki-billing-updated',update);window.removeEventListener('focus',update);};
 },[]);
 return {status,error,loading,refresh:()=>window.dispatchEvent(new Event('azuki-billing-updated'))};
}
