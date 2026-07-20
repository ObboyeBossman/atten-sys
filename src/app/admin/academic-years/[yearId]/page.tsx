"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type SemesterStatus = "upcoming" | "active" | "archived";

type AcademicYear = {
  id: string;
  name: string;
  year_code: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type Semester = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SemesterStatus;
  auto_open: boolean;
  course_count: number;
  session_count: number;
};

type Group = {
  id: string;
  group_name: string;
  is_archived: boolean;
  qual_type_name: string;
  qual_type_code: string;
  level_name: string;
  student_count: number;
  course_count: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" });
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IBack = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 4L6 8l4 4"/>
  </svg>
);

const ICalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);

const IGroup = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const IArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const IStar = () => (
  <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor" stroke="none">
    <path d="M7 1l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.1 3.8 10.9l.6-3.6L2 4.8l3.6-.5L7 1z"/>
  </svg>
);

// ── Status badge ──────────────────────────────────────────────────────────────

function SemesterBadge({ status }: { status: SemesterStatus }) {
  const map: Record<SemesterStatus, { label: string; bg: string; color: string; dot: string }> = {
    upcoming: { label: "Upcoming", bg: "rgba(6,182,212,0.10)", color: "var(--color-info)", dot: "var(--color-info)" },
    active:   { label: "Active",   bg: "rgba(34,197,94,0.10)",  color: "var(--color-success)", dot: "var(--color-success)" },
    archived: { label: "Archived", bg: "var(--color-surface-3)", color: "var(--color-text-3)", dot: "var(--color-text-3)" },
  };
  const { label, bg, color, dot } = map[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: "var(--radius-full)",
      background: bg, color, fontSize: "var(--text-xs)", fontWeight: 600, flexShrink: 0,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0,
        boxShadow: status === "active" ? `0 0 0 3px ${dot}30` : undefined,
      }} />
      {label}
    </span>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--color-border)" }}>
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <div className="skeleton" style={{ height: 13, width: "42%", borderRadius: "var(--radius-sm)" }} />
        <div className="skeleton" style={{ height: 10, width: "28%", borderRadius: "var(--radius-sm)" }} />
      </div>
      <div className="skeleton" style={{ width: 64, height: 22, borderRadius: "var(--radius-full)" }} />
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-lg)",
      background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
      minWidth: 68,
    }}>
      <span style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--color-text-1)", lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: "var(--color-text-3)", fontWeight: 500, marginTop: 4, textAlign: "center" }}>{label}</span>
    </div>
  );
}

// ── Archived groups (collapsible) ─────────────────────────────────────────────

