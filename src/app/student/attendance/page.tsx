import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Attendance History" };

export default async function AttendanceHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // Fetch all attendance records — include session_id (FK) for routing + left-join disputes
  const { data: records } = await supabase
    .from("attendance")
    .select(`
      id, session_id, status, created_at, geo_verified,
      attendance_disputes ( id, status ),
      class_sessions (
        started_at, ended_at, venue,
        app_semesters ( name, id ),
        courses ( code, name )
      )
    `)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  // Group by semester
  const groupedBySemester = ((records as any[]) || []).reduce((acc, record) => {
    const session = record.class_sessions;
    const sessionObj = Array.isArray(session) ? session[0] : session;
    if (!sessionObj) return acc;

    const semester = Array.isArray(sessionObj.app_semesters) ? sessionObj.app_semesters[0] : sessionObj.app_semesters;
    const course = Array.isArray(sessionObj.courses) ? sessionObj.courses[0] : sessionObj.courses;

    const semName = semester?.name || "Unknown Semester";

    if (!acc[semName]) acc[semName] = [];

    const disputeRaw = record.attendance_disputes;
    const dispute = Array.isArray(disputeRaw) ? disputeRaw[0] : disputeRaw;

    acc[semName].push({
      ...record,
      courseCode: course?.code,
      courseName: course?.name,
      sessionDate: sessionObj.started_at,
      dispute: dispute ?? null,
    });

    return acc;
  }, {} as Record<string, any[]>);

  const disputeBadgeStyle = (status: string) => {
    const map: Record<string, { color: string; bg: string; label: string }> = {
      pending: { color: "var(--color-warning)", bg: "var(--color-warning-bg)", label: "Dispute: Under review" },
      approved: { color: "var(--color-success)", bg: "var(--color-success-bg)", label: "Dispute: Approved" },
      rejected: { color: "var(--color-danger)", bg: "var(--color-danger-bg)", label: "Dispute: Rejected" },
    };
    return map[status] ?? map.pending;
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance History</h1>
          <p className="page-subtitle">A complete log of your class check-ins.</p>
        </div>
      </div>

      {Object.keys(groupedBySemester).length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--color-text-3)]">You have no attendance records yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(groupedBySemester).map(([semester, items]) => (
            <div key={semester}>
              <h2 className="text-xl font-bold mb-4 border-b border-[var(--color-border)] pb-2">{semester}</h2>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[var(--color-surface-2)]">
                      <tr>
                        <th className="p-3 font-medium text-sm text-[var(--color-text-2)] uppercase tracking-wider">Date</th>
                        <th className="p-3 font-medium text-sm text-[var(--color-text-2)] uppercase tracking-wider">Course</th>
                        <th className="p-3 font-medium text-sm text-[var(--color-text-2)] uppercase tracking-wider">Status</th>
                        <th className="p-3 font-medium text-sm text-[var(--color-text-2)] uppercase tracking-wider">Check-in Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {(items as any[]).map((item: any) => {
                        const dispute = item.dispute;
                        const cfg = dispute ? disputeBadgeStyle(dispute.status) : null;
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                            style={{ minHeight: 44 }}
                          >
                            {/* Entire row is a link — using a nested Link on the first cell and aria for the row */}
                            <td className="p-3 whitespace-nowrap" style={{ minWidth: 100 }}>
                              <Link
                                href={`/student/attendance/${item.session_id}`}
                                className="block"
                                style={{ minHeight: 44, display: "flex", alignItems: "center" }}
                                aria-label={`View detail for ${item.courseCode} on ${new Date(item.sessionDate).toLocaleDateString()}`}
                              >
                                {new Date(item.sessionDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                              </Link>
                            </td>
                            <td className="p-3">
                              <Link href={`/student/attendance/${item.session_id}`} className="block" tabIndex={-1} aria-hidden="true">
                                <div className="font-bold">{item.courseCode}</div>
                                <div className="text-sm text-[var(--color-text-3)] truncate max-w-[200px]">{item.courseName}</div>
                              </Link>
                            </td>
                            <td className="p-3">
                              <Link href={`/student/attendance/${item.session_id}`} className="block" tabIndex={-1} aria-hidden="true">
                                <div className="flex flex-wrap items-center gap-2">
                                  {item.status === 'present' && <span className="badge badge-success">Present</span>}
                                  {item.status === 'late' && <span className="badge badge-warning">Late</span>}
                                  {item.status === 'absent' && <span className="badge badge-danger">Absent</span>}
                                  {/* Dispute badge — color + text, never color alone */}
                                  {cfg && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        padding: "2px 8px",
                                        borderRadius: "var(--radius-full)",
                                        fontSize: "var(--text-xs)",
                                        fontWeight: 600,
                                        color: cfg.color,
                                        background: cfg.bg,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {/* Icon: flag shape */}
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M4 2v18M4 2h12l-3 5 3 5H4" />
                                      </svg>
                                      {cfg.label}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            </td>
                            <td className="p-3 text-sm text-[var(--color-text-2)] whitespace-nowrap">
                              <Link href={`/student/attendance/${item.session_id}`} className="block" tabIndex={-1} aria-hidden="true">
                                <span className="flex items-center gap-2" style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
                                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {item.geo_verified && (
                                    <span className="text-[var(--color-success)]" title="GPS Verified" aria-label="GPS Verified">
                                      ✓
                                    </span>
                                  )}
                                  {/* Chevron — communicates row clickability */}
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-text-3)", marginLeft: "auto" }}>
                                    <path d="M5 2l4 5-4 5" />
                                  </svg>
                                </span>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
