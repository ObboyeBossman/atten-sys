import type { Metadata } from "next";
import Image from "next/image";
import styles from "./auth.module.css";

export const metadata: Metadata = {
  title: "Sign In — ATTEN SYS",
  description: "Sign in to the ATTEN SYS attendance management portal.",
};

const currentYear = new Date().getFullYear();

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.authRoot}>

      {/* ── Mobile top bar (hidden on lg+) ─────────────────── */}
      <div className={styles.mobileBar}>
        <Image
          src="/ttu_logo.png"
          alt="TTU Logo"
          width={36}
          height={36}
          className={styles.mobileBarLogo}
        />
        <div>
          <span className={styles.mobileBarTitle}>Takoradi Technical University</span>
          <span className={styles.mobileBarSub}>ATTEN SYS</span>
        </div>
      </div>

      {/* ── Left hero panel (desktop only) ─────────────────── */}
      <section className={styles.heroPanel} aria-hidden="true">
        <div className={styles.heroBlob1} />
        <div className={styles.heroBlob2} />
        <div className={styles.heroGrid} />

        <div className={styles.heroContent}>
          {/* Brand identity */}
          <div className={styles.heroBrand}>
            <Image
              src="/ttu_logo.png"
              alt="TTU Logo"
              width={48}
              height={48}
              className={styles.heroBrandLogo}
            />
            <div>
              <span className={styles.heroBrandName}>TTU PORTALS</span>
              <span className={styles.heroBrandSub}>Takoradi Technical University</span>
            </div>
          </div>

          {/* Hero message */}
          <div>
            <div className={styles.heroPill}>
              <span className={styles.heroPillDot} />
              TTU Live Tracking Active
            </div>
            <h1 className={styles.heroHeadline}>
              Every seat.<br />
              Every session.<br />
              <span className={styles.heroHeadlineAccent}>Accounted for.</span>
            </h1>
            <p className={styles.heroBody}>
              Secured, real-time class attendance validation. Seamlessly checking
              academic progression paths across every lecture hall at Takoradi
              Technical University.
            </p>
          </div>

          {/* Footer */}
          <div className={styles.heroFooter}>
            <span>Active Academic Season: {currentYear}/{currentYear + 1}</span>
            <span className={styles.heroFooterDot} />
            <span>TTU Main Campus</span>
          </div>
        </div>
      </section>

      {/* ── Right form panel ───────────────────────────────── */}
      <section
        className={styles.formPanel}
        style={{ backgroundImage: "url('/background.png')" }}
      >
        <div className={styles.formPanelOverlay} />
        <div className={styles.formPanelGlow} />
        <div className={styles.formWrap}>
          {children}
        </div>
      </section>

    </div>
  );
}