function ArchivedGroupsSection({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: "var(--space-3)" }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((v) => !v)}
        style={{ gap: "var(--space-2)", color: "var(--color-text-3)" }}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 180ms ease" }}>
          <path d="M5 3l4 4-4 4"/>
        </svg>
        {open ? "Hide" : "Show"} {groups.length} archived group{groups.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="card" style={{ overflow: "hidden", padding: 0, opacity: 0.65, marginTop: "var(--space-3)" }}>
          {groups.map((g, idx) => (
            <a
              key={g.id}
              href={`/admin/groups/${g.id}`}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-3)",
                padding: "var(--space-4) var(--space-5)", textDecoration: "none",
                borderBottom: idx < groups.length - 1 ? "1px solid var(--color-border)" : undefined,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "var(--radius-lg)", flexShrink: 0,
                background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-3)",
              }}>
                <IGroup />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text-2)" }}>{g.group_name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>{g.qual_type_name} · {g.level_name}</div>
              </div>
              <span style={{
                padding: "2px 8px", borderRadius: "var(--radius-full)",
                background: "var(--color-surface-3)", color: "var(--color-text-3)",
                fontSize: 10, fontWeight: 600, flexShrink: 0,
              }}>Archived</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AcademicYearDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const yearId   = params.yearId as string;
  const supabase = createSupabaseBrowserClient();

  const [year,      setYear]      = useState<AcademicYear | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [groups,    setGroups]    = useState<Group[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);

    const [yearRes, semRes, groupRes] = await Promise.all([
      (supabase.from("academic_years") as any)
        .select("id, name, year_code, start_date, end_date, is_current")
        .eq("id", yearId)
        .single(),
      (supabase.from("app_semesters") as any)
        .select("id, name, start_date, end_date, status, auto_open")
        .eq("academic_year_id", yearId)
        .order("start_date"),
      (supabase.from("groups") as any)
        .select("id, group_name, is_archived, qualification_type_id, level_id")
        .eq("academic_year_id", yearId)
        .order("group_name"),
    ]);

    if (yearRes.error)  { setError("Academic year not found."); setLoading(false); return; }
    if (semRes.error)   { setError(semRes.error.message);       setLoading(false); return; }
    if (groupRes.error) { setError(groupRes.error.message);     setLoading(false); return; }

    setYear(yearRes.data);

    // Enrich semesters
    const rawSems: { id: string; name: string; start_date: string; end_date: string; status: SemesterStatus; auto_open: boolean }[] = semRes.data ?? [];
    if (rawSems.length > 0) {
      const semIds = rawSems.map((s) => s.id);
      const [cRes, sRes] = await Promise.all([
        (supabase.from("courses") as any).select("semester_id").in("semester_id", semIds),
        (supabase.from("class_sessions") as any).select("semester_id").in("semester_id", semIds),
      ]);
      const cBySem: Record<string, number> = {};
      const sBySem: Record<string, number> = {};
      (cRes.data ?? []).forEach((c: { semester_id: string }) => { cBySem[c.semester_id] = (cBySem[c.semester_id] ?? 0) + 1; });
      (sRes.data ?? []).forEach((s: { semester_id: string }) => { sBySem[s.semester_id] = (sBySem[s.semester_id] ?? 0) + 1; });
      setSemesters(rawSems.map((s) => ({ ...s, course_count: cBySem[s.id] ?? 0, session_count: sBySem[s.id] ?? 0 })));
    } else {
      setSemesters([]);
    }

    // Enrich groups
    const rawGroups: { id: string; group_name: string; is_archived: boolean; qualification_type_id: string; level_id: string }[] = groupRes.data ?? [];
    if (rawGroups.length > 0) {
      const qtIds    = [...new Set(rawGroups.map((g) => g.qualification_type_id))];
      const levelIds = [...new Set(rawGroups.map((g) => g.level_id))];
      const groupIds = rawGroups.map((g) => g.id);
      const [qtRes, lvlRes, membRes, gcRes] = await Promise.all([
        (supabase.from("qualification_types") as any).select("id, name, code").in("id", qtIds),
        (supabase.from("levels") as any).select("id, name").in("id", levelIds),
        (supabase.from("group_memberships") as any).select("group_id").eq("status", "active").in("group_id", groupIds),
        (supabase.from("courses") as any).select("group_id").in("group_id", groupIds),
      ]);
      const qtMap:  Record<string, { name: string; code: string }> = {};
      const lvlMap: Record<string, string> = {};
      const studCount:   Record<string, number> = {};
      const courseCount: Record<string, number> = {};
      (qtRes.data ?? []).forEach((q: { id: string; name: string; code: string }) => { qtMap[q.id] = { name: q.name, code: q.code }; });
      (lvlRes.data ?? []).forEach((l: { id: string; name: string }) => { lvlMap[l.id] = l.name; });
      (membRes.data ?? []).forEach((m: { group_id: string }) => { studCount[m.group_id]   = (studCount[m.group_id]   ?? 0) + 1; });
      (gcRes.data ?? []).forEach((c: { group_id: string }) => { courseCount[c.group_id] = (courseCount[c.group_id] ?? 0) + 1; });
      setGroups(rawGroups.map((g) => ({
        id: g.id, group_name: g.group_name, is_archived: g.is_archived,
        qual_type_name: qtMap[g.qualification_type_id]?.name ?? "Unknown",
        qual_type_code: qtMap[g.qualification_type_id]?.code ?? "?",
        level_name:     lvlMap[g.level_id] ?? "Unknown Level",
        student_count:  studCount[g.id]   ?? 0,
        course_count:   courseCount[g.id] ?? 0,
      })));
    } else {
      setGroups([]);
    }

    setLoading(false);
  }, [supabase, yearId]);

  useEffect(() => { load(); }, [load]);

  const activeGroups   = groups.filter((g) => !g.is_archived);
  const archivedGroups = groups.filter((g) => g.is_archived);
  const totalStudents  = groups.reduce((n, g) => n + g.student_count, 0);
  const totalCourses   = semesters.reduce((n, s) => n + s.course_count, 0);
  const totalSessions  = semesters.reduce((n, s) => n + s.session_count, 0);

  if (error) {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/admin/academic-years")}
          style={{ marginBottom: "var(--space-4)", gap: "var(--space-1)" }}>
          <IBack /> Academic Years
        </button>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Back nav ── */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => router.push("/admin/academic-years")}
        style={{ marginBottom: "var(--space-5)", gap: "var(--space-1)", color: "var(--color-text-3)" }}
      >
        <IBack /> Academic Years
      </button>

      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: "var(--space-6)", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)", flex: 1, minWidth: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "var(--radius-xl)", flexShrink: 0,
            background: year?.is_current ? "rgba(59,130,246,0.10)" : "var(--color-surface-2)",
            border: `1px solid ${year?.is_current ? "rgba(59,130,246,0.25)" : "var(--color-border)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: year?.is_current ? "var(--color-secondary)" : "var(--color-text-3)",
          }}>
            {loading
              ? <div className="skeleton" style={{ width: 28, height: 28, borderRadius: "var(--radius-md)" }} />
              : <ICalendar />}
          </div>
          <div style={{ minWidth: 0 }}>
            {loading ? (
              <>
                <div className="skeleton" style={{ width: 200, height: 24, borderRadius: "var(--radius-sm)", marginBottom: 8 }} />
                <div className="skeleton" style={{ width: 160, height: 14, borderRadius: "var(--radius-sm)" }} />
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <h1 className="page-title" style={{ margin: 0 }}>{year?.name}</h1>
                  {year?.is_current && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 8px", borderRadius: "var(--radius-full)",
                      background: "rgba(59,130,246,0.12)", color: "var(--color-secondary)",
                      fontSize: "var(--text-xs)", fontWeight: 700,
                    }}>
                      <IStar /> Current year
                    </span>
                  )}
                </div>
                <p className="page-subtitle" style={{ margin: "var(--space-1) 0 0" }}>
                  {fmtDateLong(year!.start_date)} – {fmtDateLong(year!.end_date)}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Promote CTA */}
        {!loading && year?.is_current && (
          <button
            className="btn btn-primary"
            onClick={() => router.push(`/admin/academic-years/${yearId}/promote`)}
            style={{ gap: "var(--space-2)", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Run Year-End Promotion
            <IArrow />
          </button>
        )}
      </div>

      {/* ── Stats strip ── */}
      {loading ? (
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-7)", flexWrap: "wrap" }}>
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="skeleton" style={{ width: 72, height: 64, borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-7)", flexWrap: "wrap" }}>
          <Chip label="Semesters"     value={semesters.length} />
          <Chip label="Active groups" value={activeGroups.length} />
          <Chip label="Students"      value={totalStudents} />
          <Chip label="Courses"       value={totalCourses} />
          <Chip label="Sessions"      value={totalSessions} />
        </div>
      )}

      {/* ── Semesters ── */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-text-1)" }}>Semesters</h2>
          <a href="/admin/semesters" style={{ fontSize: "var(--text-xs)", color: "var(--color-secondary)", textDecoration: "none", fontWeight: 500 }}>
            Manage semesters →
          </a>
        </div>
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          {loading ? (
            <>{[1, 2].map((i) => <SkeletonRow key={i} />)}</>
          ) : semesters.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--space-10) var(--space-6)", color: "var(--color-text-3)" }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: "var(--space-1)" }}>No semesters yet</div>
              <p style={{ fontSize: "var(--text-xs)", margin: 0 }}>
                Add semesters from the{" "}
                <a href="/admin/semesters" style={{ color: "var(--color-secondary)" }}>Semesters page</a>
              </p>
            </div>
          ) : semesters.map((sem, idx) => (
            <div key={sem.id} style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              padding: "var(--space-4) var(--space-5)",
              borderBottom: idx < semesters.length - 1 ? "1px solid var(--color-border)" : undefined,
              flexWrap: "wrap",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: "var(--radius-lg)", flexShrink: 0,
                background: sem.status === "active" ? "rgba(34,197,94,0.10)" : "var(--color-surface-2)",
                border: `1px solid ${sem.status === "active" ? "rgba(34,197,94,0.25)" : "var(--color-border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: sem.status === "active" ? "var(--color-success)" : "var(--color-text-3)",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text-1)" }}>{sem.name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>
                  {fmtDate(sem.start_date)} – {fmtDate(sem.end_date)}
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                  {sem.course_count} course{sem.course_count !== 1 ? "s" : ""}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                  {sem.session_count} session{sem.session_count !== 1 ? "s" : ""}
                </span>
              </div>
              <SemesterBadge status={sem.status} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Groups ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-text-1)" }}>Groups</h2>
          <a href="/admin/groups" style={{ fontSize: "var(--text-xs)", color: "var(--color-secondary)", textDecoration: "none", fontWeight: 500 }}>
            Manage groups →
          </a>
        </div>

        {loading ? (
          <div className="card" style={{ overflow: "hidden", padding: 0 }}>
            {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "var(--space-10) var(--space-6)", color: "var(--color-text-3)" }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: "var(--space-1)" }}>No groups in this year</div>
            <p style={{ fontSize: "var(--text-xs)", margin: 0 }}>
              Create groups from the{" "}
              <a href="/admin/groups" style={{ color: "var(--color-secondary)" }}>Groups page</a>
            </p>
          </div>
        ) : (
          <>
            {activeGroups.length > 0 && (
              <div className="card" style={{ overflow: "hidden", padding: 0 }}>
                {activeGroups.map((g, idx) => (
                  <a
                    key={g.id}
                    href={`/admin/groups/${g.id}`}
                    style={{
                      display: "flex", alignItems: "center", gap: "var(--space-3)",
                      padding: "var(--space-4) var(--space-5)", textDecoration: "none",
                      borderBottom: idx < activeGroups.length - 1 ? "1px solid var(--color-border)" : undefined,
                      transition: "background 150ms ease", flexWrap: "wrap",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: "var(--radius-lg)", flexShrink: 0,
                      background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7",
                    }}>
                      <IGroup />
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text-1)" }}>{g.group_name}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>
                        {g.qual_type_name} · {g.level_name}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                        {g.student_count} student{g.student_count !== 1 ? "s" : ""}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                        {g.course_count} course{g.course_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                      padding: "2px 7px", borderRadius: "var(--radius-sm)",
                      background: "rgba(168,85,247,0.10)", color: "#a855f7",
                      border: "1px solid rgba(168,85,247,0.2)", flexShrink: 0,
                    }}>{g.qual_type_code}</span>
                  </a>
                ))}
              </div>
            )}
            {archivedGroups.length > 0 && <ArchivedGroupsSection groups={archivedGroups} />}
          </>
        )}
      </div>
    </div>
  );
}
