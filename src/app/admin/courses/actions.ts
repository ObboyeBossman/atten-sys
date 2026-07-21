"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { error: string };

async function getAdminContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await (supabase as any)
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin" || !profile.is_active) return null;
  return { supabase, user };
}

/* ── Delete a course (and all its sessions + attendance) ─────────────────── */
export async function deleteCourse(courseId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  // Step 1 — delete attendance records that belong to sessions of this course.
  // (attendance.session_id → class_sessions.id CASCADE handles this automatically,
  //  but we do it explicitly so any future constraint changes don't surprise us.)
  const { data: sessionRows } = await (ctx.supabase as any)
    .from("class_sessions")
    .select("id")
    .eq("course_id", courseId);

  const sessionIds: string[] = (sessionRows ?? []).map((s: { id: string }) => s.id);

  if (sessionIds.length > 0) {
    const { error: attErr } = await (ctx.supabase as any)
      .from("attendance")
      .delete()
      .in("session_id", sessionIds);
    if (attErr) return { error: `Failed to remove attendance records: ${attErr.message}` };

    // Step 2 — delete the sessions themselves.
    const { error: sessErr } = await (ctx.supabase as any)
      .from("class_sessions")
      .delete()
      .eq("course_id", courseId);
    if (sessErr) return { error: `Failed to remove sessions: ${sessErr.message}` };
  }

  // Step 3 — delete the course.
  const { error: courseErr } = await (ctx.supabase as any)
    .from("courses")
    .delete()
    .eq("id", courseId);

  if (courseErr) return { error: courseErr.message };

  revalidatePath("/admin/courses");
  return { success: true };
}

/* ── Assign / remove lecturer on a course ────────────────────────────────── */
export async function assignLecturerToCourse(
  courseId: string,
  lecturerId: string | null,
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

   
  const { error } = await (ctx.supabase as any)
    .from("courses")
    .update({ lecturer_id: lecturerId })
    .eq("id", courseId);

  if (error) return { error: error.message };

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  return { success: true };
}
