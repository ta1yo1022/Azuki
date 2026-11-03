import {useI18n} from '../lib/i18n';
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCookieChoice } from "../lib/cookieConsent";
import { trackPage, resetAnalyticsPage } from "../lib/analytics";

export function PageAnalytics() {
 const t=useI18n();
  const choice = useCookieChoice();
  const { pathname } = useLocation();
  useEffect(() => {
    if (choice !== "accepted") { resetAnalyticsPage(); return; }
    // Redirects and StrictMode remounts should not create extra page views.
    const timer = window.setTimeout(() => trackPage(pathname), 0);
    return () => window.clearTimeout(timer);
  }, [pathname, choice]);
  return null;
}
