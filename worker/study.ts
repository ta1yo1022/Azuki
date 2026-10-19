import { standardDeck } from '../shared/standardDecks';
import { studyDay, studyParts, summarizeStudy, type StudyEvent, type StudyRecord } from '../shared/studyStats';
import { ValidationError } from '../shared/model';
import { limitedBody, type Env } from './index';
export async function studyRoute(request:Request,env:Env,uid:string):Promise<Response>{
 if(request.method==='GET'){
  const since=studyDay(Date.now()-6*86400000);
  const rows=await env.DB.prepare('SELECT event_id id,session_id sessionId,deck_id deckId,deck_title title,mode,started_at start,ended_at end,day,milliseconds FROM study_activity WHERE user_id=? AND day>=? ORDER BY started_at').bind(uid,since).all<StudyRecord>();
  return Response.json(summarizeStudy(rows.results));
 }
 if(request.method!=='POST')return Response.json({error:'対応していない操作です。'},{status:405});
 let data;try{data=JSON.parse(await limitedBody(request,32000));}catch{throw new ValidationError("学習記録のJSONを確認してください。");}
 if(!data||typeof data!=="object")throw new ValidationError("学習記録の形式を確認してください。");
 if(!Array.isArray(data.events)||data.events.length<1||data.events.length>20)throw new ValidationError('学習記録の形式を確認してください。');
 const events:StudyEvent[]=data.events,now=Date.now();
 for(const event of events)if(!event||![event.id,event.sessionId,event.deckId].every(value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value))||!['words','examples','book'].includes(event.mode)||!Number.isSafeInteger(event.start)||!Number.isSafeInteger(event.end)||event.end<=event.start||event.end-event.start>60000||event.end>now+10000||event.start<now-30*86400000)throw new ValidationError('学習記録の日時や内容を確認してください。');
 const titles=new Map<string,string>();
 const missing:string[]=[];
 for(const id of new Set(events.map(event=>event.deckId))){const standard=standardDeck(id);if(standard)titles.set(id,standard.title);else missing.push(id);}
 if(missing.length){const rows=await env.DB.prepare(`SELECT id,title FROM decks WHERE id IN (${missing.map(()=>'?').join(',')}) AND (owner_id=? OR visibility='public')`).bind(...missing,uid).all<{id:string;title:string}>();for(const row of rows.results)titles.set(row.id,row.title);}
 const statements=[env.DB.prepare('INSERT OR IGNORE INTO users(id) VALUES (?)').bind(uid)];
 for(const event of events){const title=titles.get(event.deckId);if(!title)continue;for(const part of studyParts(event))statements.push(env.DB.prepare('INSERT OR IGNORE INTO study_activity(user_id,event_id,day,session_id,deck_id,deck_title,mode,started_at,ended_at,milliseconds) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(uid,event.id,part.day,event.sessionId,event.deckId,title,event.mode,event.start,event.end,part.milliseconds));}
 await env.DB.batch(statements);
 return Response.json({ok:true});
}
