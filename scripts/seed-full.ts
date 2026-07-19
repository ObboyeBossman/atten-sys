/**
 * scripts/seed-full.ts
 *
 * Full 3-year realistic seed for ATTEN-SYS.
 * Populates every table with coherent data that looks like a real system
 * that has been in use since the 2022/2023 academic year.
 *
 * Institution: Takoradi Technical University (TTU)
 * Department:  Department of Information Technology Studies
 *
 * Data layout
 * ───────────
 * Academic years : 2022/2023 (archived), 2023/2024 (archived), 2024/2025 (current)
 * Semesters      : 2 per year (First & Second) = 6 total; 5 archived, 1 active
 * Programmes     : BTech Information Technology
 * Qual types     : BTech (4 levels), HND (3 levels), Diploma (2 levels)
 * Lecturers      : 10 (all active)
 * Students       : ~30 per group per year → ~200+ total across cohorts
 * Groups         : Each qual-type × level × year (promoted cohorts carry forward)
 * Courses        : 6 per group per semester
 * Sessions       : 8–12 per course per semester (all past semesters closed)
 * Attendance     : Realistic mix — ~75% present, ~10% late, ~15% absent
 * Disputes       : ~5% of absent records raise a dispute; mix of pending/resolved
 * Timetables     : Mon–Fri slots for every course
 * Notifications  : Generated for each session open (read/dismissed for past)
 * Audit log      : Key lifecycle events
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/seed-full.ts
 *
 * Safe to re-run — all inserts are idempotent (upsert / skip-if-exists).
 * Running a second time will log "already exists" for every entity and exit cleanly.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEFAULT_PASSWORD = "Atten@2022";  // all seeded users share this

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

function log(icon: string, msg: string) {
  console.log(`${icon}  ${msg}`);
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`);
}

/** Postgres date from JS Date */
function pgDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Random int in [min, max] */
function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Create an auth.users row via admin API and return its UUID.
 * If the email already exists, return the existing UUID.
 */
async function createAuthUser(
  email: string,
  password: string,
  role: string,
  mustChangePassword = false,
): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, must_change_password: mustChangePassword },
  });

  if (!error) return data.user.id;

  const msg = (error.message ?? "").toLowerCase();
  const code = (error as any).code ?? "";
  if (msg.includes("already") || msg.includes("exists") || code === "email_exists") {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    const found = list?.users.find((u) => u.email === email);
    if (found) return found.id;
  }
  throw new Error(`Auth error for ${email}: ${fmt(error)}`);
}

async function ensureProfile(id: string, email: string, role: string) {
  const { error } = await db.from("user_profiles").upsert(
    { id, email, role, is_active: true, must_change_password: false },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`user_profiles: ${fmt(error)}`);
}

