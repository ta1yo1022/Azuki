import React from "react";
import { PageMetadata } from "./components/PageMetadata";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AzukiRoutes } from "./routes";
import "./styles.css";
import { CookieConsent } from "./components/CookieConsent";
import { PageAnalytics } from "./components/PageAnalytics";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter><PageAnalytics /><AzukiRoutes /><PageMetadata /><CookieConsent /></BrowserRouter>
  </React.StrictMode>,
);
