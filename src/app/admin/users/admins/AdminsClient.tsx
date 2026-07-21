"use client";

import { useState, useTransition } from "react";
import {
  createSuperAdmin,
  editSuperAdmin,
  deactivateSuperAdmin,
  reactivateSuperAdmin,
  resetSuperAdminPassword,
} from "./actions";

/* ── Types ───────────────────────────────────────────────────────────────── */
export type AdminRow = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  is_self: boolean;
};

type Props = {
  admins: AdminRow[];
};

type Modal =
  | { type: "create" }
  | { type: "edit"; admin: AdminRow }
  | { type: "deactivate"; admin: AdminRow }
  | { type: "reactivate"; admin: AdminRow }
  | { type: "reset_password"; admin: AdminRow };

/* ── Status badge ────────────────────────────────────────────────────────── */
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "var(--radius-full)",
        background: active ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)",
        color: active ? "var(--color-success)" : "var(--color-danger)",
        border: `1px solid ${active ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.2)"}`,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: active ? "var(--color-success)" : "var(--color-danger)",
        }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* ── "You" badge ─────────────────────────────────────────────────────────── */
function YouBadge() {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        padding: "1px 6px",
        borderRadius: "var(--radius-full)",
        background: "rgba(var(--color-primary-rgb, 99,102,241),0.12)",
        color: "var(--color-primary)",
        border: "1px solid rgba(var(--color-primary-rgb, 99,102,241),0.25)",
        textTransform: "uppercase",
      }}
    >
      You
    </span>
  );
}

