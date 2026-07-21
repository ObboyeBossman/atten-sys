-- =============================================================================
-- ATTEN-SYS — 0003_triggers.sql
-- All triggers and their backing functions.
-- Apply after 0002_functions.sql, before 0004_rls.sql.
--
-- Sections:
--   A.  updated_at maintenance       (one trigger per table that has the column)
--   B.  Role sync                    (super_admins, students, lecturers)
--   C.  Auth hooks                   (handle_new_user, handle_user_login)
--   D.  Singleton super_admin guard  (BUG FIX: now SECURITY DEFINER)
--   E.  Lecturer stamp + history     (stamp_lecturer_assigned_at,
--                                     log_lecturer_reassignment)
--   F.  Group archive guard          (prevent_archive_with_active_members)
--   G.  Session notifications        (push_session_notifications,
--                                     dismiss_on_checkin)
--   H.  Audit triggers               (one per audited event)
-- =============================================================================


-- ===========================================================================
-- A. updated_at MAINTENANCE
-- ===========================================================================

CREATE TRIGGER trg_faculties_updated_at
    BEFORE UPDATE ON faculties
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_programmes_updated_at
    BEFORE UPDATE ON programmes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_qualification_types_updated_at
    BEFORE UPDATE ON qualification_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_academic_years_updated_at
    BEFORE UPDATE ON academic_years
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_app_semesters_updated_at
    BEFORE UPDATE ON app_semesters
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_super_admins_updated_at
    BEFORE UPDATE ON super_admins
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_lecturers_updated_at
    BEFORE UPDATE ON lecturers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_timetables_updated_at
    BEFORE UPDATE ON timetables
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_class_sessions_updated_at
    BEFORE UPDATE ON class_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_attendance_disputes_updated_at
    BEFORE UPDATE ON attendance_disputes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ===========================================================================
-- B. ROLE SYNC
-- Fires AFTER INSERT on identity tables to stamp the correct role onto
-- user_profiles. sync_user_role() reads TG_ARGV[0] — the role is passed
-- as a string argument at trigger-definition time.
-- ===========================================================================

CREATE TRIGGER trg_super_admins_sync_role
    AFTER INSERT ON super_admins
    FOR EACH ROW EXECUTE FUNCTION sync_user_role('super_admin');

CREATE TRIGGER trg_students_sync_role
    AFTER INSERT ON students
    FOR EACH ROW EXECUTE FUNCTION sync_user_role('student');

CREATE TRIGGER trg_lecturers_sync_role
    AFTER INSERT ON lecturers
    FOR EACH ROW EXECUTE FUNCTION sync_user_role('lecturer');


-- ===========================================================================
-- C. AUTH HOOKS
-- ===========================================================================

-- Create user_profiles row when Supabase Auth creates an auth.users entry.
CREATE TRIGGER trg_handle_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update last_login and write audit event on auth.users sign-in update.
CREATE TRIGGER trg_handle_user_login
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_user_login();


-- REMOVED: singleton super admin guard (multiple super admins are permitted)


-- ===========================================================================
-- E. LECTURER ASSIGNMENT STAMP + HISTORY
-- ===========================================================================

-- Stamps courses.lecturer_assigned_at whenever lecturer_id is set or changed.
-- BUG FIX 4: Without this column + trigger, course_lecturer_history.assigned_at
-- always stored courses.created_at — the course creation date, not the
-- lecturer assignment date.
CREATE OR REPLACE FUNCTION stamp_lecturer_assigned_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Lecturer being assigned (was NULL) or reassigned (different id)
    IF NEW.lecturer_id IS DISTINCT FROM OLD.lecturer_id
       AND NEW.lecturer_id IS NOT NULL THEN
        NEW.lecturer_assigned_at := now();
    END IF;

    -- Lecturer being removed — clear the timestamp
    IF NEW.lecturer_id IS NULL AND OLD.lecturer_id IS NOT NULL THEN
        NEW.lecturer_assigned_at := NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stamp_lecturer_assigned_at
    BEFORE UPDATE OF lecturer_id ON courses
    FOR EACH ROW EXECUTE FUNCTION stamp_lecturer_assigned_at();


