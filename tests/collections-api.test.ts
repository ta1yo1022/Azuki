import {beforeEach,afterEach,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {sqliteD1} from './helpers/sqliteD1';
import {createHandler,type Env} from '../worker';
let db:DatabaseSync,env:Env;
const handle=createHandler(async token=>token);
async function call(path='',method='GET',data?:unknown,user='alice'){
 return handle(new Request('https://api.test/api/collections'+path,{method,headers:{Origin:'https://azuki.test',Authorization:`Bearer ${user}`,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);
}
beforeEach(()=>{db=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+file,'utf8'));env={DB:sqliteD1(db),FIREBASE_PROJECT_ID:'test',ALLOWED_ORIGINS:'https://azuki.test',ALLOW_IMPORTS:'true'};db.exec("INSERT INTO users(id) VALUES ('alice'),('bob'); INSERT INTO favorites VALUES ('alice','standard-a1','now'),('alice','standard-a2','now');");});
afterEach(()=>db.close());
it('keeps overlapping collections private, renames them and deletes only the grouping',async()=>{
 const first=await(await call('','POST',{name:'学校',deckIds:['standard-a1']})).json() as any;
 const second=await(await call('','POST',{name:'試験',deckIds:['standard-a1','standard-a2']})).json() as any;
 expect((await(await call()).json() as any).collections).toHaveLength(2);
 expect((await(await call('','GET',undefined,'bob')).json() as any).collections).toEqual([]);
 expect((await call('/'+first.id,'PUT',{name:'他人',deckIds:[]},'bob')).status).toBe(404);
 await call('/'+first.id,'DELETE',undefined,'bob');expect((await(await call()).json() as any).collections).toHaveLength(2);
 const edited=await call('/'+first.id,'PUT',{name:'学校の英語',deckIds:['standard-a1','standard-a2']});expect(edited.status).toBe(200);
 await call('/'+first.id,'DELETE');expect(db.prepare('SELECT * FROM favorites').all()).toHaveLength(2);
 expect((await(await call()).json() as any).collections[0].id).toBe(second.id);
});
it('rejects unknown books and invalid input without replacing saved membership',async()=>{
 const first=await(await call('','POST',{name:'学校',deckIds:['standard-a1']})).json() as any;
 expect((await call('/'+first.id,'PUT',{name:'変更',deckIds:['private-bob']})).status).toBe(400);
 expect((await call('','POST',{name:' ',deckIds:[]})).status).toBe(400);
 expect((await call('','POST',{name:'a',deckIds:Array(201).fill('standard-a1')})).status).toBe(400);
 expect((await(await call()).json() as any).collections[0]).toEqual(first);
 db.exec("DELETE FROM favorites WHERE user_id='alice' AND deck_id='standard-a1'");
 expect(db.prepare('SELECT * FROM collection_decks').all()).toHaveLength(0);
});
it('enforces database quotas atomically and supports more than 50 members per batch',async()=>{
 for(let i=0;i<200;i++)db.prepare('INSERT INTO favorites VALUES (?,?,?)').run('alice','book-'+i,'now');
 const ids=Array.from({length:200},(_,i)=>'book-'+i);
 for(let i=0;i<5;i++)expect((await call('','POST',{name:'Group'+i,deckIds:ids})).status).toBe(200);
 expect((await call('','POST',{name:'Overflow',deckIds:['standard-a1']})).status).toBe(429);
 expect((await(await call()).json() as any).collections).toHaveLength(5);
 for(let i=5;i<50;i++)expect((await call('','POST',{name:'Group'+i,deckIds:[]})).status).toBe(200);
 expect((await call('','POST',{name:'Overflow',deckIds:[]})).status).toBe(429);
});
it('organizes private owned books and removes membership when the original book is deleted',async()=>{
 const created=await handle(new Request('https://api.test/api/decks',{method:'POST',headers:{Origin:'https://azuki.test',Authorization:'Bearer alice','Content-Type':'application/json'},body:JSON.stringify({title:'私の単語帳',words:[{word:'book',meaning:'本'}]})}),env);
 expect(created.status).toBe(201);const {deck}=await created.json() as any;
 expect((await call('','POST',{name:'自分用',deckIds:[deck.id]})).status).toBe(200);
 expect((await call('','POST',{name:'他人の本',deckIds:[deck.id]},'bob')).status).toBe(400);
 const removed=await handle(new Request('https://api.test/api/decks/'+deck.id,{method:'DELETE',headers:{Origin:'https://azuki.test',Authorization:'Bearer alice'}}),env);
 expect(removed.status).toBe(200);expect(db.prepare('SELECT * FROM collection_decks').all()).toHaveLength(0);
 expect((await(await call()).json() as any).collections).toHaveLength(1);
});
