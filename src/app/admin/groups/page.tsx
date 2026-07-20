"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { InstitutionCard, DetailPanel, DetailRow, DetailSection } from "@/components/layout/InstitutionCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type Group = {
  id: string;
  group_name: string;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  qualification_type_id: string;
  level_id: string;
  academic_year_id: string;
  qual_code: string;
  qual_name: string;
  level_name: string;
  year_name: string;
  is_current_year: boolean;
  active_student_count: number;
  course_count: number;
};

type FilterOption = { id: string; name: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" });
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const GroupIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
        {[70, 55, 80].map((w, i) => <div key={i} className="skeleton" style={{ width: w, height: 20, borderRadius: "var(--radius-full)" }} />)}
      </div>
      <div className="skeleton" style={{ height: 1 }} />
      <div className="skeleton" style={{ height: 10, width: "40%", borderRadius: "var(--radius-sm)" }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseBrowserClient() as any;

  const [groups, setGroups]     = useState<Group[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  const [filterYear, setFilterYear]         = useState("all");
  const [filterQual, setFilterQual]         = useState("all");
  const [filterArchived, setFilterArchived] = useState("active");
  const [yearOptions, setYearOptions]       = useState<FilterOption[]>([]);
  const [qualOptions, setQualOptions]       = useState<FilterOption[]>([]);

  const [detailTarget, setDetailTarget] = useState<Group | null>(null);
  const [showAdd, setShowAdd]           = useState(false);

  const [fYearId,    setFYearId]    = useState("");
  const [fQualId,    setFQualId]    = useState("");
  const [fLevelId,   setFLevelId]   = useState("");
  const [fName,      setFName]      = useState("");
  const [fPassword,  setFPassword]  = useState("");
  const [fShowPwd,   setFShowPwd]   = useState(false);
  const [fError,     setFError]     = useState<string | null>(null);

  const [allYears,   setAllYears]   = useState<{ id: string; name: string }[]>([]);
  const [allQuals,   setAllQuals]   = useState<{ id: string; name: string; code: string }[]>([]);
  const [qualLevels, setQualLevels] = useState<{ id: string; name: string; sort_order: number }[]>([]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true); setError(null);

    const [grpRes, memRes, crsRes, yearRes, qtRes] = await Promise.all([
      supabase.from("groups").select(`
        id, group_name, is_archived, archived_at, created_at,
        qualification_type_id, level_id, academic_year_id,
        qualification_types ( name, code ),
        levels ( name, sort_order ),
        academic_years ( name, year_code, is_current )
      `).order("created_at", { ascending: false }),

      supabase.from("group_memberships").select("group_id").eq("status", "active"),
      supabase.from("courses").select("group_id"),
      supabase.from("academic_years").select("id, name").order("start_date", { ascending: false }),
      supabase.from("qualification_types").select("id, name, code").order("name"),
    ]);

    if (grpRes.error) { setError(grpRes.error.message); setLoading(false); return; }

    const memCount: Record<string, number> = {};
    (grpRes.data ?? []).forEach(() => {});
    (memRes.data ?? []).forEach((m: { group_id: string }) => {
      memCount[m.group_id] = (memCount[m.group_id] ?? 0) + 1;
    });
    const crsCount: Record<string, number> = {};
    (crsRes.data ?? []).forEach((c: { group_id: string }) => {
      crsCount[c.group_id] = (crsCount[c.group_id] ?? 0) + 1;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: Group[] = (grpRes.data ?? []).map((g: any) => ({
      id: g.id,
      group_name: g.group_name,
      is_archived: g.is_archived,
      archived_at: g.archived_at,
      created_at: g.created_at,
      qualification_type_id: g.qualification_type_id,
      level_id: g.level_id,
      academic_year_id: g.academic_year_id,
      qual_code: g.qualification_types?.code ?? "",
      qual_name: g.qualification_types?.name ?? "",
      level_name: g.levels?.name ?? "",
      year_name: g.academic_years?.name ?? "",
      is_current_year: !!g.academic_years?.is_current,
      active_student_count: memCount[g.id] ?? 0,
      course_count: crsCount[g.id] ?? 0,
    }));

    setGroups(mapped);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setYearOptions((yearRes.data ?? []).map((y: any) => ({ id: y.id, name: y.name })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setQualOptions((qtRes.data ?? []).map((q: any) => ({ id: q.id, name: `${q.code} — ${q.name}` })));
    setAllYears(yearRes.data ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAllQuals((qtRes.data ?? []).map((q: any) => ({ id: q.id, name: q.name, code: q.code })));
    setLoading(false);
  }, [supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!fQualId) { setQualLevels([]); setFLevelId(""); return; }
    supabase
      .from("levels")
      .select("id, name, sort_order")
      .eq("qualification_type_id", fQualId)
      .order("sort_order")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => { setQualLevels(data ?? []); setFLevelId(""); });
  }, [fQualId, supabase]);

  // ── Filtered ──────────────────────────────────────────────────────────────

  const filtered = groups.filter((g) => {
    if (filterYear !== "all" && g.academic_year_id !== filterYear) return false;
    if (filterQual !== "all" && g.qualification_type_id !== filterQual) return false;
    if (filterArchived === "active"   && g.is_archived)  return false;
    if (filterArchived === "archived" && !g.is_archived) return false;
    return true;
  });

  // ── Add group ─────────────────────────────────────────────────────────────

  function openAdd() {
    setFYearId(""); setFQualId(""); setFLevelId(""); setFName(""); setFPassword("");
    setFShowPwd(false); setFError(null); setShowAdd(true);
  }
  function closeAdd() { setShowAdd(false); setFError(null); }

  async function handleAdd() {
    if (!fYearId)                                          { setFError("Select an academic year."); return; }
    if (!fQualId)                                          { setFError("Select a qualification type."); return; }
    if (!fLevelId)                                         { setFError("Select a level."); return; }
    if (!fName.trim())                                     { setFError("Group name is required."); return; }
    if (!fPassword.trim() || fPassword.trim().length < 6)  { setFError("Default password must be at least 6 characters."); return; }

    setBusy(true); setFError(null);

    const { data: grpData, error: grpErr } = await supabase
      .from("groups")
      .insert({
        qualification_type_id: fQualId,
        level_id: fLevelId,
        academic_year_id: fYearId,
        group_name: fName.trim(),
      })
      .select("id")
      .single();

    if (grpErr) {
      setBusy(false);
      setFError(
        grpErr.message.includes("unique") || grpErr.message.includes("duplicate")
          ? "A group with this name already exists for that year, qualification type, and level."
          : grpErr.message
      );
      return;
    }

    const { error: secErr } = await supabase.from("groups_secrets").insert({
      group_id: (grpData as { id: string }).id,
      default_password: fPassword.trim(),
    });

    if (secErr) {
      await supabase.from("groups").delete().eq("id", (grpData as { id: string }).id);
      setBusy(false);
      setFError("Failed to save group password. Group was not created.");
      return;
    }

    setBusy(false); closeAdd(); load();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const activeCount   = groups.filter(g => !g.is_archived).length;
  const archivedCount = groups.filter(g =>  g.is_archived).length;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">
            {loading ? "Loading…" : `${activeCount} active${archivedCount > 0 ? ` · ${archivedCount} archived` : ""}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} disabled={loading}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Create Group
        </button>
      </div>

      {/* Filters */}
      {!loading && groups.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-5)" }}>
          <select className="input" style={{ width: "auto", minWidth: 170 }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="all">All Academic Years</option>
            {yearOptions.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <select className="input" style={{ width: "auto", minWidth: 190 }} value={filterQual} onChange={(e) => setFilterQual(e.target.value)}>
            <option value="all">All Qualification Types</option>
            {qualOptions.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <select className="input" style={{ width: "auto", minWidth: 140 }} value={filterArchived} onChange={(e) => setFilterArchived(e.target.value)}>
            <option value="active">Active only</option>
            <option value="archived">Archived only</option>
            <option value="all">All groups</option>
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" /><path d="M8 5v3M8 10v.5" />
          </svg>
          <span style={{ flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
          {[1,2,3,4,5,6].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-16) var(--space-8)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "var(--radius-xl)",
            background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-5)", color: "var(--color-secondary)",
          }}>
            <GroupIcon />
          </div>
          <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>
            {groups.length === 0 ? "No groups yet" : "No groups match your filters"}
          </h3>
          <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)", maxWidth: 400, margin: "0 auto var(--space-6)" }}>
            {groups.length === 0
              ? "Groups are cohorts of students sharing courses in a given year and level. Create your first group to get started."
              : "Try adjusting your filters to see more groups."}
          </p>
          {groups.length === 0 && <button className="btn btn-primary" onClick={openAdd}>Create First Group</button>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
          {filtered.map((g) => {
            const accent   = g.is_archived ? "purple" : g.is_current_year ? "green" : "blue";
            const badge    = g.is_archived ? "Archived" : g.is_current_year ? "Current Year" : g.year_name;
            const bVariant = g.is_archived ? "warning" : g.is_current_year ? "success" : "neutral";
            return (
              <InstitutionCard
                key={g.id}
                accent={accent}
                icon={<GroupIcon />}
                title={g.group_name}
                meta={`${g.qual_code} · ${g.level_name} · ${g.year_name}`}
                badge={badge}
                badgeVariant={bVariant}
                tags={[
                  { label: g.active_student_count === 0 ? "No students" : `${g.active_student_count} student${g.active_student_count === 1 ? "" : "s"}` },
                  { label: g.course_count === 0 ? "No courses" : `${g.course_count} course${g.course_count === 1 ? "" : "s"}` },
                  { label: g.level_name, mono: true },
                ]}
                footer={g.is_archived && g.archived_at ? `Archived ${fmtDate(g.archived_at)}` : `Created ${fmtDate(g.created_at)}`}
                onClick={() => setDetailTarget(g)}
                actions={
                  <a
                    href={`/admin/groups/${g.id}`}
                    className="btn btn-ghost btn-icon btn-sm"
                    title="Open detail page"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                      <path d="M7 1h6v6M13 1L6 8M3 3H1v10h10v-2" />
                    </svg>
                  </a>
                }
              />
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      <DetailPanel
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget?.group_name ?? ""}
        subtitle={detailTarget ? `${detailTarget.qual_code} · ${detailTarget.level_name} · ${detailTarget.year_name}` : undefined}
        accent={detailTarget?.is_archived ? "purple" : detailTarget?.is_current_year ? "green" : "blue"}
        icon={<GroupIcon />}
      >
        {detailTarget && (() => {
          const g = detailTarget;
          return (
            <>
              {g.is_archived && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
                  padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-full)",
                  background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                  marginBottom: "var(--space-5)",
                }}>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-warning)" }}>
                    Archived Group — Read Only
                  </span>
                </div>
              )}
              <DetailSection title="Group Details">
                <DetailRow label="Name"               value={g.group_name} />
                <DetailRow label="Qualification Type" value={`${g.qual_code} — ${g.qual_name}`} />
                <DetailRow label="Level"              value={g.level_name} />
                <DetailRow label="Academic Year"      value={g.year_name} />
                <DetailRow label="Created"            value={fmtDateLong(g.created_at)} />
                {g.archived_at && <DetailRow label="Archived" value={fmtDateLong(g.archived_at)} />}
              </DetailSection>
              <DetailSection title="Contents">
                <DetailRow label="Active Students" value={g.active_student_count === 0 ? "None" : g.active_student_count} />
                <DetailRow label="Courses"         value={g.course_count === 0 ? "None" : g.course_count} />
              </DetailSection>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <a href={`/admin/groups/${g.id}`} className="btn btn-primary" style={{ flex: 1 }}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M7 1h6v6M13 1L6 8M3 3H1v10h10v-2" />
                  </svg>
                  Open Group
                </a>
              </div>
            </>
          );
        })()}
      </DetailPanel>

      {/* Add modal */}
      {showAdd && (
        <Modal title="Create Group" onClose={closeAdd}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-3)", marginBottom: "var(--space-5)", lineHeight: 1.6 }}>
            A group is a cohort of students sharing the same courses in a given academic year and level.
            The default password is used when new students first log in.
          </p>

          <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
            <label className="label">Academic Year</label>
            <select className="input" value={fYearId} onChange={(e) => { setFYearId(e.target.value); setFError(null); }}>
              <option value="">Select year…</option>
              {allYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
            <label className="label">Qualification Type</label>
            <select className="input" value={fQualId} onChange={(e) => { setFQualId(e.target.value); setFError(null); }}>
              <option value="">Select qualification type…</option>
              {allQuals.map((q) => <option key={q.id} value={q.id}>{q.code} — {q.name}</option>)}
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
            <label className="label">Level</label>
            <select className="input" value={fLevelId} onChange={(e) => { setFLevelId(e.target.value); setFError(null); }} disabled={!fQualId}>
              <option value="">{fQualId ? "Select level…" : "Select a qualification type first"}</option>
              {qualLevels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
            <label className="label">Group Name</label>
            <input className="input" placeholder="e.g. BC/ITS/24 L100" value={fName} onChange={(e) => { setFName(e.target.value); setFError(null); }} />
          </div>

          <div className="input-group" style={{ marginBottom: "var(--space-4)" }}>
            <label className="label">Default Password</label>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                type={fShowPwd ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={fPassword}
                onChange={(e) => { setFPassword(e.target.value); setFError(null); }}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setFShowPwd(!fShowPwd)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-3)", padding: 2 }}
                aria-label={fShowPwd ? "Hide password" : "Show password"}
              >
                {fShowPwd
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: "var(--space-1)", display: "block" }}>
              Students receive this password when first added to the group. It is stored securely and is never shown again.
            </span>
          </div>

          {fError && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "var(--space-1)", marginBottom: "var(--space-4)" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="6" cy="6" r="5" /><path d="M6 4v2.5M6 8v.5" />
              </svg>
              {fError}
            </p>
          )}

          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={closeAdd} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={busy}>
              {busy ? "Creating…" : "Create Group"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