/* ── Create / Edit modal ─────────────────────────────────────────────────── */
function AdminFormModal({
  mode,
  admin,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  admin?: AdminRow;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(admin?.name ?? "");
  const [email, setEmail] = useState(admin?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      if (mode === "create") {
        const result = await createSuperAdmin({ name, email, password });
        if ("error" in result) setError(result.error);
        else onDone(`Admin ${name} created successfully.`);
      } else if (admin) {
        const result = await editSuperAdmin(admin.id, { name });
        if ("error" in result) setError(result.error);
        else onDone(`${name} updated successfully.`);
      }
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: "var(--radius-lg)",
                background: "var(--color-surface-3)", display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "var(--color-text-2)", flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="9" cy="6" r="4" />
                <path d="M1 17c0-3.87 3.58-7 8-7s8 3.13 8 7" />
              </svg>
            </div>
            <div>
              <h2 className="modal-title">
                {mode === "create" ? "Add super admin" : "Edit admin"}
              </h2>
              {mode === "create" && (
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>
                  This account will have full system access
                </p>
              )}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Full name</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Dr. Kwame Mensah"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </div>

          {mode === "create" && (
            <>
              <div className="form-group">
                <label className="form-label">Email address</label>
                <input
                  className="input"
                  type="email"
                  placeholder="e.g. admin@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showPass ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isPending}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-text-3)", padding: 2,
                    }}
                    tabIndex={-1}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><path d="M2 2l12 12" strokeLinecap="round"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={isPending}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary btn-sm"
            disabled={isPending || !name.trim() || (mode === "create" && (!email.trim() || password.length < 8))}
          >
            {isPending ? (mode === "create" ? "Creating…" : "Saving…") : (mode === "create" ? "Create admin" : "Save changes")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Deactivate modal ────────────────────────────────────────────────────── */
function DeactivateModal({
  admin,
  onClose,
  onDone,
}: {
  admin: AdminRow;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deactivateSuperAdmin(admin.id);
      if ("error" in result) setError(result.error);
      else onDone(`${admin.name} has been deactivated.`);
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Deactivate admin?</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
              {error}
            </div>
          )}
          <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
            <strong>{admin.name}</strong> will lose access to the admin portal immediately.
            Their account can be reactivated at any time.
          </p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={isPending}>Cancel</button>
          <button onClick={handleConfirm} className="btn btn-danger btn-sm" disabled={isPending}>
            {isPending ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Reactivate modal ────────────────────────────────────────────────────── */
function ReactivateModal({
  admin,
  onClose,
  onDone,
}: {
  admin: AdminRow;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await reactivateSuperAdmin(admin.id);
      if ("error" in result) setError(result.error);
      else onDone(`${admin.name} has been reactivated.`);
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Reactivate admin?</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
              {error}
            </div>
          )}
          <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
            <strong>{admin.name}</strong> will regain full admin portal access.
            They&apos;ll be prompted to set a new password on first login.
          </p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={isPending}>Cancel</button>
          <button onClick={handleConfirm} className="btn btn-primary btn-sm" disabled={isPending}>
            {isPending ? "Reactivating…" : "Reactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Reset password modal ────────────────────────────────────────────────── */
function ResetPasswordModal({
  admin,
  onClose,
  onDone,
}: {
  admin: AdminRow;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await resetSuperAdminPassword(admin.id, password);
      if ("error" in result) setError(result.error);
      else onDone(`Password reset for ${admin.name}.`);
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Reset password</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
              {error}
            </div>
          )}
          <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
            Setting a new password for <strong>{admin.name}</strong>.
            {!admin.is_self && " They will be prompted to change it on next login."}
          </p>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">New password</label>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                type={showPass ? "text" : "password"}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                autoFocus
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-3)", padding: 2,
                }}
                tabIndex={-1}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><path d="M2 2l12 12" strokeLinecap="round"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={isPending}>Cancel</button>
          <button
            onClick={handleConfirm}
            className="btn btn-primary btn-sm"
            disabled={isPending || password.length < 8}
          >
            {isPending ? "Resetting…" : "Reset password"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Row actions menu ────────────────────────────────────────────────────── */
function AdminActions({
  admin,
  onAction,
}: {
  admin: AdminRow;
  onAction: (modal: Modal) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((o) => !o)}
        aria-label="Actions"
        style={{ padding: "4px 8px" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="8" cy="3" r="1" fill="currentColor" stroke="none" />
          <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="8" cy="13" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute", right: 0, top: "calc(100% + 4px)",
              background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
              minWidth: 168, zIndex: 20, overflow: "hidden",
            }}
          >
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setOpen(false); onAction({ type: "edit", admin }); }}
              style={{ width: "100%", justifyContent: "flex-start", borderRadius: 0, padding: "8px 14px" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginRight: 8 }}>
                <path d="M10 2l2 2-7 7H3v-2l7-7z" />
              </svg>
              Edit name
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setOpen(false); onAction({ type: "reset_password", admin }); }}
              style={{ width: "100%", justifyContent: "flex-start", borderRadius: 0, padding: "8px 14px" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginRight: 8 }}>
                <rect x="2" y="6" width="10" height="7" rx="1.5" />
                <path d="M4 6V4a3 3 0 016 0v2" />
              </svg>
              Reset password
            </button>
            {!admin.is_self && (
              <>
                <div style={{ height: 1, background: "var(--color-border)", margin: "4px 0" }} />
                {admin.is_active ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setOpen(false); onAction({ type: "deactivate", admin }); }}
                    style={{
                      width: "100%", justifyContent: "flex-start", borderRadius: 0,
                      padding: "8px 14px", color: "var(--color-danger)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginRight: 8 }}>
                      <circle cx="7" cy="7" r="6" />
                      <path d="M5 7h4" />
                    </svg>
                    Deactivate
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setOpen(false); onAction({ type: "reactivate", admin }); }}
                    style={{
                      width: "100%", justifyContent: "flex-start", borderRadius: 0,
                      padding: "8px 14px", color: "var(--color-success)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginRight: 8 }}>
                      <circle cx="7" cy="7" r="6" />
                      <path d="M5 7l2 2 3-3" />
                    </svg>
                    Reactivate
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export function AdminsClient({ admins }: Props) {
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setModal(null);
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const activeCount = admins.filter((a) => a.is_active).length;

  return (
    <>
      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 1000,
            background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)", padding: "12px 18px",
            boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center",
            gap: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--color-text-1)",
            maxWidth: 360, animation: "fadeIn 0.2s ease",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" />
            <path d="M5 8l2 2 4-4" />
          </svg>
          {toast}
        </div>
      )}

      {/* ── Page actions bar ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <span className="badge badge-neutral" style={{ fontSize: "var(--text-xs)" }}>
            {admins.length} {admins.length === 1 ? "admin" : "admins"}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
            {activeCount} active
          </span>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setModal({ type: "create" })}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 2v10M2 7h10" />
          </svg>
          Add admin
        </button>
      </div>

      {/* ── Info banner ────────────────────────────────────────────────────── */}
      <div
        className="alert alert-info"
        style={{ marginBottom: "var(--space-6)", fontSize: "var(--text-sm)" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="7" />
          <path d="M8 5v4M8 10.5v.5" />
        </svg>
        <span>
          Super admins have unrestricted access to all system settings and data.
          Only add trusted individuals to this role.
        </span>
      </div>

      {/* ── Admins table ───────────────────────────────────────────────────── */}
      {admins.length === 0 ? (
        <div
          style={{
            textAlign: "center", padding: "var(--space-16) var(--space-8)",
            color: "var(--color-text-3)", background: "var(--color-surface-2)",
            borderRadius: "var(--radius-xl)", border: "1px dashed var(--color-border)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto var(--space-4)", opacity: 0.4 }}>
            <circle cx="20" cy="14" r="8" />
            <path d="M4 38c0-8.84 7.16-16 16-16s16 7.16 16 16" />
          </svg>
          <p style={{ fontWeight: 500, marginBottom: 4 }}>No admins found</p>
          <p style={{ fontSize: "var(--text-sm)" }}>Add the first super admin to get started</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Added</th>
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <div
                        style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "var(--color-surface-3)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "var(--text-sm)", fontWeight: 600,
                          color: "var(--color-text-2)", flexShrink: 0,
                        }}
                      >
                        {admin.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <span style={{ fontWeight: 500 }}>{admin.name}</span>
                        {admin.is_self && <YouBadge />}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--color-text-2)", fontSize: "var(--text-sm)" }}>
                    {admin.email}
                  </td>
                  <td>
                    <StatusBadge active={admin.is_active} />
                  </td>
                  <td style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
                    {new Date(admin.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td>
                    <AdminActions admin={admin} onAction={setModal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {modal?.type === "create" && (
        <AdminFormModal mode="create" onClose={() => setModal(null)} onDone={showToast} />
      )}
      {modal?.type === "edit" && (
        <AdminFormModal mode="edit" admin={modal.admin} onClose={() => setModal(null)} onDone={showToast} />
      )}
      {modal?.type === "deactivate" && (
        <DeactivateModal admin={modal.admin} onClose={() => setModal(null)} onDone={showToast} />
      )}
      {modal?.type === "reactivate" && (
        <ReactivateModal admin={modal.admin} onClose={() => setModal(null)} onDone={showToast} />
      )}
      {modal?.type === "reset_password" && (
        <ResetPasswordModal admin={modal.admin} onClose={() => setModal(null)} onDone={showToast} />
      )}
    </>
  );
}
