"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getRepGroupId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("student_id", user.id)
    .eq("is_course_rep", true)
    .eq("status", "active")
    .maybeSingle();

  const data = result.data as { group_id: string } | null;
  if (!data) return null;
  return data.group_id;
}

export async function closeSession(
  sessionId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const groupId = await getRepGroupId(supabase);
  if (!groupId) return { error: "Could not resolve your group." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("close_session", {
    p_session_id: sessionId,
    p_auto_ended: false,
  });

  if (error) {
    if (error.message.includes("already closed")) {
      revalidatePath(`/rep/sessions/${sessionId}`);
      return { success: true };
    }
    return { error: error.message };
  }

  revalidatePath(`/rep/sessions/${sessionId}`);
  revalidatePath("/rep/dashboard");
  return { success: true };
}

export async function markAttendance(input: {
  sessionId: string;
  studentId: string;
  status: "present" | "late" | "absent";
  existingAttendanceId: string | null;
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const groupId = await getRepGroupId(supabase);
  if (!groupId) return { error: "Could not resolve your group." };

  if (input.existingAttendanceId) {
    // UPDATE existing row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("attendance")
      .update({ status: input.status })
      .eq("id", input.existingAttendanceId);
    if (error) return { error: error.message };
  } else {
    // INSERT new row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("attendance")
      .insert({
        session_id: input.sessionId,
        student_id: input.studentId,
        status: input.status,
      });
    if (error) return { error: error.message };
  }

  revalidatePath(`/rep/sessions/${input.sessionId}`);
  revalidatePath(`/rep/sessions/${input.sessionId}/attendance`);
  return { success: true };
}
