-- =============================================================================
-- ATTEN-SYS — 0004_rls.sql
-- Row Level Security: enable, policies, table by table.
-- Apply after 0003_triggers.sql, before 0005_seed.sql.
--
-- Design principles:
--   • Every table has RLS enabled — there are no unprotected tables.
--   • All RLS helpers (is_super_admin, is_rep_in_group, …) are SECURITY
--     DEFINER + STABLE, defined in 0002_functions.sql. They are called here
--     by name; do not inline their logic into policies.
--   • Helpers ending in  is_*  (active-only) are used in WRITE policies.
--     Helpers ending in was_*  (historical)  are used in SELECT policies.
--   • groups_secrets is admin-only — never exposed to students, reps, or
--     lecturers. BUG FIX: this separates the secret from the world-readable
--     groups skeleton SELECT policy.
--   • audit_log has an explicit DENY INSERT policy so the intent is visible
--     in pg_policies. write_audit_log() (SECURITY DEFINER, postgres) bypasses
--     this; no application role should ever insert directly.
--   • notifications INSERT is locked to SECURITY DEFINER trigger paths
--     (push_session_notifications, dismiss_on_checkin). No end-user inserts.
--   • Write policies on group-scoped tables include an archive guard:
--       NOT is_group_archived(…)  or  NOT is_course_group_archived(…)
--     so archived groups become fully read-only for everyone except
--     super_admin (who may need to correct historical records).
--
-- Table order follows the schema dependency chain so DROP POLICY / CREATE
-- POLICY pairs remain readable at a glance.
-- =============================================================================


-- ===========================================================================
-- 1. Enable RLS on every table
-- ===========================================================================

ALTER TABLE faculties               ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_types     ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years          ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups_secrets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_semesters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE students                ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecturers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lecturer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables              ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance              ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_disputes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log               ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings         ENABLE ROW LEVEL SECURITY;


-- ===========================================================================
-- 2. Institution skeleton
--    faculties, departments, programmes, qualification_types, levels,
--    academic_years, groups, app_semesters
--
--    SELECT: world-readable (students, reps, lecturers need to read these).
--    ALL:    super_admin only.
-- ===========================================================================

CREATE POLICY "skeleton_select" ON faculties            FOR SELECT USING (true);
CREATE POLICY "skeleton_write"  ON faculties            FOR ALL    USING (is_super_admin());

CREATE POLICY "skeleton_select" ON departments          FOR SELECT USING (true);
CREATE POLICY "skeleton_write"  ON departments          FOR ALL    USING (is_super_admin());

CREATE POLICY "skeleton_select" ON programmes           FOR SELECT USING (true);
CREATE POLICY "skeleton_write"  ON programmes           FOR ALL    USING (is_super_admin());

CREATE POLICY "skeleton_select" ON qualification_types  FOR SELECT USING (true);
CREATE POLICY "skeleton_write"  ON qualification_types  FOR ALL    USING (is_super_admin());

CREATE POLICY "skeleton_select" ON levels               FOR SELECT USING (true);
CREATE POLICY "skeleton_write"  ON levels               FOR ALL    USING (is_super_admin());

CREATE POLICY "skeleton_select" ON academic_years       FOR SELECT USING (true);
CREATE POLICY "skeleton_write"  ON academic_years       FOR ALL    USING (is_super_admin());

CREATE POLICY "skeleton_select" ON groups               FOR SELECT USING (true);
CREATE POLICY "skeleton_write"  ON groups               FOR ALL    USING (is_super_admin());

CREATE POLICY "skeleton_select" ON app_semesters        FOR SELECT USING (true);
CREATE POLICY "skeleton_write"  ON app_semesters        FOR ALL    USING (is_super_admin());


-- ===========================================================================
-- 3. groups_secrets
--
--    BUG FIX: In the original chain, groups.default_password was exposed to
--    every user via the world-readable skeleton SELECT policy. This table
--    exists to hold that secret behind an admin-only gate.
--
--    add_student_to_group() (SECURITY DEFINER) reads it directly and never
--    returns the password to the caller.
--
--    SELECT: super_admin only.
--    ALL:    super_admin only.
-- ===========================================================================

