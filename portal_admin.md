# ATTEN-SYS — Super Admin Portal
## Coding Agent Prompt & Requirements Document

---

## Project Context

You are building the **Super Admin Portal** for ATTEN-SYS, a university attendance management system. The full stack is **Next.js (App Router)** on the frontend and **Supabase** (PostgreSQL + Auth + Realtime) on the backend. The database schema, all RLS policies, trigger functions, and business logic functions are fully deployed. Do not modify the database in any way. Build only the UI and data layer on top of it.

The super admin portal lives under the route group `/admin/...`. Middleware must verify `user_profiles.role = 'super_admin'` AND `user_profiles.is_active = true` for every request. Any other role must be redirected to their own portal or the login page.

There is exactly one super admin in the system at all times — enforced by `trg_enforce_single_super_admin`. The admin account is created outside the app (via Supabase Auth dashboard), then completed by inserting into `super_admins`. The portal assumes this bootstrapping has already been done.

---

## Who Is the Super Admin

A super admin is a user whose `user_profiles.role = 'super_admin'`. Their identity record lives in `super_admins` (`id`, `name`). They have unrestricted read and write access to every table in the system. They are the only user who can see the `audit_log` and `groups_secrets` tables. They own the full institution lifecycle: skeleton data, academic years, semesters, user accounts, rep assignments, and year-end promotion.

---

## Route Structure

```
/admin
  /dashboard                              ← system overview: live sessions, stats, alerts
  /institution                            ← institution skeleton management
    /faculties                            ← list + create/edit faculties
    /departments                          ← list + create/edit departments
    /programmes                           ← list + create/edit programmes
    /qualification-types                  ← list + create/edit qualification types
    /levels                               ← list + create/edit levels per qualification type
  /academic-years                         ← list + manage academic years
  /academic-years/[yearId]                ← year detail: semesters, groups
  /academic-years/[yearId]/promote        ← run year-end student promotion
  /semesters                              ← list all semesters with open/close controls
  /groups                                 ← all groups across all years
  /groups/[groupId]                       ← group detail: students, courses, rep assignment
  /users                                  ← all user accounts (students, lecturers, admins)
  /users/students                         ← student accounts
  /users/lecturers                        ← lecturer accounts: create, edit, deactivate
  /courses                                ← all courses across all groups
  /courses/[courseId]                     ← course detail: assign lecturer
  /audit                                  ← audit log viewer
  /settings                               ← system_settings management
  /profile                                ← admin's own profile
```

---

## Functional Requirements

### 1. Authentication

- The super admin logs in via the shared login page. After verifying `role = 'super_admin'`, route to `/admin/dashboard`.
- `must_change_password` check applies — redirect to change-password screen if true.
- Middleware must re-verify `role = 'super_admin' AND is_active = true` on every `/admin/**` request.
- On logout: `supabase.auth.signOut()` → redirect to login.

### 2. Dashboard

**Live sessions panel:**
- Query all `class_sessions` where `ended_at IS NULL` across the entire system.
- For each: course name, group name, lecturer or rep who opened it, started_at, elapsed time, check-in count vs group size.
- No action buttons — this is read-only monitoring. The admin does not close sessions from here.

**System health cards:**
- Active semester name and status.
- Current academic year.
- Total active students.
- Total active lecturers.
- Sessions held today.
- Pending disputes count (system-wide).

**Recent audit events:**
- Last 10 rows from `audit_log`, showing action, actor, table_name, created_at.
- Link to full audit log at `/admin/audit`.

**Alerts:**
- Any semester with `status = 'upcoming' AND start_date <= today AND auto_open = false` → warn "Semester [name] should have opened — open it manually."
- Any open session older than 4 hours → warn "Session [course name] has been running for [X] hours — may need closing."

### 3. Institution Skeleton

The institution skeleton is the hierarchy: **faculty → department → programme → qualification type → level**. All tables are world-readable but only the super admin can write to them.

Each entity follows the same CRUD pattern:

