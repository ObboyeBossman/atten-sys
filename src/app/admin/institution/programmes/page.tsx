"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Faculty    = { id: string; name: string };
type Department = { id: string; name: string; faculty_id: string; faculty_name: string };
type Programme  = {
  id: string;
  department_id: string;
  name: string;
  code: string;
  created_at: string;
  qual_count: number;
  dept_name: string;
  faculty_name: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitiseCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
}

function validateCode(code: string): string | null {
  if (code.length === 0) return "Code is required.";
  if (!/^[A-Z]{2,6}$/.test(code)) return "Must be 2–6 uppercase letters (A–Z only).";
  return null;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonGroup() {
  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <div className="skeleton" style={{ width: 28, height: 28, borderRadius: "var(--radius-md)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="skeleton" style={{ width: 80, height: 9, borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ width: 150, height: 12, borderRadius: "var(--radius-sm)" }} />
        </div>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
        {[1, 2].map((i) => (
          <div key={i} className="card" style={{ padding: "var(--space-4) var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div className="skeleton" style={{ height: 13, width: "60%", borderRadius: "var(--radius-sm)" }} />
                <div className="skeleton" style={{ height: 10, width: "35%", borderRadius: "var(--radius-sm)" }} />
              </div>
              <div className="skeleton" style={{ width: 38, height: 22, borderRadius: "var(--radius-sm)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Code character counter ────────────────────────────────────────────────────

function CodeHint({ code }: { code: string }) {
  const len   = code.length;
  const valid = /^[A-Z]{2,6}$/.test(code);
  const color = len === 0
    ? "var(--color-text-3)"
    : valid
      ? "var(--color-success)"
      : "var(--color-warning)";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "var(--space-1)" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
        2–6 uppercase letters only. Auto-uppercased.
      </span>
      <span style={{ fontSize: "var(--text-xs)", color, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
        {len}/6
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgrammesPage() {
  const supabase = createSupabaseBrowserClient();

  const [programmes, setProgrammes]   = useState<Programme[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filterDept, setFilterDept]   = useState<string>("all");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [showAdd, setShowAdd]           = useState(false);
  const [editTarget, setEditTarget]     = useState<Programme | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Programme | null>(null);

  const [formName,   setFormName]   = useState("");
  const [formCode,   setFormCode]   = useState("");
  const [formDeptId, setFormDeptId] = useState("");
  const [formError,  setFormError]  = useState<string | null>(null);
  const [busy, setBusy]             = useState(false);

  // ── Data load ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true); setError(null);

    const progsRes = await (supabase.from("programmes") as any).select("id, department_id, name, code, created_at").order("name");
    const deptsRes = await (supabase.from("departments") as any).select("id, name, faculty_id").order("name");
    const facsRes  = await (supabase.from("faculties") as any).select("id, name").order("name");
    const qualsRes = await (supabase.from("qualification_types") as any).select("programme_id");

    if (progsRes.error || deptsRes.error || facsRes.error) {
      setError((progsRes.error ?? deptsRes.error ?? facsRes.error)!.message);
      setLoading(false);
      return;
    }

    const rawProgs: { id: string; department_id: string; name: string; code: string; created_at: string }[] = progsRes.data ?? [];
    const depts: { id: string; name: string; faculty_id: string }[] = deptsRes.data ?? [];
    const facs: { id: string; name: string }[] = facsRes.data ?? [];
    const quals: { programme_id: string }[] = qualsRes.data ?? [];

    const facMap: Record<string, string> = {};
    facs.forEach((f) => { facMap[f.id] = f.name; });

    const deptMap: Record<string, Department> = {};
    depts.forEach((d) => {
      deptMap[d.id] = { ...d, faculty_name: facMap[d.faculty_id] ?? "Unknown Faculty" };
    });

    const qualCount: Record<string, number> = {};
    quals.forEach((q) => { qualCount[q.programme_id] = (qualCount[q.programme_id] ?? 0) + 1; });

    setDepartments(Object.values(deptMap));
    setProgrammes(
      rawProgs.map((p) => ({
        ...p,
        qual_count:   qualCount[p.id] ?? 0,
        dept_name:    deptMap[p.department_id]?.name         ?? "Unknown Department",
        faculty_name: deptMap[p.department_id]?.faculty_name ?? "Unknown Faculty",
      }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setFormName(""); setFormCode(""); setFormDeptId(departments[0]?.id ?? ""); setFormError(null);
    setShowAdd(true);
  }

  function openEdit(p: Programme) {
    setFormName(p.name); setFormCode(p.code); setFormDeptId(p.department_id); setFormError(null);
    setEditTarget(p);
  }

  function closeModals() {
    setShowAdd(false); setEditTarget(null); setDeleteTarget(null);
    setFormName(""); setFormCode(""); setFormError(null);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleAdd() {
    const name = formName.trim();
    const code = formCode.trim();
    if (!name) { setFormError("Please enter a programme name."); return; }
    const codeErr = validateCode(code);
    if (codeErr) { setFormError(codeErr); return; }
    if (!formDeptId) { setFormError("Please select a department."); return; }
    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("programmes") as any).insert({ name, code, department_id: formDeptId });
    setBusy(false);
    if (err) {
      if (err.message.includes("programmes_dept_name_unique")) setFormError("A programme with this name already exists in that department.");
      else if (err.message.includes("programmes_dept_code_unique")) setFormError("A programme with this code already exists in that department.");
      else if (err.message.includes("programmes_code_format")) setFormError("Code must be 2–6 uppercase letters only.");
      else setFormError(err.message);
      return;
    }
    closeModals(); load();
  }

  async function handleEdit() {
    if (!editTarget) return;
    const name = formName.trim();
    const code = formCode.trim();
    if (!name) { setFormError("Please enter a programme name."); return; }
    const codeErr = validateCode(code);
    if (codeErr) { setFormError(codeErr); return; }
    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("programmes") as any).update({ name, code }).eq("id", editTarget.id);
    setBusy(false);
    if (err) {
      if (err.message.includes("programmes_dept_name_unique")) setFormError("A programme with this name already exists in that department.");
      else if (err.message.includes("programmes_dept_code_unique")) setFormError("A programme with this code already exists in that department.");
      else if (err.message.includes("programmes_code_format")) setFormError("Code must be 2–6 uppercase letters only.");
      else setFormError(err.message);
      return;
    }
    closeModals(); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const { error: err } = await (supabase.from("programmes") as any).delete().eq("id", deleteTarget.id);
    setBusy(false);
    if (err) {
      setError(
        err.message.includes("foreign")
          ? `"${deleteTarget.name}" can't be removed — remove its qualification types first.`
          : err.message
      );
      closeModals(); return;
    }
    closeModals(); load();
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = filterDept === "all"
    ? programmes
    : programmes.filter((p) => p.department_id === filterDept);

  // Group by "Faculty name|||Department name" so the section header can show both
  const grouped = filtered.reduce<Record<string, Programme[]>>((acc, p) => {
    const key = `${p.faculty_name}|||${p.dept_name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  // ── Shared form body ──────────────────────────────────────────────────────

  const formBody = (isEdit: boolean) => (
    <>
      {!isEdit && (
        <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
          <label className="label">Department</label>
          {departments.length === 0 ? (
            <div className="alert alert-warning" style={{ fontSize: "var(--text-sm)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6" /><path d="M7 4v3M7 9v.5" />
              </svg>
              No departments found. Add a department first.
            </div>
          ) : (
            <select
              className="select input"
              value={formDeptId}
              onChange={(e) => setFormDeptId(e.target.value)}
            >
              <option value="" disabled>Choose a department…</option>
              {departments
                .slice()
                .sort((a, b) => `${a.faculty_name} ${a.name}`.localeCompare(`${b.faculty_name} ${b.name}`))
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.faculty_name} → {d.name}
                  </option>
                ))}
            </select>
          )}
        </div>
      )}

      <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
        <label className="label">Programme name</label>
        <input
          className="input"
          placeholder="e.g. Information Technology"
          value={formName}
          onChange={(e) => { setFormName(e.target.value); setFormError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") isEdit ? handleEdit() : handleAdd(); }}
          autoFocus
          disabled={!isEdit && departments.length === 0}
        />
      </div>

      <div className="input-group" style={{ marginBottom: "var(--space-6)" }}>
        <label className="label">Programme code</label>
        <input
          className="input"
          placeholder="e.g. ITS"
          value={formCode}
          onChange={(e) => { setFormCode(sanitiseCode(e.target.value)); setFormError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") isEdit ? handleEdit() : handleAdd(); }}
          maxLength={6}
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}
          disabled={!isEdit && departments.length === 0}
        />
        <CodeHint code={formCode} />
        {formError && (
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "var(--space-1)", marginTop: "var(--space-1)" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
            </svg>
            {formError}
          </p>
        )}
      </div>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Programmes</h1>
          <p className="page-subtitle">
            {loading
              ? "Loading…"
              : programmes.length === 0
                ? "No programmes yet — add one below"
                : `${programmes.length} programme${programmes.length === 1 ? "" : "s"} across ${departments.length} department${departments.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={openAdd}
          disabled={loading || departments.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Add Programme
        </button>
      </div>

      {/* ── No departments warning ── */}
      {!loading && departments.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" />
          </svg>
          <span style={{ flex: 1 }}>You need at least one department before creating programmes.</span>
          <a href="/admin/institution/departments" className="btn btn-sm btn-secondary">Go to Departments</a>
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

      {/* ── Department filter tabs ── */}
      {!loading && departments.length > 0 && programmes.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
          <button
            className={`btn btn-sm ${filterDept === "all" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilterDept("all")}
          >
            All ({programmes.length})
          </button>
          {departments
            .filter((d) => programmes.some((p) => p.department_id === d.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((d) => {
              const count = programmes.filter((p) => p.department_id === d.id).length;
              return (
                <button
                  key={d.id}
                  className={`btn btn-sm ${filterDept === d.id ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setFilterDept(d.id)}
                >
                  {d.name} ({count})
                </button>
              );
            })}
        </div>
      )}

      {/* ── Content area ── */}
      {loading ? (
        <div>{[1, 2].map((i) => <SkeletonGroup key={i} />)}</div>

      ) : programmes.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-8)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "var(--radius-xl)",
            background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-5)",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>No programmes yet</h3>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)", maxWidth: 380, margin: "0 auto var(--space-6)" }}>
            Programmes sit under departments — e.g. <em>Information Technology</em>{" "}
            (code: <span style={{ fontFamily: "var(--font-mono)" }}>ITS</span>) under{" "}
            <em>Department of Computing</em>.
          </p>
          <button className="btn btn-primary" onClick={openAdd} disabled={departments.length === 0}>
            Add First Programme
          </button>
        </div>

      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
          No programmes under this department yet.
        </p>

      ) : (
        /* ── Grouped by dept, with faculty breadcrumb ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, groupItems]) => {
              const [facultyName, deptName] = key.split("|||");
              return (
                <div key={key}>
                  {/* Section header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                      background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round">
                        <rect x="2" y="7" width="20" height="14" rx="1.5" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                      </svg>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {facultyName}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {deptName}
                      </span>
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize: 10 }}>{groupItems.length}</span>
                    <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                  </div>

                  {/* Programme cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
                    {groupItems.map((p) => {
                      const canDelete = p.qual_count === 0;
                      return (
                        <div
                          key={p.id}
                          className="card"
                          style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4) var(--space-5)" }}
                        >
                          {/* Icon */}
                          <div style={{
                            width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0,
                            background: "var(--color-surface-2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-2)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                            </svg>
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600, fontSize: "var(--text-sm)",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              marginBottom: 3,
                            }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--color-text-3)" }}>
                              {p.qual_count === 0
                                ? "No qualification types"
                                : `${p.qual_count} qual. type${p.qual_count === 1 ? "" : "s"}`}
                            </div>
                          </div>

                          {/* Code badge — monospace, distinct identity */}
                          <span style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            padding: "3px 8px",
                            borderRadius: "var(--radius-sm)",
                            background: "rgba(59,130,246,0.1)",
                            border: "1px solid rgba(59,130,246,0.2)",
                            color: "var(--color-secondary)",
                            flexShrink: 0,
                          }}>
                            {p.code}
                          </span>

                          {/* Actions */}
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => openEdit(p)}
                              title="Edit programme"
                            >
                              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" />
                              </svg>
                            </button>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => canDelete && setDeleteTarget(p)}
                              title={canDelete ? "Remove programme" : "Remove qualification types before deleting"}
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
              );
            })}
        </div>
      )}

      {/* ── Add modal ── */}
      {showAdd && (
        <Modal title="Add Programme" onClose={closeModals}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            Programmes sit under a department. The code is used as a prefix in student index numbers — choose it carefully.
          </p>
          {formBody(false)}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={busy || departments.length === 0}>
              {busy ? "Saving…" : "Add Programme"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <Modal title="Edit Programme" onClose={closeModals}>
          {/* Department is not editable on an existing programme */}
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--color-surface-2)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-5)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-3)",
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
            </svg>
            Department:{" "}
            <strong style={{ color: "var(--color-text-2)" }}>
              {editTarget.faculty_name} → {editTarget.dept_name}
            </strong>
          </div>
          {formBody(true)}
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
        <Modal title="Remove Programme" onClose={closeModals}>
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
              This will permanently remove{" "}
              <strong>{deleteTarget.name}</strong>{" "}
              (<span style={{ fontFamily: "var(--font-mono)" }}>{deleteTarget.code}</span>).
              This cannot be undone.
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
