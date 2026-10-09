import { readCookieChoice } from "./cookieConsent";
type Command = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Command };
const productionHost = "azuki.mame-app.com";
let ready = false;
let lastPath = "";
let previousPage = "";

/** Only route categories are collected: never book IDs, titles, query text or hashes. */
export function analyticsPage(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const fixed: Record<string, string> = {
    "/privacy": "プライバシーポリシー", "/terms": "利用規約", "/": "ホーム", "/library": "マイライブラリ", "/library/import": "単語帳の追加",
    "/library/settings": "設定", "/explore": "公開単語帳を探す", "/guide/create": "単語帳の作り方",
    "/demo": "お試しライブラリ", "/demo/import": "お試し・追加", "/demo/settings": "お試し・設定",
  };
  if (fixed[path]) return { path, title: fixed[path] };
  const owned = path.match(/^\/(library|demo)\/decks\/[^/]+(?:\/(study|share))?$/);
  if (owned) return { path: `/${owned[1]}/decks/book${owned[2] ? `/${owned[2]}` : ""}`, title: owned[2] === "study" ? "カード学習" : owned[2] === "share" ? "共有設定" : "単語帳" };
  const shared = path.match(/^\/shared\/[^/]+(\/study)?$/);
  if (shared) return { path: `/shared/book${shared[1] ?? ""}`, title: shared[1] ? "公開単語帳・カード学習" : "公開単語帳" };
  return { path: "/not-found", title: "ページが見つかりません" };
}

export function resetAnalyticsPage() { lastPath = ""; previousPage = ""; }

export function trackPage(pathname: string) {
  if (readCookieChoice() !== "accepted") return;
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
  // Local development, preview deployments and tests must not pollute production data.
  if (!import.meta.env.PROD || window.location.hostname !== productionHost || !/^G-[A-Z0-9]+$/.test(id ?? "")) return;
  if (pathname === lastPath) return;
  const page = analyticsPage(pathname);
  const pageLocation = `https://${productionHost}${page.path}`;
  const win = window as AnalyticsWindow;
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = false;
  if (!ready) {
    win.dataLayer ??= [];
    win.gtag ??= function () { win.dataLayer!.push(arguments); };
    win.gtag("js", new Date());
    ready = true;
    // Enhanced measurement must also be disabled in the GA stream settings.
    // send_page_view only disables the page view sent by the config command.
  }
  win.gtag!("config", id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: pageLocation,
    page_title: page.title,
    page_referrer: previousPage,
  });
  win.gtag!("event", "page_view", {
    send_to: id,
    page_location: pageLocation,
    page_title: page.title,
    page_referrer: previousPage,
  });
  lastPath = pathname;
  previousPage = pageLocation;
  if (!document.getElementById("azuki-analytics")) {
    const script = document.createElement("script");
    script.id = "azuki-analytics";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(script);
  }
}
