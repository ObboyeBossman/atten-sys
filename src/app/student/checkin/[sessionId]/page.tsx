import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckinFlow } from "@/components/checkin/CheckinFlow";

export const metadata: Metadata = { title: "Check In" };

export default async function CheckinPage(props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  const sessionId = params.sessionId;
  
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // 1. Validate session
  const { data: sessionData } = await supabase
    .from("class_sessions")
    .select(`
      id, started_at, ended_at, course_id,
      courses ( name, code, group_id )
    `)
    .eq("id", sessionId)
    .single();

  const session = sessionData as any;

  if (!session) {
    return <ErrorState message="Session not found." />;
  }
  if (session.ended_at) {
    return <ErrorState message="This session has already ended." />;
  }

  // 2. Check if already checked in
  const { data: existingAttendance } = await supabase
    .from("attendance")
    .select("id")
    .eq("session_id", sessionId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existingAttendance) {
    return redirect(`/student/attendance/${sessionId}`);
  }

  // 3. Verify group membership
  const course = Array.isArray(session.courses) ? session.courses[0] : session.courses;
  const groupId = course?.group_id;
  
  if (!groupId) {
    return <ErrorState message="Invalid course configuration." />;
  }

  const { data: membership } = await supabase
    .from("group_memberships")
    .select("id")
    .eq("student_id", user.id)
    .eq("group_id", groupId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return <ErrorState message="You are not an active member of the group for this course." />;
  }

  // 4. Fetch system settings required for checkin (gps accuracy, late threshold)
  // Cast needed: system_settings has Insert:never which poisons Supabase's select return type inference.
  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["gps_accuracy_floor_metres", "late_threshold_minutes"]) as unknown as {
      data: { key: string; value: string }[] | null;
    };

  let gpsAccuracyFloor = 100;
  let lateThresholdMinutes = 15;

  settings?.forEach((s) => {
    if (s.key === "gps_accuracy_floor_metres") gpsAccuracyFloor = parseInt(s.value);
    if (s.key === "late_threshold_minutes") lateThresholdMinutes = parseInt(s.value);
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header text-center justify-center">
        <div>
          <h1 className="page-title">Session Check-In</h1>
          <p className="page-subtitle mt-2">{course?.code}: {course?.name}</p>
        </div>
      </div>
      <CheckinFlow 
        sessionId={sessionId} 
        studentId={user.id}
        startedAt={session.started_at}
        gpsAccuracyFloor={gpsAccuracyFloor}
        lateThresholdMinutes={lateThresholdMinutes}
      />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card text-center py-12 max-w-lg mx-auto">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)] mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Check-in Unavailable</h2>
      <p className="text-[var(--color-text-3)]">{message}</p>
    </div>
  );
}
