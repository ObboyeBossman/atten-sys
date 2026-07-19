"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: true } | { error: string };

/* ── Auth guard helper ───────────────────────────────────── */
async function getAdminUser() {
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

/* ── Update display name ─────────────────────────────────── */
export async function updateAdminName(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name cannot be empty." };
  if (trimmed.length < 2) return { error: "Name must be at least 2 characters." };
  if (trimmed.length > 100) return { error: "Name must be 100 characters or fewer." };

  const ctx = await getAdminUser();
  if (!ctx) return { error: "Unauthorized." };

  const { supabase, user } = ctx;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("super_admins")
    .update({ name: trimmed })
    .eq("id", user.id);

  if (error) {
    console.error("updateAdminName error:", error);
    return { error: "Failed to update name. Please try again." };
  }

  revalidatePath("/admin/profile");
  revalidatePath("/admin", "layout");
  return { success: true };
}

/* ── Change password ─────────────────────────────────────── */
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<ActionResult> {
  if (!currentPassword) return { error: "Current password is required." };
  if (!newPassword) return { error: "New password is required." };
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters." };
  if (newPassword !== confirmPassword) return { error: "Passwords do not match." };
  if (newPassword === currentPassword)
    return { error: "New password must differ from the current password." };

  const ctx = await getAdminUser();
  if (!ctx) return { error: "Unauthorized." };

  const { supabase, user } = ctx;

  // Re-authenticate with current password to verify it
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (signInError) {
    return { error: "Current password is incorrect." };
  }

  // Now set the new password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    console.error("changeAdminPassword error:", updateError);
    return { error: "Failed to change password. Please try again." };
  }

  return { success: true };
}
