import {useI18n,t} from '../lib/i18n';
export function LoadingScreen({ message = t("読み込んでいます…") }: { message?: string }) {
 const t=useI18n();
  return <div className="full-loading azuki-loading" role="status" aria-live="polite">
    <div className="azuki-loading-motion" aria-hidden="true">
      <img className="azuki-loading-mark" src="/favicon.svg" alt="" width="72" height="72" />
      <span className="azuki-loading-shadow" />
    </div>
    <span className="azuki-loading-status">{t(message)}</span>
  </div>;
}
