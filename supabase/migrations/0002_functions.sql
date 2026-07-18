-- =============================================================================
-- ATTEN-SYS — 0002_functions.sql
-- All functions: utility, RLS helpers, business logic.
-- Apply after 0001_schema.sql, before 0003_triggers.sql.
--
-- Sections:
--   A.  Utility helpers       (set_updated_at, sync_user_role)
--   B.  Auth hooks            (handle_new_user, handle_user_login)
--   C.  RLS helpers           (is_super_admin, is_rep_in_group, was_rep_in_group,
--                              has_group_membership, is_lecturer_for_course,
--                              is_lecturer_for_session, was_lecturer_for_course,
--                              was_lecturer_for_session, is_lecturer_for_group,
--                              group_id_for_course, group_id_for_session,
--                              is_group_archived, is_course_group_archived,
--                              is_session_group_archived)
--   D.  Business logic        (assemble_index_number, add_student_to_group,
--                              close_session, open_semester, close_semester,
--                              open_academic_year,
--                              promote_students_to_new_year)
--   E.  Audit                 (write_audit_log)
-- =============================================================================


-- ===========================================================================
-- A. UTILITY HELPERS
-- ===========================================================================

-- Maintains updated_at columns automatically on all tables that have them.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- Syncs the role column on user_profiles when a child identity row is inserted.
-- The role to apply is passed as the first trigger argument (TG_ARGV[0]).
-- BUG FIX (review): original version had no NULL guard on TG_ARGV[0].
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_ARGV[0] IS NULL OR TG_ARGV[0] = '' THEN
        RAISE EXCEPTION 'sync_user_role() requires a role argument via TG_ARGV[0]';
    END IF;

    UPDATE user_profiles
    SET role = TG_ARGV[0]::user_role
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;


-- ===========================================================================
-- B. AUTH HOOKS
-- ===========================================================================

-- Creates a user_profiles row immediately after Supabase Auth creates an
-- auth.users row. Metadata keys expected in raw_user_meta_data at sign-up:
--   role                  : 'super_admin' | 'student' | 'lecturer'
--   phone                 : optional
--   must_change_password  : boolean (default false)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, role, email, phone, must_change_password)
    VALUES (
        NEW.id,
        (NEW.raw_user_meta_data->>'role')::public.user_role,
        NEW.email,
        NEW.raw_user_meta_data->>'phone',
        COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false)
    );
    RETURN NEW;
END;
$$;


-- Updates user_profiles.last_login when auth.users.last_sign_in_at changes,
-- and writes a user.login event to audit_log.
-- BUG FIX (0008): extended to also call write_audit_log().
CREATE OR REPLACE FUNCTION handle_user_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
        UPDATE public.user_profiles
        SET last_login = NEW.last_sign_in_at
        WHERE id = NEW.id;

        PERFORM write_audit_log(
            'user.login',
            'auth.users',
            NEW.id,
            NULL,
            jsonb_build_object('last_sign_in_at', NEW.last_sign_in_at)
        );
    END IF;
    RETURN NEW;
END;
$$;


-- ===========================================================================
-- C. RLS HELPERS
-- All functions are SECURITY DEFINER + STABLE so they execute as the function
-- owner (postgres), reading tables with full access regardless of caller role.
-- This is required because they are invoked inside RLS policy expressions.
-- ===========================================================================

-- Returns true if the calling user is an active super_admin.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id        = auth.uid()
          AND role      = 'super_admin'
          AND is_active = true
    );
END;
$$;

-- Returns true if the calling user is an active lecturer.
CREATE OR REPLACE FUNCTION is_lecturer()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id        = auth.uid()
          AND role      = 'lecturer'
          AND is_active = true
    );
END;
$$;

-- Returns true if the calling user is an active course rep in p_group_id.
-- Used in WRITE policies (requires current active status).
CREATE OR REPLACE FUNCTION is_rep_in_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM   group_memberships gm
        JOIN   user_profiles up ON up.id = gm.student_id
        WHERE  gm.student_id    = auth.uid()
          AND  gm.group_id      = p_group_id
          AND  gm.is_course_rep = true
          AND  gm.status        = 'active'
          AND  up.is_active     = true
    );
$$;

