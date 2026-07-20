"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function verifyLecturerOwnsSession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sessionId: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify lecturer identity
  const lecturerResult = await supabase
    .from("lecturers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!lecturerResult.data) redirect("/login");

  // Verify session belongs to a course owned by this lecturer
  type SessionCheck = {
    id: string;
    courses: { lecturer_id: string | null } | null;
  };
  const sessionCheck = await supabase
    .from("class_sessions")
    .select("id, courses(lecturer_id)")
    .eq("id", sessionId)
    .maybeSingle();

  const session = sessionCheck.data as unknown as SessionCheck | null;
  if (!session || session.courses?.lecturer_id !== user.id) {
    return { userId: user.id, authorized: false as const };
  }

  return { userId: user.id, authorized: true as const };
}

export async function closeSession(
  sessionId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const check = await verifyLecturerOwnsSession(supabase, sessionId);
  if (!check.authorized) return { error: "You are not authorized to close this session." };

   
  const { error } = await (supabase as any).rpc("close_session", {
    p_session_id: sessionId,
    p_auto_ended: false,
  });

  if (error) {
    if (error.message?.includes("already closed")) {
      revalidatePath(`/lecturer/sessions/${sessionId}`);
      return { success: true };
    }
    return { error: error.message };
  }

  revalidatePath(`/lecturer/sessions/${sessionId}`);
  revalidatePath("/lecturer/dashboard");
  return { success: true };
}

export async function markAttendance(input: {
  sessionId: string;
  studentId: string;
  status: "present" | "late" | "absent";
  existingAttendanceId: string | null;
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const check = await verifyLecturerOwnsSession(supabase, input.sessionId);
  if (!check.authorized) return { error: "Not authorized to mark attendance for this session." };

  if (input.existingAttendanceId) {
     
    const { error } = await (supabase as any)
      .from("attendance")
      .update({ status: input.status })
      .eq("id", input.existingAttendanceId);
    if (error) return { error: error.message };
  } else {
     
    const { error } = await (supabase as any)
      .from("attendance")
      .insert({
        session_id: input.sessionId,
        student_id: input.studentId,
        status: input.status,
      });
    if (error) return { error: error.message };
  }

  revalidatePath(`/lecturer/sessions/${input.sessionId}`);
  revalidatePath(`/lecturer/sessions/${input.sessionId}/attendance`);
  return { success: true };
}
