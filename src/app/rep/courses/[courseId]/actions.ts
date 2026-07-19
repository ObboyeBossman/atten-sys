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

export async function addTimetableEntry(input: {
  courseId: string;
  groupId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  venue: string | null;
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const groupId = await getRepGroupId(supabase);
  if (!groupId) return { error: "Could not resolve your group." };
  if (groupId !== input.groupId) return { error: "Group mismatch." };

  if (input.startTime >= input.endTime) {
    return { error: "End time must be after start time." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("timetables")
    .insert({
      course_id: input.courseId,
      group_id: groupId,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
      venue: input.venue,
    });

  if (error) return { error: error.message };

  revalidatePath(`/rep/courses/${input.courseId}`);
  return { success: true };
}

export async function openSession(input: {
  courseId: string;
  semesterId: string;
  timetableId: string | null;
  durationMinutes: number;
  venue: string | null;
  notes: string | null;
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const groupId = await getRepGroupId(supabase);
  if (!groupId) return { error: "Could not resolve your group." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify course belongs to rep's group
  const courseCheck = await supabase
    .from("courses")
    .select("id")
    .eq("id", input.courseId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (!courseCheck.data) return { error: "Course not found in your group." };

  // Check no existing live session
  const liveCheck = await supabase
    .from("class_sessions")
    .select("id")
    .eq("course_id", input.courseId)
    .is("ended_at", null)
    .maybeSingle();
  if (liveCheck.data) {
    return { error: `A session is already live for this course.` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("class_sessions")
    .insert({
      course_id: input.courseId,
      semester_id: input.semesterId,
      timetable_id: input.timetableId,
      duration_minutes: input.durationMinutes,
      venue: input.venue,
      notes: input.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/rep/courses/${input.courseId}`);
  revalidatePath("/rep/dashboard");
  return { id: (data as { id: string }).id };
}