-- Returns true if the calling user ever held is_course_rep = true in p_group_id,
-- regardless of current membership status.
-- Used in SELECT policies to give archived/promoted reps read access to history.
CREATE OR REPLACE FUNCTION was_rep_in_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM   group_memberships gm
        JOIN   user_profiles up ON up.id = gm.student_id
        WHERE  gm.student_id    = auth.uid()
          AND  gm.group_id      = p_group_id
          AND  gm.is_course_rep = true
          -- No status filter — any historical rep membership qualifies.
          AND  up.is_active     = true  -- user account must still be active
    );
$$;

-- Returns true if the calling user has ever been a member of p_group_id
-- (current or past — no status filter).
CREATE OR REPLACE FUNCTION has_group_membership(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_memberships
        WHERE student_id = auth.uid()
          AND group_id   = p_group_id
    );
$$;

-- Returns true if the calling user is the currently assigned lecturer on p_course_id.
-- Used in WRITE policies (current assignment only).
CREATE OR REPLACE FUNCTION is_lecturer_for_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM   courses c
        JOIN   user_profiles up ON up.id = auth.uid()
        WHERE  c.id          = p_course_id
          AND  c.lecturer_id = auth.uid()
          AND  up.role       = 'lecturer'
          AND  up.is_active  = true
    );
$$;

-- Convenience wrapper: resolves course via class_session, then calls
-- is_lecturer_for_course(). Used in write policies on attendance and disputes.
CREATE OR REPLACE FUNCTION is_lecturer_for_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT is_lecturer_for_course(
        (SELECT course_id FROM class_sessions WHERE id = p_session_id)
    );
$$;

-- Returns true if the calling user is currently assigned OR previously recorded
-- in course_lecturer_history for p_course_id.
-- Used in SELECT policies to give reassigned/deactivated lecturers read access
-- to all historical records they accumulated.
CREATE OR REPLACE FUNCTION was_lecturer_for_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        -- Currently assigned
        EXISTS (
            SELECT 1
            FROM   courses c
            JOIN   user_profiles up ON up.id = auth.uid()
            WHERE  c.id          = p_course_id
              AND  c.lecturer_id = auth.uid()
              AND  up.role       = 'lecturer'
              AND  up.is_active  = true
        )
        OR
        -- Previously assigned (recorded in history table)
        EXISTS (
            SELECT 1
            FROM   course_lecturer_history clh
            JOIN   user_profiles up ON up.id = auth.uid()
            WHERE  clh.course_id   = p_course_id
              AND  clh.lecturer_id = auth.uid()
              AND  up.role         = 'lecturer'
              AND  up.is_active    = true
        );
$$;

-- Convenience wrapper: resolves course via class_session.
CREATE OR REPLACE FUNCTION was_lecturer_for_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT was_lecturer_for_course(
        (SELECT course_id FROM class_sessions WHERE id = p_session_id)
    );
$$;

-- Returns true if the calling lecturer teaches (or taught) any course in p_group_id.
-- Used in SELECT policies on group_memberships, students, and user_profiles
-- so lecturers can build a class roster.
CREATE OR REPLACE FUNCTION is_lecturer_for_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        -- Currently assigned to at least one course in this group
        EXISTS (
            SELECT 1
            FROM   courses c
            JOIN   user_profiles up ON up.id = auth.uid()
            WHERE  c.group_id     = p_group_id
              AND  c.lecturer_id  = auth.uid()
              AND  up.role        = 'lecturer'
              AND  up.is_active   = true
        )
        OR
        -- Previously assigned to a course in this group
        EXISTS (
            SELECT 1
            FROM   course_lecturer_history clh
            JOIN   courses c  ON c.id  = clh.course_id
            JOIN   user_profiles up ON up.id = auth.uid()
            WHERE  c.group_id      = p_group_id
              AND  clh.lecturer_id = auth.uid()
              AND  up.role         = 'lecturer'
              AND  up.is_active    = true
        );
$$;

