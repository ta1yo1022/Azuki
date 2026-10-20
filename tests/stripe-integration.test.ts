import { it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import Stripe from 'stripe';
import { sqliteD1 } from './helpers/sqliteD1';
import { createHandler,type Env } from '../worker';
it.skipIf(process.env.AZUKI_STRIPE_SMOKE!=='1')('verifies real Stripe test Checkout, payments, portal and cancellation',async()=>{
 const values=Object.fromEntries(readFileSync('.dev.vars','utf8').split('\n').filter(line=>line.includes('=')&&!line.startsWith('#')).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1).trim().replace(/^["']|["']$/g,'')];}));
 expect(values.STRIPE_SECRET_KEY?.startsWith('sk_test_')).toBe(true);
 const db=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').filter(file=>file.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+file,'utf8'));
 const uid='stripe-smoke-'+crypto.randomUUID();
 const env={...values,DB:sqliteD1(db),BILLING_ENABLED:'true',FIREBASE_PROJECT_ID:'azuki-test',ALLOWED_ORIGINS:'http://localhost:5174'} as Env;
 const client=new Stripe(values.STRIPE_SECRET_KEY,{httpClient:Stripe.createFetchHttpClient(),timeout:20000,maxNetworkRetries:0});
 const handler=createHandler(async token=>{if(token!==uid)throw new Error('invalid');return {uid,emailVerified:false};});
 const call=(path:string,method='GET')=>handler(new Request('https://api.test/api/billing/'+path,{method,headers:{Origin:'http://localhost:5174',Authorization:'Bearer '+uid,'Content-Type':'application/json'},...(path==='checkout'?{body:JSON.stringify({acceptTerms:true})}:{})}),env);
 let subscriptionId:string|undefined,customerId:string|undefined;
 try{
  const checkout=await call('checkout','POST');const checkoutData=await checkout.json() as any;
  expect(checkout.status,JSON.stringify(checkoutData)).toBe(200);expect(checkoutData.url).toContain('checkout.stripe.com');
  const customer=db.prepare('SELECT customer_id FROM billing_customers WHERE user_id=?').get(uid) as {customer_id:string};customerId=customer.customer_id;
  const stored=db.prepare('SELECT session_id FROM billing_checkouts WHERE user_id=?').get(uid) as {session_id:string};
  const session=await client.checkout.sessions.retrieve(stored.session_id);
  expect(session.livemode).toBe(false);expect(session.amount_total).toBe(480);expect(session.currency).toBe('jpy');
  const second=await call('checkout','POST');expect((await second.json() as any).url).toBe(checkoutData.url);
  await client.checkout.sessions.expire(session.id);
  const payment=await client.paymentMethods.attach('pm_card_visa',{customer:customerId});
  const subscription=await client.subscriptions.create({customer:customerId,items:[{price:values.STRIPE_PRICE_ID}],default_payment_method:payment.id,payment_behavior:'error_if_incomplete',metadata:{azuki_uid:uid}});
  subscriptionId=subscription.id;expect(subscription.status).toBe('active');
  const event=JSON.stringify({id:'evt_smoke_'+Date.now(),object:'event',livemode:false,type:'customer.subscription.updated',data:{object:{customer:customerId}}});
  const signature=await client.webhooks.generateTestHeaderStringAsync({payload:event,secret:values.STRIPE_WEBHOOK_SECRET,cryptoProvider:Stripe.createSubtleCryptoProvider()});
  const webhook=()=>handler(new Request('https://api.test/api/billing/webhook',{method:'POST',headers:{'stripe-signature':signature},body:event}),env);
  expect((await webhook()).status).toBe(200);
  expect((await (await call('status')).json() as any).pro).toBe(true);
  expect((await call('checkout','POST')).status).toBe(409);
  const portal=await call('portal','POST');expect(portal.status).toBe(200);expect((await portal.json() as any).url).toContain('billing.stripe.com');
  await client.subscriptions.update(subscriptionId,{cancel_at_period_end:true});expect((await webhook()).status).toBe(200);
  expect((await (await call('status')).json() as any)).toMatchObject({pro:true,cancelAtPeriodEnd:true});
  await client.subscriptions.cancel(subscriptionId);subscriptionId=undefined;
  expect((await webhook()).status).toBe(200);expect((await (await call('status')).json() as any).pro).toBe(false);
 }finally{
  if(subscriptionId)await client.subscriptions.cancel(subscriptionId);
  customerId??=(db.prepare('SELECT customer_id FROM billing_customers WHERE user_id=?').get(uid) as {customer_id?:string}|undefined)?.customer_id;
  if(customerId)await client.customers.del(customerId);
  db.close();
 }
},120000);
