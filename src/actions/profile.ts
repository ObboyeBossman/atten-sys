"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updatePhone(phone: string): Promise<{ error?: string }> {
  const trimmed = phone.trim();
  if (!trimmed) return { error: "Phone number cannot be empty." };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await (supabase
    .from("user_profiles") as any)
    .update({ phone: trimmed })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function uploadProfilePhoto(
  formData: FormData
): Promise<{ error?: string; photoPath?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided." };

  // Validate: images only, max 5 MB
  if (!file.type.startsWith("image/")) return { error: "File must be an image." };
  if (file.size > 5 * 1024 * 1024) return { error: "Image must be under 5 MB." };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `students/${user.id}/avatar.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) return { error: uploadError.message };

  // Persist the path on the student row
  const { error: dbError } = await (supabase
    .from("students") as any)
    .update({ photo_path: path })
    .eq("id", user.id);

  if (dbError) return { error: dbError.message };

  return { photoPath: path };
}
