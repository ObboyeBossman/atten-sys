-- =============================================================================
-- ATTEN-SYS — 0005_config.sql
-- System configuration: operational constants read by the app at runtime.
-- Apply after 0004_rls.sql.
--
-- This file inserts only rows that must exist at boot time:
--   • system_settings — operational constants read by the app layer and
--     by add_student_to_group() / close_session() / cron Edge Functions.
--
-- Institution skeleton rows (faculties, departments, programmes, etc.) are
-- NOT seeded here — they are institution-specific and must be entered via
-- the admin portal or a separate institution-specific seed script.
--
-- DO NOT seed auth.users or user_profiles rows here.
-- The super_admin account is created once via the Supabase Auth admin API
-- after deployment, which fires handle_new_user() → creates user_profiles,
-- then the admin inserts into super_admins to complete the identity record.
-- =============================================================================


-- ===========================================================================
-- system_settings
--
-- All inserts use ON CONFLICT DO NOTHING so this file is safe to re-run
-- after deployment without clobbering values changed by the admin in prod.
-- ===========================================================================

INSERT INTO system_settings (key, value, description) VALUES

    -- Email domain appended to generated student addresses.
    -- Format: lower(replace(index_number, '/', '')) || '@' || domain
    -- e.g. BC/ITS/24/197 → bcits24197@ttu.edu.gh
    (
        'institution_email_domain',
        'ttu.edu.gh',
        'Domain appended to generated student email addresses. '
        'Change before seeding any students if your institution uses a different domain.'
    ),

    -- GPS accuracy floor for student check-in.
    -- Check-ins where the browser-reported accuracy (in metres) is WORSE
    -- (i.e. higher) than this value are rejected by the application layer
    -- before the attendance row is inserted.
    -- A lower value = stricter. Typical campus Wi-Fi accuracy is 15–30 m;
    -- typical GPS accuracy is 5–15 m. 100 m is a permissive default.
    (
        'gps_accuracy_floor_metres',
        '100',
        'Maximum acceptable GPS accuracy in metres for student check-in. '
        'Submissions with accuracy worse than this are rejected. Default: 100.'
    ),

    -- Late threshold: minutes after session start before a student is
    -- marked "late" instead of "present". Enforced in the application layer
    -- when inserting the attendance row (status = present vs late).
    (
        'late_threshold_minutes',
        '15',
        'Minutes after session start before a student is recorded as late '
        'instead of present. Default: 15.'
    ),

    -- Default session duration in minutes. Used by the cron Edge Function
    -- to auto-close sessions that are still open after this many minutes.
    -- Reps and lecturers may override this per session when opening one.
    (
        'default_session_duration_minutes',
        '120',
        'Default class session duration in minutes. Used when no explicit '
        'duration_minutes is supplied at session open. Default: 120.'
    )

ON CONFLICT (key) DO NOTHING;


-- =============================================================================
-- Cron Edge Function schedule (documentation — actual TypeScript is separate)
--
-- Deploy the following Edge Functions in Supabase and schedule them:
--
-- 1. cron-open-semesters
--    Schedule : every day at 00:05 UTC
--    Body     : SELECT open_semester(id)
--               FROM   app_semesters
--               WHERE  status     = 'upcoming'
--                 AND  auto_open  = true
--                 AND  start_date <= CURRENT_DATE;
--    Note     : open_semester() allows auth.uid() = NULL (cron service role).
--
-- 2. cron-close-sessions
--    Schedule : every 5 minutes
--    Body     : SELECT close_session(id, true)
--               FROM   class_sessions
--               WHERE  ended_at IS NULL
--                 AND  started_at + (duration_minutes || ' minutes')::interval < now();
--    Note     : close_session() allows auth.uid() = NULL for auto-close calls.
--
-- 3. promote-students  (manual, not a timer — run inside a transaction)
--    Body     : SELECT * FROM promote_students_to_new_year(
--                   p_source_academic_year_id := '<source-uuid>',
--                   p_new_academic_year_id    := '<new-uuid>'
--               );
--    Note     : Review the result set before committing. Any rows with
--               outcome = 'error' mean the target group does not yet exist
--               in the new year — create the group and re-run.
--
-- All three functions are SECURITY DEFINER. Edge Functions must call them via
-- the Supabase service role key so auth.uid() is NULL (cron path) or the
-- calling user's uid is passed (manual path). The service role key bypasses
-- JWT verification but not SECURITY DEFINER logic — the NULL uid checks
-- inside the functions explicitly allow cron-initiated calls.
-- =============================================================================


-- =============================================================================
-- Super admin bootstrapping (documentation — do NOT run as SQL)
--
-- After deploying the schema:
--
--   1. Create the super admin auth user via the Supabase dashboard or API:
--        supabase.auth.admin.createUser({
--            email:    'admin@ttu.edu.gh',
--            password: '<strong-password>',
--            user_metadata: { role: 'super_admin' }
--        })
--      handle_new_user() fires and creates the user_profiles row with
--      role = 'super_admin'.
--
--   2. Insert the super_admins identity row:
--        INSERT INTO super_admins (id, name)
--        VALUES ('<auth-user-uuid>', 'System Administrator');
--      trg_super_admins_sync_role fires → confirms role = 'super_admin'.
--      trg_enforce_single_super_admin fires → rejects if one already exists.
--
--   3. Log in as the super admin via the app to verify access.
-- =============================================================================
