import {expect,it,vi,afterEach} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {standardDecks,standardAssetPath} from '../shared/standardDecks';
import {contentHash} from '../shared/content';
import {publicRoute} from '../worker/public';
import type {Env} from '../worker/index';
afterEach(()=>vi.unstubAllGlobals());
it('publishes the five original books from editable JSON with trusted fork hashes',async()=>{
 const books=standardDecks.filter(d=>d.contentSource==='ejdict');expect(books).toHaveLength(5);
 for(const book of books){
  const words=JSON.parse(readFileSync(`public${standardAssetPath(book)}`,'utf8'));
  expect(words).toHaveLength(500);expect(await contentHash(words)).toBe(book.contentHash);
  expect(book.isOfficial).toBe(true);expect(book.standard).toBe(true);
 }
});
it('serves official metadata and paginated words without D1',async()=>{
 const book=standardDecks.find(d=>d.contentSource==='ejdict')!;
 const words=JSON.parse(readFileSync(`public${standardAssetPath(book)}`,'utf8'));
 const fetch=vi.fn(async()=>Response.json(words));vi.stubGlobal('fetch',fetch);
 const env={DB:{prepare(){throw Error('Must not read D1');}}} as unknown as Env;
 const metadata=await publicRoute(new Request(`https://api.test/api/public/decks/${book.id}`),env);
 expect((await metadata.json() as any).deck.id).toBe(book.id);
 const response=await publicRoute(new Request(`https://api.test/api/public/decks/${book.id}/words?cursor=450`),env);
 expect(await response.json()).toEqual({words:words.slice(450),nextCursor:null});
 expect(fetch).toHaveBeenCalledWith(`https://azuki.mame-app.com${standardAssetPath(book)}`);
});
it('removes only editorial originals while preserving user copies and lineage',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')&&f<'0012').sort()) db.exec(readFileSync(`migrations/${f}`,'utf8'));
 db.exec(`INSERT INTO users(id) VALUES ('azuki:official'),('user');
 INSERT INTO decks(id,owner_id,title,word_count,created_at,updated_at,data_bytes) VALUES ('azuki-official-daily-v1','azuki:official','Original',1,'now','now',100);
 INSERT INTO decks(id,owner_id,title,word_count,created_at,updated_at,data_bytes,source_deck_id,root_deck_id) VALUES ('copy','user','Copy',1,'now','now',100,'azuki-official-daily-v1','azuki-official-daily-v1');
 INSERT INTO words(id,deck_id,ordinal,word,meaning,example,tags) VALUES ('a','azuki-official-daily-v1',0,'wake','起きる','','[]'),('b','copy',0,'wake','起きる','','[]');`);
 const before=db.prepare("SELECT * FROM decks WHERE id='copy'").get();
 db.exec(readFileSync('migrations/0012_official_static_content.sql','utf8'));
 expect(db.prepare('SELECT * FROM decks').all()).toEqual([before]);
 expect(db.prepare('SELECT deck_id FROM words').all()).toEqual([{deck_id:'copy'}]);
 expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);db.close();
});

it('blocks republication of static official content even after the original leaves D1',async()=>{
 const {setVisibility}=await import('../worker/publishing');
 const book=standardDecks.find(d=>d.contentSource==='ejdict')!;
 const env={DB:{prepare(){throw Error('Must reject before D1');}}} as unknown as Env;
 const response=await setVisibility(env,'user',{id:'copy',visibility:'private',content_hash:book.contentHash} as any,'public');
 expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'duplicate_content',existingDeckId:book.id});
});
