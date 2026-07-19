"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { InstitutionCard, DetailPanel, DetailRow, DetailSection } from "@/components/layout/InstitutionCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type AcademicYear = {
  id: string;
  name: string;
  year_code: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  semester_count: number;
  group_count: number;
  student_count: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" });
}

function validateYearCode(raw: string): string | null {
  if (!raw.trim()) return "Year code is required.";
  if (!/^\d{2}$/.test(raw.trim())) return "Year code must be exactly 2 digits (e.g. 24).";
  return null;
}
function validateDates(start: string, end: string): string | null {
  if (!start) return "Start date is required.";
  if (!end)   return "End date is required.";
  if (new Date(end) <= new Date(start)) return "End date must be after start date.";
  return null;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const YearIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" stroke="none">
    <path d="M7 1l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.1 3.8 10.9l.6-3.6L2 4.8l3.6-.5L7 1z" />
  </svg>
);

// ── Modal ─────────────────────────────────────────────────────────────────────

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

function ConfirmModal({
  title, message, confirmLabel, confirmVariant = "danger", busy, onConfirm, onClose,
}: {
  title: string; message: React.ReactNode; confirmLabel: string;
  confirmVariant?: "danger" | "primary" | "warning";
  busy: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const cls = confirmVariant === "danger" ? "btn-danger" : confirmVariant === "warning" ? "btn-warning" : "btn-primary";
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ marginBottom: "var(--space-5)" }}>{message}</div>
      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className={`btn ${cls}`} onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button>
      </div>
    </Modal>
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
          <div className="skeleton" style={{ height: 10, width: "35%", borderRadius: "var(--radius-sm)" }} />
        </div>
        <div className="skeleton" style={{ width: 70, height: 22, borderRadius: "var(--radius-full)" }} />
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        {[80, 65, 75].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 20, borderRadius: "var(--radius-full)" }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 1 }} />
      <div className="skeleton" style={{ height: 10, width: "45%", borderRadius: "var(--radius-sm)" }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AcademicYearsPage() {
  const supabase = createSupabaseBrowserClient();

  const [years, setYears]             = useState<AcademicYear[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [busy, setBusy]               = useState(false);

  const [detailTarget, setDetailTarget] = useState<AcademicYear | null>(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [editTarget, setEditTarget]     = useState<AcademicYear | null>(null);
  const [setCurrentTarget, setSetCurrentTarget] = useState<AcademicYear | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | null>(null);

  // Form state
  const [formName,     setFormName]     = useState("");
  const [formCode,     setFormCode]     = useState("");
  const [formStart,    setFormStart]    = useState("");
  const [formEnd,      setFormEnd]      = useState("");
  const [formError,    setFormError]    = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true); setError(null);

    const [yearsRes, semsRes, groupsRes, membershipsRes] = await Promise.all([
      (supabase.from("academic_years") as any)
        .select("id, name, year_code, start_date, end_date, is_current, created_at")
        .order("start_date", { ascending: false }),
      (supabase.from("app_semesters") as any).select("academic_year_id"),
      (supabase.from("groups") as any).select("id, academic_year_id"),
      (supabase.from("group_memberships") as any)
        .select("group_id")
        .eq("status", "active"),
    ]);

    if (yearsRes.error) { setError(yearsRes.error.message); setLoading(false); return; }

    const rawYears: { id: string; name: string; year_code: string; start_date: string; end_date: string; is_current: boolean; created_at: string }[] = yearsRes.data ?? [];
    const rawSems:  { academic_year_id: string }[]  = semsRes.data    ?? [];
    const rawGroups: { id: string; academic_year_id: string }[] = groupsRes.data ?? [];
    const rawMemberships: { group_id: string }[]    = membershipsRes.data ?? [];

    // Count semesters per year
    const semCount: Record<string, number> = {};
    rawSems.forEach((s) => { semCount[s.academic_year_id] = (semCount[s.academic_year_id] ?? 0) + 1; });

    // Count groups per year + students per year (via group memberships)
    const groupCount: Record<string, number>    = {};
    const groupToYear: Record<string, string>   = {};
    rawGroups.forEach((g) => {
      groupCount[g.academic_year_id] = (groupCount[g.academic_year_id] ?? 0) + 1;
      groupToYear[g.id] = g.academic_year_id;
    });

    // Active student memberships across groups, attributed to academic year
    const memberCount: Record<string, number> = {};
    rawMemberships.forEach((m) => {
      const yearId = groupToYear[m.group_id];
      if (!yearId) return;
      memberCount[yearId] = (memberCount[yearId] ?? 0) + 1;
    });

    setYears(rawYears.map((y) => ({
      ...y,
      semester_count: semCount[y.id]    ?? 0,
      group_count:    groupCount[y.id]  ?? 0,
      student_count:  memberCount[y.id] ?? 0,
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const currentYear = years.find((y) => y.is_current) ?? null;

  function openAdd() {
    setFormName(""); setFormCode(""); setFormStart(""); setFormEnd(""); setFormError(null);
    setShowAdd(true);
  }
  function openEdit(y: AcademicYear) {
    setFormName(y.name); setFormCode(y.year_code); setFormStart(y.start_date); setFormEnd(y.end_date); setFormError(null);
    setEditTarget(y);
  }
  function closeModals() {
    setShowAdd(false); setEditTarget(null); setSetCurrentTarget(null); setDeleteTarget(null);
    setFormName(""); setFormCode(""); setFormStart(""); setFormEnd(""); setFormError(null);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleAdd() {
    const name = formName.trim();
    const code = formCode.trim();
    if (!name) { setFormError("Name is required."); return; }
    const codeErr = validateYearCode(code);
    if (codeErr) { setFormError(codeErr); return; }
    const dateErr = validateDates(formStart, formEnd);
    if (dateErr) { setFormError(dateErr); return; }

    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("academic_years") as any).insert({
      name, year_code: code, start_date: formStart, end_date: formEnd,
    });
    setBusy(false);
    if (err) {
      setFormError(
        err.message.includes("unique") || err.message.includes("duplicate")
          ? "An academic year with this name or year code already exists."
          : err.message
      );
      return;
    }
    closeModals(); load();
  }

  async function handleEdit() {
    if (!editTarget) return;
    const name = formName.trim();
    if (!name) { setFormError("Name is required."); return; }
    const dateErr = validateDates(formStart, formEnd);
    if (dateErr) { setFormError(dateErr); return; }

    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("academic_years") as any)
      .update({ name, start_date: formStart, end_date: formEnd })
      .eq("id", editTarget.id);
    setBusy(false);
    if (err) { setFormError(err.message); return; }
    if (detailTarget?.id === editTarget.id) {
      setDetailTarget({ ...detailTarget, name, start_date: formStart, end_date: formEnd });
    }
    closeModals(); load();
  }

  async function handleSetCurrent() {
    if (!setCurrentTarget) return;
    setBusy(true);
    const { error: err } = await (supabase.rpc as any)("open_academic_year", { year_id: setCurrentTarget.id });
    setBusy(false);
    if (err) { setError(err.message); closeModals(); return; }
    if (detailTarget?.id === setCurrentTarget.id) setDetailTarget({ ...detailTarget!, is_current: true });
    closeModals(); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const { error: err } = await (supabase.from("academic_years") as any).delete().eq("id", deleteTarget.id);
    setBusy(false);
    if (err) {
      setError(
        err.message.includes("foreign") || err.message.includes("violates")
          ? `"${deleteTarget.name}" can't be deleted — semesters, groups, or students are linked to it.`
          : err.message
      );
      closeModals(); return;
    }
    if (detailTarget?.id === deleteTarget.id) setDetailTarget(null);
    closeModals(); load();
  }

  // ── Form body ─────────────────────────────────────────────────────────────

  const formBody = (isEdit: boolean) => (
    <>
      <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
        <label className="label">Year name</label>
        <input
          className="input"
          placeholder="e.g. 2024/2025"
          value={formName}
          onChange={(e) => { setFormName(e.target.value); setFormError(null); }}
          autoFocus
        />
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: "var(--space-1)", display: "block" }}>
          Use the format shown to match your institution's conventions.
        </span>
      </div>

      {!isEdit && (
        <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
          <label className="label">Year code</label>
          <input
            className="input"
            placeholder="e.g. 24"
            maxLength={2}
            value={formCode}
            onChange={(e) => { setFormCode(e.target.value.replace(/\D/g, "")); setFormError(null); }}
            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}
          />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: "var(--space-1)", display: "block" }}>
            2-digit code embedded in student index numbers (e.g. BC/ITS/<strong>24</strong>/001). Cannot be changed after students are created.
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div className="input-group">
          <label className="label">Start date</label>
          <input className="input" type="date" value={formStart} onChange={(e) => { setFormStart(e.target.value); setFormError(null); }} />
        </div>
        <div className="input-group">
          <label className="label">End date</label>
          <input className="input" type="date" value={formEnd} onChange={(e) => { setFormEnd(e.target.value); setFormError(null); }} />
        </div>
      </div>

      {formError && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
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
          <h1 className="page-title">Academic Years</h1>
          <p className="page-subtitle">
            {loading ? "Loading…" : years.length === 0
              ? "No academic years yet"
              : `${years.length} year${years.length === 1 ? "" : "s"}${currentYear ? ` · ${currentYear.name} is current` : ""}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} disabled={loading}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Add Year
        </button>
      </div>

      {/* ── Current year banner ── */}
      {!loading && currentYear && (
        <div style={{
          display: "flex", alignItems: "center", gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          background: "rgba(157,10,18,0.07)",
          border: "1px solid rgba(157,10,18,0.25)",
          borderRadius: "var(--radius-lg)",
          marginBottom: "var(--space-5)",
        }}>
          <span style={{ color: "var(--color-primary)", flexShrink: 0 }}><StarIcon /></span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-primary)" }}>
              {currentYear.name}
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginLeft: "var(--space-2)" }}>
              Current academic year · {fmtDate(currentYear.start_date)} – {fmtDate(currentYear.end_date)}
            </span>
          </div>
          <a href={`/admin/academic-years/${currentYear.id}`} className="btn btn-sm btn-secondary">
            View Detail
          </a>
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

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>

      ) : years.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-8)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "var(--radius-xl)",
            background: "rgba(157,10,18,0.08)", border: "1px solid rgba(157,10,18,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-5)", color: "var(--color-primary)",
          }}>
            <YearIcon />
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>No academic years yet</h3>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)", maxWidth: 420, margin: "0 auto var(--space-6)" }}>
            Academic years are the top-level structure for everything else — semesters, groups, and student cohorts.
            Create your first year to get started.
          </p>
          <button className="btn btn-primary" onClick={openAdd}>Add First Year</button>
        </div>

      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
          {years.map((y) => {
            const isCurrent = y.is_current;
            const canSetCurrent = !isCurrent;
            const canDelete = y.semester_count === 0 && y.group_count === 0 && y.student_count === 0;
            return (
              <InstitutionCard
                key={y.id}
                accent={isCurrent ? "red" : "blue"}
                icon={<YearIcon />}
                title={y.name}
                meta={`${fmtDate(y.start_date)} – ${fmtDate(y.end_date)}`}
                badge={isCurrent ? "Current" : `'${y.year_code}`}
                badgeVariant={isCurrent ? "danger" : "neutral"}
                tags={[
                  { label: y.semester_count === 0 ? "No semesters" : `${y.semester_count} semester${y.semester_count === 1 ? "" : "s"}` },
                  { label: y.group_count === 0 ? "No groups" : `${y.group_count} group${y.group_count === 1 ? "" : "s"}` },
                  { label: y.student_count === 0 ? "No students" : `${y.student_count} student${y.student_count === 1 ? "" : "s"}` },
                ]}
                footer={`Created ${fmtDate(y.created_at)}`}
                onClick={() => setDetailTarget(y)}
                actions={
                  <>
                    {canSetCurrent && (
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={(e) => { e.stopPropagation(); setSetCurrentTarget(y); }}
                        title="Set as current year"
                        style={{ color: "var(--color-primary)" }}
                      >
                        <StarIcon />
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={(e) => { e.stopPropagation(); openEdit(y); }}
                      title="Edit"
                    >
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" />
                      </svg>
                    </button>
                    {canDelete && (
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(y); }}
                        title="Delete"
                        style={{ color: "var(--color-danger)" }}
                      >
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                          <path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" />
                        </svg>
                      </button>
                    )}
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {/* ── Detail drawer ── */}
      <DetailPanel
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget?.name ?? ""}
        subtitle={detailTarget?.year_code ? `Year code: ${detailTarget.year_code}` : undefined}
        accent={detailTarget?.is_current ? "red" : "blue"}
        icon={<YearIcon />}
      >
        {detailTarget && (() => {
          const y = detailTarget;
          const isCurrent  = y.is_current;
          const canSetCurrent = !isCurrent;
          const canDelete  = y.semester_count === 0 && y.group_count === 0 && y.student_count === 0;
          return (
            <>
              {/* Current badge */}
              {isCurrent && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
                  padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-full)",
                  background: "rgba(157,10,18,0.1)", border: "1px solid rgba(157,10,18,0.25)",
                  marginBottom: "var(--space-5)",
                }}>
                  <span style={{ color: "var(--color-primary)" }}><StarIcon /></span>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-primary)" }}>Current Academic Year</span>
                </div>
              )}

              <DetailSection title="Year Details">
                <DetailRow label="Name"       value={y.name} />
                <DetailRow label="Year Code"  value={y.year_code} mono />
                <DetailRow label="Start Date" value={fmtDateLong(y.start_date)} />
                <DetailRow label="End Date"   value={fmtDateLong(y.end_date)} />
                <DetailRow label="Created"    value={fmtDateLong(y.created_at)} />
              </DetailSection>

              <DetailSection title="Contents">
                <DetailRow label="Semesters" value={y.semester_count === 0 ? "None" : `${y.semester_count} semester${y.semester_count === 1 ? "" : "s"}`} />
                <DetailRow label="Groups"    value={y.group_count === 0    ? "None" : `${y.group_count} group${y.group_count === 1 ? "" : "s"}`} />
                <DetailRow label="Students"  value={y.student_count === 0  ? "None" : `${y.student_count} active member${y.student_count === 1 ? "" : "s"}`} />
              </DetailSection>

              {/* Year code note */}
              <div style={{
                display: "flex", gap: "var(--space-2)", alignItems: "flex-start",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-surface-2)", borderRadius: "var(--radius-md)",
                marginBottom: "var(--space-5)",
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--color-text-3)" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
                </svg>
                <span style={{ fontSize: 11, color: "var(--color-text-3)", lineHeight: 1.6 }}>
                  Year code <code style={{ fontFamily: "var(--font-mono)", background: "var(--color-surface-3)", padding: "1px 4px", borderRadius: 3 }}>{y.year_code}</code> is embedded in student index numbers and cannot be changed.
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <a href={`/admin/academic-years/${y.id}`} className="btn btn-primary" style={{ flex: 1 }}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M7 1h6v6M13 1L6 8M3 3H1v10h10v-2" />
                  </svg>
                  View Detail
                </a>
                {canSetCurrent && (
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => { setSetCurrentTarget(y); setDetailTarget(null); }}
                  >
                    <StarIcon />
                    Set as Current
                  </button>
                )}
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(y)}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" />
                  </svg>
                  Edit
                </button>
                {canDelete && (
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { setDeleteTarget(y); setDetailTarget(null); }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                      <path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            </>
          );
        })()}
      </DetailPanel>

      {/* ── Add modal ── */}
      {showAdd && (
        <Modal title="Add Academic Year" onClose={closeModals}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            Academic years are the top-level containers for semesters, groups, and student cohorts.
          </p>
          {formBody(false)}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={busy}>
              {busy ? "Saving…" : "Add Year"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <Modal title="Edit Academic Year" onClose={closeModals}>
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--color-surface-2)", borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-5)", fontSize: "var(--text-xs)", color: "var(--color-text-3)",
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
            </svg>
            Year code <code style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-2)", background: "var(--color-surface-3)", padding: "1px 4px", borderRadius: 3 }}>{editTarget.year_code}</code> cannot be changed.
          </div>
          {formBody(true)}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
          </div>
        </Modal>
      )}

      {/* ── Set current confirm ── */}
      {setCurrentTarget && (
        <ConfirmModal
          title="Set as Current Year"
          confirmLabel="Yes, Set as Current"
          confirmVariant="primary"
          busy={busy}
          onConfirm={handleSetCurrent}
          onClose={closeModals}
          message={
            <div style={{
              padding: "var(--space-4)",
              background: "rgba(157,10,18,0.07)", border: "1px solid rgba(157,10,18,0.25)",
              borderRadius: "var(--radius-lg)",
            }}>
              <div style={{ fontWeight: 700, marginBottom: "var(--space-2)", color: "var(--color-primary)" }}>
                {setCurrentTarget.name}
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", lineHeight: 1.6, margin: 0 }}>
                This will mark <strong>{setCurrentTarget.name}</strong> as the current academic year.
                {currentYear && currentYear.id !== setCurrentTarget.id && (
                  <> <strong>{currentYear.name}</strong> will no longer be current.</>
                )}
                {" "}The system uses the current year to scope dashboards and reports.
              </p>
            </div>
          }
        />
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Academic Year"
          confirmLabel="Yes, Delete"
          confirmVariant="danger"
          busy={busy}
          onConfirm={handleDelete}
          onClose={closeModals}
          message={
            <div style={{
              padding: "var(--space-4)",
              background: "var(--color-danger-bg)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "var(--radius-lg)",
              display: "flex", gap: "var(--space-3)", alignItems: "flex-start",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-danger)" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M8 2L1 14h14L8 2zM8 6v4M8 11.5v.5" />
              </svg>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", lineHeight: 1.6, margin: 0 }}>
                This will permanently delete <strong>{deleteTarget.name}</strong>. This cannot be undone.
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
