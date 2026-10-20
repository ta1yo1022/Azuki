import { auth } from './firebase';
const base=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
let context:AudioContext|undefined;
let current: {id:number;controller:AbortController;source?:AudioBufferSourceNode;notify:(state:'idle'|'loading'|'playing')=>void}|undefined;
let serial=0;
export function stopWordAudio(id?:number){
 if(!current||(id!==undefined&&current.id!==id))return;
 const active=current;current=undefined;active.controller.abort();try{active.source?.stop();}catch{/* Already ended. */}active.notify('idle');
}
export function playWordAudio(deckId:string,wordId:string,isPublic:boolean,notify:(state:'idle'|'loading'|'playing')=>void,onError:(message:string)=>void){
 stopWordAudio();
 const active={id:++serial,controller:new AbortController(),notify,source:undefined as AudioBufferSourceNode|undefined};current=active;notify('loading');
 // Unlock audio in the original user gesture, before the network request (including iOS).
 try{context??=new AudioContext();}catch{current=undefined;notify('idle');onError('このブラウザでは音声を再生できません。');return active.id;}
 const ready=context.resume();
 void (async()=>{
  try{
   await ready;
   const headers=new Headers();
   if(!isPublic){const user=auth?.currentUser;if(!user)throw new Error('Googleアカウントでログインしてください。');headers.set('Authorization',`Bearer ${await user.getIdToken()}`);}
   let response:Response|undefined;
   for(let attempt=0;attempt<30;attempt++){
    response=await fetch(`${base}/api/${isPublic?'public/':''}decks/${encodeURIComponent(deckId)}/words/${encodeURIComponent(wordId)}/audio`,{method:'POST',headers,signal:active.controller.signal,cache:'no-store'});
    if(response.status!==202)break;
    await new Promise<void>((resolve,reject)=>{const signal=active.controller.signal;const cancel=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},1000);if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});});
   }
   if(!response||response.status===202)throw new Error('音声を準備しています。少し待ってからもう一度お試しください。');
   if(!response.ok){const result=await response.json().catch(()=>({})) as {error?:string};throw new Error(result.error??'音声を取得できませんでした。');}
   const buffer=await context!.decodeAudioData(await response.arrayBuffer());
   if(current!==active||active.controller.signal.aborted)return;
   const source=context!.createBufferSource();source.buffer=buffer;source.connect(context!.destination);active.source=source;
   source.onended=()=>{source.disconnect();if(current===active){current=undefined;notify('idle');}};
   notify('playing');source.start();
  }catch(error){if(active.controller.signal.aborted||current!==active)return;current=undefined;notify('idle');onError(error instanceof Error?error.message:'音声を再生できませんでした。');}
 })();
 return active.id;
}
