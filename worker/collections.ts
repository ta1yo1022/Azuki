import {limitedBody,type Env} from './index';
import {ValidationError} from '../shared/model';
export async function collectionsRoute(request:Request,env:Env,uid:string):Promise<Response>{
 const path=new URL(request.url).pathname,match=/^\/api\/collections\/([a-zA-Z0-9-]{1,80})$/.exec(path);
 if(path==='/api/collections'&&request.method==='GET'){
  const rows=await env.DB.prepare('SELECT id,name FROM collections WHERE user_id=? ORDER BY created_at,id').bind(uid).all<{id:string;name:string}>();
  const members=await env.DB.prepare('SELECT collection_id,deck_id FROM collection_decks WHERE user_id=?').bind(uid).all<{collection_id:string;deck_id:string}>();
  return Response.json({collections:rows.results.map(row=>({...row,deckIds:members.results.filter(m=>m.collection_id===row.id).map(m=>m.deck_id)}))});
 }
 if(match&&request.method==='DELETE'){
  await env.DB.prepare('DELETE FROM collections WHERE user_id=? AND id=?').bind(uid,match[1]).run();return Response.json({ok:true});
 }
 if((path==='/api/collections'&&request.method==='POST')||(match&&request.method==='PUT')){
  let data;try{data=JSON.parse(await limitedBody(request,16*1024));}catch(e){if(e instanceof ValidationError)throw e;throw new ValidationError('送信データの形式を確認してください。');}
  if(!data||typeof data.name!=='string'||!data.name.trim()||data.name.trim().length>60)throw new ValidationError('コレクション名は1〜60文字で入力してください。');
  if(!Array.isArray(data.deckIds)||data.deckIds.length>200||data.deckIds.some((id:unknown)=>typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id)))throw new ValidationError('単語帳は200冊以内で選択してください。');
  const ids=[...new Set<string>(data.deckIds)],id=match?.[1]??crypto.randomUUID();
  if(match&&!await env.DB.prepare('SELECT 1 FROM collections WHERE user_id=? AND id=?').bind(uid,id).first())return Response.json({error:'コレクションが見つかりません。'},{status:404});
  // Only books already in this user's library may be organized.
  const own=await env.DB.prepare('SELECT id FROM decks WHERE owner_id=? UNION SELECT deck_id AS id FROM favorites WHERE user_id=?').bind(uid,uid).all<{id:string}>();
  const allowed=new Set(own.results.map(row=>row.id));
  if(ids.some(id=>!allowed.has(id)))throw new ValidationError('ライブラリにある単語帳を選択してください。');
  try{
   await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO users(id) VALUES (?)').bind(uid),
    match?env.DB.prepare('UPDATE collections SET name=? WHERE user_id=? AND id=?').bind(data.name.trim(),uid,id):env.DB.prepare('INSERT INTO collections(id,user_id,name,created_at) VALUES (?,?,?,?)').bind(id,uid,data.name.trim(),new Date().toISOString()),
    env.DB.prepare('DELETE FROM collection_decks WHERE user_id=? AND collection_id=?').bind(uid,id),
    env.DB.prepare('INSERT INTO collection_decks(user_id,collection_id,deck_id) SELECT ?,?,value FROM json_each(?)').bind(uid,id,JSON.stringify(ids)),
   ]);
  }catch(e){if(e instanceof Error&&/collection_(count|members)_limit/.test(e.message))return Response.json({error:'コレクションは50個、所属する単語帳は合計1,000件までです。'},{status:429});throw e;}
  return Response.json({id,name:data.name.trim(),deckIds:ids});
 }
 return Response.json({error:'見つかりません。'},{status:404});
}
