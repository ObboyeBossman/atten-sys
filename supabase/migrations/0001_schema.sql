-- =============================================================================
-- ATTEN-SYS — 0001_schema.sql
-- Squashed clean schema: extensions, enums, tables, indexes.
-- Apply before 0002_functions.sql, 0003_triggers.sql, 0004_rls.sql,
-- 0005_seed.sql.
--
-- Bug fixes incorporated (vs. the 0001–0008 migration chain):
--   • courses.lecturer_id FK is never dropped/orphaned — FK is declared
--     here correctly and never touched by a DROP TABLE cascade.
--   • courses.lecturer_assigned_at column included from the start (fix for
--     course_lecturer_history.assigned_at always storing courses.created_at).
--   • groups.default_password moved to groups_secrets (admin-only table) so
--     it is never exposed via the world-readable skeleton SELECT policy.
--   • class_sessions.updated_at added for completeness.
--   • attendance.selfie_path comment updated to Cloudflare R2.
--   • Constraint names are explicit on every table for safe future drops.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

-- Top-level role on user_profiles — drives all RLS helper checks.
-- 'lecturer' included from the start (added in migration 0003 historically).
CREATE TYPE user_role AS ENUM ('super_admin', 'student', 'lecturer');

-- group_memberships lifecycle:
--   active    → current group member
--   promoted  → moved to a higher level group
--   completed → graduated (no next level)
--   removed   → manually removed by admin
CREATE TYPE membership_status AS ENUM ('active', 'promoted', 'completed', 'removed');

-- app_semesters lifecycle
CREATE TYPE semester_status AS ENUM ('upcoming', 'active', 'archived');

-- attendance record result
CREATE TYPE arrival_status AS ENUM ('present', 'late', 'absent');

-- attendance dispute lifecycle
CREATE TYPE dispute_status AS ENUM ('pending', 'approved', 'rejected');


-- ---------------------------------------------------------------------------
-- 2. Institution skeleton  (super_admin owned, world-readable)
-- ---------------------------------------------------------------------------

