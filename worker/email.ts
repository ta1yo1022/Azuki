import { renderEmail } from '../shared/emailTemplate';
export { renderEmail, escapeHtml } from '../shared/emailTemplate';
import { limitedBody, type Env } from './index';
import type { VerifiedIdentity } from './auth';
import { ValidationError } from '../shared/model';
import { EMAIL_CONSENT_VERSION } from '../shared/email';

const json = (data: unknown, status = 200) => Response.json(data, { status });
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export function isAdmin(env: Env, identity: VerifiedIdentity) {
  return identity.emailVerified && !!identity.email && (env.ADMIN_EMAILS ?? '').split(',').some(email => email.trim().toLowerCase() === identity.email!.toLowerCase());
}
export function emailLimit(env: Env) {
  const limit = Number(env.EMAIL_DAILY_LIMIT ?? '290');
  return Number.isInteger(limit) && limit > 0 ? Math.min(300, limit) : 290;
}
export function emailReady(env: Env) {
  try {
    const url = new URL(env.EMAIL_API_URL ?? '');
    return env.EMAIL_ENABLED === 'true' && !!env.BREVO_API_KEY && emailPattern.test(env.EMAIL_FROM ?? '') && url.protocol === 'https:' && url.pathname === '/api/email/unsubscribe' && !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}
async function body(request: Request) {
  try { const data = JSON.parse(await limitedBody(request, 24000)); if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>; } catch (e) { if (e instanceof ValidationError) throw e; }
  throw new ValidationError('送信内容を確認してください。');
}
function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ValidationError(`件名は120文字、本文は5,000文字以内で入力してください。`);
  return value.trim();
}
function verifiedEmail(identity: VerifiedIdentity) {
  if (!identity.emailVerified || !identity.email || !emailPattern.test(identity.email)) return null;
  return identity.email.toLowerCase();
}
export async function preferencesRoute(request: Request, env: Env, identity: VerifiedIdentity) {
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT enabled,email FROM email_subscribers WHERE user_id=?').bind(identity.uid).first<{ enabled: number; email: string }>();
    return json({ enabled: !!row?.enabled, email: row?.email ?? verifiedEmail(identity), available: !!verifiedEmail(identity) });
  }
  if (request.method !== 'PUT') return json({ error: 'この操作は利用できません。' }, 405);
  const data = await body(request);
  if (typeof data.enabled !== 'boolean') throw new ValidationError('受信設定を指定してください。');
  if (!data.enabled) {
    await env.DB.prepare('UPDATE email_subscribers SET enabled=0,updated_at=? WHERE user_id=?').bind(new Date().toISOString(), identity.uid).run();
    return json({ enabled: false });
  }
  const email = verifiedEmail(identity);
  if (!email) return json({ error: '確認済みのGoogleメールアドレスが必要です。' }, 403);
  if (data.consentVersion !== EMAIL_CONSENT_VERSION) throw new ValidationError('受信案内を確認してから保存してください。');
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO email_subscribers(user_id,email,enabled,consent_version,consent_at,unsubscribe_token,updated_at) VALUES(?,?,1,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,enabled=1,consent_version=excluded.consent_version,
      consent_at=CASE WHEN email_subscribers.enabled=1 AND email_subscribers.email=excluded.email THEN email_subscribers.consent_at ELSE excluded.consent_at END,updated_at=excluded.updated_at`)
      .bind(identity.uid,email,EMAIL_CONSENT_VERSION,now,crypto.randomUUID()+crypto.randomUUID(),now).run();
  } catch (e) {
    if (String(e).includes('UNIQUE')) return json({error:'このメールアドレスは別のアカウントに登録されています。お問い合わせください。'},409);
    throw e;
  }
  return json({ enabled: true });
}
// GET only displays a form: mail scanners must not silently unsubscribe a reader.
export async function unsubscribeRoute(request: Request, env: Env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  if (!/^[a-f0-9-]{72}$/.test(token)) return new Response('リンクが正しくありません。', {status:400});
  const row = await env.DB.prepare('SELECT user_id FROM email_subscribers WHERE unsubscribe_token=?').bind(token).first<{user_id:string}>();
  if (!row) return new Response('リンクが見つかりません。', {status:404});
  const stopped = request.method === 'POST';
  if (!stopped && request.method !== 'GET') return new Response(null,{status:405});
  if (stopped) await env.DB.prepare('UPDATE email_subscribers SET enabled=0,updated_at=? WHERE unsubscribe_token=?').bind(new Date().toISOString(),token).run();
  return new Response(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>メール通知 — Azuki</title><body style="background:#f5ece2;color:#282521;font-family:sans-serif;padding:40px;line-height:1.8"><main style="max-width:560px;margin:10vh auto"><h1>azuki</h1><h2>${stopped?'アップデート通知を停止しました。':'アップデート通知を停止しますか？'}</h2><p>${stopped?'単語帳は引き続き使えます。再開する場合はAzukiの設定から選べます。':'このメールアドレスへのアップデート通知を停止します。'}</p>${stopped?'':`<form method="post"><button style="background:#972d31;color:white;border:0;border-radius:30px;padding:16px 28px;font:inherit">通知を停止する</button></form>`}<a href="https://azuki.mame-app.com/library/settings">Azukiの設定へ</a></main></body></html>`, {headers:{'Content-Type':'text/html; charset=utf-8','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",'X-Robots-Tag':'noindex'}});
}
export async function emailAdminRoute(request: Request, env: Env, identity: VerifiedIdentity) {
  if (!isAdmin(env,identity)) return json({error:'管理画面を利用する権限がありません。'},403);
  const path = new URL(request.url).pathname;
  if (path === '/api/admin/emails' && request.method === 'GET') {
    const campaigns = await env.DB.prepare(`SELECT c.*,
      (SELECT COUNT(*) FROM email_deliveries d WHERE d.campaign_id=c.id AND d.kind='broadcast' AND d.status='pending') pending,
      (SELECT COUNT(*) FROM email_deliveries d WHERE d.campaign_id=c.id AND d.kind='broadcast' AND d.status='accepted') accepted,
      (SELECT COUNT(*) FROM email_deliveries d WHERE d.campaign_id=c.id AND d.kind='broadcast' AND d.status='failed') failed,
      (SELECT COUNT(*) FROM email_deliveries d WHERE d.campaign_id=c.id AND d.kind='broadcast' AND d.status IN ('unknown','sending')) unknown,
      (SELECT COUNT(*) FROM email_deliveries d WHERE d.campaign_id=c.id AND d.kind='broadcast' AND d.status='skipped') skipped,
      (SELECT status FROM email_deliveries d WHERE d.campaign_id=c.id AND d.kind='test' LIMIT 1) test_status
      FROM email_campaigns c ORDER BY c.created_at DESC LIMIT 50`).all();
    const subscribers = await env.DB.prepare('SELECT COUNT(*) n FROM email_subscribers WHERE enabled=1').first<{n:number}>();
    const used = await env.DB.prepare("SELECT COUNT(*) n FROM email_deliveries WHERE attempted_at > datetime('now','-24 hours')").first<{n:number}>();
    return json({campaigns:campaigns.results,subscribers:subscribers?.n??0,ready:emailReady(env),limit:emailLimit(env),used:used?.n??0});
  }
  if (path === '/api/admin/emails' && request.method === 'POST') {
    const data = await body(request);
    if (typeof data.id !== 'string' || !/^[a-f0-9-]{36}$/.test(data.id)) throw new ValidationError('下書きIDが正しくありません。');
    const subject = text(data.subject,120), message = text(data.body,5000);
    if (/[\r\n]/.test(subject)) throw new ValidationError('件名には改行を入れられません。');
    await env.DB.prepare('INSERT OR IGNORE INTO email_campaigns(id,subject,body,created_by,created_at) VALUES(?,?,?,?,?)').bind(data.id,subject,message,identity.uid,new Date().toISOString()).run();
    return json({id:data.id},201);
  }
  const match = /^\/api\/admin\/emails\/([a-f0-9-]{36})\/(start|test|cancel)$/.exec(path);
  if (!match || request.method !== 'POST') return json({error:'この操作は利用できません。'},404);
  const [ , id, action ] = match;
  if (action === 'cancel') {
    await env.DB.batch([
      env.DB.prepare("UPDATE email_campaigns SET status='cancelled' WHERE id=? AND status IN ('draft','queued')").bind(id),
      env.DB.prepare("UPDATE email_deliveries SET status='skipped' WHERE campaign_id=? AND status='pending' AND EXISTS(SELECT 1 FROM email_campaigns WHERE id=? AND status='cancelled')").bind(id,id),
    ]);
    return json({ok:true});
  }
  if (!emailReady(env)) return json({error:'メール送信の設定が完了していません。'},503);
  if (action === 'test') {
    const email = verifiedEmail(identity);
    if (!email) return json({error:'確認済みの管理者メールアドレスが必要です。'},403);
    // One test per immutable draft; repeated clicks cannot send duplicates.
    await env.DB.prepare(`INSERT OR IGNORE INTO email_deliveries(id,campaign_id,recipient_key,email,kind) SELECT ?,id,'test',?,'test' FROM email_campaigns WHERE id=? AND status='draft'`).bind(crypto.randomUUID(),email,id).run();
    return json({ok:true});
  }
  const data = await body(request);
  if (data.confirm !== 'send-to-subscribers') throw new ValidationError('配信対象と内容を確認してください。');
  const campaign = await env.DB.prepare('SELECT status FROM email_campaigns WHERE id=?').bind(id).first<{status:string}>();
  if (!campaign) return json({error:'下書きが見つかりません。'},404);
  if (campaign.status !== 'draft') return json({ok:true});
  const test = await env.DB.prepare("SELECT id FROM email_deliveries WHERE campaign_id=? AND kind='test' AND status='accepted'").bind(id).first();
  if (!test) return json({error:'自分宛てのテスト送信が受け付けられてから、一斉配信を開始してください。'},409);
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO email_deliveries(id,campaign_id,recipient_key,user_id,email,consent_at,kind)
      SELECT lower(hex(randomblob(16))),?,s.email,s.user_id,s.email,s.consent_at,'broadcast' FROM email_subscribers s
      WHERE s.enabled=1 AND EXISTS(SELECT 1 FROM email_campaigns WHERE id=? AND status='draft')`).bind(id,id),
    env.DB.prepare("UPDATE email_campaigns SET status='queued',started_at=? WHERE id=? AND status='draft'").bind(new Date().toISOString(),id),
  ]);
  return json({ok:true});
}
// A durable attempt is written BEFORE calling the provider. Ambiguous results are never
// automatically retried; this prefers a missed message over duplicate announcements.
export async function processEmailQueue(env: Env, send: typeof fetch = fetch) {
  if (!emailReady(env)) return;
  await env.DB.prepare("UPDATE email_deliveries SET status='unknown',error_code='interrupted' WHERE status='sending' AND attempted_at < datetime('now','-10 minutes')").run();
  for (let i=0;i<10;i++) {
    const row = await env.DB.prepare(`UPDATE email_deliveries SET status='sending',attempted_at=datetime('now') WHERE id=(
      SELECT d.id FROM email_deliveries d JOIN email_campaigns c ON c.id=d.campaign_id WHERE d.status='pending'
      AND ((d.kind='test' AND c.status='draft') OR (d.kind='broadcast' AND c.status='queued'))
      ORDER BY c.created_at,d.id LIMIT 1)
      AND (SELECT COUNT(*) FROM email_deliveries WHERE attempted_at > datetime('now','-24 hours')) < ?
      RETURNING *`).bind(emailLimit(env)).first<{id:string;campaign_id:string;email:string;user_id:string|null;consent_at:string|null;kind:string}>();
    if (!row) break;
    const subscriber = row.user_id ? await env.DB.prepare('SELECT enabled,email,consent_at,unsubscribe_token FROM email_subscribers WHERE user_id=?').bind(row.user_id).first<{enabled:number;email:string;consent_at:string;unsubscribe_token:string}>() : null;
    const campaign = await env.DB.prepare('SELECT subject,body,status FROM email_campaigns WHERE id=?').bind(row.campaign_id).first<{subject:string;body:string;status:string}>();
    if (!campaign || campaign.status === 'cancelled' || (row.kind==='broadcast' && (!subscriber?.enabled || subscriber.email!==row.email || subscriber.consent_at!==row.consent_at))) {
      await env.DB.prepare("UPDATE email_deliveries SET status='skipped',attempted_at=NULL WHERE id=?").bind(row.id).run();continue;
    }
    const test = row.kind === 'test';
    const unsubscribeUrl = test ? 'https://azuki.mame-app.com/library/settings' : `${env.EMAIL_API_URL}?token=${subscriber!.unsubscribe_token}`;
    try {
      const response = await send('https://api.brevo.com/v3/smtp/email', {method:'POST',headers:{'api-key':env.BREVO_API_KEY!,'Content-Type':'application/json','accept':'application/json'},body:JSON.stringify({
        sender:{name:'Azuki / Volta Technologies',email:env.EMAIL_FROM},replyTo:{email:'support@volta.jp'},to:[{email:row.email}],
        subject:(test?'[テスト] ':'')+campaign.subject,...renderEmail(campaign.subject,campaign.body,unsubscribeUrl,test),
        headers: test ? {} : {'List-Unsubscribe':`<${unsubscribeUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'},
      }),signal:AbortSignal.timeout(15000)});
      const data = await response.json().catch(()=>({})) as {messageId?:string};
      const accepted = response.ok && typeof data.messageId === 'string';
      const status = accepted ? 'accepted' : response.status >= 400 && response.status < 500 ? 'failed' : 'unknown';
      await env.DB.prepare('UPDATE email_deliveries SET status=?,provider_id=?,error_code=? WHERE id=?').bind(status,accepted?data.messageId!:null,accepted?null:`provider_${response.status}`,row.id).run();
      // Stop this tick on quota, credential or ambiguous provider failures.
      if (!accepted) break;
    } catch {
      await env.DB.prepare("UPDATE email_deliveries SET status='unknown',error_code='network_or_timeout' WHERE id=?").bind(row.id).run();break;
    }
  }
  await env.DB.prepare("UPDATE email_campaigns SET status='completed' WHERE status='queued' AND NOT EXISTS(SELECT 1 FROM email_deliveries d WHERE d.campaign_id=email_campaigns.id AND d.kind='broadcast' AND d.status IN ('pending','sending'))").run();
}
