# ATTEN-SYS — Course Rep Portal
## Coding Agent Prompt & Requirements Document

---

## Project Context

You are building the **Course Rep Portal** for ATTEN-SYS, a university attendance management system. The full stack is **Next.js (App Router)** on the frontend and **Supabase** (PostgreSQL + Auth + Realtime) on the backend, with **Cloudflare R2** for media. The database schema, all RLS policies, trigger functions, and business logic functions are fully deployed. Do not modify the database in any way. Build only the UI and data layer on top of it.

The course rep portal lives under the route group `/rep/...`. Middleware must verify `user_profiles.role = 'student'` AND `group_memberships.is_course_rep = true` AND `group_memberships.status = 'active'` for the authenticated user. A student who is not an active rep must be redirected to `/student/dashboard`. A non-student must be redirected to the login page.

---

## Who Is a Course Rep

A course rep is a student (`user_profiles.role = 'student'`) whose active `group_memberships` row has `is_course_rep = true`. They are assigned by the super admin. Their scope is strictly limited to their own group — identified by `group_memberships.group_id` where `student_id = auth.uid() AND status = 'active' AND is_course_rep = true`.

A rep can do everything a student can do (check in, view their own attendance, raise disputes). The rep portal is in addition to, not instead of, the student portal. The rep portal provides the management layer on top.

---

## Route Structure

```
/rep
  /dashboard                          ← summary: group stats, active session status
  /students                           ← group roster
  /students/add                       ← add student by serial number
  /courses                            ← list of courses for this group + semester
  /courses/[courseId]                 ← course detail: timetable, sessions list
  /courses/[courseId]/sessions        ← all sessions for this course
  /courses/[courseId]/sessions/new    ← open a new session
  /sessions/[sessionId]               ← live session management + attendance sheet
  /sessions/[sessionId]/attendance    ← full attendance list for a session
  /disputes                           ← all pending disputes across the group
  /disputes/[disputeId]               ← dispute detail + resolve action
  /timetable                          ← group timetable view
```

---

## Functional Requirements

### 1. Authentication and Role Guard

- The rep logs in via the shared login page. After verifying role = 'student', the app checks `group_memberships` for `is_course_rep = true AND status = 'active'`. If true, route to `/rep/dashboard`. If not, route to `/student/dashboard`.
- Middleware must enforce this check on every request to `/rep/**`. If the rep's `is_course_rep` is revoked mid-session, the next request must redirect them to `/student/dashboard`.
- The rep must also be subject to the `must_change_password` check — same as the student portal.

### 2. Dashboard

**Active session card:**
- Query `class_sessions` for any session where `course_id` belongs to the rep's group AND `ended_at IS NULL`.
- If an active session exists: show course name, started_at, number of students checked in vs total group size, and a "Manage Session" button linking to `/rep/sessions/[sessionId]`.
- If no active session: show a neutral state with a quick-action button to open a new session (links to course selection first).

**Group summary cards:**
- Total students in the group (`group_memberships` where `group_id = rep's group AND status = 'active'`).
- Total courses this semester.
- Total sessions held this semester.
- Overall group attendance rate for the current semester (aggregate across all courses).

**Recent sessions:**
- Last 5 sessions across all courses in the group, showing course name, date, and attendance rate (checked in / total).

### 3. Student Roster

- List all `students` who have an active `group_memberships` row for the rep's group.
- Show: name, index number, photo (from R2 via `students.photo_path`), and overall attendance rate for the current semester.
- Search by name or index number (client-side filter on the loaded list, or a Supabase `.ilike()` query).
- Tapping a student shows a drawer or modal with their full attendance breakdown per course for the current semester.
- No ability to edit or delete students from this screen — that is a super admin action.

### 4. Add Student

Route: `/rep/students/add`

- Single input field: **serial number only** (e.g. `197`). The rep does not type the full index number — it is assembled server-side by `add_student_to_group(p_group_id, p_serial, p_name)`.
- Optional name field. If not provided, the function defaults the name to the assembled index number.
- On submit: call `SELECT * FROM add_student_to_group($group_id, $serial, $name)` via a Supabase RPC call from a Next.js server action.
- Handle all four outcomes explicitly in the UI:
  - `created` → "Student BC/ITS/24/197 added successfully. They can now log in."
  - `reactivated` → "Student BC/ITS/24/197 reactivated and added to this group."
  - `membership_added` → "Student BC/ITS/24/197 was already registered and has been added to this group."
  - `already_member` → "Student BC/ITS/24/197 is already an active member of this group."
