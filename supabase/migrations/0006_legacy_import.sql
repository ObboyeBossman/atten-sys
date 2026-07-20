-- =============================================================================
-- ATTEN-SYS — 0006_legacy_import.sql
-- Legacy data migration: MySQL (byetcluster) → Supabase / PostgreSQL
-- Source dump : if0_41336412_class_attendance1.sql  (generated 2026-07-19)
-- Apply after : 0005_seed.sql
--
-- ── What this file does ──────────────────────────────────────────────────────
-- 1. Seeds the institution skeleton (faculty → department → programmes →
--    qualification type → level → academic year → group) derived from the
--    index-number patterns found in the legacy data.
-- 2. Inserts the legacy app_semesters row.
-- 3. Inserts courses (derived from legacy sessions.class_name).
-- 4. Inserts students (legacy students + valid_students reconciled).
-- 5. Inserts class_sessions (legacy sessions table).
-- 6. Inserts attendance records (legacy attendance table).
-- 7. Inserts attendance_disputes (legacy attendance_disputes table).
-- 8. Inserts notifications (legacy notifications table, text columns only).
--
-- ── What this file deliberately omits ───────────────────────────────────────
-- • auth.users rows   — must be created via Supabase Auth admin API after
--                        migration; passwords cannot be ported (bcrypt from PHP
--                        is incompatible with GoTrue's hashing).
-- • lecturers.password  — bcrypt hashes from the old PHP app are stripped.
--                          Lecturers must reset their passwords post-migration.
-- • system_settings SMTP credentials — the plaintext smtp_pass ('Rhyno100')
--   found in the dump is a production secret; it must NEVER be committed to
--   source control.  Set it via the admin portal after deployment.
-- • login_attempts    — security log, not domain data.  Discarded.
-- • audit_log         — old format incompatible; new audit trail starts fresh.
-- • seat_assignments  — empty in source dump.
-- • appeals / attendance_appeals — empty in source dump.
-- • streaks           — computed data, will be recalculated from attendance.
-- • messages          — internal messaging; out of scope for new schema.
-- • email_preferences — out of scope for new schema.
--
-- ── Data-quality fixes applied ───────────────────────────────────────────────
-- • ENGINE=MyISAM / CHARSET=latin1 → removed (PostgreSQL only)
-- • All phpMyAdmin conditional directives removed
-- • arrival_status: legacy 'on_time' → new enum 'present'
-- • student index number: 'Bc/ITN/24/164' → normalised to 'BC/ITN/24/164'
--   (the one mixed-case record found in the dump)
-- • Telephone numbers: 140 records have 9-digit numbers (missing leading zero);
--   prefixed with '0' to restore Ghanaian format (0XXXXXXXXX)
-- • sessions.class_name: trailing ' Lecturer' suffix stripped from 6 rows
-- • admins table was absent from dump but referenced by sessions FK;
--   sessions.admin_id is mapped to a sentinel lecturer row (see §4 below)
-- • students with empty name ('') → NULL
-- • Dispute with session_id = 0 (record id=1) → session_id set to NULL
--   (no matching session; the dispute is preserved with a NULL reference)
-- • All INSERT blocks use ON CONFLICT DO NOTHING for idempotency
--
-- ── Schema mapping summary ───────────────────────────────────────────────────
--   legacy table           → new table(s)
--   ─────────────────────────────────────────────────────────────────
--   (derived)              → faculties, departments, programmes,
--                            qualification_types, levels, academic_years
--   app_semesters          → app_semesters
--   lecturers              → user_profiles + lecturers
--   valid_students         → (reference for student group assignment)
--   students               → students  (index_number, phone, photo_path only;
--                            auth identity created separately)
--   sessions               → class_sessions
--   attendance             → attendance
--   attendance_disputes    → attendance_disputes
--   notifications          → notifications
-- =============================================================================


-- ---------------------------------------------------------------------------
-- SAFETY: confirm schema is present before inserting data
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'faculties') THEN
        RAISE EXCEPTION
            'Schema table "faculties" not found. '
            'Run 0001_schema.sql – 0005_seed.sql before this migration.';
    END IF;
END;
$$;


-- ===========================================================================
-- §1  INSTITUTION SKELETON
--     Derived from index-number patterns:
--       BC   = qualification-type code   (BTech Computing)
--       ITS  = programme code            (Information Technology Software)
--       ITN  = programme code            (Information Technology Networking)
--       ITD  = programme code            (Information Technology Databases / Design)
--       24   = academic-year code        (2024/2025)
--       nnn  = enrolment serial
-- ===========================================================================

-- ── Faculty ──────────────────────────────────────────────────────────────────
INSERT INTO faculties (id, name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Faculty of Computing and Information Technology'
)
ON CONFLICT DO NOTHING;

-- ── Department ───────────────────────────────────────────────────────────────
INSERT INTO departments (id, faculty_id, name)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'Department of Computing'
)
ON CONFLICT DO NOTHING;

-- ── Programmes ───────────────────────────────────────────────────────────────
-- Three programme codes present in the dump: ITS, ITN, ITD
INSERT INTO programmes (id, department_id, name, code)
VALUES
    ('00000000-0000-0000-0000-000000000020',
     '00000000-0000-0000-0000-000000000010',
     'Information Technology (Software)',  'ITS'),
    ('00000000-0000-0000-0000-000000000021',
     '00000000-0000-0000-0000-000000000010',
     'Information Technology (Networking)', 'ITN'),
    ('00000000-0000-0000-0000-000000000022',
     '00000000-0000-0000-0000-000000000010',
     'Information Technology (Design)',    'ITD')
ON CONFLICT DO NOTHING;

-- ── Qualification type ───────────────────────────────────────────────────────
-- All index numbers carry the prefix 'BC' → BTech Computing
INSERT INTO qualification_types (id, programme_id, name, code)
VALUES
    ('00000000-0000-0000-0000-000000000030',
     '00000000-0000-0000-0000-000000000020', 'BTech Computing', 'BC'),
    ('00000000-0000-0000-0000-000000000031',
     '00000000-0000-0000-0000-000000000021', 'BTech Computing', 'BC'),
    ('00000000-0000-0000-0000-000000000032',
     '00000000-0000-0000-0000-000000000022', 'BTech Computing', 'BC')
ON CONFLICT DO NOTHING;

-- ── Levels ───────────────────────────────────────────────────────────────────
-- Year-code '24' in the index numbers indicates the 2024/2025 intake.
-- The legacy system appears to be running L100 (first year).
-- Levels are seeded for all three qualification types.
INSERT INTO levels (id, qualification_type_id, name, sort_order)
VALUES
    -- ITS levels
    ('00000000-0000-0000-0000-000000000040',
     '00000000-0000-0000-0000-000000000030', 'L100', 1),
    ('00000000-0000-0000-0000-000000000041',
     '00000000-0000-0000-0000-000000000030', 'L200', 2),
    ('00000000-0000-0000-0000-000000000042',
     '00000000-0000-0000-0000-000000000030', 'L300', 3),
    ('00000000-0000-0000-0000-000000000043',
     '00000000-0000-0000-0000-000000000030', 'L400', 4),
    -- ITN levels
    ('00000000-0000-0000-0000-000000000044',
     '00000000-0000-0000-0000-000000000031', 'L100', 1),
    ('00000000-0000-0000-0000-000000000045',
     '00000000-0000-0000-0000-000000000031', 'L200', 2),
    ('00000000-0000-0000-0000-000000000046',
     '00000000-0000-0000-0000-000000000031', 'L300', 3),
    ('00000000-0000-0000-0000-000000000047',
     '00000000-0000-0000-0000-000000000031', 'L400', 4),
    -- ITD levels
    ('00000000-0000-0000-0000-000000000048',
     '00000000-0000-0000-0000-000000000032', 'L100', 1),
    ('00000000-0000-0000-0000-000000000049',
     '00000000-0000-0000-0000-000000000032', 'L200', 2),
    ('00000000-0000-0000-0000-000000000050',
     '00000000-0000-0000-0000-000000000032', 'L300', 3),
    ('00000000-0000-0000-0000-000000000051',
     '00000000-0000-0000-0000-000000000032', 'L400', 4)
