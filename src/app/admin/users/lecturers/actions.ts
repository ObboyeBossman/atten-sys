"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: true } | { error: string };
export type CreateResult = { success: true; id: string } | { error: string };

/* ── Auth guard ─────────────────────────────────────────────────────────── */
async function getAdminContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

/* ── Create lecturer ────────────────────────────────────────────────────── */
export async function createLecturer(formData: {
  name: string;
  staff_id: string;
  email: string;
  phone: string;
  password: string;
}): Promise<CreateResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  const { name, staff_id, email, phone, password } = formData;

  if (!name.trim()) return { error: "Name is required." };
  if (!staff_id.trim()) return { error: "Staff ID is required." };
  if (!email.trim()) return { error: "Email is required." };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters." };

  const adminClient = await createSupabaseAdminClient();

  // Step 1: create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { role: "lecturer" },
  });

  if (authError || !authData.user) {
    console.error("Create lecturer auth error:", authError);
    if (authError?.message?.toLowerCase().includes("already")) {
      return { error: "A user with this email already exists." };
    }
    return { error: "Failed to create auth account. Please try again." };
  }

  const newUserId = authData.user.id;

  // Step 2: insert into lecturers table (trigger creates user_profiles row)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: lecturerError } = await (ctx.supabase as any)
    .from("lecturers")
    .insert({
      id: newUserId,
      name: name.trim(),
      staff_id: staff_id.trim(),
      phone: phone.trim() || null,
    });

  if (lecturerError) {
    console.error("Create lecturer insert error:", lecturerError);
    // Cleanup: delete the auth user so we don't leave orphaned accounts
    await adminClient.auth.admin.deleteUser(newUserId);
    if (lecturerError.code === "23505") {
      return { error: "A lecturer with this Staff ID already exists." };
    }
    return { error: "Failed to create lecturer record. Auth account rolled back." };
  }

  revalidatePath("/admin/users/lecturers");
  return { success: true, id: newUserId };
}

/* ── Edit lecturer ──────────────────────────────────────────────────────── */
export async function editLecturer(
  lecturerId: string,
  formData: { name: string; staff_id: string; phone: string }
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  const { name, staff_id, phone } = formData;
  if (!name.trim()) return { error: "Name is required." };
  if (!staff_id.trim()) return { error: "Staff ID is required." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (ctx.supabase as any)
    .from("lecturers")
    .update({
      name: name.trim(),
      staff_id: staff_id.trim(),
      phone: phone.trim() || null,
    })
    .eq("id", lecturerId);

  if (dbError) {
    console.error("Edit lecturer error:", dbError);
    if (dbError.code === "23505") {
      return { error: "A lecturer with this Staff ID already exists." };
    }
    return { error: "Failed to update lecturer. Please try again." };
  }

  revalidatePath("/admin/users/lecturers");
  return { success: true };
}

/* ── Deactivate lecturer ────────────────────────────────────────────────── */
export async function deactivateLecturer(lecturerId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (ctx.supabase as any)
    .from("user_profiles")
    .update({ is_active: false })
    .eq("id", lecturerId);

  if (dbError) {
    console.error("Deactivate lecturer error:", dbError);
    return { error: "Failed to deactivate lecturer. Please try again." };
  }

  revalidatePath("/admin/users/lecturers");
  return { success: true };
}

/* ── Reactivate lecturer ────────────────────────────────────────────────── */
export async function reactivateLecturer(lecturerId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (ctx.supabase as any)
    .from("user_profiles")
    .update({ is_active: true, must_change_password: true })
    .eq("id", lecturerId);

  if (dbError) {
    console.error("Reactivate lecturer error:", dbError);
    return { error: "Failed to reactivate lecturer. Please try again." };
  }

  revalidatePath("/admin/users/lecturers");
  return { success: true };
}

/* ── Reset password ─────────────────────────────────────────────────────── */
export async function resetLecturerPassword(
  lecturerId: string,
  newPassword: string
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const adminClient = await createSupabaseAdminClient();
  const { error: resetError } = await adminClient.auth.admin.updateUserById(lecturerId, {
    password: newPassword,
  });

  if (resetError) {
    console.error("Reset lecturer password error:", resetError);
    return { error: "Failed to reset password. Please try again." };
  }

  // Force password change on next login
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: flagError } = await (ctx.supabase as any)
    .from("user_profiles")
    .update({ must_change_password: true })
    .eq("id", lecturerId);

  if (flagError) {
    console.error("Flag must_change_password error:", flagError);
  }

  revalidatePath("/admin/users/lecturers");
  return { success: true };
}
