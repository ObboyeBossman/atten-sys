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
