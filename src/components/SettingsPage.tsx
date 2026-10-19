import { EmailPreferences } from './EmailPreferences';
import { AdminLink } from "./AdminReports";
import { CookieControls } from "./CookieControls";
import { LegalLinks } from "./LegalPage";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { readStudyPreferences, saveStudyPreferences } from "../lib/studyPreferences";

export function SettingsPage({ onClose, onTutorial, demo = false }: { demo?: boolean; onClose: () => void; onTutorial?: () => void }) {
  const [draft, setDraft] = useState(readStudyPreferences);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => { document.title = "設定 — Azuki"; }, []);
  return <div className="study-page settings-page">
    <header className="study-header">
      <button className="text-button study-back" onClick={onClose}><ArrowLeft size={20} />ライブラリに戻る</button>
      <h1>設定</h1>
    </header>
    <main className="study-content">
      <Link className="button secondary" to={demo?"/demo/stats":"/library/stats"}>学習統計を見る</Link>
      <section className="study-setup" aria-labelledby="settings-title">
        <h2 id="settings-title">カード学習</h2>
        <p>次回の学習で使う設定を選んでください。</p>
        <div className="study-settings">
          <label>出題順<select aria-label="出題順" value={draft.order} onChange={e => setDraft({...draft, order: e.target.value as typeof draft.order})}>
            <option value="ordered">順番どおり</option><option value="shuffle">シャッフル</option>
          </select></label>
          <label>カードの向き<select aria-label="カードの向き" value={draft.direction} onChange={e => setDraft({...draft, direction: e.target.value as typeof draft.direction})}>
            <option value="ja-en">日本語 → 英語</option><option value="en-ja">英語 → 日本語</option>
          </select></label>
        <label>例文カードの向き<select aria-label="例文カードの向き" value={draft.exampleDirection ?? "en-ja"} onChange={e => setDraft({...draft, exampleDirection:e.target.value as "ja-en" | "en-ja"})}><option value="en-ja">英語 → 日本語</option><option value="ja-en">日本語 → 英語</option></select></label>
        </div>
        <label className="study-skip-setup"><input type="checkbox" checked={draft.skipSetup} onChange={e => setDraft({...draft, skipSetup:e.target.checked})} />学習開始前の設定画面を表示しない</label>
        <p className="study-setup-note">チェックを外すと、学習開始前に設定を選べます。設定はこのブラウザに保存されます。</p>
        <button className="button primary" onClick={() => {
          const saved = saveStudyPreferences(draft);
          setFailed(!saved);
          setMessage(saved ? "設定を保存しました。" : "設定を保存できませんでした。ブラウザの保存設定を確認してください。");
        }}>設定を保存</button>
        {message && <p role={failed ? "alert" : "status"}>{message}</p>}
      </section>
      {onTutorial && <section className="study-setup" aria-labelledby="tutorial-settings-title"><h2 id="tutorial-settings-title">Azukiの使い方</h2><p>画面の案内を見ながら、単語帳の追加や学習の始め方を確認できます。</p><button className="button secondary" onClick={onTutorial}>チュートリアルを見る</button></section>}
      <section className="study-setup"><h2>Cookieとアクセス解析</h2><p>サービス改善のためのアクセス解析を選べます。このブラウザに適用され、許可しなくても単語帳は使えます。</p><CookieControls /><a className="text-button" href="/privacy">詳しくはプライバシーポリシーへ</a></section>
      {!demo && <EmailPreferences />}
      <AdminLink />
      <LegalLinks />
    </main>
  </div>;
}
