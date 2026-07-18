/**
 * scripts/seed-users.ts
 *
 * Seeds the following users into Supabase Auth + role tables:
 *   • 1  super_admin  (Obboye Bossman)
 *   • 5  lecturers
 *   • 5  students
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/seed-users.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Idempotent: re-running skips already-created users.
 */

import { createClient } from "@supabase/supabase-js";

/** Serialize any error value into a readable string. */
function fmt(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    const s = JSON.stringify(err, null, 2);
    return s === "{}" ? "(empty error object — check network / env vars)" : s;
  } catch {
    return String(err);
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "    Run: npx tsx --env-file=.env.local scripts/seed-users.ts"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// User definitions
// ---------------------------------------------------------------------------

const SUPER_ADMIN = {
  email: "obboyebossman@gmail.com",
  password: "StrongPass123",
  name: "Obboye Bossman",
  role: "super_admin" as const,
};

const LECTURERS = [
  { name: "Dr. Kwame Asante",    email: "kwame.asante@ttu.edu.gh",    staff_id: "STF-001" },
  { name: "Prof. Ama Boateng",   email: "ama.boateng@ttu.edu.gh",     staff_id: "STF-002" },
  { name: "Mr. Kofi Mensah",     email: "kofi.mensah@ttu.edu.gh",     staff_id: "STF-003" },
  { name: "Dr. Abena Owusu",     email: "abena.owusu@ttu.edu.gh",     staff_id: "STF-004" },
  { name: "Prof. Yaw Darko",     email: "yaw.darko@ttu.edu.gh",       staff_id: "STF-005" },
].map((l) => ({ ...l, password: "StrongPass123", role: "lecturer" as const }));

// Index number format enforced by DB CHECK: ^[A-Z]+\/[A-Z]+\/\d{2}\/\d{3}$
// Example: BC/ITS/24/001
const STUDENTS = [
  { name: "Akosua Frempong",  email: "akosua.frempong@ttu.edu.gh",  index_number: "BC/ITS/24/001" },
  { name: "Kweku Antwi",      email: "kweku.antwi@ttu.edu.gh",      index_number: "BC/ITS/24/002" },
  { name: "Efua Mensah",      email: "efua.mensah@ttu.edu.gh",      index_number: "BC/ITS/24/003" },
  { name: "Nana Acheampong",  email: "nana.acheampong@ttu.edu.gh",  index_number: "BC/ITS/24/004" },
  { name: "Adjoa Wiredu",     email: "adjoa.wiredu@ttu.edu.gh",     index_number: "BC/ITS/24/005" },
].map((s) => ({ ...s, password: "StrongPass123", role: "student" as const }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates the auth.users row and returns the uuid, or returns the existing uuid. */
async function createAuthUser(
  email: string,
  password: string,
  role: string
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,           // skip email verification flow
    user_metadata: {
      role,                        // handle_new_user() trigger reads this
      must_change_password: false,
    },
  });

  if (!error) return data.user.id;

  const msg = (error.message ?? "").toLowerCase();
  const code = (error as unknown as { code?: string }).code ?? "";
  const isExists =
    msg.includes("already") ||
    msg.includes("exists") ||
    code === "email_exists";

  if (isExists) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr || !list) throw new Error(`Cannot list users: ${fmt(listErr)}`);
    const found = list.users.find((u) => u.email === email);
    if (!found) throw new Error(`User ${email} claimed to exist but was not found.`);
    return found.id;
  }

  // Surface full error detail
  const detail = error.message || fmt(error);
  throw new Error(`Auth API error for ${email}: ${detail} (code=${code || "none"})`);
}

/** Ensures a user_profiles row is present with the right role. */
async function ensureProfile(
  userId: string,
  email: string,
  role: string
): Promise<void> {
  const { error } = await admin.from("user_profiles").upsert(
    { id: userId, role, email, is_active: true, must_change_password: false },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) throw new Error(`user_profiles upsert failed: ${fmt(error)}`);
}

function tick(label: string, ok: boolean, detail?: string) {
  const icon = ok ? "✅" : "❌";
  const msg = detail ? `\n      → ${detail}` : "";
  console.log(`  ${icon}  ${label}${msg}`);
}

// ---------------------------------------------------------------------------
// Role seeders
// ---------------------------------------------------------------------------

async function seedSuperAdmin(userId: string, name: string): Promise<void> {
  // trg_enforce_single_super_admin will reject a second row — the upsert
  // with ignoreDuplicates makes this safe to re-run.
  const { error } = await admin
    .from("super_admins")
    .upsert({ id: userId, name }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`super_admins upsert: ${fmt(error)}`);
}

async function seedLecturer(
  userId: string,
  name: string,
  staffId: string
): Promise<void> {
  const { error } = await admin.from("lecturers").upsert(
    { id: userId, name, staff_id: staffId },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) throw new Error(`lecturers upsert: ${fmt(error)}`);
}

async function seedStudent(
  userId: string,
  name: string,
  indexNumber: string
): Promise<void> {
  const { error } = await admin.from("students").upsert(
    { id: userId, name, index_number: indexNumber },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) throw new Error(`students upsert: ${fmt(error)}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n🌱  ATTEN-SYS — User Seed Script\n");

  // ── Connectivity probe ───────────────────────────────────────────────────
  console.log("🔌  Testing Supabase connection...");
  const { error: pingErr } = await admin.from("system_settings").select("key").limit(1);
  if (pingErr) {
    console.error(`❌  Cannot reach Supabase: ${fmt(pingErr)}`);
    console.error("    Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  console.log("✅  Connected.\n");

  // ── Super Admin ──────────────────────────────────────────────────────────
  console.log("👑  Super Admin");
  try {
    const uid = await createAuthUser(
      SUPER_ADMIN.email,
      SUPER_ADMIN.password,
      SUPER_ADMIN.role
    );
    await ensureProfile(uid, SUPER_ADMIN.email, SUPER_ADMIN.role);
    await seedSuperAdmin(uid, SUPER_ADMIN.name);
    tick(`${SUPER_ADMIN.name} <${SUPER_ADMIN.email}>`, true, uid);
  } catch (err) {
    tick(`${SUPER_ADMIN.name} <${SUPER_ADMIN.email}>`, false, fmt(err));
  }

  // ── Lecturers ─────────────────────────────────────────────────────────────
  console.log("\n🎓  Lecturers");
  for (const l of LECTURERS) {
    try {
      const uid = await createAuthUser(l.email, l.password, l.role);
      await ensureProfile(uid, l.email, l.role);
      await seedLecturer(uid, l.name, l.staff_id);
      tick(`${l.name} <${l.email}>  [${l.staff_id}]`, true, uid);
    } catch (err) {
      tick(`${l.name} <${l.email}>`, false, fmt(err));
    }
  }

  // ── Students ──────────────────────────────────────────────────────────────
  console.log("\n📚  Students");
  for (const s of STUDENTS) {
    try {
      const uid = await createAuthUser(s.email, s.password, s.role);
      await ensureProfile(uid, s.email, s.role);
      await seedStudent(uid, s.name, s.index_number);
      tick(`${s.name} <${s.email}>  [${s.index_number}]`, true, uid);
    } catch (err) {
      tick(`${s.name} <${s.email}>`, false, fmt(err));
    }
  }

  console.log("\n🎉  Seed complete!\n");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  Super Admin login");
  console.log(`    Email   : ${SUPER_ADMIN.email}`);
  console.log(`    Password: ${SUPER_ADMIN.password}`);
  console.log("─────────────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\n💥  Fatal error:", err);
  process.exit(1);
});
