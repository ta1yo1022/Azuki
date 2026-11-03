import {useI18n,messageText} from '../lib/i18n';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { emailRepository } from '../lib/repository';

export function EmailPreferences() {
 const t=useI18n();
  const [state,setState]=useState<{enabled:boolean;email:string|null;available:boolean}|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    if (!auth) return;
    let active=true, requestVersion=0;
    const unsub=onAuthStateChanged(auth,user=>{
      const current=++requestVersion; setState(null);setError('');
      if(user) void emailRepository.preferences().then(r=>{if(active&&current===requestVersion)setState(r);}).catch(()=>{if(active&&current===requestVersion)setError(messageText("メール通知の設定を取得できませんでした。"));});
    });
    return ()=>{active=false;unsub();};
  },[version]);
  async function toggle() {
    if(!state)return;
    setBusy(true);setError('');setMessage('');
    try {const result=await emailRepository.setPreferences(!state.enabled);setState({...state,enabled:result.enabled});setMessage(result.enabled?messageText("アップデート通知を受け取る設定にしました。"):messageText("アップデート通知を停止しました。"));}
    catch(e){setError(e instanceof Error?e.message:messageText("保存できませんでした。"));}finally{setBusy(false);}
  }
  return <section className="study-setup" aria-labelledby="email-settings-title"><h2 id="email-settings-title">{t("アップデートのメール通知")}</h2><p>{t("新機能や使い方のお知らせを、Googleアカウントのメールアドレスにお届けします。初期設定は「受信する」です。設定画面やメール内のリンクから、いつでも停止できます。")}</p>
    <p>{t("配信にはBrevoを使い、メールアドレスと送信内容を送信します。")}<Link to="/privacy">{t("プライバシーポリシー")}</Link></p>
    {state?<><p>{state.email} — {state.enabled?t("受信する"):t("受信しない")}</p><button className="button secondary" disabled={busy||!state.available} onClick={()=>void toggle()}>{busy?t("保存中…"):state.enabled?t("メール通知を停止する"):t("アップデート通知を受け取る")}</button></>:!error?<p>{t("ログイン状態と設定を確認しています…")}</p>:null}
    {message&&<p role="status">{t(message)}</p>}{error&&<p className="error-box" role="alert">{t(error)} <button className="text-button" onClick={()=>setVersion(n=>n+1)}>{t("再確認")}</button></p>}
  </section>;
}
