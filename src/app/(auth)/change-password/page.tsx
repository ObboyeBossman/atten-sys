"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "../auth.module.css";

function ChangePasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();
  const nextUrl = searchParams.get("next") ?? null;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setLoading(true);

    try {
      // Re-authenticate to verify current password
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError("Session expired. Please sign in again.");
        router.replace("/login");
        return;
      }

      const { error: reAuthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (reAuthError) {
        setError("Current password is incorrect.");
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message ?? "Failed to update password.");
        return;
      }

      // Clear must_change_password flag
      await (supabase.from("user_profiles") as any)
        .update({ must_change_password: false })
        .eq("id", user.id);

      // Redirect: honour the ?next param if present (handles rep portal),
      // otherwise fall back to role-based routing.
      if (nextUrl) {
        router.replace(nextUrl);
        router.refresh();
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = (profile as any)?.role ?? "";

      // Students who are course reps need special handling — check membership.
      if (role === "student") {
        const { data: repMembership } = await supabase
          .from("group_memberships")
          .select("id")
          .eq("student_id", user.id)
          .eq("is_course_rep", true)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (repMembership) {
          router.replace("/rep/dashboard");
          router.refresh();
          return;
        }
      }

      const roleMap: Record<string, string> = {
        super_admin: "/admin/dashboard",
        lecturer: "/lecturer/dashboard",
        student: "/student/dashboard",
      };

      router.replace(roleMap[role] ?? "/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.authCard}>
      <h1 className={styles.authTitle}>Set a new password</h1>
      <p className={styles.authSubtitle}>
        You must change your password before continuing.
      </p>

      <form className={styles.form} onSubmit={handleChangePassword} noValidate>
        {error && (
          <div className={styles.errorMsg} role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 11a1 1 0 110-2 1 1 0 010 2zm.75-4.75a.75.75 0 01-1.5 0V5.25a.75.75 0 011.5 0v2z" />
            </svg>
            {error}
          </div>
        )}

        <div className={styles.inputGroup}>
          <label htmlFor="current-password" className={styles.label}>
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input"
            placeholder="Your current password"
            autoComplete="current-password"
            required
            disabled={loading}
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="new-password" className={styles.label}>
            New password
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="new-password"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              disabled={loading}
              style={{ paddingRight: "2.75rem" }}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowNew((v) => !v)}
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                <circle cx="8" cy="8" r="2" />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="confirm-password" className={styles.label}>
            Confirm new password
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`input ${confirmPassword && confirmPassword !== newPassword ? "input-error" : ""}`}
              placeholder="Repeat your new password"
              autoComplete="new-password"
              required
              disabled={loading}
              style={{ paddingRight: "2.75rem" }}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                <circle cx="8" cy="8" r="2" />
              </svg>
            </button>
          </div>
        </div>

        <button
          id="change-password-submit-btn"
          type="submit"
          className={styles.submitBtn}
          disabled={loading || !currentPassword || !newPassword || !confirmPassword}
        >
          {loading ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}


export default function ChangePasswordPage() {
  return (
    <Suspense>
      <ChangePasswordInner />
    </Suspense>
  );
}
