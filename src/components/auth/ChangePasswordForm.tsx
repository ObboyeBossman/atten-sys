"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ChangePasswordForm({ portalPrefix }: { portalPrefix: string }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Supabase updateUser automatically changes the password for the logged-in user
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      // If successful, we must unset the must_change_password flag
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase.from("user_profiles") as any)
          .update({ must_change_password: false })
          .eq("id", user.id);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`${portalPrefix}/dashboard`);
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] mb-6 shadow-glow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Password Updated</h2>
        <p className="text-[var(--color-text-3)] mb-4">Redirecting you to the dashboard...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="p-4 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-sm flex items-start gap-3 border border-[var(--color-danger)]/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2" htmlFor="new-password">New Password</label>
        <input
          id="new-password"
          type="password"
          required
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          placeholder="Enter new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          minLength={8}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" htmlFor="confirm-password">Confirm Password</label>
        <input
          id="confirm-password"
          type="password"
          required
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          minLength={8}
        />
      </div>

      <button type="submit" className="btn btn-primary w-full py-3 mt-2" disabled={loading || !password || !confirmPassword}>
        {loading ? (
          <><span className="btn-loading mr-2 w-4 h-4 inline-block border-[var(--color-text)] opacity-50 rounded-full border-2" style={{borderTopColor: "transparent"}} /> Updating...</>
        ) : (
          "Update Password"
        )}
      </button>
    </form>
  );
}
