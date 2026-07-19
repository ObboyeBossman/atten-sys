"use client";

import { useState, useTransition } from "react";
import { updateAdminName, changeAdminPassword } from "./actions";
import styles from "./profile.module.css";

interface ProfileClientProps {
  name: string;
  email: string;
  createdAt: string;
}

/* ── Inline SVG icons ────────────────────────────────────── */
function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="6" r="4" />
      <path d="M2 19c0-4.42 3.58-8 8-8s8 3.58 8 8" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="9" width="12" height="9" rx="2" />
      <path d="M7 9V6a3 3 0 016 0v3" />
      <circle cx="10" cy="14" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="16" height="12" rx="2" />
      <path d="M2 7l8 5 8-5" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="16" height="14" rx="2" />
      <path d="M2 9h16M7 2v4M13 2v4" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10l5 5L17 4" />
    </svg>
  );
}

function IconEye({ off }: { off?: boolean }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.87 13.87A8.26 8.26 0 0110 15C5.58 15 2 10 2 10a14.43 14.43 0 013.13-3.87M8.53 5.17A8.45 8.45 0 0110 5c4.42 0 8 5 8 5a14.55 14.55 0 01-2.16 2.84M2 2l16 16" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10s3.58-5 8-5 8 5 8 5-3.58 5-8 5-8-5-8-5z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

/* ── Feedback banner ─────────────────────────────────────── */
function Feedback({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div className={`${styles.feedback} ${type === "success" ? styles.feedbackSuccess : styles.feedbackError}`}>
      {type === "success" && <IconCheck />}
      <span>{message}</span>
    </div>
  );
}

/* ── Password input with toggle ──────────────────────────── */
function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-group">
      <label className="label" htmlFor={id}>{label}</label>
      <div className={styles.passwordWrapper}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`input ${styles.passwordInput}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="new-password"
        />
        <button
          type="button"
          className={styles.eyeBtn}
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <IconEye off={visible} />
        </button>
      </div>
    </div>
  );
}

/* ── Name form ───────────────────────────────────────────── */
/* ── Password form ───────────────────────────────────────── */
function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isStrong = next.length >= 8;
  const matchOk = next === confirm && confirm.length > 0;

  function handleSubmit() {
    setResult(null);
    startTransition(async () => {
      const res = await changeAdminPassword(current, next, confirm);
      if ("success" in res) {
        setResult({ type: "success", message: "Password changed successfully." });
        setCurrent(""); setNext(""); setConfirm("");
      } else {
        setResult({ type: "error", message: res.error });
      }
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}><IconLock /></span>
        <div>
          <h2 className={styles.sectionTitle}>Change Password</h2>
          <p className={styles.sectionDesc}>Keep your account secure</p>
        </div>
      </div>

      <div className={styles.sectionBody}>
        <PasswordInput
          id="current-pw"
          label="Current Password"
          value={current}
          onChange={(v) => { setCurrent(v); setResult(null); }}
          placeholder="Enter current password"
          disabled={isPending}
        />

        <PasswordInput
          id="new-pw"
          label="New Password"
          value={next}
          onChange={(v) => { setNext(v); setResult(null); }}
          placeholder="Minimum 8 characters"
          disabled={isPending}
        />

        {/* Strength indicator */}
        {next.length > 0 && (
          <div className={styles.strengthRow}>
            <div className={styles.strengthBar}>
              <div
                className={styles.strengthFill}
                style={{
                  width: `${Math.min(100, (next.length / 16) * 100)}%`,
                  background: next.length < 8
                    ? "var(--color-danger)"
                    : next.length < 12
                    ? "var(--color-warning)"
                    : "var(--color-success)",
                }}
              />
            </div>
            <span
              className={styles.strengthLabel}
              style={{
                color: next.length < 8
                  ? "var(--color-danger)"
                  : next.length < 12
                  ? "var(--color-warning)"
                  : "var(--color-success)",
              }}
            >
              {next.length < 8 ? "Too short" : next.length < 12 ? "Good" : "Strong"}
            </span>
          </div>
        )}

        <PasswordInput
          id="confirm-pw"
          label="Confirm New Password"
          value={confirm}
          onChange={(v) => { setConfirm(v); setResult(null); }}
          placeholder="Re-enter new password"
          disabled={isPending}
        />

        {/* Match indicator */}
        {confirm.length > 0 && (
          <p className={styles.matchHint} style={{ color: matchOk ? "var(--color-success)" : "var(--color-danger)" }}>
            {matchOk ? "✓ Passwords match" : "✗ Passwords do not match"}
          </p>
        )}

        {result && <Feedback type={result.type} message={result.message} />}

        <div className={styles.formActions}>
          <button
            className={`btn btn-primary ${isPending ? "btn-loading" : ""}`}
            onClick={handleSubmit}
            disabled={isPending || !current || !isStrong || !matchOk}
          >
            {!isPending && "Change Password"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── Root export ─────────────────────────────────────────── */
export function ProfileClient({ name, email, createdAt }: ProfileClientProps) {
  const joinedDate = new Date(createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className={styles.root}>
      {/* Avatar / identity card */}
      <div className={styles.identityCard}>
        <div className={styles.avatar}>
          <span>{name.charAt(0).toUpperCase()}</span>
        </div>
        <div className={styles.identityInfo}>
          <p className={styles.identityName}>{name}</p>
          <p className={styles.identityRole}>Super Admin</p>
          <div className={styles.identityMeta}>
            <span className={styles.metaItem}>
              <IconMail />
              {email}
            </span>
            <span className={styles.metaItem}>
              <IconCalendar />
              Member since {joinedDate}
            </span>
          </div>
        </div>
      </div>

      {/* Forms */}
      <div className={styles.forms}>
        <NameFormWithEmail initialName={name} email={email} />
        <PasswordForm />
      </div>
    </div>
  );
}

/* Name form extended to show email inside it */
function NameFormWithEmail({ initialName, email }: { initialName: string; email: string }) {
  const [name, setName] = useState(initialName);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDirty = name.trim() !== initialName;

  function handleSubmit() {
    setResult(null);
    startTransition(async () => {
      const res = await updateAdminName(name);
      if ("success" in res) {
        setResult({ type: "success", message: "Name updated successfully." });
      } else {
        setResult({ type: "error", message: res.error });
      }
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}><IconUser /></span>
        <div>
          <h2 className={styles.sectionTitle}>Account Information</h2>
          <p className={styles.sectionDesc}>Update your display name</p>
        </div>
      </div>

      <div className={styles.sectionBody}>
        {/* Read-only email */}
        <div className="input-group">
          <label className="label">Email Address</label>
          <div className={styles.readonlyField}>
            <span className={styles.readonlyIcon}><IconMail /></span>
            <span className={styles.readonlyValue}>{email}</span>
          </div>
        </div>

        <div className="input-group">
          <label className="label" htmlFor="admin-name">Display Name</label>
          <input
            id="admin-name"
            type="text"
            className="input"
            value={name}
            onChange={(e) => { setName(e.target.value); setResult(null); }}
            placeholder="Your full name"
            disabled={isPending}
            maxLength={100}
          />
        </div>

        {result && <Feedback type={result.type} message={result.message} />}

        <div className={styles.formActions}>
          <button
            className={`btn btn-primary ${isPending ? "btn-loading" : ""}`}
            onClick={handleSubmit}
            disabled={isPending || !isDirty || !name.trim()}
          >
            {!isPending && "Save Changes"}
          </button>
          {isDirty && !isPending && (
            <button
              className="btn btn-ghost"
              onClick={() => { setName(initialName); setResult(null); }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
