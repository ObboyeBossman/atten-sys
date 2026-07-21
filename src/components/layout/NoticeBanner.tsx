"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./NoticeBanner.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type BannerKind = "offline" | "notifications" | "pwa";

interface Banner {
  kind: BannerKind;
  icon: React.ReactNode;
  message: string;
  action?: { label: string; onClick: () => void };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function OfflineIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="1" y1="1" x2="19" y2="19" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="10" cy="20" r="1" />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="1" y1="1" x2="19" y2="19" />
      <path d="M13.73 9A7.06 7.06 0 0 1 10 3a6 6 0 0 0-6 6v3l-2 4h12" />
      <path d="M8.27 16A2 2 0 0 0 12 16" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
}

// ─── Session-storage helpers ──────────────────────────────────────────────────

const DISMISSED_KEY = "atten-sys:banners-dismissed";

function getDismissed(): Set<BannerKind> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw) as BannerKind[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<BannerKind>) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // sessionStorage unavailable — silent fail
  }
}

// ─── BeforeInstallPromptEvent ─────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NoticeBanner() {
  const [dismissed, setDismissed] = useState<Set<BannerKind>>(new Set());
  const [isOffline, setIsOffline] = useState(false);
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPwaInstallable, setIsPwaInstallable] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate dismissed set from sessionStorage after mount
  useEffect(() => {
    setDismissed(getDismissed());
    setMounted(true);
  }, []);

  // Offline detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => setIsOffline(!navigator.onLine);
    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Notification permission detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    const check = () => {
      setNotifBlocked(Notification.permission === "denied");
    };
    check();

    // Re-check on visibility change (user may have changed browser settings)
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  // PWA install prompt capture
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already running as installed PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsPwaInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = useCallback((kind: BannerKind) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(kind);
      saveDismissed(next);
      return next;
    });
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsPwaInstallable(false);
      dismiss("pwa");
    }
    setDeferredPrompt(null);
  }, [deferredPrompt, dismiss]);

  const handleEnableNotifications = useCallback(async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    if (result !== "denied") {
      dismiss("notifications");
    }
  }, [dismiss]);

  if (!mounted) return null;

  // Build ordered banner list — offline is always highest priority
  const banners: Banner[] = [];

  if (isOffline && !dismissed.has("offline")) {
    banners.push({
      kind: "offline",
      icon: <OfflineIcon />,
      message: "You're offline. Some features won't work until you reconnect.",
    });
  }

  if (notifBlocked && !dismissed.has("notifications")) {
    banners.push({
      kind: "notifications",
      icon: <BellOffIcon />,
      message: "Notifications are blocked. Enable them to get session alerts.",
      action: { label: "Enable", onClick: handleEnableNotifications },
    });
  }

  if (isPwaInstallable && !dismissed.has("pwa")) {
    banners.push({
      kind: "pwa",
      icon: <DownloadIcon />,
      message: "Install ATTEN-SYS for faster access and offline support.",
      action: { label: "Install app", onClick: handleInstall },
    });
  }

  if (banners.length === 0) return null;

  return (
    <div className={styles.stack} role="status" aria-live="polite" aria-label="System notices">
      {banners.map((banner, i) => (
        <div
          key={banner.kind}
          className={`${styles.banner} ${styles[`kind_${banner.kind}`]}`}
          style={{ "--stagger-index": i } as React.CSSProperties}
          role="alert"
        >
          <span className={styles.bannerIcon}>{banner.icon}</span>
          <span className={styles.bannerMessage}>{banner.message}</span>
          {banner.action && (
            <button
              className={styles.bannerAction}
              onClick={banner.action.onClick}
              type="button"
            >
              {banner.action.label}
            </button>
          )}
          <button
            className={styles.bannerClose}
            onClick={() => dismiss(banner.kind)}
            aria-label={`Dismiss ${banner.kind} notice`}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
