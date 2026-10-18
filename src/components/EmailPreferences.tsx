import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { emailRepository } from '../lib/repository';

export function EmailPreferences() {
  const [state,setState]=useState<{enabled:boolean;email:string|null;available:boolean}|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    if (!auth) return;
    let active=true, requestVersion=0;
    const unsub=onAuthStateChanged(auth,user=>{
      const current=++requestVersion; setState(null);setError('');
      if(user) void emailRepository.preferences().then(r=>{if(active&&current===requestVersion)setState(r);}).catch(()=>{if(active&&current===requestVersion)setError('メール通知の設定を取得できませんでした。');});
    });
    return ()=>{active=false;unsub();};
  },[version]);
  async function toggle() {
    if(!state)return;
    setBusy(true);setError('');setMessage('');
    try {const result=await emailRepository.setPreferences(!state.enabled);setState({...state,enabled:result.enabled});setMessage(result.enabled?'アップデート通知を受け取る設定にしました。':'アップデート通知を停止しました。');}
    catch(e){setError(e instanceof Error?e.message:'保存できませんでした。');}finally{setBusy(false);}
  }
  return <section className="study-setup" aria-labelledby="email-settings-title"><h2 id="email-settings-title">アップデートのメール通知</h2><p>新機能や使い方のお知らせを、Googleアカウントのメールアドレスにお届けします。受信は任意で、いつでも停止できます。</p>
    <p>配信にはBrevoを使い、メールアドレスと送信内容を送信します。<Link to="/privacy">プライバシーポリシー</Link></p>
    {state?<><p>{state.email} — {state.enabled?'受信する':'受信しない'}</p><button className="button secondary" disabled={busy||!state.available} onClick={()=>void toggle()}>{busy?'保存中…':state.enabled?'メール通知を停止する':'アップデート通知を受け取る'}</button></>:!error?<p>ログイン状態と設定を確認しています…</p>:null}
    {message&&<p role="status">{message}</p>}{error&&<p className="error-box" role="alert">{error} <button className="text-button" onClick={()=>setVersion(n=>n+1)}>再確認</button></p>}
  </section>;
}
