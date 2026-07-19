"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { InstitutionCard, DetailPanel, DetailRow, DetailSection } from "@/components/layout/InstitutionCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type SemesterStatus = "upcoming" | "active" | "archived";

type AcademicYear = {
  id: string;
  name: string;
  year_code: string;
  is_current: boolean;
};

type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SemesterStatus;
  auto_open: boolean;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  year_name: string;
  year_code: string;
  is_current_year: boolean;
  course_count: number;
  session_count: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" });
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("en-GH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function validateDates(start: string, end: string): string | null {
  if (!start) return "Start date is required.";
  if (!end)   return "End date is required.";
  if (new Date(end) <= new Date(start)) return "End date must be after start date.";
  return null;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const SemIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const StatusDot = ({ status }: { status: SemesterStatus }) => {
  const colors: Record<SemesterStatus, string> = {
    upcoming: "var(--color-info)",
    active:   "var(--color-success)",
    archived: "var(--color-text-3)",
  };
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7,
      borderRadius: "50%", background: colors[status],
      flexShrink: 0,
      boxShadow: status === "active" ? `0 0 0 3px ${colors[status]}30` : undefined,
    }} />
  );
};

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

// ── Confirm action modal ───────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, confirmVariant = "danger", busy, onConfirm, onClose,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: "danger" | "primary" | "warning";
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const variantClass = confirmVariant === "danger" ? "btn-danger" : confirmVariant === "warning" ? "btn-warning" : "btn-primary";
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ marginBottom: "var(--space-5)" }}>{message}</div>
      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className={`btn ${variantClass}`} onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
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
          <div className="skeleton" style={{ height: 14, width: "55%", borderRadius: "var(--radius-sm)" }} />
          <div className="skeleton" style={{ height: 10, width: "40%", borderRadius: "var(--radius-sm)" }} />
        </div>
        <div className="skeleton" style={{ width: 60, height: 22, borderRadius: "var(--radius-full)" }} />
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <div className="skeleton" style={{ width: 80, height: 20, borderRadius: "var(--radius-full)" }} />
        <div className="skeleton" style={{ width: 60, height: 20, borderRadius: "var(--radius-full)" }} />
      </div>
      <div className="skeleton" style={{ height: 1 }} />
      <div className="skeleton" style={{ height: 10, width: "40%", borderRadius: "var(--radius-sm)" }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SemestersPage() {
  const supabase = createSupabaseBrowserClient();

  const [semesters, setSemesters]       = useState<Semester[]>([]);
  const [years, setYears]               = useState<AcademicYear[]>([]);
  const [filterYear, setFilterYear]     = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<SemesterStatus | "all">("all");
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [busy, setBusy]                 = useState(false);

  const [detailTarget, setDetailTarget] = useState<Semester | null>(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [editTarget, setEditTarget]     = useState<Semester | null>(null);
  const [openTarget, setOpenTarget]     = useState<Semester | null>(null);
  const [closeTarget, setCloseTarget]   = useState<Semester | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Semester | null>(null);

  const [formName,     setFormName]     = useState("");
  const [formStart,    setFormStart]    = useState("");
  const [formEnd,      setFormEnd]      = useState("");
  const [formYearId,   setFormYearId]   = useState("");
  const [formAutoOpen, setFormAutoOpen] = useState(false);
  const [formError,    setFormError]    = useState<string | null>(null);

  // ── Data load ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true); setError(null);

    const semsRes     = await (supabase.from("app_semesters") as any)
      .select("id, academic_year_id, name, start_date, end_date, status, auto_open, opened_at, closed_at, created_at")
      .order("start_date", { ascending: false });

    const yearsRes    = await (supabase.from("academic_years") as any)
      .select("id, name, year_code, is_current")
      .order("start_date", { ascending: false });

    const coursesRes  = await (supabase.from("courses") as any).select("semester_id");
    const sessionsRes = await (supabase.from("class_sessions") as any).select("semester_id");

    if (semsRes.error || yearsRes.error) {
      setError((semsRes.error ?? yearsRes.error)!.message);
      setLoading(false);
      return;
    }

    const rawSems: {
      id: string; academic_year_id: string; name: string;
      start_date: string; end_date: string; status: SemesterStatus;
      auto_open: boolean; opened_at: string | null; closed_at: string | null; created_at: string;
    }[] = semsRes.data ?? [];
    const rawYears: AcademicYear[]                = yearsRes.data   ?? [];
    const rawCourses:  { semester_id: string }[]  = coursesRes.data ?? [];
    const rawSessions: { semester_id: string }[]  = sessionsRes.data ?? [];

    const yearMap: Record<string, AcademicYear> = {};
    rawYears.forEach((y) => { yearMap[y.id] = y; });

    const courseCount:  Record<string, number> = {};
    rawCourses.forEach((c)  => { courseCount[c.semester_id]  = (courseCount[c.semester_id]  ?? 0) + 1; });
    const sessionCount: Record<string, number> = {};
    rawSessions.forEach((s) => { sessionCount[s.semester_id] = (sessionCount[s.semester_id] ?? 0) + 1; });

    setYears(rawYears);
    setSemesters(rawSems.map((s) => ({
      ...s,
      year_name:       yearMap[s.academic_year_id]?.name       ?? "Unknown Year",
      year_code:       yearMap[s.academic_year_id]?.year_code  ?? "??",
      is_current_year: yearMap[s.academic_year_id]?.is_current ?? false,
      course_count:    courseCount[s.id]  ?? 0,
      session_count:   sessionCount[s.id] ?? 0,
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const activeSemester = semesters.find((s) => s.status === "active") ?? null;

  function openAdd() {
    const currentYear = years.find((y) => y.is_current) ?? years[0];
    setFormName(""); setFormStart(""); setFormEnd("");
    setFormYearId(currentYear?.id ?? ""); setFormAutoOpen(false); setFormError(null);
    setShowAdd(true);
  }

  function openEdit(s: Semester) {
    setFormName(s.name); setFormStart(s.start_date); setFormEnd(s.end_date);
    setFormYearId(s.academic_year_id); setFormAutoOpen(s.auto_open); setFormError(null);
    setEditTarget(s);
  }

  function closeModals() {
    setShowAdd(false); setEditTarget(null); setOpenTarget(null);
    setCloseTarget(null); setDeleteTarget(null);
    setFormName(""); setFormStart(""); setFormEnd(""); setFormError(null);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleAdd() {
    const name = formName.trim();
    if (!name)       { setFormError("Name is required."); return; }
    if (!formYearId) { setFormError("Select an academic year."); return; }
    const dateErr = validateDates(formStart, formEnd);
    if (dateErr)     { setFormError(dateErr); return; }

    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("app_semesters") as any).insert({
      name, academic_year_id: formYearId,
      start_date: formStart, end_date: formEnd,
      auto_open: formAutoOpen, status: "upcoming",
    });
    setBusy(false);
    if (err) {
      setFormError(err.message.includes("unique")
        ? "A semester with this name already exists in that academic year."
        : err.message);
      return;
    }
    closeModals(); load();
  }

  async function handleEdit() {
    if (!editTarget) return;
    const name = formName.trim();
    if (!name)   { setFormError("Name is required."); return; }
    const dateErr = validateDates(formStart, formEnd);
    if (dateErr) { setFormError(dateErr); return; }

    setBusy(true); setFormError(null);
    const { error: err } = await (supabase.from("app_semesters") as any)
      .update({ name, start_date: formStart, end_date: formEnd, auto_open: formAutoOpen })
      .eq("id", editTarget.id);
    setBusy(false);
    if (err) { setFormError(err.message); return; }
    if (detailTarget?.id === editTarget.id) {
      setDetailTarget({ ...detailTarget, name, start_date: formStart, end_date: formEnd, auto_open: formAutoOpen });
    }
    closeModals(); load();
  }

  async function handleOpen() {
    if (!openTarget) return;
    setBusy(true);
    const { error: err } = await (supabase.rpc as any)("open_semester", { p_semester_id: openTarget.id });
    setBusy(false);
    if (err) { setError(err.message); closeModals(); return; }
    if (detailTarget?.id === openTarget.id) setDetailTarget({ ...detailTarget!, status: "active" });
    closeModals(); load();
  }

  async function handleClose() {
    if (!closeTarget) return;
    setBusy(true);
    const { error: err } = await (supabase.rpc as any)("close_semester", { p_semester_id: closeTarget.id });
    setBusy(false);
    if (err) { setError(err.message); closeModals(); return; }
    if (detailTarget?.id === closeTarget.id) setDetailTarget({ ...detailTarget!, status: "archived" });
    closeModals(); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const { error: err } = await (supabase.from("app_semesters") as any).delete().eq("id", deleteTarget.id);
    setBusy(false);
    if (err) {
      setError(err.message.includes("foreign")
        ? `"${deleteTarget.name}" can't be removed — courses or sessions are linked to it.`
        : err.message);
      closeModals(); return;
    }
    if (detailTarget?.id === deleteTarget.id) setDetailTarget(null);
    closeModals(); load();
  }

  async function handleToggleAutoOpen(s: Semester) {
    const { error: err } = await (supabase.from("app_semesters") as any)
      .update({ auto_open: !s.auto_open })
      .eq("id", s.id);
    if (err) { setError(err.message); return; }
    if (detailTarget?.id === s.id) setDetailTarget({ ...detailTarget!, auto_open: !s.auto_open });
    load();
  }

  // ── Derived / filtered data ───────────────────────────────────────────────

  const filtered = semesters.filter((s) => {
    if (filterYear !== "all" && s.academic_year_id !== filterYear) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, Semester[]>>((acc, s) => {
    const key = `${s.year_name}|||${s.academic_year_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
    const aId   = a.split("|||")[1];
    const bId   = b.split("|||")[1];
    const aYear = years.find((y) => y.id === aId);
    const bYear = years.find((y) => y.id === bId);
    if (aYear?.is_current && !bYear?.is_current) return -1;
    if (!aYear?.is_current && bYear?.is_current) return 1;
    return b.localeCompare(a);
  });

  const statusConfig: Record<SemesterStatus, { label: string; accent: "blue" | "green" | "purple"; badgeVariant: "info" | "success" | "neutral" }> = {
    upcoming: { label: "Upcoming", accent: "blue",   badgeVariant: "info"    },
    active:   { label: "Active",   accent: "green",  badgeVariant: "success" },
    archived: { label: "Archived", accent: "purple", badgeVariant: "neutral" },
  };

  // ── Shared form body ──────────────────────────────────────────────────────

  const formBody = (isEdit: boolean) => (
    <>
      {!isEdit && (
        <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
          <label className="label">Academic Year</label>
          {years.length === 0 ? (
            <div className="alert alert-warning" style={{ fontSize: "var(--text-sm)" }}>
              No academic years found. Add one first.
            </div>
          ) : (
            <select className="input" style={{ appearance: "auto" }} value={formYearId} onChange={(e) => setFormYearId(e.target.value)}>
              <option value="" disabled>Choose an academic year…</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}{y.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
        <label className="label">Semester name</label>
        <input
          className="input"
          placeholder="e.g. First Semester, Semester 2"
          value={formName}
          onChange={(e) => { setFormName(e.target.value); setFormError(null); }}
          autoFocus
          disabled={!isEdit && years.length === 0}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div className="input-group">
          <label className="label">Start date</label>
          <input
            className="input" type="date" value={formStart}
            onChange={(e) => { setFormStart(e.target.value); setFormError(null); }}
            disabled={!isEdit && years.length === 0}
          />
        </div>
        <div className="input-group">
          <label className="label">End date</label>
          <input
            className="input" type="date" value={formEnd}
            onChange={(e) => { setFormEnd(e.target.value); setFormError(null); }}
            disabled={!isEdit && years.length === 0}
          />
        </div>
      </div>

      {/* Auto-open toggle */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "var(--space-3) var(--space-4)",
        background: formAutoOpen ? "rgba(34,197,94,0.06)" : "var(--color-surface-2)",
        border: `1px solid ${formAutoOpen ? "rgba(34,197,94,0.2)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--space-6)",
        transition: "all 200ms ease",
      }}>
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: 2 }}>Auto-open on start date</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
            System will automatically activate this semester when its start date arrives.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFormAutoOpen((v) => !v)}
          style={{
            width: 44, height: 24, borderRadius: 12, flexShrink: 0,
            background: formAutoOpen ? "var(--color-success)" : "var(--color-surface-3)",
            border: "none", cursor: "pointer", transition: "background 200ms ease",
            position: "relative",
          }}
        >
          <span style={{
            position: "absolute", top: 3,
            left: formAutoOpen ? "calc(100% - 19px)" : 3,
            width: 18, height: 18, borderRadius: "50%",
            background: "white", transition: "left 200ms ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </button>
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

  const activeCount   = semesters.filter((s) => s.status === "active").length;
  const upcomingCount = semesters.filter((s) => s.status === "upcoming").length;

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Semesters</h1>
          <p className="page-subtitle">
            {loading ? "Loading…" : semesters.length === 0
              ? "No semesters yet"
              : `${semesters.length} semester${semesters.length === 1 ? "" : "s"}${activeCount > 0 ? " · 1 active" : ""}${upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ""}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} disabled={loading || years.length === 0}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Add Semester
        </button>
      </div>

      {/* ── Active semester banner ── */}
      {!loading && activeSemester && (
        <div style={{
          display: "flex", alignItems: "center", gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          background: "rgba(34,197,94,0.07)",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: "var(--radius-lg)",
          marginBottom: "var(--space-5)",
        }}>
          <StatusDot status="active" />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-success)" }}>
              {activeSemester.name}
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginLeft: "var(--space-2)" }}>
              {activeSemester.year_name} · {fmtDate(activeSemester.start_date)} – {fmtDate(activeSemester.end_date)}
            </span>
          </div>
          <button
            className="btn btn-sm btn-secondary"
            style={{ color: "var(--color-danger)", borderColor: "rgba(239,68,68,0.3)" }}
            onClick={() => setCloseTarget(activeSemester)}
          >
            Close Semester
          </button>
        </div>
      )}

      {/* ── No academic years warning ── */}
      {!loading && years.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" />
          </svg>
          <span style={{ flex: 1 }}>You need at least one academic year before creating semesters.</span>
          <a href="/admin/academic-years" className="btn btn-sm btn-secondary">Go to Academic Years</a>
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

      {/* ── Filters ── */}
      {!loading && semesters.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
          {(["all", "active", "upcoming", "archived"] as const).map((s) => {
            const count = s === "all" ? semesters.length : semesters.filter((x) => x.status === s).length;
            if (s !== "all" && count === 0) return null;
            return (
              <button
                key={s}
                className={`btn btn-sm ${filterStatus === s ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setFilterStatus(s)}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)} ({count})
              </button>
            );
          })}
          {years.filter((y) => semesters.some((s) => s.academic_year_id === y.id)).length > 1 && (
            <>
              <div style={{ width: 1, background: "var(--color-border)", margin: "0 var(--space-1)" }} />
              <button
                className={`btn btn-sm ${filterYear === "all" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setFilterYear("all")}
              >
                All years
              </button>
              {years.filter((y) => semesters.some((s) => s.academic_year_id === y.id)).map((y) => (
                <button
                  key={y.id}
                  className={`btn btn-sm ${filterYear === y.id ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setFilterYear(y.id)}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700 }}>{y.year_code}</span>
                  {y.is_current && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.7 }}>current</span>}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "var(--space-4)" }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>

      ) : semesters.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-8)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "var(--radius-xl)",
            background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-5)", color: "var(--color-secondary)",
          }}>
            <SemIcon />
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>No semesters yet</h3>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)", maxWidth: 400, margin: "0 auto var(--space-6)" }}>
            Semesters belong to an academic year and control when courses and attendance sessions can run.
          </p>
          <button className="btn btn-primary" onClick={openAdd} disabled={years.length === 0}>Add First Semester</button>
        </div>

      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>No semesters match the current filters.</p>

      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          {sortedGroupKeys.map((key) => {
            const [yearName, yearId] = key.split("|||");
            const year  = years.find((y) => y.id === yearId);
            const items = grouped[key];
            return (
              <div key={key}>
                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
                    background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {yearName}
                  </span>
                  {year?.is_current && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: "var(--radius-full)",
                      background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "var(--color-success)",
                    }}>
                      Current Year
                    </span>
                  )}
                  {year && (
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                      padding: "2px 7px", borderRadius: "var(--radius-sm)",
                      background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                      color: "var(--color-secondary)", flexShrink: 0,
                    }}>
                      {year.year_code}
                    </span>
                  )}
                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>{items.length}</span>
                  <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                </div>

                {/* Card grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "var(--space-3)" }}>
                  {items.map((s) => {
                    const cfg       = statusConfig[s.status];
                    const canOpen   = s.status === "upcoming" && !activeSemester;
                    const canClose  = s.status === "active";
                    const canDelete = s.status === "upcoming" && s.course_count === 0;
                    const canEdit   = s.status !== "archived";
                    return (
                      <InstitutionCard
                        key={s.id}
                        accent={cfg.accent}
                        icon={<SemIcon />}
                        title={s.name}
                        meta={`${s.year_name} · ${fmtDate(s.start_date)} – ${fmtDate(s.end_date)}`}
                        badge={cfg.label}
                        badgeVariant={cfg.badgeVariant}
                        tags={[
                          { label: s.status === "active" ? "● Active" : s.status === "upcoming" ? "↑ Upcoming" : "✓ Archived" },
                          { label: s.course_count === 0 ? "No courses" : `${s.course_count} course${s.course_count === 1 ? "" : "s"}` },
                          ...(s.auto_open ? [{ label: "Auto-open" }] : []),
                        ]}
                        footer={`${fmtDate(s.start_date)} → ${fmtDate(s.end_date)}`}
                        onClick={() => setDetailTarget(s)}
                        actions={
                          <>
                            {canOpen && (
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={(e) => { e.stopPropagation(); setOpenTarget(s); }}
                                title="Open semester"
                                style={{ color: "var(--color-success)" }}
                              >
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                                  <circle cx="7" cy="7" r="6" /><path d="M5 7l2 2 3-3" />
                                </svg>
                              </button>
                            )}
                            {canClose && (
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={(e) => { e.stopPropagation(); setCloseTarget(s); }}
                                title="Close semester"
                                style={{ color: "var(--color-warning)" }}
                              >
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                                  <rect x="2" y="2" width="10" height="10" rx="1.5" />
                                </svg>
                              </button>
                            )}
                            {canEdit && (
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                                title="Edit"
                              >
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" />
                                </svg>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                                title="Remove"
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
        subtitle={detailTarget?.year_name}
        accent={detailTarget ? statusConfig[detailTarget.status].accent : "blue"}
        icon={<SemIcon />}
      >
        {detailTarget && (() => {
          const s   = detailTarget;
          const cfg = statusConfig[s.status];
          const canOpen   = s.status === "upcoming" && !activeSemester;
          const canClose  = s.status === "active";
          const canEdit   = s.status !== "archived";
          const canDelete = s.status === "upcoming" && s.course_count === 0;
          return (
            <>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-full)",
                background: cfg.badgeVariant === "success" ? "rgba(34,197,94,0.1)" : cfg.badgeVariant === "info" ? "rgba(6,182,212,0.1)" : "var(--color-surface-3)",
                border: `1px solid ${cfg.badgeVariant === "success" ? "rgba(34,197,94,0.25)" : cfg.badgeVariant === "info" ? "rgba(6,182,212,0.25)" : "var(--color-border)"}`,
                marginBottom: "var(--space-5)",
              }}>
                <StatusDot status={s.status} />
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>{cfg.label}</span>
              </div>

              <DetailSection title="Semester Details">
                <DetailRow label="Academic Year" value={s.year_name} />
                <DetailRow label="Start Date"    value={fmtDateLong(s.start_date)} />
                <DetailRow label="End Date"      value={fmtDateLong(s.end_date)} />
                <DetailRow label="Auto-open"     value={s.auto_open ? "Yes — opens automatically on start date" : "No"} />
                {s.opened_at && <DetailRow label="Opened at" value={fmtDatetime(s.opened_at)} />}
                {s.closed_at && <DetailRow label="Closed at" value={fmtDatetime(s.closed_at)} />}
              </DetailSection>

              <DetailSection title="Activity">
                <DetailRow label="Courses"  value={s.course_count === 0  ? "None" : `${s.course_count} course${s.course_count === 1 ? "" : "s"}`} />
                <DetailRow label="Sessions" value={s.session_count === 0 ? "None" : `${s.session_count} session${s.session_count === 1 ? "" : "s"}`} />
                <DetailRow label="Created"  value={fmtDateLong(s.created_at)} />
              </DetailSection>

              {/* Auto-open quick toggle */}
              {s.status === "upcoming" && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "var(--space-3) var(--space-4)",
                  background: s.auto_open ? "rgba(34,197,94,0.06)" : "var(--color-surface-2)",
                  border: `1px solid ${s.auto_open ? "rgba(34,197,94,0.2)" : "var(--color-border)"}`,
                  borderRadius: "var(--radius-md)", marginBottom: "var(--space-5)",
                  transition: "all 200ms ease",
                }}>
                  <div>
                    <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: 2 }}>Auto-open</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-3)" }}>Opens automatically on start date</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleAutoOpen(s)}
                    style={{
                      width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                      background: s.auto_open ? "var(--color-success)" : "var(--color-surface-3)",
                      border: "none", cursor: "pointer", transition: "background 200ms ease",
                      position: "relative",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 3,
                      left: s.auto_open ? "calc(100% - 17px)" : 3,
                      width: 16, height: 16, borderRadius: "50%",
                      background: "white", transition: "left 200ms ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                {canOpen && (
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setOpenTarget(s); setDetailTarget(null); }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                      <circle cx="7" cy="7" r="6" /><path d="M5 7l2 2 3-3" />
                    </svg>
                    Open Semester
                  </button>
                )}
                {canClose && (
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, color: "var(--color-danger)", borderColor: "rgba(239,68,68,0.3)" }}
                    onClick={() => { setCloseTarget(s); setDetailTarget(null); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                      <rect x="2" y="2" width="10" height="10" rx="1.5" />
                    </svg>
                    Close Semester
                  </button>
                )}
                {canEdit && (
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(s)}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" />
                    </svg>
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { setDeleteTarget(s); setDetailTarget(null); }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                      <path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4M8.5 6v4M3 3.5l.7 8h6.6l.7-8" />
                    </svg>
                    Remove
                  </button>
                )}
              </div>
            </>
          );
        })()}
      </DetailPanel>

      {/* ── Add modal ── */}
      {showAdd && (
        <Modal title="Add Semester" onClose={closeModals}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            Semesters belong to an academic year. Only one semester can be active at a time.
          </p>
          {formBody(false)}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={busy || years.length === 0}>
              {busy ? "Saving…" : "Add Semester"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <Modal title="Edit Semester" onClose={closeModals}>
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--color-surface-2)", borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-5)", fontSize: "var(--text-xs)", color: "var(--color-text-3)",
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
            </svg>
            Academic Year: <strong style={{ color: "var(--color-text-2)" }}>{editTarget.year_name}</strong>
            {editTarget.is_current_year && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: "var(--radius-sm)", background: "rgba(34,197,94,0.1)", color: "var(--color-success)", fontWeight: 600 }}>current</span>
            )}
          </div>
          {formBody(true)}
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeModals} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
          </div>
        </Modal>
      )}

      {/* ── Open confirm ── */}
      {openTarget && (
        <ConfirmModal
          title="Open Semester"
          confirmLabel="Yes, Open Semester"
          confirmVariant="primary"
          busy={busy}
          onConfirm={handleOpen}
          onClose={closeModals}
          message={
            <div style={{
              padding: "var(--space-4)",
              background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: "var(--radius-lg)",
            }}>
              <div style={{ fontWeight: 700, marginBottom: "var(--space-2)", color: "var(--color-success)" }}>
                {openTarget.name}
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", lineHeight: 1.6, margin: 0 }}>
                Opening this semester will allow courses and class sessions to run.
                This semester will become the system-wide active semester. Only one semester can be active at a time.
              </p>
            </div>
          }
        />
      )}

      {/* ── Close confirm ── */}
      {closeTarget && (
        <ConfirmModal
          title="Close Semester"
          confirmLabel="Yes, Close Semester"
          confirmVariant="danger"
          busy={busy}
          onConfirm={handleClose}
          onClose={closeModals}
          message={
            <div style={{
              padding: "var(--space-4)",
              background: "var(--color-danger-bg)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "var(--radius-lg)",
              display: "flex", gap: "var(--space-3)", alignItems: "flex-start",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-danger)" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M8 2L1 14h14L8 2zM8 6v4M8 11.5v.5" />
              </svg>
              <div>
                <div style={{ fontWeight: 700, marginBottom: "var(--space-1)", color: "var(--color-danger)" }}>
                  {closeTarget.name}
                </div>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", lineHeight: 1.6, margin: 0 }}>
                  Closing this semester will archive it and force-close all open class sessions.
                  {closeTarget.session_count > 0 && (
                    <> It has <strong>{closeTarget.session_count} recorded session{closeTarget.session_count === 1 ? "" : "s"}</strong>.</>
                  )}
                  {" "}This cannot be undone.
                </p>
              </div>
            </div>
          }
        />
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <ConfirmModal
          title="Remove Semester"
          confirmLabel="Yes, Remove"
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
                This will permanently remove <strong>{deleteTarget.name}</strong>. This cannot be undone.
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
