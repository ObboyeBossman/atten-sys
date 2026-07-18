import { type NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getR2Client } from "@/lib/r2";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/webp", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  // 1. Verify the user is authenticated
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // 2. Parse the multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const objectKey = formData.get("key") as string | null;

  if (!file || !objectKey) {
    return NextResponse.json(
      { error: "Missing file or key" },
      { status: 400 }
    );
  }

  // 3. Validate file type
  if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, WebP, and PNG images are allowed" },
      { status: 400 }
    );
  }

  // 4. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds the 5 MB size limit" },
      { status: 400 }
    );
  }

  // 5. Validate object key — only allow paths for the authenticated user
  // Allowed prefixes: attendance/{sessionId}/{userId}.webp  or  students/{userId}/avatar.webp
  const isAttendancePath =
    objectKey.startsWith("attendance/") && objectKey.endsWith(`/${user.id}.webp`);
  const isAvatarPath = objectKey === `students/${user.id}/avatar.webp`;

  if (!isAttendancePath && !isAvatarPath) {
    return NextResponse.json({ error: "Forbidden key path" }, { status: 403 });
  }

  // 6. Upload to R2
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const r2Client = getR2Client();
    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: objectKey,
        Body: buffer,
        ContentType: file.type,
        ContentLength: buffer.length,
        // Cache public objects for 1 year
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (err) {
    console.error("[R2 Upload] Failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ key: objectKey });
}