**Faculties (`/admin/institution/faculties`):**
- List all faculties (name, department count, created_at).
- Create: form with `name` (unique). INSERT `faculties`.
- Edit: update `name`. UPDATE `faculties`.
- Delete: only if no departments reference this faculty (`ON DELETE RESTRICT` will throw — catch and show "Cannot delete: departments exist under this faculty").

**Departments (`/admin/institution/departments`):**
- List grouped by faculty.
- Create: faculty dropdown + name. INSERT `departments`.
- Edit / Delete: same pattern. RESTRICT if programmes exist.

**Programmes (`/admin/institution/programmes`):**
- List grouped by department.
- Fields: name, code (2–6 uppercase letters — `CHECK (code ~ '^[A-Z]{2,6}$')`).
- Create / Edit / Delete with RESTRICT guard.

**Qualification Types (`/admin/institution/qualification-types`):**
- List grouped by programme.
- Fields: name, code (1–6 uppercase letters — `CHECK (code ~ '^[A-Z]{1,6}$')`).
- Create / Edit / Delete with RESTRICT guard.

**Levels (`/admin/institution/levels`):**
- List grouped by qualification type.
- Fields: name (e.g. L100, L200, HND1), sort_order (positive integer).
- sort_order determines the promotion sequence — `promote_students_to_new_year()` uses `sort_order + 1` to find the next level. Make this visually clear in the UI.
- Create / Edit / Delete with RESTRICT guard if groups reference this level.

### 4. Academic Years

Route: `/admin/academic-years`

- List all academic years (name, year_code, start_date, end_date, is_current status).
- Create: fields — name (e.g. "2024/2025"), year_code (2 digits, e.g. "24"), start_date, end_date. Constraint: `year_code ~ '^\d{2}$'` and `end_date > start_date`.
- **Set as Current:** button calls `SELECT open_academic_year($yearId)` via Supabase RPC (server action). Only one year can be current — the function handles clearing the old current year. Show the current year prominently with a badge.
- Edit: name and dates only (year_code should not be editable once students have been created with it embedded in their index numbers).
- Delete: only if no groups, semesters, or students reference this year.

**Year detail (`/admin/academic-years/[yearId]`):**
- Show all semesters for this year with their status.
- Show all groups for this year with their level, qualification type, and active student count.
- Link to the promotion flow.

### 5. Semesters

Route: `/admin/semesters`

- List all `app_semesters` across all academic years, ordered by `start_date DESC`.
- Status badge: upcoming / active / archived.
- Show: name, academic year, start_date, end_date, auto_open toggle.

**Create semester:**
- Fields: academic year (dropdown), name (e.g. "Semester 1"), start_date, end_date, auto_open toggle.
- `INSERT INTO app_semesters`. Constraint: only one `status = 'active'` at a time (unique partial index).

**Open semester** (for upcoming semesters):
- Button calls `SELECT open_semester($semesterId)` via RPC.
- If another semester is active, the function raises an exception — catch and show "Close the active semester first."
- On success: semester card updates to "active".

**Close semester** (for the active semester):
- Requires a confirmation dialog: "This will force-close all open sessions and archive this semester. Are you sure?"
- Button calls `SELECT close_semester($semesterId)` via RPC.
- `close_semester()` internally calls `close_session()` for every open session — notifications are bulk-dismissed automatically.
- On success: semester card updates to "archived".

**Auto-open toggle:**
- UPDATE `app_semesters.auto_open` directly. When true, the cron Edge Function will open the semester automatically on `start_date`.

### 6. Groups

Route: `/admin/groups`

- List all groups across all academic years, filterable by academic year, qualification type, and level.
- Show: group name, qualification type, level, academic year, active student count, is_archived status.

**Create group:**
- Fields: qualification type (dropdown), level (dropdown filtered by qual type), academic year (dropdown), group_name, default_password.
- `INSERT INTO groups` (without default_password) and `INSERT INTO groups_secrets (group_id, default_password)` as a transaction.
- The default_password is stored in `groups_secrets` — it is never shown again after creation. Add a "Reset default password" action that UPDATEs `groups_secrets.default_password`.

