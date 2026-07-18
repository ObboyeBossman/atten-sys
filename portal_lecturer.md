# ATTEN-SYS — Lecturer Portal
## Coding Agent Prompt & Requirements Document

---

## Project Context

You are building the **Lecturer Portal** for ATTEN-SYS, a university attendance management system. The full stack is **Next.js (App Router)** on the frontend and **Supabase** (PostgreSQL + Auth + Realtime) on the backend, with **Cloudflare R2** for media. The database schema, all RLS policies, trigger functions, and business logic functions are fully deployed. Do not modify the database in any way. Build only the UI and data layer on top of it.

The lecturer portal lives under the route group `/lecturer/...`. Middleware must verify `user_profiles.role = 'lecturer'` AND `user_profiles.is_active = true` for the authenticated user. A user with any other role must be redirected to their appropriate portal or the login page.

---

## Who Is a Lecturer

A lecturer is a user whose `user_profiles.role = 'lecturer'`. Their identity record lives in the `lecturers` table (`id`, `name`, `staff_id`, `phone`). Their scope is the courses where `courses.lecturer_id = auth.uid()` (current assignments) plus any courses recorded in `course_lecturer_history` where `lecturer_id = auth.uid()` (past assignments). The RLS functions `was_lecturer_for_course()`, `was_lecturer_for_session()`, and `is_lecturer_for_group()` enforce this at the database level — the lecturer automatically sees the right data.

A lecturer account is created by the super admin. On first login, `user_profiles.must_change_password = true` must force a password change before any other screen is accessible.

---

## Route Structure

```
/lecturer
  /dashboard                              ← overview: active sessions, today's schedule, stats
  /courses                                ← all current courses across groups
  /courses/[courseId]                     ← course detail: roster, timetable, sessions
  /courses/[courseId]/sessions/new        ← open a new session for this course
  /sessions/[sessionId]                   ← live session management + attendance sheet
  /sessions/[sessionId]/attendance        ← post-session attendance view
  /groups                                 ← all groups the lecturer teaches (current + past)
  /groups/[groupId]                       ← group detail: courses, members
  /disputes                               ← pending disputes across all lecturer's courses
  /disputes/[disputeId]                   ← dispute detail + resolve action
  /history                                ← past courses (from course_lecturer_history)
  /history/[courseId]                     ← archived course attendance records
  /profile                                ← view and edit own profile
```

---

## Functional Requirements

### 1. Authentication

- Lecturers log in via the shared login page. After verifying `role = 'lecturer'`, route to `/lecturer/dashboard`.
- Enforce `must_change_password` redirect to a change-password screen exactly as in the student portal.
- Middleware must re-verify `role = 'lecturer' AND is_active = true` on every `/lecturer/**` request. If `is_active` is set to false by the admin mid-session, the next request must log the lecturer out.
- On logout: `supabase.auth.signOut()` → redirect to `/lecturer/login` (or shared login).

### 2. Dashboard

**Today's schedule:**
- Query `timetables` joined to `courses` where `lecturer_id = auth.uid()` and `day_of_week = today's day of week (0–6)`.
- Show each scheduled slot: course name, group name, start time, end time, venue.
- For each slot, check if a live session already exists (`class_sessions` where `course_id = course.id AND ended_at IS NULL`). If yes: show "Live" badge and link to session. If no: show "Start Session" button.

**Active sessions:**
- Any currently live session across all the lecturer's courses (not just today's timetable).
- Show course name, group, started_at, elapsed time, check-in count vs group size.
- Link to `/lecturer/sessions/[sessionId]`.

**Summary stats (current semester):**
- Total courses assigned.
- Total sessions held.
- Overall attendance rate across all courses.
- Pending disputes count.

**Recent sessions:**
- Last 5 sessions across all courses, with course name, date, and attendance rate.

### 3. Courses

Route: `/lecturer/courses`

- List all `courses` where `lecturer_id = auth.uid()` for the current active semester.
- Show: course name, code, credit hours, group name (join `groups`), session count, average attendance rate.
- Tapping a course goes to `/lecturer/courses/[courseId]`.

**Course detail (`/lecturer/courses/[courseId]`):**

- **Metadata:** course name, code, credit hours, group name, semester.
- **Timetable:** all `timetables` entries for this course. Read-only — lecturers cannot add or remove timetable entries (that is a rep action).
- **Roster:** all students in the course's group (`group_memberships` where `group_id = course.group_id AND status = 'active'`), showing name, index number, photo, and their attendance rate for this course.
  - Clicking a student shows a drawer with their session-by-session attendance breakdown for this course.
