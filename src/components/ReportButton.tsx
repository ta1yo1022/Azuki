import { useEffect, useRef, useState } from "react";
import { Flag, X } from "lucide-react";
import { auth, googleSignIn } from "../lib/firebase";
import { reportRepository } from "../lib/repository";
import { REPORT_REASONS } from "../../shared/reports";
export function ReportButton({ id, title }: {id:string;title:string}) {
  const [open,setOpen] = useState(false);
  return <><button className="text-button report-trigger" onClick={() => setOpen(true)}><Flag size={15} />この単語帳を通報</button>{open && <ReportDialog id={id} title={title} onClose={() => setOpen(false)} />}</>;
}
function ReportDialog({id,title,onClose}:{id:string;title:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [reason,setReason]=useState(""); const [details,setDetails]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [sent,setSent]=useState("");
  useEffect(() => {dialog.current?.showModal();},[]);
  async function submit() {
    if (busy) return;
    setBusy(true);setError("");
    try {
      if (!reason) throw new Error("通報理由を選択してください。");
      if (reason === "other" && !details.trim()) throw new Error("内容を入力してください。");
      if (!auth?.currentUser) await googleSignIn();
      const result=await reportRepository.send(id,reason,details);
      setSent(result.duplicate ? "この単語帳は通報済みです。運営が内容を確認します。" : "通報を受け付けました。運営が内容を確認します。");
    } catch(e) {setError(e instanceof Error ? e.message : "送信できませんでした。");}
    finally {setBusy(false);}
  }
  return <dialog ref={dialog} className="import-dialog report-dialog" aria-labelledby="report-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <div className="dialog-inner"><header className="dialog-header"><h2 id="report-title">単語帳を通報</h2><button className="icon-button" aria-label="閉じる" disabled={busy} onClick={onClose}><X size={20}/></button></header>
      <p className="report-target">{title}</p>
      {sent ? <p role="status" className="report-result">{sent}</p> : <>
        <fieldset className="import-classification" disabled={busy}><legend className="visually-hidden">通報内容</legend>
          <div className="import-field"><label htmlFor="report-reason">理由 <small className="field-required">必須</small></label><select id="report-reason" value={reason} onChange={e=>setReason(e.target.value)}><option value="">理由を選ぶ</option>{Object.entries(REPORT_REASONS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
          <div className="import-field"><label htmlFor="report-details">補足 <small>{reason === "other" ? "必須" : "任意"}</small></label><textarea id="report-details" maxLength={1000} rows={4} value={details} onChange={e=>setDetails(e.target.value)} placeholder="該当する単語や、問題と思う箇所を教えてください。"/></div>
        </fieldset><p className="report-help">送信にはGoogleログインが必要です。通報者の情報は単語帳の作成者には表示されません。通報だけで自動的に公開が停止されることはありません。</p>
        {error && <p role="alert" className="error-box">{error}</p>}
      </>}
      <footer className="dialog-footer"><button className="button secondary" disabled={busy} onClick={onClose}>{sent ? "閉じる" : "キャンセル"}</button>{!sent && <button className="button primary" disabled={busy} onClick={()=>void submit()}>{busy ? "送信しています…" : "通報を送信"}</button>}</footer>
    </div>
  </dialog>;
}
