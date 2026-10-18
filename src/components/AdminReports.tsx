import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, googleSignIn } from "../lib/firebase";
import { reportRepository } from "../lib/repository";
import { REPORT_REASONS, type DeckReport, type ReportStatus } from "../../shared/reports";
import { Brand } from "./Brand";
const statuses:Record<ReportStatus,string>={pending:"未対応",resolved:"対応済み",dismissed:"対応不要"};
export function AdminLink() {
  const [allowed,setAllowed]=useState(false);
  useEffect(()=>{
    if (!auth) return;
    let version=0;
    const unsub=onAuthStateChanged(auth,user=>{const current=++version;setAllowed(false);if(user)void reportRepository.access().then(r=>{if(version===current)setAllowed(r.isAdmin);}).catch(()=>{});});
    return ()=>{version++;unsub();};
  },[]);
  return allowed ? <section className="study-setup"><h2>運営管理</h2><Link className="button secondary" to="/admin/reports">単語帳の通報を確認</Link> <Link className="button secondary" to="/admin/emails">アップデート通知を配信</Link></section> : null;
}
export function AdminReports() {
  const [user,setUser]=useState<User|null>(auth?.currentUser??null);const [ready,setReady]=useState(!auth);
  const [status,setStatus]=useState<ReportStatus>("pending");const [reports,setReports]=useState<DeckReport[]>([]);
  const [cursor,setCursor]=useState<string|null>(null);const [next,setNext]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [reload,setReload]=useState(0);
  useEffect(()=>{document.title="通報の管理 — Azuki"; if(auth)return onAuthStateChanged(auth,u=>{setUser(u);setReady(true);setReports([]);setCursor(null);});},[]);
  useEffect(()=>{
    let active=true;setReports([]);setNext(null);setError("");
    if(!ready||!user)return;
    setBusy(true);void reportRepository.list(status,cursor).then(r=>{if(active){setReports(r.reports);setNext(r.nextCursor);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[user,ready,status,cursor,reload]);
  async function login(){setError("");try{await googleSignIn();}catch(e){setError(e instanceof Error?e.message:"ログインできませんでした。");}}
  return <div className="create-guide admin-reports"><header className="guide-header"><Link to="/"><Brand/></Link><Link to="/library/settings" className="text-button">設定へ戻る</Link></header><main>
    <span className="eyebrow">運営管理</span><h1>単語帳の通報</h1>
    {!ready ? <p role="status">ログイン状態を確認しています…</p> : !user ? <><p>管理者のGoogleアカウントでログインしてください。</p><button className="button primary" onClick={()=>void login()}>Googleでログイン</button></> : <>
      <div className="admin-statuses" role="group" aria-label="通報の状態">{Object.entries(statuses).map(([key,label])=><button key={key} className={`filter-chip ${key===status?"selected":""}`} aria-pressed={key===status} onClick={()=>{setStatus(key as ReportStatus);setCursor(null);}}>{label}</button>)}</div>
      {busy && <p role="status">通報を読み込んでいます…</p>}
      {!busy&&!error&&!reports.length&&<p>この状態の通報はありません。</p>}
      {reports.map(report=><ReportItem key={report.id} report={report} onSaved={()=>setReload(n=>n+1)}/>)}
      <div className="admin-pagination">{cursor&&<button className="button secondary" disabled={busy} onClick={()=>setCursor(null)}>先頭に戻る</button>}{next&&<button className="button secondary" disabled={busy} onClick={()=>setCursor(next)}>次の50件</button>}</div>
    </>}
    {error&&<div className="error-box" role="alert">{error}<button className="text-button" onClick={()=>setReload(n=>n+1)}>再確認</button></div>}
  </main></div>;
}
function ReportItem({report,onSaved}:{report:DeckReport;onSaved:()=>void}) {
  const [status,setStatus]=useState(report.status);const [note,setNote]=useState(report.admin_note);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function save(){setBusy(true);setError("");try{await reportRepository.update(report.id,status,note);onSaved();}catch(e){setError(e instanceof Error?e.message:"保存できませんでした。");}finally{setBusy(false);}}
  return <article className="admin-report"><div className="admin-report-meta"><strong>{REPORT_REASONS[report.reason]}</strong><time dateTime={report.created_at}>{new Date(report.created_at).toLocaleString("ja-JP")}</time></div><h2>{report.deck_title}</h2>
    {report.current_visibility==="public" ? <Link target="_blank" rel="noreferrer" to={`/shared/${encodeURIComponent(report.deck_id)}`}>対象の単語帳を開く ↗</Link> : <p>{report.current_visibility==="private"?"現在は非公開です。":"対象の単語帳は削除されています。"}</p>}
    <p className="report-details">{report.details||"補足はありません。"}</p>
    <fieldset className="import-classification" disabled={busy}><legend className="visually-hidden">対応内容</legend><div className="import-field"><label htmlFor={`status-${report.id}`}>対応状況</label><select id={`status-${report.id}`} value={status} onChange={e=>setStatus(e.target.value as ReportStatus)}>{Object.entries(statuses).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></div><div className="import-field"><label htmlFor={`note-${report.id}`}>管理メモ（運営のみ）</label><textarea id={`note-${report.id}`} value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></div></fieldset>
    <p className="report-help">対応状況を変えても、単語帳の公開範囲は変わりません。</p><button className="button primary" disabled={busy} onClick={()=>void save()}>{busy?"保存中…":"対応を保存"}</button>{error&&<p className="error-box" role="alert">{error}</p>}
  </article>;
}
