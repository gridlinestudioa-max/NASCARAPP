"use client";

import { useEffect, useState } from "react";
import styles from "./InstallAppCard.module.css";

// Not in lib.dom.d.ts — a non-standard Chromium/Android event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppCard() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // One-time read of client-only signals (matchMedia/userAgent don't
    // exist during SSR) right after mount — both start false on server
    // and first client render so there's nothing to mismatch, same
    // reasoning as AppearanceForm's colorMode read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari's own (non-standard) flag — not covered by the media query above.
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window));

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  }

  if (isStandalone) {
    return <p className={styles.status}>You&apos;re using the installed app. ✓</p>;
  }

  if (deferredPrompt) {
    return (
      <button type="button" className={styles.installButton} onClick={install} disabled={installing}>
        {installing ? "Installing…" : "Install app"}
      </button>
    );
  }

  if (isIOS) {
    return (
      <p className={styles.status}>
        Tap the Share button <span aria-hidden>⎋</span> in Safari, then &quot;Add to Home Screen&quot;.
      </p>
    );
  }

  return (
    <p className={styles.status}>
      Look for an install icon in your browser&apos;s address bar, or check its menu for &quot;Install app&quot; /
      &quot;Add to Home Screen&quot;.
    </p>
  );
}
