"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function updateProfile(input: {
  name: string;
  phone: string | null;
}): Promise<{ success: true } | { error: string }> {
  const { supabase, user } = await getUser();

  const name = input.name.trim();
  if (!name) return { error: "Name cannot be empty." };

   
  const { error } = await (supabase as any)
    .from("lecturers")
    .update({ name, phone: input.phone?.trim() || null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/lecturer/profile");
  revalidatePath("/lecturer/dashboard");
  return { success: true };
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: true } | { error: string }> {
  const { supabase } = await getUser();

  if (input.newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  // Re-authenticate with current password first
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.email) return { error: "Unable to verify identity." };

  const signInResult = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (signInResult.error) {
    return { error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
  });

  if (error) return { error: error.message };

  return { success: true };
}
