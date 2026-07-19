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

export async function resolveDispute(input: {
  disputeId: string;
  attendanceId: string;
  action: "approved" | "rejected";
  resolutionNote: string;
  newStatus: "present" | "late" | "absent" | null; // only used when approved
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const groupId = await getRepGroupId(supabase);
  if (!groupId) return { error: "Could not resolve your group." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Update the dispute
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: disputeError } = await (supabase as any)
    .from("attendance_disputes")
    .update({
      status: input.action,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: input.resolutionNote,
    })
    .eq("id", input.disputeId);

  if (disputeError) return { error: disputeError.message };

  // If approved, update the attendance status
  if (input.action === "approved" && input.newStatus) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: attError } = await (supabase as any)
      .from("attendance")
      .update({ status: input.newStatus })
      .eq("id", input.attendanceId);

    if (attError) return { error: attError.message };
  }

  revalidatePath("/rep/disputes");
  return { success: true };
}
