import {beforeEach,afterEach,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {sqliteD1} from './helpers/sqliteD1';
import {createHandler,type Env} from '../worker';
let db:DatabaseSync,env:Env;
const handler=createHandler(async token=>{if(['alice','bob'].includes(token))return token;throw Error('Unauthorized');});
function call(id:string,method='GET',data?:unknown,who='alice') {return handler(new Request('https://api.test/api/learning/'+id,{method,headers:{Authorization:'Bearer '+who,Origin:'https://azuki.test','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);}
beforeEach(()=>{db=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));env={DB:sqliteD1(db),FIREBASE_PROJECT_ID:'test',ALLOWED_ORIGINS:'https://azuki.test',ALLOW_IMPORTS:'true'};});
afterEach(()=>db.close());
const id='azuki-cefrj-a1-1-v1',wordId=id+'-0';
const rating=(state='weak',updatedAt=Date.now())=>({wordId,state,updatedAt});
const position=(overrides:Record<string,unknown>={})=>({mode:'words',wordId,ordinal:0,page:0,order:'ordered',seed:42,weakOnly:false,completed:false,updatedAt:Date.now(),...overrides});
it('persists independent recall and positions for each authenticated account without modifying standard content',async()=>{
 const now=Date.now();expect((await call(id,'POST',{ratings:[rating('weak',now)],positions:[position({updatedAt:now})]})).status).toBe(200);
 const result=await call(id);expect(result.headers.get('Cache-Control')).toBe('no-store');expect(await result.json()).toMatchObject({ratings:[{wordId,state:'weak'}],positions:[{mode:'words',seed:42}]});
 expect(await (await call(id,'GET',undefined,'bob')).json()).toEqual({ratings:[],positions:[]});
 expect((await call(id,'POST',{ratings:[rating('known',now+2)],positions:[]},'bob')).status).toBe(200);
 expect((await (await call(id)).json() as any).ratings[0].state).toBe('weak');
 expect((db.prepare('SELECT count(*) n FROM words').get() as any).n).toBe(0);
});
it('ignores older retries and preserves other modes and word states',async()=>{
 const now=Date.now();await call(id,'POST',{ratings:[rating('known',now)],positions:[position({updatedAt:now}),position({mode:'book',wordId:'',page:3,ordinal:8,updatedAt:now})]});
 await call(id,'POST',{ratings:[rating('weak',now-10)],positions:[position({updatedAt:now-10,ordinal:3,wordId:id+'-3'})]});
 const data=await (await call(id)).json() as any;expect(data.ratings[0].state).toBe('known');expect(data.positions).toHaveLength(2);expect(data.positions.find((p:any)=>p.mode==='words').wordId).toBe(wordId);
 await call(id,'POST',{ratings:[rating('unseen',now+1)],positions:[]});expect((await (await call(id)).json() as any).ratings[0].state).toBe('unseen');
});
it('validates word membership, timestamps, bounds and write batch limits before writing',async()=>{
 const cases=[{ratings:[{...rating(),wordId:'invented'}],positions:[]},{ratings:[rating('bad')],positions:[]},{ratings:[rating('known',Date.now()+600000)],positions:[]},{ratings:[],positions:[position({page:99999})]},{ratings:[],positions:[position({wordId:''})]},{ratings:[],positions:[position({seed:-1})]},{ratings:Array.from({length:41},()=>rating()),positions:[]}];
 for(const data of cases)expect((await call(id,'POST',data)).status).toBe(400);
 expect((db.prepare('SELECT count(*) n FROM learning_ratings').get() as any).n).toBe(0);
});
it('protects private decks and validates custom word ownership independently from the deck ID',async()=>{
 db.exec("INSERT INTO users(id) VALUES ('alice'); INSERT INTO decks(id,owner_id,title,word_count,created_at,updated_at) VALUES ('mine','alice','Mine',1,'2026-11-12','2026-11-12'); INSERT INTO words(id,deck_id,ordinal,word,meaning,example,tags) VALUES ('mine-word','mine',0,'book','本','','[]');");
 expect((await call('mine','GET',undefined,'bob')).status).toBe(404);expect((await call('mine','POST',{ratings:[{...rating(),wordId:'mine-word'}],positions:[]},'bob')).status).toBe(404);
 expect((await call('mine','POST',{ratings:[rating()],positions:[]})).status).toBe(400);
 expect((await call('mine','POST',{ratings:[{...rating(),wordId:'mine-word'}],positions:[]})).status).toBe(200);
 db.exec("UPDATE decks SET visibility='public' WHERE id='mine'");expect((await call('mine','POST',{ratings:[{...rating(),wordId:'mine-word'}],positions:[]},'bob')).status).toBe(200);
 db.exec("UPDATE decks SET visibility='private' WHERE id='mine'");expect((await call('mine','GET',undefined,'bob')).status).toBe(404);
});
it('caps tracked decks while allowing updates to an existing deck',async()=>{
 db.exec("INSERT INTO users(id) VALUES ('alice'); WITH RECURSIVE n(v) AS (SELECT 1 UNION ALL SELECT v+1 FROM n WHERE v<200) INSERT INTO learning_decks(user_id,deck_id) SELECT 'alice','old-'||v FROM n;");
 expect((await call(id,'POST',{ratings:[rating()],positions:[]})).status).toBe(409);
 db.prepare('UPDATE learning_decks SET deck_id=? WHERE user_id=? AND deck_id=?').run(id,'alice','old-1');expect((await call(id,'POST',{ratings:[rating()],positions:[]})).status).toBe(200);
});
it('enforces the 15,000-rating cap atomically and still lets existing ratings change',async()=>{
 db.exec("INSERT INTO users(id) VALUES ('alice');");db.prepare('INSERT INTO learning_decks(user_id,deck_id) VALUES (?,?)').run('alice',id);
 db.exec("DROP TRIGGER learning_rating_limit; WITH RECURSIVE n(v) AS (SELECT 0 UNION ALL SELECT v+1 FROM n WHERE v<14999) INSERT INTO learning_ratings(user_id,deck_id,word_id,state,updated_at) SELECT 'alice','"+id+"','"+id+"-'||v,'weak',1 FROM n;");
 const migration=readFileSync(new URL('../migrations/0027_learning_progress.sql',import.meta.url),'utf8');db.exec(migration.slice(migration.indexOf('CREATE TRIGGER')));
 expect((await call(id,'POST',{ratings:[rating('known')],positions:[]})).status).toBe(200);
 // Another valid standard deck has an existing registry entry but would add rating 15,001.
 const other='azuki-cefrj-a1-2-v1';expect((await call(other,'POST',{ratings:[{...rating(),wordId:other+'-0'}],positions:[]})).status).toBe(409);
 expect((db.prepare('SELECT count(*) n FROM learning_ratings WHERE user_id=?').get('alice') as any).n).toBe(15000);
});
