import {useCallback,useEffect,useRef,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {auth} from './firebase';
import {apiRequest} from './repository';
import {baseWordId,emptyLearning,mergeLearning,type LearningData,type Recall,type RecallRecord,type LearningPosition,type LearningMode} from '../../shared/learning';
type Store=LearningData&{pendingRatings:RecallRecord[];pendingPositions:LearningPosition[]};
const empty=():Store=>({...emptyLearning(),pendingRatings:[],pendingPositions:[]});
export const learningKey=(owner:string,deckId:string)=>`azuki.learning.v1.${owner}.${deckId}`;
export function readLearning(key:string):Store{
 try{const value=JSON.parse(localStorage.getItem(key)??'null');if(!value||!Array.isArray(value.ratings)||!Array.isArray(value.positions)||!Array.isArray(value.pendingRatings)||!Array.isArray(value.pendingPositions))return empty();
 const ratings=(rows:RecallRecord[])=>rows.filter(r=>r&&typeof r.wordId==='string'&&['known','weak','unseen'].includes(r.state)&&Number.isSafeInteger(r.updatedAt)).slice(-15000);
 const positions=(rows:LearningPosition[])=>rows.filter(p=>p&&['words','examples','book'].includes(p.mode)&&typeof p.wordId==='string'&&Number.isSafeInteger(p.ordinal)&&p.ordinal>=0&&Number.isSafeInteger(p.page)&&p.page>=0&&['ordered','shuffle'].includes(p.order)&&Number.isSafeInteger(p.seed)&&typeof p.weakOnly==='boolean'&&typeof p.completed==='boolean'&&Number.isSafeInteger(p.updatedAt)).slice(-3);
 return {ratings:ratings(value.ratings),positions:positions(value.positions),pendingRatings:ratings(value.pendingRatings),pendingPositions:positions(value.pendingPositions)};
 }catch{return empty();}
}
export function acknowledgeLearning(store:Store,sent:LearningData):Store{return {...store,pendingRatings:store.pendingRatings.filter(r=>!sent.ratings.some(s=>s.wordId===r.wordId&&s.updatedAt===r.updatedAt)),pendingPositions:store.pendingPositions.filter(p=>!sent.positions.some(s=>s.mode===p.mode&&s.updatedAt===p.updatedAt))};}
export function useLearningProgress(deckId:string,demo=false){
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [uid,setUid]=useState(()=>demo?null:auth?.currentUser?.uid??null);
 useEffect(()=>{if(!demo&&auth)return onAuthStateChanged(auth,user=>setUid(user?.uid??null));},[demo]);
 const key=learningKey(demo?'demo':uid??'anonymous',deckId);
 const [snapshot,setSnapshot]=useState(()=>({key,data:readLearning(key),ready:!uid}));
 const current=useRef(snapshot);current.current=snapshot;
 const [error,setError]=useState(''),[syncing,setSyncing]=useState(false);
 const change=useCallback((update:(old:Store)=>Store)=>{
  const memory=current.current.key===key?current.current.data:empty(),stored=readLearning(key);
  const pending=mergeLearning({ratings:memory.pendingRatings,positions:memory.pendingPositions},{ratings:stored.pendingRatings,positions:stored.pendingPositions});
  const old={...mergeLearning(memory,stored),pendingRatings:pending.ratings,pendingPositions:pending.positions},data=update(old);
  const next={key,data,ready:current.current.key===key?current.current.ready:!uid};current.current=next;if(mounted.current)setSnapshot(next);
  try{localStorage.setItem(key,JSON.stringify(data));}catch{if(mounted.current)setError('このブラウザに学習記録を保存できません。保存設定を確認してください。');}
 },[key,uid]);
 const activeRequest=useRef(new Set<string>());
 const flush=useCallback(async()=>{
  if(!uid||auth?.currentUser?.uid!==uid||current.current.key!==key||activeRequest.current.has(key))return;
  const data=current.current.data,sent={ratings:data.pendingRatings.slice(0,40),positions:data.pendingPositions};if(!sent.ratings.length&&!sent.positions.length)return;
  activeRequest.current.add(key);if(mounted.current)setSyncing(true);
  try{await apiRequest(`/learning/${encodeURIComponent(deckId)}`,{method:'POST',body:JSON.stringify(sent),keepalive:true,signal:AbortSignal.timeout(10000)});
   if(current.current.key===key){change(old=>acknowledgeLearning(old,sent));if(mounted.current)setError('');}
  }catch(e){if(mounted.current&&current.current.key===key)setError(e instanceof Error?e.message:'学習記録を同期できませんでした。');}
  finally{activeRequest.current.delete(key);if(mounted.current&&current.current.key===key)setSyncing(false);}
 },[uid,key,deckId,change]);
 useEffect(()=>{
  let active=true;const data=readLearning(key),next={key,data,ready:!uid};current.current=next;setSnapshot(next);setError('');
  async function refresh(){
   if(!uid||auth?.currentUser?.uid!==uid)return;
   try{const remote=await apiRequest<LearningData>(`/learning/${encodeURIComponent(deckId)}`,{signal:AbortSignal.timeout(10000)});if(!active)return;
    change(old=>{const merged=mergeLearning(old,remote);return {...old,...merged,pendingRatings:old.pendingRatings.filter(r=>!remote.ratings.some(s=>s.wordId===r.wordId&&s.updatedAt>=r.updatedAt)),pendingPositions:old.pendingPositions.filter(p=>!remote.positions.some(s=>s.mode===p.mode&&s.updatedAt>=p.updatedAt))};});setError('');
   }catch(e){if(active)setError(e instanceof Error?e.message:'学習記録を同期できませんでした。');}
   finally{if(active){const next={...current.current,ready:true};current.current=next;setSnapshot(next);void flush();}}
  }
  void refresh();const retry=()=>{void refresh();};const leave=()=>{void flush();};
  const storage=(event:StorageEvent)=>{if(event.key!==key||current.current.key!==key)return;
   const old=current.current.data,incoming=readLearning(key),pending=mergeLearning({ratings:old.pendingRatings,positions:old.pendingPositions},{ratings:incoming.pendingRatings,positions:incoming.pendingPositions});
   const next={...current.current,data:{...mergeLearning(old,incoming),pendingRatings:pending.ratings,pendingPositions:pending.positions}};current.current=next;setSnapshot(next);
  };
  window.addEventListener('online',retry);window.addEventListener('focus',retry);window.addEventListener('pagehide',leave);window.addEventListener('storage',storage);
  return()=>{active=false;window.removeEventListener('online',retry);window.removeEventListener('focus',retry);window.removeEventListener('pagehide',leave);window.removeEventListener('storage',storage);void flush();};
 },[key,uid,deckId,change,flush]);
 const data=snapshot.key===key?snapshot.data:empty(),ready=snapshot.key===key&&snapshot.ready;
 useEffect(()=>{if(!ready||!uid)return;const timer=setTimeout(()=>void flush(),500);return()=>clearTimeout(timer);},[data,ready,uid,flush]);
 const rate=useCallback((wordId:string,state:Recall)=>change(old=>{
  wordId=baseWordId(wordId);const previous=old.ratings.find(r=>r.wordId===wordId);const item={wordId,state,updatedAt:Math.max(Date.now(),(previous?.updatedAt??0)+1)};
  return {...old,ratings:[...old.ratings.filter(r=>r.wordId!==wordId),item],pendingRatings:[...old.pendingRatings.filter(r=>r.wordId!==wordId),item]};
 }),[change]);
 const savePosition=useCallback((position:Omit<LearningPosition,'updatedAt'>)=>change(old=>{
  const previous=old.positions.find(p=>p.mode===position.mode);
  if(previous&&Object.entries(position).every(([key,value])=>previous[key as keyof LearningPosition]===value))return old;
  const item={...position,updatedAt:Math.max(Date.now(),(previous?.updatedAt??0)+1)};
  return {...old,positions:[...old.positions.filter(p=>p.mode!==position.mode),item],pendingPositions:[...old.pendingPositions.filter(p=>p.mode!==position.mode),item]};
 }),[change]);
 const ratings=new Map(data.ratings.map(r=>[r.wordId,r.state]));
 const position=(mode:LearningMode)=>data.positions.find(p=>p.mode===mode);
 return {scope:key,ready,ratings,position,rate,savePosition,error,syncing,cloud:!!uid,pending:data.pendingRatings.length+data.pendingPositions.length,retry:flush};
}
export type LearningProgress=ReturnType<typeof useLearningProgress>;
