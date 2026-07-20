"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type AddOutcome = "created" | "reactivated" | "membership_added" | "already_member";

export type AddStudentResult =
  | { outcome: AddOutcome; indexNumber: string; email?: string }
  | { error: string };

export async function addStudentToGroup(
  groupId: string,
  serial: number,
  name: string | null
): Promise<AddStudentResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify the caller is actually an active rep for this group
  const repCheck = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("student_id", user.id)
    .eq("is_course_rep", true)
    .eq("status", "active")
    .eq("group_id", groupId)
    .maybeSingle();

  if (!repCheck.data) {
    return { error: "You are not an active rep for this group." };
  }

  type RpcRow = { outcome: AddOutcome; index_number: string; email: string };

   
  const { data, error } = await (supabase as any).rpc("add_student_to_group", {
    p_group_id: groupId,
    p_serial: serial,
    p_name: name ?? null,
  });

  if (error) return { error: error.message };

  const row = (data as RpcRow[] | null)?.[0] ?? (data as RpcRow | null);
  if (!row) return { error: "Unexpected response from server." };

  revalidatePath("/rep/students");
  revalidatePath("/rep/dashboard");

  return {
    outcome: row.outcome,
    indexNumber: row.index_number,
    email: row.email,
  };
}