**Group detail (`/admin/groups/[groupId]`):**

**Students tab:**
- Full roster: name, index number, email, photo, is_course_rep status, membership status.
- **Assign/unassign rep:** toggle `group_memberships.is_course_rep` for any student via UPDATE. Only one active rep per group is a business rule — before setting `is_course_rep = true` for a student, check if another student already has `is_course_rep = true AND status = 'active'` in this group. If yes, prompt "Unassign [current rep] first, or replace?" If replacing: set old rep's `is_course_rep = false`, then set new rep's `is_course_rep = true` in a single transaction.
- **Remove student from group:** UPDATE `group_memberships.status = 'removed' AND exited_at = now()`. Do not DELETE — membership records are permanent.
- **Reset student password:** call `supabase.auth.admin.updateUserById(studentId, { password: newPassword })` from a server action using the Supabase service role key. Never expose the service role key to the client.

**Courses tab:**
- List all courses for this group across all semesters.
- Create course: fields — semester (dropdown, active semester pre-selected), name, code, credit hours, lecturer (dropdown of all active lecturers). `INSERT INTO courses`. The `lecturer_assigned_at` column is stamped by `trg_stamp_lecturer_assigned_at` automatically.
- Assign/change lecturer on an existing course: UPDATE `courses.lecturer_id`. The `trg_log_lecturer_reassignment` trigger fires automatically and writes to `course_lecturer_history`.
- Remove lecturer: set `courses.lecturer_id = NULL`.

**Archive group:**
- Only available if `is_archived = false`.
- Show a warning: "This will make the group read-only. All students must be promoted or removed first."
- On confirm: UPDATE `groups.is_archived = true, archived_at = now()`.
- The `trg_prevent_archive_with_active_members` trigger will raise an exception if active members remain — catch and show the error message clearly.

### 7. Year-End Promotion

Route: `/admin/academic-years/[yearId]/promote`

This is the most consequential admin operation. It must be presented with care.

**Pre-flight checks (show before the run button):**
- Confirm the target academic year exists and is not the same as the source year.
- List all groups in the source year with their active student counts.
- For each group: check whether a matching group exists in the target year (same qualification type, same group name, next level). Show a green check or red warning per group. Red = no matching target group found — the admin must create it before running promotion.
- "Create missing groups" shortcut: for each missing target group, a one-click button to create it (pre-fills the form with the inferred values).

**Run promotion:**
- Large "Run Promotion" button, disabled if any target groups are missing.
- Requires a typed confirmation: the admin must type "PROMOTE" into a text field before the button becomes active.
- On confirm: call `SELECT * FROM promote_students_to_new_year($sourceYearId, $targetYearId)` via server action (this MUST be a server action — never a client-side RPC call for this operation).
- Display the result table in real time as rows stream back:
  - `promoted` rows in green: "Moved to [new_group_name]"
  - `completed` rows in blue: "Graduated — no next level"
  - `error` rows in red: "No matching group found — [detail]"
- If any `error` rows exist: show a warning banner "Promotion incomplete — X students could not be moved. Create the missing groups and run promotion again for those students only."
- Groups that are now empty auto-archive (handled by the function + trigger) — show which groups were archived in the result summary.
- The function should be called inside a transaction so the admin can review and roll back — implement this via a server action that wraps the RPC in a BEGIN/ROLLBACK if the admin clicks "Roll Back" within 60 seconds of the result. After 60 seconds, commit automatically.

### 8. User Management

**Students (`/admin/users/students`):**
- List all students system-wide, searchable by name or index number.
- Filter by group, academic year, is_active status.
- Show: name, index number, email, current group, is_active.
- **Deactivate:** UPDATE `user_profiles.is_active = false`. The `trg_audit_student_deactivated` trigger fires automatically. Show a confirmation dialog.
- **Reactivate:** UPDATE `user_profiles.is_active = true, must_change_password = true`. Note: reactivation with a new group membership should be done through the rep portal's "Add Student" flow which calls `add_student_to_group()`.
- **Reset password:** server action via Supabase Auth admin API.
- No ability to create students from here — student creation goes through `add_student_to_group()` in the rep portal.

