import { LIMITS, parseDeck, ValidationError } from '../shared/model';
import { deckResult, deckSelect, type DeckRow } from './decks';
import type { Env } from './index';
export async function updateDeckSettings(env:Env,uid:string,row:DeckRow,raw:string){
 let input:unknown;try{input=JSON.parse(raw);}catch{throw new ValidationError('設定の形式を確認してください。');}
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ValidationError('設定の形式を確認してください。');
 const values=input as Record<string,unknown>;
 // Validate only editable metadata. Stored word IDs/ordinals are not import JSON.
 const {words:ignored,...parsed}=parseDeck(JSON.stringify({title:values.title,description:values.description,textbookTags:values.textbookTags,theme:values.theme,words:[{word:'validation',meaning:'validation'}]}));
 const metadataSize=(value:{title:string;description:string;textbookTags:{name:string;edition?:string;chapter?:string}[];theme?:string})=>new TextEncoder().encode(JSON.stringify({title:value.title,description:value.description,textbookTags:value.textbookTags.map(tag=>({name:tag.name,...(tag.edition?{edition:tag.edition}:{}),...(tag.chapter?{chapter:tag.chapter}:{})})),...(value.theme?{theme:value.theme}:{})})).length;
 const oldSize=metadataSize({title:row.title,description:row.description,textbookTags:JSON.parse(row.textbook_tags),theme:row.theme});
 const bytes=Math.max(0,row.data_bytes+metadataSize(parsed)-oldSize);
 if(bytes>LIMITS.bytes)throw new ValidationError('設定の変更で単語帳の容量上限（512KB）を超えます。名前や説明を短くしてください。');
 const now=new Date().toISOString();
 const statements=[env.DB.prepare('UPDATE decks SET title=?,description=?,theme=?,data_bytes=?,updated_at=? WHERE id=? AND owner_id=?').bind(parsed.title,parsed.description,parsed.theme??'',bytes,now,row.id,uid),env.DB.prepare('DELETE FROM deck_textbook_tags WHERE deck_id=?').bind(row.id)];
 for(const tag of parsed.textbookTags){
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO textbook_tags(id,name,edition,chapter) VALUES(?,?,?,?)').bind(crypto.randomUUID(),tag.name,tag.edition??'',tag.chapter??''));
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO deck_textbook_tags(deck_id,tag_id) SELECT ?,id FROM textbook_tags WHERE name=? AND edition=? AND chapter=?').bind(row.id,tag.name,tag.edition??'',tag.chapter??''));
 }
 await env.DB.batch(statements);
 const updated=await env.DB.prepare(`${deckSelect} WHERE d.id=? AND d.owner_id=?`).bind(row.id,uid).first<DeckRow>();
 return Response.json({deck:deckResult(updated!)});
}
