import {limitedBody,type Env} from './index';
import {standardDeck} from '../shared/standardDecks';
import {baseWordId,validReview,validReviewSession,type RecallRecord,type LearningPosition} from '../shared/learning';
import {ValidationError} from '../shared/model';
const invalid=()=>new ValidationError('学習の保存内容を確認してください。');
export async function learningRoute(request:Request,env:Env,uid:string,deckId:string){
 const standard=standardDeck(deckId);
 const deck=standard??await env.DB.prepare("SELECT word_count wordCount FROM decks WHERE id=? AND (owner_id=? OR visibility='public')").bind(deckId,uid).first<{wordCount:number}>();
 if(!deck)return Response.json({error:'単語帳が見つかりません。'},{status:404});
 const headers={'Cache-Control':'private, no-store'};
 if(request.method==='GET'){
  const ratings=await env.DB.prepare('SELECT word_id wordId,state,updated_at updatedAt,review_json reviewJson FROM learning_ratings WHERE user_id=? AND deck_id=?').bind(uid,deckId).all<RecallRecord&{reviewJson:string|null}>();
  const positions=await env.DB.prepare('SELECT position_json FROM learning_positions WHERE user_id=? AND deck_id=?').bind(uid,deckId).all<{position_json:string}>();
  return Response.json({ratings:ratings.results.map(({reviewJson,...r})=>({...r,...(reviewJson?{review:JSON.parse(reviewJson)}:{})})),positions:positions.results.map(row=>JSON.parse(row.position_json))},{headers});
 }
 if(request.method!=='POST')return Response.json({error:'対応していない操作です。'},{status:405});
 let data;try{data=JSON.parse(await limitedBody(request,48000));}catch{throw invalid();}
 if(!data||!Array.isArray(data.ratings)||!Array.isArray(data.positions)||data.ratings.length>40||data.positions.length>3||!data.ratings.length&&!data.positions.length)throw invalid();
 const time=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>0&&Number(value)<=Date.now()+300000;
 const id=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,120}$/.test(value);
 for(const item of data.ratings)if(!item||!id(item.wordId)||!['known','weak','unseen'].includes(item.state)||!time(item.updatedAt)||item.review!==undefined&&(!validReview(item.review,item.state)||item.review.dueAt>Date.now()+91*86400000))throw invalid();
 for(const p of data.positions)if(!p||!['words','examples','book'].includes(p.mode)||typeof p.wordId!=='string'||!(/^$|^[a-zA-Z0-9-]{1,120}(?::example:[0-9])?$/.test(p.wordId))||p.mode!=='book'&&!p.wordId||!Number.isSafeInteger(p.ordinal)||p.ordinal<0||p.ordinal>=deck.wordCount||!Number.isSafeInteger(p.page)||p.page<0||p.page>Math.ceil(deck.wordCount/4)||!['ordered','shuffle'].includes(p.order)||!Number.isSafeInteger(p.seed)||p.seed<0||p.seed>4294967295||typeof p.weakOnly!=='boolean'||typeof p.completed!=='boolean'||!time(p.updatedAt)||p.reviewOnly!==undefined&&typeof p.reviewOnly!=='boolean'||p.reviewSession!==undefined&&(!validReviewSession(p.reviewSession)||p.reviewSession.cursorOrdinal>deck.wordCount))throw invalid();
 for(const p of data.positions)if(p.reviewSession&&(p.mode==='book'||p.reviewSession.activeId&&p.reviewSession.activeId!==p.wordId||p.mode==='words'&&[p.reviewSession.cursorId,p.reviewSession.activeId,...p.reviewSession.pending.map((item:{wordId:string})=>item.wordId)].some((wordId:string)=>wordId.includes(':example:'))))throw invalid();
 const reviewIds=data.positions.flatMap((p:LearningPosition)=>p.reviewSession?[p.reviewSession.cursorId,p.reviewSession.activeId,...p.reviewSession.pending.map(item=>item.wordId)].filter(Boolean).map(baseWordId):[]);
 const ids=[...new Set<string>([...reviewIds,...data.ratings.map((r:RecallRecord)=>r.wordId),...data.positions.map((p:LearningPosition)=>baseWordId(p.wordId)).filter(Boolean)])];
 if(standard){for(const wordId of ids){const suffix=wordId.slice(deckId.length+1);if(!wordId.startsWith(deckId+'-')||!/^0$|^[1-9][0-9]*$/.test(suffix)||Number(suffix)>=deck.wordCount)throw invalid();}}
 else if(ids.length){const rows=await env.DB.prepare(`SELECT id FROM words WHERE deck_id=? AND id IN (${ids.map(()=>'?').join(',')})`).bind(deckId,...ids).all<{id:string}>();if(rows.results.length!==ids.length)throw invalid();}
 await env.DB.prepare('INSERT OR IGNORE INTO users(id) VALUES (?)').bind(uid).run();
 await env.DB.prepare('INSERT OR IGNORE INTO learning_decks(user_id,deck_id) SELECT ?,? WHERE (SELECT count(*) FROM learning_decks WHERE user_id=?)<200').bind(uid,deckId,uid).run();
 if(!await env.DB.prepare('SELECT 1 FROM learning_decks WHERE user_id=? AND deck_id=?').bind(uid,deckId).first())return Response.json({error:'学習記録を保存できる単語帳数の上限に達しました。'},{status:409});
 const statements=[...data.ratings.map((r:RecallRecord)=>env.DB.prepare('INSERT INTO learning_ratings(user_id,deck_id,word_id,state,updated_at,review_json) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,deck_id,word_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at,review_json=excluded.review_json WHERE excluded.updated_at>learning_ratings.updated_at').bind(uid,deckId,r.wordId,r.state,r.updatedAt,r.review?JSON.stringify({step:r.review.step,dueAt:r.review.dueAt}):null)),...data.positions.map((p:LearningPosition)=>env.DB.prepare('INSERT INTO learning_positions(user_id,deck_id,mode,position_json,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,deck_id,mode) DO UPDATE SET position_json=excluded.position_json,updated_at=excluded.updated_at WHERE excluded.updated_at>learning_positions.updated_at').bind(uid,deckId,p.mode,JSON.stringify({mode:p.mode,wordId:p.wordId,ordinal:p.ordinal,page:p.page,order:p.order,seed:p.seed,weakOnly:p.weakOnly,completed:p.completed,updatedAt:p.updatedAt,...(p.reviewOnly!==undefined?{reviewOnly:p.reviewOnly}:{}),...(p.reviewSession?{reviewSession:{pending:p.reviewSession.pending.map(item=>({wordId:item.wordId,remaining:item.remaining})),activeId:p.reviewSession.activeId,cursorId:p.reviewSession.cursorId,cursorOrdinal:p.reviewSession.cursorOrdinal}}:{})}),p.updatedAt))];
 try{await env.DB.batch(statements);}catch(error){if(String(error).includes('learning_rating_limit'))return Response.json({error:'単語の学習記録は15,000語まで保存できます。'},{status:409});throw error;}
 return Response.json({ok:true},{headers});
}
