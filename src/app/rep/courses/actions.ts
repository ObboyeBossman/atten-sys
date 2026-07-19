"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function addCourse(input: {
  groupId: string;
  semesterId: string;
  name: string;
  code: string;
  creditHours: number;
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify rep owns this group
  const membershipResult = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("student_id", user.id)
    .eq("is_course_rep", true)
    .eq("status", "active")
    .maybeSingle();

  const membership = membershipResult.data as { group_id: string } | null;
  if (!membership || membership.group_id !== input.groupId) {
    return { error: "You are not a rep for this group." };
  }

  // Verify semester is active
  const semResult = await supabase
    .from("app_semesters")
    .select("id")
    .eq("id", input.semesterId)
    .eq("status", "active")
    .maybeSingle();

  if (!semResult.data) {
    return { error: "Semester is not active." };
  }

  // Check for duplicate code in this group + semester
  const dupCheck = await supabase
    .from("courses")
    .select("id")
    .eq("group_id", input.groupId)
    .eq("semester_id", input.semesterId)
    .ilike("code", input.code)
    .maybeSingle();

  if (dupCheck.data) {
    return { error: `A course with code "${input.code}" already exists for this semester.` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("courses").insert({
    group_id: input.groupId,
    semester_id: input.semesterId,
    name: input.name,
    code: input.code,
    credit_hours: input.creditHours,
  });

  if (error) return { error: error.message };

  revalidatePath("/rep/courses");
  return { success: true };
}
