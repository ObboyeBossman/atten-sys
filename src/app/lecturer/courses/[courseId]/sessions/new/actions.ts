"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type StartSessionResult =
  | { sessionId: string }
  | { error: string };

export async function startSession({
  courseId,
  venue,
}: {
  courseId: string;
  venue: string;
}): Promise<StartSessionResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify lecturer owns this course
  const courseRes = await supabase
    .from("courses")
    .select("id, group_id, semester_id, lecturer_id")
    .eq("id", courseId)
    .maybeSingle();

  const course = courseRes.data as {
    id: string;
    group_id: string;
    semester_id: string;
    lecturer_id: string | null;
  } | null;

  if (!course) return { error: "Course not found." };
  if (course.lecturer_id !== user.id) return { error: "Not your course." };

  // Check no live session already exists for this course
  const liveCheck = await supabase
    .from("class_sessions")
    .select("id")
    .eq("course_id", courseId)
    .is("ended_at", null)
    .limit(1)
    .maybeSingle();

  if (liveCheck.data) {
    return { error: "A session is already live for this course. End it first." };
  }

  // Create the session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionInsert = await (supabase as any)
    .from("class_sessions")
    .insert({
      course_id: courseId,
      semester_id: course.semester_id,
      venue: venue.trim() || null,
      duration_minutes: 0,
      started_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (sessionInsert.error) {
    console.error("startSession insert error:", sessionInsert.error);
    return { error: "Failed to create session. Please try again." };
  }

  const sessionId: string = sessionInsert.data.id;

  // Seed absent attendance records for all active group members
  const membersRes = await supabase
    .from("group_memberships")
    .select("student_id")
    .eq("group_id", course.group_id)
    .eq("status", "active");

  const members = (membersRes.data ?? []) as { student_id: string }[];

  if (members.length > 0) {
    const attendanceRows = members.map((m) => ({
      session_id: sessionId,
      student_id: m.student_id,
      status: "absent" as const,
      geo_verified: false,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("attendance").insert(attendanceRows);
    // Non-fatal: if this fails, check-ins will still create their own row via upsert
  }

  return { sessionId };
}

export async function endSession(sessionId: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Get the session and verify ownership via course
  const sessRes = await supabase
    .from("class_sessions")
    .select("id, course_id, started_at, ended_at")
    .eq("id", sessionId)
    .maybeSingle();

  const sess = sessRes.data as {
    id: string;
    course_id: string;
    started_at: string;
    ended_at: string | null;
  } | null;

  if (!sess) return { error: "Session not found." };
  if (sess.ended_at) return { error: "Session already ended." };

  // Verify lecturer owns this course
  const courseRes = await supabase
    .from("courses")
    .select("lecturer_id")
    .eq("id", sess.course_id)
    .maybeSingle();

  const course = courseRes.data as { lecturer_id: string | null } | null;
  if (!course || course.lecturer_id !== user.id) return { error: "Not authorised." };

  const durationMs = Date.now() - new Date(sess.started_at).getTime();
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("class_sessions")
    .update({
      ended_at: new Date().toISOString(),
      duration_minutes: durationMinutes,
    })
    .eq("id", sessionId);

  if (error) return { error: "Failed to end session." };

  redirect(`/lecturer/sessions/${sessionId}`);
}