- On error (from the function's RAISE EXCEPTION): show the error message clearly. Common cases: serial out of range (1–999), group archived.
- After a successful `created` or `reactivated` outcome, display the generated email and a note that the student's initial password is the group's default password (do not display the password itself — the rep doesn't need it and it's in `groups_secrets` which RLS blocks them from reading).

### 5. Courses

- List all `courses` where `group_id = rep's group AND semester_id = active semester`.
- Show: course name, code, credit hours, assigned lecturer name (join `lecturers`).
- Tapping a course goes to `/rep/courses/[courseId]`.

**Course detail (`/rep/courses/[courseId]`):**
- Show course metadata (name, code, credit hours, lecturer).
- Show the timetable entries for this course (`timetables` where `course_id = courseId`): day, start time, end time, venue.
- Show a list of all sessions for this course with date, duration, attendance count, and status (live / ended).
- Button to open a new session → `/rep/courses/[courseId]/sessions/new`.

### 6. Open a Session

Route: `/rep/courses/[courseId]/sessions/new`

- Form fields:
  - Duration (minutes) — pre-filled with `default_session_duration_minutes` from `system_settings`, editable.
  - Venue — optional text field, pre-filled from the course's timetable entry for today's day of week if one exists.
  - Notes — optional.
  - Timetable link — optional dropdown of timetable entries for this course so the rep can link the session to a scheduled slot (`timetable_id`).
- Validation: check there is no existing live session for this course before allowing submit (`class_sessions` where `course_id = courseId AND ended_at IS NULL`). If one exists, show "A session is already live for this course" and link to it.
- The `semester_id` must be the currently active semester (`app_semesters` where `status = 'active'`). If no active semester, show "No active semester. Contact the admin to open a semester before starting sessions."
- On submit: `INSERT INTO class_sessions (course_id, semester_id, timetable_id, duration_minutes, venue, notes, created_by)`.
- The `trg_session_created` trigger fires automatically — it fans out notifications to all active students in the group and to the assigned lecturer. The rep does not need to trigger this manually.
- On success: redirect to `/rep/sessions/[newSessionId]`.

### 7. Live Session Management

Route: `/rep/sessions/[sessionId]`

This is the most important screen in the rep portal.

**Session header:**
- Course name, started_at, elapsed time (live counter), venue.
- "End Session" button — prominent, requires a confirmation dialog ("Are you sure? This will close check-in for all students."). On confirm: call `SELECT close_session($sessionId, false)` via Supabase RPC. On success: redirect to `/rep/sessions/[sessionId]/attendance`.

**Attendance sheet (live):**
- List every student in the group with their current attendance status for this session.
- Three states per student:
  - **Checked in** (attendance row exists): show status badge (present / late), check-in time, geo-verified indicator, selfie thumbnail (load from R2 via `attendance.selfie_path`).
  - **Not yet checked in** (no attendance row): show "Pending" with a manual mark dropdown.
  - **Manually marked** (attendance row exists, no selfie_path): show status badge and "Marked manually" label.
- The list must update in real time as students check in. Use a Supabase Realtime subscription on `attendance` filtered by `session_id = sessionId`.
- Checked-in count vs total group size displayed prominently at the top.

**Manual mark:**
- For any student (whether they have an attendance row or not), the rep can set their status to `present`, `late`, or `absent`.
- If no attendance row exists: INSERT with `status = chosen`, `session_id`, `student_id`, all geo/selfie fields NULL.
- If an attendance row exists: UPDATE `attendance.status`.
- Both operations are covered by the `attendance_write` policy (UPDATE) and rep's general write access. Use a small inline dropdown or toggle — not a full-page navigation.
- Show a confirmation on success: "Marked [student name] as [status]."

### 8. Session Attendance (Post-Session)

Route: `/rep/sessions/[sessionId]/attendance`

- Same layout as the live attendance sheet but static (session has ended).
- Shows full attendance breakdown: checked in / manually marked / absent.
- Each absent student has a "Mark Present/Late" override button (same manual mark flow as above) — reps can correct records after the session ends.
- Export button: download the attendance sheet as CSV (client-side, using the loaded data — no server-side export needed).

### 9. Disputes

Route: `/rep/disputes`

- List all `attendance_disputes` where the underlying `attendance.session_id` → `class_sessions.course_id` → `courses.group_id = rep's group`, filtered to `status = 'pending'`.
- Show: student name, course name, session date, reason, raised_at.
- Tapping a dispute goes to `/rep/disputes/[disputeId]`.

**Dispute detail (`/rep/disputes/[disputeId]`):**
- Show full context: student name, course, session date, student's current attendance status, the reason for the dispute.
- If the student has a selfie, show the thumbnail.
- Two action buttons: **Approve** and **Reject**, each opening a modal with a `resolution_note` textarea (mandatory).
- On action: `UPDATE attendance_disputes SET status = $action, resolved_by = auth.uid(), resolved_at = now(), resolution_note = $note WHERE id = $disputeId`.
- If approved: also update the linked `attendance.status` to `present` (or whatever is appropriate based on the dispute reason — the rep decides). This is a second UPDATE on `attendance`.
- On success: redirect back to `/rep/disputes`.
- The student will see the resolution when they view that attendance record — no separate notification is sent.

### 10. Timetable

Route: `/rep/timetable`

- Weekly grid view of all timetable entries for all courses in the rep's group.
- Shows: course name, venue, start/end time for each slot.
- Read-only in the rep portal — timetable entries are managed by the rep via the course detail screen (add/remove timetable slots).

**Add timetable entry** (from `/rep/courses/[courseId]`):
- Form: day of week (dropdown 0–6), start time, end time, venue.
- `INSERT INTO timetables (course_id, group_id, day_of_week, start_time, end_time, venue)`.
- Validation: `end_time > start_time` (also enforced by DB constraint).

**Remove timetable entry:**
- DELETE the timetable row. Only allowed if no `class_sessions` are linked to it (`timetable_id IS NOT NULL`). If sessions are linked, show "Cannot remove this slot — sessions are linked to it."

---

## Non-Functional Requirements

### Security
- Middleware must check both `role = 'student'` AND `is_course_rep = true` AND `status = 'active'` on every `/rep/**` request.
- The rep's group ID must always be resolved server-side from `group_memberships`. Never accept a group ID from query parameters or the client body for operations that should be scoped to the rep's own group.
- All Supabase RPC calls (`add_student_to_group`, `close_session`) must be made from Next.js server actions, not client-side code, so the service role key or authenticated session is never exposed.

### Performance
- The live session attendance sheet must reflect new check-ins within 2 seconds via Realtime subscription.
- The student roster page must handle groups of up to 300 students without pagination if possible; use virtual scrolling if the list causes performance issues.
- Realtime subscriptions must reconnect automatically and show a "Reconnecting…" indicator if the connection drops.

### Reliability
- All write operations (open session, mark attendance, resolve dispute) must show optimistic UI with rollback on failure.
- The "End Session" confirmation dialog must be impossible to accidentally trigger — require a deliberate two-step confirmation.
- If `close_session()` returns an error ("Session is already closed"), handle gracefully — refresh the session state and show the post-session attendance view.

### UX
- The live session screen is used under time pressure — the rep is standing in a classroom. Interactions must be one or two taps maximum.
- Manual mark must be accessible directly from the attendance list row without navigating away.
- The dashboard must give the rep an instant answer to "is a session live right now?" as the first thing they see.

---

## Data Access Reference

All queries run as the authenticated rep (student role, is_course_rep = true). RLS policies enforce group scope automatically.

| Need | Table / Function | Notes |
|---|---|---|
| Rep's group | `group_memberships` | `student_id = auth.uid() AND is_course_rep = true AND status = 'active'` |
| Group roster | `students` + `group_memberships` | Join on `group_id = rep's group AND status = 'active'` |
| Add student | `add_student_to_group(group_id, serial, name)` | Supabase RPC, server action only |
| Courses this semester | `courses` | `group_id = rep's group AND semester_id = active semester` |
| Active semester | `app_semesters` | `status = 'active'` |
| Open session | INSERT `class_sessions` | Trigger fires notifications automatically |
| Close session | `close_session(session_id, false)` | Supabase RPC |
| Live attendance | `attendance` | Realtime subscription on `session_id` |
| Manual mark (insert) | INSERT `attendance` | No selfie/geo fields required |
| Manual mark (update) | UPDATE `attendance` | `attendance_write` policy covers rep |
| Pending disputes | `attendance_disputes` | `status = 'pending'`, scoped via RLS |
| Resolve dispute | UPDATE `attendance_disputes` | Set status, resolved_by, resolved_at, resolution_note |
| Timetable entries | `timetables` | `group_id = rep's group` |
| System settings | `system_settings` | `default_session_duration_minutes`, `late_threshold_minutes` |
| Lecturer info | `lecturers` | Join on `courses.lecturer_id` |

---

## What You Must Not Build

- Any UI for managing other groups, other semesters' courses, or institution skeleton data.
- Any ability to create, edit, or delete courses — course creation is a super admin action.
- Any ability to assign or remove the rep role from students — that is a super admin action.
- Any ability to view or manage disputes for sessions outside the rep's own group.
- Any access to `groups_secrets`, `audit_log`, or `super_admins` tables.
- Any client-side Supabase calls using the service role key.
