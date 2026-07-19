import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit Log" };
export const revalidate = 15;

// ── Human-readable labels for action codes ───────────────────────────────────
const ACTION_LABELS: Record<string, { label: string; category: string; color: string }> = {
  "user.login":                   { label: "User logged in",           category: "Auth",       color: "var(--color-info)" },
  "user.logout":                  { label: "User logged out",          category: "Auth",       color: "var(--color-text-3)" },
  "user.password_changed":        { label: "Password changed",         category: "Auth",       color: "var(--color-warning)" },
  "student.created":              { label: "Student account created",  category: "Users",      color: "var(--color-success)" },
  "student.updated":              { label: "Student profile updated",  category: "Users",      color: "var(--color-info)" },
  "student.deactivated":          { label: "Student deactivated",      category: "Users",      color: "var(--color-danger)" },
  "student.reactivated":          { label: "Student reactivated",      category: "Users",      color: "var(--color-success)" },
  "student.membership_added":     { label: "Student added to group",   category: "Groups",     color: "var(--color-success)" },
  "lecturer.created":             { label: "Lecturer account created", category: "Users",      color: "var(--color-success)" },
  "lecturer.updated":             { label: "Lecturer profile updated", category: "Users",      color: "var(--color-info)" },
  "semester.opened":              { label: "Semester started",         category: "Semesters",  color: "var(--color-success)" },
  "semester.closed":              { label: "Semester ended",           category: "Semesters",  color: "var(--color-warning)" },
  "academic_year.opened":         { label: "Academic year activated",  category: "Academic",   color: "var(--color-success)" },
  "academic_year.promoted":       { label: "Students promoted",        category: "Academic",   color: "var(--color-primary)" },
  "session.opened":               { label: "Class session started",    category: "Sessions",   color: "var(--color-success)" },
  "session.closed":               { label: "Class session ended",      category: "Sessions",   color: "var(--color-text-3)" },
  "attendance.checked_in":        { label: "Student checked in",       category: "Attendance", color: "var(--color-success)" },
  "dispute.raised":               { label: "Dispute raised",           category: "Disputes",   color: "var(--color-warning)" },
  "dispute.resolved":             { label: "Dispute resolved",         category: "Disputes",   color: "var(--color-success)" },
  "dispute.rejected":             { label: "Dispute rejected",         category: "Disputes",   color: "var(--color-danger)" },
};

const CATEGORY_COLORS: Record<string, string> = {
  Auth:       "var(--color-info)",
  Users:      "var(--color-primary)",
  Groups:     "var(--color-warning)",
  Semesters:  "var(--color-success)",
  Academic:   "var(--color-success)",
  Sessions:   "var(--color-text-2)",
  Attendance: "var(--color-success)",
  Disputes:   "var(--color-warning)",
  System:     "var(--color-text-3)",
};

function resolveAction(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  // fallback: prettify the raw action string
  const parts = action.split(".");
  const label = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" → ");
  return { label, category: parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "System", color: "var(--color-text-2)" };
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)     return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
}

function formatFullTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GH", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ── Icon per category ─────────────────────────────────────────────────────────
function CategoryIcon({ category }: { category: string }) {
  const size = 15;
  const props = { width: size, height: size, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (category) {
    case "Auth":       return <svg {...props}><path d="M12 2H8a2 2 0 00-2 2v1H4a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2V4a2 2 0 00-2-2z"/><circle cx="10" cy="12" r="2"/><path d="M10 14v2"/></svg>;
    case "Users":      return <svg {...props}><circle cx="8" cy="6" r="3"/><path d="M2 18c0-3.3 2.7-6 6-6"/><circle cx="14" cy="8" r="2.5"/><path d="M11 18c0-2.8 1.3-5 3-5s3 2.2 3 5"/></svg>;
    case "Groups":     return <svg {...props}><path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="10" cy="7" r="4"/></svg>;
    case "Semesters":  return <svg {...props}><circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 3"/></svg>;
    case "Academic":   return <svg {...props}><rect x="2" y="3" width="16" height="14" rx="1.5"/><path d="M2 8h16M7 2v3M13 2v3"/></svg>;
    case "Sessions":   return <svg {...props}><rect x="2" y="5" width="12" height="10" rx="1.5"/><path d="M14 8l5-3v9l-5-3"/></svg>;
    case "Attendance": return <svg {...props}><path d="M4 10l5 5L19 4"/><circle cx="10" cy="10" r="9"/></svg>;
    case "Disputes":   return <svg {...props}><path d="M10 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z"/></svg>;
    default:           return <svg {...props}><circle cx="10" cy="10" r="8"/><path d="M10 6v5l3 3"/></svg>;
  }
}

type AuditRow = {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
};

async function getAuditEvents(page = 0, limit = 50): Promise<{ events: AuditRow[]; total: number }> {
  const supabase = await createSupabaseServerClient();

  const [countRes, rowsRes] = await Promise.all([
    supabase.from("audit_log").select("id", { count: "exact", head: true }),
    supabase
      .from("audit_log")
      .select("id, actor_id, action, table_name, record_id, old_data, new_data, created_at")
      .order("created_at", { ascending: false })
      .range(page * limit, page * limit + limit - 1),
  ]);

  const events = (rowsRes.data ?? []) as AuditRow[];

  // Resolve actor names for non-null actor_ids
  const actorIds = [...new Set(events.filter((e) => e.actor_id).map((e) => e.actor_id as string))];
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, email, role")
      .in("id", actorIds);

    if (profiles) {
      // Fetch display names from role-specific tables
      const [{ data: admins }, { data: lecturers }, { data: students }] = await Promise.all([
        supabase.from("super_admins").select("id, name").in("id", actorIds),
        supabase.from("lecturers").select("id, name").in("id", actorIds),
        supabase.from("students").select("id, name").in("id", actorIds),
      ]);

      const nameMap: Record<string, string> = {};
      const emailMap: Record<string, string> = {};
      (profiles as { id: string; email: string }[]).forEach((p) => { emailMap[p.id] = p.email; });
      ([...(admins ?? []), ...(lecturers ?? []), ...(students ?? [])] as { id: string; name: string }[]).forEach((r) => {
        nameMap[r.id] = r.name;
      });

      events.forEach((e) => {
        if (e.actor_id) {
          e.actor_name  = nameMap[e.actor_id]  ?? null;
          e.actor_email = emailMap[e.actor_id] ?? null;
        }
      });
    }
  }

  return { events, total: countRes.count ?? 0 };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10));
  const limit = 50;
  const { events, total } = await getAuditEvents(page, limit);
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Immutable record of all system events — {total.toLocaleString()} entries</p>
        </div>
      </div>

      {/* Event list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {events.length === 0 ? (
          <div style={{ padding: "var(--space-12)", textAlign: "center", color: "var(--color-text-3)" }}>
            No audit events recorded yet.
          </div>
        ) : (
          <div>
            {events.map((event, idx) => {
              const resolved = resolveAction(event.action);
              const isSystem = !event.actor_id;
              const catColor = CATEGORY_COLORS[resolved.category] ?? "var(--color-text-3)";

              return (
                <div
                  key={event.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr auto",
                    gap: "var(--space-4)",
                    alignItems: "start",
                    padding: "var(--space-4) var(--space-5)",
                    borderBottom: idx < events.length - 1 ? "1px solid var(--color-border)" : "none",
                    transition: "background 0.15s",
                  }}
                  className="audit-row"
                >
                  {/* Icon */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--radius-lg)",
                    background: `color-mix(in srgb, ${catColor} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${catColor} 25%, transparent)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: catColor,
                    flexShrink: 0,
                    marginTop: 2,
                  }}>
                    <CategoryIcon category={resolved.category} />
                  </div>

                  {/* Main content */}
                  <div style={{ minWidth: 0 }}>
                    {/* Action label */}
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-1)" }}>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text)" }}>
                        {resolved.label}
                      </span>
                      <span
                        className="badge"
                        style={{
                          fontSize: "10px",
                          padding: "1px 6px",
                          background: `color-mix(in srgb, ${catColor} 12%, transparent)`,
                          color: catColor,
                          border: `1px solid color-mix(in srgb, ${catColor} 20%, transparent)`,
                        }}
                      >
                        {resolved.category}
                      </span>
                    </div>

                    {/* Actor */}
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                      {isSystem ? (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "1px 7px",
                          borderRadius: "var(--radius-full)",
                          background: "var(--color-surface-3)",
                          color: "var(--color-text-2)",
                          fontSize: "10px",
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                        }}>
                          <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                            <circle cx="7" cy="7" r="6"/><path d="M5 7h4M7 5v4"/>
                          </svg>
                          SYSTEM
                        </span>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                            <circle cx="7" cy="5" r="3"/><path d="M1 13c0-3 2.7-5 6-5s6 2 6 5"/>
                          </svg>
                          <span style={{ fontWeight: 500, color: "var(--color-text-2)" }}>
                            {event.actor_name ?? event.actor_email ?? event.actor_id?.slice(0, 8) + "…"}
                          </span>
                          {event.actor_email && event.actor_name && (
                            <span style={{ color: "var(--color-text-3)" }}>· {event.actor_email}</span>
                          )}
                        </>
                      )}
                      {event.table_name && (
                        <>
                          <span>·</span>
                          <span style={{ fontFamily: "monospace", fontSize: "10px", background: "var(--color-surface-3)", padding: "1px 5px", borderRadius: "var(--radius-sm)", color: "var(--color-text-2)" }}>
                            {event.table_name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-2)", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {formatRelativeTime(event.created_at)}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--color-text-3)", marginTop: 2, whiteSpace: "nowrap" }}>
                      {formatFullTime(event.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "var(--space-4)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-3)",
        }}>
          <span>
            Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total.toLocaleString()} events
          </span>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {page > 0 && (
              <a
                href={`/admin/audit?page=${page - 1}`}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-2)",
                  fontSize: "var(--text-xs)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                ← Previous
              </a>
            )}
            {page < totalPages - 1 && (
              <a
                href={`/admin/audit?page=${page + 1}`}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-2)",
                  fontSize: "var(--text-xs)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