/** Insert and return the id; on unique conflict return existing id */
async function upsertReturningId(
  table: string,
  payload: Record<string, unknown>,
  conflictCol: string,
): Promise<string> {
  // try insert
  const { data: ins, error: insErr } = await (db.from(table) as any)
    .insert(payload)
    .select("id")
    .single();
  if (!insErr) return ins.id;

  if (insErr.code === "23505") {
    // unique violation — fetch existing
    const conflictVal = payload[conflictCol];
    const { data: ex, error: selErr } = await (db.from(table) as any)
      .select("id")
      .eq(conflictCol, conflictVal)
      .single();
    if (selErr) throw new Error(`${table} fetch after conflict: ${fmt(selErr)}`);
    return ex.id;
  }
  throw new Error(`${table} insert: ${fmt(insErr)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Static data definitions
// ─────────────────────────────────────────────────────────────────────────────

// ── Institution ──────────────────────────────────────────────────────────────

const FACULTY = { name: "Faculty of Applied Sciences and Technology" };

const DEPARTMENTS = [
  { name: "Department of Information Technology Studies" },
  { name: "Department of Electrical and Electronic Engineering" },
];

// programmes per dept index
const PROGRAMMES = [
  // IT dept (index 0)
  { deptIdx: 0, name: "Information Technology",            code: "ITS" },
  { deptIdx: 0, name: "Information Technology (Networks)", code: "ITN" },
  // EEE dept (index 1) — gives us a second programme for realism
  { deptIdx: 1, name: "Electrical Engineering Technology", code: "EET" },
];

// qualification types per programme index
const QUAL_TYPES = [
  // ITS (index 0)
  { progIdx: 0, name: "Bachelor of Technology",         code: "BC" },
  { progIdx: 0, name: "Higher National Diploma",        code: "HN" },
  // ITN (index 1)
  { progIdx: 1, name: "Bachelor of Technology",         code: "BC" },
  // EET (index 2)
  { progIdx: 2, name: "Higher National Diploma",        code: "HN" },
];

// levels per qual-type index (sort_order must be unique per qual-type)
const LEVELS_MAP: Record<number, Array<{ name: string; sort_order: number }>> = {
  0: [ // BC/ITS — 4 years
    { name: "Level 100", sort_order: 1 },
    { name: "Level 200", sort_order: 2 },
    { name: "Level 300", sort_order: 3 },
    { name: "Level 400", sort_order: 4 },
  ],
  1: [ // HN/ITS — 3 years
    { name: "Level 100", sort_order: 1 },
    { name: "Level 200", sort_order: 2 },
    { name: "Level 300", sort_order: 3 },
  ],
  2: [ // BC/ITN — 4 years
    { name: "Level 100", sort_order: 1 },
    { name: "Level 200", sort_order: 2 },
    { name: "Level 300", sort_order: 3 },
    { name: "Level 400", sort_order: 4 },
  ],
  3: [ // HN/EET — 3 years
    { name: "Level 100", sort_order: 1 },
    { name: "Level 200", sort_order: 2 },
    { name: "Level 300", sort_order: 3 },
  ],
};

// ── Academic years ───────────────────────────────────────────────────────────

const ACADEMIC_YEARS = [
  {
    name: "2022/2023", year_code: "22",
    start_date: "2022-09-05", end_date: "2023-07-28",
    is_current: false,
  },
  {
    name: "2023/2024", year_code: "23",
    start_date: "2023-09-04", end_date: "2024-07-26",
    is_current: false,
  },
  {
    name: "2024/2025", year_code: "24",
    start_date: "2024-09-02", end_date: "2025-07-25",
    is_current: true,
  },
];

// semesters per year
const SEMESTERS_MAP: Record<string, Array<{
  name: string; start_date: string; end_date: string; status: string; auto_open: boolean;
}>> = {
  "2022/2023": [
    { name: "First Semester",  start_date: "2022-09-05", end_date: "2023-01-20", status: "archived", auto_open: true },
    { name: "Second Semester", start_date: "2023-02-06", end_date: "2023-07-28", status: "archived", auto_open: true },
  ],
  "2023/2024": [
    { name: "First Semester",  start_date: "2023-09-04", end_date: "2024-01-19", status: "archived", auto_open: true },
    { name: "Second Semester", start_date: "2024-02-05", end_date: "2024-07-26", status: "archived", auto_open: true },
  ],
  "2024/2025": [
    { name: "First Semester",  start_date: "2024-09-02", end_date: "2025-01-17", status: "archived", auto_open: true },
    { name: "Second Semester", start_date: "2025-02-03", end_date: "2025-07-25", status: "active",   auto_open: true },
  ],
};

// ── Lecturers ────────────────────────────────────────────────────────────────

const LECTURERS = [
  { name: "Dr. Kwame Asante",       email: "kwame.asante@ttu.edu.gh",       staff_id: "STF-001" },
  { name: "Prof. Ama Boateng",      email: "ama.boateng@ttu.edu.gh",        staff_id: "STF-002" },
  { name: "Mr. Kofi Mensah",        email: "kofi.mensah@ttu.edu.gh",        staff_id: "STF-003" },
  { name: "Dr. Abena Owusu",        email: "abena.owusu@ttu.edu.gh",        staff_id: "STF-004" },
  { name: "Prof. Yaw Darko",        email: "yaw.darko@ttu.edu.gh",          staff_id: "STF-005" },
  { name: "Mrs. Efua Nyarko",       email: "efua.nyarko@ttu.edu.gh",        staff_id: "STF-006" },
  { name: "Mr. Nana Osei",          email: "nana.osei@ttu.edu.gh",          staff_id: "STF-007" },
  { name: "Dr. Adjoa Antwi",        email: "adjoa.antwi@ttu.edu.gh",        staff_id: "STF-008" },
  { name: "Prof. Kojo Acheampong",  email: "kojo.acheampong@ttu.edu.gh",    staff_id: "STF-009" },
  { name: "Mr. Kwabena Wiredu",     email: "kwabena.wiredu@ttu.edu.gh",     staff_id: "STF-010" },
];

// ── Course templates per level ───────────────────────────────────────────────
// We'll assign 6 courses per group per semester, cycling through these.

const COURSE_TEMPLATES: Record<string, Array<{
  name: string; code: string; credit_hours: number;
}>> = {
  // BC/ITS Level 100 Sem 1
  "L100S1": [
    { name: "Introduction to Computing",         code: "ITC 111", credit_hours: 3 },
    { name: "Mathematics for Technology I",      code: "MTH 111", credit_hours: 3 },
    { name: "Communication Skills",              code: "ENG 111", credit_hours: 2 },
    { name: "Fundamentals of Programming",       code: "PRG 111", credit_hours: 3 },
    { name: "Computer Hardware Essentials",      code: "CHW 111", credit_hours: 2 },
    { name: "Technical Drawing & Design",        code: "TDD 111", credit_hours: 2 },
  ],
  "L100S2": [
    { name: "Data Structures & Algorithms",      code: "DSA 112", credit_hours: 3 },
    { name: "Mathematics for Technology II",     code: "MTH 112", credit_hours: 3 },
    { name: "Technical Report Writing",          code: "ENG 112", credit_hours: 2 },
    { name: "Object-Oriented Programming",       code: "OOP 112", credit_hours: 3 },
    { name: "Operating Systems I",               code: "OSY 112", credit_hours: 3 },
    { name: "Networking Fundamentals",           code: "NET 112", credit_hours: 2 },
  ],
  "L200S1": [
    { name: "Database Management Systems",       code: "DBS 211", credit_hours: 3 },
    { name: "Web Technologies I",                code: "WEB 211", credit_hours: 3 },
    { name: "Systems Analysis & Design",         code: "SAD 211", credit_hours: 3 },
    { name: "Computer Networks I",               code: "CNT 211", credit_hours: 3 },
    { name: "Software Engineering",              code: "SEN 211", credit_hours: 3 },
    { name: "Statistics for IT",                 code: "STA 211", credit_hours: 2 },
  ],
  "L200S2": [
    { name: "Advanced Database Systems",         code: "DBS 212", credit_hours: 3 },
    { name: "Web Technologies II",               code: "WEB 212", credit_hours: 3 },
    { name: "Operating Systems II",              code: "OSY 212", credit_hours: 3 },
    { name: "Computer Networks II",              code: "CNT 212", credit_hours: 3 },
    { name: "Human-Computer Interaction",        code: "HCI 212", credit_hours: 2 },
    { name: "IT Project Management",             code: "IPM 212", credit_hours: 2 },
  ],
  "L300S1": [
    { name: "Mobile Application Development",   code: "MAD 311", credit_hours: 3 },
    { name: "Cloud Computing",                   code: "CLD 311", credit_hours: 3 },
    { name: "Cybersecurity Fundamentals",        code: "CSF 311", credit_hours: 3 },
    { name: "Enterprise Systems",                code: "ENT 311", credit_hours: 3 },
    { name: "Research Methods in IT",            code: "RMT 311", credit_hours: 2 },
    { name: "Entrepreneurship",                  code: "ENP 311", credit_hours: 2 },
  ],
  "L300S2": [
    { name: "Advanced Mobile Development",       code: "MAD 312", credit_hours: 3 },
    { name: "Network Security",                  code: "NSC 312", credit_hours: 3 },
    { name: "Big Data Analytics",                code: "BDA 312", credit_hours: 3 },
    { name: "Industrial Attachment",             code: "IND 312", credit_hours: 6 },
    { name: "Technical Seminar",                 code: "SEM 312", credit_hours: 1 },
    { name: "Professional Ethics in IT",         code: "ETH 312", credit_hours: 2 },
  ],
  "L400S1": [
    { name: "Artificial Intelligence",           code: "AIN 411", credit_hours: 3 },
    { name: "Systems Integration",               code: "SIN 411", credit_hours: 3 },
    { name: "Information Security Management",   code: "ISM 411", credit_hours: 3 },
    { name: "Final Year Project I",              code: "FYP 411", credit_hours: 6 },
    { name: "IT Governance & Compliance",        code: "ITC 411", credit_hours: 2 },
    { name: "Advanced Research Methods",         code: "ARM 411", credit_hours: 2 },
  ],
  "L400S2": [
    { name: "Machine Learning",                  code: "MLN 412", credit_hours: 3 },
    { name: "Distributed Systems",               code: "DSY 412", credit_hours: 3 },
    { name: "Final Year Project II",             code: "FYP 412", credit_hours: 6 },
    { name: "IT Strategy & Innovation",          code: "ISI 412", credit_hours: 2 },
    { name: "Digital Transformation",            code: "DTF 412", credit_hours: 2 },
    { name: "Capstone Presentation",             code: "CAP 412", credit_hours: 1 },
  ],
};

// Fallback templates (for HND & EET — reuse with slight renaming)
function getCourseTemplate(levelName: string, semName: string): typeof COURSE_TEMPLATES["L100S1"] {
  const lvl = levelName.replace("Level ", "L").replace(" ", "");
  const sem = semName.includes("First") ? "S1" : "S2";
  const key = `${lvl}${sem}`;
  if (COURSE_TEMPLATES[key]) return COURSE_TEMPLATES[key];
  // fallback — shift codes slightly to avoid unique constraint collisions across groups
  const base = COURSE_TEMPLATES["L200S1"];
  return base.map((c, i) => ({
    name: c.name,
    code: c.code.replace(/\d+$/, String(Number(c.code.match(/\d+$/)?.[0]) + 50 + i)),
    credit_hours: c.credit_hours,
  }));
}

// ── Student names pool (Ghanaian names) ─────────────────────────────────────

const STUDENT_NAMES = [
  "Akosua Frempong", "Kweku Antwi", "Efua Mensah", "Nana Acheampong", "Adjoa Wiredu",
  "Kofi Boateng", "Ama Asante", "Yaw Owusu", "Abena Darko", "Kwame Nyarko",
  "Akua Osei", "Fiifi Andoh", "Maame Adusei", "Kwabena Tetteh", "Esi Appiah",
  "Kojo Asamoah", "Adwoa Agyeman", "Nii Laryea", "Abba Quartey", "Akweley Hammond",
  "Kweku Turkson", "Efua Quaye", "Nana Aidoo", "Adjei Mensah", "Afia Bonsu",
  "Kwabena Baffoe", "Akosua Dankwah", "Yaw Asiedu", "Ama Nkrumah", "Kofi Barimah",
  "Abena Sakyi", "Akua Forson", "Fiifi Abban", "Maame Serwah", "Kweku Bediako",
  "Esi Quaicoe", "Kojo Asare", "Adwoa Poku", "Nii Ashitey", "Abba Cofie",
  "Akweley Odoom", "Kweku Aning", "Efua Andoh", "Nana Asare", "Adjoa Duah",
  "Kofi Owusu", "Ama Twumasi", "Yaw Amoah", "Abena Asante", "Kwame Sarpong",
  "Akua Mensah", "Fiifi Agyei", "Maame Amponsah", "Kwabena Donkor", "Esi Frimpong",
  "Kojo Opoku", "Adwoa Ampong", "Nii Tetteh", "Abba Asante", "Akweley Acquah",
  "Kweku Boateng", "Efua Otoo", "Nana Yeboah", "Adjei Boakye", "Afia Darko",
  "Kwabena Adu", "Akosua Boateng", "Yaw Gyamfi", "Ama Mintah", "Kofi Gyan",
  "Abena Prempeh", "Akua Agyemang", "Fiifi Baah", "Maame Amoah", "Kweku Koomson",
  "Esi Darko", "Kojo Nkrumah", "Adwoa Asante", "Nii Mensah", "Abba Tetteh",
  "Akweley Aidoo", "Kweku Bawa", "Efua Asamoah", "Nana Boateng", "Adjoa Asante",
  "Kofi Acheampong", "Ama Osei", "Yaw Antwi", "Abena Addai", "Kwame Adom",
  "Akua Boateng", "Fiifi Duah", "Maame Obeng", "Kwabena Siaw", "Esi Opoku",
];

// ─────────────────────────────────────────────────────────────────────────────
// Runtime maps (populated during seeding)
// ─────────────────────────────────────────────────────────────────────────────

// Maps we build as we go, used for FK lookups
const yearIds:        Record<string, string> = {}; // "2022/2023" → uuid
const semesterIds:    Record<string, string> = {}; // "2022/2023-First Semester" → uuid
const lectureIds:     string[] = [];               // ordered list of lecturer uuids
const groupIds:       string[] = [];               // all group uuids
const studentUserIds: string[] = [];               // all student uuids created

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 0 — Connectivity probe
// ─────────────────────────────────────────────────────────────────────────────

async function probe() {
  const { error } = await db.from("system_settings").select("key").limit(1);
  if (error) {
    console.error(`❌  Cannot reach Supabase: ${fmt(error)}`);
    process.exit(1);
  }
  log("✅", "Connected to Supabase");
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — Institution skeleton
// ─────────────────────────────────────────────────────────────────────────────

async function seedInstitution() {
  section("PHASE 1 — Institution Skeleton");

  // Faculty
  const { data: facRow, error: facErr } = await (db.from("faculties") as any)
    .upsert({ name: FACULTY.name }, { onConflict: "name", ignoreDuplicates: false })
    .select("id")
    .single();
  if (facErr) throw new Error(`faculties: ${fmt(facErr)}`);
  const facultyId: string = facRow.id;
  log("🏛", `Faculty: ${FACULTY.name}`);

  // Departments
  const deptIds: string[] = [];
  for (const d of DEPARTMENTS) {
    const { data: dr, error: de } = await (db.from("departments") as any)
      .upsert({ faculty_id: facultyId, name: d.name }, { onConflict: "departments_faculty_name_unique", ignoreDuplicates: false })
      .select("id")
      .single();
    if (de) {
      // fetch existing
      const { data: ex } = await (db.from("departments") as any)
        .select("id")
        .eq("faculty_id", facultyId)
        .eq("name", d.name)
        .single();
      deptIds.push(ex.id);
    } else {
      deptIds.push(dr.id);
    }
    log("  🏢", `Dept: ${d.name}`);
  }

  // Programmes
  const progIds: string[] = [];
  for (const p of PROGRAMMES) {
    const deptId = deptIds[p.deptIdx];
    const { data: pr, error: pe } = await (db.from("programmes") as any)
      .insert({ department_id: deptId, name: p.name, code: p.code })
      .select("id")
      .single();
    if (pe) {
      const { data: ex } = await (db.from("programmes") as any)
        .select("id")
        .eq("department_id", deptId)
        .eq("code", p.code)
        .single();
      progIds.push(ex.id);
    } else {
      progIds.push(pr.id);
    }
    log("  📚", `Programme: ${p.name} (${p.code})`);
  }

  // Qualification types
  const qualTypeIds: string[] = [];
  for (const q of QUAL_TYPES) {
    const progId = progIds[q.progIdx];
    const { data: qr, error: qe } = await (db.from("qualification_types") as any)
      .insert({ programme_id: progId, name: q.name, code: q.code })
      .select("id")
      .single();
    if (qe) {
      const { data: ex } = await (db.from("qualification_types") as any)
        .select("id")
        .eq("programme_id", progId)
        .eq("code", q.code)
        .single();
      qualTypeIds.push(ex.id);
    } else {
      qualTypeIds.push(qr.id);
    }
    log("  🎓", `Qual type: ${q.name} (${q.code}) under ${PROGRAMMES[q.progIdx].name}`);
  }

  // Levels
  // levelIds[qtIdx][levelIdx] = uuid
  const levelIds: string[][] = [];
  for (let qi = 0; qi < QUAL_TYPES.length; qi++) {
    levelIds[qi] = [];
    const qtId = qualTypeIds[qi];
    const levels = LEVELS_MAP[qi] ?? [];
    for (const lv of levels) {
      const { data: lr, error: le } = await (db.from("levels") as any)
        .insert({ qualification_type_id: qtId, name: lv.name, sort_order: lv.sort_order })
        .select("id")
        .single();
      if (le) {
        const { data: ex } = await (db.from("levels") as any)
          .select("id")
          .eq("qualification_type_id", qtId)
          .eq("sort_order", lv.sort_order)
          .single();
        levelIds[qi].push(ex.id);
      } else {
        levelIds[qi].push(lr.id);
      }
      log("    📊", `Level: ${lv.name} for ${QUAL_TYPES[qi].code}/${PROGRAMMES[QUAL_TYPES[qi].progIdx].code}`);
    }
  }

  return { qualTypeIds, levelIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Academic years & semesters
// ─────────────────────────────────────────────────────────────────────────────

async function seedAcademicYears() {
  section("PHASE 2 — Academic Years & Semesters");

  for (const ay of ACADEMIC_YEARS) {
    // Only one row can have is_current = true (partial unique index).
    // Insert with is_current=false first, then update if current.
    const { data: yr, error: ye } = await (db.from("academic_years") as any)
      .insert({ ...ay, is_current: false })
      .select("id")
      .single();

    let yearId: string;
    if (ye) {
      if (ye.code === "23505") {
        const { data: ex } = await (db.from("academic_years") as any)
          .select("id")
          .eq("name", ay.name)
          .single();
        yearId = ex.id;
      } else {
        throw new Error(`academic_years: ${fmt(ye)}`);
      }
    } else {
      yearId = yr.id;
      // Now set is_current if needed (after any existing current row was avoided)
      if (ay.is_current) {
        await (db.from("academic_years") as any).update({ is_current: true }).eq("id", yearId);
      }
    }

    yearIds[ay.name] = yearId;
    log("📅", `Academic year: ${ay.name} (${ay.is_current ? "current" : "archived"})`);

    // Semesters for this year
    for (const sem of SEMESTERS_MAP[ay.name] ?? []) {
      const semKey = `${ay.name}-${sem.name}`;
      const semPayload = {
        academic_year_id: yearId,
        name: sem.name,
        start_date: sem.start_date,
        end_date: sem.end_date,
        status: sem.status,
        auto_open: sem.auto_open,
        opened_at: sem.status !== "upcoming" ? new Date(sem.start_date).toISOString() : null,
        closed_at: sem.status === "archived"  ? new Date(sem.end_date).toISOString() : null,
      };

      const { data: sr, error: se } = await (db.from("app_semesters") as any)
        .insert(semPayload)
        .select("id")
        .single();

      if (se) {
        if (se.code === "23505") {
          const { data: ex } = await (db.from("app_semesters") as any)
            .select("id")
            .eq("academic_year_id", yearId)
            .eq("name", sem.name)
            .single();
          semesterIds[semKey] = ex.id;
        } else if (se.code === "23000" && sem.status === "active") {
          // Unique index violation: another semester is already 'active'.
          // This is expected when re-running. Fetch existing.
          const { data: ex } = await (db.from("app_semesters") as any)
            .select("id")
            .eq("academic_year_id", yearId)
            .eq("name", sem.name)
            .single();
          if (ex) semesterIds[semKey] = ex.id;
          else throw new Error(`app_semesters active conflict unresolved for ${semKey}`);
        } else {
          throw new Error(`app_semesters (${semKey}): ${fmt(se)}`);
        }
      } else {
        semesterIds[semKey] = sr.id;
      }
      log("  📆", `Semester: ${sem.name} [${sem.status}]`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — Lecturers
// ─────────────────────────────────────────────────────────────────────────────

async function seedLecturers() {
  section("PHASE 3 — Lecturers");

  for (const l of LECTURERS) {
    const uid = await createAuthUser(l.email, DEFAULT_PASSWORD, "lecturer");
    await ensureProfile(uid, l.email, "lecturer");

    const { error } = await db.from("lecturers").upsert(
      { id: uid, name: l.name, staff_id: l.staff_id },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) throw new Error(`lecturers: ${fmt(error)}`);
    lectureIds.push(uid);
    log("👨‍🏫", `${l.name} <${l.email}> [${l.staff_id}]`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — Groups, students, courses, sessions, attendance (per semester batch)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For a given academic year + qual-type + level combo, create:
 *   1. The group (Group A, ~25 students)
 *   2. The groups_secrets row
 *   3. Students for that group (if first time seeing this cohort)
 *   4. group_memberships (active for current year, promoted/completed for past)
 *   5. Courses for each semester in this year
 *   6. Timetables
 *   7. Class sessions (historical, all closed)
 *   8. Attendance records
 *   9. Disputes (subset of absent records)
 *   10. Notifications (dismissed for past)
 */
async function seedGroupBatch(opts: {
  qualTypeId:   string;
  qualTypeCode: string;
  progCode:     string;
  levelId:      string;
  levelName:    string;
  yearId:       string;
  yearName:     string;
  yearCode:     string;
  isCurrent:    boolean;
  // studentPool: names to draw from, starting at nameOffset
  nameOffset:   number;
  studentCount: number;
  // membership status to assign
  membershipStatus: "active" | "promoted" | "completed";
  // If promoted — this group will become source; target group will be seeded separately
}) {
  const {
    qualTypeId, qualTypeCode, progCode, levelId, levelName,
    yearId, yearName, yearCode, isCurrent,
    nameOffset, studentCount, membershipStatus,
  } = opts;

  // ── Group ──────────────────────────────────────────────────────────────────
  const groupName = "Group A";
  const { data: grpRow, error: grpErr } = await (db.from("groups") as any)
    .insert({
      qualification_type_id: qualTypeId,
      level_id: levelId,
      academic_year_id: yearId,
      group_name: groupName,
      is_archived: !isCurrent,
      archived_at: !isCurrent ? new Date(`${yearName.split("/")[1]}-08-01`).toISOString() : null,
    })
    .select("id")
    .single();

  let groupId: string;
  if (grpErr) {
    if (grpErr.code === "23505") {
      const { data: ex } = await (db.from("groups") as any)
        .select("id")
        .eq("qualification_type_id", qualTypeId)
        .eq("level_id", levelId)
        .eq("academic_year_id", yearId)
        .eq("group_name", groupName)
        .single();
      groupId = ex.id;
    } else {
      throw new Error(`groups: ${fmt(grpErr)}`);
    }
  } else {
    groupId = grpRow.id;
  }

  groupIds.push(groupId);

  // ── groups_secrets ─────────────────────────────────────────────────────────
  await (db.from("groups_secrets") as any)
    .upsert({ group_id: groupId, default_password: DEFAULT_PASSWORD }, { onConflict: "group_id", ignoreDuplicates: true });

  // ── Students ───────────────────────────────────────────────────────────────
  const cohortStudentIds: string[] = [];

  for (let i = 0; i < studentCount; i++) {
    const serial = nameOffset + i + 1; // 1-based, globally unique within qual/prog/year
    const nameIdx = (nameOffset + i) % STUDENT_NAMES.length;
    const studentName = STUDENT_NAMES[nameIdx];
    const indexNumber = `${qualTypeCode}/${progCode}/${yearCode}/${String(serial).padStart(3, "0")}`;
    const email = indexNumber.toLowerCase().replace(/\//g, "") + "@ttu.edu.gh";

    const uid = await createAuthUser(email, DEFAULT_PASSWORD, "student", true);
    await ensureProfile(uid, email, "student");

    const { error: stuErr } = await db.from("students").upsert(
      { id: uid, name: studentName, index_number: indexNumber },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (stuErr) throw new Error(`students (${indexNumber}): ${fmt(stuErr)}`);

    cohortStudentIds.push(uid);
    if (!studentUserIds.includes(uid)) studentUserIds.push(uid);
  }

  // ── group_memberships ──────────────────────────────────────────────────────
  // First student is the course rep
  for (let i = 0; i < cohortStudentIds.length; i++) {
    const sid = cohortStudentIds[i];
    const isCourseRep = i === 0;
    const joinedAt = new Date(yearName.split("/")[0] + "-09-05").toISOString();
    const exitedAt = membershipStatus !== "active"
      ? new Date(yearName.split("/")[1] + "-08-01").toISOString()
      : null;

    const { error: gmErr } = await (db.from("group_memberships") as any)
      .insert({
        student_id: sid,
        group_id: groupId,
        is_course_rep: isCourseRep,
        status: membershipStatus,
        joined_at: joinedAt,
        exited_at: exitedAt,
      });

    if (gmErr && gmErr.code !== "23505") {
      // Skip unique violations (re-run safety)
      throw new Error(`group_memberships: ${fmt(gmErr)}`);
    }
  }

  log("👥", `Group: ${qualTypeCode}/${progCode}/${yearCode} ${levelName} ${groupName} — ${cohortStudentIds.length} students`);

  // ── Courses, timetables, sessions, attendance per semester ─────────────────
  const yearSemesters = SEMESTERS_MAP[yearName] ?? [];

  for (const sem of yearSemesters) {
    const semKey = `${yearName}-${sem.name}`;
    const semId = semesterIds[semKey];
    if (!semId) continue;

    const semSuffix = sem.name.includes("First") ? "S1" : "S2";
    const levelShort = levelName.replace("Level ", "L").replace(" ", "");
    const templateKey = `${levelShort}${semSuffix}`;
    const courseTemplates = getCourseTemplate(levelName, sem.name);

    for (let ci = 0; ci < courseTemplates.length; ci++) {
      const ct = courseTemplates[ci];
      const lecturerId = lectureIds[(ci + nameOffset) % lectureIds.length];

      // Make course code unique per group to avoid cross-group constraint violations
      // Schema constraint: UNIQUE (group_id, semester_id, code) — so same code in diff groups is fine
      const { data: crRow, error: crErr } = await (db.from("courses") as any)
        .insert({
          group_id:            groupId,
          semester_id:         semId,
          lecturer_id:         lecturerId,
          lecturer_assigned_at: new Date(sem.start_date).toISOString(),
          name:                ct.name,
          code:                ct.code,
          credit_hours:        ct.credit_hours,
        })
        .select("id")
        .single();

      let courseId: string;
      if (crErr) {
        if (crErr.code === "23505") {
          const { data: ex } = await (db.from("courses") as any)
            .select("id")
            .eq("group_id", groupId)
            .eq("semester_id", semId)
            .eq("code", ct.code)
            .single();
          courseId = ex.id;
        } else {
          throw new Error(`courses (${ct.code}): ${fmt(crErr)}`);
        }
      } else {
        courseId = crRow.id;
      }

      // ── Timetable ────────────────────────────────────────────────────────
      // Two slots per week, spread across Mon–Fri (day 1–5)
      const dayA = (ci % 5) + 1;
      const dayB = ((ci + 2) % 5) + 1;
      const hour = 7 + (ci % 5); // 07:00–11:00
      const venues = ["LH 1", "LH 2", "LH 3", "Lab A", "Lab B", "Seminar Room"];
      const venue = venues[ci % venues.length];

      for (const day of [dayA, dayB]) {
        const startTime = `${String(hour).padStart(2, "0")}:00:00`;
        const endTime   = `${String(hour + 2).padStart(2, "0")}:00:00`;
        await (db.from("timetables") as any)
          .insert({
            course_id: courseId,
            group_id:  groupId,
            day_of_week: day,
            start_time: startTime,
            end_time:   endTime,
            venue,
          });
        // ignore duplicates on re-run
      }

      // ── Sessions (past, all closed) ────────────────────────────────────────
      if (sem.status === "archived") {
        // Generate 10 sessions spread across the semester
        const semStart = new Date(sem.start_date);
        const semEnd   = new Date(sem.end_date);
        const totalDays = Math.floor((semEnd.getTime() - semStart.getTime()) / 86400000);
        const sessionCount = 10;

        for (let si = 0; si < sessionCount; si++) {
          const dayOffset = Math.floor((totalDays / sessionCount) * si) + rnd(0, 3);
          const sessionDate = new Date(semStart.getTime() + dayOffset * 86400000);
          sessionDate.setHours(hour, 0, 0, 0);

          const endDate = new Date(sessionDate.getTime() + 120 * 60000);
          const repId   = cohortStudentIds[0]; // course rep opens sessions

          const { data: ssRow, error: ssErr } = await (db.from("class_sessions") as any)
            .insert({
              course_id:        courseId,
              semester_id:      semId,
              started_at:       sessionDate.toISOString(),
              ended_at:         endDate.toISOString(),
              duration_minutes: 120,
              auto_ended:       false,
              venue,
              created_by:       repId,
            })
            .select("id")
            .single();

          if (ssErr) continue; // skip duplicate on re-run

          const sessionId = ssRow.id;

          // ── Attendance ────────────────────────────────────────────────────
          for (const stuId of cohortStudentIds) {
            // Realistic distribution: 75% present, 10% late, 15% absent
            const roll = Math.random();
            let status: "present" | "late" | "absent";
            if      (roll < 0.75) status = "present";
            else if (roll < 0.85) status = "late";
            else                  status = "absent";

            const checkedInAt = new Date(
              sessionDate.getTime() + rnd(0, status === "late" ? 25 : 10) * 60000
            );

            const { data: attRow, error: attErr } = await (db.from("attendance") as any)
              .insert({
                session_id:   sessionId,
                student_id:   stuId,
                status,
                checked_in_at: checkedInAt.toISOString(),
                geo_verified:  status !== "absent",
                gps_accuracy:  status !== "absent" ? rnd(5, 45) : null,
                selfie_path:   status !== "absent"
                  ? `attendance/${sessionId}/${stuId}.webp`
                  : null,
                device_token:  status !== "absent"
                  ? `dev-${stuId.substring(0, 8)}`
                  : null,
                latitude:  status !== "absent" ? -4.8983 + Math.random() * 0.01 : null,
                longitude: status !== "absent" ?  1.7677 + Math.random() * 0.01 : null,
              })
              .select("id")
              .single();

            if (attErr) continue;

            // ── Dispute (5% of absent records) ──────────────────────────────
            if (status === "absent" && Math.random() < 0.05) {
              const dispStatus = pick(["pending", "approved", "rejected"] as const);
              const adminId = lectureIds[0]; // lecturer resolves disputes
              await (db.from("attendance_disputes") as any)
                .insert({
                  attendance_id: attRow.id,
                  raised_by:     stuId,
                  reason:        pick([
                    "I was present but the system did not record my check-in.",
                    "My phone GPS was malfunctioning during the session.",
                    "I was in the lecture but arrived after the session closed.",
                    "Network issues prevented me from checking in.",
                  ]),
                  status: dispStatus,
                  resolved_by:   dispStatus !== "pending" ? adminId : null,
                  resolved_at:   dispStatus !== "pending"
                    ? new Date(checkedInAt.getTime() + rnd(1, 5) * 86400000).toISOString()
                    : null,
                  resolution_note: dispStatus === "approved"
                    ? "Verified with lecturer — attendance confirmed."
                    : dispStatus === "rejected"
                    ? "No supporting evidence provided. Record stands."
                    : null,
                });
            }
          }

          // ── Notifications (dismissed — session is over) ───────────────────
          for (const stuId of cohortStudentIds) {
            await (db.from("notifications") as any)
              .insert({
                user_id:      stuId,
                title:        "Class Started",
                body:         `Your class has started. Check in now.`,
                is_read:      true,
                is_dismissed: true,
                session_id:   sessionId,
                metadata:     JSON.stringify({ started_at: sessionDate.toISOString() }),
              });
          }
        }

      } else if (sem.status === "active") {
        // Active semester: generate sessions up to ~2 weeks ago (closed),
        // plus one LIVE session for this group's first course (course index 0)
        const semStart = new Date(sem.start_date);
        const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
        const totalDays = Math.floor((twoWeeksAgo.getTime() - semStart.getTime()) / 86400000);
        const sessionCount = Math.max(4, Math.floor(totalDays / 14)); // roughly bi-weekly

        for (let si = 0; si < sessionCount; si++) {
          const dayOffset = Math.floor((totalDays / sessionCount) * si) + rnd(0, 2);
          const sessionDate = new Date(semStart.getTime() + dayOffset * 86400000);
          sessionDate.setHours(hour, 0, 0, 0);
          const endDate = new Date(sessionDate.getTime() + 120 * 60000);
          const repId   = cohortStudentIds[0];

          const { data: ssRow, error: ssErr } = await (db.from("class_sessions") as any)
            .insert({
              course_id:        courseId,
              semester_id:      semId,
              started_at:       sessionDate.toISOString(),
              ended_at:         endDate.toISOString(),
              duration_minutes: 120,
              auto_ended:       false,
              venue,
              created_by:       repId,
            })
            .select("id")
            .single();

          if (ssErr) continue;

          const sessionId = ssRow.id;

          for (const stuId of cohortStudentIds) {
            const roll = Math.random();
            let status: "present" | "late" | "absent";
            if      (roll < 0.75) status = "present";
            else if (roll < 0.85) status = "late";
            else                  status = "absent";

            const checkedInAt = new Date(
              sessionDate.getTime() + rnd(0, status === "late" ? 25 : 10) * 60000
            );

            const { data: attRow, error: attErr } = await (db.from("attendance") as any)
              .insert({
                session_id:    sessionId,
                student_id:    stuId,
                status,
                checked_in_at: checkedInAt.toISOString(),
                geo_verified:  status !== "absent",
                gps_accuracy:  status !== "absent" ? rnd(5, 45) : null,
                selfie_path:   status !== "absent" ? `attendance/${sessionId}/${stuId}.webp` : null,
                device_token:  status !== "absent" ? `dev-${stuId.substring(0, 8)}` : null,
                latitude:  status !== "absent" ? -4.8983 + Math.random() * 0.01 : null,
                longitude: status !== "absent" ?  1.7677 + Math.random() * 0.01 : null,
              })
              .select("id")
              .single();

            if (attErr) continue;

            if (status === "absent" && Math.random() < 0.08) {
              const dispStatus = pick(["pending", "approved", "rejected"] as const);
              const adminId = lectureIds[0];
              await (db.from("attendance_disputes") as any)
                .insert({
                  attendance_id: attRow.id,
                  raised_by:     stuId,
                  reason:        pick([
                    "I was present but the system did not record my check-in.",
                    "My phone GPS was malfunctioning during the session.",
                    "Network issues prevented me from checking in.",
                  ]),
                  status: dispStatus,
                  resolved_by: dispStatus !== "pending" ? adminId : null,
                  resolved_at: dispStatus !== "pending"
                    ? new Date(checkedInAt.getTime() + rnd(1, 3) * 86400000).toISOString()
                    : null,
                  resolution_note: dispStatus === "approved"
                    ? "Verified with lecturer — attendance confirmed."
                    : dispStatus === "rejected"
                    ? "No supporting evidence provided."
                    : null,
                });
            }
          }
        }

        // One LIVE (open) session for course index 0 only
        if (ci === 0) {
          const liveStart = new Date(Date.now() - rnd(15, 40) * 60000); // started 15–40 min ago
          const repId = cohortStudentIds[0];

          const { data: liveRow, error: liveErr } = await (db.from("class_sessions") as any)
            .insert({
              course_id:        courseId,
              semester_id:      semId,
              started_at:       liveStart.toISOString(),
              ended_at:         null,
              duration_minutes: 120,
              auto_ended:       false,
              venue,
              created_by:       repId,
            })
            .select("id")
            .single();

          if (!liveErr) {
            const liveSessionId = liveRow.id;

            // Some students already checked in
            for (const stuId of cohortStudentIds) {
              if (Math.random() < 0.6) {
                const checkedAt = new Date(liveStart.getTime() + rnd(1, 20) * 60000);
                await (db.from("attendance") as any)
                  .insert({
                    session_id:    liveSessionId,
                    student_id:    stuId,
                    status:        "present",
                    checked_in_at: checkedAt.toISOString(),
                    geo_verified:  true,
                    gps_accuracy:  rnd(5, 30),
                    selfie_path:   `attendance/${liveSessionId}/${stuId}.webp`,
                    device_token:  `dev-${stuId.substring(0, 8)}`,
                    latitude:      -4.8983 + Math.random() * 0.01,
                    longitude:      1.7677 + Math.random() * 0.01,
                  });
              } else {
                // Undismissed notification for students who haven't checked in yet
                await (db.from("notifications") as any)
                  .insert({
                    user_id:      stuId,
                    title:        "Class Started",
                    body:         `Your class is now in session. Check in before the window closes.`,
                    is_read:      false,
                    is_dismissed: false,
                    session_id:   liveSessionId,
                    metadata:     JSON.stringify({ started_at: liveStart.toISOString() }),
                  });
              }
            }
          }
        }
      }
    }
  }

  return cohortStudentIds;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — Orchestrate all groups across 3 years
// ─────────────────────────────────────────────────────────────────────────────

async function seedAllGroups(qualTypeIds: string[], levelIds: string[][]) {
  section("PHASE 4 — Groups, Students, Courses, Sessions & Attendance");

  /**
   * We focus on BC/ITS (qualTypeIdx=0) as the primary programme — 4 levels.
   * This gives us the most realistic progression:
   *
   * 2022/2023:  L100 (fresh cohort, 22 batch — year_code 22)
   * 2023/2024:  L100 (23 batch), L200 (22 batch promoted)
   * 2024/2025:  L100 (24 batch), L200 (23 batch), L300 (22 batch)
   *
   * Each cohort is identified by its admission year_code.
   * Students keep their same auth accounts but get new memberships each year.
   *
   * We also seed HN/ITS (qualTypeIdx=1) with a single L100 in each year
   * for breadth.
   */

  // BC/ITS = qualTypeIdx 0, prog ITS
  const BCI = {
    qualTypeId:   qualTypeIds[0],
    qualTypeCode: "BC",
    progCode:     "ITS",
  };

  // HN/ITS = qualTypeIdx 1, prog ITS
  const HNI = {
    qualTypeId:   qualTypeIds[1],
    qualTypeCode: "HN",
    progCode:     "ITS",
  };

  // ── 2022/2023 ──────────────────────────────────────────────────────────────
  section("  ▸ 2022/2023");

  // BC/ITS L100 — 22 batch (will be promoted after this year)
  const bc22Cohort = await seedGroupBatch({
    ...BCI,
    levelId:          levelIds[0][0], // L100
    levelName:        "Level 100",
    yearId:           yearIds["2022/2023"],
    yearName:         "2022/2023",
    yearCode:         "22",
    isCurrent:        false,
    nameOffset:       0,
    studentCount:     22,
    membershipStatus: "promoted",
  });

  // HN/ITS L100 — 22 batch
  await seedGroupBatch({
    ...HNI,
    levelId:          levelIds[1][0], // L100
    levelName:        "Level 100",
    yearId:           yearIds["2022/2023"],
    yearName:         "2022/2023",
    yearCode:         "22",
    isCurrent:        false,
    nameOffset:       22,
    studentCount:     18,
    membershipStatus: "promoted",
  });

  // ── 2023/2024 ──────────────────────────────────────────────────────────────
  section("  ▸ 2023/2024");

  // BC/ITS L200 — 22 batch promoted
  // Same students, new group (L200, 2023/2024)
  // We re-use bc22Cohort student IDs directly
  await seedGroupBatch({
    ...BCI,
    levelId:          levelIds[0][1], // L200
    levelName:        "Level 200",
    yearId:           yearIds["2023/2024"],
    yearName:         "2023/2024",
    yearCode:         "22",   // still their original year code
    isCurrent:        false,
    nameOffset:       0,      // same name pool offset → same students
    studentCount:     22,     // same count (some might have left — realistic enough)
    membershipStatus: "promoted",
  });

  // BC/ITS L100 — 23 batch (fresh)
  const bc23Cohort = await seedGroupBatch({
    ...BCI,
    levelId:          levelIds[0][0], // L100
    levelName:        "Level 100",
    yearId:           yearIds["2023/2024"],
    yearName:         "2023/2024",
    yearCode:         "23",
    isCurrent:        false,
    nameOffset:       40,
    studentCount:     24,
    membershipStatus: "promoted",
  });

  // HN/ITS L200 — 22 HN batch promoted
  await seedGroupBatch({
    ...HNI,
    levelId:          levelIds[1][1], // L200
    levelName:        "Level 200",
    yearId:           yearIds["2023/2024"],
    yearName:         "2023/2024",
    yearCode:         "22",
    isCurrent:        false,
    nameOffset:       22,
    studentCount:     18,
    membershipStatus: "promoted",
  });

  // HN/ITS L100 — 23 batch (fresh HND)
  await seedGroupBatch({
    ...HNI,
    levelId:          levelIds[1][0], // L100
    levelName:        "Level 100",
    yearId:           yearIds["2023/2024"],
    yearName:         "2023/2024",
    yearCode:         "23",
    isCurrent:        false,
    nameOffset:       64,
    studentCount:     20,
    membershipStatus: "promoted",
  });

  // ── 2024/2025 (current) ───────────────────────────────────────────────────
  section("  ▸ 2024/2025 (current)");

  // BC/ITS L300 — 22 batch (now in their 3rd year)
  await seedGroupBatch({
    ...BCI,
    levelId:          levelIds[0][2], // L300
    levelName:        "Level 300",
    yearId:           yearIds["2024/2025"],
    yearName:         "2024/2025",
    yearCode:         "22",
    isCurrent:        true,
    nameOffset:       0,
    studentCount:     20,   // a few attrition
    membershipStatus: "active",
  });

  // BC/ITS L200 — 23 batch (their 2nd year)
  await seedGroupBatch({
    ...BCI,
    levelId:          levelIds[0][1], // L200
    levelName:        "Level 200",
    yearId:           yearIds["2024/2025"],
    yearName:         "2024/2025",
    yearCode:         "23",
    isCurrent:        true,
    nameOffset:       40,
    studentCount:     24,
    membershipStatus: "active",
  });

  // BC/ITS L100 — 24 batch (fresh)
  await seedGroupBatch({
    ...BCI,
    levelId:          levelIds[0][0], // L100
    levelName:        "Level 100",
    yearId:           yearIds["2024/2025"],
    yearName:         "2024/2025",
    yearCode:         "24",
    isCurrent:        true,
    nameOffset:       80,
    studentCount:     26,
    membershipStatus: "active",
  });

  // HN/ITS L300 — 22 HN batch (graduating)
  await seedGroupBatch({
    ...HNI,
    levelId:          levelIds[1][2], // L300
    levelName:        "Level 300",
    yearId:           yearIds["2024/2025"],
    yearName:         "2024/2025",
    yearCode:         "22",
    isCurrent:        true,
    nameOffset:       22,
    studentCount:     16,
    membershipStatus: "completed",
  });

  // HN/ITS L200 — 23 HN batch
  await seedGroupBatch({
    ...HNI,
    levelId:          levelIds[1][1], // L200
    levelName:        "Level 200",
    yearId:           yearIds["2024/2025"],
    yearName:         "2024/2025",
    yearCode:         "23",
    isCurrent:        true,
    nameOffset:       64,
    studentCount:     19,
    membershipStatus: "active",
  });

  // HN/ITS L100 — 24 HN batch (fresh)
  await seedGroupBatch({
    ...HNI,
    levelId:          levelIds[1][0], // L100
    levelName:        "Level 100",
    yearId:           yearIds["2024/2025"],
    yearName:         "2024/2025",
    yearCode:         "24",
    isCurrent:        true,
    nameOffset:       84,
    studentCount:     22,
    membershipStatus: "active",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 5 — Super admin
// ─────────────────────────────────────────────────────────────────────────────

async function seedSuperAdmin() {
  section("PHASE 5 — Super Admin");

  const uid = await createAuthUser("admin@ttu.edu.gh", DEFAULT_PASSWORD, "super_admin");
  await ensureProfile(uid, "admin@ttu.edu.gh", "super_admin");

  const { error } = await db.from("super_admins").upsert(
    { id: uid, name: "System Administrator" },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`super_admins: ${fmt(error)}`);
  log("👑", `Super Admin: System Administrator <admin@ttu.edu.gh>`);

  // Also seed the original admin from seed-users.ts (in case it already exists)
  try {
    const uid2 = await createAuthUser("obboyebossman@gmail.com", DEFAULT_PASSWORD, "super_admin");
    await ensureProfile(uid2, "obboyebossman@gmail.com", "super_admin");
    // trg_enforce_single_super_admin will reject a second row — swallow the error
    await db.from("super_admins").upsert(
      { id: uid2, name: "Obboye Bossman" },
      { onConflict: "id", ignoreDuplicates: true },
    );
    log("👑", `Super Admin: Obboye Bossman <obboyebossman@gmail.com>`);
  } catch (_) {
    log("ℹ", "obboyebossman@gmail.com already present or second super_admin blocked by trigger (expected)");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 6 — Audit log seed events
// ─────────────────────────────────────────────────────────────────────────────

async function seedAuditLog() {
  section("PHASE 6 — Audit Log");

  const events = [
    { action: "academic_year.created",  table_name: "academic_years",  new_data: { name: "2022/2023" } },
    { action: "semester.opened",        table_name: "app_semesters",   new_data: { name: "First Semester 2022/2023" } },
    { action: "semester.closed",        table_name: "app_semesters",   new_data: { name: "First Semester 2022/2023" } },
    { action: "semester.opened",        table_name: "app_semesters",   new_data: { name: "Second Semester 2022/2023" } },
    { action: "semester.closed",        table_name: "app_semesters",   new_data: { name: "Second Semester 2022/2023" } },
    { action: "students.promoted",      table_name: "group_memberships",new_data: { year: "2022/2023 → 2023/2024" } },
    { action: "academic_year.created",  table_name: "academic_years",  new_data: { name: "2023/2024" } },
    { action: "semester.opened",        table_name: "app_semesters",   new_data: { name: "First Semester 2023/2024" } },
    { action: "semester.closed",        table_name: "app_semesters",   new_data: { name: "First Semester 2023/2024" } },
    { action: "semester.opened",        table_name: "app_semesters",   new_data: { name: "Second Semester 2023/2024" } },
    { action: "semester.closed",        table_name: "app_semesters",   new_data: { name: "Second Semester 2023/2024" } },
    { action: "students.promoted",      table_name: "group_memberships",new_data: { year: "2023/2024 → 2024/2025" } },
    { action: "academic_year.created",  table_name: "academic_years",  new_data: { name: "2024/2025" } },
    { action: "semester.opened",        table_name: "app_semesters",   new_data: { name: "First Semester 2024/2025" } },
    { action: "semester.closed",        table_name: "app_semesters",   new_data: { name: "First Semester 2024/2025" } },
    { action: "semester.opened",        table_name: "app_semesters",   new_data: { name: "Second Semester 2024/2025" } },
    { action: "settings.updated",       table_name: "system_settings", new_data: { key: "gps_accuracy_floor_metres", value: "100" } },
  ];

  const actorId = lectureIds[0] ?? null;
  const baseDate = new Date("2022-09-05");

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const ts = new Date(baseDate.getTime() + i * 30 * 86400000); // space 30 days apart
    await (db.from("audit_log") as any).insert({
      actor_id:   actorId,
      action:     ev.action,
      table_name: ev.table_name,
      new_data:   ev.new_data,
      created_at: ts.toISOString(),
    });
  }

  log("📋", `Inserted ${events.length} audit log entries`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

function printSummary() {
  section("SEED COMPLETE");
  console.log(`
  ┌──────────────────────────────────────────────────────┐
  │           ATTEN-SYS — Full Seed Summary              │
  ├──────────────────────────────────────────────────────┤
  │  Academic years  : 3  (2022/23 · 2023/24 · 2024/25) │
  │  Semesters       : 6  (5 archived · 1 active)        │
  │  Lecturers       : ${LECTURERS.length.toString().padEnd(2)}                                │
  │  Groups created  : ${groupIds.length.toString().padEnd(2)} (across all years & levels)    │
  │  Student accounts: ~${studentUserIds.length.toString().padEnd(3)} (some shared across years)  │
  ├──────────────────────────────────────────────────────┤
  │  Default password (all users): ${DEFAULT_PASSWORD.padEnd(20)}  │
  ├──────────────────────────────────────────────────────┤
  │  Super Admin logins:                                 │
  │    admin@ttu.edu.gh                                  │
  │    obboyebossman@gmail.com                           │
  │                                                      │
  │  Sample lecturer:                                    │
  │    kwame.asante@ttu.edu.gh                           │
  │                                                      │
  │  Sample student (BC/ITS/24 L100):                   │
  │    bcits24001@ttu.edu.gh                             │
  │    (must_change_password = true on first login)      │
  └──────────────────────────────────────────────────────┘
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱  ATTEN-SYS — Full 3-Year Seed\n");

  await probe();
  await seedSuperAdmin();
  await seedLecturers();
  const { qualTypeIds, levelIds } = await seedInstitution();
  await seedAcademicYears();
  await seedAllGroups(qualTypeIds, levelIds);
  await seedAuditLog();
  printSummary();
}

main().catch((err) => {
  console.error("\n💥  Fatal error:", fmt(err));
  process.exit(1);
});
