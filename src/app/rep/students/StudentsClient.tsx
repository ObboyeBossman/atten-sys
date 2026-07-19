"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { removeStudentFromGroup } from "./actions";

/* ── Types ───────────────────────────────────────────────────────────────── */
export type StudentRow = {
  id: string;
  name: string;
  index_number: string;
  is_course_rep: boolean;
  is_active: boolean;
  joined_at: string;
};

type Props = {
  students: StudentRow[];
  total: number;
  groupName: string;
  searchQuery: string;
};

type Modal =
  | { type: "remove"; student: StudentRow };

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function RepBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: "var(--radius-full)",
        background: "rgba(139,92,246,0.12)",
        color: "#a78bfa",
        border: "1px solid rgba(139,92,246,0.25)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      Rep
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      title={active ? "Active" : "Inactive"}
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: active ? "var(--color-success)" : "var(--color-danger)",
        boxShadow: active
          ? "0 0 0 2px rgba(34,197,94,0.2)"
          : "0 0 0 2px rgba(239,68,68,0.15)",
        flexShrink: 0,
      }}
    />
  );
}

function fmtJoined(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* ── Remove modal ────────────────────────────────────────────────────────── */
function RemoveModal({
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
      const result = await removeStudentFromGroup(student.id);
      if ("error" in result) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: "var(--radius-lg)",
                background: "rgba(239,68,68,0.1)", display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "var(--color-danger)", flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M2 4h12M6 4V2h4v2M13 4l-.8 9.2A1.5 1.5 0 0 1 10.7 14H5.3a1.5 1.5 0 0 1-1.5-1.4L3 4" />
                <path d="M6.5 7v4M9.5 7v4" />
              </svg>
            </div>
            <div>
              <h3 className="modal-title">Remove from Group</h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", margin: 0 }}>
                Their attendance records are preserved
              </p>
            </div>
          </div>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", margin: 0 }}>
            Remove{" "}
            <strong style={{ color: "var(--color-text)" }}>{student.name}</strong>{" "}
            ({student.index_number}) from your group? They will lose access to
            group sessions but all past attendance data is kept intact.
          </p>
          {student.is_course_rep && (
            <div className="alert alert-danger" style={{ marginTop: "var(--space-3)", fontSize: "var(--text-xs)" }}>
              This student is the course rep — removing them will also clear the rep role.
            </div>
          )}
          {error && (
            <div className="alert alert-danger" style={{ marginTop: "var(--space-3)", fontSize: "var(--text-xs)" }}>
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={isPending}>
            Cancel
          </button>
          <button onClick={handleConfirm} className="btn btn-danger btn-sm" disabled={isPending}>
            {isPending ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function StudentsClient({ students, total, groupName, searchQuery }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

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
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function closeModal() { setModal(null); }
  function handleDone(msg: string) { closeModal(); showToast(msg); }

  const activeCount = students.filter((s) => s.is_active).length;

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
        @keyframes modal-in {
          from { opacity:0; transform: scale(0.96) translateY(8px); }
          to { opacity:1; transform: none; }
        }
        .modal-header { padding: var(--space-5) var(--space-5) 0; }
        .modal-title { font-size: var(--text-base); font-weight: 700; color: var(--color-text); margin: 0; }
        .modal-body { padding: var(--space-4) var(--space-5); }
        .modal-footer {
          padding: 0 var(--space-5) var(--space-5);
          display: flex; justify-content: flex-end; gap: var(--space-2);
        }

        .roster-toolbar {
          display: flex; align-items: center; gap: var(--space-3);
          margin-bottom: var(--space-4); flex-wrap: wrap;
        }
        .roster-search { position: relative; flex: 1; min-width: 200px; max-width: 300px; }
        .roster-search input { width: 100%; padding-left: 34px; }
        .roster-search-icon {
          position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
          color: var(--color-text-3); pointer-events: none;
        }

        .roster-table-wrap { overflow-x: auto; }
        table.roster-table {
          width: 100%; border-collapse: collapse; font-size: var(--text-sm);
        }
        .roster-table th {
          text-align: left; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.05em;
          color: var(--color-text-3); padding: var(--space-2) var(--space-4);
          border-bottom: 1px solid var(--color-border); white-space: nowrap;
        }
        .roster-table td {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text-2); vertical-align: middle;
        }
        .roster-table tr:last-child td { border-bottom: none; }
        .roster-table tr:hover td { background: var(--color-surface-2); }

        .student-avatar {
          width: 32px; height: 32px; border-radius: "50%";
          border-radius: 50%; background: var(--color-surface-3);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: var(--color-text-2);
          flex-shrink: 0; border: 1px solid var(--color-border);
        }
        .student-name-cell {
          display: flex; align-items: center; gap: var(--space-3);
        }
        .student-name { font-weight: 600; color: var(--color-text); }
        .student-index {
          font-family: var(--font-mono); font-size: 12px; color: var(--color-text-3);
          margin-top: 1px;
        }

        .row-actions {
          display: flex; align-items: center; gap: var(--space-1); justify-content: flex-end;
        }

        .empty-state {
          padding: var(--space-12) var(--space-6);
          text-align: center; color: var(--color-text-3);
        }
        .empty-state p { font-size: var(--text-sm); margin: var(--space-2) 0 0; }

        .toast {
          position: fixed; bottom: var(--space-6); right: var(--space-6); z-index: 100;
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-lg); font-size: var(--text-sm); font-weight: 500;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          display: flex; align-items: center; gap: var(--space-2);
          animation: toast-in 0.2s ease;
        }
        @keyframes toast-in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: none; } }
        .toast-success {
          background: var(--color-surface-2);
          border: 1px solid rgba(34,197,94,0.3); color: var(--color-success);
        }
        .toast-error {
          background: var(--color-surface-2);
          border: 1px solid rgba(239,68,68,0.3); color: var(--color-danger);
        }
      `}</style>

      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          padding: "var(--space-3) var(--space-5)",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-xl)",
          marginBottom: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--color-text-3)" }}>
            <circle cx="7" cy="6" r="3" />
            <circle cx="13" cy="6" r="3" />
            <path d="M1 18c0-3.31 2.69-6 6-6M13 12c3.31 0 6 2.69 6 6" />
          </svg>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", fontWeight: 500 }}>
            {total} enrolled
          </span>
        </div>
        <div
          style={{
            width: 1, height: 14,
            background: "var(--color-border)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <StatusDot active={true} />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)" }}>
            {activeCount} active
          </span>
        </div>
        {total - activeCount > 0 && (
          <>
            <div style={{ width: 1, height: 14, background: "var(--color-border)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <StatusDot active={false} />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)" }}>
                {total - activeCount} inactive
              </span>
            </div>
          </>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-3)",
          }}
        >
          {groupName}
        </span>
      </div>

      {/* Toolbar */}
      <div className="roster-toolbar">
        <div className="roster-search">
          <span className="roster-search-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="5" />
              <path d="M10.5 10.5l3.5 3.5" />
            </svg>
          </span>
          <input
            type="search"
            className="input input-sm"
            placeholder="Search name or index…"
            defaultValue={searchQuery}
            onChange={(e: { target: { value: string } }) =>
              updateParams({ q: e.target.value })
            }
          />
        </div>

        <a href="/rep/students/add" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="8" cy="7" r="4" />
            <path d="M2 18c0-3.31 2.69-6 6-6M14 11v6M11 14h6" />
          </svg>
          Add Student
        </a>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {students.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.35 }}>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <p>
              {searchQuery
                ? `No students match "${searchQuery}"`
                : "No students enrolled yet — add your first student."}
            </p>
            {!searchQuery && (
              <a href="/rep/students/add" className="btn btn-primary" style={{ marginTop: "var(--space-4)", display: "inline-flex" }}>
                Add Student
              </a>
            )}
          </div>
        ) : (
          <div className="roster-table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Index No.</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="student-name-cell">
                        <div className="student-avatar" aria-hidden="true">
                          {initials(s.name)}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <span className="student-name">{s.name}</span>
                            {s.is_course_rep && <RepBadge />}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="student-index">{s.index_number}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <StatusDot active={s.is_active} />
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                          {s.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                        {fmtJoined(s.joined_at)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}
                          onClick={() => setModal({ type: "remove", student: s })}
                          title="Remove from group"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                            <path d="M2 4h12M6 4V2h4v2M13 4l-.8 9.2A1.5 1.5 0 0 1 10.7 14H5.3a1.5 1.5 0 0 1-1.5-1.4L3 4" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === "remove" && (
        <RemoveModal
          student={modal.student}
          onClose={closeModal}
          onDone={() => handleDone(`${modal.student.name} removed from group.`)}
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
