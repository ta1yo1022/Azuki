import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Crown, ShieldCheck } from 'lucide-react';
import { auth, googleSignIn } from '../lib/firebase';
import { billingRequest, useBilling, type BillingStatus } from '../lib/billing';
import { Brand } from './Brand';
export function PlansPage(){
 const {status,error,loading,refresh}=useBilling();
 const [consent,setConsent]=useState(false);
 const [offerCode,setOfferCode]=useState('');
 const [toast,setToast]=useState('');
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer);},[toast]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [params]=useSearchParams();const synced=useRef(false);
 useEffect(()=>{document.title='Azuki Pro — 月額480円';},[]);
 useEffect(()=>{
  if(params.get('checkout')!=='success'||!auth?.currentUser||synced.current)return;
  synced.current=true;setBusy(true);
  billingRequest<BillingStatus>('refresh','POST').then(()=>{setToast('契約状況を更新しました。');refresh();window.dispatchEvent(new Event('azuki-audio-quota'));}).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));
 },[params,status]);
 async function action(kind:'checkout'|'portal'|'refresh'|'redeem',cancelCheckout=false){
  if(busy)return;setBusy(true);setMessage('');
  try{
   if(!auth?.currentUser)await googleSignIn();
   if(kind==='checkout'&&!consent)throw new Error('利用規約と毎月の自動更新をご確認ください。');
   const data=await billingRequest<{url?:string}>(kind,'POST',kind==='checkout'?{acceptTerms:true}:kind==='redeem'?{code:offerCode,...(cancelCheckout?{cancelCheckout:true}:{})}:undefined);
   if(data.url){const url=new URL(data.url);if(url.protocol!=='https:'||!(url.hostname==='checkout.stripe.com'||url.hostname==='billing.stripe.com'))throw new Error('決済画面のURLを確認できませんでした。');window.location.assign(url.href);}
   else{if(kind==='redeem')setOfferCode('');setToast(kind==='redeem'?'1か月無料オファーを適用しました。':'契約状況を更新しました。');refresh();window.dispatchEvent(new Event('azuki-audio-quota'));}
  }catch(e){setMessage(e instanceof Error?e.message:'処理できませんでした。');}finally{setBusy(false);}
 }
 return <div className="plans-page"><header><Brand/><Link className="text-button" to="/library"><ArrowLeft size={17}/>ライブラリへ</Link></header><main>
  <h1>Azuki Pro</h1><p className="plans-intro">音声と、本をめくる学習をもっと自由に。</p>
  {status?.testMode&&<p className="plans-test" role="status">テスト環境です。実際の請求は発生しません。</p>}
  <div className="plans-grid"><section className="plan-card"><h2>Free</h2><p className="plan-price">¥0</p><ul><li><Check/>カード・例文カードで学習</li><li><Check/>単語音声の新規生成：1日10個</li><li><Check/>例文音声の新規生成：1日5個</li><li><Check/>生成済み音声の再生は制限なし</li></ul></section>
  <section className="plan-card plan-pro"><h2><Crown/>Pro</h2><p className="plan-price">¥480<span> / 月（税込）</span></p><ul><li><Check/>Freeの機能すべて</li><li><Check/>単語・例文音声の新規生成：個人上限なし</li><li><Check/>本型の「単語帳で学習」</li></ul>
   {!status?.pro&&<label className="plan-consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/><span><Link to="/terms" target="_blank">利用規約</Link>と月額480円（税込）の毎月自動更新に同意します。</span></label>}
   {loading?<p role="status">契約状況を確認しています…</p>:status?.pro?<p className="plan-active"><Check/>Proをご利用中です</p>:<button className="button primary" disabled={busy||!status?.checkoutAvailable||!consent} onClick={()=>void action('checkout')}>{busy?'準備しています…':status?.checkoutAvailable?'月額480円でProを始める':'販売開始の準備中です'}</button>}
   <p className="plan-conditions">毎月自動更新。契約管理から解約できます。解約予約後も、支払済みの期間終了まで利用できます。</p>
  </section></div>
  {status?.offerExpiresAt&&status.offerExpiresAt>Date.now()/1000&&<section className="plan-management"><h2>1か月無料オファーをご利用中です</h2><p>{new Date(status.offerExpiresAt*1000).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}までProを利用できます。カード登録・自動課金はありません。期間終了後は無料プランへ戻ります。</p></section>}
  {!status?.pro&&!status?.offerRedeemed&&status?.enabled&&<section className="plan-management"><h2>オファーコードをお持ちの方</h2><p>カード登録不要で1か月Proを利用できます。1アカウント1回限り。終了後は自動課金されず、無料プランへ戻ります。</p><form className="offer-form" onSubmit={event=>{event.preventDefault();void action('redeem');}}><label htmlFor="offer-code">オファーコード</label><div><input id="offer-code" value={offerCode} onChange={event=>setOfferCode(event.target.value)} maxLength={64} autoComplete="off" spellCheck={false}/><button className="button secondary" disabled={busy||loading||!offerCode.trim()}>適用する</button></div></form></section>}
  {status?.status&&<section className="plan-management"><h2>契約の管理</h2><p>{status.cancelAtPeriodEnd?'解約予約済みです。':status.pro?'契約は有効です。':'お支払い・契約状況をご確認ください。'}{status.periodEnd?` 現在の契約期間：${new Date(status.periodEnd*1000).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})}まで。`:''}</p><button className="button secondary" disabled={busy} onClick={()=>void action('portal')}>契約・支払い方法を管理</button></section>}
  <p className="plan-note">音声枠は日本時間9時にリセットします。生成済み音声は枠に含まれません。Proも不正利用や過度な連続生成を防ぐため、一時的に制限する場合があります。保存語数など、その他の上限は変わりません。</p>
  {(error||message)&&<div className="plan-feedback" role="status"><p>{message||error}</p>{message.includes('決済手続き中です。')&&<button className="button secondary" disabled={busy||!offerCode.trim()} onClick={()=>void action('redeem',true)}>決済手続きをキャンセルしてオファーを使う</button>}</div>}
  <button className="text-button" disabled={busy||loading} onClick={()=>void action('refresh')}>契約状況を更新</button>
  <footer><Link to="/commerce">特定商取引法に基づく表記</Link><Link to="/terms">利用規約</Link><Link to="/privacy">プライバシーポリシー</Link></footer>
 </main>{toast&&<div className="toast plans-toast" role="status"><ShieldCheck size={18}/>{toast}</div>}</div>;
}
export function ProBookGate({children,onClose}:{children:React.ReactNode;onClose:()=>void}){
 const {status,error,loading,refresh}=useBilling();
 if(loading)return <main className="full-loading" role="status">利用プランを確認しています…</main>;
 if(status&&(!status.enabled||status.pro))return children;
 return <main className="full-loading"><Crown size={36}/><h1>本型で学ぶ、Azuki Pro</h1><p>{error||'「単語帳で学習」はProで利用できます。カード・例文カードは引き続き無料で使えます。'}</p>{error?<button className="button secondary" onClick={refresh}>もう一度確認する</button>:<Link className="button primary" to="/plans">Proを見る</Link>}<button className="text-button" onClick={onClose}>単語一覧に戻る</button></main>;
}
