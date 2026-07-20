"use client";

import { useState, useTransition } from "react";
import {
  updateLecturerName,
  updateLecturerPhone,
  changeLecturerPassword,
} from "./actions";

interface Props {
  name: string;
  email: string;
  staffId: string;
  phone: string | null;
  createdAt: string;
}

/* ── Icons ───────────────────────────────────────────────── */
function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="6" r="4" /><path d="M2 19c0-4.42 3.58-8 8-8s8 3.58 8 8" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2h4l2 4.5-2.5 1.5A10 10 0 0012.5 13.5l1.5-2.5L18 13v4a1 1 0 01-1 1A15 15 0 014 3a1 1 0 011-1z" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="9" width="12" height="9" rx="2" /><path d="M7 9V6a3 3 0 016 0v3" />
      <circle cx="10" cy="14" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10l5 5L17 4" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3L2 17h16L10 3z" /><path d="M10 10v3M10 15h.01" />
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

/* ── Shared UI pieces ────────────────────────────────────── */
function Feedback({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-base)",
        background: type === "success" ? "var(--color-success-bg, rgba(34,197,94,0.08))" : "var(--color-danger-bg)",
        border: `1px solid ${type === "success" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        color: type === "success" ? "var(--color-success)" : "var(--color-danger)",
        marginTop: "var(--space-3)",
      }}
    >
      {type === "success" ? <IconCheck /> : <IconAlert />}
      <span>{message}</span>
    </div>
  );
}

function PasswordInput({
  id, label, value, onChange, placeholder, disabled,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-group">
      <label className="label" htmlFor={id}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="new-password"
          style={{ paddingRight: "44px" }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          style={{
            position: "absolute", right: 0, top: 0, bottom: 0,
            width: 44, display: "flex", alignItems: "center", justifyContent: "center",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-3)", borderRadius: "0 var(--radius-base) var(--radius-base) 0",
          }}
        >
          <IconEye off={visible} />
        </button>
      </div>
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────────────── */
function Section({
  icon, title, desc, children,
}: {
  icon: React.ReactNode; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: "var(--space-6)" }}>
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: "var(--space-4)",
          paddingBottom: "var(--space-5)", marginBottom: "var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            width: 40, height: 40, borderRadius: "var(--radius-lg)",
            background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--color-primary)", flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--color-text)", marginBottom: 2 }}>
            {title}
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)" }}>{desc}</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {children}
      </div>
    </div>
  );
}

/* ── Name section ────────────────────────────────────────── */
function NameSection({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = name.trim() !== initialName;

  function handleSave() {
    setResult(null);
    startTransition(async () => {
      const res = await updateLecturerName(name);
      if ("success" in res) {
        setResult({ type: "success", message: "Name updated successfully." });
      } else {
        setResult({ type: "error", message: res.error });
      }
    });
  }

  return (
    <Section icon={<IconUser />} title="Display Name" desc="Your name as it appears on sessions and reports">
      <div className="input-group">
        <label className="label" htmlFor="disp-name">Full name</label>
        <input
          id="disp-name"
          className="input"
          value={name}
          onChange={(e) => { setName(e.target.value); setResult(null); }}
          placeholder="Your full name"
          disabled={isPending}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={!dirty || isPending}
        >
          {isPending ? "Saving…" : "Save Name"}
        </button>
      </div>
      {result && <Feedback type={result.type} message={result.message} />}
    </Section>
  );
}

/* ── Phone section ───────────────────────────────────────── */
function PhoneSection({ initialPhone }: { initialPhone: string | null }) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = phone.trim() !== (initialPhone ?? "");

  function handleSave() {
    setResult(null);
    startTransition(async () => {
      const res = await updateLecturerPhone(phone);
      if ("success" in res) {
        setResult({ type: "success", message: "Phone number updated." });
      } else {
        setResult({ type: "error", message: res.error });
      }
    });
  }

  return (
    <Section icon={<IconPhone />} title="Phone Number" desc="Your contact number for admin use">
      <div className="input-group">
        <label className="label" htmlFor="phone-num">Phone</label>
        <input
          id="phone-num"
          className="input"
          type="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setResult(null); }}
          placeholder="e.g. +233 24 000 0000"
          disabled={isPending}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={!dirty || isPending}
        >
          {isPending ? "Saving…" : "Save Phone"}
        </button>
      </div>
      {result && <Feedback type={result.type} message={result.message} />}
    </Section>
  );
}

/* ── Password section ────────────────────────────────────── */
function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const pwStrength = next.length === 0 ? 0 : next.length < 8 ? 1 : next.length < 12 ? 2 : 3;
  const pwStrengthColor = ["transparent", "var(--color-danger)", "var(--color-warning)", "var(--color-success)"][pwStrength];
  const pwStrengthLabel = ["", "Too short", "Moderate", "Strong"][pwStrength];
  const matchOk = next.length > 0 && next === confirm;

  function handleSubmit() {
    setResult(null);
    startTransition(async () => {
      const res = await changeLecturerPassword(current, next, confirm);
      if ("success" in res) {
        setResult({ type: "success", message: "Password changed successfully." });
        setCurrent(""); setNext(""); setConfirm("");
      } else {
        setResult({ type: "error", message: res.error });
      }
    });
  }

  return (
    <Section icon={<IconLock />} title="Change Password" desc="Keep your account secure with a strong password">
      <PasswordInput
        id="cur-pw" label="Current Password" value={current}
        onChange={(v) => { setCurrent(v); setResult(null); }}
        placeholder="Enter current password" disabled={isPending}
      />
      <div>
        <PasswordInput
          id="new-pw" label="New Password" value={next}
          onChange={(v) => { setNext(v); setResult(null); }}
          placeholder="Minimum 8 characters" disabled={isPending}
        />
        {next.length > 0 && (
          <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{ flex: 1, height: 4, background: "var(--color-surface-2)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "var(--radius-full)",
                width: `${(pwStrength / 3) * 100}%`,
                background: pwStrengthColor,
                transition: "width 0.3s ease, background 0.3s ease",
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: pwStrengthColor, minWidth: 52, textAlign: "right" }}>
              {pwStrengthLabel}
            </span>
          </div>
        )}
      </div>
      <div>
        <PasswordInput
          id="conf-pw" label="Confirm New Password" value={confirm}
          onChange={(v) => { setConfirm(v); setResult(null); }}
          placeholder="Repeat new password" disabled={isPending}
        />
        {confirm.length > 0 && (
          <p style={{
            marginTop: "var(--space-1)", fontSize: "var(--text-xs)", fontWeight: 600,
            color: matchOk ? "var(--color-success)" : "var(--color-danger)",
          }}>
            {matchOk ? "✓ Passwords match" : "✗ Passwords do not match"}
          </p>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSubmit}
          disabled={!current || !next || !matchOk || pwStrength < 2 || isPending}
        >
          {isPending ? "Changing…" : "Change Password"}
        </button>
      </div>
      {result && <Feedback type={result.type} message={result.message} />}
    </Section>
  );
}

/* ── Root export ─────────────────────────────────────────── */
export function ProfileClient({ name, email, staffId, phone, createdAt }: Props) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const joined = new Date(createdAt).toLocaleDateString("en-GH", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 680 }}>
      {/* Identity card */}
      <div
        className="card"
        style={{
          display: "flex", alignItems: "center", gap: "var(--space-6)",
          padding: "var(--space-6)", flexWrap: "wrap",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            flexShrink: 0, width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "var(--text-2xl)", fontWeight: 800, color: "#fff",
            boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
          }}
        >
          {initials}
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-1)" }}>
            {name}
          </div>
          <div
            style={{
              display: "inline-block", fontSize: "var(--text-xs)", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "#6366f1", background: "rgba(99,102,241,0.1)",
              padding: "2px 10px", borderRadius: "var(--radius-full)",
              border: "1px solid rgba(99,102,241,0.25)", marginBottom: "var(--space-3)",
            }}
          >
            Lecturer
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="16" height="12" rx="2" /><path d="M2 7l8 5 8-5" /></svg>
              {email}
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M8 3v14M3 8h14" /></svg>
              Staff ID: <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-2)" }}>{staffId}</span>
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="16" height="14" rx="2" /><path d="M2 9h16M7 2v4M13 2v4" /></svg>
              Joined {joined}
            </div>
          </div>
        </div>
      </div>

      <NameSection initialName={name} />
      <PhoneSection initialPhone={phone} />
      <PasswordSection />
    </div>
  );
}
