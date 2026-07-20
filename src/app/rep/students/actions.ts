"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/* ── Resolve the rep's group ─────────────────────────────────────────────── */
async function getRepGroupId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

/* ── Remove a student from the rep's group ───────────────────────────────── */
export async function removeStudentFromGroup(
  studentId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const groupId = await getRepGroupId(supabase);
  if (!groupId) return { error: "Could not resolve your group." };

  // Cast to any to bypass Supabase never inference on chained .update().eq() 
   
  const { error } = await (supabase as any)
    .from("group_memberships")
    .update({ status: "removed", exited_at: new Date().toISOString() })
    .eq("student_id", studentId)
    .eq("group_id", groupId)
    .eq("status", "active");

  if (error) return { error: error.message };

  revalidatePath("/rep/students");
  return { success: true };
}
