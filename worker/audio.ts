import type { Env } from './index';
import { standardAssetPath, standardDeck } from '../shared/standardDecks';
import type { Word } from '../shared/model';
const MODEL='@cf/myshell-ai/melotts';
const standardCache=new Map<string,Word[]>();
const error=(message:string,status=503)=>Response.json({error:message},{status});
export async function audioKey(text:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('melotts-en-v1\0'+text));
 return 'words/en/v1/'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')+'.mp3';
}
async function sourceWord(env:Env,deckId:string,wordId:string,uid?:string){
 const standard=standardDeck(deckId);
 if(standard){
  const key=standard.id+':'+standard.contentHash;
  let words=standardCache.get(key);
  if(!words){
   const result=await fetch('https://azuki.mame-app.com'+standardAssetPath(standard));
   if(!result.ok)throw new Error('Standard content unavailable');
   words=await result.json() as Word[];
   if(!Array.isArray(words)||words.length!==standard.wordCount)throw new Error('Standard content updating');
   standardCache.set(key,words);
  }
  return words.find(word=>word.id===wordId)?.word;
 }
 const row=await env.DB.prepare(`SELECT w.word FROM words w JOIN decks d ON d.id=w.deck_id WHERE w.id=? AND w.deck_id=? AND (d.visibility='public' OR d.owner_id=?)`).bind(wordId,deckId,uid??'').first<{word:string}>();
 return row?.word;
}
async function audioBytes(result:unknown):Promise<ArrayBuffer>{
 let data:ArrayBuffer;
 if(result instanceof ReadableStream)data=await new Response(result).arrayBuffer();
 else if(result instanceof ArrayBuffer)data=result;
 else if(result instanceof Uint8Array)data=result.slice().buffer;
 else if(result&&typeof result==='object'&&'audio' in result&&typeof result.audio==='string'){
  const raw=atob(result.audio);data=Uint8Array.from(raw,char=>char.charCodeAt(0)).buffer;
 }else throw new Error('Invalid audio result');
 if(data.byteLength<16||data.byteLength>2*1024*1024)throw new Error('Invalid audio size');
 const bytes=new Uint8Array(data);const valid=(bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33)||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0);
 if(!valid)throw new Error('Invalid MP3');
 return data;
}
function audioResponse(body:ReadableStream|ArrayBuffer){return new Response(body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export async function wordAudio(request:Request,env:Env,deckId:string,wordId:string,uid?:string){
 if(request.method!=='POST')return error('この操作は利用できません。',405);
 // Resolve the actual stored word first, even when a shared audio object is already cached.
 const word=await sourceWord(env,deckId,wordId,uid);
 if(!word)return error('この単語は読み上げられません。',404);
 const text=word.normalize('NFKC').trim().replace(/\s+/g,' ');
 if(!/[A-Za-z]/.test(text)||text.length>120)return error('英単語の読み上げに対応しています。',400);
 if(!env.AUDIO||!env.AI||env.AUDIO_ENABLED!=='true')return error('音声の準備中です。しばらくしてからお試しください。');
 const key=await audioKey(text);
 const cached=await env.AUDIO.get(key);
 if(cached)return audioResponse(cached.body);
 const now=Date.now();
 const lock=await env.DB.prepare(`INSERT INTO audio_generation_locks(audio_key,expires_at) VALUES(?,?) ON CONFLICT(audio_key) DO UPDATE SET expires_at=excluded.expires_at WHERE expires_at<? RETURNING audio_key`).bind(key,now+90000,now).first();
 if(!lock)return Response.json({pending:true},{status:202,headers:{'Retry-After':'1','Cache-Control':'no-store'}});
 try{
  // Recheck after acquiring the lock, including a previous request's completed write.
  const existing=await env.AUDIO.get(key);if(existing)return audioResponse(existing.body);
  const day=new Date(now).toISOString().slice(0,10);
  const ip=request.headers.get('CF-Connecting-IP');
  const scope=await audioKey(uid?'user:'+uid:ip?'ip:'+day+':'+ip:'anonymous');
  const quota=async(scope:string,limit:number)=>env.DB.prepare(`INSERT INTO audio_generation_limits(scope,day,amount) VALUES(?,?,1) ON CONFLICT(scope,day) DO UPDATE SET amount=amount+1 WHERE amount<? RETURNING amount`).bind(scope,day,limit).first();
  const configured=Number(env.AUDIO_DAILY_GENERATION_LIMIT??'3000');
  if(!await quota(scope,100)||!await quota('global',Number.isSafeInteger(configured)&&configured>0?configured:3000))return error('本日の音声生成の上限に達しました。生成済みの音声は引き続き再生できます。',429);
  await env.DB.batch([env.DB.prepare('DELETE FROM audio_generation_limits WHERE day<=?').bind(new Date(now-7*86400000).toISOString().slice(0,10)),env.DB.prepare('DELETE FROM audio_generation_locks WHERE expires_at<?').bind(now)]);
  const generated=await env.AI.run(MODEL,{prompt:text,lang:'en'});
  const data=await audioBytes(generated);
  await env.AUDIO.put(key,data,{httpMetadata:{contentType:'audio/mpeg'}});
  return audioResponse(data);
 }catch{ return error('音声を生成できませんでした。時間をおいてもう一度お試しください。'); }
 finally{await env.DB.prepare('DELETE FROM audio_generation_locks WHERE audio_key=? AND expires_at=?').bind(key,now+90000).run();}
}

export async function cleanupWordAudio(env:Env){
 const now=Date.now();await env.DB.batch([
  env.DB.prepare('DELETE FROM audio_generation_limits WHERE day<=?').bind(new Date(now-7*86400000).toISOString().slice(0,10)),
  env.DB.prepare('DELETE FROM audio_generation_locks WHERE expires_at<?').bind(now),
 ]);
}
