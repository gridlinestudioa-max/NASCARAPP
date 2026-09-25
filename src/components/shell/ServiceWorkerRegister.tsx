"use client";

import { useEffect } from "react";

// Renders nothing — just registers public/sw.js once the page has loaded,
// so it never competes with real work for the main thread on first paint.
// Mounted once in the root layout so it runs on every route, logged in or
// not (the service worker only caches static/public assets, never
// authenticated HTML, so there's no per-user data to leak between users
// on a shared device).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Best-effort — a failed registration just means no offline/
        // install polish this visit, not a broken app.
      });
    };
    // This effect can run after the window's own 'load' event already
    // fired (hydration frequently lands after it) — in that case the
    // listener below would never call register() at all. readyState
    // "complete" means load has already happened, so register right away.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
