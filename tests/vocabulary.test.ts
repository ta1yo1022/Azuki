import {encodeToon} from '../shared/toon';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync,readFileSync } from 'node:fs';
import { sqliteD1 } from './helpers/sqliteD1';
import { createHandler,type Env } from '../worker';
import { vocabularyWeek,parseVocabulary } from '../shared/vocabulary';
let db:DatabaseSync,env:Env;
const handle=createHandler(async token=>{if(!['alice','bob'].includes(token))throw new Error();return token;});
const inputs=[{term:'book'},{term:'agree'}];
const good={response:encodeToon({items:[{index:0,meaning:'本',text:'I read a book every morning.',translation:'私は毎朝、本を読みます。'},{index:1,meaning:'同意する',text:'I agree with your idea.',translation:'私はあなたの考えに同意します。'}]})};
function call(path:string,method='GET',data?:unknown,user='alice'){
 return handle(new Request('https://api.test/api/vocabulary/'+path,{method,headers:{'Content-Type':'application/json',Origin:'https://azuki.test',...(user?{Authorization:'Bearer '+user}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);
}
function pro(user='alice'){db.prepare('INSERT INTO pro_offer_redemptions VALUES(?,0,?,?,?)').run(user,'AZUKI1MONTH',Math.floor(Date.now()/1000),Math.floor(Date.now()/1000)+86400);}
function request(words=inputs){return {requestId:crypto.randomUUID(),words};}
function usage(){return db.prepare('SELECT used,reserved FROM vocabulary_usage WHERE user_id=? AND week_start=?').get('alice',vocabularyWeek().start);}
beforeEach(()=>{
 db=new DatabaseSync(':memory:');for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 env={DB:sqliteD1(db),FIREBASE_PROJECT_ID:'test',ALLOWED_ORIGINS:'https://azuki.test',ALLOW_IMPORTS:'true',BILLING_ENABLED:'true',VOCABULARY_ENABLED:'true',DICTIONARY:{fetch:vi.fn(async(req:Request)=>{const file=new URL(req.url).pathname.slice(1);return new Response(readFileSync(new URL('../content/dictionary/assets/'+file,import.meta.url),'utf8'));})} as unknown as Fetcher,AI:{run:vi.fn(async()=>good)} as unknown as Ai};
});
afterEach(()=>{vi.useRealTimers();db.close();});
it('normalizes pasted terms and treats Monday midnight in Japan as the boundary',()=>{
 expect(parseVocabulary('words[4]: BOOK,agree,book,look up')).toEqual(['book','agree','look up']);
 expect(vocabularyWeek(Date.parse('2026-10-25T14:59:59Z')).start).toBe('2026-10-18T15:00:00.000Z');
 expect(vocabularyWeek(Date.parse('2026-10-25T15:00:00Z')).start).toBe('2026-10-25T15:00:00.000Z');
});
it('requires authentication and reserves AI creation for Pro accounts',async()=>{
 expect((await call('examples','POST',request(),'')).status).toBe(401);
 const response=await call('quota');expect(response.status).toBe(200);expect((await response.json() as any).pro).toBe(false);
 expect((await call('examples','POST',request())).status).toBe(402);expect(env.AI!.run).not.toHaveBeenCalled();
});
it('ignores forged client meanings and accepts model-created editable meanings',async()=>{
 pro();const data=request();(data.words[0] as any).meaning='FORGED MEANING';
 const response=await call('examples','POST',data);expect(response.status).toBe(200);const value=await response.json() as any;
 expect(value.examples[0].meaning).toBe('本');expect(value.quota).toMatchObject({used:2,reserved:0,remaining:498});
 expect(usage()).toMatchObject({used:2,reserved:0});expect(JSON.stringify(vi.mocked(env.AI!.run).mock.calls)).not.toContain('FORGED');
});
it('replays a completed request without a second model call or quota charge and isolates users',async()=>{
 pro();pro('bob');const data=request();await call('examples','POST',data);
 expect((await call('examples','POST',data)).status).toBe(200);expect(env.AI!.run).toHaveBeenCalledTimes(1);expect(usage()).toMatchObject({used:2});
 expect((await call('examples','POST',{...data,words:[inputs[1]]})).status).toBe(409);
 expect((await call('examples','POST',data,'bob')).status).toBe(200);expect(env.AI!.run).toHaveBeenCalledTimes(2);
});
it('enforces the 500-word limit in the database, including concurrent reservations',async()=>{
 pro();vi.mocked(env.AI!.run).mockResolvedValue({response:encodeToon({items:[{index:0,meaning:'本',text:'I read a book every day.',translation:'私は毎日本を読みます。'}]})} as any);db.prepare('INSERT INTO vocabulary_usage VALUES(?,?,499,0)').run('alice',vocabularyWeek().start);
 const responses=await Promise.all([call('examples','POST',request([inputs[0]])),call('examples','POST',request([inputs[0]]))]);
 expect(responses.map(response=>response.status).sort()).toEqual([200,429]);expect(usage()).toMatchObject({used:500,reserved:0});expect(env.AI!.run).toHaveBeenCalledTimes(1);
 const full=await call('examples','POST',request([inputs[0]]));expect((await full.json() as any).code).toBe('VOCABULARY_QUOTA_REACHED');
});
it('does not re-run an in-flight request while another tab is generating',async()=>{
 pro();let release!:(value:unknown)=>void;vi.mocked(env.AI!.run).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}) as any);
 const data=request(),first=call('examples','POST',data);await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
 expect((await call('examples','POST',data)).status).toBe(409);expect(usage()).toMatchObject({used:0,reserved:2});
 release(good);expect((await first).status).toBe(200);expect(env.AI!.run).toHaveBeenCalledTimes(1);
});
it('refunds failed generations and missing target words, but preserves the global attempt budget',async()=>{
 pro();vi.mocked(env.AI!.run).mockRejectedValueOnce(new Error('provider failed'));
 expect((await call('examples','POST',request())).status).toBe(503);expect(usage()).toMatchObject({used:0,reserved:0});
 vi.mocked(env.AI!.run).mockResolvedValueOnce({response:encodeToon({items:[{index:0,meaning:'本',text:'This sentence contains no target.',translation:'この文には対象語がありません。'},{index:1,meaning:'同意する',text:'I agree with your idea.',translation:'私はあなたの考えに同意します。'}]})} as any);
 const partial=await call('examples','POST',request());expect(partial.status).toBe(200);expect((await partial.json() as any).failed).toEqual(['book']);expect(usage()).toMatchObject({used:1,reserved:0});
 expect(db.prepare("SELECT amount FROM vocabulary_rate_limits WHERE scope='global'").get()).toMatchObject({amount:4});
});
it('rejects duplicate indexes, invalid terms and oversized batches without charging',async()=>{
 pro();expect((await call('examples','POST',request([{term:'invalid😀'}]))).status).toBe(400);
 expect((await call('examples','POST',request(Array(21).fill(inputs[0])))).status).toBe(400);expect(env.AI!.run).not.toHaveBeenCalled();
 vi.mocked(env.AI!.run).mockResolvedValueOnce({response:encodeToon({items:[{index:0,meaning:'本',text:'book',translation:'本'},{index:0,meaning:'本',text:'book',translation:'本'}]})} as any);
 expect((await call('examples','POST',request())).status).toBe(503);expect(usage()).toMatchObject({used:0,reserved:0});
});
it('releases expired reservations and resets accounts independently at the week boundary',async()=>{
 pro();const week=vocabularyWeek();db.prepare('INSERT INTO vocabulary_requests(user_id,id,week_start,input_hash,amount,expires_at,created_at) VALUES(?,?,?,?,?,?,?)').run('alice',crypto.randomUUID(),week.start,'hash',20,Date.now()-1,Date.now()-200000);
 expect(usage()).toMatchObject({reserved:20});const quota=await (await call('quota')).json() as any;expect(quota.remaining).toBe(500);expect(usage()).toMatchObject({reserved:0});
 db.prepare('INSERT INTO vocabulary_usage VALUES(?,?,500,0)').run('alice',vocabularyWeek(Date.now()-7*86400000).start);
 expect((await (await call('quota')).json() as any).remaining).toBe(500);
});
it('does not bypass Pro checks when billing is disabled, an offer expires, or the model is unavailable',async()=>{
 pro();env.BILLING_ENABLED='false';expect((await call('examples','POST',request())).status).toBe(402);
 env.BILLING_ENABLED='true';db.prepare('UPDATE pro_offer_redemptions SET expires_at=0').run();expect((await call('examples','POST',request())).status).toBe(402);
 expect(env.AI!.run).not.toHaveBeenCalled();
});

it('refunds account reservations when the global safety budget is reached without calling the model',async()=>{
 pro();env.VOCABULARY_DAILY_LIMIT='1';const result=await call('examples','POST',request());expect(result.status).toBe(429);expect((await result.json() as any).code).toBe('VOCABULARY_BUSY');expect(usage()).toMatchObject({used:0,reserved:0});expect(env.AI!.run).not.toHaveBeenCalled();
});

it('accepts word-only JSON arrays and objects, rejecting malformed or non-word input',()=>{
 expect(parseVocabulary('words[2]: agree,curious')).toEqual(['agree','curious']);
 expect(parseVocabulary('words[2]{word}:\n  BOOK\n  look up')).toEqual(['book','look up']);
 expect(()=>parseVocabulary('book,agree')).toThrow('TOON');expect(()=>parseVocabulary('words[1]: 5')).toThrow('文字列');expect(()=>parseVocabulary('words[0]:')).toThrow('1〜500');
});
it('uses an automatically generated meaning matching the example',async()=>{
 pro();vi.mocked(env.AI!.run).mockResolvedValueOnce({response:encodeToon({items:[{index:0,meaning:'予約する',text:'Please book a table for two tonight.',translation:'今夜、二人分の席を予約してください。'}]})} as any);
 const response=await call('examples','POST',request([inputs[0]]));expect(response.status).toBe(200);expect((await response.json() as any).examples[0].meaning).toContain('予約する');expect(usage()).toMatchObject({used:1,reserved:0});
});
it('generates a Japanese meaning for a term outside the dictionary',async()=>{
 pro();vi.mocked(env.AI!.run).mockResolvedValueOnce({response:encodeToon({items:[{index:0,meaningIndex:null,meaning:'悪いニュースを延々と読み続ける',text:'I sometimes doomscroll before going to sleep.',translation:'私は時々、寝る前に悪いニュースを延々と読んでしまいます。'}]})} as any);
 const response=await call('examples','POST',request([{term:'doomscroll'}]));expect(response.status).toBe(200);expect((await response.json() as any).examples[0].meaning).toBe('悪いニュースを延々と読み続ける');expect(usage()).toMatchObject({used:1,reserved:0});
});
it('refunds an invalid generated meaning',async()=>{
 pro();vi.mocked(env.AI!.run).mockResolvedValueOnce({response:encodeToon({items:[{index:0,meaning:'English-only meaning',text:'I read a book every day.',translation:'私は毎日本を読みます。'}]})} as any);
 expect((await call('examples','POST',request([inputs[0]]))).status).toBe(503);expect(usage()).toMatchObject({used:0,reserved:0});
});