**Lecturers (`/admin/users/lecturers`):**
- List all lecturers: name, staff_id, email, phone, assigned courses count, is_active.

- **Create lecturer:**
  1. Create auth user via Supabase Auth admin API (server action): `supabase.auth.admin.createUser({ email, password, user_metadata: { role: 'lecturer' } })`. The `handle_new_user()` trigger creates the `user_profiles` row.
  2. INSERT into `lecturers (id, name, staff_id, phone)`. The `trg_lecturers_sync_role` trigger confirms the role.
  3. Both steps must succeed — wrap in error handling. If step 2 fails after step 1, call `supabase.auth.admin.deleteUser()` to clean up.

- **Edit:** UPDATE `lecturers` (name, staff_id, phone) and optionally UPDATE `user_profiles` (phone, email via Auth admin API).

- **Deactivate:** UPDATE `user_profiles.is_active = false`. The lecturer loses portal access immediately (middleware checks `is_active`). Their `course_lecturer_history` records are preserved.

- **Reactivate:** UPDATE `user_profiles.is_active = true, must_change_password = true`.

- **Reset password:** server action via Supabase Auth admin API.

### 9. Courses (System-Wide View)

Route: `/admin/courses`

- List all courses across all groups and semesters, filterable by group, semester, lecturer, academic year.
- Show: name, code, group, semester, lecturer, session count, average attendance rate.
- Tapping a course goes to `/admin/courses/[courseId]`.
- The admin can assign or change a course's lecturer from this view (same UPDATE flow as the group detail).
- No create or delete from this view — course creation is in the group detail.

### 10. Audit Log

Route: `/admin/audit`

- Table view of all `audit_log` rows, ordered by `created_at DESC`.
- Columns: created_at, actor (join `user_profiles` on `actor_id` to get email), action, table_name, record_id, old_data, new_data.
- Filterable by: action (dropdown of all distinct action values), actor, table_name, date range.
- `old_data` and `new_data` are JSONB — render as a formatted diff (highlight changed keys).
- Clicking a row with a `record_id` should offer a "Go to record" link if the table and record are navigable within the admin portal.
- Pagination: 50 rows per page. Do not load the entire log at once.
- No write access — the audit log is read-only for everyone including the super admin.

### 11. System Settings

Route: `/admin/settings`

- List all `system_settings` rows: key, value, description, last updated.
- Inline edit: clicking a value makes it editable. On save: `UPDATE system_settings SET value = $newValue, updated_by = auth.uid(), updated_at = now() WHERE key = $key`.
- Show the description for each setting as help text so the admin knows what they're changing.
- Validate inputs:
  - `gps_accuracy_floor_metres`: positive integer.
  - `late_threshold_minutes`: positive integer.
  - `default_session_duration_minutes`: positive integer.
  - `institution_email_domain`: valid domain format (no `@`, no spaces).
- Warn: "Changing `institution_email_domain` will not affect existing student email addresses — only new students added after the change."

### 12. Profile

- Display: name, email.
- Editable: name (`super_admins.name`).
- Change password form.
- No phone or photo — the super admin identity is minimal by design.

---

## Non-Functional Requirements

### Security
- Middleware must verify `role = 'super_admin' AND is_active = true` on every `/admin/**` request, every time, without exception.
- All write operations that call Supabase RPC functions (`open_semester`, `close_semester`, `open_academic_year`, `promote_students_to_new_year`, `close_session`) must be in Next.js server actions using the authenticated session — never client-side RPC.
- All Supabase Auth admin API calls (create user, delete user, reset password) must use the service role key from a server action. The service role key must never appear in the client bundle.
- The promotion flow must be a server action. Do not allow the client to call `promote_students_to_new_year()` directly.
- `groups_secrets.default_password` must never be returned to the client. The form for creating a group accepts the password, sends it to a server action, and the server action inserts it. The response to the client never includes the password value.

