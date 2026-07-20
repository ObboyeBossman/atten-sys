"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { InstitutionCard, DetailPanel, DetailRow, DetailSection } from "@/components/layout/InstitutionCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type Programme = {
  id: string;
  name: string;
  code: string;
  dept_name: string;
  faculty_name: string;
};

type QualType = {
  id: string;
  programme_id: string;
  name: string;
  code: string;
  created_at: string;
  level_count: number;
  prog_name: string;
  prog_code: string;
  dept_name: string;
  faculty_name: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitiseCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
}

function validateCode(code: string): string | null {
  if (code.length === 0) return "Code is required.";
  if (!/^[A-Z]{1,6}$/.test(code)) return "Must be 1–6 uppercase letters (A–Z only).";
  return null;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

// ── Icons ─────────────────────────────────────────────────────────────────────

const QualIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-7 10 7-10 7-10-7z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

// ── Code hint ─────────────────────────────────────────────────────────────────

function CodeHint({ code }: { code: string }) {
  const len = code.length;
  const valid = /^[A-Z]{1,6}$/.test(code);
  const color = len === 0 ? "var(--color-text-3)" : valid ? "var(--color-success)" : "var(--color-warning)";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "var(--space-1)" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>1–6 uppercase letters only. Auto-uppercased.</span>
      <span style={{ fontSize: "var(--text-xs)", color, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{len}/6</span>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "var(--radius-lg)", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)", paddingTop: 4 }}>
          <div className="skeleton" style={{ height: 14, width: "60%", borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ height: 10, width: "40%", borderRadius: "var(--radius-sm)" }} />
        </div>
        <div className="skeleton" style={{ width: 52, height: 22, borderRadius: "var(--radius-full)" }} />
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <div className="skeleton" style={{ width: 36, height: 20, borderRadius: "var(--radius-full)" }} />
        <div className="skeleton" style={{ width: 36, height: 20, borderRadius: "var(--radius-full)" }} />
      </div>
      <div className="skeleton" style={{ height: 1 }} />
      <div className="skeleton" style={{ height: 10, width: "28%", borderRadius: "var(--radius-sm)" }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QualificationTypesPage() {
  const supabase = createSupabaseBrowserClient();

  const [qualTypes, setQualTypes]   = useState<QualType[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [filterProg, setFilterProg] = useState<string>("all");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [showAdd, setShowAdd]           = useState(false);
  const [editTarget, setEditTarget]     = useState<QualType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QualType | null>(null);
  const [detailTarget, setDetailTarget] = useState<QualType | null>(null);

  const [formName,   setFormName]   = useState("");
  const [formCode,   setFormCode]   = useState("");
  const [formProgId, setFormProgId] = useState("");
  const [formError,  setFormError]  = useState<string | null>(null);
  const [busy, setBusy]             = useState(false);

  // ── Data load ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true); setError(null);

    const qualsRes  = await (supabase.from("qualification_types") as any).select("id, programme_id, name, code, created_at").order("name");
    const progsRes  = await (supabase.from("programmes") as any).select("id, name, code, department_id").order("name");
    const deptsRes  = await (supabase.from("departments") as any).select("id, name, faculty_id").order("name");
    const facsRes   = await (supabase.from("faculties") as any).select("id, name").order("name");
    const levelsRes = await (supabase.from("levels") as any).select("qualification_type_id");

    if (qualsRes.error || progsRes.error || deptsRes.error || facsRes.error) {
      setError((qualsRes.error ?? progsRes.error ?? deptsRes.error ?? facsRes.error)!.message);
      setLoading(false);
      return;
    }

    const rawQuals: { id: string; programme_id: string; name: string; code: string; created_at: string }[] = qualsRes.data ?? [];
    const rawProgs: { id: string; name: string; code: string; department_id: string }[] = progsRes.data ?? [];
    const depts:    { id: string; name: string; faculty_id: string }[] = deptsRes.data ?? [];
    const facs:     { id: string; name: string }[] = facsRes.data ?? [];
    const levels:   { qualification_type_id: string }[] = levelsRes.data ?? [];

    const facMap: Record<string, string> = {};
    facs.forEach((f) => { facMap[f.id] = f.name; });

    const deptMap: Record<string, { name: string; faculty_name: string }> = {};
    depts.forEach((d) => { deptMap[d.id] = { name: d.name, faculty_name: facMap[d.faculty_id] ?? "Unknown Faculty" }; });

    const progMap: Record<string, Programme> = {};
    rawProgs.forEach((p) => {
      progMap[p.id] = {
        id: p.id, name: p.name, code: p.code,
        dept_name:    deptMap[p.department_id]?.name         ?? "Unknown Department",
        faculty_name: deptMap[p.department_id]?.faculty_name ?? "Unknown Faculty",
      };
    });

    const levelCount: Record<string, number> = {};
    levels.forEach((l) => { levelCount[l.qualification_type_id] = (levelCount[l.qualification_type_id] ?? 0) + 1; });

    setProgrammes(Object.values(progMap).sort((a, b) => a.name.localeCompare(b.name)));
    setQualTypes(
      rawQuals.map((q) => ({
        ...q,
        level_count:  levelCount[q.id] ?? 0,
        prog_name:    progMap[q.programme_id]?.name         ?? "Unknown Programme",
        prog_code:    progMap[q.programme_id]?.code         ?? "?",
        dept_name:    progMap[q.programme_id]?.dept_name    ?? "Unknown Department",
        faculty_name: progMap[q.programme_id]?.faculty_name ?? "Unknown Faculty",
      }))
    );
    setLoading(false);
  }, [supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setFormName(""); setFormCode(""); setFormProgId(programmes[0]?.id ?? ""); setFormError(null);
    setShowAdd(true);
  }

  function openEdit(q: QualType) {
    setFormName(q.name); setFormCode(q.code); setFormProgId(q.programme_id); setFormError(null);
    setEditTarget(q);
  }

  function closeModals() {
    setShowAdd(false); setEditTarget(null); setDeleteTarget(null);
    setFormName(""); setFormCode(""); setFormError(null);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleAdd() {
    const name = formName.trim();
    const code = formCode.trim();
    if (!name) { setFormError("Please enter a qualification type name."); return; }
    const codeErr = validateCode(code);
    if (codeErr) { setFormError(codeErr); return; }
    if (!formProgId) { setFormError("Please select a programme."); return; }
    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("qualification_types") as any).insert({ name, code, programme_id: formProgId });
    setBusy(false);
    if (err) {
      setFormError(err.message.includes("unique") ? "A qualification type with this name or code already exists in that programme." : err.message);
      return;
    }
    closeModals(); load();
  }

  async function handleEdit() {
    if (!editTarget) return;
    const name = formName.trim();
    const code = formCode.trim();
    if (!name) { setFormError("Please enter a qualification type name."); return; }
    const codeErr = validateCode(code);
    if (codeErr) { setFormError(codeErr); return; }
    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("qualification_types") as any).update({ name, code }).eq("id", editTarget.id);
    setBusy(false);
    if (err) { setFormError(err.message); return; }
    // Sync detail panel if it's showing the edited item
    if (detailTarget?.id === editTarget.id) setDetailTarget({ ...detailTarget, name, code });
    closeModals(); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const { error: err } = await (supabase.from("qualification_types") as any).delete().eq("id", deleteTarget.id);
    setBusy(false);
    if (err) {
      setError(err.message.includes("foreign") ? `"${deleteTarget.name}" can't be removed — remove its levels first.` : err.message);
      closeModals(); return;
    }
    if (detailTarget?.id === deleteTarget.id) setDetailTarget(null);
    closeModals(); load();
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = filterProg === "all" ? qualTypes : qualTypes.filter((q) => q.programme_id === filterProg);

  const grouped = filtered.reduce<Record<string, QualType[]>>((acc, q) => {
    const key = `${q.faculty_name}|||${q.dept_name}|||${q.prog_name}|||${q.programme_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  // ── Form body ─────────────────────────────────────────────────────────────

  const formBody = (isEdit: boolean) => (
    <>
      {!isEdit && (
        <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
          <label className="label">Programme</label>
          {programmes.length === 0 ? (
            <div className="alert alert-warning" style={{ fontSize: "var(--text-sm)" }}>
              No programmes found. Add a programme first.
            </div>
          ) : (
            <select
              className="input"
              style={{ appearance: "auto" }}
              value={formProgId}
              onChange={(e) => setFormProgId(e.target.value)}
            >
              <option value="" disabled>Choose a programme…</option>
              {programmes
                .slice()
                .sort((a, b) => `${a.faculty_name} ${a.dept_name} ${a.name}`.localeCompare(`${b.faculty_name} ${b.dept_name} ${b.name}`))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.faculty_name} → {p.dept_name} → {p.name} ({p.code})
                  </option>
                ))}
            </select>
          )}
        </div>
      )}

      <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
        <label className="label">Qualification type name</label>
        <input
          className="input"
          placeholder="e.g. Higher National Diploma"
          value={formName}
          onChange={(e) => { setFormName(e.target.value); setFormError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") isEdit ? handleEdit() : handleAdd(); }}
          autoFocus
          disabled={!isEdit && programmes.length === 0}
        />
      </div>

      <div className="input-group" style={{ marginBottom: "var(--space-6)" }}>
        <label className="label">Code</label>
        <input
          className="input"
          placeholder="e.g. HN"
          value={formCode}
          onChange={(e) => { setFormCode(sanitiseCode(e.target.value)); setFormError(null); }}
          maxLength={6}
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}
          disabled={!isEdit && programmes.length === 0}
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
          <h1 className="page-title">Qualification Types</h1>
          <p className="page-subtitle">
            {loading
              ? "Loading…"
              : qualTypes.length === 0
                ? "No qualification types yet"
                : `${qualTypes.length} qualification type${qualTypes.length === 1 ? "" : "s"} across ${programmes.length} programme${programmes.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} disabled={loading || programmes.length === 0}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Add Qualification Type
        </button>
      </div>

      {/* ── No programmes warning ── */}
      {!loading && programmes.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" />
          </svg>
          <span style={{ flex: 1 }}>You need at least one programme before creating qualification types.</span>
          <a href="/admin/institution/programmes" className="btn btn-sm btn-secondary">Go to Programmes</a>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" />
          </svg>
          <span style={{ flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* ── Programme filter tabs ── */}
      {!loading && programmes.length > 0 && qualTypes.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
          <button className={`btn btn-sm ${filterProg === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilterProg("all")}>
            All ({qualTypes.length})
          </button>
          {programmes
            .filter((p) => qualTypes.some((q) => q.programme_id === p.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((p) => {
              const count = qualTypes.filter((q) => q.programme_id === p.id).length;
              return (
                <button key={p.id} className={`btn btn-sm ${filterProg === p.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilterProg(p.id)}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700 }}>{p.code}</span>&nbsp;({count})
                </button>
              );
            })}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>

      ) : qualTypes.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-8)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "var(--radius-xl)",
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-5)", color: "var(--color-warning)",
          }}>
            <QualIcon />
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>No qualification types yet</h3>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)", maxWidth: 400, margin: "0 auto var(--space-6)" }}>
            Qualification types sit under programmes — e.g. <em>Higher National Diploma</em>{" "}
            (<span style={{ fontFamily: "var(--font-mono)" }}>HN</span>) or{" "}
            <em>Bachelor of Technology</em> (<span style={{ fontFamily: "var(--font-mono)" }}>BC</span>).
          </p>
          <button className="btn btn-primary" onClick={openAdd} disabled={programmes.length === 0}>Add First Qualification Type</button>
        </div>

      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>No qualification types under this programme yet.</p>

      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, items]) => {
              const [facultyName, deptName, progName, progId] = key.split("|||");
              const prog = programmes.find((p) => p.id === progId);
              return (
                <div key={key}>
                  {/* Section header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                      background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" strokeLinecap="round">
                        <path d="M22 10v6M2 10l10-7 10 7-10 7-10-7z" />
                      </svg>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {facultyName} › {deptName}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {progName}
                      </span>
                    </div>
                    {prog && (
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.06em", padding: "2px 7px",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                        color: "var(--color-secondary)", flexShrink: 0,
                      }}>
                        {prog.code}
                      </span>
                    )}
                    <span className="badge badge-neutral" style={{ fontSize: 10 }}>{items.length}</span>
                    <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                  </div>

                  {/* Card grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
                    {items.map((q) => {
                      const canDelete = q.level_count === 0;
                      return (
                        <InstitutionCard
                          key={q.id}
                          accent="amber"
                          icon={<QualIcon />}
                          title={q.name}
                          meta={`${q.faculty_name} › ${q.dept_name} › ${q.prog_name}`}
                          badge={q.level_count === 0 ? "No levels" : `${q.level_count} level${q.level_count === 1 ? "" : "s"}`}
                          badgeVariant={q.level_count === 0 ? "neutral" : "warning"}
                          tags={[{ label: q.code, mono: true }, { label: q.prog_code, mono: true }]}
                          footer={`Added ${new Date(q.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}`}
                          onClick={() => setDetailTarget(q)}
                          actions={
                            <>
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(q)} title="Edit">
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" />
                                </svg>
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => canDelete && setDeleteTarget(q)}
                                title={canDelete ? "Remove" : "Remove levels first"}
                                disabled={!canDelete}
                                style={{ color: canDelete ? "var(--color-danger)" : undefined }}
                              >
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                                  <path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" />
                                </svg>
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

      {/* ── Detail drawer ── */}
      <DetailPanel
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget?.name ?? ""}
        subtitle={detailTarget ? `${detailTarget.faculty_name} › ${detailTarget.dept_name} › ${detailTarget.prog_name}` : ""}
        accent="amber"
        icon={<QualIcon />}
      >
        {detailTarget && (
          <>
            <DetailSection title="Details">
              <DetailRow label="Code" value={detailTarget.code} mono />
              <DetailRow label="Programme" value={`${detailTarget.prog_name} (${detailTarget.prog_code})`} />
              <DetailRow label="Department" value={detailTarget.dept_name} />
              <DetailRow label="Faculty" value={detailTarget.faculty_name} />
              <DetailRow
                label="Levels"
                value={detailTarget.level_count === 0 ? "None" : `${detailTarget.level_count} level${detailTarget.level_count === 1 ? "" : "s"}`}
              />
              <DetailRow
                label="Added"
                value={new Date(detailTarget.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" })}
              />
            </DetailSection>

            <div style={{ display: "flex", gap: "var(--space-3)", paddingTop: "var(--space-2)" }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(detailTarget)}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" />
                </svg>
                Edit
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                disabled={detailTarget.level_count > 0}
                title={detailTarget.level_count > 0 ? "Remove levels first" : "Remove"}
                onClick={() => { setDeleteTarget(detailTarget); setDetailTarget(null); }}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" />
                </svg>
                {detailTarget.level_count > 0 ? "Has levels" : "Remove"}
              </button>
            </div>
          </>
        )}
      </DetailPanel>

      {/* ── Add modal ── */}
      {showAdd && (
        <Modal title="Add Qualification Type" onClose={closeModals}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            The code (e.g. <span style={{ fontFamily: "var(--font-mono)" }}>HN</span>,{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>BC</span>) is used to build group names and student index numbers.
          </p>
          {formBody(false)}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={busy || programmes.length === 0}>
              {busy ? "Saving…" : "Add Qualification Type"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <Modal title="Edit Qualification Type" onClose={closeModals}>
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--color-surface-2)", borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-5)", fontSize: "var(--text-xs)", color: "var(--color-text-3)",
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
            </svg>
            Programme: <strong style={{ color: "var(--color-text-2)" }}>{editTarget.prog_name}</strong>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
              padding: "1px 6px", borderRadius: "var(--radius-sm)",
              background: "rgba(59,130,246,0.1)", color: "var(--color-secondary)",
            }}>{editTarget.prog_code}</span>
          </div>
          {formBody(true)}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
          </div>
        </Modal>
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <Modal title="Remove Qualification Type" onClose={closeModals}>
          <div style={{
            padding: "var(--space-4)",
            background: "var(--color-danger-bg)", border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: "var(--radius-lg)", marginBottom: "var(--space-5)",
            display: "flex", gap: "var(--space-3)", alignItems: "flex-start",
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-danger)" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M8 2L1 14h14L8 2zM8 6v4M8 11.5v.5" />
            </svg>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", lineHeight: 1.6, margin: 0 }}>
              This will permanently remove <strong>{deleteTarget.name}</strong>{" "}
              (<span style={{ fontFamily: "var(--font-mono)" }}>{deleteTarget.code}</span>). This cannot be undone.
            </p>
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