-- Resolves group_id from a courses row.
CREATE OR REPLACE FUNCTION group_id_for_course(p_course_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT group_id FROM courses WHERE id = p_course_id;
$$;

-- Resolves group_id from a class_sessions row (via courses).
CREATE OR REPLACE FUNCTION group_id_for_session(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT c.group_id
    FROM   class_sessions cs
    JOIN   courses c ON c.id = cs.course_id
    WHERE  cs.id = p_session_id;
$$;

-- Returns true if the group exists and is archived.
-- Used as a write guard: all write policies reject writes to archived groups.
CREATE OR REPLACE FUNCTION is_group_archived(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_archived FROM groups WHERE id = p_group_id),
        false   -- unknown group_id → not archived; FK constraint will catch bad ids
    );
$$;

-- Resolves the group from a course and checks is_archived.
CREATE OR REPLACE FUNCTION is_course_group_archived(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT is_group_archived(
        (SELECT group_id FROM courses WHERE id = p_course_id)
    );
$$;

-- Resolves the group from a session (via course) and checks is_archived.
CREATE OR REPLACE FUNCTION is_session_group_archived(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT is_group_archived(group_id_for_session(p_session_id));
$$;


-- ===========================================================================
-- D. BUSINESS LOGIC
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- assemble_index_number(p_group_id, p_serial)
--
-- Builds the canonical index number from the group's FK chain:
--   qualification_types.code / programmes.code / academic_years.year_code / serial
-- e.g. BC/ITS/24/197
--
-- Returns NULL if p_group_id does not resolve (FK chain incomplete).
-- Callers should check for NULL and raise a meaningful error.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assemble_index_number(p_group_id uuid, p_serial int)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        qt.code || '/' || p.code || '/' || ay.year_code
        || '/' || lpad(p_serial::text, 3, '0')
    FROM   groups              g
    JOIN   qualification_types qt ON qt.id = g.qualification_type_id
    JOIN   programmes          p  ON p.id  = qt.programme_id
    JOIN   academic_years      ay ON ay.id = g.academic_year_id
    WHERE  g.id = p_group_id;
$$;


-- ---------------------------------------------------------------------------
-- add_student_to_group(p_group_id, p_serial, p_name)
--
-- Single entry point for all "add student" actions (rep portal, seed, etc.).
-- The rep supplies only the serial number (e.g. 197); the full index number
-- (e.g. BC/ITS/24/197) is assembled from the group's FK chain.
--
-- Four outcomes (never an unhandled exception for valid input):
--   'created'          brand-new student — auth user + student row + membership
--   'membership_added' active student exists; membership inserted for this group
--   'already_member'   student already has an active membership in this group
--   'reactivated'      student was soft-deleted — reactivated + membership inserted
--
-- NOTE: This function inserts directly into auth.users using pgcrypto.
-- This is necessary because there is no SQL-accessible Supabase Admin API.
-- The initial password is bcrypt-hashed at work factor 12 from groups_secrets.
-- After creation, the app layer SHOULD call supabase.auth.admin.updateUserById()
-- if it needs to set a different password or trigger gotrue-specific hooks.
-- The student's must_change_password flag is set true so they are forced to
-- change on first login regardless.
--
-- BUG FIX (review): bcrypt work factor raised from 6 to 12.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_student_to_group(
    p_group_id  uuid,
    p_serial    int,
    p_name      text  DEFAULT NULL
)
RETURNS TABLE (
    student_id    uuid,
    outcome       text,
    index_number  text,
    email         text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_index_number   text;
    v_email          text;
    v_domain         text;
    v_student_id     uuid;
    v_is_active      boolean;
    v_has_membership boolean;
BEGIN
    -- Validate serial range
    IF p_serial < 1 OR p_serial > 999 THEN
        RAISE EXCEPTION 'Serial must be between 1 and 999, got %', p_serial;
    END IF;

    -- Validate group exists and is not archived
    IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND is_archived = false) THEN
        RAISE EXCEPTION 'Group % does not exist or is archived', p_group_id;
    END IF;

    -- Assemble the canonical index number
    v_index_number := assemble_index_number(p_group_id, p_serial);

    IF v_index_number IS NULL THEN
        RAISE EXCEPTION
            'Could not assemble index number for group % — '
            'check qualification_type, programme, and academic_year rows',
            p_group_id;
    END IF;

    -- Assemble student email
    SELECT value INTO v_domain
    FROM   system_settings
    WHERE  key = 'institution_email_domain';

    v_email := lower(replace(v_index_number, '/', '')) || '@' || v_domain;

    -- Look up existing student by index_number
    SELECT s.id, up.is_active
    INTO   v_student_id, v_is_active
    FROM   students s
    JOIN   user_profiles up ON up.id = s.id
    WHERE  s.index_number = v_index_number
    LIMIT 1;

    IF v_student_id IS NULL THEN
        -- ── CASE: brand-new student ───────────────────────────────────────────
        -- trg_audit_student_insert fires on the INSERT into students below.
        INSERT INTO auth.users (
            id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_user_meta_data
        )
        VALUES (
            uuid_generate_v4(),
            v_email,
            -- BUG FIX (review): work factor raised from 6 to 12.
            crypt(
                (SELECT default_password FROM groups_secrets WHERE group_id = p_group_id),
                gen_salt('bf', 12)
            ),
            now(),
            jsonb_build_object(
                'role',                 'student',
                'must_change_password', true
            )
        )
        RETURNING id INTO v_student_id;

        INSERT INTO students (id, name, index_number)
        VALUES (v_student_id, COALESCE(p_name, v_index_number), v_index_number);

        INSERT INTO group_memberships (student_id, group_id, is_course_rep, status)
        VALUES (v_student_id, p_group_id, false, 'active');

        student_id   := v_student_id;
        outcome      := 'created';
        index_number := v_index_number;
        email        := v_email;
        RETURN NEXT;

    ELSIF NOT v_is_active THEN
        -- ── CASE: reactivated ─────────────────────────────────────────────────
        UPDATE user_profiles
        SET is_active            = true,
            must_change_password = true
        WHERE id = v_student_id;

        INSERT INTO group_memberships (student_id, group_id, is_course_rep, status)
        VALUES (v_student_id, p_group_id, false, 'active');

        PERFORM write_audit_log(
            'student.reactivated',
            'students',
            v_student_id,
            jsonb_build_object('is_active', false),
            jsonb_build_object(
                'is_active',    true,
                'group_id',     p_group_id,
                'index_number', v_index_number
            )
        );

        student_id   := v_student_id;
        outcome      := 'reactivated';
        index_number := v_index_number;
        email        := v_email;
        RETURN NEXT;

    ELSE
        -- Student is active — check membership in this specific group
        SELECT EXISTS (
            SELECT 1 FROM group_memberships
            WHERE  student_id = v_student_id
              AND  group_id   = p_group_id
              AND  status     = 'active'
        ) INTO v_has_membership;

        IF v_has_membership THEN
            -- ── CASE: already a member (idempotent) ───────────────────────────
            student_id   := v_student_id;
            outcome      := 'already_member';
            index_number := v_index_number;
            email        := v_email;
            RETURN NEXT;

        ELSE
            -- ── CASE: active student, no membership here yet ──────────────────
            INSERT INTO group_memberships (student_id, group_id, is_course_rep, status)
            VALUES (v_student_id, p_group_id, false, 'active');

            PERFORM write_audit_log(
                'student.membership_added',
                'group_memberships',
                v_student_id,
                NULL,
                jsonb_build_object(
                    'group_id',     p_group_id,
                    'index_number', v_index_number
                )
            );

            student_id   := v_student_id;
            outcome      := 'membership_added';
            index_number := v_index_number;
            email        := v_email;
            RETURN NEXT;
        END IF;
    END IF;
END;
$$;


-- ---------------------------------------------------------------------------
-- close_session(p_session_id, p_auto_ended)
--
-- Ends a class session and bulk-dismisses all outstanding notifications for it.
-- Called by reps/lecturers (manual end) or the cron Edge Function (auto-timeout).
--
-- BUG FIX (review): caller authorization is now checked inside the function.
-- Previously any authenticated user could call this RPC.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION close_session(
    p_session_id  uuid,
    p_auto_ended  boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_course_id uuid;
BEGIN
    SELECT course_id INTO v_course_id
    FROM   class_sessions
    WHERE  id = p_session_id;

    -- Guard: session must exist and be open
    IF v_course_id IS NULL THEN
        RAISE EXCEPTION 'Session % does not exist', p_session_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM class_sessions
        WHERE  id       = p_session_id
          AND  ended_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Session % is already closed', p_session_id;
    END IF;

    -- BUG FIX: only rep, lecturer for the course, or super_admin may close a session.
    -- p_auto_ended = true means the call came from the cron Edge Function via the
    -- service role key — in that context auth.uid() is NULL, which is allowed.
    IF NOT p_auto_ended
       AND auth.uid() IS NOT NULL
       AND NOT (
           is_rep_in_group(group_id_for_course(v_course_id))
           OR is_lecturer_for_course(v_course_id)
           OR is_super_admin()
       )
    THEN
        RAISE EXCEPTION 'Not authorized to close session %', p_session_id;
    END IF;

    UPDATE class_sessions
    SET    ended_at   = now(),
           auto_ended = p_auto_ended,
           updated_at = now()
    WHERE  id = p_session_id;

    UPDATE notifications
    SET    is_dismissed = true
    WHERE  session_id   = p_session_id
      AND  is_dismissed = false;
END;
$$;


-- ---------------------------------------------------------------------------
-- open_semester(p_semester_id)
--
-- Transitions a semester from 'upcoming' to 'active'.
-- Called by the Edge Function cron when start_date arrives, or manually by
-- super_admin.
--
-- BUG FIX (review): caller authorization now checked inside the function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION open_semester(p_semester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- BUG FIX: only super_admin (or the cron service role, auth.uid() = NULL)
    -- may open a semester.
    IF auth.uid() IS NOT NULL AND NOT is_super_admin() THEN
        RAISE EXCEPTION 'Only super admin may open a semester';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM app_semesters
        WHERE  id     = p_semester_id
          AND  status = 'upcoming'
    ) THEN
        RAISE EXCEPTION
            'Semester % is not in upcoming status. '
            'Only upcoming semesters can be opened.', p_semester_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM app_semesters
        WHERE  status = 'active'
          AND  id    != p_semester_id
    ) THEN
        RAISE EXCEPTION
            'Another semester is already active. '
            'Close it with close_semester() before opening a new one.';
    END IF;

    UPDATE app_semesters
    SET    status    = 'active',
           opened_at = now()
    WHERE  id = p_semester_id;

    PERFORM write_audit_log(
        'semester.opened',
        'app_semesters',
        p_semester_id,
        jsonb_build_object('status', 'upcoming'),
        jsonb_build_object('status', 'active', 'opened_at', now())
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- close_semester(p_semester_id)
--
-- Archives an active semester and force-closes every open session within it.
-- close_session() handles each session's notification dismissals.
-- BUG FIX (review): caller authorization now checked inside the function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION close_semester(p_semester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_open_session RECORD;
    v_closed_count int := 0;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT is_super_admin() THEN
        RAISE EXCEPTION 'Only super admin may close a semester';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM app_semesters
        WHERE  id     = p_semester_id
          AND  status = 'active'
    ) THEN
        RAISE EXCEPTION 'Semester % is not active', p_semester_id;
    END IF;

    FOR v_open_session IN
        SELECT id FROM class_sessions
        WHERE  semester_id = p_semester_id
          AND  ended_at IS NULL
    LOOP
        PERFORM close_session(v_open_session.id, true);
        v_closed_count := v_closed_count + 1;
    END LOOP;

    UPDATE app_semesters
    SET    status    = 'archived',
           closed_at = now()
    WHERE  id = p_semester_id;

    PERFORM write_audit_log(
        'semester.closed',
        'app_semesters',
        p_semester_id,
        jsonb_build_object('status', 'active'),
        jsonb_build_object(
            'status',                  'archived',
            'closed_at',               now(),
            'force_closed_sessions',   v_closed_count
        )
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- open_academic_year(p_academic_year_id)
--
-- Safely marks a new academic year as current, clearing the old one.
-- Does not open semesters — call open_semester() separately.
-- BUG FIX (review): caller authorization now checked inside the function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION open_academic_year(p_academic_year_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_previous_id uuid;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT is_super_admin() THEN
        RAISE EXCEPTION 'Only super admin may change the current academic year';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_academic_year_id) THEN
        RAISE EXCEPTION 'Academic year % not found', p_academic_year_id;
    END IF;

    SELECT id INTO v_previous_id
    FROM   academic_years
    WHERE  is_current = true
    LIMIT 1;

    UPDATE academic_years
    SET    is_current = false
    WHERE  is_current = true
      AND  id        != p_academic_year_id;

    UPDATE academic_years
    SET    is_current = true
    WHERE  id = p_academic_year_id;

    PERFORM write_audit_log(
        'academic_year.opened',
        'academic_years',
        p_academic_year_id,
        jsonb_build_object('previous_current_id', v_previous_id),
        jsonb_build_object('is_current', true)
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- promote_students_to_new_year(p_source_academic_year_id, p_new_academic_year_id)
--
-- Moves all students with active memberships in the source year into matching
-- groups in the new year, or marks them 'completed' (graduated) if no next
-- level exists.
--
-- BUG FIX 2: COALESCE(v_old_groups, '{}') prevents crash when ARRAY_AGG
-- returns NULL (no active memberships in the source year).
--
-- BUG FIX (review): added p_source_academic_year_id parameter so only students
-- from the intended year are processed, not every active membership globally.
--
-- Admin workflow:
--   1. Create new academic_year and the next-level groups within it.
--   2. Assign reps to the new groups (super_admin does this manually).
--   3. Call SELECT * FROM promote_students_to_new_year(src_id, new_id)
--      inside a BEGIN/COMMIT so the result can be reviewed and rolled back
--      if any rows show outcome = 'error'.
--   4. Old groups auto-archive once all their active members are moved out.
--
-- Three outcomes per student:
--   'promoted'  — moved to the next-level group
--   'completed' — no next level; graduated
--   'error'     — no matching group found in the new year; student left in place
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION promote_students_to_new_year(
    p_source_academic_year_id uuid,
    p_new_academic_year_id    uuid
)
RETURNS TABLE (
    student_id      uuid,
    student_name    text,
    index_number    text,
    old_group_id    uuid,
    old_group_name  text,
    new_group_id    uuid,
    new_group_name  text,
    outcome         text,
    detail          text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r               RECORD;
    v_next_level    RECORD;
    v_new_group_id  uuid;
    v_new_group_nm  text;
    v_old_groups    uuid[];
    v_grp_id        uuid;
    v_promoted      int := 0;
    v_graduated     int := 0;
    v_errors        int := 0;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT is_super_admin() THEN
        RAISE EXCEPTION 'Only super admin may run year promotion';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_source_academic_year_id) THEN
        RAISE EXCEPTION 'Source academic year % not found', p_source_academic_year_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_new_academic_year_id) THEN
        RAISE EXCEPTION 'Target academic year % not found', p_new_academic_year_id;
    END IF;

    -- Collect group ids in the source year that have active members.
    -- BUG FIX 2: COALESCE prevents crash when ARRAY_AGG returns NULL.
    SELECT ARRAY_AGG(DISTINCT gm.group_id)
    INTO   v_old_groups
    FROM   group_memberships gm
    JOIN   groups g ON g.id = gm.group_id
    WHERE  gm.status         = 'active'
      AND  g.academic_year_id = p_source_academic_year_id;

    -- Process every student with an active membership in the source year.
    -- BUG FIX (review): filter by source year to avoid touching other cohorts.
    FOR r IN
        SELECT
            gm.id               AS membership_id,
            gm.student_id,
            s.name              AS student_name,
            s.index_number,
            gm.group_id         AS old_group_id,
            g.group_name        AS old_group_name,
            g.qualification_type_id,
            l.sort_order        AS current_sort_order
        FROM group_memberships gm
        JOIN students   s ON s.id  = gm.student_id
        JOIN groups     g ON g.id  = gm.group_id
        JOIN levels     l ON l.id  = g.level_id
        WHERE gm.status          = 'active'
          AND g.academic_year_id  = p_source_academic_year_id
        ORDER BY gm.group_id, s.index_number
    LOOP
        SELECT * INTO v_next_level
        FROM   levels
        WHERE  qualification_type_id = r.qualification_type_id
          AND  sort_order            = r.current_sort_order + 1
        LIMIT 1;

        IF v_next_level IS NULL THEN
            -- No next level → student graduates
            UPDATE group_memberships
            SET    status    = 'completed',
                   exited_at = now()
            WHERE  id = r.membership_id;
            -- trg_audit_membership_status fires here → student.graduated

            v_graduated    := v_graduated + 1;
            student_id     := r.student_id;
            student_name   := r.student_name;
            index_number   := r.index_number;
            old_group_id   := r.old_group_id;
            old_group_name := r.old_group_name;
            new_group_id   := NULL;
            new_group_name := NULL;
            outcome        := 'completed';
            detail         := 'No next level — student graduated';
            RETURN NEXT;

        ELSE
            -- Look for a matching group in the new academic year
            SELECT id, group_name
            INTO   v_new_group_id, v_new_group_nm
            FROM   groups
            WHERE  qualification_type_id = r.qualification_type_id
              AND  level_id              = v_next_level.id
              AND  academic_year_id      = p_new_academic_year_id
              AND  group_name            = r.old_group_name
              AND  is_archived           = false
            LIMIT 1;

            IF v_new_group_id IS NULL THEN
                -- Target group not yet created — flag as error, leave student in place
                v_errors       := v_errors + 1;
                student_id     := r.student_id;
                student_name   := r.student_name;
                index_number   := r.index_number;
                old_group_id   := r.old_group_id;
                old_group_name := r.old_group_name;
                new_group_id   := NULL;
                new_group_name := NULL;
                outcome        := 'error';
                detail         := 'No matching group in new academic year — '
                               || 'create group "' || r.old_group_name || '" for next level first';
                RETURN NEXT;
                CONTINUE;
            END IF;

            -- Close old membership
            UPDATE group_memberships
            SET    status    = 'promoted',
                   exited_at = now()
            WHERE  id = r.membership_id;
            -- trg_audit_membership_status fires here → student.promoted

            -- Open new membership (rep status NOT carried — admin assigns reps)
            INSERT INTO group_memberships (student_id, group_id, is_course_rep, status)
            VALUES (r.student_id, v_new_group_id, false, 'active')
            ON CONFLICT (student_id, group_id) DO NOTHING;

            v_promoted     := v_promoted + 1;
            student_id     := r.student_id;
            student_name   := r.student_name;
            index_number   := r.index_number;
            old_group_id   := r.old_group_id;
            old_group_name := r.old_group_name;
            new_group_id   := v_new_group_id;
            new_group_name := v_new_group_nm;
            outcome        := 'promoted';
            detail         := 'Moved to ' || v_new_group_nm;
            RETURN NEXT;
        END IF;
    END LOOP;

    -- Archive old groups that now have zero active memberships.
    -- Groups with error outcomes still have active members — they are skipped.
    FOREACH v_grp_id IN ARRAY COALESCE(v_old_groups, '{}') LOOP
        IF NOT EXISTS (
            SELECT 1 FROM group_memberships
            WHERE  group_id = v_grp_id
              AND  status   = 'active'
        ) THEN
            UPDATE groups
            SET    is_archived = true,
                   archived_at = now()
            WHERE  id = v_grp_id;
            -- trg_audit_group_archived fires here → group.archived
        END IF;
    END LOOP;

    -- One batch summary audit event for the whole run
    PERFORM write_audit_log(
        'academic_year.promoted',
        'academic_years',
        p_new_academic_year_id,
        NULL,
        jsonb_build_object(
            'source_year_id', p_source_academic_year_id,
            'promoted',       v_promoted,
            'graduated',      v_graduated,
            'errors',         v_errors
        )
    );
END;
$$;


-- ===========================================================================
-- E. AUDIT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- write_audit_log(action, table_name, record_id, old_data, new_data)
--
-- The sole INSERT path into audit_log. Runs as SECURITY DEFINER (postgres),
-- which bypasses the RLS DENY policy on audit_log. No app-layer role has
-- INSERT permission on audit_log directly.
--
-- actor_id = auth.uid(): NULL for cron/service-role calls — expected and
-- documented. The action name is still recorded so the event is traceable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION write_audit_log(
    p_action      text,
    p_table_name  text  DEFAULT NULL,
    p_record_id   uuid  DEFAULT NULL,
    p_old_data    jsonb DEFAULT NULL,
    p_new_data    jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), p_action, p_table_name, p_record_id, p_old_data, p_new_data);
END;
$$;
