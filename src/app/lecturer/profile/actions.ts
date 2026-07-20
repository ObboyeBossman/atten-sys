"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: true } | { error: string };

async function getLecturerUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: lecturer } = await supabase
    .from("lecturers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!lecturer) return null;
  return { supabase, user };
}

export async function updateLecturerName(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name cannot be empty." };
  if (trimmed.length < 2) return { error: "Name must be at least 2 characters." };
  if (trimmed.length > 100) return { error: "Name must be 100 characters or fewer." };

  const ctx = await getLecturerUser();
  if (!ctx) return { error: "Unauthorized." };

  const { supabase, user } = ctx;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("lecturers")
    .update({ name: trimmed })
    .eq("id", user.id);

  if (error) return { error: "Failed to update name. Please try again." };

  revalidatePath("/lecturer/profile");
  return { success: true };
}

export async function updateLecturerPhone(phone: string): Promise<ActionResult> {
  const trimmed = phone.trim();

  const ctx = await getLecturerUser();
  if (!ctx) return { error: "Unauthorized." };

  const { supabase, user } = ctx;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("lecturers")
    .update({ phone: trimmed || null })
    .eq("id", user.id);

  if (error) return { error: "Failed to update phone. Please try again." };

  revalidatePath("/lecturer/profile");
  return { success: true };
}

export async function changeLecturerPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<ActionResult> {
  if (!currentPassword) return { error: "Current password is required." };
  if (!newPassword) return { error: "New password is required." };
  if (newPassword.length < 8) return { error: "New password must be at least 8 characters." };
  if (newPassword !== confirmPassword) return { error: "Passwords do not match." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Unauthorized." };

  // Re-authenticate with current password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "Current password is incorrect." };

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) return { error: "Failed to change password. Please try again." };

  return { success: true };
}
