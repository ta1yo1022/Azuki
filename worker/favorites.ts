import { standardDeck } from '../shared/standardDecks';
import { deckSelect, deckResult, type DeckRow } from './decks';
import type { Env } from './index';
export async function favoritesRoute(request:Request, env:Env, uid:string):Promise<Response> {
  const path=new URL(request.url).pathname;
  const match=/^\/api\/favorites\/([a-zA-Z0-9-]{1,80})$/.exec(path);
  if(path==='/api/favorites' && request.method==='GET') {
    const rows=await env.DB.prepare('SELECT deck_id,created_at FROM favorites WHERE user_id=? ORDER BY created_at DESC,deck_id').bind(uid).all<{deck_id:string;created_at:string}>();
    const publicDecks=await env.DB.prepare(`${deckSelect} JOIN favorites f ON f.deck_id=d.id WHERE f.user_id=? AND d.visibility='public'`).bind(uid).all<DeckRow>();
    const available=new Map(publicDecks.results.map(row=>[row.id,deckResult(row)]));
    const favorites=[];
    for(const row of rows.results) {
      const standard=standardDeck(row.deck_id);
      const stored=available.get(row.deck_id);
      favorites.push({id:row.deck_id,createdAt:row.created_at,deck:standard ?? (stored ?? null)});
    }
    return Response.json({favorites});
  }
  if(match && request.method==='PUT') {
    const id=match[1],standard=Boolean(standardDeck(id));
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO users(id) VALUES (?)').bind(uid),
      env.DB.prepare("INSERT OR IGNORE INTO favorites(user_id,deck_id,created_at) SELECT ?,?,? WHERE ?=1 OR EXISTS(SELECT 1 FROM decks WHERE id=? AND visibility='public')").bind(uid,id,new Date().toISOString(),standard?1:0,id),
    ]);
    const exists=await env.DB.prepare('SELECT 1 FROM favorites WHERE user_id=? AND deck_id=?').bind(uid,id).first();
    return exists ? Response.json({ok:true}) : Response.json({error:'単語帳が見つからないか、公開されていません。'}, {status:404});
  }
  if(match && request.method==='DELETE') {
    await env.DB.prepare('DELETE FROM favorites WHERE user_id=? AND deck_id=?').bind(uid,match[1]).run();
    return Response.json({ok:true});
  }
  return Response.json({error:'見つかりません。'},{status:404});
}
