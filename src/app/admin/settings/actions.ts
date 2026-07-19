"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type UpdateSettingResult =
  | { success: true }
  | { error: string };

const ALLOWED_KEYS = [
  "institution_email_domain",
  "gps_accuracy_floor_metres",
  "late_threshold_minutes",
  "default_session_duration_minutes",
] as const;

type AllowedKey = (typeof ALLOWED_KEYS)[number];

function validateValue(key: AllowedKey, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Value cannot be empty.";

  switch (key) {
    case "gps_accuracy_floor_metres":
    case "late_threshold_minutes":
    case "default_session_duration_minutes": {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n <= 0)
        return "Must be a positive whole number.";
      return null;
    }
    case "institution_email_domain": {
      // No @, no spaces, at least one dot
      if (trimmed.includes("@")) return "Domain must not include @.";
      if (/\s/.test(trimmed)) return "Domain must not contain spaces.";
      if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed))
        return "Enter a valid domain (e.g. ttu.edu.gh).";
      return null;
    }
  }
}

export async function updateSetting(
  key: string,
  value: string
): Promise<UpdateSettingResult> {
  if (!ALLOWED_KEYS.includes(key as AllowedKey)) {
    return { error: "Unknown setting key." };
  }

  const validationError = validateValue(key as AllowedKey, value.trim());
  if (validationError) return { error: validationError };

  const supabase = await createSupabaseServerClient();

  // Verify caller is super admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: string; is_active: boolean } | null;

  if (!profile || profile.role !== "super_admin" || !profile.is_active) {
    return { error: "Unauthorized." };
  }

  // The DB Update type only exposes { value } — updated_by and updated_at
  // are maintained by the set_updated_at trigger and RLS-injected defaults.
  // We cast to `any` here so the runtime payload includes updated_by/updated_at,
  // matching the actual column types while bypassing the narrowed TS Update type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase as any)
    .from("system_settings")
    .update({
      value: value.trim(),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("key", key);

  if (dbError) {
    console.error("Settings update error:", dbError);
    return { error: "Failed to save. Please try again." };
  }

  revalidatePath("/admin/settings");
  return { success: true };
}