- **Sessions list:** all `class_sessions` for this course, ordered by `started_at DESC`. Show date, duration, status (live / ended), attendance count.
- **Open session button:** links to `/lecturer/courses/[courseId]/sessions/new`.

### 4. Open a Session

Route: `/lecturer/courses/[courseId]/sessions/new`

Identical flow to the rep portal session-open screen, with the same validations:

- Form fields: duration (pre-filled from `default_session_duration_minutes`), venue (pre-filled from today's timetable entry if available), notes, timetable link (optional).
- Validate: no existing live session for this course.
- Validate: active semester exists.
- `INSERT INTO class_sessions (course_id, semester_id, timetable_id, duration_minutes, venue, notes, created_by)`.
  - `created_by` references `students(id)` in the schema — for lecturer-opened sessions this field should be NULL since the lecturer is not in the `students` table. Set `created_by = NULL`.
- The `trg_session_created` trigger fires automatically — notifications go out to students. The lecturer also receives their own informational notification (handled by the trigger).
- On success: redirect to `/lecturer/sessions/[newSessionId]`.

### 5. Live Session Management

Route: `/lecturer/sessions/[sessionId]`

Functionally identical to the rep's live session screen. The lecturer has the same write access via the `sessions_write` and `attendance_write` RLS policies.

**Session header:**
- Course name, group name, started_at, elapsed time (live counter), venue.
- "End Session" button with two-step confirmation. On confirm: `SELECT close_session($sessionId, false)`.
- On success: redirect to `/lecturer/sessions/[sessionId]/attendance`.

**Live attendance sheet:**
- All students in the course's group with real-time status via Supabase Realtime subscription on `attendance` filtered by `session_id`.
- Three states: checked in (show badge + selfie thumbnail), pending (show manual mark control), manually marked (show badge + "Marked manually" label).
- Manual mark: same INSERT/UPDATE flow as the rep portal. The lecturer can toggle any student's status at any time during a live session.
- Live counter: checked in / total group size.

### 6. Post-Session Attendance

Route: `/lecturer/sessions/[sessionId]/attendance`

- Static view of the full attendance sheet after the session has ended.
- All students listed: checked in, manually marked, absent.
- Lecturer can still correct records after the session ends (UPDATE `attendance.status`).
- Selfie thumbnails visible for students who self-checked-in.
- CSV export (client-side).

### 7. Groups

Route: `/lecturer/groups`

- List all groups the lecturer teaches in the current semester (`courses` where `lecturer_id = auth.uid()` → `group_id`), deduplicated.
- Also show groups from `course_lecturer_history` where `lecturer_id = auth.uid()` — these appear under an "Archive" section.
- Tapping a group goes to `/lecturer/groups/[groupId]`.

**Group detail (`/lecturer/groups/[groupId]`):**
- Group name, qualification type, level, academic year.
- List of courses the lecturer teaches (or taught) in this group.
- Full student roster for the group (read-only — lecturer cannot add/remove students).
- Overall attendance stats for the group across all the lecturer's courses.

### 8. Disputes

Route: `/lecturer/disputes`

- List all `attendance_disputes` where `status = 'pending'` and the underlying session belongs to one of the lecturer's courses (current or past — `was_lecturer_for_session()` governs this via RLS).
- Show: student name, course name, session date, reason, raised_at.
- Tapping a dispute goes to `/lecturer/disputes/[disputeId]`.

**Dispute detail (`/lecturer/disputes/[disputeId]`):**
- Full context: student name, index number, course, session date, current attendance status, dispute reason, selfie thumbnail (if exists).
- Approve and Reject buttons, each requiring a `resolution_note` (mandatory).
- On action:
  1. `UPDATE attendance_disputes SET status = $action, resolved_by = auth.uid(), resolved_at = now(), resolution_note = $note`.
  2. If approved: `UPDATE attendance SET status = 'present' WHERE id = attendance.id` (lecturer decides the corrected status — provide a status selector in the resolution modal).
- On success: return to disputes list with a success toast.
- Student sees the resolution on their attendance record detail — no separate notification is sent.

### 9. History (Past Courses)

Route: `/lecturer/history`

- List all courses from `course_lecturer_history` where `lecturer_id = auth.uid()`, ordered by `removed_at DESC`.
- Show: course name, group name, semester, assigned_at, removed_at.
- Tapping a course goes to `/lecturer/history/[courseId]`.

**Archived course detail (`/lecturer/history/[courseId]`):**
- Read-only. Shows all sessions and attendance records for this course from the period the lecturer was assigned.
- No write actions — the lecturer cannot modify records for courses they are no longer assigned to. The `is_lecturer_for_course()` (write) vs `was_lecturer_for_course()` (read) distinction in RLS enforces this at the database level. Attempting a write would fail silently — do not show write controls for archived courses.

### 10. Profile

- Display: name, staff_id, email, phone.
- Editable fields: name and phone (`lecturers.name`, `lecturers.phone` via UPDATE — covered by `lecturers_self_update` policy). Email is not editable (lives on `user_profiles`).
- Change password form: same flow as student portal.

---

## Non-Functional Requirements

### Security
- Middleware must verify `role = 'lecturer' AND is_active = true` on every `/lecturer/**` request.
- The lecturer's course scope must always be resolved from the database (`lecturer_id = auth.uid()` or `course_lecturer_history`). Never accept a course ID or group ID from the client that hasn't been validated against the lecturer's actual scope.
- `close_session()` and dispute resolution must be called from Next.js server actions, not client-side Supabase calls.
- Lecturer must never see `groups_secrets`, `audit_log`, or other lecturers' / admins' profiles.

### Performance
- The live session attendance sheet must reflect student check-ins within 2 seconds via Realtime.
- The course roster (potentially 200+ students for large groups) must load efficiently — use server-side pagination or load-on-scroll.
- Dashboard must load within 2 seconds — pre-fetch today's timetable and active sessions in a single parallel query set.

### Reliability
- Realtime subscription must auto-reconnect and show a connection status indicator on the live session screen.
- All write operations must show a loading state and handle errors gracefully with human-readable messages.
- If `close_session()` is called but the session is already closed (e.g. auto-closed by cron between the lecturer's click and the RPC call), handle gracefully — refresh and show the post-session view.

### UX
- The dashboard must make it immediately obvious whether any of the lecturer's sessions are currently live.
- The live session screen must be usable while standing in a classroom — large tap targets, minimal navigation.
- Archive / history must be clearly separated from current courses so the lecturer is never confused about what is active.
- The roster and attendance views must be print-friendly (CSS print styles) since lecturers may want a paper backup.

---

## Data Access Reference

All queries run as the authenticated lecturer. RLS policies enforce course and group scope automatically via `was_lecturer_for_course()`, `was_lecturer_for_session()`, and `is_lecturer_for_group()`.

| Need | Table / Function | Notes |
|---|---|---|
| Own identity | `lecturers`, `user_profiles` | `id = auth.uid()` |
| Current courses | `courses` | `lecturer_id = auth.uid()` |
| Past courses | `course_lecturer_history` | `lecturer_id = auth.uid()` |
| Today's timetable | `timetables` + `courses` | `lecturer_id = auth.uid() AND day_of_week = today` |
| Course roster | `students` + `group_memberships` | `group_id = course.group_id AND status = 'active'` |
| Open session | INSERT `class_sessions` | `created_by = NULL` for lecturer-opened sessions |
| Close session | `close_session(session_id, false)` | Server action RPC |
| Live attendance | `attendance` | Realtime on `session_id` |
| Manual mark (insert) | INSERT `attendance` | No selfie/geo fields |
| Manual mark (update) | UPDATE `attendance` | `attendance_write` policy covers lecturer |
| Pending disputes | `attendance_disputes` | `status = 'pending'`, scoped via RLS |
| Resolve dispute | UPDATE `attendance_disputes` | + UPDATE `attendance.status` if approved |
| Active semester | `app_semesters` | `status = 'active'` |
| System settings | `system_settings` | `default_session_duration_minutes` |
| Update own profile | UPDATE `lecturers` | `lecturers_self_update` policy |

---

## What You Must Not Build

- Any UI for managing courses, timetables, or student rosters (add/remove students, change group membership) — those are rep and admin actions.
- Any ability to view or resolve disputes for sessions outside the lecturer's own course scope.
- Any access to other lecturers' courses, groups, or profiles.
- Any access to `groups_secrets`, `audit_log`, `super_admins`, or `system_settings` write operations.
- Any UI for managing academic years, semesters, or institution skeleton data.
- Write access on the historical (past-course) views — read-only enforced by RLS.
