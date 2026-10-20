import Stripe from 'stripe';
import { limitedBody, type Env } from './index';
import type { VerifiedIdentity } from './auth';
const noStore={'Cache-Control':'private, no-store'};
const result=(body:unknown,status=200)=>Response.json(body,{status,headers:noStore});
export function billingEnabled(env:Env){return env.BILLING_ENABLED==='true';}
export function billingLive(env:Env){return env.STRIPE_SECRET_KEY?.startsWith('sk_live_')?1:0;}
export function stripeClient(env:Env){
 if(!env.STRIPE_SECRET_KEY)throw new Error('Billing not configured');
 return new Stripe(env.STRIPE_SECRET_KEY,{httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:1,timeout:15000});
}
export async function hasPro(env:Env,uid?:string){
 if(!uid||!billingEnabled(env))return false;
 const row=await env.DB.prepare(`SELECT subscription_id FROM billing_subscriptions WHERE user_id=? AND livemode=? AND price_id=? AND status='active' AND period_end>? LIMIT 1`).bind(uid,billingLive(env),env.STRIPE_PRICE_ID??'',Math.floor(Date.now()/1000)).first();
 return Boolean(row);
}
export async function subscriptionInfo(env:Env,uid?:string){
 const row=uid?await env.DB.prepare(`SELECT status,period_end,cancel_at_period_end FROM billing_subscriptions WHERE user_id=? AND livemode=? AND price_id=? ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END,period_end DESC LIMIT 1`).bind(uid,billingLive(env),env.STRIPE_PRICE_ID??'').first<{status:string;period_end:number;cancel_at_period_end:number}>():null;
 return {enabled:billingEnabled(env),pro:await hasPro(env,uid),testMode:billingEnabled(env)&&billingLive(env)===0,monthlyPrice:480,currency:'jpy',status:row?.status??null,periodEnd:row?.period_end??null,cancelAtPeriodEnd:Boolean(row?.cancel_at_period_end),checkoutAvailable:billingEnabled(env)&&Boolean(env.STRIPE_SECRET_KEY&&env.STRIPE_PRICE_ID&&env.STRIPE_WEBHOOK_SECRET)};
}
function customerId(value:string|{id:string}|null){return typeof value==='string'?value:value?.id;}
// All lifecycle events reconcile from Stripe's latest state, serialized per customer.
export async function syncCustomer(env:Env,customer:string){
 const owner=await env.DB.prepare('SELECT user_id,livemode FROM billing_customers WHERE customer_id=?').bind(customer).first<{user_id:string;livemode:number}>();
 if(!owner||owner.livemode!==billingLive(env))return;
 const now=Date.now(),lease=now+60000;
 const locked=await env.DB.prepare(`INSERT INTO billing_sync_locks(customer_id,expires_at) VALUES(?,?) ON CONFLICT(customer_id) DO UPDATE SET expires_at=excluded.expires_at WHERE expires_at<? RETURNING customer_id`).bind(customer,lease,now).first();
 if(!locked)throw new Error('Billing sync busy');
 try{
  const client=stripeClient(env);
  const subscriptions=await client.subscriptions.list({customer,status:'all',limit:100});
  // Never revoke entitlements using a truncated response.
  if(subscriptions.has_more)throw new Error('Too many subscriptions');
  const statements=[env.DB.prepare('DELETE FROM billing_subscriptions WHERE customer_id=? AND livemode=?').bind(customer,owner.livemode)];
  for(const subscription of subscriptions.data){
   if(Number(subscription.livemode)!==owner.livemode)continue;
   const item=subscription.items.data.find(item=>item.price.id===env.STRIPE_PRICE_ID);
   if(!item)continue;
   statements.push(env.DB.prepare(`INSERT INTO billing_subscriptions(subscription_id,customer_id,user_id,livemode,price_id,status,period_end,cancel_at_period_end,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(subscription.id,customer,owner.user_id,owner.livemode,item.price.id,subscription.status,item.current_period_end,subscription.cancel_at_period_end?1:0,new Date().toISOString()));
  }
  await env.DB.batch(statements);
 }finally{await env.DB.prepare('DELETE FROM billing_sync_locks WHERE customer_id=? AND expires_at=?').bind(customer,lease).run();}
}
export async function billingWebhook(request:Request,env:Env){
 if(request.method!=='POST')return result({error:'この操作は利用できません。'},405);
 if(!env.STRIPE_SECRET_KEY||!env.STRIPE_WEBHOOK_SECRET)return result({error:'決済通知の準備中です。'},503);
 const reader=request.body?.getReader();let body='';let bytes=0;
 if(!reader)return result({error:'通知の形式が正しくありません。'},400);
 const decoder=new TextDecoder();while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;if(bytes>256*1024){await reader.cancel();return result({error:'通知が大きすぎます。'},413);}body+=decoder.decode(chunk.value,{stream:true});}body+=decoder.decode();
 let event:Stripe.Event;
 try{event=await stripeClient(env).webhooks.constructEventAsync(body,request.headers.get('stripe-signature')??'',env.STRIPE_WEBHOOK_SECRET,300,Stripe.createSubtleCryptoProvider());}catch{return result({error:'通知を検証できませんでした。'},400);}
 if(Number(event.livemode)!==billingLive(env))return result({error:'決済環境が一致しません。'},400);
 const handled=['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','invoice.payment_action_required'];
 if(!handled.includes(event.type))return result({received:true});
 const object=event.data.object as unknown as {customer:string|{id:string}|null};
 const customer=customerId(object.customer);
 if(customer){try{await syncCustomer(env,customer);}catch{console.error('Azuki billing sync failed');return result({error:'通知の反映を再試行してください。'},503);}}
 return result({received:true});
}
async function getCustomer(env:Env,identity:VerifiedIdentity){
 const mode=billingLive(env);
 const existing=await env.DB.prepare('SELECT customer_id FROM billing_customers WHERE user_id=? AND livemode=?').bind(identity.uid,mode).first<{customer_id:string}>();
 if(existing)return existing.customer_id;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity.uid));
 const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 const customer=await stripeClient(env).customers.create({...(identity.emailVerified&&identity.email?{email:identity.email}:{}),metadata:{azuki_uid:identity.uid}},{idempotencyKey:`azuki-customer-${mode}-${hash}`});
 await env.DB.prepare('INSERT OR IGNORE INTO billing_customers(user_id,livemode,customer_id,created_at) VALUES(?,?,?,?)').bind(identity.uid,mode,customer.id,new Date().toISOString()).run();
 return customer.id;
}
function appOrigin(request:Request,env:Env){
 const origin=request.headers.get('origin');
 if(origin&&(env.ALLOWED_ORIGINS??'').split(',').includes(origin))return origin;
 return 'https://azuki.mame-app.com';
}
export async function billingRoute(request:Request,env:Env,identity:VerifiedIdentity){
 const path=new URL(request.url).pathname,uid=identity.uid;
 if(path==='/api/billing/status'&&request.method==='GET')return result(await subscriptionInfo(env,uid));
 if(path==='/api/billing/book'&&request.method==='GET')return !billingEnabled(env)||await hasPro(env,uid)?result({allowed:true}):result({error:'単語帳で学習はAzuki Proで利用できます。',code:'PRO_REQUIRED'},402);
 if(!billingEnabled(env)||!env.STRIPE_SECRET_KEY||!env.STRIPE_PRICE_ID||!env.STRIPE_WEBHOOK_SECRET)return result({error:'有料プランは準備中です。'},503);
 if(request.method==='POST'){
  const minute=new Date().toISOString().slice(0,16);
  const allowed=await env.DB.prepare(`INSERT INTO billing_rate_limits(user_id,minute,amount) VALUES(?,?,1) ON CONFLICT(user_id,minute) DO UPDATE SET amount=amount+1 WHERE amount<12 RETURNING amount`).bind(uid,minute).first();
  if(!allowed)return result({error:'契約の確認が続いています。1分ほど待って再試行してください。'},429);
 }
 if(path==='/api/billing/refresh'&&request.method==='POST'){
  const row=await env.DB.prepare('SELECT customer_id FROM billing_customers WHERE user_id=? AND livemode=?').bind(uid,billingLive(env)).first<{customer_id:string}>();
  if(row)await syncCustomer(env,row.customer_id);
  return result(await subscriptionInfo(env,uid));
 }
 if(path==='/api/billing/portal'&&request.method==='POST'){
  const row=await env.DB.prepare('SELECT customer_id FROM billing_customers WHERE user_id=? AND livemode=?').bind(uid,billingLive(env)).first<{customer_id:string}>();
  if(!row)return result({error:'管理できる契約がありません。'},404);
  const portal=await stripeClient(env).billingPortal.sessions.create({...(env.STRIPE_PORTAL_CONFIG_ID?{configuration:env.STRIPE_PORTAL_CONFIG_ID}:{}),customer:row.customer_id,return_url:appOrigin(request,env)+'/plans'});
  return result({url:portal.url});
 }
 if(path==='/api/billing/checkout'&&request.method==='POST'){
  let consent:unknown;try{consent=JSON.parse(await limitedBody(request,1024));}catch{return result({error:'利用規約と自動更新への同意を確認してください。'},400);}
  if(!consent||typeof consent!=='object'||!('acceptTerms' in consent)||consent.acceptTerms!==true)return result({error:'利用規約と自動更新への同意が必要です。'},400);
  const client=stripeClient(env),customer=await getCustomer(env,identity);
  await syncCustomer(env,customer);
  if(await hasPro(env,uid))return result({error:'すでにProをご利用中です。契約管理から確認してください。'},409);
  const subs=await client.subscriptions.list({customer,status:'all',limit:100});
  if(subs.has_more||subs.data.some(subscription=>!['canceled','incomplete_expired'].includes(subscription.status)))return result({error:'既存の契約があります。契約管理からお支払い状況を確認してください。'},409);
  const price=await client.prices.retrieve(env.STRIPE_PRICE_ID);
  if(!price.active||price.currency!=='jpy'||price.unit_amount!==480||price.recurring?.interval!=='month'||price.recurring.interval_count!==1||price.tax_behavior!=='inclusive')return result({error:'プランの料金設定を確認しています。'},503);
  const now=Date.now(),mode=billingLive(env),attempt=crypto.randomUUID();
  const existing=await env.DB.prepare('SELECT session_id,checkout_url,expires_at FROM billing_checkouts WHERE user_id=? AND livemode=?').bind(uid,mode).first<{session_id:string;checkout_url:string;expires_at:number}>();
  if(existing&&existing.expires_at>now){
   if(!existing.session_id)return result({error:'決済画面を準備しています。少し待ってから再試行してください。'},409);
   const session=await client.checkout.sessions.retrieve(existing.session_id);
   if(session.status==='open'&&session.url)return result({url:session.url});
   if(session.status==='complete')return result({error:'お支払いを確認しています。契約状況を更新してください。'},409);
  }
  const reserved=await env.DB.prepare(`INSERT INTO billing_checkouts(user_id,livemode,attempt_id,expires_at) VALUES(?,?,?,?) ON CONFLICT(user_id,livemode) DO UPDATE SET attempt_id=excluded.attempt_id,session_id='',checkout_url='',expires_at=excluded.expires_at WHERE expires_at<=? RETURNING attempt_id`).bind(uid,mode,attempt,now+120000,now).first();
  if(!reserved)return result({error:'決済画面を準備しています。少し待って再試行してください。'},409);
  try{
   const origin=appOrigin(request,env);
   const session=await client.checkout.sessions.create({mode:'subscription',customer,client_reference_id:uid,line_items:[{price:env.STRIPE_PRICE_ID,quantity:1}],allowed_payment_method_types:['card'],subscription_data:{metadata:{azuki_uid:uid,terms_version:'2026-10-20',terms_accepted_at:new Date().toISOString()}},success_url:origin+'/plans?checkout=success',cancel_url:origin+'/plans?checkout=cancel',expires_at:Math.floor(now/1000)+1800,locale:'ja',custom_text:{submit:{message:'月額480円（税込）・毎月自動更新。契約管理から解約予約できます。[利用規約](https://azuki.mame-app.com/terms)・[特定商取引法に基づく表記](https://azuki.mame-app.com/commerce)をご確認ください。'}}},{idempotencyKey:`azuki-checkout-${attempt}`});
   if(!session.url)throw new Error('Missing checkout URL');
   await env.DB.prepare('UPDATE billing_checkouts SET session_id=?,checkout_url=?,expires_at=? WHERE user_id=? AND livemode=? AND attempt_id=?').bind(session.id,session.url,session.expires_at*1000,uid,mode,attempt).run();
   return result({url:session.url});
  }catch(failure){const reason=failure as {type?:string;code?:string;param?:string};console.error('Azuki Checkout failed',{type:reason.type,code:reason.code,param:reason.param});await env.DB.prepare('DELETE FROM billing_checkouts WHERE user_id=? AND livemode=? AND attempt_id=?').bind(uid,mode,attempt).run();return result({error:'決済画面を開けませんでした。時間をおいて再試行してください。'},503);}
 }
 return result({error:'この操作は利用できません。'},405);
}

export async function cleanupBilling(env:Env){
 const old=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
 await env.DB.batch([env.DB.prepare('DELETE FROM billing_rate_limits WHERE minute<?').bind(old),env.DB.prepare('DELETE FROM billing_checkouts WHERE expires_at<?').bind(Date.now()-86400000),env.DB.prepare('DELETE FROM billing_sync_locks WHERE expires_at<?').bind(Date.now())]);
}