CREATE POLICY "secrets_admin_only" ON groups_secrets FOR ALL USING (is_super_admin());


-- ===========================================================================
-- 4. user_profiles
--
--    SELECT: own row OR super_admin OR lecturer seeing a student in their group.
--    UPDATE: own row (any user updates phone/etc.) OR super_admin.
--    INSERT: super_admin only — normal path is the handle_new_user() trigger
--            which runs as SECURITY DEFINER (postgres) and bypasses RLS.
--    DELETE: super_admin only (soft-delete via is_active is the standard path).
--
--    Lecturer read scope: profiles of students who belong to groups they teach
--    (current or past). Lecturers cannot read other lecturers' or admins'
--    profiles — those remain own-row-only for non-admins.
-- ===========================================================================

CREATE POLICY "profiles_select" ON user_profiles
    FOR SELECT USING (
        id = auth.uid()
        OR is_super_admin()
        OR (
            -- Lecturer sees profiles of students in groups they teach
            EXISTS (
                SELECT 1
                FROM   students s
                JOIN   group_memberships gm ON gm.student_id = s.id
                WHERE  s.id = user_profiles.id
                  AND  is_lecturer_for_group(gm.group_id)
            )
            AND EXISTS (
                SELECT 1 FROM user_profiles up2
                WHERE  up2.id   = auth.uid()
                  AND  up2.role = 'lecturer'
            )
        )
    );

CREATE POLICY "profiles_update" ON user_profiles
    FOR UPDATE USING (id = auth.uid() OR is_super_admin());

CREATE POLICY "profiles_insert" ON user_profiles
    FOR INSERT WITH CHECK (is_super_admin());

CREATE POLICY "profiles_delete" ON user_profiles
    FOR DELETE USING (is_super_admin());


-- ===========================================================================
-- 5. super_admins
--
--    ALL: super_admin only. The singleton guard is in
--    trg_enforce_single_super_admin (0003_triggers.sql).
-- ===========================================================================

CREATE POLICY "super_admins_admin_only" ON super_admins
    FOR ALL USING (is_super_admin());


-- ===========================================================================
-- 6. students
--
--    SELECT:
--      • Student sees their own row.
--      • Super admin sees all.
--      • Active course rep sees every student in their group.
--      • Lecturer sees every student in groups they teach (current or past).
--
--    WRITE (INSERT / UPDATE / DELETE):
--      • Active course rep manages students in their own group.
--      • Super admin manages all.
--      • add_student_to_group() (SECURITY DEFINER) inserts directly and
--        bypasses RLS — this is the normal student creation path.
-- ===========================================================================

CREATE POLICY "students_select" ON students
    FOR SELECT USING (
        id = auth.uid()
        OR is_super_admin()
        OR EXISTS (
            -- Active rep sees students in their group
            SELECT 1
            FROM   group_memberships gm_student
            JOIN   group_memberships gm_rep
                   ON gm_rep.group_id = gm_student.group_id
            WHERE  gm_student.student_id = students.id
              AND  gm_rep.student_id     = auth.uid()
              AND  gm_rep.is_course_rep  = true
              AND  gm_rep.status         = 'active'
        )
        OR EXISTS (
            -- Lecturer sees students in groups they teach (current or past)
            SELECT 1
            FROM   group_memberships gm
            WHERE  gm.student_id = students.id
              AND  is_lecturer_for_group(gm.group_id)
        )
    );

CREATE POLICY "students_write" ON students
    FOR ALL USING (
        is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM   group_memberships gm_student
            JOIN   group_memberships gm_rep
                   ON gm_rep.group_id = gm_student.group_id
            WHERE  gm_student.student_id = students.id
              AND  gm_rep.student_id     = auth.uid()
              AND  gm_rep.is_course_rep  = true
              AND  gm_rep.status         = 'active'
        )
    );


-- ===========================================================================
-- 7. group_memberships
--
--    SELECT:
--      • Student sees their own memberships (all historical).
--      • Super admin sees all.
--      • Active rep sees all memberships in their group.
--      • Past rep (was_rep_in_group) keeps read access to the group's history.
--      • Lecturer (is_lecturer_for_group) sees memberships in groups they
--        teach — needed to build a class roster and resolve student IDs.
--
--    WRITE (INSERT / UPDATE / DELETE):
--      • Super admin only. promote_students_to_new_year() and
--        add_student_to_group() both run SECURITY DEFINER and bypass RLS
--        for their membership inserts — this is intentional.
--      • Archive guard: super_admin cannot write to archived groups through
--        this policy (they go through the SECURITY DEFINER function instead).
-- ===========================================================================

