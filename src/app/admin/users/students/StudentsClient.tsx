"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { deactivateStudent, reactivateStudent, resetStudentPassword } from "./actions";

/* ── Types ───────────────────────────────────────────────────────────────── */
export type StudentRow = {
  id: string;
  name: string;
  index_number: string;
  email: string;
  is_active: boolean;
  current_group: string | null;
  academic_year: string | null;
  group_id: string | null;
};

export type FilterOption = { id: string; name: string };

type Props = {
  students: StudentRow[];
  total: number;
  page: number;
  perPage: number;
  groups: FilterOption[];
  academicYears: FilterOption[];
  searchQuery: string;
  groupFilter: string;
  yearFilter: string;
  statusFilter: string;
};

type Modal =
  | { type: "deactivate"; student: StudentRow }
  | { type: "reactivate"; student: StudentRow }
  | { type: "reset_password"; student: StudentRow };

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

/* ── Confirm modal ───────────────────────────────────────────────────────── */
function DeactivateModal({
  student,
  onClose,
  onDone,
}: {
  student: StudentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deactivateStudent(student.id);
      if ("error" in result) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "var(--radius-lg)",
              background: "rgba(239,68,68,0.1)", display: "flex",
              alignItems: "center", justifyContent: "center", color: "var(--color-danger)", flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="8" cy="8" r="7" />
                <path d="M8 5v3M8 9.5v.5" />
              </svg>
            </div>
            <div>
              <h3 className="modal-title">Deactivate Student</h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", margin: 0 }}>
                This will revoke portal access immediately
              </p>
            </div>
          </div>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", margin: 0 }}>
            Are you sure you want to deactivate{" "}
            <strong style={{ color: "var(--color-text)" }}>{student.name}</strong>?
            They will be logged out and unable to access the student portal.
            Their attendance records and group memberships are preserved.
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

function ReactivateModal({
  student,
  onClose,
  onDone,
}: {
  student: StudentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await reactivateStudent(student.id);
      if ("error" in result) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "var(--radius-lg)",
              background: "rgba(34,197,94,0.1)", display: "flex",
              alignItems: "center", justifyContent: "center", color: "var(--color-success)", flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M2 8a6 6 0 1 0 6-6" />
                <path d="M2 4v4h4" />
              </svg>
            </div>
            <div>
              <h3 className="modal-title">Reactivate Student</h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", margin: 0 }}>
                Student will be prompted to change password on next login
              </p>
            </div>
          </div>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", margin: 0 }}>
            Reactivate <strong style={{ color: "var(--color-text)" }}>{student.name}</strong>?
            They will regain portal access. <code style={{ fontSize: 11 }}>must_change_password</code> will
            be set — they must set a new password before accessing any screen.
          </p>
          <div className="alert alert-info" style={{ marginTop: "var(--space-3)", fontSize: "var(--text-xs)" }}>
            To add them back to a group, use the rep portal's "Add Student" flow.
          </div>
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

function ResetPasswordModal({
  student,
  onClose,
  onDone,
}: {
  student: StudentRow;
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
      const result = await resetStudentPassword(student.id, password);
      if ("error" in result) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
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
                {student.name} · {student.index_number}
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
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="Min. 8 characters"
                style={{ width: "100%", paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--color-text-3)",
                  padding: 2, display: "flex", alignItems: "center",
                }}
              >
                {show ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                    <circle cx="8" cy="8" r="2" />
                    <path d="M2 2l12 12" />
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
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
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

/* ── Main component ─────────────────────────────────────────────────────── */
export function StudentsClient({
  students,
  total,
  page,
  perPage,
  groups,
  academicYears,
  searchQuery,
  groupFilter,
  yearFilter,
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
      // Reset to page 1 on filter/search change
      if (!("page" in updates)) params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function closeModal() {
    setModal(null);
  }

  function handleDone(msg: string) {
    closeModal();
    showToast(msg);
  }

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

        .students-toolbar {
          display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
          margin-bottom: var(--space-4);
        }
        .students-search { position: relative; flex: 1; min-width: 200px; max-width: 320px; }
        .students-search input { width: 100%; padding-left: 34px; }
        .students-search-icon {
          position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
          color: var(--color-text-3); pointer-events: none;
        }
        .students-filters { display: flex; gap: var(--space-2); flex-wrap: wrap; }

        .students-table-wrap { overflow-x: auto; }
        table.students-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
        .students-table th {
          text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.05em; color: var(--color-text-3);
          padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--color-border);
          white-space: nowrap;
        }
        .students-table td {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text-2); vertical-align: middle;
        }
        .students-table tr:last-child td { border-bottom: none; }
        .students-table tr:hover td { background: var(--color-surface-2); }

        .student-name { font-weight: 600; color: var(--color-text); }
        .student-index { font-family: var(--font-mono); font-size: 12px; color: var(--color-text-3); }
        .student-email { font-size: var(--text-xs); color: var(--color-text-3); }

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
      <div className="students-toolbar">
        {/* Search */}
        <div className="students-search">
          <span className="students-search-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="5" />
              <path d="M10.5 10.5l3.5 3.5" />
            </svg>
          </span>
          <input
            type="search"
            className="input input-sm"
            placeholder="Search name or index number…"
            defaultValue={searchQuery}
            onChange={(e) => updateParams({ q: e.target.value })}
          />
        </div>

        {/* Filters */}
        <div className="students-filters">
          <select
            className="input input-sm"
            value={yearFilter}
            onChange={(e) => updateParams({ year: e.target.value })}
          >
            <option value="">All years</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>

          <select
            className="input input-sm"
            value={groupFilter}
            onChange={(e) => updateParams({ group: e.target.value })}
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <select
            className="input input-sm"
            value={statusFilter}
            onChange={(e) => updateParams({ status: e.target.value })}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Count */}
        <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--color-text-3)", whiteSpace: "nowrap" }}>
          {total} {total === 1 ? "student" : "students"}
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {students.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <p>No students found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className="students-table-wrap">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Index No.</th>
                    <th>Email</th>
                    <th>Current Group</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="student-name">{s.name}</div>
                      </td>
                      <td>
                        <span className="student-index">{s.index_number}</span>
                      </td>
                      <td>
                        <span className="student-email">{s.email}</span>
                      </td>
                      <td>
                        {s.current_group ? (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-2)" }}>
                            {s.current_group}
                            {s.academic_year && (
                              <span style={{ color: "var(--color-text-3)", marginLeft: 4 }}>
                                · {s.academic_year}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge active={s.is_active} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Reset password"
                            onClick={() => setModal({ type: "reset_password", student: s })}
                            style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                              <rect x="3" y="7" width="10" height="8" rx="1.5" />
                              <path d="M5 7V5a3 3 0 0 1 6 0v2" />
                            </svg>
                            Reset
                          </button>

                          {s.is_active ? (
                            <button
                              className="btn btn-danger btn-sm"
                              title="Deactivate student"
                              onClick={() => setModal({ type: "deactivate", student: s })}
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
                              title="Reactivate student"
                              onClick={() => setModal({ type: "reactivate", student: s })}
                              style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                                <path d="M2 8a6 6 0 1 0 6-6" />
                                <path d="M2 4v4h4" />
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
      {modal?.type === "deactivate" && (
        <DeactivateModal
          student={modal.student}
          onClose={closeModal}
          onDone={() => handleDone(`${modal.student.name} has been deactivated.`)}
        />
      )}
      {modal?.type === "reactivate" && (
        <ReactivateModal
          student={modal.student}
          onClose={closeModal}
          onDone={() => handleDone(`${modal.student.name} has been reactivated.`)}
        />
      )}
      {modal?.type === "reset_password" && (
        <ResetPasswordModal
          student={modal.student}
          onClose={closeModal}
          onDone={() => handleDone(`Password reset for ${modal.student.name}.`)}
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