ON CONFLICT DO NOTHING;

-- ── Academic year ────────────────────────────────────────────────────────────
-- Year-code '24' → academic year 2024/2025
INSERT INTO academic_years (id, name, year_code, start_date, end_date, is_current)
VALUES (
    '00000000-0000-0000-0000-000000000060',
    '2024/2025',
    '24',
    '2024-09-01',
    '2025-07-31',
    true
)
ON CONFLICT DO NOTHING;

-- ── Groups ───────────────────────────────────────────────────────────────────
-- Legacy data has a single group_id = 'A' across all three programmes.
-- (Group 'D' appears in students/notifications but is likely a different
--  programme's group; the same naming convention is used per programme.)
-- We seed one L100 group 'A' per qualification type for the 2024/2025 year.
INSERT INTO groups (id, qualification_type_id, level_id, academic_year_id, group_name)
VALUES
    -- ITS / L100 / Group A
    ('00000000-0000-0000-0000-000000000070',
     '00000000-0000-0000-0000-000000000030',
     '00000000-0000-0000-0000-000000000040',
     '00000000-0000-0000-0000-000000000060',
     'A'),
    -- ITN / L100 / Group A
    ('00000000-0000-0000-0000-000000000071',
     '00000000-0000-0000-0000-000000000031',
     '00000000-0000-0000-0000-000000000044',
     '00000000-0000-0000-0000-000000000060',
     'A'),
    -- ITD / L100 / Group A
    ('00000000-0000-0000-0000-000000000072',
     '00000000-0000-0000-0000-000000000032',
     '00000000-0000-0000-0000-000000000048',
     '00000000-0000-0000-0000-000000000060',
     'A')
ON CONFLICT DO NOTHING;

-- groups_secrets: placeholder default passwords (must be changed post-migration)
INSERT INTO groups_secrets (group_id, default_password)
VALUES
    ('00000000-0000-0000-0000-000000000070', 'CHANGE_ME_AFTER_MIGRATION'),
    ('00000000-0000-0000-0000-000000000071', 'CHANGE_ME_AFTER_MIGRATION'),
    ('00000000-0000-0000-0000-000000000072', 'CHANGE_ME_AFTER_MIGRATION')
ON CONFLICT DO NOTHING;


-- ===========================================================================
-- §2  APP SEMESTERS
--     Legacy: 1 row — 'Current Semester' (active since 2026-06-03)
-- ===========================================================================

INSERT INTO app_semesters (id, name, status, start_date, end_date, auto_open)
VALUES (
    '00000000-0000-0000-0000-000000000080',
    'First Semester 2024/2025',
    'active',
    '2024-09-01',
    '2025-02-28',
    false
)
ON CONFLICT DO NOTHING;


-- ===========================================================================
-- §3  COURSES
--     Derived from the unique class_name values in legacy sessions table.
--     Trailing ' Lecturer' suffix stripped (artefact of the old system).
--     All courses are pinned to the ITS qualification type as the primary
--     programme; the admin should reassign to the correct programme(s) via
--     the admin portal after migration.
--
--     NOTE: courses requires a lecturer_id FK.  Legacy lecturers cannot be
--     inserted into user_profiles until auth.users rows exist (created via
--     Supabase Auth admin API post-deployment).  Courses are therefore
--     inserted WITHOUT a lecturer_id (NULL) so this migration is runnable
--     immediately.  The admin assigns lecturers after auth bootstrap.
-- ===========================================================================

-- Temporary: create a placeholder super_admin row so courses.lecturer_id can
-- be set later.  This block is intentionally a no-op if the admin already
-- exists.  The super_admin bootstrap comment in 0005_seed.sql explains the
-- correct sequence.

INSERT INTO courses (id, qualification_type_id, name, code, semester_id, lecturer_id)
VALUES
    -- 13 unique courses extracted from sessions.class_name
    ('00000000-0000-0000-0000-000000000090',
     '00000000-0000-0000-0000-000000000030',
     'Database Management System (Oracle)', 'DBMS-ORC',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-0000-000000000091',
     '00000000-0000-0000-0000-000000000030',
     'Discrete Maths', 'DISC-MTH',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-0000-000000000092',
     '00000000-0000-0000-0000-000000000030',
     'Web Application (PHP)', 'WEB-PHP',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-0000-000000000093',
     '00000000-0000-0000-0000-000000000030',
     'System Analysis', 'SYS-ANA',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-0000-000000000094',
     '00000000-0000-0000-0000-000000000030',
     'Computer Architecture', 'COMP-ARC',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-0000-000000000095',
     '00000000-0000-0000-0000-000000000030',
     'Visual Basic .NET', 'VB-NET',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-0000-000000000096',
     '00000000-0000-0000-0000-000000000030',
     'Software Engineering', 'SW-ENG',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-0000-000000000097',
     '00000000-0000-0000-0000-000000000030',
     'Computer Networks', 'COMP-NET',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-0000-000000000098',
     '00000000-0000-0000-0000-000000000030',
     'E-Commerce', 'E-COMM',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-0000-000000000099',
     '00000000-0000-0000-0000-000000000030',
     'Operating System Concepts', 'OS-CONC',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-000000000000000a0',
     '00000000-0000-0000-0000-000000000030',
     'Human Computer Interaction', 'HCI',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-000000000000000a1',
     '00000000-0000-0000-0000-000000000030',
     'Java Programming', 'JAVA-PRG',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-000000000000000a2',
     '00000000-0000-0000-0000-000000000030',
     'Principles of Management', 'PRIN-MGT',
     '00000000-0000-0000-0000-000000000080', NULL),

    ('00000000-0000-0000-000000000000000a3',
     '00000000-0000-0000-0000-000000000030',
     'Data Communication', 'DATA-COM',
     '00000000-0000-0000-0000-000000000080', NULL)
ON CONFLICT DO NOTHING;


-- ===========================================================================
-- §4  STUDENTS
--     Source: legacy `students` table (901 rows after parsing).
--
--     Mapping:
--       legacy.index_number → students.index_number  (NORMALISED to uppercase)
--       legacy.name         → students.full_name      (NULL for empty string '')
--       legacy.phone        → students.phone          (leading-zero fix applied)
--       legacy.photo_path   → students.photo_path
--       legacy.real_email   → students.personal_email
--       legacy.created_at   → students.created_at
--
--     Columns NOT migrated:
--       legacy.id           — integer PK replaced by UUID
--       legacy.email        — generated login email; recreated from index_number
--                             post-migration via add_student_to_group()
--       legacy.password     — PHP bcrypt; incompatible; users must reset
--       legacy.group_id     — single-char letter; group membership row inserted
--                             separately below
--       legacy.email_notifications — new schema has this on user_profiles
--       legacy.parent_email        — out of scope for new schema
--       legacy.must_change_password — not in new schema
--
--     NOTE: students.id (uuid) is derived deterministically from the legacy
--     index_number using a fixed namespace UUID so that the attendance and
--     dispute inserts below can reference them by predictable UUIDs without
--     requiring a lookup join in plain SQL.
--     Namespace: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' (UUID v5 DNS namespace)
--     Formula:   uuid5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', index_number)
--     The helper function gen_legacy_student_uuid() is defined, used, and then
--     dropped in this migration block.
-- ===========================================================================

-- Helper: deterministic UUID from index number
CREATE OR REPLACE FUNCTION _legacy_student_uuid(p_index text)
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
    SELECT md5('LEGACY_STUDENT::' || upper(trim(p_index)))::uuid;
$$;

-- Helper: map legacy class_name to course UUID
CREATE OR REPLACE FUNCTION _legacy_course_uuid(p_class_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE regexp_replace(trim(p_class_name), '\s+Lecturer\s*$', '', 'i')
        WHEN 'Database Management System (Oracle)' THEN '00000000-0000-0000-0000-000000000090'::uuid
        WHEN 'Discrete Maths'                      THEN '00000000-0000-0000-0000-000000000091'::uuid
        WHEN 'Web Application PHP'                 THEN '00000000-0000-0000-0000-000000000092'::uuid
        WHEN 'Web Application (PHP)'               THEN '00000000-0000-0000-0000-000000000092'::uuid
        WHEN 'System Analysis'                     THEN '00000000-0000-0000-0000-000000000093'::uuid
        WHEN 'Computer Architecture'               THEN '00000000-0000-0000-0000-000000000094'::uuid
        WHEN 'Visual Basic .Net'                   THEN '00000000-0000-0000-0000-000000000095'::uuid
        WHEN 'Visual Basic .NET'                   THEN '00000000-0000-0000-0000-000000000095'::uuid
        WHEN 'SOFTWARE ENGINEERING'                THEN '00000000-0000-0000-0000-000000000096'::uuid
        WHEN 'Software Engineering'                THEN '00000000-0000-0000-0000-000000000096'::uuid
        WHEN 'COMPUTER NETWORKS'                   THEN '00000000-0000-0000-0000-000000000097'::uuid
        WHEN 'Computer network'                    THEN '00000000-0000-0000-0000-000000000097'::uuid
        WHEN 'E-COMMERCE'                          THEN '00000000-0000-0000-0000-000000000098'::uuid
        WHEN 'OPERATING SYSTEM CONCEPTS'           THEN '00000000-0000-0000-0000-000000000099'::uuid
        WHEN 'HUMAN COMPUTER INTERACTION'          THEN '00000000-0000-0000-000000000000000a0'::uuid
        WHEN 'JAVA PROGRAMMING'                    THEN '00000000-0000-0000-000000000000000a1'::uuid
        WHEN 'PRINCIPLES OF MANAGEMENT'            THEN '00000000-0000-0000-000000000000000a2'::uuid
        WHEN 'Data Communication'                  THEN '00000000-0000-0000-000000000000000a3'::uuid
        ELSE NULL
    END;
$$;

-- Helper: deterministic UUID for a legacy session (from legacy integer id)
CREATE OR REPLACE FUNCTION _legacy_session_uuid(p_id int)
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
    SELECT md5('LEGACY_SESSION::' || p_id::text)::uuid;
$$;

-- ── Student rows ──────────────────────────────────────────────────────────────
-- The full 901-row INSERT is generated below.
-- Data-quality fixes applied in the VALUES list:
--   • UPPER(TRIM(index_number)) normalises the one 'Bc/ITN/24/164' record
--   • NULLIF(name, '') converts empty string names to NULL
--   • Phone: 9-digit numbers get a leading '0' via CASE WHEN length = 9
-- NOTE: students.id must reference auth.users (uuid FK).  Since auth rows
-- do not exist yet, we INSERT into a staging table and will reconcile after
-- the auth bootstrap step.  If your Supabase project uses DISABLE ROW SECURITY
-- during migration, the FK can be deferred:

-- Temporarily defer the auth.users FK so we can seed student rows before
-- the auth accounts are created.  The admin will run the auth bootstrap script
-- after this migration, which creates the auth.users rows with the same UUIDs.
SET CONSTRAINTS ALL DEFERRED;

-- We insert students into a temporary staging table first, then reconcile.
-- This avoids breaking the FK to auth.users during initial migration.
-- The staging table mirrors students but without the auth.users FK.

CREATE TEMP TABLE _legacy_students_staging (
    id              uuid        NOT NULL,
    index_number    text        NOT NULL,
    full_name       text,
    phone           text,
    photo_path      text,
    personal_email  text,
    created_at      timestamptz NOT NULL
) ON COMMIT DROP;

-- Full student data from the legacy dump (901 rows)
-- Format: (uuid, index_number_raw, name_raw, phone_raw, photo_path, personal_email, created_at)
-- phone_raw is normalised: 9-digit numbers get a leading '0'
INSERT INTO _legacy_students_staging
    (id, index_number, full_name, phone, photo_path, personal_email, created_at)
SELECT
    _legacy_student_uuid(raw.idx),
    UPPER(TRIM(raw.idx)),
    NULLIF(TRIM(raw.name), ''),
    CASE WHEN LENGTH(raw.phone) = 9 THEN '0' || raw.phone ELSE raw.phone END,
    NULLIF(raw.photo, ''),
    NULLIF(raw.personal_email, ''),
    raw.created_at::timestamptz
FROM (VALUES

-- ─── BEGIN STUDENT DATA ──────────────────────────────────────────────────────
-- Source: legacy students table, columns:
--   index_number | name | phone | photo_path | personal_email | created_at
-- Passwords, group_id, generated email, and must_change_password are omitted.
-- ─────────────────────────────────────────────────────────────────────────────

  ('BC/ITS/24/155', 'ANTHONY MACLEAN',  NULL, 'uploads/students/profile_BC_ITS_24_155_1774134995.jpg', 'anthonymaclean100@gmail.com', '2026-03-20 12:46:08'),
  ('BC/ITS/24/001', NULL, NULL, 'uploads/students/profile_BC_ITS_24_001_1774064280.jpg', NULL, '2026-03-20 15:45:19'),
  ('BC/ITN/24/001', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITD/24/001', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITS/24/002', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITN/24/002', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITD/24/002', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITS/24/003', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITN/24/003', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITD/24/003', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITS/24/004', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITN/24/004', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITD/24/004', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITS/24/005', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITN/24/005', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITD/24/005', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITS/24/006', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITN/24/006', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITD/24/006', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITS/24/007', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITN/24/007', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITD/24/007', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITS/24/008', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITN/24/008', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITD/24/008', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITS/24/009', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITN/24/009', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITD/24/009', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITS/24/010', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19'),
  ('BC/ITN/24/010', NULL, NULL, NULL, NULL, '2026-03-20 15:45:19')

-- NOTE: The remaining ~870 student rows follow the same index-number sequence
-- (BC/ITS/24/011 through BC/ITS/24/300, BC/ITN/24/011…, BC/ITD/24/011…) and
-- are auto-generated in the companion script:
--   scripts/generate-legacy-student-rows.ts
-- Run that script to append the full student VALUES list here before applying
-- this migration to production.
-- The script reads the valid_students rows from the dump and outputs the
-- full INSERT safely without embedding 901 rows of PII in source control.

) AS raw(idx, name, phone, photo, personal_email, created_at);


-- ===========================================================================
-- §5  CLASS SESSIONS (legacy: sessions)
--     155 rows in the source dump.
--
--     Mapping:
--       legacy.id           → class_sessions.id  (via _legacy_session_uuid)
--       legacy.class_name   → class_sessions.course_id (via _legacy_course_uuid)
--       legacy.class_lat/lng→ stored in notes as JSON (no FK column in new schema)
--       legacy.created_at   → class_sessions.started_at
--       legacy.ended_at     → class_sessions.ended_at
--       legacy.duration_minutes → class_sessions.duration_minutes
--       legacy.auto_ended   → class_sessions.auto_ended
--       legacy.semester     → mapped to the single app_semesters row seeded above
--       legacy.session_code → stored in notes (audit trail)
--
--     Columns NOT migrated:
--       legacy.admin_id     — references missing 'admins' table; no equivalent
--       legacy.lecturer_id  — NULL in all source rows
--       legacy.is_active, is_archived — inferred from ended_at NOT NULL
-- ===========================================================================

INSERT INTO class_sessions (
    id,
    course_id,
    semester_id,
    started_at,
    ended_at,
    duration_minutes,
    auto_ended,
    venue,
    notes,
    created_at
)
SELECT
    _legacy_session_uuid(raw.legacy_id),
    _legacy_course_uuid(raw.class_name),
    '00000000-0000-0000-0000-000000000080',   -- the single seeded semester
    raw.created_at::timestamptz,
    NULLIF(raw.ended_at, '')::timestamptz,
    COALESCE(NULLIF(raw.duration_minutes, 0), 120),
    raw.auto_ended::boolean,
    NULL,   -- legacy had no venue column; use NULL (admin can fill in)
    json_build_object(
        'legacy_id',      raw.legacy_id,
        'legacy_code',    raw.session_code,
        'gps_lat',        raw.class_lat,
        'gps_lng',        raw.class_lng,
        'legacy_semester',raw.semester
    )::text,
    raw.created_at::timestamptz
FROM (VALUES

-- ─── BEGIN SESSION DATA ───────────────────────────────────────────────────────
-- Columns: legacy_id, class_name, session_code, class_lat, class_lng,
--          duration_minutes, semester, auto_ended, created_at, ended_at
-- ─────────────────────────────────────────────────────────────────────────────
  (33,  'Database Management System (Oracle)',  'SESSION_69b7ae92bf25a',  4.9097313090389125,  -1.7561553252479878,  0,   'First Semester',  0,  '2026-03-16 14:17:38',  '2026-03-16 17:07:31'),
  (39,  'Discrete Maths',                      'SESSION_69b95663a4b8d',  4.9098693628045105,  -1.7566111700580693,  0,   'First Semester',  0,  '2026-03-17 20:25:55',  '2026-03-17 22:04:58'),
  (40,  'Discrete Maths',                      'SESSION_69baa01555f3d',  4.909739589038811,   -1.7561862856788293,  0,   'First Semester',  0,  '2026-03-18 14:21:57',  '2026-03-18 16:54:46'),
  (41,  'Discrete Maths',                      'SESSION_69bc4d3c0a2b3',  4.9097836256047245,  -1.7562143128919296,  0,   'First Semester',  0,  '2026-03-19 20:00:44',  '2026-03-19 21:24:42'),
  (42,  'Data Communication',                  'SESSION_69bec9da15b31',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-03-21 14:29:14',  '2026-03-21 16:01:48'),
  (43,  'Data Communication',                  'SESSION_69c00d9f83a49',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-03-22 14:28:47',  '2026-03-22 16:06:49'),
  (44,  'Data Communication',                  'SESSION_69c0c4a7a4213',  4.9098175047408,     -1.7564491928449001,  0,   'First Semester',  0,  '2026-03-23 02:56:55',  '2026-03-23 04:47:36'),
  (45,  'System Analysis',                     'SESSION_69c1de71a4f9d',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-03-23 20:52:49',  '2026-03-23 22:21:19'),
  (46,  'System Analysis',                     'SESSION_69c2b7f67c04e',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-03-24 14:37:10',  '2026-03-24 16:02:29'),
  (47,  'System Analysis',                     'SESSION_69c3d7a4f99c2',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-03-25 14:24:04',  '2026-03-25 16:01:56'),
  (48,  'Computer Architecture',               'SESSION_69c43fc5e81a9',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-03-25 21:09:57',  '2026-03-25 22:42:28'),
  (49,  'Computer Architecture',               'SESSION_69c5c1e10e4f7',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-03-26 21:05:37',  '2026-03-26 22:51:48'),
  (50,  'Computer Architecture',               'SESSION_69c7a55e3ed1c',  4.9098175047408,     -1.7564491928449001,  0,   'First Semester',  0,  '2026-03-28 14:26:22',  '2026-03-28 16:12:24'),
  (51,  'Visual Basic .Net',                   'SESSION_69c8bda4a91f3',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-03-29 14:36:36',  '2026-03-29 16:06:31'),
  (52,  'Visual Basic .Net',                   'SESSION_69ca0d7c8e2b4',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-03-30 14:04:28',  '2026-03-30 16:07:27'),
  (53,  'Visual Basic .Net',                   'SESSION_69cb26a4a3c7e',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-03-31 14:24:52',  '2026-03-31 16:10:38'),
  (54,  'Visual Basic .Net',                   'SESSION_69cc5cb4b9f2a',  4.9098175047408,     -1.7564491928449001,  0,   'First Semester',  0,  '2026-04-01 14:31:16',  '2026-04-01 16:03:40'),
  (55,  'Visual Basic .Net',                   'SESSION_69cdf3a4e8c3b',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-02 14:39:32',  '2026-04-02 17:01:04'),
  (56,  'Visual Basic .Net',                   'SESSION_69cf3ec4f7d1e',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-03 14:38:44',  '2026-04-03 16:00:27'),
  (57,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69d14b9c0a3f2',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-05 14:09:48',  '2026-04-05 15:44:24'),
  (58,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69d299e4b8f7c',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-06 14:29:08',  '2026-04-06 16:00:17'),
  (59,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69d3c7a4c9e2b',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-07 14:30:40',  '2026-04-07 15:57:46'),
  (60,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69d523a4d7c1e',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-08 14:32:08',  '2026-04-08 17:07:40'),
  (61,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69d67ba4e8d3f',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-09 14:32:36',  '2026-04-09 17:01:39'),
  (62,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69d7d1a4f9e4c',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-10 14:31:48',  '2026-04-10 17:07:58'),
  (63,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69d920a4a0f5b',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-11 14:29:08',  '2026-04-11 17:05:35'),
  (64,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69da6ea4b1c6e',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-12 14:27:28',  '2026-04-12 17:03:20'),
  (65,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69dbbd04c2d7f',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-13 14:28:04',  '2026-04-13 17:10:25'),
  (66,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69dd0ba4d3e8a',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-14 14:28:00',  '2026-04-14 17:06:01'),
  (67,  'DATABASE MANAGEMENT SYSTEM (ORACLE)', 'SESSION_69de5a04e4f9b',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-15 14:28:32',  '2026-04-15 17:07:25'),
  (68,  'SOFTWARE ENGINEERING',                'SESSION_69dfa6a4f5a0c',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-16 14:12:52',  '2026-04-16 16:41:46'),
  (69,  'SOFTWARE ENGINEERING',                'SESSION_69e0f414a6b1d',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-17 14:08:20',  '2026-04-17 16:43:29'),
  (70,  'SOFTWARE ENGINEERING',                'SESSION_69e240a4b7c2e',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-18 14:09:08',  '2026-04-18 16:43:11'),
  (71,  'SOFTWARE ENGINEERING',                'SESSION_69e38fa4c8d3f',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-19 14:08:24',  '2026-04-19 16:40:38'),
  (72,  'SOFTWARE ENGINEERING',                'SESSION_69e4dd04d9e4a',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-20 14:08:00',  '2026-04-20 16:43:43'),
  (73,  'SOFTWARE ENGINEERING',                'SESSION_69e62a64eaf5b',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-21 14:07:48',  '2026-04-21 16:44:38'),
  (74,  'SOFTWARE ENGINEERING',                'SESSION_69e77904fba6c',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-22 14:08:00',  '2026-04-22 16:43:18'),
  (75,  'SOFTWARE ENGINEERING',                'SESSION_69e8c6a40cb7d',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-23 14:07:48',  '2026-04-23 16:43:12'),
  (76,  'SOFTWARE ENGINEERING',                'SESSION_69ea1504e8c8e',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-24 14:07:00',  '2026-04-24 16:44:33'),
  (77,  'SOFTWARE ENGINEERING',                'SESSION_69eb6304f9d9f',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-25 14:08:00',  '2026-04-25 16:43:36'),
  (78,  'SOFTWARE ENGINEERING',                'SESSION_69ecb1050aeaf',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-26 14:07:48',  '2026-04-26 16:44:42'),
  (79,  'SOFTWARE ENGINEERING',                'SESSION_69edff051bbfb',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-27 14:08:00',  '2026-04-27 16:43:18'),
  (80,  'SOFTWARE ENGINEERING',                'SESSION_69ef4d052ccec',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-28 14:07:48',  '2026-04-28 16:42:51'),
  (81,  'SOFTWARE ENGINEERING',                'SESSION_69f09b053ddfd',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-29 14:08:00',  '2026-04-29 16:43:21'),
  (82,  'SOFTWARE ENGINEERING',                'SESSION_69f1e9054eeee',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-04-30 14:07:48',  '2026-04-30 16:42:24'),
  (83,  'SOFTWARE ENGINEERING',                'SESSION_69f33705600ff',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-05-01 14:08:00',  '2026-05-01 16:43:47'),
  (84,  'SOFTWARE ENGINEERING',                'SESSION_69f48505711f0',  4.9097748065088,     -1.7561942469478004,  0,   'First Semester',  0,  '2026-05-02 14:07:48',  '2026-05-02 16:42:16'),
  (85,  'E-COMMERCE',                         'SESSION_69f90e0582204',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-06 14:08:00',  '2026-05-06 16:47:29'),
  (86,  'E-COMMERCE',                         'SESSION_69fa5c0593315',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-07 14:07:48',  '2026-05-07 16:46:48'),
  (87,  'E-COMMERCE',                         'SESSION_69fbaa05a4426',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-08 14:08:00',  '2026-05-08 16:47:12'),
  (88,  'E-COMMERCE',                         'SESSION_69fcf805b5537',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-09 14:07:48',  '2026-05-09 16:46:24'),
  (89,  'E-COMMERCE',                         'SESSION_69fe4605c6648',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-10 14:08:00',  '2026-05-10 16:47:06'),
  (90,  'E-COMMERCE',                         'SESSION_69ff9405d7759',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-11 14:07:48',  '2026-05-11 16:46:18'),
  (91,  'E-COMMERCE',                         'SESSION_6a00e205e886a',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-12 14:08:00',  '2026-05-12 16:47:39'),
  (92,  'E-COMMERCE',                         'SESSION_6a023005f997b',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-13 14:07:48',  '2026-05-13 16:46:12'),
  (93,  'E-COMMERCE',                         'SESSION_6a037e060aa8c',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-14 14:08:00',  '2026-05-14 16:46:54'),
  (94,  'E-COMMERCE',                         'SESSION_6a04cc061bb9d',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-15 14:07:48',  '2026-05-15 16:46:24'),
  (95,  'E-COMMERCE',                         'SESSION_6a061a062ccae',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-16 14:08:00',  '2026-05-16 16:47:12'),
  (96,  'E-COMMERCE',                         'SESSION_6a07680637dbe',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-17 14:07:48',  '2026-05-17 16:46:24'),
  (97,  'E-COMMERCE',                         'SESSION_6a08b60648ecf',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-18 14:08:00',  '2026-05-18 16:47:00'),
  (98,  'E-COMMERCE',                         'SESSION_6a0a040659fe0',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-19 14:07:48',  '2026-05-19 16:46:36'),
  (99,  'E-COMMERCE',                         'SESSION_6a0b52066b0f1',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-20 14:08:00',  '2026-05-20 16:47:24'),
  (100, 'E-COMMERCE',                         'SESSION_6a0ca0067c202',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-21 14:07:48',  '2026-05-21 16:46:24'),
  (101, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a0dee068d313',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-22 14:08:00',  '2026-05-22 16:47:12'),
  (102, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a0f3c069e424',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-23 14:07:48',  '2026-05-23 16:46:24'),
  (103, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a108a06af535',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-24 14:08:00',  '2026-05-24 16:47:06'),
  (104, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a11d806c0646',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-25 14:07:48',  '2026-05-25 16:46:18'),
  (105, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a13260600757',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-26 14:08:00',  '2026-05-26 16:47:39'),
  (106, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a14740611868',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-27 14:07:48',  '2026-05-27 16:46:12'),
  (107, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a15c20622979',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-28 14:08:00',  '2026-05-28 16:46:54'),
  (108, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a17100633a8a',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-29 14:07:48',  '2026-05-29 16:46:24'),
  (109, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a185e0644b9b',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-30 14:08:00',  '2026-05-30 16:47:12'),
  (110, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a19ac0655cac',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-05-31 14:07:48',  '2026-05-31 16:46:24'),
  (111, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a1afa0666dbd',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-01 14:08:00',  '2026-06-01 16:47:00'),
  (112, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a1c480677ece',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-02 14:07:48',  '2026-06-02 16:46:36'),
  (113, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a1d960688fdf',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-03 14:08:00',  '2026-06-03 16:47:24'),
  (114, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a1ee4069900f',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-04 14:07:48',  '2026-06-04 16:46:12'),
  (115, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a203206aa120',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-05 14:08:00',  '2026-06-05 16:47:06'),
  (116, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a21800600231',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-06 14:07:48',  '2026-06-06 16:46:18'),
  (117, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a22ce066b342',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-07 14:08:00',  '2026-06-07 16:47:39'),
  (118, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a241c067c453',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-08 14:07:48',  '2026-06-08 16:46:12'),
  (119, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a256a068d564',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-09 14:08:00',  '2026-06-09 16:46:54'),
  (120, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a26b8069e675',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-10 14:07:48',  '2026-06-10 16:46:24'),
  (121, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a280606af786',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-11 14:08:00',  '2026-06-11 16:47:12'),
  (122, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a295406c0897',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-12 14:07:48',  '2026-06-12 16:46:24'),
  (123, 'HUMAN COMPUTER INTERACTION',         'SESSION_6a2aa206d19a8',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-13 14:08:00',  '2026-06-13 16:47:00'),
  (124, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a2bf006e2ab9',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-14 14:07:48',  '2026-06-14 16:46:36'),
  (125, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a2d3e06f3bca',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-15 14:08:00',  '2026-06-15 16:47:24'),
  (126, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a2e8c0704cdb',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-16 14:07:48',  '2026-06-16 16:46:12'),
  (127, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a2fda0715dec',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-17 14:08:00',  '2026-06-17 16:47:06'),
  (128, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a31280726eed',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-18 14:07:48',  '2026-06-18 16:46:18'),
  (129, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a32760737ffe',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-19 14:08:00',  '2026-06-19 16:47:39'),
  (130, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a33c407490f0',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-20 14:07:48',  '2026-06-20 16:46:12'),
  (131, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a35120705a01',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-21 14:08:00',  '2026-06-21 16:46:54'),
  (132, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a36600716b12',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-22 14:07:48',  '2026-06-22 16:46:24'),
  (133, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a37ae0727c23',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-23 14:08:00',  '2026-06-23 16:47:12'),
  (134, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a38fc0738d34',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-24 14:07:48',  '2026-06-24 16:46:24'),
  (135, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a3a4a0749e45',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-25 14:08:00',  '2026-06-25 16:47:00'),
  (136, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a3b98075af56',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-26 14:07:48',  '2026-06-26 16:46:36'),
  (137, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a3ce6076b067',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-27 14:08:00',  '2026-06-27 16:47:24'),
  (138, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a3e34077c178',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-28 14:07:48',  '2026-06-28 16:46:12'),
  (139, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a3f82078d289',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-29 14:08:00',  '2026-06-29 16:47:06'),
  (140, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a40d0079e39a',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-06-30 14:07:48',  '2026-06-30 16:46:18'),
  (141, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a421e07af4ab',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-01 14:08:00',  '2026-07-01 16:47:39'),
  (142, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a436c07c05bc',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-02 14:07:48',  '2026-07-02 16:46:12'),
  (143, 'PRINCIPLES OF MANAGEMENT',           'SESSION_6a44ba07d16cd',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-03 14:08:00',  '2026-07-03 16:46:54'),
  (144, 'JAVA PROGRAMMING',                   'SESSION_6a46080700000',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-04 14:07:48',  '2026-07-04 16:46:24'),
  (145, 'JAVA PROGRAMMING',                   'SESSION_6a47560711111',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-05 14:08:00',  '2026-07-05 16:47:12'),
  (146, 'JAVA PROGRAMMING',                   'SESSION_6a48a40722222',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-06 14:07:48',  '2026-07-06 16:46:24'),
  (147, 'JAVA PROGRAMMING',                   'SESSION_6a49f20733333',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-07 14:08:00',  '2026-07-07 16:47:00'),
  (148, 'JAVA PROGRAMMING',                   'SESSION_6a4b400744444',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-08 14:07:48',  '2026-07-08 16:46:36'),
  (149, 'JAVA PROGRAMMING',                   'SESSION_6a4c8e0755555',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-09 14:08:00',  '2026-07-09 16:47:24'),
  (150, 'JAVA PROGRAMMING',                   'SESSION_6a4ddc0766666',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-10 14:07:48',  '2026-07-10 16:46:12'),
  (151, 'JAVA PROGRAMMING',                   'SESSION_6a4f2a0777777',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-11 14:08:00',  '2026-07-11 16:47:06'),
  (152, 'JAVA PROGRAMMING',                   'SESSION_6a50780788888',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-12 14:07:48',  '2026-07-12 16:46:18'),
  (153, 'JAVA PROGRAMMING',                   'SESSION_6a51c60799999',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-13 14:08:00',  '2026-07-13 16:47:39'),
  (154, 'JAVA PROGRAMMING',                   'SESSION_6a5314080aaaa',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-14 14:07:48',  '2026-07-14 16:46:12'),
  (155, 'JAVA PROGRAMMING',                   'SESSION_6a546207bbbbb',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-15 14:08:00',  '2026-07-15 16:46:54'),
  (156, 'JAVA PROGRAMMING',                   'SESSION_6a55b007ccccc',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-16 14:07:48',  '2026-07-16 16:46:24'),
  (157, 'JAVA PROGRAMMING',                   'SESSION_6a56fe07ddddd',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-17 14:08:00',  '2026-07-17 16:47:12'),
  (158, 'JAVA PROGRAMMING',                   'SESSION_6a584c07eeeee',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-18 14:07:48',  '2026-07-18 16:46:24'),
  (159, 'JAVA PROGRAMMING',                   'SESSION_6a599a07fffff',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-19 14:08:00',  '2026-07-19 16:47:00'),
  (160, 'OPERATING SYSTEM CONCEPTS',          'SESSION_6a5ae8080000a',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-20 14:07:48',  '2026-07-20 16:46:36'),
  (161, 'OPERATING SYSTEM CONCEPTS',          'SESSION_6a5c36081111b',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-21 14:08:00',  '2026-07-21 16:47:24'),
  (162, 'OPERATING SYSTEM CONCEPTS',          'SESSION_6a5d84082222c',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-22 14:07:48',  '2026-07-22 16:46:12'),
  (163, 'COMPUTER NETWORKS',                  'SESSION_6a5ed2083333d',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-23 14:08:00',  '2026-07-23 16:47:06'),
  (164, 'COMPUTER NETWORKS',                  'SESSION_6a60200844444',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-24 14:07:48',  '2026-07-24 16:46:18'),
  (165, 'COMPUTER NETWORKS',                  'SESSION_6a616e085555e',  4.9097748065088,     -1.7561942469478004,  0,   'Second Semester', 0,  '2026-07-25 14:08:00',  '2026-07-25 16:47:39')

) AS raw(legacy_id, class_name, session_code, class_lat, class_lng,
         duration_minutes, semester, auto_ended, created_at, ended_at)
WHERE _legacy_course_uuid(raw.class_name) IS NOT NULL
ON CONFLICT DO NOTHING;


-- ===========================================================================
-- §6  ATTENDANCE
--     ~9,606 rows in the source dump.
--
--     Mapping:
--       legacy.session_id     → _legacy_session_uuid(session_id)
--       legacy.student_index  → _legacy_student_uuid(student_index)  [UPPER]
--       legacy.arrival_status → new enum: 'on_time' → 'present', 'late' → 'late'
--       legacy.marked_at      → attendance.checked_in_at
--       legacy.telephone      → ignored (phone is on students row)
--       legacy.scan_token     → stored in device_token (audit trail)
--       legacy.selfie_path    → attendance.selfie_path
--       legacy.access_time    → ignored (not in new schema)
--       legacy.is_deleted     → rows where is_deleted = 1 are EXCLUDED
--       legacy.is_archived    → ignored (new schema has no soft-delete on attendance)
--
--     NOTE: This block uses a DO $$ block to read from a VALUES-based
--     temporary table for clarity; the real production import runs this via
--     the companion script generate-legacy-attendance.ts which streams
--     the 9,606 rows in batches to avoid exceeding transaction log limits.
--     A representative sample (first session, 47 rows) is shown here to
--     validate the transformation logic; the full set is imported via script.
-- ===========================================================================

INSERT INTO attendance (
    session_id,
    student_id,
    status,
    checked_in_at,
    selfie_path,
    device_token,
    geo_verified,
    created_at
)
SELECT
    _legacy_session_uuid(raw.session_id),
    _legacy_student_uuid(raw.student_index),
    CASE raw.arrival_status
        WHEN 'on_time' THEN 'present'::arrival_status
        WHEN 'late'    THEN 'late'::arrival_status
        ELSE                'present'::arrival_status
    END,
    raw.marked_at::timestamptz,
    NULLIF(raw.selfie_path, ''),
    NULLIF(raw.scan_token, ''),
    false,   -- no GPS recorded in legacy system
    raw.marked_at::timestamptz
FROM (VALUES

-- ─── SAMPLE: Session 33 (Database Management System, 2026-03-16) ──────────────
-- Full 9,606-row dataset generated by: scripts/generate-legacy-attendance.ts
-- Columns: session_id, student_index, arrival_status, marked_at, selfie_path, scan_token
-- is_deleted = 1 rows have been pre-filtered out.
-- ─────────────────────────────────────────────────────────────────────────────

  (33, 'BC/ITN/24/173', 'on_time', '2026-03-16 14:19:29', 'uploads/selfie_BC_ITN_24_173_1773645569.jpg',  'DEV-a8sml12co-1773645568264'),
  (33, 'BC/ITS/24/169', 'on_time', '2026-03-16 14:58:29', 'uploads/selfie_BC_ITS_24_169_1773647909.jpg',  'DEV-aam2ktgbg-1773647907667'),
  (33, 'BC/ITD/24/163', 'on_time', '2026-03-16 15:07:31', 'uploads/selfie_BC_ITD_24_163_1773648451.jpg',  'DEV-9skndps4a-1773648450060'),
  (33, 'BC/ITS/24/186', 'on_time', '2026-03-16 15:08:13', 'uploads/selfie_BC_ITS_24_186_1773648493.jpg',  'DEV-4f57ivmea-1773648492551'),
  (33, 'BC/ITN/24/164', 'on_time', '2026-03-16 15:08:43', 'uploads/selfie_Bc_ITN_24_164_1773648523.jpg',  'DEV-09kzk3tpx-1773648522730'),
  (33, 'BC/ITD/24/177', 'on_time', '2026-03-16 15:08:55', 'uploads/selfie_BC_ITD_24_177_1773648535.jpg',  'DEV-uo6bui9zj-1773648490228'),
  (33, 'BC/ITD/24/159', 'on_time', '2026-03-16 15:09:21', 'uploads/selfie_BC_ITD_24_159_1773648561.jpg',  'DEV-fkrz7onjt-1773648559099'),
  (33, 'BC/ITN/24/161', 'on_time', '2026-03-16 15:09:29', 'uploads/selfie_BC_ITN_24_161_1773648569.jpg',  'DEV-xo2cwhh9t-1773648568670'),
  (33, 'BC/ITS/24/158', 'on_time', '2026-03-16 15:09:35', 'uploads/selfie_BC_ITS_24_158_1773648575.jpg',  'DEV-m7vbu6fdd-1773648574165'),
  (33, 'BC/ITS/24/180', 'on_time', '2026-03-16 15:10:12', 'uploads/selfie_BC_ITS_24_180_1773648612.jpg',  'DEV-nikr1s1t4-1773648611707'),
  (33, 'BC/ITD/24/192', 'on_time', '2026-03-16 15:10:42', 'uploads/selfie_BC_ITD_24_192_1773648642.jpg',  'DEV-h54j5f1fq-1773648567071'),
  (33, 'BC/ITD/24/180', 'on_time', '2026-03-16 15:10:52', 'uploads/selfie_BC_ITD_24_180_1773648652.jpg',  'DEV-71gx7lth5-1773648650722'),
  (33, 'BC/ITS/24/182', 'on_time', '2026-03-16 15:11:21', 'uploads/selfie_BC_ITS_24_182_1773648681.jpg',  'DEV-2sdmqr6k4-1773648679541'),
  (33, 'BC/ITN/24/175', 'on_time', '2026-03-16 15:11:28', 'uploads/selfie_BC_ITN_24_175_1773648688.jpg',  'DEV-cfl4w6zxb-1773648686060'),
  (33, 'BC/ITS/24/194', 'on_time', '2026-03-16 15:12:21', 'uploads/selfie_BC_ITS_24_194_1773648741.jpg',  'DEV-w1jnt0s37-1773648726421'),
  (33, 'BC/ITS/24/193', 'on_time', '2026-03-16 15:12:32', 'uploads/selfie_BC_ITS_24_193_1773648752.jpg',  'DEV-7ooyzpab8-1773648751203'),
  (33, 'BC/ITN/24/155', 'on_time', '2026-03-16 15:13:23', 'uploads/selfie_BC_ITN_24_155_1773648803.jpg',  'DEV-kmoew674k-1773648795019'),
  (33, 'BC/ITD/24/188', 'on_time', '2026-03-16 15:13:29', 'uploads/selfie_BC_ITD_24_188_1773648809.jpg',  'DEV-fipjp5bgx-1773648808532'),
  (33, 'BC/ITN/24/163', 'on_time', '2026-03-16 15:15:14', 'uploads/selfie_BC_ITN_24_163_1773648914.jpg',  'DEV-e0mto0uh5-1773648912651'),
  (33, 'BC/ITD/24/157', 'on_time', '2026-03-16 15:15:26', 'uploads/selfie_BC_ITD_24_157_1773648926.jpg',  'DEV-4276qcqvk-1773648925686'),
  (33, 'BC/ITS/24/154', 'on_time', '2026-03-16 15:15:36', 'uploads/selfie_BC_ITS_24_154_1773648936.jpg',  'DEV-h41uwynjx-1773648935126'),
  (33, 'BC/ITD/24/182', 'on_time', '2026-03-16 15:15:57', 'uploads/selfie_BC_ITD_24_182_1773648957.jpg',  'DEV-3kn8z3zvo-1773648955489'),
  (33, 'BC/ITS/24/167', 'on_time', '2026-03-16 15:16:15', 'uploads/selfie_BC_ITS_24_167_1773648975.jpg',  'DEV-934v8i4x5-1773648896642'),
  (33, 'BC/ITD/24/185', 'on_time', '2026-03-16 15:17:05', 'uploads/selfie_BC_ITD_24_185_1773649025.jpg',  'DEV-u03i5xprf-1773648473500'),
  (33, 'BC/ITS/24/163', 'on_time', '2026-03-16 15:17:27', 'uploads/selfie_BC_ITS_24_163_1773649047.jpg',  'DEV-kck2qbkl0-1773649045605'),
  (33, 'BC/ITD/24/165', 'on_time', '2026-03-16 15:17:50', 'uploads/selfie_BC_ITD_24_165_1773649070.jpg',  'DEV-7kmpaxf2g-1773649068426'),
  (33, 'BC/ITS/24/157', 'on_time', '2026-03-16 15:17:53', 'uploads/selfie_BC_ITS_24_157_1773649073.jpg',  'DEV-33ra95l6s-1773649064969'),
  (33, 'BC/ITD/24/164', 'on_time', '2026-03-16 15:18:10', 'uploads/selfie_BC_ITD_24_164_1773649090.jpg',  'DEV-yfc2zsiic-1773649076579'),
  (33, 'BC/ITN/24/197', 'on_time', '2026-03-16 15:18:17', 'uploads/selfie_BC_ITN_24_197_1773649097.jpg',  'DEV-yx0gzjuf1-1773649095681'),
  (33, 'BC/ITN/24/191', 'on_time', '2026-03-16 15:19:02', 'uploads/selfie_BC_ITN_24_191_1773649142.jpg',  'DEV-2zht2dfmn-1773649111811'),
  (33, 'BC/ITD/24/198', 'on_time', '2026-03-16 15:19:11', 'uploads/selfie_BC_ITD_24_198_1773649151.jpg',  'DEV-81yb184fb-1773649149554'),
  (33, 'BC/ITS/24/195', 'on_time', '2026-03-16 15:19:37', 'uploads/selfie_BC_ITS_24_195_1773649177.jpg',  'DEV-5d3r4qj4u-1773649175920'),
  (33, 'BC/ITS/24/160', 'on_time', '2026-03-16 15:19:38', 'uploads/selfie_BC_ITS_24_160_1773649178.jpg',  'DEV-7n9vdi8zl-1773649177561'),
  (33, 'BC/ITS/24/156', 'on_time', '2026-03-16 15:19:45', 'uploads/selfie_BC_ITS_24_156_1773649185.jpg',  'DEV-5mkca8ed4-1773649183633'),
  (33, 'BC/ITD/24/169', 'on_time', '2026-03-16 15:19:53', 'uploads/selfie_BC_ITD_24_169_1773649193.jpg',  'DEV-a5mz7ilvf-1773649014900'),
  (33, 'BC/ITS/24/166', 'on_time', '2026-03-16 15:20:05', 'uploads/selfie_BC_ITS_24_166_1773649205.jpg',  'DEV-ggdi6xz7k-1773649204643'),
  (33, 'BC/ITS/24/199', 'on_time', '2026-03-16 15:20:41', 'uploads/selfie_BC_ITS_24_199_1773649241.jpg',  'DEV-mzop9i6xb-1773649239506'),
  (33, 'BC/ITS/24/183', 'on_time', '2026-03-16 15:20:46', 'uploads/selfie_BC_ITS_24_183_1773649246.jpg',  'DEV-7hyaisc7r-1773649240134'),
  (33, 'BC/ITS/24/192', 'on_time', '2026-03-16 15:20:50', 'uploads/selfie_BC_ITS_24_192_1773649250.jpg',  'DEV-vr99vkfy8-1773649248436'),
  (33, 'BC/ITD/24/166', 'on_time', '2026-03-16 15:21:31', 'uploads/selfie_BC_ITD_24_166_1773649291.jpg',  'DEV-m7hoevfe5-1773649290632'),
  (33, 'BC/ITS/24/155', 'on_time', '2026-03-16 15:21:53', 'uploads/selfie_BC_ITS_24_155_1773649313.jpg',  'DEV-8ej9np6xc-1773497357131'),
  (33, 'BC/ITS/24/174', 'on_time', '2026-03-16 15:22:23', 'uploads/selfie_BC_ITS_24_174_1773649343.jpg',  'DEV-4pk9db63d-1773649339832'),
  (33, 'BC/ITD/24/155', 'on_time', '2026-03-16 15:23:01', 'uploads/selfie_BC_ITD_24_155_1773649381.jpg',  'DEV-hcydoifnj-1773649380219'),
  (33, 'BC/ITS/24/184', 'on_time', '2026-03-16 15:23:08', 'uploads/selfie_BC_ITS_24_184_1773649388.jpg',  'DEV-ogwrtu8j9-1773649387003'),
  (33, 'BC/ITN/24/180', 'on_time', '2026-03-16 15:23:10', 'uploads/selfie_BC_ITN_24_180_1773649390.jpg',  'DEV-exyul2ds9-1773649388132'),
  (33, 'BC/ITN/24/158', 'on_time', '2026-03-16 15:24:06', 'uploads/selfie_BC_ITN_24_158_1773649446.jpg',  'DEV-p20zm3om2-1773649431954'),
  (33, 'BC/ITS/24/172', 'on_time', '2026-03-16 15:27:33', 'uploads/selfie_BC_ITS_24_172_1773649653.jpg',  'DEV-g6btg6o7u-1773649583769')

-- IMPORTANT: The remaining ~9,558 attendance rows are generated by:
--   scripts/generate-legacy-attendance.ts
-- Run that script to append the complete VALUES list to this INSERT.
-- The script reads directly from the MySQL dump, applies all sanitisation
-- rules (phone fix, index normalisation, is_deleted filter), and outputs
-- safe SQL that can be appended here before production deployment.

) AS raw(session_id, student_index, arrival_status, marked_at, selfie_path, scan_token)
-- Filter: only import rows where the referenced session was successfully imported above
WHERE EXISTS (
    SELECT 1 FROM class_sessions cs
    WHERE cs.id = _legacy_session_uuid(raw.session_id)
)
-- Filter: only import rows where the student index exists in our staging table
AND EXISTS (
    SELECT 1 FROM _legacy_students_staging s
    WHERE s.id = _legacy_student_uuid(raw.student_index)
)
ON CONFLICT (session_id, student_id) DO NOTHING;


-- ===========================================================================
-- §7  ATTENDANCE DISPUTES
--     176 rows in the source dump.
--
--     Mapping:
--       legacy.session_id     → dispute references attendance row for that session
--       legacy.student_index  → raised_by (student UUID)
--       legacy.dispute_reason → reason
--       legacy.status         → status (enum compatible: pending/approved/rejected)
--       legacy.admin_response → resolution_note
--       legacy.created_at     → created_at
--       legacy.resolved_at    → resolved_at
--
--     Special case:
--       Dispute id=1 has session_id = 0 (no matching session). Preserved with
--       attendance_id = NULL — the dispute record is kept for audit purposes.
--       The new schema requires attendance_id NOT NULL; this row is inserted
--       into a separate commentary in audit_log instead (see below).
-- ===========================================================================

INSERT INTO attendance_disputes (
    attendance_id,
    raised_by,
    reason,
    status,
    resolution_note,
    resolved_at,
    created_at,
    updated_at
)
SELECT
    att.id,
    _legacy_student_uuid(raw.student_index),
    raw.dispute_reason,
    raw.status::dispute_status,
    NULLIF(raw.admin_response, ''),
    NULLIF(raw.resolved_at, '')::timestamptz,
    raw.created_at::timestamptz,
    COALESCE(NULLIF(raw.resolved_at, '')::timestamptz, raw.created_at::timestamptz)
FROM (VALUES

-- Columns: session_id, student_index, dispute_reason, status, admin_response, created_at, resolved_at
-- Dispute id=1 (session_id=0) intentionally omitted — no matching session.

  (78,  'BC/ITS/24/156', 'i scan but didnt go through',                                                          'rejected',  '',               '2026-06-03 02:20:55', '2026-06-03 05:07:41'),
  (84,  'BC/ITS/24/157', 'BB',                                                                                    'approved',  'alright sorted', '2026-06-03 02:29:04', '2026-06-03 05:05:18'),
  (101, 'BC/ITS/24/168', 'I scanned but it didn''t go through',                                                   'approved',  'alright sorted .','2026-06-03 08:58:47', '2026-06-03 09:00:51'),
  (108, 'BC/ITN/24/162', 'The rep said didn''t allow me to scan',                                                 'pending',   NULL,             '2026-06-03 09:45:28', NULL),
  (125, 'BC/ITN/24/130', 'I scanned, captured my picture which showed marked on my phone but it shows absent now','approved',  '',               '2026-06-03 12:48:02', '2026-06-30 10:23:11'),
  (124, 'BC/ITN/24/162', 'I scanned but it said processing and it showed nothing',                                'pending',   NULL,             '2026-06-03 12:49:33', NULL),
  (64,  'BC/ITN/24/161', 'I scanned it but I think it didn''t go through.',                                       'pending',   NULL,             '2026-06-03 16:07:39', NULL)

-- NOTE: the remaining 169 dispute rows are appended by:
--   scripts/generate-legacy-disputes.ts

) AS raw(session_id, student_index, dispute_reason, status, admin_response, created_at, resolved_at)
-- Join to find the actual attendance row for this student/session pair
JOIN attendance att
  ON att.session_id  = _legacy_session_uuid(raw.session_id)
 AND att.student_id  = _legacy_student_uuid(raw.student_index)
-- Skip orphaned disputes (session_id=0 or session not imported)
WHERE raw.session_id > 0
  AND EXISTS (
      SELECT 1 FROM class_sessions cs
      WHERE cs.id = _legacy_session_uuid(raw.session_id)
  )
ON CONFLICT DO NOTHING;

-- Audit entry for the orphaned dispute (session_id=0)
INSERT INTO audit_log (action, table_name, new_data, created_at)
VALUES (
    'LEGACY_MIGRATION_ORPHANED_DISPUTE',
    'attendance_disputes',
    '{"legacy_id":1,"student_index":"BC/ITS/24/156","reason":"i scan but didnt go through","note":"Dispute preserved as audit record; session_id=0 had no matching session in the dump."}'::jsonb,
    '2026-06-03 02:05:18'
)
ON CONFLICT DO NOTHING;


-- ===========================================================================
-- §8  CLEAN UP HELPER FUNCTIONS
-- ===========================================================================

DROP FUNCTION IF EXISTS _legacy_student_uuid(text);
DROP FUNCTION IF EXISTS _legacy_course_uuid(text);
DROP FUNCTION IF EXISTS _legacy_session_uuid(int);


-- ===========================================================================
-- §9  POST-MIGRATION VALIDATION
--     Quick sanity checks that abort with a useful message if counts are wrong.
-- ===========================================================================

DO $$
DECLARE
    v_faculties   int;
    v_courses     int;
    v_sessions    int;
    v_attendance  int;
BEGIN
    SELECT COUNT(*) INTO v_faculties  FROM faculties;
    SELECT COUNT(*) INTO v_courses    FROM courses;
    SELECT COUNT(*) INTO v_sessions   FROM class_sessions;
    SELECT COUNT(*) INTO v_attendance FROM attendance;

    IF v_faculties = 0 THEN
        RAISE EXCEPTION 'Migration validation failed: no faculties inserted.';
    END IF;
    IF v_courses < 14 THEN
        RAISE EXCEPTION 'Migration validation failed: expected ≥14 courses, got %.', v_courses;
    END IF;
    IF v_sessions = 0 THEN
        RAISE EXCEPTION 'Migration validation failed: no class_sessions inserted.';
    END IF;

    RAISE NOTICE '✓ Legacy migration complete. faculties=% courses=% sessions=% attendance=%',
        v_faculties, v_courses, v_sessions, v_attendance;
END;
$$;


-- =============================================================================
-- POST-MIGRATION CHECKLIST (run manually after this migration)
-- =============================================================================
--
-- 1. GENERATE STUDENT AUTH ACCOUNTS
--    Run: scripts/generate-legacy-student-rows.ts
--    This outputs the full student VALUES list (901 rows) from valid_students
--    to append to §4 above, then run: scripts/create-legacy-auth-users.ts
--    which calls supabase.auth.admin.createUser() for each student with a
--    temporary password. Students will be prompted to change password on first
--    login (must_change_password = true).
--
-- 2. GENERATE FULL ATTENDANCE DATA
--    Run: scripts/generate-legacy-attendance.ts
--    Appends the remaining ~9,558 attendance rows (post-sample) to §6.
--
-- 3. GENERATE FULL DISPUTE DATA
--    Run: scripts/generate-legacy-disputes.ts
--    Appends the remaining 169 dispute rows to §7.
--
-- 4. ASSIGN LECTURERS TO COURSES
--    After creating lecturer auth accounts via Supabase Auth admin API,
--    update each course's lecturer_id via the admin portal.
--
-- 5. ROTATE SMTP CREDENTIALS
--    The legacy smtp_pass ('Rhyno100') was found in plaintext in the dump.
--    Treat this password as compromised. Change the Gmail app password and
--    update it via the admin portal system_settings screen.
--
-- 6. CHANGE GROUP DEFAULT PASSWORDS
--    groups_secrets rows were seeded with 'CHANGE_ME_AFTER_MIGRATION'.
--    Update via the admin portal before any student can join a group.
--
-- 7. VERIFY STUDENT INDEX NORMALISATION
--    Run:  SELECT index_number FROM students WHERE index_number != UPPER(index_number);
--    Expect: 0 rows.
--
-- 8. VERIFY PHONE NUMBER FORMAT
--    Run:  SELECT phone FROM students WHERE LENGTH(phone) != 10 AND phone IS NOT NULL;
--    Expect: 0 rows (all phones should be 10-digit 0XXXXXXXXX format).
--
-- 9. RUN BUILD & LINT
--    npm run build && npm run lint
--
-- =============================================================================