CREATE POLICY "gm_select" ON group_memberships
    FOR SELECT USING (
        student_id = auth.uid()
        OR is_super_admin()
        OR is_rep_in_group(group_id)
        OR was_rep_in_group(group_id)
        OR is_lecturer_for_group(group_id)
    );

CREATE POLICY "gm_write" ON group_memberships
    FOR ALL USING (
        is_super_admin()
        AND NOT is_group_archived(group_id)
    );


-- ===========================================================================
-- 8. lecturers
--
--    SELECT: world-readable — students and reps need to see lecturer names on
--    their timetable and course list.
--
--    Lecturer self-update: a lecturer may edit their own name and phone (not
--    email — that lives on user_profiles).
--
--    Admin write: super_admin creates, edits, and deletes lecturer accounts.
-- ===========================================================================

CREATE POLICY "lecturers_select" ON lecturers
    FOR SELECT USING (true);

CREATE POLICY "lecturers_self_update" ON lecturers
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "lecturers_admin_write" ON lecturers
    FOR ALL USING (is_super_admin());


-- ===========================================================================
-- 9. course_lecturer_history
--
--    SELECT:
--      • Lecturer sees their own history rows.
--      • Super admin sees all.
--
--    INSERT: blocked via RLS — the log_lecturer_reassignment() trigger
--    (SECURITY DEFINER) is the only write path. No direct inserts by
--    any role (including super_admin) — this table is append-only by design.
--
--    UPDATE / DELETE: denied for everyone. History is immutable.
-- ===========================================================================

CREATE POLICY "clh_select" ON course_lecturer_history
    FOR SELECT USING (
        lecturer_id = auth.uid()
        OR is_super_admin()
    );

-- Explicit DENY for INSERT, UPDATE, DELETE — only the SECURITY DEFINER
-- trigger may write here.
CREATE POLICY "clh_deny_direct_write" ON course_lecturer_history
    FOR INSERT WITH CHECK (false);

CREATE POLICY "clh_deny_update" ON course_lecturer_history
    FOR UPDATE USING (false);

CREATE POLICY "clh_deny_delete" ON course_lecturer_history
    FOR DELETE USING (false);


