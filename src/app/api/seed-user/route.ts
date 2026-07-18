/**
 * POST /api/seed-user
 *
 * Development / bootstrapping edge function that seeds a single test user into
 * all three role tables (super_admins, students, lecturers).
 *
 * SECURITY:
 *   Guarded by SEED_SECRET env var.
 *   All requests must include: Authorization: Bearer <SEED_SECRET>
 *   Set SEED_SECRET to a long random string in .env.local.
 *   Never expose this route without the secret in production.
 *
 * Request body (JSON):
 *   email        string  required
 *   password     string  required
 *   name         string  required
 *   index_number string  optional  (student identity, e.g. "BC/ITS/24/001")
 *   staff_id     string  optional  (lecturer identity, e.g. "STF-001")
 *   phone        string  optional
 *
 * Response 200 / 207 (JSON):
 *   {
 *     user_id: string,
 *     email:   string,
 *     seeded_roles: {
 *       super_admin: { ok: boolean, error?: string },
 *       student:     { ok: boolean, error?: string, index_number?: string },
 *       lecturer:    { ok: boolean, error?: string }
 *     }
 *   }
 *
 * HTTP 200 = all roles seeded OK.
 * HTTP 207 = partial success — check each role's "ok" field.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AdminClient = ReturnType<typeof createClient<Database>>;

interface SeedBody {
  email: string;
  password: string;
  name: string;
  index_number?: string;
  staff_id?: string;
  phone?: string;
}

interface RoleResult {
  ok: boolean;
  error?: string;
  index_number?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminClient(): AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Secret guard
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret) {
    return NextResponse.json(
      { error: "SEED_SECRET env var is not configured on the server." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!token || token !== seedSecret) {
    return NextResponse.json(
      {
        error:
          "Forbidden. Provide Authorization: Bearer <SEED_SECRET>.",
      },
      { status: 403 }
    );
  }

  // 2. Parse body
  let body: SeedBody;
  try {
    body = (await request.json()) as SeedBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { email, password, name, index_number, staff_id, phone } = body;

  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "Required fields: email, password, name." },
      { status: 400 }
    );
  }

  // 3. Admin client
  let admin: AdminClient;
  try {
    admin = makeAdminClient();
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  // 4. Create or retrieve the auth user (idempotent)
  let userId: string;
  let userEmail: string;

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        // handle_new_user() trigger reads "role" from raw_user_meta_data
        role: "super_admin",
        must_change_password: false,
        phone: phone ?? null,
      },
    });

  if (createError) {
    const msg = createError.message?.toLowerCase() ?? "";
    const alreadyExists =
      msg.includes("already") ||
      msg.includes("exists") ||
      (createError as { code?: string }).code === "email_exists";

    if (!alreadyExists) {
      return NextResponse.json(
        { error: `Failed to create auth user: ${createError.message}` },
        { status: 500 }
      );
    }

    // Lookup existing user by email
    const { data: list, error: listErr } =
      await admin.auth.admin.listUsers({ perPage: 1000 });

    if (listErr || !list) {
      return NextResponse.json(
        { error: `Could not list users: ${listErr?.message}` },
        { status: 500 }
      );
    }

    const existing = list.users.find((u) => u.email === email);
    if (!existing) {
      return NextResponse.json(
        { error: "User already exists but could not be found by email." },
        { status: 500 }
      );
    }

    userId = existing.id;
    userEmail = existing.email ?? email;
  } else {
    userId = created.user.id;
    userEmail = created.user.email ?? email;
  }

  // 5. Ensure user_profiles row exists (handle_new_user trigger safety net)
  await (admin.from("user_profiles") as any).upsert(
    {
      id: userId,
      role: "super_admin",
      email: userEmail,
      phone: phone ?? null,
      is_active: true,
      must_change_password: false,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  // 6. Seed all three roles
  const superAdminResult = await seedSuperAdmin(admin, userId, name);
  const studentResult    = await seedStudent(admin, userId, name, index_number);
  const lecturerResult   = await seedLecturer(admin, userId, name, staff_id, phone);

  // 7. Restore user_profiles.role to super_admin (highest privilege)
  await (admin.from("user_profiles") as any)
    .update({ role: "super_admin" })
    .eq("id", userId);

  // 8. Respond
  const allOk = superAdminResult.ok && studentResult.ok && lecturerResult.ok;

  return NextResponse.json(
    {
      user_id: userId,
      email: userEmail,
      seeded_roles: {
        super_admin: superAdminResult,
        student: studentResult,
        lecturer: lecturerResult,
      },
    },
    { status: allOk ? 200 : 207 }
  );
}

// ---------------------------------------------------------------------------
// Role seeders
// ---------------------------------------------------------------------------

/** Seeds the super_admins row. */
async function seedSuperAdmin(
  admin: AdminClient,
  userId: string,
  name: string
): Promise<RoleResult> {
  try {
    // Align profile role before inserting — trg_super_admins_sync_role expects it.
    await (admin.from("user_profiles") as any)
      .update({ role: "super_admin" })
      .eq("id", userId);

    const { error } = await (admin.from("super_admins") as any)
      .upsert({ id: userId, name }, { onConflict: "id", ignoreDuplicates: true });

    if (error) {
      // trg_enforce_single_super_admin raises when a second super_admin exists.
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Seeds the students row.
 *
 * Uses the caller-supplied index_number or falls back to "SEED/DEV/00/001".
 * For production students, use add_student_to_group() via the admin portal.
 */
async function seedStudent(
  admin: AdminClient,
  userId: string,
  name: string,
  indexNumber?: string
): Promise<RoleResult> {
  const finalIndex = indexNumber ?? "SEED/DEV/00/001";

  try {
    await (admin.from("user_profiles") as any)
      .update({ role: "student" })
      .eq("id", userId);

    const { error } = await (admin.from("students") as any).upsert(
      { id: userId, name, index_number: finalIndex },
      { onConflict: "id", ignoreDuplicates: true }
    );

    if (error) {
      // Restore to super_admin so the profile isn't left in an inconsistent state.
      await (admin.from("user_profiles") as any)
        .update({ role: "super_admin" })
        .eq("id", userId);
      return { ok: false, error: error.message };
    }

    return { ok: true, index_number: finalIndex };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Seeds the lecturers row. */
async function seedLecturer(
  admin: AdminClient,
  userId: string,
  name: string,
  staffId?: string,
  phone?: string
): Promise<RoleResult> {
  try {
    await (admin.from("user_profiles") as any)
      .update({ role: "lecturer" })
      .eq("id", userId);

    const { error } = await (admin.from("lecturers") as any).upsert(
      {
        id: userId,
        name,
        staff_id: staffId ?? null,
        phone: phone ?? null,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    if (error) {
      await (admin.from("user_profiles") as any)
        .update({ role: "super_admin" })
        .eq("id", userId);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
