"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function raiseDispute({
  attendanceId,
  reason,
}: {
  attendanceId: string;
  reason: string;
}): Promise<{ error: string } | { success: true }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Verify the caller owns this attendance record
  const { data: record, error: fetchError } = await supabase
    .from("attendance")
    .select("id, student_id")
    .eq("id", attendanceId)
    .single();

  if (fetchError || !record) return { error: "Attendance record not found." };
  if (record.student_id !== user.id)
    return { error: "You are not authorised to dispute this record." };

  // Check no existing dispute for this record
  const { data: existing } = await supabase
    .from("attendance_disputes")
    .select("id")
    .eq("attendance_id", attendanceId)
    .maybeSingle();

  if (existing) return { error: "A dispute already exists for this record." };

  const { error: insertError } = await supabase
    .from("attendance_disputes")
    .insert({
      attendance_id: attendanceId,
      raised_by: user.id,
      reason: reason.trim(),
    });

  if (insertError) {
    console.error("raiseDispute insert error:", insertError);
    return { error: "Failed to submit dispute. Please try again." };
  }

  return { success: true };
}