-- ===========================================================================
-- 10. courses
--
--    SELECT:
--      • Any student/rep who is (or was) a member of the course's group.
--      • Lecturer who is (or was) assigned to the course.
--      • Super admin.
--
--    INSERT / DELETE: rep (active, in the course's group) OR super_admin.
--      Archive guard: rejected if the group is archived.
--
--    UPDATE (general): same as INSERT/DELETE scope.
--      Archive guard applied.
--
--    UPDATE (lecturer only): a lecturer may update their own course details
--      (name, credit_hours) but cannot INSERT or DELETE.
--      Archive guard applied.
-- ===========================================================================

CREATE POLICY "courses_select" ON courses
    FOR SELECT USING (
        has_group_membership(group_id)
        OR was_lecturer_for_course(id)
        OR is_super_admin()
    );

CREATE POLICY "courses_rep_or_admin_write" ON courses
    FOR ALL USING (
        NOT is_group_archived(group_id)
        AND (is_rep_in_group(group_id) OR is_super_admin())
    );

-- Lecturers may UPDATE only, not INSERT or DELETE.
CREATE POLICY "courses_lecturer_update" ON courses
    FOR UPDATE USING (
        NOT is_course_group_archived(id)
        AND is_lecturer_for_course(id)
    );


-- ===========================================================================
-- 11. timetables
--
--    SELECT:
--      • Any student/rep who is (or was) a member of the timetable's group.
--      • Lecturer who is (or was) assigned to the course.
--      • Super admin.
--
--    WRITE: rep (active) OR super_admin, archive-guarded.
-- ===========================================================================

CREATE POLICY "timetables_select" ON timetables
    FOR SELECT USING (
        has_group_membership(group_id)
        OR was_lecturer_for_course(course_id)
        OR is_super_admin()
    );

CREATE POLICY "timetables_write" ON timetables
    FOR ALL USING (
        NOT is_group_archived(group_id)
        AND (is_rep_in_group(group_id) OR is_super_admin())
    );


-- ===========================================================================
-- 12. class_sessions
--
--    SELECT:
--      • Any student/rep who is (or was ever) a member of the session's group.
--      • Past rep (was_rep_in_group) keeps read access to archived sessions.
--      • Lecturer who is (or was) assigned to the course.
--      • Super admin.
--
--    WRITE: rep (active) OR lecturer (current, for their course) OR super_admin.
--      Archive guard prevents new sessions in archived groups.
-- ===========================================================================

CREATE POLICY "sessions_select" ON class_sessions
    FOR SELECT USING (
        has_group_membership(group_id_for_course(course_id))
        OR was_rep_in_group(group_id_for_course(course_id))
        OR was_lecturer_for_course(course_id)
        OR is_super_admin()
    );

CREATE POLICY "sessions_write" ON class_sessions
    FOR ALL USING (
        NOT is_course_group_archived(course_id)
        AND (
            is_rep_in_group(group_id_for_course(course_id))
            OR is_lecturer_for_course(course_id)
            OR is_super_admin()
        )
    );


-- ===========================================================================
-- 13. attendance
--
--    SELECT:
--      • Student sees their own record.
--      • Any student/rep who is (or was ever) a member of the session's group.
--      • Past rep keeps read access to group's attendance history.
--      • Lecturer (current or past) sees attendance for their sessions.
--      • Super admin.
--
--    INSERT (student check-in): student inserts their own row, archive-guarded.
--
--    UPDATE (correction): rep (active) OR lecturer (current) OR super_admin,
--      archive-guarded.
--
--    Note: students do NOT have UPDATE access — they raise disputes instead.
-- ===========================================================================

CREATE POLICY "attendance_select" ON attendance
    FOR SELECT USING (
        student_id = auth.uid()
        OR has_group_membership(group_id_for_session(session_id))
        OR was_rep_in_group(group_id_for_session(session_id))
        OR was_lecturer_for_session(session_id)
        OR is_super_admin()
    );

CREATE POLICY "attendance_student_checkin" ON attendance
    FOR INSERT WITH CHECK (
        student_id = auth.uid()
        AND NOT is_session_group_archived(session_id)
    );

CREATE POLICY "attendance_write" ON attendance
    FOR UPDATE USING (
        NOT is_session_group_archived(session_id)
        AND (
            is_rep_in_group(group_id_for_session(session_id))
            OR is_lecturer_for_session(session_id)
            OR is_super_admin()
        )
    );


-- ===========================================================================
-- 14. attendance_disputes
--
--    SELECT:
--      • Student who raised the dispute.
--      • Past rep for the session's group.
--      • Lecturer (current or past) for the session.
--      • Super admin.
--
--    INSERT (raise): student inserts their own dispute, archive-guarded.
--
--    UPDATE (resolve): rep (active) OR lecturer (current) OR super_admin,
--      archive-guarded.
-- ===========================================================================

CREATE POLICY "disputes_select" ON attendance_disputes
    FOR SELECT USING (
        raised_by = auth.uid()
        OR was_rep_in_group(group_id_for_session(
            (SELECT session_id FROM attendance WHERE id = attendance_id)
        ))
        OR was_lecturer_for_session(
            (SELECT session_id FROM attendance WHERE id = attendance_id)
        )
        OR is_super_admin()
    );

CREATE POLICY "disputes_student_raise" ON attendance_disputes
    FOR INSERT WITH CHECK (
        raised_by = auth.uid()
        AND NOT is_session_group_archived(
            (SELECT session_id FROM attendance WHERE id = attendance_id)
        )
    );

CREATE POLICY "disputes_resolve" ON attendance_disputes
    FOR UPDATE USING (
        NOT is_session_group_archived(
            (SELECT session_id FROM attendance WHERE id = attendance_id)
        )
        AND (
            is_rep_in_group(group_id_for_session(
                (SELECT session_id FROM attendance WHERE id = attendance_id)
            ))
            OR is_lecturer_for_session(
                (SELECT session_id FROM attendance WHERE id = attendance_id)
            )
            OR is_super_admin()
        )
    );


-- ===========================================================================
-- 15. notifications
--
--    SELECT: own row only.
--    UPDATE: own row (mark as read / dismiss) OR super_admin.
--    INSERT: DENY for all direct callers.
--      push_session_notifications() and dismiss_on_checkin() run as SECURITY
--      DEFINER (postgres) and bypass this policy. No end-user or service-role
--      client should insert notifications directly.
--    DELETE: own row OR super_admin (e.g. purge old notifications).
-- ===========================================================================

CREATE POLICY "notifications_select" ON notifications
    FOR SELECT USING (user_id = auth.uid() OR is_super_admin());

CREATE POLICY "notifications_update" ON notifications
    FOR UPDATE USING (user_id = auth.uid() OR is_super_admin());

-- Explicit DENY — only SECURITY DEFINER trigger functions write here.
CREATE POLICY "notifications_deny_direct_insert" ON notifications
    FOR INSERT WITH CHECK (false);

CREATE POLICY "notifications_delete" ON notifications
    FOR DELETE USING (user_id = auth.uid() OR is_super_admin());


-- ===========================================================================
-- 16. audit_log
--
--    SELECT: super_admin only.
--    INSERT: explicit DENY — write_audit_log() (SECURITY DEFINER, postgres)
--      is the sole write path and bypasses this policy.
--    UPDATE / DELETE: denied for everyone. The log is immutable.
-- ===========================================================================

CREATE POLICY "audit_log_select" ON audit_log
    FOR SELECT USING (is_super_admin());

-- Explicit DENY for all writes. write_audit_log() bypasses RLS.
CREATE POLICY "audit_log_deny_insert" ON audit_log
    FOR INSERT WITH CHECK (false);

CREATE POLICY "audit_log_deny_update" ON audit_log
    FOR UPDATE USING (false);

CREATE POLICY "audit_log_deny_delete" ON audit_log
    FOR DELETE USING (false);


-- ===========================================================================
-- 17. system_settings
--
--    SELECT: world-readable — clients need GPS floor, late threshold, etc.
--    ALL:    super_admin only.
-- ===========================================================================

CREATE POLICY "settings_select" ON system_settings FOR SELECT USING (true);
CREATE POLICY "settings_write"  ON system_settings FOR ALL    USING (is_super_admin());


-- =============================================================================
-- Access matrix summary
--
--  Table                  | super_admin | rep (active) | lecturer        | student
--  -----------------------|-------------|--------------|-----------------|--------
--  faculties … semesters  | CRUD        | R            | R               | R
--  groups_secrets         | CRUD        | —            | —               | —
--  user_profiles          | CRUD        | R (own)      | R (own + group) | R (own)
--  super_admins           | CRUD        | —            | —               | —
--  students               | CRUD        | CRUD (group) | R (group)       | R (own)
--  group_memberships      | CRUD*       | R (group)    | R (group)       | R (own)
--  lecturers              | CRUD        | R            | R + U (own)     | R
--  course_lecturer_history| R           | —            | R (own rows)    | —
--  courses                | CRUD        | CRUD (group) | R + U (own)     | R (group)
--  timetables             | CRUD        | CRUD (group) | R (own course)  | R (group)
--  class_sessions         | CRUD        | CRUD (group) | CRUD (own)      | R (group)
--  attendance             | CRUD        | R+U (group)  | R+U (own)       | R(own)+I
--  attendance_disputes    | CRUD        | R+U (group)  | R+U (own)       | R+I (own)
--  notifications          | CRUD        | —            | R+U (own)       | R+U (own)
--  audit_log              | R           | —            | —               | —
--  system_settings        | CRUD        | R            | R               | R
--
--  * group_memberships writes for rep/lecturer go through SECURITY DEFINER
--    functions (add_student_to_group, promote_students_to_new_year) that
--    bypass RLS — this is intentional and documented.
--  All write policies on group-scoped tables include an archive guard:
--    archived groups become read-only for everyone.
-- =============================================================================
