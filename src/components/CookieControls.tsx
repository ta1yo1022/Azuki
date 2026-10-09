import { useState } from "react";
import { saveCookieChoice, useCookieChoice } from "../lib/cookieConsent";
export function CookieControls() {
  const choice = useCookieChoice();
  const [message, setMessage] = useState("");
  function choose(next: "accepted" | "declined") {
    const saved = saveCookieChoice(next);
    setMessage(saved ? "設定を保存しました。" : "今回は適用しました。このブラウザに保存できないため、次回は再び確認します。");
  }
  return <>
    <p>現在の設定：{choice === "accepted" ? "アクセス解析を許可" : choice === "declined" ? "アクセス解析を許可しない" : "未選択（アクセス解析は停止中）"}</p>
    <div className="cookie-actions"><button className="button secondary" onClick={() => choose("declined")}>許可しない</button><button className="button primary" onClick={() => choose("accepted")}>許可する</button></div>
    {message && <p role="status">{message}</p>}
  </>;
}
