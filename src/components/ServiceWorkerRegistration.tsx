"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let disposed = false;

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (registration.active) {
          await registration.update();
        }
        await navigator.serviceWorker.ready;
        if (!disposed) {
          document.documentElement.dataset.offlineReady = "true";
        }
      } catch {
        if (!disposed) {
          delete document.documentElement.dataset.offlineReady;
        }
      }
    }

    void register();
    window.addEventListener("online", register);

    return () => {
      disposed = true;
      window.removeEventListener("online", register);
    };
  }, []);

  return null;
}
