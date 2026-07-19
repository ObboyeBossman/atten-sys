"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { InstitutionCard, DetailPanel, DetailRow, DetailSection } from "@/components/layout/InstitutionCard";

type Faculty = { id: string; name: string; created_at: string; dept_count: number };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="modal-box">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const FacultyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M3 21h18M3 21V7l9-5 9 5v14M9 21V13h6v8" />
  </svg>
);

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "var(--radius-lg)", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)", paddingTop: 4 }}>
          <div className="skeleton" style={{ height: 14, width: "70%", borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ height: 10, width: "40%", borderRadius: "var(--radius-sm)" }} />
        </div>
        <div className="skeleton" style={{ width: 72, height: 24, borderRadius: "var(--radius-full)" }} />
      </div>
      <div className="skeleton" style={{ height: 1 }} />
      <div className="skeleton" style={{ height: 10, width: "35%", borderRadius: "var(--radius-sm)" }} />
    </div>
  );
}

export default function FacultiesPage() {
  const supabase = createSupabaseBrowserClient();
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [showAdd, setShowAdd]           = useState(false);
  const [editTarget, setEditTarget]     = useState<Faculty | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Faculty | null>(null);
  const [detailTarget, setDetailTarget] = useState<Faculty | null>(null);
  const [formName, setFormName]         = useState("");
  const [formError, setFormError]       = useState<string | null>(null);
  const [busy, setBusy]                 = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const facsRes  = await (supabase.from("faculties") as any).select("id, name, created_at").order("name");
    const deptsRes = await (supabase.from("departments") as any).select("faculty_id");
    if (facsRes.error) { setError(facsRes.error.message); setLoading(false); return; }
    const facs: { id: string; name: string; created_at: string }[] = facsRes.data ?? [];
    const depts: { faculty_id: string }[] = deptsRes.data ?? [];
    const countMap: Record<string, number> = {};
    depts.forEach((d) => { countMap[d.faculty_id] = (countMap[d.faculty_id] ?? 0) + 1; });
    setFaculties(facs.map((f) => ({ ...f, dept_count: countMap[f.id] ?? 0 })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setFormName(""); setFormError(null); setShowAdd(true); }
  function openEdit(f: Faculty) { setFormName(f.name); setFormError(null); setEditTarget(f); }
  function closeModals() { setShowAdd(false); setEditTarget(null); setDeleteTarget(null); setFormName(""); setFormError(null); }

  async function handleAdd() {
    const name = formName.trim();
    if (!name) { setFormError("Please enter a faculty name."); return; }
    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("faculties") as any).insert({ name });
    setBusy(false);
    if (err) { setFormError(err.message.includes("unique") ? "A faculty with this name already exists." : err.message); return; }
    closeModals(); load();
  }

  async function handleEdit() {
    if (!editTarget) return;
    const name = formName.trim();
    if (!name) { setFormError("Please enter a faculty name."); return; }
    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("faculties") as any).update({ name }).eq("id", editTarget.id);
    setBusy(false);
    if (err) { setFormError(err.message.includes("unique") ? "A faculty with this name already exists." : err.message); return; }
    if (detailTarget?.id === editTarget.id) setDetailTarget({ ...editTarget, name });
    closeModals(); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const { error: err } = await (supabase.from("faculties") as any).delete().eq("id", deleteTarget.id);
    setBusy(false);
    if (err) {
      setError(err.message.includes("foreign") ? `"${deleteTarget.name}" can't be removed — remove its departments first.` : err.message);
      closeModals(); return;
    }
    if (detailTarget?.id === deleteTarget.id) setDetailTarget(null);
    closeModals(); load();
  }

  const nameField = (onAction: () => void) => (
    <div className="input-group" style={{ marginBottom: "var(--space-6)" }}>
      <label className="label">Faculty name</label>
      <input
        className={`input${formError ? " input-error" : ""}`}
        placeholder="e.g. Faculty of Applied Science and Technology"
        value={formName}
        onChange={(e) => { setFormName(e.target.value); setFormError(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") onAction(); }}
        autoFocus
      />
      {formError && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" /></svg>
          {formError}
        </p>
      )}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Faculties</h1>
          <p className="page-subtitle">
            {loading ? "Loading…" : faculties.length === 0 ? "No faculties yet — add the first one" : `${faculties.length} ${faculties.length === 1 ? "faculty" : "faculties"}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} disabled={loading}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 1v12M1 7h12" /></svg>
          Add Faculty
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" /></svg>
          <span style={{ flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : faculties.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-8)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "var(--radius-xl)", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-5)", color: "var(--color-secondary)" }}>
            <FacultyIcon />
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>No faculties yet</h3>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)", maxWidth: 340, margin: "0 auto var(--space-6)" }}>
            Faculties are the top level of your institution structure. Add them first before creating departments or programmes.
          </p>
          <button className="btn btn-primary" onClick={openAdd}>Add First Faculty</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
          {faculties.map((f) => {
            const canDelete = f.dept_count === 0;
            return (
              <InstitutionCard
                key={f.id}
                accent="blue"
                icon={<FacultyIcon />}
                title={f.name}
                badge={f.dept_count === 0 ? "No departments" : `${f.dept_count} dept${f.dept_count === 1 ? "" : "s"}`}
                badgeVariant={f.dept_count === 0 ? "neutral" : "info"}
                footer={`Added ${new Date(f.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}`}
                onClick={() => setDetailTarget(f)}
                actions={
                  <>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(f)} title="Rename">
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" /></svg>
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => canDelete && setDeleteTarget(f)} title={canDelete ? "Remove" : "Remove departments first"} disabled={!canDelete} style={{ color: canDelete ? "var(--color-danger)" : undefined }}>
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" /></svg>
                    </button>
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      <DetailPanel open={!!detailTarget} onClose={() => setDetailTarget(null)} title={detailTarget?.name ?? ""} subtitle="Faculty" accent="blue" icon={<FacultyIcon />}>
        {detailTarget && (
          <>
            <DetailSection title="Details">
              <DetailRow label="Departments" value={detailTarget.dept_count === 0 ? "None" : `${detailTarget.dept_count} department${detailTarget.dept_count === 1 ? "" : "s"}`} />
              <DetailRow label="Added" value={new Date(detailTarget.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" })} />
            </DetailSection>
            <div style={{ display: "flex", gap: "var(--space-3)", paddingTop: "var(--space-2)" }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(detailTarget)}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" /></svg>
                Rename
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} disabled={detailTarget.dept_count > 0} title={detailTarget.dept_count > 0 ? "Remove departments first" : "Remove faculty"} onClick={() => { setDeleteTarget(detailTarget); setDetailTarget(null); }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" /></svg>
                {detailTarget.dept_count > 0 ? "Has departments" : "Remove"}
              </button>
            </div>
          </>
        )}
      </DetailPanel>

      {/* Add modal */}
      {showAdd && (
        <Modal title="Add Faculty" onClose={closeModals}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            A faculty is the highest level grouping — e.g. <em>Faculty of Engineering</em>.
          </p>
          {nameField(handleAdd)}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={busy}>{busy ? "Saving…" : "Add Faculty"}</button>
          </div>
        </Modal>
      )}

      {editTarget && (
        <Modal title="Rename Faculty" onClose={closeModals}>
          {nameField(handleEdit)}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Remove Faculty" onClose={closeModals}>
          <div style={{ padding: "var(--space-4)", background: "var(--color-danger-bg)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-lg)", marginBottom: "var(--space-5)", display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-danger)" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M8 2L1 14h14L8 2zM8 6v4M8 11.5v.5" /></svg>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", lineHeight: 1.6, margin: 0 }}>This will permanently remove <strong>{deleteTarget.name}</strong>. This cannot be undone.</p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Keep It</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={busy}>{busy ? "Removing…" : "Yes, Remove"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
