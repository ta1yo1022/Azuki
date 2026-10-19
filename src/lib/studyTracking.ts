import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { studyRepository } from './repository';
import { studyParts, summarizeStudy, type StudyEvent, type StudyMode, type StudyRecord } from '../../shared/studyStats';
import type { Deck } from '../../shared/model';

const PREFIX='azuki.study.v1.';
export class ActiveStudyClock {
 private previous:number;
 private interaction:number;
 private blocked=false;
 constructor(now:number){this.previous=now;this.interaction=now;}
 interact(now:number){this.interaction=now;}
 sample(now:number,visible:boolean,focused:boolean):{start:number;end:number}|null{
  const start=this.previous;this.previous=now;
  const wasBlocked=this.blocked;this.blocked=!visible||!focused;
  if(this.blocked||wasBlocked||now<=start||now-start>10000)return null;
  const end=Math.min(now,this.interaction+90000);
  return end>start?{start,end}:null;
 }
}
function read<T>(key:string):T[]{try{const value=JSON.parse(localStorage.getItem(PREFIX+key)??'[]');return Array.isArray(value)?value:[];}catch{return [];}}
function write(key:string,items:unknown[]){localStorage.setItem(PREFIX+key,JSON.stringify(items));}
const sending=new Map<string,Promise<void>>();
export function syncStudy(uid:string):Promise<void>{
 const existing=sending.get(uid);if(existing)return existing;
 const task=(async()=>{
  if(auth?.currentUser?.uid!==uid)return;
  const key=`pending.${uid}`;
  const events=read<StudyEvent>(key).filter(event=>event.start>=Date.now()-29*86400000);
  write(key,events);
  for(let offset=0;offset<events.length;offset+=20){
   if(auth?.currentUser?.uid!==uid)break;
   const batch=events.slice(offset,offset+20);await studyRepository.record(batch);
   const ids=new Set(batch.map(event=>event.id));write(key,read<StudyEvent>(key).filter(event=>!ids.has(event.id)));
  }
 })();sending.set(uid,task);void task.finally(()=>sending.delete(uid)).catch(()=>{});return task;
}
export const demoStudySummary=()=>summarizeStudy(read<StudyRecord>('demo'));
export function useStudyTracking(deck:Deck,mode:StudyMode,enabled:boolean,demo=false){
 const session=useRef(crypto.randomUUID());
 const [owner,setOwner]=useState(auth?.currentUser?.uid??null);
 useEffect(()=>{if(demo||!auth)return;return onAuthStateChanged(auth,user=>setOwner(user?.uid??null));},[demo]);
 useEffect(()=>{
  if(!enabled)return;
  const uid=demo?'demo':owner;
  if(!uid)return;
  const clock=new ActiveStudyClock(Date.now()),tabId=crypto.randomUUID(),leaseKey=PREFIX+`lease.${uid}`;
  let start:number|null=null,end=0;
  function store(){
   if(start===null)return;
   const event:StudyEvent={id:crypto.randomUUID(),sessionId:session.current,deckId:deck.id,mode,start,end};start=null;
   try{
    if(demo){const key='demo';const records=read<StudyRecord>(key).filter(record=>record.start>=Date.now()-7*86400000);for(const part of studyParts(event))records.push({...event,...part,title:deck.title});write(key,records);}
    else {const key=`pending.${uid}`;write(key,[...read<StudyEvent>(key).filter(record=>record.start>=Date.now()-29*86400000),event]);}
   }catch{/* A full or disabled browser store must not interrupt learning. */}
  }
  function sample(){
   const now=Date.now(),visible=document.visibilityState==='visible',focused=document.hasFocus();
   if(!demo&&auth?.currentUser?.uid!==uid){store();return;}
   let ownsLease=false;
   try{const lease=JSON.parse(localStorage.getItem(leaseKey)??'null');if(visible&&focused&&(!lease||lease.expires<=now||lease.id===tabId)){localStorage.setItem(leaseKey,JSON.stringify({id:tabId,expires:now+12000}));ownsLease=true;}}catch{ownsLease=true;}
   const interval=clock.sample(now,visible,focused&&ownsLease);
   if(interval){if(start!==null&&end!==interval.start)store();start??=interval.start;end=interval.end;if(end-start>=15000)store();}
   else store();
  }
  function interact(){sample();clock.interact(Date.now());}
  function flush(){sample();store();if(!demo)void syncStudy(uid!).catch(()=>{});}
  function stateChange(){flush();clock.interact(Date.now());if(document.visibilityState!=="visible"||!document.hasFocus())try{if(JSON.parse(localStorage.getItem(leaseKey)??"null")?.id===tabId)localStorage.removeItem(leaseKey);}catch{}}
  sample();
  const timer=window.setInterval(sample,5000),upload=window.setInterval(flush,15000);
  for(const name of ['pointerdown','keydown','touchstart','wheel'] as const)window.addEventListener(name,interact,{passive:true});
  document.addEventListener('visibilitychange',stateChange);window.addEventListener('blur',stateChange);window.addEventListener('focus',stateChange);window.addEventListener('pagehide',flush);window.addEventListener('online',flush);
  // Retry durable records from a previous visit.
  if(!demo)void syncStudy(uid).catch(()=>{});
  return()=>{flush();clearInterval(timer);clearInterval(upload);for(const name of ['pointerdown','keydown','touchstart','wheel'] as const)window.removeEventListener(name,interact);document.removeEventListener('visibilitychange',stateChange);window.removeEventListener('blur',stateChange);window.removeEventListener('focus',stateChange);window.removeEventListener('pagehide',flush);window.removeEventListener('online',flush);try{if(JSON.parse(localStorage.getItem(leaseKey)??'null')?.id===tabId)localStorage.removeItem(leaseKey);}catch{}};
 },[deck.id,deck.title,mode,enabled,demo,owner]);
}
