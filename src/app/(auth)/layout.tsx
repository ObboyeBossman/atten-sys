import type { Metadata } from "next";
import styles from "./auth.module.css";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to ATTEN-SYS attendance management portal.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.authRoot}>
      {/* Animated background blobs */}
      <div className={styles.blob} style={{ "--x": "20%", "--y": "15%", "--size": "600px", "--color": "rgba(239,68,68,0.12)" } as React.CSSProperties} />
      <div className={styles.blob} style={{ "--x": "75%", "--y": "70%", "--size": "500px", "--color": "rgba(59,130,246,0.12)" } as React.CSSProperties} />
      <div className={styles.blob} style={{ "--x": "50%", "--y": "45%", "--size": "400px", "--color": "rgba(239,68,68,0.06)" } as React.CSSProperties} />

      <div className={styles.authContainer}>
        <div className={styles.brandRow}>
          <div className={styles.brandIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <defs>
                <linearGradient id="brandGradAuth" x1="0" y1="0" x2="28" y2="28">
                  <stop stopColor="#ef4444" />
                  <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <rect width="28" height="28" rx="8" fill="url(#brandGradAuth)" />
              <path d="M7 10h14M7 14h10M7 18h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <circle cx="21" cy="18" r="4" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
              <path d="M19.5 18l1 1 2-2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className={styles.brandName}>ATTEN-SYS</span>
        </div>
        {children}
      </div>
    </div>
  );
}
