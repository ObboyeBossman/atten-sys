"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "../auth.module.css";

/* ─────────────────────────────────────────────────────────
   Alert banner (replaces PHP $error / $success flash)
───────────────────────────────────────────────────────── */
type AlertType = "error" | "success";

function AlertBanner({
  show,
  type,
  message,
  onClose,
}: {
  show: boolean;
  type: AlertType;
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`${styles.alertBanner} ${show ? styles.show : ""}`}
    >
      <div className={`${styles.alertIconWrap} ${styles[type]}`}>
        {type === "success" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className={styles.alertTitle}>
          {type === "success" ? "System Update" : "System Notification"}
        </p>
        <p className={styles.alertMsg}>{message}</p>
      </div>
      <button
        type="button"
        className={styles.alertClose}
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Contact support modal (bottom sheet on mobile, centred on desktop)
───────────────────────────────────────────────────────── */
function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Trap focus & close on Escape
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <div
      className={`${styles.modalOverlay} ${open ? styles.open : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
      aria-label="Technical Support"
    >
      <div className={styles.modalBox} ref={ref}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Technical Support</h3>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close modal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className={styles.modalDesc}>
          For login issues or credential recovery, contact the TTU ICT Helpdesk.
        </p>

        {/* Anthony Maclean */}
        <div className={styles.contactSection}>
          <p className={styles.contactName}>Anthony Maclean</p>
          <div className={styles.contactLinks}>
            <a href="mailto:anthonymaclean100@gmail.com" className={styles.contactLink}>
              <span className={`${styles.contactLinkIcon} ${styles.email}`} aria-hidden="true">✉</span>
              <span className={styles.contactLinkText}>anthonymaclean100@gmail.com</span>
            </a>
            <a href="tel:+233209795146" className={styles.contactLink}>
              <span className={`${styles.contactLinkIcon} ${styles.phone}`} aria-hidden="true">📞</span>
              <span className={styles.contactLinkText}>+233 20 979 5146</span>
            </a>
            <a href="https://wa.me/233209795146" target="_blank" rel="noopener noreferrer" className={styles.contactLink}>
              <span className={`${styles.contactLinkIcon} ${styles.whatsapp}`} aria-hidden="true">💬</span>
              <span className={styles.contactLinkText}>+233 20 979 5146 (WhatsApp)</span>
            </a>
          </div>
        </div>

        {/* Obboye Bossman */}
        <div className={styles.contactSection}>
          <p className={styles.contactName}>Obboye Bossman</p>
          <div className={styles.contactLinks}>
            <a href="mailto:obboyebossman@gmail.com" className={styles.contactLink}>
              <span className={`${styles.contactLinkIcon} ${styles.email}`} aria-hidden="true">✉</span>
              <span className={styles.contactLinkText}>obboyebossman@gmail.com</span>
            </a>
            <a href="tel:+233529352950" className={styles.contactLink}>
              <span className={`${styles.contactLinkIcon} ${styles.phone}`} aria-hidden="true">📞</span>
              <span className={styles.contactLinkText}>+233 52 935 2950</span>
            </a>
            <a href="https://wa.me/233529352950" target="_blank" rel="noopener noreferrer" className={styles.contactLink}>
              <span className={`${styles.contactLinkIcon} ${styles.whatsapp}`} aria-hidden="true">💬</span>
              <span className={styles.contactLinkText}>+233 52 935 2950 (WhatsApp)</span>
            </a>
          </div>
        </div>

        <button type="button" className={styles.modalCloseBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Login page
───────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [destLabel, setDestLabel] = useState("Loading your portal…");

  // Alert banner state
  const [alert, setAlert] = useState<{ show: boolean; type: AlertType; message: string }>({
    show: false,
    type: "error",
    message: "",
  });
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contact modal
  const [contactOpen, setContactOpen] = useState(false);

  function showAlert(message: string, type: AlertType = "error") {
    if (alertTimer.current) clearTimeout(alertTimer.current);
    setAlert({ show: true, type, message });
    alertTimer.current = setTimeout(() => {
      setAlert((a) => ({ ...a, show: false }));
    }, 4000);
  }

  function hideAlert() {
    if (alertTimer.current) clearTimeout(alertTimer.current);
    setAlert((a) => ({ ...a, show: false }));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    // ── 1. Show the overlay immediately — guaranteed to appear ──────
    // The user sees the loading screen from this point on, no matter
    // how fast or slow the network is.
    setTransitioning(true);
    setDestLabel("Verifying credentials…");

    // Record when the overlay appeared so we can enforce the minimum
    // visible duration regardless of how quickly auth resolves.
    const overlayStart = Date.now();
    const MIN_OVERLAY_MS = 1500;

    // Helper: waits for the remainder of the minimum display time.
    const waitMinimum = () => {
      const elapsed = Date.now() - overlayStart;
      const remaining = MIN_OVERLAY_MS - elapsed;
      return remaining > 0
        ? new Promise<void>((res) => setTimeout(res, remaining))
        : Promise.resolve();
    };

    try {
      // ── 2. Auth work runs behind the overlay ────────────────────
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        await waitMinimum();
        // Dismiss overlay, show error toast, return to login form.
        setTransitioning(false);
        const msg = "Invalid email or password. Please try again.";
        setError(msg);
        showAlert(msg, "error");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        await waitMinimum();
        setTransitioning(false);
        const msg = "Authentication failed. Please try again.";
        setError(msg);
        showAlert(msg, "error");
        return;
      }

      setDestLabel("Loading your profile…");

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role, is_active, must_change_password")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        await waitMinimum();
        setTransitioning(false);
        const msg = "Could not load your account. Please contact support.";
        setError(msg);
        showAlert(msg, "error");
        return;
      }

      const p = profile as { role: string; is_active: boolean; must_change_password: boolean };

      if (!p.is_active && p.role !== "student") {
        await supabase.auth.signOut();
        await waitMinimum();
        setTransitioning(false);
        const msg = "Your account has been deactivated. Contact the administrator.";
        setError(msg);
        showAlert(msg, "error");
        return;
      }

      const portalMap: Record<string, string> = {
        super_admin: "/admin/dashboard",
        lecturer: "/lecturer/dashboard",
        student: "/student/dashboard",
      };

      const labelMap: Record<string, string> = {
        super_admin: "Opening Admin Portal…",
        lecturer: "Opening Lecturer Portal…",
        student: "Opening Student Portal…",
      };

      let destination = portalMap[p.role] ?? "/login";
      let label = labelMap[p.role] ?? "Loading your portal…";

      // Reps share the 'student' role — check if they're an active course rep
      // and route them to the rep portal instead.
      if (p.role === "student") {
        setDestLabel("Checking access level…");
        const { data: repMembership } = await supabase
          .from("group_memberships")
          .select("id")
          .eq("student_id", user.id)
          .eq("is_course_rep", true)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (repMembership) {
          destination = "/rep/dashboard";
          label = "Opening Class Rep Portal…";
        }
      }

      // ── 3. Force password change if flagged ────────────────────────
      // This applies to all roles. The destination is preserved in a
      // query param so the change-password page can redirect correctly.
      if (p.must_change_password) {
        const encodedNext = encodeURIComponent(destination);
        destination = `/change-password?next=${encodedNext}`;
        label = "Password change required…";
      }

      // ── 4. Ensure overlay has been visible for at least MIN_OVERLAY_MS ──
      await waitMinimum();

      setDestLabel(label);

      // Route — overlay stays on screen until the new page renders.
      router.replace(destination);

    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── Post-auth transition overlay ──────────────────── */}
      <div
        className={`${styles.transitionOverlay} ${transitioning ? styles.visible : ""}`}
        role="status"
        aria-live="polite"
        aria-label="Authentication successful, redirecting"
      >
        {/* Spinning logo ring */}
        <div className={styles.transitionLogoRing}>
          <Image
            src="/atten_sys_icon_logo.svg"
            alt=""
            width={48}
            height={48}
            className={styles.transitionLogo}
            aria-hidden="true"
          />
        </div>

        {/* Notification card — same visual language as AlertBanner */}
        <div className={styles.transitionCard}>
          <span className={styles.transitionCardIcon} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div className={styles.transitionCardBody}>
            <p className={styles.transitionCardTitle}>{destLabel}</p>
            <p className={styles.transitionCardMsg}>
              Please wait while we prepare your portal.
            </p>
          </div>
        </div>

        {/* Indeterminate progress bar */}
        <div className={styles.transitionProgress} aria-hidden="true">
          <div className={styles.transitionProgressBar} />
        </div>
      </div>

      {/* Alert banner */}
      <AlertBanner
        show={alert.show}
        type={alert.type}
        message={alert.message}
        onClose={hideAlert}
      />

      {/* Contact modal */}
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />

      {/* Login card */}
      <div className={styles.formCard}>

        {/* Logo */}
        <div className={styles.logoBox}>
          <Image
            src="/atten_sys_icon_logo.svg"
            alt="ATTEN SYS Logo"
            width={64}
            height={64}
            className={styles.logoImg}
            priority
          />
        </div>

        {/* Heading */}
        <span className={styles.formHeadingEyebrow}>ATTEN SYS</span>
        <h2 className={styles.formHeadingTitle}>Institutional Portal</h2>
        <p className={styles.formHeadingSub}>Sign in with your institutional credentials</p>

        {/* Form */}
        <form className={styles.formBody} onSubmit={handleLogin} noValidate>

          {/* Inline error */}
          {error && (
            <div className={styles.errorMsg} role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {error}
            </div>
          )}

          {/* Email */}
          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.fieldLabel}>
              Institutional Email
            </label>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldIcon} aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="eg. boateng@ttu.edu.gh"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.fieldInput}
                disabled={loading}
                inputMode="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className={styles.fieldGroup}>
            <label htmlFor="password" className={styles.fieldLabel}>
              Password
            </label>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldIcon} aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${styles.fieldInput} ${styles.fieldInputPassword}`}
                disabled={loading}
              />
              <button
                type="button"
                className={styles.pwToggle}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="m1 1 22 22" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div className={styles.rememberRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span className={styles.checkboxBox} aria-hidden="true">
                {remember && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span className={styles.checkboxText}>Keep session active</span>
            </label>
            <a href="?forgot_password=1" className={styles.forgotLink}>
              Forgot?
            </a>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || !email || !password}
          >
            {loading ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Authenticating…
              </>
            ) : (
              "Enter"
            )}
          </button>
        </form>

        <hr className={styles.divider} />

        {/* Footer links */}
        <div className={styles.footerLinks}>
          <button
            type="button"
            className={styles.footerLink}
            onClick={() =>
              showAlert(
                "Utilize your formal institutional student or faculty login credentials to sign in. Security scans monitor GPS check-in nodes. Contact the systems administrator if your password has lapsed.",
                "success"
              )
            }
          >
            Access Guidelines
          </button>
          <span className={styles.footerSep} aria-hidden="true">|</span>
          <button
            type="button"
            className={styles.footerLink}
            onClick={() => setContactOpen(true)}
          >
            Technical Support
          </button>
        </div>
      </div>
    </>
  );
}
