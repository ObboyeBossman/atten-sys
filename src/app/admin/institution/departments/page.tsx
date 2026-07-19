"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Faculty = { id: string; name: string };
type Department = {
  id: string;
  faculty_id: string;
  name: string;
  created_at: string;
  prog_count: number;
  faculty_name: string;
};

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-box">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SkeletonGroup() {
  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <div className="skeleton" style={{ width: 28, height: 28, borderRadius: "var(--radius-md)" }} />
        <div className="skeleton" style={{ width: 160, height: 12, borderRadius: "var(--radius-sm)" }} />
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-3)" }}>
        {[1, 2].map((i) => (
          <div key={i} className="card" style={{ padding: "var(--space-4) var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div className="skeleton" style={{ height: 13, width: "65%", borderRadius: "var(--radius-sm)" }} />
                <div className="skeleton" style={{ height: 10, width: "40%", borderRadius: "var(--radius-sm)" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const supabase = createSupabaseBrowserClient();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [filterFaculty, setFilterFaculty] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [formName, setFormName] = useState("");
  const [formFacultyId, setFormFacultyId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);

    const deptsRes = await supabase.from("departments").select("id, faculty_id, name, created_at").order("name");
    const facsRes  = await supabase.from("faculties").select("id, name").order("name");
    const progsRes = await supabase.from("programmes").select("department_id");

    if (deptsRes.error || facsRes.error) {
      setError((deptsRes.error ?? facsRes.error)!.message);
      setLoading(false);
      return;
    }

    const depts = (deptsRes.data ?? []) as Array<{ id: string; faculty_id: string; name: string; created_at: string }>;
    const facs  = (facsRes.data  ?? []) as Array<{ id: string; name: string }>;
    const progs = (progsRes.data ?? []) as Array<{ department_id: string }>;

    const facMap: Record<string, string> = {};
    facs.forEach((f) => { facMap[f.id] = f.name; });

    const progCount: Record<string, number> = {};
    progs.forEach((p) => { progCount[p.department_id] = (progCount[p.department_id] ?? 0) + 1; });

    setFaculties(facs);
    setDepartments(
      depts.map((d) => ({
        ...d,
        faculty_name: facMap[d.faculty_id] ?? "Unknown Faculty",
        prog_count: progCount[d.id] ?? 0,
      }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setFormName("");
    setFormFacultyId(faculties[0]?.id ?? "");
    setFormError(null);
    setShowAdd(true);
  }
  function openEdit(d: Department) {
    setFormName(d.name);
    setFormFacultyId(d.faculty_id);
    setFormError(null);
    setEditTarget(d);
  }
  function closeModals() {
    setShowAdd(false); setEditTarget(null); setDeleteTarget(null);
    setFormName(""); setFormError(null);
  }

  async function handleAdd() {
    const name = formName.trim();
    if (!name) { setFormError("Please enter a department name."); return; }
    if (!formFacultyId) { setFormError("Please select a faculty."); return; }
    setBusy(true); setFormError(null);
    const { error: err } = await supabase.from("departments").insert({ name, faculty_id: formFacultyId });
    setBusy(false);
    if (err) {
      setFormError(err.message.includes("unique") ? "This department already exists under that faculty." : err.message);
      return;
    }
    closeModals(); load();
  }

  async function handleEdit() {
    if (!editTarget) return;
    const name = formName.trim();
    if (!name) { setFormError("Please enter a department name."); return; }
    if (!formFacultyId) { setFormError("Please select a faculty."); return; }
    setBusy(true); setFormError(null);
    const { error: err } = await supabase.from("departments").update({ name, faculty_id: formFacultyId }).eq("id", editTarget.id);
    setBusy(false);
    if (err) {
      setFormError(err.message.includes("unique") ? "This department already exists under that faculty." : err.message);
      return;
    }
    closeModals(); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const { error: err } = await supabase.from("departments").delete().eq("id", deleteTarget.id);
    setBusy(false);
    if (err) {
      setError(
        err.message.includes("foreign")
          ? `"${deleteTarget.name}" can't be removed — remove its programmes first.`
          : err.message
      );
      closeModals(); return;
    }
    closeModals(); load();
  }

  const filtered = filterFaculty === "all" ? departments : departments.filter((d) => d.faculty_id === filterFaculty);
  const grouped = filtered.reduce<Record<string, Department[]>>((acc, d) => {
    if (!acc[d.faculty_name]) acc[d.faculty_name] = [];
    acc[d.faculty_name].push(d);
    return acc;
  }, {});

  // Shared form fields — rendered inline (not as a sub-component) to avoid remount issues
  const deptFormFields = (
    <>
      {/* Faculty selector */}
      <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
        <label className="label">Faculty</label>
        {faculties.length === 0 ? (
          <div className="alert alert-warning" style={{ fontSize: "var(--text-sm)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="6" /><path d="M7 4v3M7 9v.5" />
            </svg>
            No faculties found. Add a faculty first.
          </div>
        ) : (
          <select
            className="select input"
            value={formFacultyId}
            onChange={(e) => setFormFacultyId(e.target.value)}
          >
            <option value="" disabled>Choose a faculty…</option>
            {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
      </div>

      {/* Department name */}
      <div className="input-group" style={{ marginBottom: "var(--space-6)" }}>
        <label className="label">Department name</label>
        <input
          className={`input${formError ? " input-error" : ""}`}
          placeholder="e.g. Department of Computer Science"
          value={formName}
          onChange={(e) => { setFormName(e.target.value); setFormError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") editTarget ? handleEdit() : handleAdd();
          }}
          autoFocus
          disabled={faculties.length === 0}
        />
        {formError && (
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
            </svg>
            {formError}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">
            {loading
              ? "Loading…"
              : departments.length === 0
                ? "No departments yet — add one below"
                : `${departments.length} department${departments.length === 1 ? "" : "s"} across ${faculties.length} ${faculties.length === 1 ? "faculty" : "faculties"}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} disabled={loading || faculties.length === 0}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Add Department
        </button>
      </div>

      {/* ── No faculties callout ── */}
      {!loading && faculties.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" />
          </svg>
          <span style={{ flex: 1 }}>You need at least one faculty before creating departments.</span>
          <a href="/admin/institution/faculties" className="btn btn-sm btn-secondary">Go to Faculties</a>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" />
          </svg>
          <span style={{ flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* ── Faculty filter tabs ── */}
      {!loading && faculties.length > 0 && departments.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
          <button
            className={`btn btn-sm ${filterFaculty === "all" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilterFaculty("all")}
          >
            All ({departments.length})
          </button>
          {faculties.map((f) => {
            const count = departments.filter((d) => d.faculty_id === f.id).length;
            if (count === 0) return null;
            return (
              <button
                key={f.id}
                className={`btn btn-sm ${filterFaculty === f.id ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setFilterFaculty(f.id)}
              >
                {f.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div>{[1, 2].map((i) => <SkeletonGroup key={i} />)}</div>
      ) : departments.length === 0 ? (
        /* ── Empty state ── */
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-8)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "var(--radius-xl)",
            background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-5)",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="1.5" strokeLinecap="round">
              <rect x="2" y="7" width="20" height="14" rx="1.5" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
            </svg>
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>No departments yet</h3>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)", maxWidth: 360, margin: "0 auto var(--space-6)" }}>
            Departments sit under faculties and group related programmes — e.g. <em>Department of Computer Science</em> under <em>Faculty of Applied Science</em>.
          </p>
          <button className="btn btn-primary" onClick={openAdd} disabled={faculties.length === 0}>
            Add First Department
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>No departments under this faculty yet.</p>
      ) : (
        /* ── Grouped list ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([facultyName, depts]) => (
              <div key={facultyName}>
                {/* Group heading */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                    background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 21h18M3 21V7l9-5 9 5v14M9 21V13h6v8" />
                    </svg>
                  </div>
                  <span style={{
                    fontSize: "var(--text-xs)", fontWeight: 700,
                    color: "var(--color-text-2)", textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    {facultyName}
                  </span>
                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>{depts.length}</span>
                  <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                </div>

                {/* Department cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-3)" }}>
                  {depts.map((d) => {
                    const canDelete = d.prog_count === 0;
                    return (
                      <div
                        key={d.id}
                        className="card"
                        style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4) var(--space-5)" }}
                      >
                        {/* Icon */}
                        <div style={{
                          width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0,
                          background: "var(--color-surface-2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-2)" strokeWidth="1.75" strokeLinecap="round">
                            <rect x="2" y="7" width="20" height="14" rx="1.5" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                          </svg>
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {d.name}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--color-text-3)", marginTop: 2 }}>
                            {d.prog_count === 0 ? "No programmes" : `${d.prog_count} programme${d.prog_count === 1 ? "" : "s"}`}
                            {" · "}
                            {new Date(d.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => openEdit(d)}
                            title="Edit department"
                          >
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" />
                            </svg>
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => canDelete && setDeleteTarget(d)}
                            title={canDelete ? "Remove department" : "Remove its programmes before deleting"}
                            disabled={!canDelete}
                            style={{ color: canDelete ? "var(--color-danger)" : undefined }}
                          >
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                              <path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── Add modal ── */}
      {showAdd && (
        <Modal title="Add Department" onClose={closeModals}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            Departments sit inside a faculty and group related programmes together.
          </p>
          {deptFormFields}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={busy || faculties.length === 0}>
              {busy ? "Saving…" : "Add Department"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <Modal title="Edit Department" onClose={closeModals}>
          {deptFormFields}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={busy}>
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <Modal title="Remove Department" onClose={closeModals}>
          <div style={{
            padding: "var(--space-4)",
            background: "var(--color-danger-bg)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-5)",
            display: "flex", gap: "var(--space-3)", alignItems: "flex-start",
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-danger)" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M8 2L1 14h14L8 2zM8 6v4M8 11.5v.5" />
            </svg>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", lineHeight: 1.6, margin: 0 }}>
              This will permanently remove <strong>{deleteTarget.name}</strong> from{" "}
              <strong>{deleteTarget.faculty_name}</strong>. This cannot be undone.
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Keep It</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={busy}>
              {busy ? "Removing…" : "Yes, Remove"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
