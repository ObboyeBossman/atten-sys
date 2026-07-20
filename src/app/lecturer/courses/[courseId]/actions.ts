"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getLecturerId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await supabase
    .from("lecturers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!result.data) redirect("/login");
  return user.id;
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
  const lecturerId = await getLecturerId(supabase);

  // Verify course belongs to this lecturer
  const courseCheck = await supabase
    .from("courses")
    .select("id")
    .eq("id", input.courseId)
    .eq("lecturer_id", lecturerId)
    .maybeSingle();
  if (!courseCheck.data) return { error: "Course not found or not assigned to you." };

  // Check no existing live session
  const liveCheck = await supabase
    .from("class_sessions")
    .select("id")
    .eq("course_id", input.courseId)
    .is("ended_at", null)
    .maybeSingle();
  if (liveCheck.data) return { error: "A session is already live for this course." };

   
  const { data, error } = await (supabase as any)
    .from("class_sessions")
    .insert({
      course_id: input.courseId,
      semester_id: input.semesterId,
      timetable_id: input.timetableId,
      duration_minutes: input.durationMinutes,
      venue: input.venue,
      notes: input.notes,
      created_by: null, // lecturer-opened: created_by must be NULL
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/lecturer/courses/${input.courseId}`);
  revalidatePath("/lecturer/dashboard");
  return { id: (data as { id: string }).id };
}
