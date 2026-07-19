"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: true } | { error: string };

/* ── Auth guard ──────────────────────────────────────────────────────────── */

async function getAdminContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const p = profile as { role: string; is_active: boolean } | null;
  if (!p || p.role !== "super_admin" || !p.is_active) return null;

  return { supabase, user };
}

/* ── Assign rep ──────────────────────────────────────────────────────────── */

export async function assignRep(
  groupId: string,
  studentId: string,
  replaceCurrentRepId: string | null,
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;

  if (replaceCurrentRepId) {
    const { error: unsetErr } = await sb
      .from("group_memberships")
      .update({ is_course_rep: false })
      .eq("student_id", replaceCurrentRepId)
      .eq("group_id", groupId)
      .eq("status", "active");
    if (unsetErr) return { error: unsetErr.message };
  }

  const { error: setErr } = await sb
    .from("group_memberships")
    .update({ is_course_rep: true })
    .eq("student_id", studentId)
    .eq("group_id", groupId)
    .eq("status", "active");

  if (setErr) return { error: setErr.message };

  revalidatePath(`/admin/groups/${groupId}`);
  return { success: true };
}

/* ── Unassign rep ────────────────────────────────────────────────────────── */

export async function unassignRep(
  groupId: string,
  studentId: string,
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from("group_memberships")
    .update({ is_course_rep: false })
    .eq("student_id", studentId)
    .eq("group_id", groupId)
    .eq("status", "active");

  if (error) return { error: error.message };
  revalidatePath(`/admin/groups/${groupId}`);
  return { success: true };
}

/* ── Remove student ──────────────────────────────────────────────────────── */

export async function removeStudent(
  groupId: string,
  studentId: string,
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from("group_memberships")
    .update({ status: "removed", exited_at: new Date().toISOString(), is_course_rep: false })
    .eq("student_id", studentId)
    .eq("group_id", groupId)
    .eq("status", "active");

  if (error) return { error: error.message };
  revalidatePath(`/admin/groups/${groupId}`);
  return { success: true };
}

/* ── Reset student password ──────────────────────────────────────────────── */

export async function resetStudentPassword(
  studentId: string,
  newPassword: string,
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const adminClient = await createSupabaseAdminClient();
  const { error: resetError } = await adminClient.auth.admin.updateUserById(studentId, {
    password: newPassword,
  });

  if (resetError) {
    console.error("Reset student password error:", resetError);
    return { error: "Failed to reset password. Please try again." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: flagError } = await (ctx.supabase as any)
    .from("user_profiles")
    .update({ must_change_password: true })
    .eq("id", studentId);

  if (flagError) {
    console.error("Flag must_change_password error:", flagError);
  }

  return { success: true };
}

/* ── Reset group default password ────────────────────────────────────────── */

export async function resetGroupDefaultPassword(
  groupId: string,
  newPassword: string,
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  if (!newPassword || newPassword.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from("groups_secrets")
    .update({ default_password: newPassword })
    .eq("group_id", groupId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/groups/${groupId}`);
  return { success: true };
}

/* ── Archive group ───────────────────────────────────────────────────────── */

export async function archiveGroup(groupId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from("groups")
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq("id", groupId);

  if (error) {
    console.error("Archive group error:", error);
    const msg = error.message?.includes("active members")
      ? "Cannot archive: this group still has active members. Remove or promote all students first."
      : "Failed to archive group. Please try again.";
    return { error: msg };
  }

  revalidatePath("/admin/groups");
  revalidatePath(`/admin/groups/${groupId}`);
  return { success: true };
}

/* ── Assign / remove lecturer on a course ────────────────────────────────── */

export async function assignLecturer(
  courseId: string,
  lecturerId: string | null,
  groupId: string,
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any)
    .from("courses")
    .update({ lecturer_id: lecturerId })
    .eq("id", courseId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/groups/${groupId}`);
  return { success: true };
}

/* ── Create course ───────────────────────────────────────────────────────── */

export async function createCourse(
  groupId: string,
  payload: {
    semester_id: string;
    name: string;
    code: string;
    credit_hours: number;
    lecturer_id: string | null;
  },
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (ctx.supabase as any).from("courses").insert({
    group_id: groupId,
    semester_id: payload.semester_id,
    name: payload.name.trim(),
    code: payload.code.trim().toUpperCase(),
    credit_hours: payload.credit_hours,
    lecturer_id: payload.lecturer_id || null,
  });

  if (error) {
    const msg =
      error.code === "23505"
        ? "A course with this code already exists in this group for that semester."
        : error.message;
    return { error: msg };
  }

  revalidatePath(`/admin/groups/${groupId}`);
  return { success: true };
}
