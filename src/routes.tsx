import { AdminReports } from "./components/AdminReports";
import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LegalPage } from "./components/LegalPage";
import App from "./App";
import { CreateGuide } from "./components/CreateGuide";
import { PublicLibrary } from "./components/PublicLibrary";

function Home() {
  const { search } = useLocation();
  return new URLSearchParams(search).get("demo") === "1"
    ? <Navigate to="/demo" replace />
    : <App />;
}
function RouteScroll() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
function NotFound() {
  useEffect(() => { document.title = "ページが見つかりません — Azuki"; }, []);
  return <main className="full-loading">
    <h1>ページが見つかりません</h1>
    <p>URLを確認するか、ライブラリから開き直してください。</p>
    <Link className="button primary" to="/library">マイライブラリへ</Link>
    <Link className="text-button" to="/explore">公開単語帳を探す</Link>
  </main>;
}
export function AzukiRoutes() {
  const location = useLocation();
  if (location.pathname.length > 1 && location.pathname.endsWith("/")) {
    return <Navigate to={location.pathname.replace(/\/+$/, "") + location.search + location.hash} replace />;
  }
  return <>
      <RouteScroll />
      <Routes>
        <Route path="/" element={<Home />} />
        {["library", "demo"].flatMap((base) => ["", "/settings", "/import", "/decks/:deckId", "/decks/:deckId/study", "/decks/:deckId/share"].map((path) =>
          <Route key={base + path} path={`/${base}${path}`} element={<App key={base} demo={base === "demo"} />} />
        ))}
        <Route path="/guide/create" element={<CreateGuide />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/explore" element={<PublicLibrary />} />
        <Route path="/shared/:deckId" element={<PublicLibrary />} />
        <Route path="/shared/:deckId/study" element={<PublicLibrary study />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
  </>;
}
