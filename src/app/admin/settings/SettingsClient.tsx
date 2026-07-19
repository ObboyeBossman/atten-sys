"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { updateSetting } from "./actions";

/* ── Types ───────────────────────────────────────────────────────────────── */
export type Setting = {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updater_name: string | null;
};

type SettingMeta = {
  label: string;
  unit?: string;
  inputType: "text" | "number";
  min?: number;
  placeholder: string;
  warning?: string;
  icon: React.ReactNode;
};

/* ── Per-key metadata ────────────────────────────────────────────────────── */
const META: Record<string, SettingMeta> = {
  institution_email_domain: {
    label: "Email Domain",
    inputType: "text",
    placeholder: "ttu.edu.gh",
    warning:
      "Changing this will not affect existing student email addresses — only students added after this change.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="16" height="12" rx="2" />
        <path d="M2 7l8 5 8-5" />
      </svg>
    ),
  },
  gps_accuracy_floor_metres: {
    label: "GPS Accuracy Floor",
    unit: "metres",
    inputType: "number",
    min: 1,
    placeholder: "100",
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="3" />
        <circle cx="10" cy="10" r="7" strokeDasharray="3 2" />
        <path d="M10 1v2M10 17v2M1 10h2M17 10h2" />
      </svg>
    ),
  },
  late_threshold_minutes: {
    label: "Late Threshold",
    unit: "minutes",
    inputType: "number",
    min: 1,
    placeholder: "15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v4l2.5 2.5" />
      </svg>
    ),
  },
  default_session_duration_minutes: {
    label: "Default Session Duration",
    unit: "minutes",
    inputType: "number",
    min: 1,
    placeholder: "120",
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="2" width="14" height="16" rx="2" />
        <path d="M7 6h6M7 10h6M7 14h4" />
      </svg>
    ),
  },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ── Single row component ────────────────────────────────────────────────── */
