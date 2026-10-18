import { EmailComposer, EmailPreview } from './EmailComposer';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, googleSignIn } from '../lib/firebase';
import { emailRepository } from '../lib/repository';
import type { EmailCampaign, EmailDashboard } from '../../shared/email';
import { Brand } from './Brand';
import './emails.css';
const states={draft:'下書き',queued:'配信中',completed:'処理完了',cancelled:'中止'};
const testStates:Record<string,string>={pending:'送信待ち',sending:'処理中',accepted:'受付済み',failed:'失敗',unknown:'要確認',skipped:'中止'};
export function AdminEmails() {
  const [user,setUser]=useState<User|null>(auth?.currentUser??null),[ready,setReady]=useState(!auth);
  const [data,setData]=useState<EmailDashboard|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
  const [confirmation,setConfirmation]=useState<EmailCampaign|null>(null);
  useEffect(()=>{if(confirmation)document.getElementById('email-confirm')?.scrollIntoView({behavior:'smooth',block:'center'});},[confirmation]);
  useEffect(()=>{document.title='アップデート通知 — Azuki';if(auth)return onAuthStateChanged(auth,u=>{setUser(u);setReady(true);setData(null);setConfirmation(null);});},[]);
  useEffect(()=>{
    if(!user||!ready)return;
    let active=true;setError('');
    const load=()=>void emailRepository.dashboard().then(r=>{if(active)setData(r);}).catch(e=>{if(active)setError(e.message);});
    load();const timer=setInterval(load,30000);
    return()=>{active=false;clearInterval(timer);};
  },[user,ready,refresh]);
  async function run(action:()=>Promise<unknown>) {setBusy(true);setError('');try{await action();setConfirmation(null);setRefresh(n=>n+1);}catch(e){setError(e instanceof Error?e.message:'処理できませんでした。');}finally{setBusy(false);}}
  return <div className="create-guide admin-emails"><header className="guide-header"><Link to="/"><Brand/></Link><Link className="text-button" to="/library/settings">設定へ戻る</Link></header><main>
    <span className="eyebrow">運営管理</span><h1>アップデート通知</h1>
    {!ready?<p>ログイン状態を確認しています…</p>:!user?<><p>管理者のGoogleアカウントでログインしてください。</p><button className="button primary" onClick={()=>void run(googleSignIn)}>Googleでログイン</button></>:data?<>
      <div className="email-summary"><strong>受信登録者 {data.subscribers.toLocaleString()} 人</strong><span>直近24時間の送信試行 {data.used} / {data.limit} 通</span></div>
      <p>受信を希望した全ユーザーへ、5分ごとに最大10通ずつ配信します。上限に達した分は翌日以降に続けます。</p>
      {!data.ready&&<p className="error-box" role="status">配信はまだ無効です。BrevoのAPIキー・認証済み送信元・配信停止URLを設定すると、テスト送信から開始できます。下書きは作成できます。</p>}
      <EmailComposer busy={busy} onSave={async(id,subject,body)=>{setBusy(true);setError('');try{await emailRepository.create(id,subject,body);setRefresh(n=>n+1);}catch(e){setError(e instanceof Error?e.message:'保存できませんでした。');throw e;}finally{setBusy(false);}}}/>
      <section><div className="email-list-heading"><h2>配信履歴・下書き</h2><button className="text-button" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>更新</button></div><p>最新50件を表示します。「受付済み」はBrevoの受付結果で、受信箱への到着を保証するものではありません。</p>
        {data.campaigns.length===0&&<p>お知らせはまだありません。</p>}
        {data.campaigns.map(c=><article className="admin-report" key={c.id}><span className="eyebrow">{states[c.status]}</span><h3>{c.subject}</h3><p>{new Date(c.created_at).toLocaleString('ja-JP')}</p><details><summary>本文を確認</summary><EmailPreview subject={c.subject} body={c.body}/></details>
          <p>待機 {c.pending} ／ 受付済み {c.accepted} ／ 失敗 {c.failed} ／ 要確認 {c.unknown} ／ 対象外 {c.skipped}</p>
          {c.test_status&&<p>自分宛てのテスト：{testStates[c.test_status]??c.test_status}</p>}
          {(c.failed>0||c.unknown>0)&&<p>失敗・結果不明のメールは重複配信を避けるため自動再送しません。Brevoの送信ログを確認してください。</p>}
          <div className="email-actions">{c.status==='draft'&&<><button className="button secondary" disabled={busy||!data.ready||!!c.test_status} onClick={()=>void run(()=>emailRepository.action(c.id,'test'))}>自分宛てにテスト送信</button><button className="button primary" disabled={busy||!data.ready||c.test_status!=='accepted'||data.subscribers===0} onClick={()=>setConfirmation(c)}>配信内容を確認</button></>}{['draft','queued'].includes(c.status)&&<button className="text-button" disabled={busy} onClick={()=>void run(()=>emailRepository.action(c.id,'cancel'))}>未送信分を中止</button>}</div>
        </article>)}
      </section>
      {confirmation&&<section id="email-confirm" className="email-confirm" role="region" aria-label="一斉配信の最終確認"><h2>この内容を受信登録者全員に送ります</h2><p>現在 {data.subscribers} 人。開始時点の受信登録者を対象にします。送信済みのメールは取り消せません。</p><EmailPreview subject={confirmation.subject} body={confirmation.body}/><div className="email-actions"><button className="button secondary" disabled={busy} onClick={()=>setConfirmation(null)}>戻る</button><button className="button primary" disabled={busy} onClick={()=>void run(()=>emailRepository.action(confirmation.id,'start'))}>全受信登録者への配信を開始</button></div></section>}
    </>:!error?<p>配信設定を読み込んでいます…</p>:null}
    {error&&<p className="error-box" role="alert">{error}</p>}
  </main></div>;
}