### Data Integrity
- Every destructive action (archive group, deactivate user, close semester, run promotion) must require explicit confirmation. Promotion requires typed confirmation ("PROMOTE").
- The promotion result must be displayed before the transaction is committed, with a rollback window of 60 seconds.
- Group creation and `groups_secrets` insertion must be atomic — if either fails, both are rolled back.
- Lecturer creation (auth user + `lecturers` row) must be handled with cleanup on partial failure.

### Performance
- The audit log must be paginated — never fetch the full table. Use Supabase's `.range()` for offset pagination.
- The dashboard live session panel should use Supabase Realtime to update without polling.
- The promotion pre-flight check should run in parallel queries — one per group — not serially.
- System-wide student and course lists may be large — use server-side pagination with search.

### Reliability
- RPC calls for `open_semester`, `close_semester`, `open_academic_year`, `promote_students_to_new_year` must handle all exception messages from the database functions and surface them to the admin in plain English, not raw PostgreSQL error strings.
- If the promotion server action fails mid-run (network error, timeout), the admin must be clearly informed that the state is unknown and they should check the audit log and re-run after verifying.

### UX
- The admin portal is a desktop-first management interface. It does not need to be fully mobile-responsive, but it should not be completely broken on a tablet.
- Destructive actions must be visually distinct (red buttons, clear warnings).
- The institution skeleton management screens are rarely used but must be clearly structured — use a sidebar or breadcrumb navigation so the admin always knows where they are in the hierarchy.
- The promotion screen must be the most carefully designed screen in the entire portal — it touches every student in the system.

---

## Data Access Reference

All queries run as the authenticated super admin. RLS grants full access to every table.

| Need | Table / Function | Notes |
|---|---|---|
| System overview | `class_sessions`, `app_semesters`, `audit_log` | Multiple queries |
| Institution skeleton | `faculties`, `departments`, `programmes`, `qualification_types`, `levels` | Full CRUD |
| Academic years | `academic_years` | Full CRUD |
| Set current year | `open_academic_year(year_id)` | Server action RPC |
| Semesters | `app_semesters` | Full CRUD |
| Open semester | `open_semester(semester_id)` | Server action RPC |
| Close semester | `close_semester(semester_id)` | Server action RPC |
| Groups | `groups` | Full CRUD |
| Group secrets | `groups_secrets` | Admin-only table; INSERT on group create, UPDATE on password reset |
| Assign rep | UPDATE `group_memberships.is_course_rep` | Single row update; check for existing rep first |
| Remove student | UPDATE `group_memberships.status = 'removed'` | Never DELETE |
| Create course | INSERT `courses` | Lecturer assignment optional at creation |
| Assign lecturer | UPDATE `courses.lecturer_id` | Triggers `trg_log_lecturer_reassignment` and `trg_stamp_lecturer_assigned_at` |
| Create lecturer | Supabase Auth admin API + INSERT `lecturers` | Two-step, server action, with cleanup on failure |
| Deactivate user | UPDATE `user_profiles.is_active = false` | Triggers `trg_audit_student_deactivated` for students |
| Reset password | Supabase Auth admin API | Server action, service role key |
| Year promotion | `promote_students_to_new_year(src_id, new_id)` | Server action, wrap in transaction, show result before commit |
| Audit log | `audit_log` | Read-only, paginated |
| System settings | `system_settings` | Full CRUD |

---

## What You Must Not Build

- Any ability for the admin to check in to a session (that is a student action only).
- Any client-side Supabase calls using the service role key.
- Any mechanism to create a second super admin — the singleton constraint is absolute.
- Any bypass of the `trg_prevent_archive_with_active_members` trigger — do not add workarounds.
- Any direct manipulation of `audit_log` rows (no UPDATE, no DELETE).
- Any direct manipulation of `course_lecturer_history` rows — that table is trigger-managed only.
- Any deletion of `group_memberships` rows — status updates only.
- Any deletion of `students`, `attendance`, or `attendance_disputes` rows — these are permanent records.