function SettingRow({ setting }: { setting: Setting }) {
  const meta = META[setting.key];
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(setting.value);
  const [localValue, setLocalValue] = useState(setting.value);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleEdit() {
    setInputVal(localValue);
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateSetting(setting.key, inputVal);
      if ("error" in result) {
        setError(result.error);
      } else {
        setLocalValue(inputVal);
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  }

  if (!meta) return null;

  return (
    <>
      {/* Scoped mobile styles */}
      <style>{`
        .setting-row { padding: var(--space-5) var(--space-5); border-bottom: 1px solid var(--color-border); transition: background var(--transition-fast); }
        .setting-row.is-editing { background: var(--color-surface-2); }

        /* Top section: icon + content + actions in one line on desktop */
        .setting-top { display: flex; align-items: flex-start; gap: var(--space-3); }

        /* Icon badge */
        .setting-icon {
          width: 36px; height: 36px; border-radius: var(--radius-lg);
          background: var(--color-surface-3); border: 1px solid var(--color-border);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-3); flex-shrink: 0; margin-top: 2px;
          transition: all var(--transition-base);
        }
        .setting-icon.is-editing {
          background: rgba(157,10,18,0.12); border-color: rgba(157,10,18,0.25);
          color: var(--color-primary);
        }

        /* Content block grows */
        .setting-content { flex: 1; min-width: 0; }

        /* Label row: label + unit badge + key pill */
        .setting-label-row {
          display: flex; align-items: center; gap: var(--space-2);
          flex-wrap: wrap; margin-bottom: var(--space-1);
        }
        .setting-label {
          font-size: var(--text-sm); font-weight: 700;
          color: var(--color-text); letter-spacing: -0.01em;
        }
        .setting-unit-badge {
          font-size: 10px; font-weight: 600; color: var(--color-text-3);
          text-transform: uppercase; letter-spacing: 0.06em;
          padding: 1px 6px; background: var(--color-surface-3);
          border-radius: var(--radius-full);
        }
        .setting-key-pill {
          font-size: 10px; font-family: var(--font-mono); color: var(--color-text-3);
          background: var(--color-surface-3); padding: 1px 6px;
          border-radius: var(--radius-sm);
          /* truncate on very small screens */
          max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* Description */
        .setting-desc {
          font-size: var(--text-xs); color: var(--color-text-3);
          line-height: 1.55; margin: 0 0 var(--space-1) 0;
        }

        /* Updated line */
        .setting-meta {
          font-size: 10px; color: var(--color-text-3);
          display: flex; align-items: center; gap: var(--space-1);
          flex-wrap: wrap;
        }

        /* Value + Edit button — default: inline on the right */
        .setting-actions {
          display: flex; align-items: center; gap: var(--space-2);
          flex-shrink: 0; margin-top: 2px;
        }

        .setting-value-display {
          font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 600;
          color: var(--color-text); background: var(--color-surface-2);
          border: 1px solid var(--color-border); border-radius: var(--radius-md);
          padding: 6px 12px; min-width: 60px; text-align: center;
          transition: all var(--transition-base);
          display: flex; align-items: center; gap: var(--space-2);
        }
        .setting-value-display.is-saved {
          color: var(--color-success); background: var(--color-success-bg);
          border-color: rgba(34,197,94,0.3);
        }

        /* Edit form */
        .setting-edit-form {
          margin-top: var(--space-4);
          padding-left: calc(36px + var(--space-3));
        }
        .setting-edit-controls {
          display: flex; align-items: flex-start; gap: var(--space-2); flex-wrap: wrap;
        }
        .setting-edit-input {
          width: 220px;
          font-weight: 600;
        }

        /* ── Mobile: ≤ 480px ─────────────────────────────────────────────── */
        @media (max-width: 480px) {
          .setting-row { padding: var(--space-4) var(--space-4); }

          /* Stack: top row has no separate actions column — actions move below */
          .setting-top { flex-wrap: wrap; }
          .setting-actions {
            /* Break to its own row, aligned under the content (after icon) */
            order: 3;
            width: 100%;
            padding-left: calc(36px + var(--space-3));
            margin-top: var(--space-3);
          }

          /* Value pill takes remaining width, edit button shrinks */
          .setting-value-display {
            flex: 1;
            justify-content: center;
          }

          /* Key pill can be wider on small screens since there's more vertical room */
          .setting-key-pill { max-width: 140px; }

          /* Edit form goes full-width, no left padding offset */
          .setting-edit-form { padding-left: 0; margin-top: var(--space-3); }

          /* Input stretches full width */
          .setting-edit-input { width: 100%; }

          /* Save/Cancel stack naturally */
          .setting-edit-controls { gap: var(--space-2); }
          .setting-edit-controls .btn { flex: 1; justify-content: center; min-width: 0; }
          .setting-edit-controls .btn-ghost { flex: 0 0 auto; }
        }
      `}</style>

      <div className={`setting-row${editing ? " is-editing" : ""}`}>

        {/* Top section */}
        <div className="setting-top">

          {/* Icon */}
          <div className={`setting-icon${editing ? " is-editing" : ""}`}>
            {meta.icon}
          </div>

          {/* Content */}
          <div className="setting-content">
            <div className="setting-label-row">
              <span className="setting-label">{meta.label}</span>
              {meta.unit && (
                <span className="setting-unit-badge">{meta.unit}</span>
              )}
              <span className="setting-key-pill" title={setting.key}>
                {setting.key}
              </span>
            </div>

            {setting.description && (
              <p className="setting-desc">{setting.description}</p>
            )}

            <div className="setting-meta">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="7" cy="7" r="6" />
                <path d="M7 4v3l2 2" />
              </svg>
              Updated {formatRelativeTime(setting.updated_at)}
              {setting.updater_name && (
                <> by <strong style={{ color: "var(--color-text-2)" }}>{setting.updater_name}</strong></>
              )}
            </div>
          </div>

          {/* Value + Edit — moves below content on mobile */}
          {!editing && (
            <div className="setting-actions">
              <div className={`setting-value-display${saved ? " is-saved" : ""}`}>
                {saved && (
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 7l3.5 3.5L12 4" />
                  </svg>
                )}
                {localValue}
              </div>

              <button
                onClick={handleEdit}
                className="btn btn-secondary btn-sm"
                title={`Edit ${meta.label}`}
                style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2l2 2-8 8H2v-2l8-8z" />
                </svg>
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Inline edit form */}
        {editing && (
          <div className="setting-edit-form">
            {meta.warning && (
              <div
                className="alert alert-warning"
                style={{ marginBottom: "var(--space-3)", fontSize: "var(--text-xs)" }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M8 1l7 13H1L8 1z" />
                  <path d="M8 6v4M8 11.5v.5" />
                </svg>
                {meta.warning}
              </div>
            )}

            <div className="setting-edit-controls">
              <input
                ref={inputRef}
                type={meta.inputType}
                value={inputVal}
                onChange={(e) => { setInputVal(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                min={meta.min}
                placeholder={meta.placeholder}
                className="input setting-edit-input"
                style={{
                  fontFamily: meta.inputType === "text" ? "var(--font-mono)" : "var(--font-sans)",
                  fontWeight: 600,
                  boxShadow: error ? "0 0 0 3px rgba(239,68,68,0.2)" : undefined,
                  borderColor: error ? "var(--color-danger)" : undefined,
                }}
                aria-label={`New value for ${meta.label}`}
                aria-invalid={!!error}
                aria-describedby={error ? `${setting.key}-error` : undefined}
                disabled={isPending}
              />

              <button
                onClick={handleSave}
                disabled={isPending || inputVal.trim() === ""}
                className="btn btn-primary btn-sm"
                style={{ minWidth: 80 }}
              >
                {isPending ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 0.6s linear infinite" }}>
                      <path d="M7 1a6 6 0 1 0 6 6" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  "Save change"
                )}
              </button>

              <button
                onClick={handleCancel}
                disabled={isPending}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>

            {error && (
              <p
                id={`${setting.key}-error`}
                role="alert"
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-danger)",
                  marginTop: "var(--space-2)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="7" cy="7" r="6" />
                  <path d="M7 4v4M7 9.5v.5" />
                </svg>
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export function SettingsClient({ settings }: { settings: Setting[] }) {
  const ORDER = [
    "institution_email_domain",
    "late_threshold_minutes",
    "default_session_duration_minutes",
    "gps_accuracy_floor_metres",
  ];

  const sorted = [...settings].sort((a, b) => {
    const ai = ORDER.indexOf(a.key);
    const bi = ORDER.indexOf(b.key);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {sorted.length === 0 ? (
        <div
          style={{
            padding: "var(--space-12)",
            textAlign: "center",
            color: "var(--color-text-3)",
            fontSize: "var(--text-sm)",
          }}
        >
          No system settings found.
        </div>
      ) : (
        <div>
          {sorted.map((s, i) => (
            <div key={s.key} style={i === sorted.length - 1 ? { borderBottom: "none" } : {}}>
              <SettingRow setting={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
