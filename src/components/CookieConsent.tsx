import { Link, useLocation } from "react-router-dom";
import { saveCookieChoice, useCookieChoice } from "../lib/cookieConsent";

export function CookieConsent() {
  const choice = useCookieChoice();
  const { pathname } = useLocation();
  const showBanner = !choice && !["/privacy", "/terms"].includes(pathname);
  return <>
    {showBanner && <section className="cookie-banner" aria-labelledby="cookie-title">
      <div><h2 id="cookie-title">Cookieの利用について</h2>
        <p>Azukiは、使われ方を把握してサービスを改善するため、Google Analyticsを利用します。許可するとCookieを使い、閲覧情報や端末情報などをGoogleに送信します。許可しなくても単語帳を利用できます。</p>
        <Link className="text-button cookie-details-button" to="/privacy">詳しくはプライバシーポリシーへ</Link>
      </div>
      <div className="cookie-actions"><button className="button secondary" onClick={() => saveCookieChoice("declined")}>許可しない</button><button className="button primary" onClick={() => saveCookieChoice("accepted")}>許可する</button></div>
    </section>}
  </>;
}
