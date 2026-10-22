import { useEffect,useState } from 'react';
import { apiRequest } from './repository';
import { auth } from './firebase';
import type { VocabularySelection,VocabularyExample,VocabularyQuota } from '../../shared/vocabulary';
export const vocabularyRepository={
 quota:()=>apiRequest<VocabularyQuota>('/vocabulary/quota'),
 generate:async(requestId:string,words:VocabularySelection[])=>{
  try{return await apiRequest<{examples:VocabularyExample[];failed:string[];quota:VocabularyQuota}>('/vocabulary/examples',{method:'POST',body:JSON.stringify({requestId,words})});}
  finally{window.dispatchEvent(new Event('azuki-vocabulary-quota'));}
 },
};
export function useVocabularyQuota(){
 const [quota,setQuota]=useState<VocabularyQuota|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const uid=auth?.currentUser?.uid;
 useEffect(()=>{
  let active=true,version=0;
  const refresh=async()=>{const current=++version;try{const data=await vocabularyRepository.quota();if(active&&current===version){setQuota(data);setError('');}}catch{if(active&&current===version){setQuota(null);setError('生成枠を確認できませんでした。');}}finally{if(active&&current===version)setLoading(false);}};
  setQuota(null);setLoading(true);void refresh();
  const update=()=>{void refresh();};
  window.addEventListener('azuki-vocabulary-quota',update);window.addEventListener('azuki-billing-updated',update);window.addEventListener('focus',update);
  const timer=setInterval(update,60000);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('azuki-vocabulary-quota',update);window.removeEventListener('azuki-billing-updated',update);window.removeEventListener('focus',update);};
 },[uid]);
 return {quota,loading,error,refresh:()=>window.dispatchEvent(new Event('azuki-vocabulary-quota'))};
}
