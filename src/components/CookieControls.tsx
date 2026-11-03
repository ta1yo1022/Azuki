import {useI18n,messageText} from '../lib/i18n';
import { useState } from "react";
import { saveCookieChoice, useCookieChoice } from "../lib/cookieConsent";
export function CookieControls() {
 const t=useI18n();
  const choice = useCookieChoice();
  const [message, setMessage] = useState("");
  function choose(next: "accepted" | "declined") {
    const saved = saveCookieChoice(next);
    setMessage(saved ? messageText("設定を保存しました。") : messageText("今回は適用しました。このブラウザに保存できないため、次回は再び確認します。"));
  }
  return <>
    <p>{t("現在の設定：")}{choice === "accepted" ? t("アクセス解析を許可") : choice === "declined" ? t("アクセス解析を許可しない") : t("未選択（アクセス解析は停止中）")}</p>
    <div className="cookie-actions"><button className="button secondary" onClick={() => choose("declined")}>{t("許可しない")}</button><button className="button primary" onClick={() => choose("accepted")}>{t("許可する")}</button></div>
    {message && <p role="status">{t(message)}</p>}
  </>;
}
