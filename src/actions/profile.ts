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

  // Validate: images only, max 5 MB (mirrors /api/upload route constraints)
  if (!file.type.startsWith("image/")) return { error: "File must be an image." };
  if (file.size > 5 * 1024 * 1024) return { error: "Image must be under 5 MB." };

  // Always store as webp to match the R2 route's allowed key pattern
  const key = `students/${user.id}/avatar.webp`;

  // Build a new FormData to forward to the R2 upload API route
  const upload = new FormData();
  upload.append("file", file);
  upload.append("key", key);

  // Call the existing /api/upload route — it handles auth, validation, and R2
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/upload`,
    { method: "POST", body: upload }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: (body as any).error ?? "Upload failed. Please try again." };
  }

  const { key: uploadedKey } = await res.json();

  // Persist the R2 object key on the student row
  const { error: dbError } = await (supabase
    .from("students") as any)
    .update({ photo_path: uploadedKey })
    .eq("id", user.id);

  if (dbError) return { error: dbError.message };

  return { photoPath: uploadedKey };
}