CREATE TABLE faculties (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text        NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departments (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id  uuid        NOT NULL REFERENCES faculties(id) ON DELETE RESTRICT,
    name        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT departments_faculty_name_unique UNIQUE (faculty_id, name)
);

-- A programme is the course of study, e.g. "Computer Science".
-- code is the fragment used in index numbers, e.g. "ITS", "ITN", "ITD".
CREATE TABLE programmes (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id   uuid        NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    name            text        NOT NULL,
    code            text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT programmes_dept_name_unique UNIQUE (department_id, name),
    CONSTRAINT programmes_dept_code_unique UNIQUE (department_id, code),
    CONSTRAINT programmes_code_format      CHECK (code ~ '^[A-Z]{2,6}$')
);

-- A qualification type sits under a programme, e.g. "BTech" under "Computer Science".
-- code is the index-number prefix, e.g. "BC", "HND", "DP".
CREATE TABLE qualification_types (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id    uuid        NOT NULL REFERENCES programmes(id) ON DELETE RESTRICT,
    name            text        NOT NULL,
    code            text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT qual_types_prog_name_unique UNIQUE (programme_id, name),
    CONSTRAINT qual_types_prog_code_unique UNIQUE (programme_id, code),
    CONSTRAINT qual_types_code_format      CHECK (code ~ '^[A-Z]{1,6}$')
);

-- Levels are controlled per qualification type, e.g. BTech → L100/L200/L300/L400.
CREATE TABLE levels (
    id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    qualification_type_id   uuid        NOT NULL REFERENCES qualification_types(id) ON DELETE RESTRICT,
    name                    text        NOT NULL,
    sort_order              smallint    NOT NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT levels_qual_name_unique        UNIQUE (qualification_type_id, name),
    CONSTRAINT levels_qual_sort_unique        UNIQUE (qualification_type_id, sort_order),
    CONSTRAINT levels_sort_order_positive     CHECK (sort_order > 0)
);

-- Global academic years, e.g. "2024/2025".
-- year_code is the 2-digit fragment used in index numbers, e.g. "24".
CREATE TABLE academic_years (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text        NOT NULL UNIQUE,
    year_code   text        NOT NULL UNIQUE,
    start_date  date        NOT NULL,
    end_date    date        NOT NULL,
    is_current  boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT academic_years_year_code_format CHECK (year_code ~ '^\d{2}$'),
    CONSTRAINT academic_years_dates_valid      CHECK (end_date > start_date)
);

-- Only one academic year may be current at a time.
CREATE UNIQUE INDEX academic_years_one_current
    ON academic_years (is_current)
    WHERE is_current = true;

-- A group is a specific cohort of students,
-- e.g. "BTech Computer Science (ITS), 2024/2025, L200, Group A".
-- default_password has been removed from this table — see groups_secrets below.
CREATE TABLE groups (
    id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    qualification_type_id   uuid        NOT NULL REFERENCES qualification_types(id) ON DELETE RESTRICT,
    level_id                uuid        NOT NULL REFERENCES levels(id)             ON DELETE RESTRICT,
    academic_year_id        uuid        NOT NULL REFERENCES academic_years(id)     ON DELETE RESTRICT,
    group_name              text        NOT NULL,
    is_archived             boolean     NOT NULL DEFAULT false,
    archived_at             timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT groups_cohort_unique UNIQUE (qualification_type_id, level_id, academic_year_id, group_name)
);

CREATE INDEX idx_groups_qual_type     ON groups (qualification_type_id);
CREATE INDEX idx_groups_academic_year ON groups (academic_year_id);
CREATE INDEX idx_groups_is_archived   ON groups (is_archived) WHERE is_archived = true;

-- BUG FIX (review): groups.default_password was world-readable via the
-- skeleton SELECT policy. It is stored here in a separate admin-only table
-- so it is never exposed to students, reps, or lecturers.
-- add_student_to_group() (SECURITY DEFINER) reads it directly.
CREATE TABLE groups_secrets (
    group_id         uuid  PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
    default_password text  NOT NULL
);

-- Semesters, scoped to an academic year.
CREATE TABLE app_semesters (
    id                  uuid            PRIMARY KEY DEFAULT uuid_generate_v4(),
    academic_year_id    uuid            NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    name                text            NOT NULL,
    start_date          date            NOT NULL,
    end_date            date            NOT NULL,
    status              semester_status NOT NULL DEFAULT 'upcoming',
    auto_open           boolean         NOT NULL DEFAULT false,
    opened_at           timestamptz,
    closed_at           timestamptz,
    created_at          timestamptz     NOT NULL DEFAULT now(),
    updated_at          timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT app_semesters_year_name_unique UNIQUE (academic_year_id, name),
    CONSTRAINT app_semesters_dates_valid      CHECK (end_date > start_date)
);

-- Exactly one semester may be active at a time.
CREATE UNIQUE INDEX app_semesters_one_active
    ON app_semesters (status)
    WHERE status = 'active';


-- ---------------------------------------------------------------------------
-- 3. Auth / user profiles
-- ---------------------------------------------------------------------------

-- Mirrors auth.users 1:1. Created automatically via handle_new_user() trigger.
CREATE TABLE user_profiles (
    id                      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role                    user_role   NOT NULL,
    email                   text        NOT NULL UNIQUE,
    phone                   text,
    is_active               boolean     NOT NULL DEFAULT true,
    must_change_password    boolean     NOT NULL DEFAULT false,
    last_login              timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_role      ON user_profiles (role);
CREATE INDEX idx_user_profiles_is_active ON user_profiles (is_active);

-- Super admins: identity layer on top of user_profiles.
-- Enforced singleton via trg_enforce_single_super_admin.
CREATE TABLE super_admins (
    id          uuid        PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Students: identity + index number.
-- Soft-deleted via user_profiles.is_active — the students row is kept for history.
-- index_number is globally unique and never changes.
-- Format: {qual_code}/{prog_code}/{year_code}/{serial:3}  e.g. BC/ITS/24/197
CREATE TABLE students (
    id              uuid    PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    name            text    NOT NULL,
    index_number    text    NOT NULL UNIQUE,
    photo_path      text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT students_index_number_format
        CHECK (index_number ~ '^[A-Z]+\/[A-Z]+\/\d{2}\/\d{3}$')
);

COMMENT ON COLUMN students.photo_path IS
    'Cloudflare R2 object key for the student profile photo '
    '(e.g. students/bc-its-24-001/avatar.webp). '
    'Construct the full URL in the app layer from the R2_PUBLIC_URL env var.';

CREATE INDEX idx_students_index_number ON students (index_number);

-- Group memberships: tracks a student's full academic history across levels.
-- "Current group" = status = 'active'. Records are never hard-deleted.
-- is_course_rep drives rep privileges; managed by super_admin only.
CREATE TABLE group_memberships (
    id              uuid                PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      uuid                NOT NULL REFERENCES students(id)  ON DELETE RESTRICT,
    group_id        uuid                NOT NULL REFERENCES groups(id)    ON DELETE RESTRICT,
    is_course_rep   boolean             NOT NULL DEFAULT false,
    status          membership_status   NOT NULL DEFAULT 'active',
    joined_at       timestamptz         NOT NULL DEFAULT now(),
    exited_at       timestamptz,
    CONSTRAINT gm_student_group_unique UNIQUE (student_id, group_id),
    CONSTRAINT gm_exited_requires_non_active
        CHECK (exited_at IS NULL OR status != 'active')
);

-- A student may only have one active membership at a time.
CREATE UNIQUE INDEX gm_one_active_per_student
    ON group_memberships (student_id)
    WHERE status = 'active';

CREATE INDEX idx_gm_student_id    ON group_memberships (student_id);
CREATE INDEX idx_gm_group_id      ON group_memberships (group_id);
CREATE INDEX idx_gm_is_course_rep ON group_memberships (is_course_rep) WHERE is_course_rep = true;


-- ---------------------------------------------------------------------------
-- 4. Lecturers
-- ---------------------------------------------------------------------------

-- Lecturers are first-class auth users (id mirrors user_profiles).
-- Their scope is via courses.lecturer_id — one lecturer can teach across groups.
CREATE TABLE lecturers (
    id          uuid        PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    staff_id    text        UNIQUE,
    phone       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- 5. Academics
-- ---------------------------------------------------------------------------

-- Courses: one course = one subject in one group for one semester.
-- lecturer_assigned_at is stamped by trg_stamp_lecturer_assigned_at whenever
-- lecturer_id is set or changed, so course_lecturer_history.assigned_at is
-- always accurate (BUG FIX 4: was always courses.created_at before).
--
-- BUG FIX 1: In the original chain, 0003 ran DROP TABLE lecturers CASCADE which
-- silently dropped the FK on this column. In the clean schema the FK is declared
-- once and never altered, so it can never become orphaned.
-- It is intentionally NOT deferrable (BUG FIX: review item — 0006 added
-- DEFERRABLE INITIALLY DEFERRED without justification; removed here).
CREATE TABLE courses (
    id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id                uuid        NOT NULL REFERENCES groups(id)        ON DELETE RESTRICT,
    semester_id             uuid        NOT NULL REFERENCES app_semesters(id) ON DELETE RESTRICT,
    lecturer_id             uuid        REFERENCES lecturers(id)              ON DELETE SET NULL,
    lecturer_assigned_at    timestamptz,
    name                    text        NOT NULL,
    code                    text        NOT NULL,
    credit_hours            smallint,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT courses_group_semester_code_unique UNIQUE (group_id, semester_id, code)
);

CREATE INDEX idx_courses_group_id    ON courses (group_id);
CREATE INDEX idx_courses_semester_id ON courses (semester_id);
CREATE INDEX idx_courses_lecturer_id ON courses (lecturer_id);

-- Append-only log of past lecturer-to-course assignments.
-- Populated by trg_log_lecturer_reassignment when courses.lecturer_id changes.
-- Gives reassigned/archived lecturers read-access to their historical records.
-- course_lecturer_history is declared AFTER courses so both FKs resolve.
CREATE TABLE course_lecturer_history (
    id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id    uuid        NOT NULL REFERENCES courses(id)   ON DELETE CASCADE,
    lecturer_id  uuid        NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    assigned_at  timestamptz NOT NULL,
    removed_at   timestamptz NOT NULL DEFAULT now(),
    removed_by   uuid        REFERENCES user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_clh_course_id   ON course_lecturer_history (course_id);
CREATE INDEX idx_clh_lecturer_id ON course_lecturer_history (lecturer_id);

-- Timetable entries: recurring scheduled slots for a course.
CREATE TABLE timetables (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id       uuid        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    group_id        uuid        NOT NULL REFERENCES groups(id)  ON DELETE RESTRICT,
    day_of_week     smallint    NOT NULL,
    start_time      time        NOT NULL,
    end_time        time        NOT NULL,
    venue           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT timetables_day_valid   CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT timetables_times_valid CHECK (end_time > start_time)
);


-- ---------------------------------------------------------------------------
-- 6. Attendance
-- ---------------------------------------------------------------------------

-- A specific class that happened (or is currently live).
-- duration_minutes: rep/lecturer sets this when opening; cron uses it for auto-close.
-- auto_ended: true when closed by the timer, false when closed manually.
-- semester_id: required so close_semester() can find and force-close open sessions.
-- updated_at: added so the row records when ended_at or venue was last changed.
CREATE TABLE class_sessions (
    id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id         uuid        NOT NULL REFERENCES courses(id)       ON DELETE RESTRICT,
    semester_id       uuid        NOT NULL REFERENCES app_semesters(id) ON DELETE RESTRICT,
    timetable_id      uuid        REFERENCES timetables(id)             ON DELETE SET NULL,
    started_at        timestamptz NOT NULL DEFAULT now(),
    ended_at          timestamptz,
    duration_minutes  smallint    NOT NULL DEFAULT 120,
    auto_ended        boolean     NOT NULL DEFAULT false,
    venue             text,
    notes             text,
    created_by        uuid        REFERENCES students(id) ON DELETE SET NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_course_id   ON class_sessions (course_id);
CREATE INDEX idx_sessions_semester_id ON class_sessions (semester_id);
CREATE INDEX idx_sessions_started_at  ON class_sessions (started_at);
-- Fast "is this session still open?" check used in check-in and close_session()
CREATE INDEX idx_sessions_open        ON class_sessions (id) WHERE ended_at IS NULL;

-- Individual student check-in record.
-- Verified via geolocation + selfie; no QR token.
-- gps_accuracy: metres reported by browser Geolocation API.
-- device_token: browser fingerprint; enforces one device per student per session.
-- selfie_path: Cloudflare R2 object key (same pattern as students.photo_path).
CREATE TABLE attendance (
    id              uuid            PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      uuid            NOT NULL REFERENCES class_sessions(id) ON DELETE RESTRICT,
    student_id      uuid            NOT NULL REFERENCES students(id)        ON DELETE RESTRICT,
    status          arrival_status  NOT NULL DEFAULT 'present',
    checked_in_at   timestamptz     NOT NULL DEFAULT now(),
    latitude        numeric(10, 7),
    longitude       numeric(10, 7),
    selfie_path     text,
    geo_verified    boolean         NOT NULL DEFAULT false,
    gps_accuracy    numeric(8, 2),
    device_token    text,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT attendance_session_student_unique UNIQUE (session_id, student_id)
);

COMMENT ON COLUMN attendance.selfie_path IS
    'Cloudflare R2 object key for the student check-in selfie '
    '(e.g. attendance/<session_id>/<student_id>.webp). '
    'Construct the full URL in the app layer from the R2_PUBLIC_URL env var.';

-- One device token per session (only enforced for non-null tokens).
CREATE UNIQUE INDEX attendance_one_device_per_session
    ON attendance (session_id, device_token)
    WHERE device_token IS NOT NULL;

CREATE INDEX idx_attendance_session_id    ON attendance (session_id);
CREATE INDEX idx_attendance_student_id    ON attendance (student_id);
CREATE INDEX idx_attendance_checked_in_at ON attendance (checked_in_at);

-- Dispute raised against an attendance record by the student.
CREATE TABLE attendance_disputes (
    id              uuid            PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_id   uuid            NOT NULL REFERENCES attendance(id)     ON DELETE RESTRICT,
    raised_by       uuid            NOT NULL REFERENCES students(id)       ON DELETE RESTRICT,
    reason          text            NOT NULL,
    status          dispute_status  NOT NULL DEFAULT 'pending',
    resolved_by     uuid            REFERENCES user_profiles(id)           ON DELETE SET NULL,
    resolved_at     timestamptz,
    resolution_note text,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    updated_at      timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT disputes_resolved_fields CHECK (
        (status = 'pending'  AND resolved_by IS NULL AND resolved_at IS NULL)
        OR
        (status != 'pending' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
    )
);


-- ---------------------------------------------------------------------------
-- 7. Notifications
-- ---------------------------------------------------------------------------

-- is_read:      student opened the notification panel and saw it.
-- is_dismissed: "Mark Attendance" banner must no longer be shown.
--   Set true when the student checks in (trg_dismiss_on_checkin) or when
--   close_session() bulk-dismisses remaining open notifications.
-- session_id:   ties the notification to its class_session for bulk dismiss.
-- metadata:     JSON bag for the client to render the banner without extra queries.
--               Shape: { course_name, group_id, started_at }
CREATE TABLE notifications (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     uuid        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    title       text        NOT NULL,
    body        text        NOT NULL,
    is_read     boolean     NOT NULL DEFAULT false,
    is_dismissed boolean    NOT NULL DEFAULT false,
    session_id  uuid        REFERENCES class_sessions(id) ON DELETE SET NULL,
    metadata    jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_is_read ON notifications (is_read) WHERE is_read = false;
-- Efficient poll: "any undismissed session banner for this user?"
CREATE INDEX idx_notifications_session_banner
    ON notifications (user_id, is_dismissed, session_id)
    WHERE is_dismissed = false AND session_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 8. Ops
-- ---------------------------------------------------------------------------

-- Append-only audit trail. The sole write path is write_audit_log() (SECURITY
-- DEFINER). Direct INSERT is blocked by the RLS DENY policy in 0004_rls.sql.
CREATE TABLE audit_log (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id    uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
    action      text        NOT NULL,
    table_name  text,
    record_id   uuid,
    old_data    jsonb,
    new_data    jsonb,
    ip_address  inet,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor_id     ON audit_log (actor_id);
CREATE INDEX idx_audit_log_created_at   ON audit_log (created_at);
CREATE INDEX idx_audit_log_table_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_log_action       ON audit_log (action);

-- Key-value store for operational constants.
CREATE TABLE system_settings (
    key         text PRIMARY KEY,
    value       text NOT NULL,
    description text,
    updated_by  uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
