import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Dashboard" };

/* ─── helpers ────────────────────────────────────────────── */
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GH", { weekday: "short", month: "short", day: "numeric" });
}

function AttendanceRingSVG({ pct }: { pct: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const colour =
    pct >= 80 ? "var(--color-success)" : pct >= 60 ? "var(--color-warning)" : "var(--color-danger)";

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
      {/* track */}
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth="8" />
      {/* progress */}
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={colour}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

/* ─── page ────────────────────────────────────────────────── */
export default async function StudentDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  /* 1. Student profile */
  const { data: student } = await supabase
    .from("students")
    .select("name, index_number, photo_path")
    .eq("id", user.id)
    .single() as unknown as {
      data: { name: string; index_number: string; photo_path: string | null } | null;
    };

  /* 2. Active group memberships */
  const { data: memberships } = await supabase
    .from("group_memberships")
    .select("group_id, groups(group_name)")
    .eq("student_id", user.id)
    .eq("status", "active") as unknown as {
      data: { group_id: string; groups: { group_name: string } | null }[] | null;
    };

  const groupIds = memberships?.map((m) => m.group_id) ?? [];
  const groupName =
    (memberships?.[0]?.groups as { group_name: string } | null)?.group_name ?? null;

  /* 3. Active semester */
  const { data: activeSemester } = await supabase
    .from("app_semesters")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle() as unknown as {
      data: { id: string; name: string } | null;
    };

  /* 4. Courses for active semester */
  let courseIds: string[] = [];
  if (groupIds.length > 0 && activeSemester) {
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .in("group_id", groupIds)
      .eq("semester_id", activeSemester.id) as unknown as {
        data: { id: string }[] | null;
      };
    courseIds = courses?.map((c) => c.id) ?? [];
  }

  /* 5. Active (live) sessions */
  let activeSessions: any[] = [];
  if (courseIds.length > 0) {
    const { data: sessions } = await supabase
      .from("class_sessions")
      .select(`id, started_at, venue, courses(id, name, code, groups(group_name))`)
      .in("course_id", courseIds)
      .is("ended_at", null);
    activeSessions = sessions ?? [];
  }

  /* 6. Already checked-in session IDs */
  const sessionIds = activeSessions.map((s) => s.id);
  const checkedInSessionIds = new Set<string>();
  if (sessionIds.length > 0) {
    const { data: myAtt } = await supabase
      .from("attendance")
      .select("session_id")
      .in("session_id", sessionIds)
      .eq("student_id", user.id) as unknown as {
        data: { session_id: string }[] | null;
      };
    myAtt?.forEach((a) => checkedInSessionIds.add(a.session_id));
  }

  /* 7. Attendance stats for active semester */
  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalClasses = 0;

  if (activeSemester && courseIds.length > 0) {
    const { data: attStats } = await supabase
      .from("attendance")
      .select("status, class_sessions!inner(semester_id)")
      .eq("student_id", user.id)
      .eq("class_sessions.semester_id", activeSemester.id) as unknown as {
        data: { status: string; class_sessions: { semester_id: string } }[] | null;
      };

    if (attStats) {
      totalClasses = attStats.length;
      attStats.forEach((a) => {
        if (a.status === "present") totalPresent++;
        else if (a.status === "late") totalLate++;
        else if (a.status === "absent") totalAbsent++;
      });
    }
  }

  const attendanceRate =
    totalClasses > 0
      ? Math.round(((totalPresent + totalLate) / totalClasses) * 100)
      : 0;

  /* 8. Recent 5 attendance records */
  const { data: recentRaw } = await supabase
    .from("attendance")
    .select(`
      id, status, checked_in_at, created_at,
      class_sessions(
        started_at, ended_at,
        courses(name, code)
      )
    `)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5) as unknown as {
      data: Array<{
        id: string;
        status: string;
        checked_in_at: string | null;
        created_at: string;
        class_sessions: {
          started_at: string;
          ended_at: string | null;
          courses: { name: string; code: string } | null;
        } | null;
      }> | null;
    };

  const recentActivity = (recentRaw ?? []).map((r) => {
    const sess = r.class_sessions;
    const course = sess?.courses;
    return {
      id: r.id,
      status: r.status,
      date: sess?.started_at ?? r.created_at,
      courseName: course?.name ?? "Unknown course",
      courseCode: course?.code ?? "—",
      checkInTime: r.checked_in_at ?? r.created_at,
    };
  });

  /* ── derived display ────────────────────────────────────── */
  const firstName = student?.name?.split(" ")[0] ?? "Student";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const rateColour =
    attendanceRate >= 80
      ? "var(--color-success)"
      : attendanceRate >= 60
      ? "var(--color-warning)"
      : "var(--color-danger)";

  /* ─── render ─────────────────────────────────────────────── */
  return (
    <div>
      {/* ══ Hero / Welcome ══════════════════════════════════════ */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroLeft}>
          <span className={styles.heroGreeting}>{greeting}</span>
          <h1 className={styles.heroName}>{firstName}</h1>
          <div className={styles.heroMeta}>
            {activeSemester ? (
              <span className={styles.heroPill}>
                <span className={styles.heroPillDot} />
                {activeSemester.name}
              </span>
            ) : (
              <span className={`${styles.heroPill} ${styles.heroPillNeutral}`}>
                No active semester
              </span>
            )}
            {groupName && (
              <span className={`${styles.heroPill} ${styles.heroPillNeutral}`}>
                {groupName}
              </span>
            )}
          </div>
        </div>
        {student?.index_number && (
          <div className={styles.heroRight}>
            <div className={styles.heroIndexCard}>
              <div className={styles.heroIndexLabel}>Student ID</div>
              <div className={styles.heroIndexValue}>{student.index_number}</div>
            </div>
          </div>
        )}
      </div>

      {/* ══ Quick Links ═════════════════════════════════════════ */}
      <div className={styles.quickLinks}>
        <Link
          href="/student/attendance"
          className={styles.quickLink}
          style={{ "--ql-color": "var(--color-secondary)" } as React.CSSProperties}
        >
          <span className={styles.quickLinkIcon}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10l5 5L19 4" /><circle cx="10" cy="10" r="9" />
            </svg>
          </span>
          History
        </Link>
        <Link
          href="/student/notifications"
          className={styles.quickLink}
          style={{ "--ql-color": "var(--color-warning)" } as React.CSSProperties}
        >
          <span className={styles.quickLinkIcon}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2a6 6 0 00-6 6v3l-2 4h16l-2-4V8a6 6 0 00-6-6z" />
              <path d="M8 17a2 2 0 004 0" />
            </svg>
          </span>
          Alerts
        </Link>
        <Link
          href="/student/profile"
          className={styles.quickLink}
          style={{ "--ql-color": "var(--color-info)" } as React.CSSProperties}
        >
          <span className={styles.quickLinkIcon}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="6" r="4" />
              <path d="M2 19c0-4.42 3.58-8 8-8s8 3.58 8 8" />
            </svg>
          </span>
          Profile
        </Link>
      </div>

      {/* ══ Live Session Banner ══════════════════════════════════ */}
      <div className={styles.liveWrap}>
        <div className={styles.sectionLabel}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="6" cy="6" r="2.5" fill="currentColor" />
          </svg>
          Live Now
          <span className={styles.sectionLabelLine} />
        </div>

        {activeSessions.length === 0 ? (
          <div className={styles.noSession}>
            <span className={styles.noSessionIcon}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="5" width="16" height="12" rx="2" />
                <path d="M6 5V3M14 5V3M2 9h16" />
              </svg>
            </span>
            <span>No classes in session right now. Check back when your next class starts.</span>
          </div>
        ) : (
          <div className={styles.multiLiveGrid}>
            {activeSessions.map((session) => {
              const isCheckedIn = checkedInSessionIds.has(session.id);
              const course = Array.isArray(session.courses) ? session.courses[0] : session.courses;
              const courseName = course?.name ?? "Unknown course";
              const courseCode = course?.code ?? "—";
              const startTime = formatTime(session.started_at);
              /* eslint-disable react-hooks/purity */
              const elapsed = Math.floor(
                (Date.now() - new Date(session.started_at).getTime()) / 60000
              );
              /* eslint-enable react-hooks/purity */
              const elapsedLabel =
                elapsed < 60 ? `${elapsed}m elapsed` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m elapsed`;

              return (
                <div key={session.id} className={styles.liveBanner}>
                  <div className={styles.liveBannerGlow} />
                  <div className={styles.liveBannerContent}>
                    <div className={styles.livePulse}>
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--color-primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="12" height="10" rx="1.5" />
                        <path d="M14 8l5-3v9l-5-3" />
                      </svg>
                    </div>
                    <div className={styles.liveTextWrap}>
                      <div className={styles.liveLabelRow}>
                        <span className={styles.liveDot}>● LIVE</span>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                          {elapsedLabel}
                        </span>
                      </div>
                      <div className={styles.liveCourseName}>{courseName}</div>
                      <div className={styles.liveCourseMeta}>
                        {courseCode}
                        {session.venue ? ` · ${session.venue}` : ""}
                        {" · "}Started at {startTime}
                      </div>
                    </div>
                  </div>
                  <div className={styles.liveBannerActions}>
                    {isCheckedIn ? (
                      <div className={styles.liveCheckedIn}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8l4 4 6-7" />
                        </svg>
                        Checked In
                      </div>
                    ) : (
                      <Link href={`/student/checkin/${session.id}`} className="btn btn-primary">
                        Check In Now
                      </Link>
                    )}
                    <Link
                      href={`/student/attendance/${session.id}`}
                      style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)", textAlign: "center" }}
                    >
                      View details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ Attendance Stats ═════════════════════════════════════ */}
      <div className={styles.statsSection}>
        <div className={styles.sectionLabel}>
          Semester Summary
          <span className={styles.sectionLabelLine} />
          {activeSemester && (
            <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
              {activeSemester.name}
            </span>
          )}
        </div>

        <div className={styles.statsGrid}>
          {/* Attendance ring */}
          <div className={styles.ringCard}>
            <div className={styles.ringWrap}>
              <AttendanceRingSVG pct={attendanceRate} />
              <div className={styles.ringLabel}>
                <span className={styles.ringPct} style={{ color: rateColour }}>
                  {attendanceRate}%
                </span>
                <span className={styles.ringSubtext}>rate</span>
              </div>
            </div>
            <span className={styles.ringCardTitle}>Attendance Rate</span>
          </div>

          {/* 4 detail cards */}
          <div className={styles.detailCards}>
            {/* Total */}
            <div
              className={styles.detailCard}
              style={{
                "--card-accent": "var(--color-secondary)",
                "--icon-bg": "rgba(59,130,246,0.1)",
              } as React.CSSProperties}
            >
              <div className={styles.detailIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="16" height="15" rx="1.5" />
                  <path d="M2 9h16M7 2v4M13 2v4" />
                </svg>
              </div>
              <div className={styles.detailRight}>
                <div className={styles.detailValue}>{totalClasses}</div>
                <div className={styles.detailLabel}>Total</div>
                <div className={styles.detailSub}>classes held</div>
              </div>
            </div>

            {/* Present */}
            <div
              className={styles.detailCard}
              style={{
                "--card-accent": "var(--color-success)",
                "--icon-bg": "var(--color-success-bg)",
              } as React.CSSProperties}
            >
              <div className={styles.detailIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10l5 5L19 4" />
                  <circle cx="10" cy="10" r="9" />
                </svg>
              </div>
              <div className={styles.detailRight}>
                <div className={styles.detailValue}>{totalPresent}</div>
                <div className={styles.detailLabel}>Present</div>
                <div className={styles.detailSub}>on time</div>
              </div>
            </div>

            {/* Late */}
            <div
              className={styles.detailCard}
              style={{
                "--card-accent": "var(--color-warning)",
                "--icon-bg": "var(--color-warning-bg)",
              } as React.CSSProperties}
            >
              <div className={styles.detailIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10" cy="10" r="8" />
                  <path d="M10 5v5l4 4" />
                </svg>
              </div>
              <div className={styles.detailRight}>
                <div className={styles.detailValue}>{totalLate}</div>
                <div className={styles.detailLabel}>Late</div>
                <div className={styles.detailSub}>arrivals</div>
              </div>
            </div>

            {/* Absent */}
            <div
              className={styles.detailCard}
              style={{
                "--card-accent": "var(--color-danger)",
                "--icon-bg": "var(--color-danger-bg)",
              } as React.CSSProperties}
            >
              <div className={styles.detailIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10" cy="10" r="8" />
                  <path d="M7 7l6 6M13 7l-6 6" />
                </svg>
              </div>
              <div className={styles.detailRight}>
                <div className={styles.detailValue}>{totalAbsent}</div>
                <div className={styles.detailLabel}>Absent</div>
                <div className={styles.detailSub}>missed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Recent Activity ══════════════════════════════════════ */}
      <div className={styles.recentSection}>
        <div className={styles.sectionLabel}>
          Recent Activity
          <span className={styles.sectionLabelLine} />
        </div>

        <div className={styles.recentCard}>
          <div className={styles.recentHeader}>
            <span className={styles.recentHeaderTitle}>Last 5 check-ins</span>
            <Link href="/student/attendance" className={styles.recentHeaderLink}>
              View all
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6h8M7 3l3 3-3 3" />
              </svg>
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <div className={styles.recentEmpty}>
              No attendance records yet. Your check-ins will appear here.
            </div>
          ) : (
            recentActivity.map((item) => {
              const statusColor =
                item.status === "present"
                  ? "var(--color-success)"
                  : item.status === "late"
                  ? "var(--color-warning)"
                  : "var(--color-danger)";
              const statusBg =
                item.status === "present"
                  ? "var(--color-success-bg)"
                  : item.status === "late"
                  ? "var(--color-warning-bg)"
                  : "var(--color-danger-bg)";
              const statusLabel =
                item.status === "present" ? "Present" : item.status === "late" ? "Late" : "Absent";
              const badgeCls =
                item.status === "present"
                  ? "badge badge-success"
                  : item.status === "late"
                  ? "badge badge-warning"
                  : "badge badge-danger";

              return (
                <Link
                  key={item.id}
                  href={`/student/attendance/${item.id}`}
                  className={styles.recentRow}
                >
                  {/* Course code avatar */}
                  <div
                    className={styles.recentIcon}
                    style={{ background: statusBg, color: statusColor }}
                  >
                    {item.courseCode.slice(0, 3)}
                  </div>

                  <div className={styles.recentRowContent}>
                    <div className={styles.recentRowTitle}>{item.courseName}</div>
                    <div className={styles.recentRowMeta}>
                      {item.courseCode} · {formatTime(item.checkInTime)}
                    </div>
                  </div>

                  <div className={styles.recentRowRight}>
                    <span className={badgeCls} aria-label={`Status: ${statusLabel}`}>
                      {statusLabel}
                    </span>
                    <span className={styles.recentDate}>{formatDate(item.date)}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
