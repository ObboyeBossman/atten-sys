"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: true } | { error: string };

/* ── Auth guard ─────────────────────────────────────────────────────────── */
type GuardResult =
  | { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; error: null }
  | { supabase: null; error: string };

async function requireSuperAdmin(): Promise<GuardResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase: null, error: "Unauthorized." };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const p = profile as { role: string; is_active: boolean } | null;
  if (!p || p.role !== "super_admin" || !p.is_active) {
    return { supabase: null, error: "Unauthorized." };
  }

  return { supabase, error: null };
}

/* ── Deactivate student ─────────────────────────────────────────────────── */
export async function deactivateStudent(studentId: string): Promise<ActionResult> {
  const guard = await requireSuperAdmin();
  if (guard.error) return { error: guard.error };

  const { error: dbError } = await guard.supabase
    .from("user_profiles")
    .update({ is_active: false })
    .eq("id", studentId);

  if (dbError) {
    console.error("Deactivate student error:", dbError);
    return { error: "Failed to deactivate student. Please try again." };
  }

  revalidatePath("/admin/users/students");
  return { success: true };
}

/* ── Reactivate student ─────────────────────────────────────────────────── */
export async function reactivateStudent(studentId: string): Promise<ActionResult> {
  const guard = await requireSuperAdmin();
  if (guard.error) return { error: guard.error };

  const { error: dbError } = await guard.supabase
    .from("user_profiles")
    .update({ is_active: true, must_change_password: true })
    .eq("id", studentId);

  if (dbError) {
    console.error("Reactivate student error:", dbError);
    return { error: "Failed to reactivate student. Please try again." };
  }

  revalidatePath("/admin/users/students");
  return { success: true };
}

/* ── Reset password ─────────────────────────────────────────────────────── */
export async function resetStudentPassword(
  studentId: string,
  newPassword: string
): Promise<ActionResult> {
  const guard = await requireSuperAdmin();
  if (guard.error) return { error: guard.error };

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Uses service role key — server action only, never exposed to client
  const adminClient = await createSupabaseAdminClient();
  const { error: resetError } = await adminClient.auth.admin.updateUserById(studentId, {
    password: newPassword,
  });

  if (resetError) {
    console.error("Reset password error:", resetError);
    return { error: "Failed to reset password. Please try again." };
  }

  // Force password change on next login — reuse the already-authenticated client
  const { error: flagError } = await guard.supabase
    .from("user_profiles")
    .update({ must_change_password: true })
    .eq("id", studentId);

  if (flagError) {
    console.error("Flag must_change_password error:", flagError);
    // Password was reset successfully; flag failure is non-fatal but worth logging
  }

  revalidatePath("/admin/users/students");
  return { success: true };
}
