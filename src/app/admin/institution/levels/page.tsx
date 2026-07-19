"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type QualType = {
  id: string;
  name: string;
  code: string;
  prog_name: string;
  prog_code: string;
  dept_name: string;
  faculty_name: string;
};

type Level = {
  id: string;
  qualification_type_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  group_count: number;
  qual_name: string;
  qual_code: string;
  prog_name: string;
  prog_code: string;
  dept_name: string;
  faculty_name: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateSortOrder(raw: string): string | null {
  const n = Number(raw);
  if (!raw.trim()) return "Sort order is required.";
  if (!Number.isInteger(n) || n < 1) return "Must be a positive integer (e.g. 1, 2, 3).";
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
          <div className="skeleton" style={{ width: 100, height: 9, borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ width: 160, height: 12, borderRadius: "var(--radius-sm)" }} />
        </div>
        <div style={{ flex: 1 }} />
        <div className="skeleton" style={{ width: 28, height: 22, borderRadius: "var(--radius-sm)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ padding: "var(--space-3) var(--space-5)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <div className="skeleton" style={{ height: 13, width: "40%", borderRadius: "var(--radius-sm)" }} />
              <div className="skeleton" style={{ height: 10, width: "25%", borderRadius: "var(--radius-sm)" }} />
            </div>
            <div className="skeleton" style={{ width: 44, height: 26, borderRadius: "var(--radius-sm)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sort order badge ──────────────────────────────────────────────────────────

function SortBadge({ order, isFinal }: { order: number; isFinal: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: 32, height: 32, borderRadius: "var(--radius-md)", flexShrink: 0,
      background: isFinal ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.08)",
      border: `1px solid ${isFinal ? "rgba(245,158,11,0.25)" : "rgba(34,197,94,0.2)"}`,
    }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 13, fontWeight: 800,
        color: isFinal ? "var(--color-warning)" : "var(--color-success)",
        lineHeight: 1,
      }}>
        {order}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LevelsPage() {
  const supabase = createSupabaseBrowserClient();

  const [levels, setLevels]         = useState<Level[]>([]);
  const [qualTypes, setQualTypes]   = useState<QualType[]>([]);
  const [filterQual, setFilterQual] = useState<string>("all");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [showAdd, setShowAdd]           = useState(false);
  const [editTarget, setEditTarget]     = useState<Level | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Level | null>(null);

  const [formName,      setFormName]      = useState("");
  const [formSortOrder, setFormSortOrder] = useState("");
  const [formQualId,    setFormQualId]    = useState("");
  const [formError,     setFormError]     = useState<string | null>(null);
  const [busy, setBusy]                   = useState(false);

  // ── Data load ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true); setError(null);

    const levelsRes = await (supabase.from("levels") as any).select("id, qualification_type_id, name, sort_order, created_at").order("sort_order");
    const qualsRes  = await (supabase.from("qualification_types") as any).select("id, name, code, programme_id").order("name");
    const progsRes  = await (supabase.from("programmes") as any).select("id, name, code, department_id").order("name");
    const deptsRes  = await (supabase.from("departments") as any).select("id, name, faculty_id").order("name");
    const facsRes   = await (supabase.from("faculties") as any).select("id, name").order("name");
    const groupsRes = await (supabase.from("groups") as any).select("level_id");

    if (levelsRes.error || qualsRes.error || progsRes.error || deptsRes.error || facsRes.error) {
      setError((levelsRes.error ?? qualsRes.error ?? progsRes.error ?? deptsRes.error ?? facsRes.error)!.message);
      setLoading(false);
      return;
    }

    const rawLevels: { id: string; qualification_type_id: string; name: string; sort_order: number; created_at: string }[] = levelsRes.data ?? [];
    const rawQuals:  { id: string; name: string; code: string; programme_id: string }[] = qualsRes.data ?? [];
    const rawProgs:  { id: string; name: string; code: string; department_id: string }[] = progsRes.data ?? [];
    const depts:     { id: string; name: string; faculty_id: string }[] = deptsRes.data ?? [];
    const facs:      { id: string; name: string }[] = facsRes.data ?? [];
    const groups:    { level_id: string }[] = groupsRes.data ?? [];

    const facMap: Record<string, string> = {};
    facs.forEach((f) => { facMap[f.id] = f.name; });

    const deptMap: Record<string, { name: string; faculty_name: string }> = {};
    depts.forEach((d) => { deptMap[d.id] = { name: d.name, faculty_name: facMap[d.faculty_id] ?? "Unknown" }; });

    const progMap: Record<string, { name: string; code: string; dept_name: string; faculty_name: string }> = {};
    rawProgs.forEach((p) => {
      progMap[p.id] = {
        name: p.name, code: p.code,
        dept_name:    deptMap[p.department_id]?.name         ?? "Unknown",
        faculty_name: deptMap[p.department_id]?.faculty_name ?? "Unknown",
      };
    });

    const qualMap: Record<string, QualType> = {};
    rawQuals.forEach((q) => {
      qualMap[q.id] = {
        id: q.id, name: q.name, code: q.code,
        prog_name:    progMap[q.programme_id]?.name         ?? "Unknown",
        prog_code:    progMap[q.programme_id]?.code         ?? "?",
        dept_name:    progMap[q.programme_id]?.dept_name    ?? "Unknown",
        faculty_name: progMap[q.programme_id]?.faculty_name ?? "Unknown",
      };
    });

    const groupCount: Record<string, number> = {};
    groups.forEach((g) => { groupCount[g.level_id] = (groupCount[g.level_id] ?? 0) + 1; });

    setQualTypes(Object.values(qualMap).sort((a, b) => a.name.localeCompare(b.name)));
    setLevels(
      rawLevels.map((l) => ({
        ...l,
        group_count:  groupCount[l.id] ?? 0,
        qual_name:    qualMap[l.qualification_type_id]?.name         ?? "Unknown",
        qual_code:    qualMap[l.qualification_type_id]?.code         ?? "?",
        prog_name:    qualMap[l.qualification_type_id]?.prog_name    ?? "Unknown",
        prog_code:    qualMap[l.qualification_type_id]?.prog_code    ?? "?",
        dept_name:    qualMap[l.qualification_type_id]?.dept_name    ?? "Unknown",
        faculty_name: qualMap[l.qualification_type_id]?.faculty_name ?? "Unknown",
      }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function nextSortOrder(qualId: string): number {
    const orders = levels.filter((l) => l.qualification_type_id === qualId).map((l) => l.sort_order);
    return orders.length > 0 ? Math.max(...orders) + 1 : 1;
  }

  function openAdd() {
    const firstQualId = qualTypes[0]?.id ?? "";
    setFormName(""); setFormQualId(firstQualId);
    setFormSortOrder(firstQualId ? String(nextSortOrder(firstQualId)) : "1");
    setFormError(null); setShowAdd(true);
  }

  function openEdit(l: Level) {
    setFormName(l.name); setFormSortOrder(String(l.sort_order));
    setFormQualId(l.qualification_type_id); setFormError(null);
    setEditTarget(l);
  }

  function closeModals() {
    setShowAdd(false); setEditTarget(null); setDeleteTarget(null);
    setFormName(""); setFormSortOrder(""); setFormError(null);
  }

  function handleQualChange(qualId: string) {
    setFormQualId(qualId);
    setFormSortOrder(String(nextSortOrder(qualId)));
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleAdd() {
    const name = formName.trim();
    const soErr = validateSortOrder(formSortOrder);
    if (!name)  { setFormError("Please enter a level name."); return; }
    if (soErr)  { setFormError(soErr); return; }
    if (!formQualId) { setFormError("Please select a qualification type."); return; }
    const sort_order = Number(formSortOrder);

    const duplicate = levels.find((l) => l.qualification_type_id === formQualId && l.sort_order === sort_order);
    if (duplicate) {
      setFormError(`Sort order ${sort_order} is already used by "${duplicate.name}" in this qualification type.`);
      return;
    }

    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("levels") as any).insert({ name, sort_order, qualification_type_id: formQualId });
    setBusy(false);
    if (err) {
      setFormError(err.message.includes("unique") ? "A level with this name or sort order already exists in that qualification type." : err.message);
      return;
    }
    closeModals(); load();
  }

  async function handleEdit() {
    if (!editTarget) return;
    const name = formName.trim();
    const soErr = validateSortOrder(formSortOrder);
    if (!name)  { setFormError("Please enter a level name."); return; }
    if (soErr)  { setFormError(soErr); return; }
    const sort_order = Number(formSortOrder);

    const conflict = levels.find(
      (l) => l.qualification_type_id === editTarget.qualification_type_id &&
             l.sort_order === sort_order && l.id !== editTarget.id
    );
    if (conflict) {
      setFormError(`Sort order ${sort_order} is already used by "${conflict.name}". Each level in a qualification type must have a unique sort order.`);
      return;
    }

    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("levels") as any).update({ name, sort_order }).eq("id", editTarget.id);
    setBusy(false);
    if (err) {
      setFormError(err.message.includes("unique") ? "A level with this name or sort order already exists in that qualification type." : err.message);
      return;
    }
    closeModals(); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const { error: err } = await (supabase.from("levels") as any).delete().eq("id", deleteTarget.id);
    setBusy(false);
    if (err) {
      setError(
        err.message.includes("foreign")
          ? `"${deleteTarget.name}" can't be removed — groups are assigned to this level. Reassign or remove those groups first.`
          : err.message
      );
      closeModals(); return;
    }
    closeModals(); load();
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = filterQual === "all"
    ? levels
    : levels.filter((l) => l.qualification_type_id === filterQual);

  const grouped = filtered.reduce<Record<string, Level[]>>((acc, l) => {
    const key = `${l.faculty_name}|||${l.dept_name}|||${l.prog_name}|||${l.qual_name}|||${l.qualification_type_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});

  Object.values(grouped).forEach((grp) => grp.sort((a, b) => a.sort_order - b.sort_order));

  // ── Shared form body ──────────────────────────────────────────────────────

  const formBody = (isEdit: boolean) => (
    <>
      {/* Sort order explainer */}
      <div style={{
        display: "flex", gap: "var(--space-3)", alignItems: "flex-start",
        padding: "var(--space-3) var(--space-4)",
        background: "rgba(34,197,94,0.06)",
        border: "1px solid rgba(34,197,94,0.18)",
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--space-5)",
        fontSize: "var(--text-xs)", color: "var(--color-text-2)", lineHeight: 1.6,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-success)" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="7" cy="7" r="6" /><path d="M7 4v3M7 9v.5" />
        </svg>
        <span>
          <strong style={{ color: "var(--color-success)" }}>Sort order drives promotion.</strong>{" "}
          The system promotes students to the level with{" "}
          <span style={{ fontFamily: "var(--font-mono)" }}>sort_order + 1</span>.
          Use sequential integers — e.g. L100 = 1, L200 = 2, L300 = 3.
        </span>
      </div>

      {/* Qual type selector (add only) */}
      {!isEdit && (
        <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
          <label className="label">Qualification Type</label>
          {qualTypes.length === 0 ? (
            <div className="alert alert-warning" style={{ fontSize: "var(--text-sm)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6" /><path d="M7 4v3M7 9v.5" />
              </svg>
              No qualification types found. Add one first.
            </div>
          ) : (
            <select
              className="select input"
              value={formQualId}
              onChange={(e) => handleQualChange(e.target.value)}
            >
              <option value="" disabled>Choose a qualification type…</option>
              {qualTypes
                .slice()
                .sort((a, b) => `${a.prog_name} ${a.name}`.localeCompare(`${b.prog_name} ${b.name}`))
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.prog_name} ({q.prog_code}) → {q.name} ({q.code})
                  </option>
                ))}
            </select>
          )}
        </div>
      )}

      {/* Name + sort order side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="input-group">
          <label className="label">Level name</label>
          <input
            className="input"
            placeholder="e.g. Level 100, HND 1, Year 1"
            value={formName}
            onChange={(e) => { setFormName(e.target.value); setFormError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") isEdit ? handleEdit() : handleAdd(); }}
            autoFocus
            disabled={!isEdit && qualTypes.length === 0}
          />
        </div>
        <div className="input-group">
          <label className="label">Sort order</label>
          <input
            className="input"
            type="number"
            min={1}
            step={1}
            placeholder="1"
            value={formSortOrder}
            onChange={(e) => { setFormSortOrder(e.target.value); setFormError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") isEdit ? handleEdit() : handleAdd(); }}
            style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}
            disabled={!isEdit && qualTypes.length === 0}
          />
        </div>
      </div>

      {formError && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "var(--space-1)", marginBottom: "var(--space-5)" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
          </svg>
          {formError}
        </p>
      )}
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Levels</h1>
          <p className="page-subtitle">
            {loading
              ? "Loading…"
              : levels.length === 0
                ? "No levels yet — add one below"
                : `${levels.length} level${levels.length === 1 ? "" : "s"} across ${qualTypes.filter((q) => levels.some((l) => l.qualification_type_id === q.id)).length} qualification type${qualTypes.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={openAdd}
          disabled={loading || qualTypes.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Add Level
        </button>
      </div>

      {/* ── No qual types warning ── */}
      {!loading && qualTypes.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" />
          </svg>
          <span style={{ flex: 1 }}>You need at least one qualification type before creating levels.</span>
          <a href="/admin/institution/qualification-types" className="btn btn-sm btn-secondary">Go to Qualification Types</a>
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

      {/* ── Qual type filter tabs ── */}
      {!loading && qualTypes.length > 0 && levels.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
          <button
            className={`btn btn-sm ${filterQual === "all" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilterQual("all")}
          >
            All ({levels.length})
          </button>
          {qualTypes
            .filter((q) => levels.some((l) => l.qualification_type_id === q.id))
            .sort((a, b) => `${a.prog_name} ${a.name}`.localeCompare(`${b.prog_name} ${b.name}`))
            .map((q) => {
              const count = levels.filter((l) => l.qualification_type_id === q.id).length;
              return (
                <button
                  key={q.id}
                  className={`btn btn-sm ${filterQual === q.id ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setFilterQual(q.id)}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700 }}>{q.code}</span>
                  &nbsp;({count})
                </button>
              );
            })}
        </div>
      )}

      {/* ── Content area ── */}
      {loading ? (
        <div>{[1, 2].map((i) => <SkeletonGroup key={i} />)}</div>

      ) : levels.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-8)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "var(--radius-xl)",
            background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-5)",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>No levels yet</h3>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)", maxWidth: 420, margin: "0 auto var(--space-6)" }}>
            Levels sit under qualification types and define the promotion sequence.
            For example, a <em>Higher National Diploma</em> might have{" "}
            <strong>HND 1</strong> (sort order 1) and <strong>HND 2</strong> (sort order 2).
          </p>
          <button className="btn btn-primary" onClick={openAdd} disabled={qualTypes.length === 0}>
            Add First Level
          </button>
        </div>

      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
          No levels under this qualification type yet.
        </p>

      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, groupItems]) => {
              const [facultyName, deptName, progName, qualName, qualId] = key.split("|||");
              const qual = qualTypes.find((q) => q.id === qualId);
              const maxOrder = Math.max(...groupItems.map((l) => l.sort_order));

              return (
                <div key={key}>
                  {/* Section header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                      background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round">
                        <path d="M3 6h18M3 12h18M3 18h18" />
                      </svg>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {facultyName} › {deptName} › {progName}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {qualName}
                      </span>
                    </div>

                    {qual && (
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.06em", padding: "2px 7px",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(157,10,18,0.08)",
                        border: "1px solid rgba(157,10,18,0.2)",
                        color: "var(--color-primary)", flexShrink: 0,
                      }}>
                        {qual.code}
                      </span>
                    )}

                    <span className="badge badge-neutral" style={{ fontSize: 10 }}>{groupItems.length}</span>
                    <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                  </div>

                  {/* Level list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {groupItems.map((l, idx) => {
                      const isFinal   = l.sort_order === maxOrder;
                      const canDelete = l.group_count === 0;
                      const hasNext   = idx + 1 < groupItems.length;

                      return (
                        <div key={l.id} style={{ position: "relative" }}>
                          <div
                            className="card"
                            style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-3) var(--space-5)" }}
                          >
                            <SortBadge order={l.sort_order} isFinal={isFinal} />

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: 2 }}>
                                {l.name}
                              </div>
                              <div style={{ fontSize: 10, color: "var(--color-text-3)" }}>
                                {l.group_count === 0
                                  ? "No groups assigned"
                                  : `${l.group_count} group${l.group_count === 1 ? "" : "s"} assigned`}
                              </div>
                            </div>

                            {isFinal ? (
                              <span style={{
                                fontSize: 10, fontWeight: 600, color: "var(--color-warning)",
                                padding: "3px 8px", borderRadius: "var(--radius-sm)",
                                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
                                flexShrink: 0,
                              }}>
                                Final — graduates
                              </span>
                            ) : (
                              <span style={{
                                fontSize: 10, fontWeight: 600, color: "var(--color-success)",
                                padding: "3px 8px", borderRadius: "var(--radius-sm)",
                                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)",
                                flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                              }}>
                                → order {l.sort_order + 1}
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                                  <path d="M2 5h6M5 2l3 3-3 3" />
                                </svg>
                              </span>
                            )}

                            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => openEdit(l)}
                                title="Edit level"
                              >
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" />
                                </svg>
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => canDelete && setDeleteTarget(l)}
                                title={canDelete ? "Remove level" : "Reassign groups before deleting"}
                                disabled={!canDelete}
                                style={{ color: canDelete ? "var(--color-danger)" : undefined }}
                              >
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                                  <path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Connector between levels */}
                          {hasNext && (
                            <div style={{
                              position: "absolute", left: 29, bottom: -9,
                              width: 2, height: 9,
                              background: "var(--color-border)",
                            }} />
                          )}
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
        <Modal title="Add Level" onClose={closeModals}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            Levels sit under a qualification type and define the year-end promotion sequence.
          </p>
          {formBody(false)}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={busy || qualTypes.length === 0}>
              {busy ? "Saving…" : "Add Level"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <Modal title="Edit Level" onClose={closeModals}>
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--color-surface-2)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-5)",
            fontSize: "var(--text-xs)", color: "var(--color-text-3)",
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
            </svg>
            Qualification type:{" "}
            <strong style={{ color: "var(--color-text-2)" }}>{editTarget.qual_name}</strong>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
              padding: "1px 6px", borderRadius: "var(--radius-sm)",
              background: "rgba(157,10,18,0.08)", color: "var(--color-primary)",
            }}>
              {editTarget.qual_code}
            </span>
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
        <Modal title="Remove Level" onClose={closeModals}>
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
              (sort order {deleteTarget.sort_order}).
              This cannot be undone and will break the promotion sequence if other levels remain.
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
