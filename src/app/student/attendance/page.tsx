import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Attendance History" };

export default async function AttendanceHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // Fetch all attendance records with related session/course info
  const { data: records } = await supabase
    .from("attendance")
    .select(`
      id, status, created_at, geo_verified,
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
    // Handle inner join array wrapping if any
    const sessionObj = Array.isArray(session) ? session[0] : session;
    if (!sessionObj) return acc;
    
    const semester = Array.isArray(sessionObj.app_semesters) ? sessionObj.app_semesters[0] : sessionObj.app_semesters;
    const course = Array.isArray(sessionObj.courses) ? sessionObj.courses[0] : sessionObj.courses;
    
    const semName = semester?.name || "Unknown Semester";
    
    if (!acc[semName]) acc[semName] = [];
    
    acc[semName].push({
      ...record,
      courseCode: course?.code,
      courseName: course?.name,
      sessionDate: sessionObj.started_at,
    });
    
    return acc;
  }, {} as Record<string, any[]>);

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
                      {(items as any[]).map((item: any) => (
                        <tr key={item.id} className="hover:bg-[var(--color-surface-2)] transition-colors">
                          <td className="p-3 whitespace-nowrap">
                            {new Date(item.sessionDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="p-3">
                            <div className="font-bold">{item.courseCode}</div>
                            <div className="text-sm text-[var(--color-text-3)] truncate max-w-[200px]">{item.courseName}</div>
                          </td>
                          <td className="p-3">
                            {item.status === 'present' && <span className="badge badge-success">Present</span>}
                            {item.status === 'late' && <span className="badge badge-warning">Late</span>}
                            {item.status === 'absent' && <span className="badge badge-danger">Absent</span>}
                          </td>
                          <td className="p-3 text-sm text-[var(--color-text-2)] whitespace-nowrap">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {item.geo_verified && <span className="ml-2 text-[var(--color-success)]" title="GPS Verified">✓</span>}
                          </td>
                        </tr>
                      ))}
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
