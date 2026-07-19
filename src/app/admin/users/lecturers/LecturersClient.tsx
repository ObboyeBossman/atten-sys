"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  createLecturer,
  editLecturer,
  deactivateLecturer,
  reactivateLecturer,
  resetLecturerPassword,
} from "./actions";

/* ── Types ───────────────────────────────────────────────────────────────── */
export type LecturerRow = {
  id: string;
  name: string;
  staff_id: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  course_count: number;
};

type Props = {
  lecturers: LecturerRow[];
  total: number;
  page: number;
  perPage: number;
  searchQuery: string;
  statusFilter: string;
};

type Modal =
  | { type: "create" }
  | { type: "edit"; lecturer: LecturerRow }
  | { type: "deactivate"; lecturer: LecturerRow }
  | { type: "reactivate"; lecturer: LecturerRow }
  | { type: "reset_password"; lecturer: LecturerRow };

/* ── Helpers ─────────────────────────────────────────────────────────────── */
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

/* ── Create / Edit modal ─────────────────────────────────────────────────── */
function LecturerFormModal({
  mode,
  lecturer,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  lecturer?: LecturerRow;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(lecturer?.name ?? "");
  const [staffId, setStaffId] = useState(lecturer?.staff_id ?? "");
  const [email, setEmail] = useState(lecturer?.email ?? "");
  const [phone, setPhone] = useState(lecturer?.phone ?? "");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      if (mode === "create") {
        const result = await createLecturer({ name, staff_id: staffId, email, phone, password });
        if ("error" in result) setError(result.error);
        else onDone(`Lecturer ${name} created successfully.`);
      } else if (lecturer) {
        const result = await editLecturer(lecturer.id, { name, staff_id: staffId, phone });
        if ("error" in result) setError(result.error);
        else onDone(`${name} updated successfully.`);
      }
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
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
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="8" cy="5" r="3" />
                <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              </svg>
            </div>
            <div>
              <h3 className="modal-title">{mode === "create" ? "Add Lecturer" : "Edit Lecturer"}</h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", margin: 0 }}>
                {mode === "create" ? "Creates an auth account and lecturer profile" : "Update name, staff ID, or phone"}
              </p>
            </div>
          </div>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div>
            <label className="label" style={{ marginBottom: "var(--space-1)" }}>Full Name *</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e: { target: { value: string } }) => setName(e.target.value)}
              placeholder="e.g. Dr. Kwame Asante"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div>
              <label className="label" style={{ marginBottom: "var(--space-1)" }}>Staff ID *</label>
              <input
                type="text"
                className="input"
                value={staffId}
                onChange={(e: { target: { value: string } }) => setStaffId(e.target.value)}
                placeholder="e.g. TTU/LEC/001"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="label" style={{ marginBottom: "var(--space-1)" }}>Phone</label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e: { target: { value: string } }) => setPhone(e.target.value)}
                placeholder="+233 xx xxx xxxx"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {mode === "create" && (
            <>
              <div>
                <label className="label" style={{ marginBottom: "var(--space-1)" }}>Email *</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e: { target: { value: string } }) => setEmail(e.target.value)}
                  placeholder="lecturer@ttu.edu.gh"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label className="label" style={{ marginBottom: "var(--space-1)" }}>Temporary Password *</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    className="input"
                    value={password}
                    onChange={(e: { target: { value: string } }) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    style={{ width: "100%", paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-text-3)", padding: 2, display: "flex", alignItems: "center",
                    }}
                  >
                    {showPass ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                        <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                        <circle cx="8" cy="8" r="2" /><path d="M2 2l12 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                        <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                        <circle cx="8" cy="8" r="2" />
                      </svg>
                    )}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "var(--color-text-3)", marginTop: 4, marginBottom: 0 }}>
                  Lecturer will be prompted to change this on first login.
                </p>
              </div>
            </>
          )}

          {error && (
            <div className="alert alert-danger" style={{ fontSize: "var(--text-xs)" }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={isPending}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary btn-sm"
            disabled={isPending || !name.trim() || !staffId.trim() || (mode === "create" && (!email.trim() || !password))}
          >
            {isPending
              ? mode === "create" ? "Creating…" : "Saving…"
              : mode === "create" ? "Create Lecturer" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Deactivate modal ─────────────────────────────────────────────────────── */
function DeactivateModal({
  lecturer,
  onClose,
  onDone,
}: {
  lecturer: LecturerRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deactivateLecturer(lecturer.id);
      if ("error" in result) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "var(--radius-lg)",
              background: "rgba(239,68,68,0.1)", display: "flex",
              alignItems: "center", justifyContent: "center", color: "var(--color-danger)", flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 9.5v.5" />
              </svg>
            </div>
            <div>
              <h3 className="modal-title">Deactivate Lecturer</h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", margin: 0 }}>
                Revokes portal access immediately
              </p>
            </div>
          </div>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", margin: 0 }}>
            Are you sure you want to deactivate{" "}
            <strong style={{ color: "var(--color-text)" }}>{lecturer.name}</strong>?
            They will be logged out and unable to access the lecturer portal.
            Their course history and session records are preserved.
          </p>
          {error && (
            <div className="alert alert-danger" style={{ marginTop: "var(--space-3)", fontSize: "var(--text-xs)" }}>
              {error}
            </div>
          )}
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

/* ── Reactivate modal ─────────────────────────────────────────────────────── */
function ReactivateModal({
  lecturer,
  onClose,
  onDone,
}: {
  lecturer: LecturerRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await reactivateLecturer(lecturer.id);
      if ("error" in result) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "var(--radius-lg)",
              background: "rgba(34,197,94,0.1)", display: "flex",
              alignItems: "center", justifyContent: "center", color: "var(--color-success)", flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M2 8a6 6 0 1 0 6-6" /><path d="M2 4v4h4" />
              </svg>
            </div>
            <div>
              <h3 className="modal-title">Reactivate Lecturer</h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", margin: 0 }}>
                Lecturer will be prompted to change password on next login
              </p>
            </div>
          </div>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", margin: 0 }}>
            Reactivate <strong style={{ color: "var(--color-text)" }}>{lecturer.name}</strong>?
            They will regain full access to the lecturer portal.{" "}
            <code style={{ fontSize: 11 }}>must_change_password</code> will be set.
          </p>
          {error && (
            <div className="alert alert-danger" style={{ marginTop: "var(--space-3)", fontSize: "var(--text-xs)" }}>
              {error}
            </div>
          )}
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
  lecturer,
  onClose,
  onDone,
}: {
  lecturer: LecturerRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setError(null);
    startTransition(async () => {
      const result = await resetLecturerPassword(lecturer.id, password);
      if ("error" in result) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "var(--radius-lg)",
              background: "var(--color-surface-3)", display: "flex",
              alignItems: "center", justifyContent: "center", color: "var(--color-text-3)", flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <rect x="3" y="7" width="10" height="8" rx="1.5" />
                <path d="M5 7V5a3 3 0 0 1 6 0v2" />
              </svg>
            </div>
            <div>
              <h3 className="modal-title">Reset Password</h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", margin: 0 }}>
                {lecturer.name} · {lecturer.staff_id}
              </p>
            </div>
          </div>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div>
            <label className="label" style={{ marginBottom: "var(--space-1)" }}>New Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={show ? "text" : "password"}
                className="input"
                value={password}
                onChange={(e: { target: { value: string } }) => { setPassword(e.target.value); setError(null); }}
                placeholder="Min. 8 characters"
                style={{ width: "100%", paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-3)", padding: 2, display: "flex", alignItems: "center",
                }}
              >
                {show ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                    <circle cx="8" cy="8" r="2" /><path d="M2 2l12 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                    <circle cx="8" cy="8" r="2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="label" style={{ marginBottom: "var(--space-1)" }}>Confirm Password</label>
            <input
              type={show ? "text" : "password"}
              className="input"
              value={confirm}
              onChange={(e: { target: { value: string } }) => { setConfirm(e.target.value); setError(null); }}
              placeholder="Repeat new password"
              style={{ width: "100%" }}
            />
          </div>
          {error && (
            <div className="alert alert-danger" style={{ fontSize: "var(--text-xs)" }}>
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={isPending}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={isPending || !password || !confirm}
            className="btn btn-primary btn-sm"
          >
            {isPending ? "Saving…" : "Reset Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export function LecturersClient({
  lecturers,
  total,
  page,
  perPage,
  searchQuery,
  statusFilter,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const totalPages = Math.ceil(total / perPage);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      if (!("page" in updates)) params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function closeModal() { setModal(null); }
  function handleDone(msg: string) { closeModal(); showToast(msg); }

  return (
    <>
      <style>{`
        .modal-backdrop {
          position: fixed; inset: 0; z-index: 50;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center; padding: var(--space-4);
        }
        .modal {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius-xl); width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          animation: modal-in 0.15s ease;
        }
        @keyframes modal-in { from { opacity:0; transform: scale(0.96) translateY(8px); } to { opacity:1; transform: none; } }
        .modal-header { padding: var(--space-5) var(--space-5) 0; }
        .modal-title { font-size: var(--text-base); font-weight: 700; color: var(--color-text); margin: 0; }
        .modal-body { padding: var(--space-4) var(--space-5); }
        .modal-footer { padding: 0 var(--space-5) var(--space-5); display: flex; justify-content: flex-end; gap: var(--space-2); }

        .lecturers-toolbar {
          display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
          margin-bottom: var(--space-4);
        }
        .lecturers-search { position: relative; flex: 1; min-width: 200px; max-width: 320px; }
        .lecturers-search input { width: 100%; padding-left: 34px; }
        .lecturers-search-icon {
          position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
          color: var(--color-text-3); pointer-events: none;
        }

        .lecturers-table-wrap { overflow-x: auto; }
        table.lecturers-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
        .lecturers-table th {
          text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.05em; color: var(--color-text-3);
          padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--color-border);
          white-space: nowrap;
        }
        .lecturers-table td {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text-2); vertical-align: middle;
        }
        .lecturers-table tr:last-child td { border-bottom: none; }
        .lecturers-table tr:hover td { background: var(--color-surface-2); }

        .lecturer-name { font-weight: 600; color: var(--color-text); }
        .lecturer-meta { font-size: var(--text-xs); color: var(--color-text-3); margin-top: 1px; }
        .lecturer-mono { font-family: var(--font-mono); font-size: 12px; color: var(--color-text-3); }

        .row-actions { display: flex; align-items: center; gap: var(--space-1); justify-content: flex-end; }

        .pagination {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-3) var(--space-4); border-top: 1px solid var(--color-border);
          font-size: var(--text-xs); color: var(--color-text-3); flex-wrap: wrap; gap: var(--space-2);
        }
        .pagination-pages { display: flex; align-items: center; gap: var(--space-1); }

        .toast {
          position: fixed; bottom: var(--space-6); right: var(--space-6); z-index: 100;
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-lg); font-size: var(--text-sm); font-weight: 500;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          display: flex; align-items: center; gap: var(--space-2);
          animation: toast-in 0.2s ease;
        }
        @keyframes toast-in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: none; } }
        .toast-success { background: var(--color-surface-2); border: 1px solid rgba(34,197,94,0.3); color: var(--color-success); }
        .toast-error { background: var(--color-surface-2); border: 1px solid rgba(239,68,68,0.3); color: var(--color-danger); }

        .empty-state {
          padding: var(--space-12) var(--space-6);
          text-align: center; color: var(--color-text-3);
        }
        .empty-state svg { margin-bottom: var(--space-3); opacity: 0.4; }
        .empty-state p { font-size: var(--text-sm); margin: 0; }
      `}</style>

      {/* Toolbar */}
      <div className="lecturers-toolbar">
        {/* Search */}
        <div className="lecturers-search">
          <span className="lecturers-search-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="5" />
              <path d="M10.5 10.5l3.5 3.5" />
            </svg>
          </span>
          <input
            type="search"
            className="input input-sm"
            placeholder="Search name, staff ID, or email…"
            defaultValue={searchQuery}
            onChange={(e: { target: { value: string } }) => updateParams({ q: e.target.value })}
          />
        </div>

        {/* Status filter */}
        <select
          className="input input-sm"
          value={statusFilter}
          onChange={(e: { target: { value: string } }) => updateParams({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Count */}
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", whiteSpace: "nowrap" }}>
          {total} {total === 1 ? "lecturer" : "lecturers"}
        </span>

        {/* Add button */}
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}
          onClick={() => setModal({ type: "create" })}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add Lecturer
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {lecturers.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <p>No lecturers found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className="lecturers-table-wrap">
              <table className="lecturers-table">
                <thead>
                  <tr>
                    <th>Lecturer</th>
                    <th>Staff ID</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Courses</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturers.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="lecturer-name">{l.name}</div>
                      </td>
                      <td>
                        <span className="lecturer-mono">{l.staff_id}</span>
                      </td>
                      <td>
                        <span className="lecturer-meta">{l.email}</span>
                      </td>
                      <td>
                        <span className="lecturer-meta">{l.phone ?? "—"}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-2)" }}>
                          {l.course_count} {l.course_count === 1 ? "course" : "courses"}
                        </span>
                      </td>
                      <td>
                        <StatusBadge active={l.is_active} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Edit lecturer"
                            onClick={() => setModal({ type: "edit", lecturer: l })}
                            style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                              <path d="M11 2l3 3-9 9H2v-3l9-9z" />
                            </svg>
                            Edit
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            title="Reset password"
                            onClick={() => setModal({ type: "reset_password", lecturer: l })}
                            style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                              <rect x="3" y="7" width="10" height="8" rx="1.5" />
                              <path d="M5 7V5a3 3 0 0 1 6 0v2" />
                            </svg>
                            Reset
                          </button>

                          {l.is_active ? (
                            <button
                              className="btn btn-danger btn-sm"
                              title="Deactivate lecturer"
                              onClick={() => setModal({ type: "deactivate", lecturer: l })}
                              style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                                <circle cx="8" cy="8" r="7" />
                                <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
                              </svg>
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Reactivate lecturer"
                              onClick={() => setModal({ type: "reactivate", lecturer: l })}
                              style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                                <path d="M2 8a6 6 0 1 0 6-6" /><path d="M2 4v4h4" />
                              </svg>
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <span>
                  Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
                </span>
                <div className="pagination-pages">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page <= 1}
                    onClick={() => updateParams({ page: String(page - 1) })}
                    style={{ padding: "4px 10px" }}
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i + 1 : i < 3 ? i + 1 : i >= 4 ? totalPages - (6 - i) : page;
                    return (
                      <button
                        key={p}
                        className={`btn btn-sm ${p === page ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => updateParams({ page: String(p) })}
                        style={{ minWidth: 32, padding: "4px 8px" }}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => updateParams({ page: String(page + 1) })}
                    style={{ padding: "4px 10px" }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {modal?.type === "create" && (
        <LecturerFormModal
          mode="create"
          onClose={closeModal}
          onDone={(msg) => handleDone(msg)}
        />
      )}
      {modal?.type === "edit" && (
        <LecturerFormModal
          mode="edit"
          lecturer={modal.lecturer}
          onClose={closeModal}
          onDone={(msg) => handleDone(msg)}
        />
      )}
      {modal?.type === "deactivate" && (
        <DeactivateModal
          lecturer={modal.lecturer}
          onClose={closeModal}
          onDone={() => handleDone(`${modal.lecturer.name} has been deactivated.`)}
        />
      )}
      {modal?.type === "reactivate" && (
        <ReactivateModal
          lecturer={modal.lecturer}
          onClose={closeModal}
          onDone={() => handleDone(`${modal.lecturer.name} has been reactivated.`)}
        />
      )}
      {modal?.type === "reset_password" && (
        <ResetPasswordModal
          lecturer={modal.lecturer}
          onClose={closeModal}
          onDone={() => handleDone(`Password reset for ${modal.lecturer.name}.`)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 7l3.5 3.5L12 4" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="7" cy="7" r="6" /><path d="M7 4v4M7 9.5v.5" />
            </svg>
          )}
          {toast.msg}
        </div>
      )}
    </>
  );
}
