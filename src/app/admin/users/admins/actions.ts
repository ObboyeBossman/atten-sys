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

/* ── Create super admin ─────────────────────────────────────────────────── */
export async function createSuperAdmin(formData: {
  name: string;
  email: string;
  password: string;
}): Promise<CreateResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  const { name, email, password } = formData;

  if (!name.trim()) return { error: "Name is required." };
  if (!email.trim()) return { error: "Email is required." };
  if (!password || password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const adminClient = await createSupabaseAdminClient();

  // Step 1: create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { role: "super_admin" },
  });

  if (authError || !authData.user) {
    console.error("Create super admin auth error:", authError);
    if (authError?.message?.toLowerCase().includes("already")) {
      return { error: "A user with this email already exists." };
    }
    return { error: "Failed to create auth account. Please try again." };
  }

  const newUserId = authData.user.id;

  // Step 2: insert into super_admins table
  const { error: adminError } = await (ctx.supabase as any)
    .from("super_admins")
    .insert({ id: newUserId, name: name.trim() });

  if (adminError) {
    console.error("Create super admin insert error:", adminError);
    await adminClient.auth.admin.deleteUser(newUserId);
    return { error: "Failed to save admin profile. Please try again." };
  }

  // Step 3: ensure user_profiles row has correct role
  const { error: profileError } = await (ctx.supabase as any)
    .from("user_profiles")
    .upsert({ id: newUserId, role: "super_admin", is_active: true });

  if (profileError) {
    console.error("Create super admin profile error:", profileError);
    // Not fatal — profile may be set by trigger
  }

  revalidatePath("/admin/users/admins");
  return { success: true, id: newUserId };
}

/* ── Edit super admin name ──────────────────────────────────────────────── */
export async function editSuperAdmin(
  adminId: string,
  formData: { name: string }
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  if (!formData.name.trim()) return { error: "Name is required." };

  const { error } = await (ctx.supabase as any)
    .from("super_admins")
    .update({ name: formData.name.trim() })
    .eq("id", adminId);

  if (error) {
    console.error("Edit super admin error:", error);
    return { error: "Failed to update name. Please try again." };
  }

  revalidatePath("/admin/users/admins");
  return { success: true };
}

/* ── Deactivate super admin ─────────────────────────────────────────────── */
export async function deactivateSuperAdmin(adminId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  // Prevent self-deactivation
  if (adminId === ctx.user.id) {
    return { error: "You cannot deactivate your own account." };
  }

  const { error } = await (ctx.supabase as any)
    .from("user_profiles")
    .update({ is_active: false })
    .eq("id", adminId);

  if (error) {
    console.error("Deactivate super admin error:", error);
    return { error: "Failed to deactivate admin. Please try again." };
  }

  revalidatePath("/admin/users/admins");
  return { success: true };
}

/* ── Reactivate super admin ─────────────────────────────────────────────── */
export async function reactivateSuperAdmin(adminId: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  const { error } = await (ctx.supabase as any)
    .from("user_profiles")
    .update({ is_active: true, must_change_password: true })
    .eq("id", adminId);

  if (error) {
    console.error("Reactivate super admin error:", error);
    return { error: "Failed to reactivate admin. Please try again." };
  }

  revalidatePath("/admin/users/admins");
  return { success: true };
}

/* ── Reset password ─────────────────────────────────────────────────────── */
export async function resetSuperAdminPassword(
  adminId: string,
  newPassword: string
): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Unauthorized." };

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const adminClient = await createSupabaseAdminClient();
  const { error: resetError } = await adminClient.auth.admin.updateUserById(adminId, {
    password: newPassword,
  });

  if (resetError) {
    console.error("Reset super admin password error:", resetError);
    return { error: "Failed to reset password. Please try again." };
  }

  // Force password change on next login (unless resetting own password)
  if (adminId !== ctx.user.id) {
    await (ctx.supabase as any)
      .from("user_profiles")
      .update({ must_change_password: true })
      .eq("id", adminId);
  }

  revalidatePath("/admin/users/admins");
  return { success: true };
}
