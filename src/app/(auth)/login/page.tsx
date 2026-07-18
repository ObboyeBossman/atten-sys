"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "../auth.module.css";
import type { Metadata } from "next";

// Note: metadata must be exported from a Server Component.
// Move to a parent server component or a separate file if needed.

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      // Read user profile to determine which portal to go to
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Authentication failed. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role, is_active, must_change_password")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        setError("Could not load your account. Please contact support.");
        return;
      }

      if (!profile.is_active && profile.role !== "student") {
        await supabase.auth.signOut();
        setError("Your account has been deactivated. Contact the administrator.");
        return;
      }

      // Role-based redirect — middleware will enforce change-password if needed
      const portalMap: Record<string, string> = {
        super_admin: "/admin/dashboard",
        lecturer: "/lecturer/dashboard",
        student: "/student/dashboard",
      };

      const destination = portalMap[profile.role] ?? "/login";
      router.replace(destination);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.authCard}>
      <h1 className={styles.authTitle}>Welcome back</h1>
      <p className={styles.authSubtitle}>
        Sign in with your institutional email and password
      </p>

      <form className={styles.form} onSubmit={handleLogin} noValidate>
        {error && (
          <div className={styles.errorMsg} role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 11a1 1 0 110-2 1 1 0 010 2zm.75-4.75a.75.75 0 01-1.5 0V5.25a.75.75 0 011.5 0v2z" />
            </svg>
            {error}
          </div>
        )}

        <div className={styles.inputGroup}>
          <label htmlFor="email" className={styles.label}>
            Email address
          </label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="3" width="14" height="10" rx="2" />
                <path d="M1 5.5l7 4.5 7-4.5" />
              </svg>
            </span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`input ${styles.inputWithIcon}`}
              placeholder="you@institution.edu.gh"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="7" width="12" height="8" rx="1.5" />
                <path d="M4.5 7V5a3.5 3.5 0 017 0v2" />
              </svg>
            </span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`input ${styles.inputWithIcon}`}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              disabled={loading}
              style={{ paddingRight: "2.75rem" }}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                  <circle cx="8" cy="8" r="2" />
                  <path d="M3 3l10 10" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                  <circle cx="8" cy="8" r="2" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          id="login-submit-btn"
          type="submit"
          className={styles.submitBtn}
          disabled={loading || !email || !password}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className={styles.footer}>
        Having trouble? Contact your system administrator.
      </p>
    </div>
  );
}
