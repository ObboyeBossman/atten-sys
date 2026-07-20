"use client";

import { useState, useTransition } from "react";
import { updateProfile, changePassword } from "./actions";

type Props = {
  name: string;
  email: string;
  staffId: string;
  phone: string | null;
};

function InputField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          color: "var(--color-text-3)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: "var(--space-2)",
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "var(--space-3) var(--space-4)",
          borderRadius: "var(--radius-base)",
          border: readOnly
            ? "1px solid var(--color-border)"
            : focused
            ? "2px solid var(--color-primary)"
            : "1px solid var(--color-border)",
          background: readOnly ? "var(--color-surface-2)" : "var(--color-surface)",
          color: readOnly ? "var(--color-text-3)" : "var(--color-text)",
          fontSize: "var(--text-sm)",
          outline: "none",
          transition: "border-color 150ms ease",
          boxSizing: "border-box",
          cursor: readOnly ? "default" : "text",
          fontFamily: "inherit",
        }}
      />
      {hint && (
        <p style={{ fontSize: 11, color: "var(--color-text-3)", marginTop: "var(--space-1)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function StatusBanner({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  const isSuccess = type === "success";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-base)",
        background: isSuccess ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
        border: `1px solid ${isSuccess ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
        marginBottom: "var(--space-4)",
      }}
    >
      {isSuccess ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-success)", flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-danger)", flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          color: isSuccess ? "var(--color-success)" : "var(--color-danger)",
        }}
      >
        {message}
      </span>
    </div>
  );
}

export default function ProfileClient({ name, email, staffId, phone }: Props) {
  const [profilePending, startProfileTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();

  // Profile form
  const [nameVal, setNameVal] = useState(name);
  const [phoneVal, setPhoneVal] = useState(phone ?? "");
  const [profileStatus, setProfileStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function handleSaveProfile() {
    setProfileStatus(null);
    startProfileTransition(async () => {
      const result = await updateProfile({ name: nameVal, phone: phoneVal || null });
      if ("error" in result) {
        setProfileStatus({ type: "error", message: result.error });
      } else {
        setProfileStatus({ type: "success", message: "Profile updated successfully." });
      }
    });
  }

  function handleChangePassword() {
    setPasswordStatus(null);
    if (newPw !== confirmPw) {
      setPasswordStatus({ type: "error", message: "New passwords do not match." });
      return;
    }
    startPasswordTransition(async () => {
      const result = await changePassword({ currentPassword: currentPw, newPassword: newPw });
      if ("error" in result) {
        setPasswordStatus({ type: "error", message: result.error });
      } else {
        setPasswordStatus({ type: "success", message: "Password changed successfully." });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    });
  }

  const profileDirty = nameVal !== name || (phoneVal || null) !== phone;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* Profile section */}
      <div className="card" style={{ padding: "var(--space-6)" }}>
        <h2
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "var(--space-5)",
          }}
        >
          Personal Information
        </h2>

        {profileStatus && (
          <StatusBanner type={profileStatus.type} message={profileStatus.message} />
        )}

        <InputField
          id="name"
          label="Full Name"
          value={nameVal}
          onChange={setNameVal}
          placeholder="Your full name"
        />
        <InputField
          id="email"
          label="Email"
          value={email}
          readOnly
          hint="Email address cannot be changed here."
        />
        <InputField
          id="staff-id"
          label="Staff ID"
          value={staffId}
          readOnly
          hint="Contact an administrator to update your Staff ID."
        />
        <InputField
          id="phone"
          label="Phone Number"
          value={phoneVal}
          onChange={setPhoneVal}
          type="tel"
          placeholder="+233 XX XXX XXXX"
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={profilePending || !profileDirty}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-3) var(--space-5)",
              borderRadius: "var(--radius-base)",
              background:
                profilePending || !profileDirty
                  ? "var(--color-surface-2)"
                  : "var(--color-primary)",
              border: "none",
              color:
                profilePending || !profileDirty ? "var(--color-text-3)" : "#fff",
              fontWeight: 700,
              fontSize: "var(--text-sm)",
              cursor: profilePending || !profileDirty ? "not-allowed" : "pointer",
              transition: "all 200ms ease",
            }}
          >
            {profilePending ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>

      {/* Password section */}
      <div className="card" style={{ padding: "var(--space-6)" }}>
        <h2
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "var(--space-5)",
          }}
        >
          Change Password
        </h2>

        {passwordStatus && (
          <StatusBanner type={passwordStatus.type} message={passwordStatus.message} />
        )}

        {/* Current password */}
        <div style={{ marginBottom: "var(--space-4)", position: "relative" }}>
          <label
            htmlFor="current-pw"
            style={{
              display: "block",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--color-text-3)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "var(--space-2)",
            }}
          >
            Current Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="current-pw"
              type={showCurrent ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Enter current password"
              style={{
                width: "100%",
                padding: "var(--space-3) var(--space-10) var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-base)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: "var(--text-sm)",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              style={{
                position: "absolute",
                right: "var(--space-3)",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-3)",
                padding: "var(--space-1)",
              }}
              aria-label={showCurrent ? "Hide password" : "Show password"}
            >
              {showCurrent ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* New password */}
        <div style={{ marginBottom: "var(--space-4)", position: "relative" }}>
          <label
            htmlFor="new-pw"
            style={{
              display: "block",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--color-text-3)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "var(--space-2)",
            }}
          >
            New Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="new-pw"
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 8 characters"
              style={{
                width: "100%",
                padding: "var(--space-3) var(--space-10) var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-base)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: "var(--text-sm)",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              style={{
                position: "absolute",
                right: "var(--space-3)",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-3)",
                padding: "var(--space-1)",
              }}
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              {showNew ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {/* Strength indicator — signature micro-interaction */}
          {newPw.length > 0 && (
            <div style={{ marginTop: "var(--space-2)", display: "flex", gap: 4 }}>
              {[1, 2, 3, 4].map((level) => {
                const strength = newPw.length >= 12 ? 4 : newPw.length >= 10 ? 3 : newPw.length >= 8 ? 2 : 1;
                const filled = level <= strength;
                const color =
                  strength === 1 ? "var(--color-danger)"
                  : strength === 2 ? "var(--color-warning)"
                  : strength === 3 ? "#f59e0b"
                  : "var(--color-success)";
                return (
                  <div
                    key={level}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background: filled ? color : "var(--color-border)",
                      transition: "background 300ms ease",
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div style={{ marginBottom: "var(--space-5)" }}>
          <label
            htmlFor="confirm-pw"
            style={{
              display: "block",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--color-text-3)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "var(--space-2)",
            }}
          >
            Confirm New Password
          </label>
          <input
            id="confirm-pw"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Re-enter new password"
            style={{
              width: "100%",
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-base)",
              border:
                confirmPw.length > 0 && confirmPw !== newPw
                  ? "1px solid var(--color-danger)"
                  : "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: "var(--text-sm)",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
          {confirmPw.length > 0 && confirmPw !== newPw && (
            <p style={{ fontSize: 11, color: "var(--color-danger)", marginTop: "var(--space-1)" }}>
              Passwords do not match
            </p>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={passwordPending || !currentPw || !newPw || !confirmPw}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-3) var(--space-5)",
              borderRadius: "var(--radius-base)",
              background:
                passwordPending || !currentPw || !newPw || !confirmPw
                  ? "var(--color-surface-2)"
                  : "var(--color-primary)",
              border: "none",
              color:
                passwordPending || !currentPw || !newPw || !confirmPw
                  ? "var(--color-text-3)"
                  : "#fff",
              fontWeight: 700,
              fontSize: "var(--text-sm)",
              cursor:
                passwordPending || !currentPw || !newPw || !confirmPw
                  ? "not-allowed"
                  : "pointer",
              transition: "all 200ms ease",
            }}
          >
            {passwordPending ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Updating…
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
