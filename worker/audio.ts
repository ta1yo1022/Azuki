import { billingEnabled, hasPro } from './billing';
import { wordExamples } from '../shared/model';
import type { Env } from './index';
import { standardAssetPath, standardDeck } from '../shared/standardDecks';
import type { Word } from '../shared/model';
const VOICE='en-US-Wavenet-F';
const AUDIO_VERSION='google-wavenet-en-US-Wavenet-F-mp3-v1';
const standardCache=new Map<string,Word[]>();
const error=(message:string,status=503)=>Response.json({error:message},{status});
export async function audioKey(text:string,kind:'word'|'example'='word'){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode((kind==='example'?'example:':'')+AUDIO_VERSION+'\0'+text));
 return (kind==='example'?'examples':'words')+'/google-wavenet/en-US-Wavenet-F/v1/'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')+'.audio';
}
export async function wordAudioQuota(request:Request,env:Env,uid:string){
 if(request.method!=='GET')return error('この操作は利用できません。',405);
 const day=new Date().toISOString().slice(0,10);
 const pro=await hasPro(env,uid);
 const usage=async(kind:'word'|'example')=>{
  const scope=await audioKey((kind==='example'?'examples:':'')+'user:'+uid);
  const row=await env.DB.prepare('SELECT amount FROM audio_generation_limits WHERE scope=? AND day=?').bind(scope,day).first<{amount:number}>();
  const used=row?.amount??0,limit=pro?null:kind==='word'?(billingEnabled(env)?10:100):5;
  return {used,limit,remaining:limit===null?null:Math.max(0,limit-used)};
 };
 const word=await usage('word'),example=await usage('example');
 return Response.json({...word,word,example,pro,enabled:billingEnabled(env),resetsAt:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString()},{headers:{'Cache-Control':'private, no-store'}});
}
async function sourceWord(env:Env,deckId:string,wordId:string,uid?:string,exampleIndex?:number){
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
  const word=words.find(word=>word.id===wordId);
  return word?(exampleIndex===undefined?word.word:wordExamples(word)[exampleIndex]?.text):undefined;
 }
 const row=await env.DB.prepare(`SELECT w.word,w.example,w.examples_json FROM words w JOIN decks d ON d.id=w.deck_id WHERE w.id=? AND w.deck_id=? AND (d.visibility='public' OR d.owner_id=?)`).bind(wordId,deckId,uid??'').first<{word:string;example:string;examples_json:string}>();
 if(!row)return;
 return exampleIndex===undefined?row.word:wordExamples({...row,examples:JSON.parse(row.examples_json)})[exampleIndex]?.text;
}
async function audioBytes(result:unknown):Promise<{data:ArrayBuffer;contentType:string}>{
 let data:ArrayBuffer;
 if(result instanceof ReadableStream)data=await new Response(result).arrayBuffer();
 else if(result instanceof ArrayBuffer)data=result;
 else if(result instanceof Uint8Array)data=result.slice().buffer;
 else if(result&&typeof result==='object'&&'audio' in result&&typeof result.audio==='string'){
  const raw=atob(result.audio);data=Uint8Array.from(raw,char=>char.charCodeAt(0)).buffer;
 }else throw new Error('Invalid audio result');
 if(data.byteLength<16||data.byteLength>2*1024*1024)throw new Error('Invalid audio size');
 const bytes=new Uint8Array(data);const valid=(bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33)||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0);
 if(valid)return {data,contentType:'audio/mpeg'};
 if(bytes.length>=44&&bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===65&&bytes[10]===86&&bytes[11]===69)return {data,contentType:'audio/wav'};
 throw new Error('Invalid audio format');
}
function audioResponse(body:ReadableStream|ArrayBuffer,contentType='audio/mpeg'){return new Response(body,{headers:{'Content-Type':contentType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export async function wordAudio(request:Request,env:Env,deckId:string,wordId:string,uid?:string,publicOnly=false){
 if(request.method!=='POST')return error('この操作は利用できません。',405);
 const params=new URL(request.url).searchParams;
 const example=params.get('example');
 if(example!==null&&!/^[0-9]$/.test(example))return error('例文の指定を確認してください。',400);
 const kind=example===null?'word':'example';
 // Resolve the actual stored word first, even when a shared audio object is already cached.
 const word=await sourceWord(env,deckId,wordId,publicOnly?undefined:uid,example===null?undefined:Number(example));
 if(!word)return error('この音声は読み上げられません。',404);
 const text=word.normalize('NFKC').trim().replace(/\s+/g,' ');
 if(!/[A-Za-z]/.test(text)||text.length>(kind==='word'?120:1000))return error('英単語の読み上げに対応しています。',400);
 if(!env.AUDIO||!env.GOOGLE_TTS_API_KEY||env.AUDIO_ENABLED!=='true')return error('音声の準備中です。しばらくしてからお試しください。');
 const key=await audioKey(text,kind);
 const cached=await env.AUDIO.get(key);
 if(cached)return audioResponse(cached.body,cached.httpMetadata?.contentType);
 if(!uid)return error('新しい音声の生成にはGoogleログインが必要です。生成済みの音声はそのまま再生できます。',401);
 const now=Date.now();
 const lock=await env.DB.prepare(`INSERT INTO audio_generation_locks(audio_key,expires_at) VALUES(?,?) ON CONFLICT(audio_key) DO UPDATE SET expires_at=excluded.expires_at WHERE expires_at<? RETURNING audio_key`).bind(key,now+90000,now).first();
 if(!lock)return Response.json({pending:true},{status:202,headers:{'Retry-After':'1','Cache-Control':'no-store'}});
 let stage="cache";
 let reservedScope:string|undefined;let reservedDay:string|undefined;let stored=false;
 try{
  // Recheck after acquiring the lock, including a previous request's completed write.
  const existing=await env.AUDIO.get(key);if(existing)return audioResponse(existing.body,existing.httpMetadata?.contentType);
  const day=new Date(now).toISOString().slice(0,10);
  const scope=await audioKey((kind==='example'?'examples:':'')+'user:'+uid);
  const quota=async(scope:string,day:string,limit:number)=>env.DB.prepare(`INSERT INTO audio_generation_limits(scope,day,amount) VALUES(?,?,1) ON CONFLICT(scope,day) DO UPDATE SET amount=amount+1 WHERE amount<? RETURNING amount`).bind(scope,day,limit).first();
  const pro=await hasPro(env,uid);
  const cap=kind==='word'?(billingEnabled(env)?10:100):5;
  const minute=new Date(now).toISOString().slice(0,16);
  if(!await quota(await audioKey('burst:user:'+uid),minute,30))return error('短時間に音声が生成されています。1分ほど待って再試行してください。',429);
  if(!await quota(scope,day,pro?2147483647:cap))return Response.json({error:`本日の${kind==='word'?'単語':'例文'}音声の新規生成は${cap}個までです。生成済みの音声は再生できます。`,code:'AUDIO_QUOTA_REACHED'},{status:429});
  reservedScope=scope;reservedDay=day;
  const configured=Number(env.AUDIO_DAILY_GENERATION_LIMIT??'3000');
  if(!await quota('global',day,Number.isSafeInteger(configured)&&configured>0?configured:3000))return error('現在、新しい音声の生成が混み合っています。時間をおいてお試しください。生成済み音声は再生できます。',429);
  await env.DB.batch([env.DB.prepare('DELETE FROM audio_generation_limits WHERE day<=?').bind(new Date(now-7*86400000).toISOString().slice(0,10)),env.DB.prepare('DELETE FROM audio_generation_locks WHERE expires_at<?').bind(now)]);
  stage="generation";
  const response=await fetch('https://texttospeech.googleapis.com/v1/text:synthesize',{
   method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_TTS_API_KEY},
   body:JSON.stringify({input:{text},voice:{languageCode:'en-US',name:VOICE},audioConfig:{audioEncoding:'MP3'}}),
   signal:AbortSignal.timeout(25000),
  });
  // Never expose provider responses: they may contain request or credential details.
  if(!response.ok)throw new Error('Google synthesis failed');
  const generated=await response.json() as {audioContent?:unknown};
  stage="decode";
  const data=await audioBytes({audio:generated.audioContent});
  stage="storage";
  await env.AUDIO.put(key,data.data,{httpMetadata:{contentType:data.contentType}});
  stored=true;return audioResponse(data.data,data.contentType);
 }catch(failure){console.error('Azuki word audio failed',{stage,reason:failure instanceof Error ? (/^Invalid (audio|MP3)/.test(failure.message)?failure.message:failure.name) : 'Unknown'});return Response.json({error:'音声を生成できませんでした。時間をおいてもう一度お試しください。',code:`AUDIO_${stage.toUpperCase()}_${failure instanceof Error && /^Invalid (audio|MP3)/.test(failure.message)?failure.message.replace(/ /g,'_'):failure instanceof Error?failure.name:'UNKNOWN'}`},{status:503}); }
 finally{if(reservedScope&&reservedDay&&!stored)await env.DB.prepare('UPDATE audio_generation_limits SET amount=max(0,amount-1) WHERE scope=? AND day=?').bind(reservedScope,reservedDay).run();await env.DB.prepare('DELETE FROM audio_generation_locks WHERE audio_key=? AND expires_at=?').bind(key,now+90000).run();}
}

export async function cleanupWordAudio(env:Env){
 const now=Date.now();await env.DB.batch([
  env.DB.prepare('DELETE FROM audio_generation_limits WHERE day<=?').bind(new Date(now-7*86400000).toISOString().slice(0,10)),
  env.DB.prepare('DELETE FROM audio_generation_locks WHERE expires_at<?').bind(now),
 ]);
}
