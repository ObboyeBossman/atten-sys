import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Attendance Detail" };

export default async function AttendanceDetailPage(props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data } = await supabase
    .from("attendance")
    .select(`
      id, status, created_at, geo_verified,
      class_sessions (
        started_at, ended_at, venue,
        courses ( code, name )
      )
    `)
    .eq("session_id", params.sessionId)
    .eq("student_id", user.id)
    .single();
    
  const record = data as any;

  if (!record) {
    return (
      <div className="card text-center py-12 max-w-lg mx-auto mt-8">
        <h2 className="text-xl font-bold mb-2">Record Not Found</h2>
        <p className="text-[var(--color-text-3)] mb-6">We couldn't find an attendance record for this session.</p>
        <Link href="/student/dashboard" className="btn btn-primary">Return to Dashboard</Link>
      </div>
    );
  }

  const sessionObj = Array.isArray(record.class_sessions) ? record.class_sessions[0] : record.class_sessions;
  const courseObj = Array.isArray(sessionObj?.courses) ? sessionObj?.courses[0] : sessionObj?.courses;

  return (
    <div className="max-w-xl mx-auto mt-8">
      <div className="card border-t-4" style={{ 
        borderTopColor: record.status === 'present' ? 'var(--color-success)' : 
                        record.status === 'late' ? 'var(--color-warning)' : 'var(--color-danger)'
      }}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 shadow-glow" style={{
            backgroundColor: record.status === 'present' ? 'var(--color-success-bg)' : 
                             record.status === 'late' ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)',
            color: record.status === 'present' ? 'var(--color-success)' : 
                   record.status === 'late' ? 'var(--color-warning)' : 'var(--color-danger)'
          }}>
            {record.status === 'present' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {record.status === 'late' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
            {record.status === 'absent' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold capitalize mb-1">{record.status}</h1>
          <p className="text-[var(--color-text-3)] text-sm">Checked in at {new Date(record.created_at).toLocaleString()}</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between border-b border-[var(--color-border)] pb-3">
            <span className="text-[var(--color-text-2)]">Course</span>
            <span className="font-medium text-right ml-4">{courseObj?.code}: {courseObj?.name}</span>
          </div>
          <div className="flex justify-between border-b border-[var(--color-border)] pb-3">
            <span className="text-[var(--color-text-2)]">Session Date</span>
            <span className="font-medium text-right ml-4">
              {new Date(sessionObj?.started_at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="flex justify-between border-b border-[var(--color-border)] pb-3">
            <span className="text-[var(--color-text-2)]">Location GPS Verified</span>
            <span className="font-medium text-right ml-4 flex items-center justify-end gap-2">
              {record.geo_verified ? (
                <><span className="text-[var(--color-success)]">✓</span> Yes</>
              ) : (
                <><span className="text-[var(--color-danger)]">✗</span> No</>
              )}
            </span>
          </div>
          <div className="flex justify-between pb-3">
            <span className="text-[var(--color-text-2)]">Check-in Reference</span>
            <span className="font-mono text-xs text-[var(--color-text-3)] text-right ml-4">{record.id}</span>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/student/dashboard" className="btn btn-primary w-full justify-center">Return to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
