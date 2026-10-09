import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AzukiRoutes } from "./routes";
import "./styles.css";
import { CookieConsent } from "./components/CookieConsent";
import { PageAnalytics } from "./components/PageAnalytics";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter><PageAnalytics /><AzukiRoutes /><CookieConsent /></BrowserRouter>
  </React.StrictMode>,
);
