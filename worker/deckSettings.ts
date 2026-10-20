import { LIMITS, parseDeck, ValidationError } from '../shared/model';
import { deckResult, deckSelect, wordResult, type DeckRow, type StoredWord } from './decks';
import type { Env } from './index';
export async function updateDeckSettings(env:Env,uid:string,row:DeckRow,raw:string){
 let input:unknown;try{input=JSON.parse(raw);}catch{throw new ValidationError('設定の形式を確認してください。');}
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ValidationError('設定の形式を確認してください。');
 const values=input as Record<string,unknown>;
 const words=await env.DB.prepare('SELECT id,ordinal,word,meaning,example,tags,examples_json FROM words WHERE deck_id=?').bind(row.id).all<StoredWord>();
 const parsed=parseDeck(JSON.stringify({title:values.title,description:values.description,textbookTags:values.textbookTags,theme:values.theme,words:words.results.map(wordResult)}),{maxWords:LIMITS.forkWords,allowExampleVariants:true});
 const now=new Date().toISOString();
 const statements=[env.DB.prepare('UPDATE decks SET title=?,description=?,theme=?,data_bytes=?,updated_at=? WHERE id=? AND owner_id=?').bind(parsed.title,parsed.description,parsed.theme??'',new TextEncoder().encode(JSON.stringify(parsed)).length,now,row.id,uid),env.DB.prepare('DELETE FROM deck_textbook_tags WHERE deck_id=?').bind(row.id)];
 for(const tag of parsed.textbookTags){
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO textbook_tags(id,name,edition,chapter) VALUES(?,?,?,?)').bind(crypto.randomUUID(),tag.name,tag.edition??'',tag.chapter??''));
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO deck_textbook_tags(deck_id,tag_id) SELECT ?,id FROM textbook_tags WHERE name=? AND edition=? AND chapter=?').bind(row.id,tag.name,tag.edition??'',tag.chapter??''));
 }
 await env.DB.batch(statements);
 const updated=await env.DB.prepare(`${deckSelect} WHERE d.id=? AND d.owner_id=?`).bind(row.id,uid).first<DeckRow>();
 return Response.json({deck:deckResult(updated!)});
}