-- When courses.lecturer_id changes, write the outgoing lecturer to
-- course_lecturer_history so they retain read access to historical records.
-- BUG FIX 4: Uses courses.lecturer_assigned_at (not courses.created_at)
-- for the assigned_at column, so history timestamps are accurate.
CREATE OR REPLACE FUNCTION log_lecturer_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.lecturer_id IS NOT NULL
       AND OLD.lecturer_id IS DISTINCT FROM NEW.lecturer_id THEN

        INSERT INTO course_lecturer_history (
            course_id,
            lecturer_id,
            assigned_at,
            removed_at,
            removed_by
        ) VALUES (
            OLD.id,
            OLD.lecturer_id,
            -- BUG FIX 4: use lecturer_assigned_at, not created_at.
            -- COALESCE falls back to created_at only for rows that pre-date
            -- the lecturer_assigned_at column (should never occur in clean install).
            COALESCE(OLD.lecturer_assigned_at, OLD.created_at),
            now(),
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_lecturer_reassignment
    AFTER UPDATE OF lecturer_id ON courses
    FOR EACH ROW EXECUTE FUNCTION log_lecturer_reassignment();


-- ===========================================================================
-- F. GROUP ARCHIVE GUARD
-- BUG FIX 3: Prevents super_admin from archiving a group that still has
-- active members, guarding against a direct UPDATE that bypasses
-- promote_students_to_new_year().
-- ===========================================================================

CREATE OR REPLACE FUNCTION prevent_archive_with_active_members()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_active_count int;
BEGIN
    -- Only fires when is_archived is being flipped from false → true
    IF OLD.is_archived = false AND NEW.is_archived = true THEN
        SELECT COUNT(*) INTO v_active_count
        FROM   group_memberships
        WHERE  group_id = NEW.id
          AND  status   = 'active';

        IF v_active_count > 0 THEN
            RAISE EXCEPTION
                'Cannot archive group % — % active membership(s) remain. '
                'Promote or remove all active students first.',
                NEW.id, v_active_count;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_archive_with_active_members
    BEFORE UPDATE OF is_archived ON groups
    FOR EACH ROW EXECUTE FUNCTION prevent_archive_with_active_members();


-- ===========================================================================
-- G. SESSION NOTIFICATIONS
-- ===========================================================================

-- Fans out one notification per active student in the group when a new
-- class_session is inserted. Also notifies the assigned lecturer (informational).
CREATE OR REPLACE FUNCTION push_session_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id      uuid;
    v_course_name   text;
    v_lecturer_id   uuid;
    v_student       RECORD;
BEGIN
    SELECT c.group_id, c.name, c.lecturer_id
    INTO   v_group_id, v_course_name, v_lecturer_id
    FROM   courses c
    WHERE  c.id = NEW.course_id;

    -- Fan out — one notification per active student in the group
    FOR v_student IN
        SELECT gm.student_id
        FROM   group_memberships gm
        JOIN   user_profiles     up ON up.id = gm.student_id
        WHERE  gm.group_id  = v_group_id
          AND  gm.status    = 'active'
          AND  up.is_active = true
    LOOP
        INSERT INTO notifications (
            user_id, title, body, session_id, is_dismissed, metadata
        ) VALUES (
            v_student.student_id,
            'Attendance Open — ' || v_course_name,
            'Your lecturer has started a class. Tap to mark present.',
            NEW.id,
            false,
            jsonb_build_object(
                'course_name', v_course_name,
                'group_id',    v_group_id,
                'started_at',  NEW.started_at
            )
        );
    END LOOP;

    -- Notify the assigned lecturer (informational only — no check-in action needed)
    IF v_lecturer_id IS NOT NULL THEN
        INSERT INTO notifications (
            user_id, title, body, session_id, is_dismissed, metadata
        ) VALUES (
            v_lecturer_id,
            'Session Started — ' || v_course_name,
            'An attendance session for your course is now live.',
            NEW.id,
            false,
            jsonb_build_object(
                'course_name', v_course_name,
                'group_id',    v_group_id,
                'started_at',  NEW.started_at
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_session_created
    AFTER INSERT ON class_sessions
    FOR EACH ROW EXECUTE FUNCTION push_session_notifications();


-- Auto-dismisses a student's own session notification the moment they check in,
-- so the "Mark Attendance" banner disappears without an app-layer call.
CREATE OR REPLACE FUNCTION dismiss_on_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE notifications
    SET    is_dismissed = true
    WHERE  session_id   = NEW.session_id
      AND  user_id      = NEW.student_id
      AND  is_dismissed = false;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dismiss_on_checkin
    AFTER INSERT ON attendance
    FOR EACH ROW EXECUTE FUNCTION dismiss_on_checkin();


-- ===========================================================================
-- H. AUDIT TRIGGERS
-- All functions are SECURITY DEFINER and call write_audit_log(), which is
-- the sole insert path into audit_log.
-- ===========================================================================

-- ── H1. student.created ────────────────────────────────────────────────────
-- student.reactivated and student.membership_added are written directly by
-- add_student_to_group() since those outcomes are code-path-specific.

CREATE OR REPLACE FUNCTION audit_student_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM write_audit_log(
        'student.created',
        'students',
        NEW.id,
        NULL,
        jsonb_build_object('name', NEW.name, 'index_number', NEW.index_number)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_student_insert
    AFTER INSERT ON students
    FOR EACH ROW EXECUTE FUNCTION audit_student_insert();


-- ── H2. student.deactivated ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_student_deactivated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.is_active = true AND NEW.is_active = false
       AND OLD.role = 'student' THEN
        PERFORM write_audit_log(
            'student.deactivated',
            'user_profiles',
            NEW.id,
            jsonb_build_object('is_active', true),
            jsonb_build_object('is_active', false)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_student_deactivated
    AFTER UPDATE OF is_active ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION audit_student_deactivated();


-- ── H3. rep.assigned / rep.unassigned ─────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_rep_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.is_course_rep = false AND NEW.is_course_rep = true THEN
        PERFORM write_audit_log(
            'rep.assigned',
            'group_memberships',
            NEW.id,
            jsonb_build_object('is_course_rep', false),
            jsonb_build_object(
                'is_course_rep', true,
                'student_id',    NEW.student_id,
                'group_id',      NEW.group_id
            )
        );
    ELSIF OLD.is_course_rep = true AND NEW.is_course_rep = false THEN
        PERFORM write_audit_log(
            'rep.unassigned',
            'group_memberships',
            NEW.id,
            jsonb_build_object(
                'is_course_rep', true,
                'student_id',    OLD.student_id,
                'group_id',      OLD.group_id
            ),
            jsonb_build_object('is_course_rep', false)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_rep_change
    AFTER UPDATE OF is_course_rep ON group_memberships
    FOR EACH ROW EXECUTE FUNCTION audit_rep_change();


-- ── H4. student.promoted / student.graduated ──────────────────────────────

CREATE OR REPLACE FUNCTION audit_membership_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.status = 'active' AND NEW.status = 'promoted' THEN
        PERFORM write_audit_log(
            'student.promoted',
            'group_memberships',
            NEW.id,
            jsonb_build_object('status', 'active',    'group_id', OLD.group_id),
            jsonb_build_object('status', 'promoted',  'exited_at', NEW.exited_at)
        );
    ELSIF OLD.status = 'active' AND NEW.status = 'completed' THEN
        PERFORM write_audit_log(
            'student.graduated',
            'group_memberships',
            NEW.id,
            jsonb_build_object('status', 'active',    'group_id', OLD.group_id),
            jsonb_build_object('status', 'completed', 'exited_at', NEW.exited_at)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_membership_status
    AFTER UPDATE OF status ON group_memberships
    FOR EACH ROW EXECUTE FUNCTION audit_membership_status_change();


-- ── H5. course.created ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_course_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM write_audit_log(
        'course.created',
        'courses',
        NEW.id,
        NULL,
        jsonb_build_object(
            'name',        NEW.name,
            'code',        NEW.code,
            'group_id',    NEW.group_id,
            'semester_id', NEW.semester_id
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_course_insert
    AFTER INSERT ON courses
    FOR EACH ROW EXECUTE FUNCTION audit_course_insert();


-- ── H6. course.lecturer_assigned / removed / reassigned ───────────────────

CREATE OR REPLACE FUNCTION audit_course_lecturer_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action text;
BEGIN
    IF OLD.lecturer_id IS NULL AND NEW.lecturer_id IS NOT NULL THEN
        v_action := 'course.lecturer_assigned';
    ELSIF OLD.lecturer_id IS NOT NULL AND NEW.lecturer_id IS NULL THEN
        v_action := 'course.lecturer_removed';
    ELSIF OLD.lecturer_id IS NOT NULL
          AND NEW.lecturer_id IS NOT NULL
          AND OLD.lecturer_id IS DISTINCT FROM NEW.lecturer_id THEN
        v_action := 'course.lecturer_reassigned';
    ELSE
        RETURN NEW;  -- No relevant change
    END IF;

    PERFORM write_audit_log(
        v_action,
        'courses',
        NEW.id,
        jsonb_build_object('lecturer_id', OLD.lecturer_id),
        jsonb_build_object(
            'lecturer_id', NEW.lecturer_id,
            'course_code', NEW.code,
            'group_id',    NEW.group_id
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_course_lecturer
    AFTER UPDATE OF lecturer_id ON courses
    FOR EACH ROW EXECUTE FUNCTION audit_course_lecturer_change();


-- ── H7. session.opened ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_session_opened()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM write_audit_log(
        'session.opened',
        'class_sessions',
        NEW.id,
        NULL,
        jsonb_build_object(
            'course_id',  NEW.course_id,
            'started_at', NEW.started_at,
            'venue',      NEW.venue
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_session_opened
    AFTER INSERT ON class_sessions
    FOR EACH ROW EXECUTE FUNCTION audit_session_opened();


-- ── H8. session.closed / session.auto_closed ───────────────────────────────

CREATE OR REPLACE FUNCTION audit_session_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
        PERFORM write_audit_log(
            CASE WHEN NEW.auto_ended THEN 'session.auto_closed' ELSE 'session.closed' END,
            'class_sessions',
            NEW.id,
            jsonb_build_object('ended_at', NULL),
            jsonb_build_object(
                'ended_at',   NEW.ended_at,
                'auto_ended', NEW.auto_ended,
                'course_id',  NEW.course_id
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_session_closed
    AFTER UPDATE OF ended_at ON class_sessions
    FOR EACH ROW EXECUTE FUNCTION audit_session_closed();


-- ── H9. attendance.checked_in ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_attendance_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM write_audit_log(
        'attendance.checked_in',
        'attendance',
        NEW.id,
        NULL,
        jsonb_build_object(
            'session_id',    NEW.session_id,
            'student_id',    NEW.student_id,
            'status',        NEW.status,
            'geo_verified',  NEW.geo_verified,
            'checked_in_at', NEW.checked_in_at
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_attendance_checkin
    AFTER INSERT ON attendance
    FOR EACH ROW EXECUTE FUNCTION audit_attendance_checkin();


-- ── H10. attendance.corrected ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_attendance_corrected()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM write_audit_log(
            'attendance.corrected',
            'attendance',
            NEW.id,
            jsonb_build_object(
                'status',     OLD.status,
                'session_id', OLD.session_id,
                'student_id', OLD.student_id
            ),
            jsonb_build_object('status', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_attendance_corrected
    AFTER UPDATE OF status ON attendance
    FOR EACH ROW EXECUTE FUNCTION audit_attendance_corrected();


-- ── H11. dispute.raised ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_dispute_raised()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM write_audit_log(
        'dispute.raised',
        'attendance_disputes',
        NEW.id,
        NULL,
        jsonb_build_object(
            'attendance_id', NEW.attendance_id,
            'raised_by',     NEW.raised_by,
            'reason',        NEW.reason
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_dispute_raised
    AFTER INSERT ON attendance_disputes
    FOR EACH ROW EXECUTE FUNCTION audit_dispute_raised();


-- ── H12. dispute.resolved ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_dispute_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.status = 'pending'
       AND NEW.status IN ('approved', 'rejected') THEN
        PERFORM write_audit_log(
            'dispute.resolved',
            'attendance_disputes',
            NEW.id,
            jsonb_build_object('status', 'pending'),
            jsonb_build_object(
                'status',          NEW.status,
                'resolved_by',     NEW.resolved_by,
                'resolution_note', NEW.resolution_note
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_dispute_resolved
    AFTER UPDATE OF status ON attendance_disputes
    FOR EACH ROW EXECUTE FUNCTION audit_dispute_resolved();


-- ── H13. group.archived ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_group_archived()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.is_archived = false AND NEW.is_archived = true THEN
        PERFORM write_audit_log(
            'group.archived',
            'groups',
            NEW.id,
            jsonb_build_object('is_archived', false),
            jsonb_build_object(
                'is_archived', true,
                'archived_at', NEW.archived_at,
                'group_name',  NEW.group_name
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_group_archived
    AFTER UPDATE OF is_archived ON groups
    FOR EACH ROW EXECUTE FUNCTION audit_group_archived();
