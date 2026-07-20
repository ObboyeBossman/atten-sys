import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardStats } from "./DashboardStats";

export const metadata: Metadata = { title: "Dashboard" };
export const revalidate = 30; // refresh data every 30 s on ISR

type LiveSession = {
  id: string;
  started_at: string;
  venue: string | null;
  courses: {
    name: string;
    code: string;
    groups: { group_name: string } | null;
  } | null;
};

type AuditEvent = {
  id: number;
  action: string;
  table_name: string | null;
  created_at: string;
  actor_id: string | null;
};

async function getDashboardData() {
  const supabase = await createSupabaseServerClient();

  const [
    semesterRes,
    studentsRes,
    lecturersRes,
    sessionsRes,
    disputesRes,
    liveSessionsRes,
    auditRes,
  ] = await Promise.all([
    // Active semester name
    supabase
      .from("app_semesters")
      .select("id, name, academic_year_id, academic_years(name)")
      .eq("status", "active")
      .maybeSingle(),

    // Active students
    supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .eq("is_active", true),

    // Active lecturers
    supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "lecturer")
      .eq("is_active", true),

    // Sessions started today (UTC midnight → now)
    supabase
      .from("class_sessions")
      .select("id", { count: "exact", head: true })
      .gte("started_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),

    // Pending disputes
    supabase
      .from("attendance_disputes")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    // Live (open) sessions with course + group info
    supabase
      .from("class_sessions")
      .select(`
        id,
        started_at,
        venue,
        courses (
          name,
          code,
          groups ( group_name )
        )
      `)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(10),

    // Recent audit events
    supabase
      .from("audit_log")
      .select("id, action, table_name, created_at, actor_id")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  // Derive active semester label
  let semesterLabel = "None";
  if (semesterRes.data) {
    const s = semesterRes.data as {
      name: string;
      academic_years: { name: string } | null;
    };
    semesterLabel = s.academic_years
      ? `${s.name} — ${s.academic_years.name}`
      : s.name;
  }

  return {
    semesterLabel,
    activeStudents: studentsRes.count ?? 0,
    activeLecturers: lecturersRes.count ?? 0,
    sessionsToday: sessionsRes.count ?? 0,
    pendingDisputes: disputesRes.count ?? 0,
    liveSessions: (liveSessionsRes.data ?? []) as LiveSession[],
    auditEvents: (auditRes.data ?? []) as AuditEvent[],
  };
}

export default async function AdminDashboard() {
  const data = await getDashboardData();

  const stats = [
    {
      label: "Active Semester",
      value: data.semesterLabel === "None" ? "—" : data.semesterLabel,
      accent: "var(--color-primary)",
      sub: data.semesterLabel === "None" ? "No active semester" : "Current semester",
    },
    {
      label: "Active Students",
      value: data.activeStudents.toLocaleString(),
      accent: "var(--color-success)",
      sub: "Enrolled & active",
    },
    {
      label: "Active Lecturers",
      value: data.activeLecturers.toLocaleString(),
      accent: "var(--color-info)",
      sub: "Assigned to courses",
    },
    {
      label: "Sessions Today",
      value: data.sessionsToday.toLocaleString(),
      accent: "var(--color-warning)",
      sub: new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "short" }),
    },
    {
      label: "Pending Disputes",
      value: data.pendingDisputes.toLocaleString(),
      accent: "var(--color-danger)",
      sub: "System-wide",
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">System overview and live monitoring</p>
        </div>
      </div>

      <DashboardStats stats={stats} />

      {/* Live sessions + recent audit */}
      <div className="dashboard-lower-grid">
        {/* Live Sessions */}
        <div className="card">
          <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: data.liveSessions.length > 0 ? "var(--color-success)" : "var(--color-text-3)",
                boxShadow: data.liveSessions.length > 0 ? "0 0 0 3px rgba(34,197,94,.2)" : "none",
                animation: data.liveSessions.length > 0 ? "pulse 2s infinite" : "none",
              }}
            />
            Live Sessions
            {data.liveSessions.length > 0 && (
              <span style={{
                marginLeft: "auto",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                background: "rgba(34,197,94,.12)",
                color: "var(--color-success)",
                borderRadius: "var(--radius-full)",
                padding: "2px 8px",
              }}>
                {data.liveSessions.length} active
              </span>
            )}
          </h2>

          {data.liveSessions.length === 0 ? (
            <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
              No live sessions right now.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {data.liveSessions.map((session) => {
                const course = session.courses as { name: string; code: string; groups: { group_name: string } | null } | null;
                const startedAt = new Date(session.started_at);
                // eslint-disable-next-line react-hooks/purity
                const minutesAgo = Math.floor((Date.now() - startedAt.getTime()) / 60000);
                const timeLabel = minutesAgo < 60
                  ? `${minutesAgo}m ago`
                  : `${Math.floor(minutesAgo / 60)}h ${minutesAgo % 60}m ago`;

                return (
                  <div
                    key={session.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3) var(--space-4)",
                      background: "var(--color-surface-2)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--color-success)",
                      flexShrink: 0,
                      boxShadow: "0 0 0 3px rgba(34,197,94,.2)",
                      animation: "pulse 2s infinite",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {course?.name ?? "Unknown course"}
                        {course?.code && (
                          <span style={{ marginLeft: 6, fontSize: "var(--text-xs)", color: "var(--color-text-3)", fontWeight: 400 }}>
                            {course.code}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 2 }}>
                        {course?.groups?.group_name ?? "—"}
                        {session.venue && ` · ${session.venue}`}
                      </div>
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", flexShrink: 0 }}>
                      {timeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Audit Events */}
        <div className="card">
          <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
            Recent Audit Events
          </h2>

          {data.auditEvents.length === 0 ? (
            <p style={{ color: "var(--color-text-3)", fontSize: "var(--text-sm)" }}>
              No audit events yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {data.auditEvents.map((event) => {
                const ts = new Date(event.created_at);
                const timeStr = ts.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
                const dateStr = ts.toLocaleDateString("en-GH", { day: "numeric", month: "short" });
                const isToday = ts.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "var(--space-2)",
                      padding: "var(--space-2) 0",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {event.action}
                      </div>
                      {event.table_name && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", marginTop: 1 }}>
                          {event.table_name}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", flexShrink: 0, textAlign: "right" }}>
                      {isToday ? timeStr : dateStr}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
