import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHandler,type Env} from '../worker';
import {processEmailQueue,renderEmail} from '../worker/email';
import {EMAIL_CONSENT_VERSION} from '../shared/email';
function sqliteD1(db: DatabaseSync): D1Database {
  function prepare(sql: string) {
    const entry = {
      sql,
      values: [] as (string | number | null)[],
      bind(...values: (string | number | null)[]) {
        if (values.length > 100) throw new Error("D1 parameter limit");
        entry.values = values;
        return entry;
      },
      async first() {
        return db.prepare(sql).get(...entry.values) ?? null;
      },
      async all() {
        return { success: true, results: db.prepare(sql).all(...entry.values) };
      },
      execute() {
        return { success: true, meta: db.prepare(sql).run(...entry.values) };
      },
      async run() { return entry.execute(); },
    };
    return entry;
  }
  return {
    prepare,
    async batch(entries: ReturnType<typeof prepare>[]) {
      if (entries.length > 50) throw new Error("D1 query limit");
      db.exec("BEGIN");
      try {
        const results = [];
        // D1 serializes transactions; do not yield mid-transaction on this connection.
        for (const entry of entries) results.push(entry.execute());
        db.exec("COMMIT");
        return results;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
}

let db:DatabaseSync,env:Env;
const admin={uid:'admin',email:'admin@example.com',emailVerified:true};
const user={uid:'user',email:'user@example.com',emailVerified:true};
const handle=createHandler(async token=>token==='admin'?admin:token==='unverified'?{...user,emailVerified:false}:user);
function call(path:string,method='GET',data?:unknown,token='admin') {return handle(new Request('https://api.example.com/api'+path,{method,headers:{authorization:'Bearer '+token,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);}
async function subscribe(){return call('/email/preferences','PUT',{enabled:true,consentVersion:EMAIL_CONSENT_VERSION},'user');}
async function draft(){const id=crypto.randomUUID();expect((await call('/admin/emails','POST',{id,subject:'アップデート',body:'新しい機能です。'})).status).toBe(201);return id;}
const accepted=(_input: RequestInfo | URL, _init?: RequestInit)=>Promise.resolve(Response.json({messageId:'provider-id'},{status:201}));
async function queue(id:string){await call('/admin/emails/'+id+'/test','POST',{});await processEmailQueue(env,vi.fn(accepted));return call('/admin/emails/'+id+'/start','POST',{confirm:'send-to-subscribers'});}
beforeEach(()=>{db=new DatabaseSync(':memory:');for(const name of readdirSync(new URL('../migrations',import.meta.url)).sort()){db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));}env={DB:sqliteD1(db),FIREBASE_PROJECT_ID:'test',ALLOWED_ORIGINS:'https://azuki.example.com',ALLOW_IMPORTS:'true',ADMIN_EMAILS:admin.email,BREVO_API_KEY:'test-key',EMAIL_ENABLED:'true',EMAIL_FROM:'sender@example.com',EMAIL_API_URL:'https://api.example.com/api/email/unsubscribe',EMAIL_DAILY_LIMIT:'290'};});
afterEach(()=>{db.close();vi.restoreAllMocks();});
describe('update emails',()=>{
 it('defaults off; verified opt-in stores only the identity address and remains idempotent',async()=>{
   expect(await (await call('/email/preferences','GET',undefined,'user')).json()).toMatchObject({enabled:false});
   expect((await call('/email/preferences','PUT',{enabled:true,consentVersion:EMAIL_CONSENT_VERSION},'unverified')).status).toBe(403);
   expect((await call('/email/preferences','PUT',{enabled:true,email:'attacker@example.com',consentVersion:EMAIL_CONSENT_VERSION},'user')).status).toBe(200);
   const initial=db.prepare('SELECT * FROM email_subscribers').get();await subscribe();expect(db.prepare('SELECT * FROM email_subscribers').get()).toMatchObject({email:user.email,consent_at:initial!.consent_at});
 });
 it('denies non-admins and unverified admins for all management endpoints',async()=>{
   expect((await call('/admin/emails','GET',undefined,'user')).status).toBe(403);
   env.ADMIN_EMAILS=user.email;expect((await call('/admin/emails','GET',undefined,'unverified')).status).toBe(403);
 });
 it('requires configuration, test acceptance and explicit confirmation before starting',async()=>{
   const id=await draft();expect((await call('/admin/emails/'+id+'/start','POST',{})).status).toBe(400);
   expect((await call('/admin/emails/'+id+'/start','POST',{confirm:'send-to-subscribers'})).status).toBe(409);
   env.EMAIL_ENABLED='false';expect((await call('/admin/emails/'+id+'/test','POST',{})).status).toBe(503);
   const send=vi.fn(accepted);await processEmailQueue(env,send);expect(send).not.toHaveBeenCalled();
 });
 it('snapshots the audience once, sends individually, and never repeats a completed queue',async()=>{
   await subscribe();const id=await draft();await queue(id);await call('/admin/emails/'+id+'/start','POST',{confirm:'send-to-subscribers'});
   const send=vi.fn(accepted);await Promise.all([processEmailQueue(env,send),processEmailQueue(env,send)]);await processEmailQueue(env,send);
   expect(send).toHaveBeenCalledTimes(1);const payload=JSON.parse(send.mock.calls[0]![1]!.body as string);expect(payload.to).toEqual([{email:user.email}]);expect(payload.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');expect(payload.htmlContent).toContain('token=');
   expect(db.prepare('SELECT status FROM email_campaigns WHERE id=?').get(id)?.status).toBe('completed');
 });
 it('deduplicates test submissions and addresses them only to the verified admin',async()=>{
   const id=await draft();await call('/admin/emails/'+id+'/test','POST',{email:'other@example.com'});await call('/admin/emails/'+id+'/test','POST',{});
   const send=vi.fn(accepted);await processEmailQueue(env,send);expect(send).toHaveBeenCalledTimes(1);expect(JSON.parse(send.mock.calls[0]![1]!.body as string).to).toEqual([{email:admin.email}]);
 });
 it('skips recipients who unsubscribe after being queued',async()=>{
   await subscribe();const id=await draft();await queue(id);await call('/email/preferences','PUT',{enabled:false},'user');const send=vi.fn(accepted);await processEmailQueue(env,send);expect(send).not.toHaveBeenCalled();expect(db.prepare("SELECT status FROM email_deliveries WHERE kind='broadcast'").get()?.status).toBe('skipped');
 });
 it('GET unsubscribe does not mutate; POST works without login and repeats safely',async()=>{
   await subscribe();const token=db.prepare('SELECT unsubscribe_token FROM email_subscribers').get()!.unsubscribe_token;
   const url='https://api.example.com/api/email/unsubscribe?token='+token;
   expect((await handle(new Request(url),env)).status).toBe(200);expect(db.prepare('SELECT enabled FROM email_subscribers').get()?.enabled).toBe(1);
   for(let i=0;i<2;i++)expect((await handle(new Request(url,{method:'POST',headers:{Origin:'https://mail.example.com'}}),env)).status).toBe(200);
   expect(db.prepare('SELECT enabled FROM email_subscribers').get()?.enabled).toBe(0);
 });
 it('honors the rolling limit including tests and resumes after 24 hours',async()=>{
   env.EMAIL_DAILY_LIMIT='1';await subscribe();const id=await draft();await queue(id);const send=vi.fn(accepted);await processEmailQueue(env,send);expect(send).not.toHaveBeenCalled();
   db.exec("UPDATE email_deliveries SET attempted_at=datetime('now','-25 hours') WHERE kind='test'");await processEmailQueue(env,send);expect(send).toHaveBeenCalledTimes(1);
 });
 it('marks network ambiguity unknown and does not retry',async()=>{
   await subscribe();const id=await draft();await queue(id);const send=vi.fn(async()=>{throw new Error('timeout');});await processEmailQueue(env,send);await processEmailQueue(env,send);expect(send).toHaveBeenCalledTimes(1);expect(db.prepare("SELECT status FROM email_deliveries WHERE kind='broadcast'").get()?.status).toBe('unknown');
 });
 it('marks interrupted attempts unknown without resending',async()=>{
   const id=await draft();await call('/admin/emails/'+id+'/test','POST',{});db.exec("UPDATE email_deliveries SET status='sending',attempted_at=datetime('now','-11 minutes')");const send=vi.fn(accepted);await processEmailQueue(env,send);expect(send).not.toHaveBeenCalled();expect(db.prepare('SELECT status FROM email_deliveries').get()?.status).toBe('unknown');
 });
 it('cancels pending broadcasts without sending',async()=>{
   await subscribe();const id=await draft();await queue(id);await call('/admin/emails/'+id+'/cancel','POST',{});const send=vi.fn(accepted);await processEmailQueue(env,send);expect(send).not.toHaveBeenCalled();
 });
 it('rejects header injection and escapes content in email HTML',async()=>{
   expect((await call('/admin/emails','POST',{id:crypto.randomUUID(),subject:'x\r\nBcc: bad',body:'x'})).status).toBe(400);
   const rendered=renderEmail('<script>','<img src=x onerror=x>','https://example.com',false);expect(rendered.htmlContent).not.toContain('<script>');expect(rendered.htmlContent).toContain('&lt;img');
 });
});

it('renders the branded template with safe paragraphs, links and an absolute PNG logo',()=>{
 const {htmlContent,textContent}=renderEmail('新しいお知らせ','こんにちは。\n改行です。\n\nhttps://azuki.mame-app.com/\n<script>alert(1)</script>','https://api.example.com/api/email/unsubscribe?token=abc',false);
 expect(htmlContent).toContain('https://azuki.mame-app.com/email-logo.png');
 expect(htmlContent).toContain('こんにちは。<br>改行です。');
 expect(htmlContent).toContain('href="https://azuki.mame-app.com/"');
 expect(htmlContent).not.toContain('<script>');
 expect(htmlContent).toContain('Volta Technologies');
 expect(htmlContent).toContain('https://api.example.com/api/email/unsubscribe?token=abc');
 expect(textContent).toContain('新しいお知らせ');
 expect(textContent).toContain('https://azuki.mame-app.com/');
});
