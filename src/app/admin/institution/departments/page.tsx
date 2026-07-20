"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { InstitutionCard, DetailPanel, DetailRow, DetailSection } from "@/components/layout/InstitutionCard";

type Faculty    = { id: string; name: string };
type Department = { id: string; faculty_id: string; name: string; created_at: string; prog_count: number; faculty_name: string };

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

const DeptIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    <line x1="12" y1="12" x2="12" y2="16" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </svg>
);

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "var(--radius-lg)", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)", paddingTop: 4 }}>
          <div className="skeleton" style={{ height: 14, width: "65%", borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ height: 10, width: "45%", borderRadius: "var(--radius-sm)" }} />
        </div>
        <div className="skeleton" style={{ width: 72, height: 24, borderRadius: "var(--radius-full)" }} />
      </div>
      <div className="skeleton" style={{ height: 1 }} />
      <div className="skeleton" style={{ height: 10, width: "30%", borderRadius: "var(--radius-sm)" }} />
    </div>
  );
}

export default function DepartmentsPage() {
  const supabase = createSupabaseBrowserClient();
  const [depts, setDepts]         = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [filterFac, setFilterFac] = useState<string>("all");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [showAdd, setShowAdd]           = useState(false);
  const [editTarget, setEditTarget]     = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [detailTarget, setDetailTarget] = useState<Department | null>(null);
  const [formName, setFormName]         = useState("");
  const [formFacId, setFormFacId]       = useState("");
  const [formError, setFormError]       = useState<string | null>(null);
  const [busy, setBusy]                 = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const deptsRes = await (supabase.from("departments") as any).select("id, faculty_id, name, created_at").order("name");
    const facsRes  = await (supabase.from("faculties") as any).select("id, name").order("name");
    const progsRes = await (supabase.from("programmes") as any).select("department_id");
    if (deptsRes.error || facsRes.error) { setError((deptsRes.error ?? facsRes.error)!.message); setLoading(false); return; }
    const rawDepts: { id: string; faculty_id: string; name: string; created_at: string }[] = deptsRes.data ?? [];
    const facs: Faculty[] = facsRes.data ?? [];
    const progs: { department_id: string }[] = progsRes.data ?? [];
    const facMap: Record<string, string> = {};
    facs.forEach((f) => { facMap[f.id] = f.name; });
    const progCount: Record<string, number> = {};
    progs.forEach((p) => { progCount[p.department_id] = (progCount[p.department_id] ?? 0) + 1; });
    setFaculties(facs);
    setDepts(rawDepts.map((d) => ({ ...d, prog_count: progCount[d.id] ?? 0, faculty_name: facMap[d.faculty_id] ?? "Unknown" })));
    setLoading(false);
  }, [supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openAdd() { setFormName(""); setFormFacId(faculties[0]?.id ?? ""); setFormError(null); setShowAdd(true); }
  function openEdit(d: Department) { setFormName(d.name); setFormFacId(d.faculty_id); setFormError(null); setEditTarget(d); }
  function closeModals() { setShowAdd(false); setEditTarget(null); setDeleteTarget(null); setFormName(""); setFormFacId(""); setFormError(null); }

  async function handleAdd() {
    const name = formName.trim();
    if (!name)      { setFormError("Please enter a department name."); return; }
    if (!formFacId) { setFormError("Please select a faculty."); return; }
    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("departments") as any).insert({ name, faculty_id: formFacId });
    setBusy(false);
    if (err) { setFormError(err.message.includes("unique") ? "A department with this name already exists in that faculty." : err.message); return; }
    closeModals(); load();
  }

  async function handleEdit() {
    if (!editTarget) return;
    const name = formName.trim();
    if (!name) { setFormError("Please enter a department name."); return; }
    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("departments") as any).update({ name }).eq("id", editTarget.id);
    setBusy(false);
    if (err) { setFormError(err.message.includes("unique") ? "A department with this name already exists in that faculty." : err.message); return; }
    if (detailTarget?.id === editTarget.id) setDetailTarget({ ...detailTarget, name });
    closeModals(); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const { error: err } = await (supabase.from("departments") as any).delete().eq("id", deleteTarget.id);
    setBusy(false);
    if (err) {
      setError(err.message.includes("foreign") ? `"${deleteTarget.name}" can't be removed — remove its programmes first.` : err.message);
      closeModals(); return;
    }
    if (detailTarget?.id === deleteTarget.id) setDetailTarget(null);
    closeModals(); load();
  }

  const filtered = filterFac === "all" ? depts : depts.filter((d) => d.faculty_id === filterFac);

  const grouped = filtered.reduce<Record<string, Department[]>>((acc, d) => {
    if (!acc[d.faculty_id]) acc[d.faculty_id] = [];
    acc[d.faculty_id].push(d);
    return acc;
  }, {});

  const formBody = () => (
    <>
      {!editTarget && (
        <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
          <label className="label">Faculty</label>
          {faculties.length === 0 ? (
            <div className="alert alert-warning" style={{ fontSize: "var(--text-sm)" }}>No faculties yet — add a faculty first.</div>
          ) : (
            <select className="input" style={{ appearance: "auto" }} value={formFacId} onChange={(e) => setFormFacId(e.target.value)}>
              <option value="" disabled>Choose a faculty…</option>
              {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
        </div>
      )}
      <div className="input-group" style={{ marginBottom: "var(--space-6)" }}>
        <label className="label">Department name</label>
        <input
          className={`input${formError ? " input-error" : ""}`}
          placeholder="e.g. Department of Information Technology"
          value={formName}
          onChange={(e) => { setFormName(e.target.value); setFormError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") editTarget ? handleEdit() : handleAdd(); }}
          autoFocus
          disabled={!editTarget && faculties.length === 0}
        />
        {formError && (
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" /></svg>
            {formError}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">
            {loading ? "Loading…" : depts.length === 0 ? "No departments yet" : `${depts.length} department${depts.length === 1 ? "" : "s"} across ${faculties.filter((f) => depts.some((d) => d.faculty_id === f.id)).length} ${faculties.length === 1 ? "faculty" : "faculties"}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} disabled={loading || faculties.length === 0}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 1v12M1 7h12" /></svg>
          Add Department
        </button>
      </div>

      {!loading && faculties.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" /></svg>
          <span style={{ flex: 1 }}>You need at least one faculty before creating departments.</span>
          <a href="/admin/institution/faculties" className="btn btn-sm btn-secondary">Go to Faculties</a>
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" /></svg>
          <span style={{ flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Faculty filter tabs */}
      {!loading && faculties.length > 0 && depts.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
          <button className={`btn btn-sm ${filterFac === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilterFac("all")}>
            All ({depts.length})
          </button>
          {faculties.filter((f) => depts.some((d) => d.faculty_id === f.id)).map((f) => {
            const count = depts.filter((d) => d.faculty_id === f.id).length;
            return (
              <button key={f.id} className={`btn btn-sm ${filterFac === f.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilterFac(f.id)}>
                {f.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : depts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-8)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "var(--radius-xl)", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-5)", color: "#a855f7" }}>
            <DeptIcon />
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>No departments yet</h3>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)", maxWidth: 340, margin: "0 auto var(--space-6)" }}>Departments sit under faculties. Add them before creating programmes.</p>
          <button className="btn btn-primary" onClick={openAdd} disabled={faculties.length === 0}>Add First Department</button>
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>No departments in this faculty yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          {Object.entries(grouped).sort(([a], [b]) => {
            const fa = faculties.find((f) => f.id === a)?.name ?? "";
            const fb = faculties.find((f) => f.id === b)?.name ?? "";
            return fa.localeCompare(fb);
          }).map(([facId, items]) => {
            const fac = faculties.find((f) => f.id === facId);
            return (
              <div key={facId}>
                {/* Faculty group header */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round"><path d="M3 21h18M3 21V7l9-5 9 5v14M9 21V13h6v8" /></svg>
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{fac?.name ?? "Unknown Faculty"}</span>
                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>{items.length}</span>
                  <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
                  {items.map((d) => {
                    const canDelete = d.prog_count === 0;
                    return (
                      <InstitutionCard
                        key={d.id}
                        accent="purple"
                        icon={<DeptIcon />}
                        title={d.name}
                        meta={d.faculty_name}
                        badge={d.prog_count === 0 ? "No programmes" : `${d.prog_count} programme${d.prog_count === 1 ? "" : "s"}`}
                        badgeVariant={d.prog_count === 0 ? "neutral" : "success"}
                        footer={`Added ${new Date(d.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}`}
                        onClick={() => setDetailTarget(d)}
                        actions={
                          <>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(d)} title="Rename">
                              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" /></svg>
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => canDelete && setDeleteTarget(d)} title={canDelete ? "Remove" : "Remove programmes first"} disabled={!canDelete} style={{ color: canDelete ? "var(--color-danger)" : undefined }}>
                              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" /></svg>
                            </button>
                          </>
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      <DetailPanel open={!!detailTarget} onClose={() => setDetailTarget(null)} title={detailTarget?.name ?? ""} subtitle={detailTarget?.faculty_name} accent="purple" icon={<DeptIcon />}>
        {detailTarget && (
          <>
            <DetailSection title="Details">
              <DetailRow label="Faculty" value={detailTarget.faculty_name} />
              <DetailRow label="Programmes" value={detailTarget.prog_count === 0 ? "None" : `${detailTarget.prog_count} programme${detailTarget.prog_count === 1 ? "" : "s"}`} />
              <DetailRow label="Added" value={new Date(detailTarget.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" })} />
            </DetailSection>
            <div style={{ display: "flex", gap: "var(--space-3)", paddingTop: "var(--space-2)" }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(detailTarget)}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" /></svg>
                Rename
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} disabled={detailTarget.prog_count > 0} title={detailTarget.prog_count > 0 ? "Remove programmes first" : "Remove"} onClick={() => { setDeleteTarget(detailTarget); setDetailTarget(null); }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" /></svg>
                {detailTarget.prog_count > 0 ? "Has programmes" : "Remove"}
              </button>
            </div>
          </>
        )}
      </DetailPanel>

      {/* Add modal */}
      {showAdd && (
        <Modal title="Add Department" onClose={closeModals}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            Departments sit inside a faculty — e.g. <em>Department of Computer Science</em> under <em>Faculty of Engineering</em>.
          </p>
          {formBody()}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={busy || faculties.length === 0}>{busy ? "Saving…" : "Add Department"}</button>
          </div>
        </Modal>
      )}

      {editTarget && (
        <Modal title="Rename Department" onClose={closeModals}>
          {formBody()}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Remove Department" onClose={closeModals}>
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
