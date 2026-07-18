import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function StudentDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // 1. Fetch student info
  const { data: student } = await supabase
    .from("students")
    .select("name, index_number, photo_path")
    .eq("id", user.id)
    .single() as unknown as {
      data: { name: string; index_number: string; photo_path: string | null } | null;
    };

  // 2. Fetch active memberships
  const { data: memberships } = await supabase
    .from("group_memberships")
    .select("group_id, groups(group_name)")
    .eq("student_id", user.id)
    .eq("status", "active") as unknown as {
      data: { group_id: string; groups: { group_name: string } | null }[] | null;
    };

  const groupIds = memberships?.map((m) => m.group_id) || [];

  // 3. Fetch active semester
  const { data: activeSemester } = await supabase
    .from("app_semesters")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle() as unknown as {
      data: { id: string; name: string } | null;
    };

  // 4. Fetch courses for these groups in active semester
  let courseIds: string[] = [];
  if (groupIds.length > 0 && activeSemester) {
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .in("group_id", groupIds)
      .eq("semester_id", activeSemester.id) as unknown as {
        data: { id: string }[] | null;
      };

    courseIds = courses?.map((c) => c.id) || [];
  }

  // 5. Fetch active sessions for these courses
  let activeSessions: any[] = [];
  if (courseIds.length > 0) {
    const { data: sessions } = await supabase
      .from("class_sessions")
      .select(`
        id, started_at, venue,
        courses ( id, name, code, groups ( group_name ) )
      `)
      .in("course_id", courseIds)
      .is("ended_at", null);
      
    activeSessions = sessions || [];
  }

  // 6. Check if student already checked in for these active sessions
  const sessionIds = activeSessions.map((s) => s.id);
  let checkedInSessionIds = new Set<string>();
  if (sessionIds.length > 0) {
    const { data: attendance } = await supabase
      .from("attendance")
      .select("session_id")
      .in("session_id", sessionIds)
      .eq("student_id", user.id) as unknown as {
        data: { session_id: string }[] | null;
      };

    attendance?.forEach((a) => checkedInSessionIds.add(a.session_id));
  }

  // 7. Attendance stats for active semester
  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalClasses = 0;

  if (activeSemester && courseIds.length > 0) {
    // get all attendance records for this student for sessions in this semester
    // wait, we can just query attendance for this student and filter by session's semester_id
    // Supabase inner joins:
    const { data: attendanceStats } = await supabase
      .from("attendance")
      .select(`status, class_sessions!inner(semester_id)`)
      .eq("student_id", user.id)
      .eq("class_sessions.semester_id", activeSemester.id) as unknown as {
        data: { status: string; class_sessions: { semester_id: string } }[] | null;
      };

    if (attendanceStats) {
      totalClasses = attendanceStats.length;
      attendanceStats.forEach((a) => {
        if (a.status === "present") totalPresent++;
        else if (a.status === "late") totalLate++;
        else if (a.status === "absent") totalAbsent++;
      });
    }
  }

  const attendanceRate = totalClasses > 0 
    ? Math.round(((totalPresent + totalLate) / totalClasses) * 100) 
    : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {student?.name?.split(" ")[0] || "Student"}</h1>
          <p className="page-subtitle">
            {activeSemester?.name ? `${activeSemester.name} Semester` : "No active semester"}
          </p>
        </div>
      </div>

      {/* Active Sessions Banner */}
      {activeSessions.length > 0 ? (
        <div className="grid gap-4">
          <h2 className="text-lg font-bold">Active Classes Now</h2>
          {activeSessions.map((session) => {
            const isCheckedIn = checkedInSessionIds.has(session.id);
            const courseName = Array.isArray(session.courses) ? session.courses[0]?.name : session.courses?.name;
            const courseCode = Array.isArray(session.courses) ? session.courses[0]?.code : session.courses?.code;
            
            return (
              <div key={session.id} className="card border-l-4" style={{ borderLeftColor: isCheckedIn ? "var(--color-success)" : "var(--color-primary)" }}>
                <div className="flex justify-between items-center gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge badge-primary">{courseCode}</span>
                      {isCheckedIn && <span className="badge badge-success">Checked In</span>}
                      {!isCheckedIn && <span className="badge badge-warning">Check-in Open</span>}
                    </div>
                    <h3 className="font-bold text-lg">{courseName}</h3>
                    <p className="text-sm text-[var(--color-text-3)] mt-1">
                      Started at {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                      {session.venue && ` • ${session.venue}`}
                    </p>
                  </div>
                  
                  {!isCheckedIn ? (
                    <Link href={`/student/checkin/${session.id}`} className="btn btn-primary">
                      Check In Now
                    </Link>
                  ) : (
                    <Link href={`/student/attendance/${session.id}`} className="btn btn-secondary">
                      View Details
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-[var(--color-text-3)] mb-4">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M12 12v.01M8 12v.01M16 12v.01" />
          </svg>
          <h3 className="text-lg font-bold">No Active Classes</h3>
          <p className="text-[var(--color-text-3)] max-w-sm mx-auto mt-2">
            You don't have any classes running right now. Check back when your next class is scheduled to begin.
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div>
        <h2 className="text-lg font-bold mb-4">Your Attendance Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card" style={{ "--accent": "var(--color-secondary)" } as React.CSSProperties}>
            <div className="stat-card-label">Overall Rate</div>
            <div className="stat-card-value">{attendanceRate}%</div>
            <div className="stat-card-sub">{totalClasses} classes total</div>
          </div>
          <div className="stat-card" style={{ "--accent": "var(--color-success)" } as React.CSSProperties}>
            <div className="stat-card-label">Present</div>
            <div className="stat-card-value text-[var(--color-success)]">{totalPresent}</div>
            <div className="stat-card-sub">classes on time</div>
          </div>
          <div className="stat-card" style={{ "--accent": "var(--color-warning)" } as React.CSSProperties}>
            <div className="stat-card-label">Late</div>
            <div className="stat-card-value text-[var(--color-warning)]">{totalLate}</div>
            <div className="stat-card-sub">classes</div>
          </div>
          <div className="stat-card" style={{ "--accent": "var(--color-danger)" } as React.CSSProperties}>
            <div className="stat-card-label">Absent</div>
            <div className="stat-card-value text-[var(--color-danger)]">{totalAbsent}</div>
            <div className="stat-card-sub">classes missed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
