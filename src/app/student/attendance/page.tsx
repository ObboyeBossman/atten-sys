import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Attendance History" };

export default async function AttendanceHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

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
      pending: { color: "var(--color-warning)", bg: "var(--color-warning-bg)", label: "Under review" },
      approved: { color: "var(--color-success)", bg: "var(--color-success-bg)", label: "Approved" },
      rejected: { color: "var(--color-danger)", bg: "var(--color-danger-bg)", label: "Rejected" },
    };
    return map[status] ?? map.pending;
  };

  return (
    <div className={styles.page}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance History</h1>
          <p className="page-subtitle">A complete log of your class check-ins.</p>
        </div>
      </div>

      {Object.keys(groupedBySemester).length === 0 ? (
        <div className="card text-center py-12">
          <p style={{ color: "var(--color-text-3)", textAlign: "center", padding: "3rem 1rem" }}>
            You have no attendance records yet.
          </p>
        </div>
      ) : (
        <div className={styles.semesterList}>
          {Object.entries(groupedBySemester).map(([semester, items]) => (
            <div key={semester}>
              <h2 className={styles.semesterHeading}>{semester}</h2>

              {/* ── Desktop / tablet: table ─────────────────────── */}
              <div className={`card ${styles.tableWrap}`}>
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Date</th>
                        <th className={styles.th}>Course</th>
                        <th className={styles.th}>Status</th>
                        <th className={styles.th}>Check-in Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(items as any[]).map((item: any) => {
                        const dispute = item.dispute;
                        const cfg = dispute ? disputeBadgeStyle(dispute.status) : null;
                        return (
                          <tr key={item.id} className={styles.tr}>
                            <td className={styles.td} style={{ whiteSpace: "nowrap" }}>
                              <Link
                                href={`/student/attendance/${item.session_id}`}
                                className={styles.rowLink}
                                aria-label={`View detail for ${item.courseCode} on ${new Date(item.sessionDate).toLocaleDateString()}`}
                              >
                                {new Date(item.sessionDate).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                              </Link>
                            </td>
                            <td className={styles.td}>
                              <Link href={`/student/attendance/${item.session_id}`} className={styles.rowLink} tabIndex={-1} aria-hidden="true">
                                <span className={styles.courseCode}>{item.courseCode}</span>
                                <span className={styles.courseName}>{item.courseName}</span>
                              </Link>
                            </td>
                            <td className={styles.td}>
                              <Link href={`/student/attendance/${item.session_id}`} className={styles.rowLink} tabIndex={-1} aria-hidden="true">
                                <span className={styles.badgeRow}>
                                  {item.status === "present" && <span className="badge badge-success">Present</span>}
                                  {item.status === "late" && <span className="badge badge-warning">Late</span>}
                                  {item.status === "absent" && <span className="badge badge-danger">Absent</span>}
                                  {cfg && (
                                    <span className={styles.disputeBadge} style={{ color: cfg.color, background: cfg.bg }}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M4 2v18M4 2h12l-3 5 3 5H4" />
                                      </svg>
                                      {cfg.label}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            </td>
                            <td className={styles.td} style={{ whiteSpace: "nowrap" }}>
                              <Link href={`/student/attendance/${item.session_id}`} className={`${styles.rowLink} ${styles.timeCell}`} tabIndex={-1} aria-hidden="true">
                                {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                {item.geo_verified && (
                                  <span className={styles.gpsIcon} title="GPS Verified" aria-label="GPS Verified">✓</span>
                                )}
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.chevron}>
                                  <path d="M5 2l4 5-4 5" />
                                </svg>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Mobile: stacked card list ───────────────────── */}
              <div className={styles.cardList}>
                {(items as any[]).map((item: any) => {
                  const dispute = item.dispute;
                  const cfg = dispute ? disputeBadgeStyle(dispute.status) : null;
                  return (
                    <Link
                      key={item.id}
                      href={`/student/attendance/${item.session_id}`}
                      className={styles.mobileCard}
                      aria-label={`View detail for ${item.courseCode} on ${new Date(item.sessionDate).toLocaleDateString()}`}
                    >
                      {/* Left: date chip */}
                      <div className={styles.dateChip} aria-hidden="true">
                        <span className={styles.dateMonth}>
                          {new Date(item.sessionDate).toLocaleDateString([], { month: "short" })}
                        </span>
                        <span className={styles.dateDay}>
                          {new Date(item.sessionDate).getDate()}
                        </span>
                      </div>

                      {/* Centre: course info + badges */}
                      <div className={styles.cardBody}>
                        <div className={styles.cardCourse}>
                          <span className={styles.cardCode}>{item.courseCode}</span>
                          <span className={styles.cardName}>{item.courseName}</span>
                        </div>
                        <div className={styles.cardMeta}>
                          {item.status === "present" && <span className="badge badge-success">Present</span>}
                          {item.status === "late" && <span className="badge badge-warning">Late</span>}
                          {item.status === "absent" && <span className="badge badge-danger">Absent</span>}
                          {cfg && (
                            <span className={styles.disputeBadge} style={{ color: cfg.color, background: cfg.bg }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4 2v18M4 2h12l-3 5 3 5H4" />
                              </svg>
                              {cfg.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: time + chevron */}
                      <div className={styles.cardRight}>
                        <span className={styles.cardTime}>
                          {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {item.geo_verified && (
                          <span className={styles.gpsIcon} title="GPS Verified" aria-label="GPS Verified">✓</span>
                        )}
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.chevron}>
                          <path d="M5 2l4 5-4 5" />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
