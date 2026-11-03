import {useI18n} from '../lib/i18n';
import { Link, useLocation } from "react-router-dom";
import { saveCookieChoice, useCookieChoice } from "../lib/cookieConsent";

export function CookieConsent() {
 const t=useI18n();
  const choice = useCookieChoice();
  const { pathname } = useLocation();
  const showBanner = !choice && !["/privacy", "/terms"].includes(pathname);
  return <>
    {showBanner && <section className="cookie-banner" aria-labelledby="cookie-title">
      <div><h2 id="cookie-title">{t("Cookieの利用について")}</h2>
        <p>{t("Azukiは、使われ方を把握してサービスを改善するため、Google Analyticsを利用します。許可するとCookieを使い、閲覧情報や端末情報などをGoogleに送信します。許可しなくても単語帳を利用できます。")}</p>
        <Link className="text-button cookie-details-button" to="/privacy">{t("詳しくはプライバシーポリシーへ")}</Link>
      </div>
      <div className="cookie-actions"><button className="button secondary" onClick={() => saveCookieChoice("declined")}>{t("許可しない")}</button><button className="button primary" onClick={() => saveCookieChoice("accepted")}>{t("許可する")}</button></div>
    </section>}
  </>;
}
