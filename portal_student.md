# ATTEN-SYS — Student Portal
## Coding Agent Prompt & Requirements Document

---

## Project Context

You are building the **Student Portal** for ATTEN-SYS, a university attendance management system. The full stack is **Next.js (App Router)** on the frontend and **Supabase** (PostgreSQL + Auth + Realtime + Storage) on the backend, with **Cloudflare R2** for media storage. The database schema, all RLS policies, trigger functions, and business logic functions are already fully deployed. You must not modify the database in any way. Your job is to build the UI and data layer that sits on top of it.

The student portal lives under the route group `/student/...`. It is completely separate from the rep, lecturer, and admin portals. A student can only access this portal. Middleware must verify the user's role from `user_profiles.role` and redirect any non-student to the appropriate portal or the login page.

---

## Who Is a Student

A student is a user whose `user_profiles.role = 'student'`. Their identity record lives in the `students` table (`id`, `name`, `index_number`, `photo_path`). Their current group is the `group_memberships` row where `student_id = auth.uid()` AND `status = 'active'`. They may have historical memberships (`status IN ('promoted', 'completed', 'removed')`) which represent past groups and must be accessible for attendance history.

A student account is created by a course rep via `add_student_to_group()`. On first login, `user_profiles.must_change_password = true` — the student must be forced to change their password before accessing any other screen.

---

## Route Structure

```
/student
  /login                         ← public, redirects to /student/dashboard if already logged in
  /change-password               ← forced redirect if must_change_password = true
  /dashboard                     ← home: active session banner + summary cards
  /attendance                    ← full attendance history list
  /attendance/[sessionId]        ← single session detail + dispute status
  /checkin/[sessionId]           ← live check-in flow (geolocation + selfie)
  /notifications                 ← notification list
  /profile                       ← view and edit own profile
```

---

## Functional Requirements

### 1. Authentication

- Students log in with their generated email (`bcits24197@ttu.edu.gh`) and password via Supabase Auth (`supabase.auth.signInWithPassword`).
- On successful login, read `user_profiles` for the authenticated user. If `must_change_password = true`, redirect immediately to `/student/change-password`. This redirect must be enforced in middleware — the student cannot navigate away from the change-password screen until the password is changed.
- Password change calls `supabase.auth.updateUser({ password: newPassword })`. On success, also update `user_profiles.must_change_password = false`.
- Session persistence: use Supabase's cookie-based session. The Next.js middleware must refresh the session on every request using `supabase.auth.getSession()`.
- On logout, call `supabase.auth.signOut()` and redirect to `/student/login`.

### 2. Dashboard

The dashboard is the landing screen after login. It has three concerns:

**Active session banner:**
- Poll `notifications` table every 20 seconds, or use a Supabase Realtime subscription, filtered by `user_id = auth.uid() AND is_dismissed = false AND session_id IS NOT NULL`.
- If an undismissed session notification exists, show a prominent banner: course name, started_at time, and a "Mark Attendance" button that routes to `/student/checkin/[sessionId]`.
- When `is_dismissed` flips to `true` (either because the student checked in or the session ended), the banner must disappear without a page reload. Use Supabase Realtime for this.
- If no active notification exists, show a neutral state ("No active session right now").

**Summary cards:**
- Total sessions for the current semester for the student's group.
- Sessions attended (status = 'present' or 'late').
- Sessions missed (status = 'absent').
- Attendance percentage.
- Query: join `attendance` on `session_id` → `class_sessions` → `courses` filtered by the student's active `group_memberships.group_id` and the current `app_semesters` row where `status = 'active'`.

**Recent activity:**
- Last 5 attendance records for the student, showing course name, date, and status badge (present / late / absent).

### 3. Attendance History

- List all `attendance` rows for `student_id = auth.uid()`, ordered by `checked_in_at DESC`.
- Group by semester: show a semester heading, then sessions under it.
- Each row shows: course name, session date, check-in time, status badge, and a dispute indicator if a dispute exists for that record.
- Tapping a row goes to `/student/attendance/[sessionId]`.

### 4. Session Detail

Route: `/student/attendance/[sessionId]`

- Show the full attendance record for the student for this session:
  - Course name and code
  - Session date, started_at, ended_at
  - Student's status (present / late / absent)
  - Check-in time (if self-checked-in)
  - Geo-verified badge (if `geo_verified = true`)
- If a dispute exists for this record (`attendance_disputes` where `attendance_id = attendance.id`):
  - Show dispute status badge: pending / approved / rejected
  - Show the reason the student submitted
  - If resolved: show `resolution_note` and `resolved_at`
  - If still pending: show "Your dispute is under review"
- If no dispute exists AND the session has ended AND the status is `absent` or `late`:
  - Show a "Raise Dispute" button that opens a modal with a textarea for the reason.
  - On submit: `INSERT INTO attendance_disputes (attendance_id, raised_by, reason)`.
  - A student may only raise one dispute per attendance record (enforced by the unique constraint implied by business logic — check before showing the button).
- If the session is still live (ended_at IS NULL): do not show the dispute option — direct to check-in instead if not yet checked in.

### 5. Check-in Flow

Route: `/student/checkin/[sessionId]`

This is the most critical flow in the student portal. It must be executed in strict order. If any step fails, the flow stops and shows a clear error.

**Step 1 — Validate the session is live**
- Query `class_sessions` where `id = sessionId AND ended_at IS NULL`.
- If not found or already ended: show "This session has ended" and block the flow.

**Step 2 — Check for existing attendance**
- Query `attendance` where `session_id = sessionId AND student_id = auth.uid()`.
- If a row already exists: show "You have already checked in" with their status and check-in time. Do not allow a second check-in.

**Step 3 — Check the student belongs to the session's group**
- Resolve `class_sessions.course_id` → `courses.group_id`.
- Verify the student has an active `group_memberships` row for that `group_id`.
- If not: show "You are not enrolled in this group" and block.

**Step 4 — Geolocation capture**
- Call `navigator.geolocation.getCurrentPosition()` with `enableHighAccuracy: true`.
- If permission denied: show "Location permission is required to check in" and block.
- If accuracy > `gps_accuracy_floor_metres` (read from `system_settings`): show "GPS signal too weak. Move to an open area and try again."
- Display a map pin or accuracy indicator to give the student feedback.

**Step 5 — Selfie capture**
- Activate the front-facing camera (`getUserMedia({ video: { facingMode: 'user' } })`).
- Show a live preview. The student taps a capture button to take the photo.
- Selfie is mandatory — the submit button is disabled until a photo is captured.
- Compress the image client-side to a reasonable size (max 800px wide, JPEG quality 0.8) before upload.

**Step 6 — Upload selfie to R2**
- Upload the compressed image to Cloudflare R2 via a Next.js API route (never expose R2 credentials to the client).
- R2 object key format: `attendance/{sessionId}/{studentId}.webp`
- If upload fails: show "Photo upload failed. Please try again." Do not proceed.

**Step 7 — Insert attendance row**
- Generate a `device_token`: read from `localStorage` under key `atten_device_token`. If not present, generate a `crypto.randomUUID()` and persist it.
- Determine status: if `now() - session.started_at > late_threshold_minutes` (from `system_settings`) → `'late'`, else `'present'`.
- Insert into `attendance`:
  ```
  session_id    = sessionId
  student_id    = auth.uid()
  status        = computed above
  latitude      = from geolocation
  longitude     = from geolocation
  selfie_path   = R2 object key from step 6
  geo_verified  = true (since accuracy passed the floor)
  gps_accuracy  = accuracy value from geolocation
  device_token  = from localStorage
  ```
- If the INSERT fails with a unique constraint violation on `(session_id, device_token)`: show "This device has already been used to check in for this session."
- If the INSERT fails with a unique constraint violation on `(session_id, student_id)`: show "You have already checked in."
- On success: show a success screen with the student's status and check-in time. The banner on the dashboard will auto-dismiss via the `trg_dismiss_on_checkin` trigger.

### 6. Notifications

- List all `notifications` for `user_id = auth.uid()`, ordered by `created_at DESC`.
- Show title, body, created_at, and a read indicator.
- Tapping a session notification (where `session_id IS NOT NULL`) routes to `/student/checkin/[sessionId]` if the session is still live, or `/student/attendance/[sessionId]` if it has ended.
- Mark as read: `UPDATE notifications SET is_read = true WHERE id = notificationId AND user_id = auth.uid()`.
- Mark all as read button.
- Unread count badge on the notifications nav icon.

### 7. Profile

- Display: name, index number, email, photo (from R2 using `photo_path`).
- Editable fields: phone (`user_profiles.phone`). Name and index number are not editable by the student.
- Profile photo upload: upload to R2 at key `students/{studentId}/avatar.webp`, then update `students.photo_path`.
- Change password form: current password (verified client-side via re-auth), new password, confirm new password. Calls `supabase.auth.updateUser({ password })`.

---

## Non-Functional Requirements

### Security
- Middleware must verify `user_profiles.role = 'student'` on every request to `/student/**` routes. Non-students are redirected.
- The R2 upload API route must verify the user's Supabase session before accepting any upload. Never accept unauthenticated uploads.
- `device_token` is stored in `localStorage` — document that this is intentional (persistent per browser, not per session) so the one-device-per-session constraint works across page reloads.
- Do not expose R2 credentials, Supabase service role key, or any secrets to the client bundle.

### Performance
- The dashboard must load within 2 seconds on a typical campus mobile connection.
- Realtime subscription for notifications must reconnect automatically on disconnect.
- Geolocation and camera requests must show loading states — never leave the student on a blank screen.
- Selfie compression must happen client-side before upload to keep upload time under 3 seconds on a 3G connection.

### Reliability
- Every step of the check-in flow must have explicit error handling with a human-readable message. Never show a raw Supabase error to the student.
- If geolocation times out (set a 10-second timeout), show a retry button.
- If the camera fails to activate, show a fallback message and suggest trying a different browser.

### Accessibility
- All interactive elements must be keyboard accessible.
- Status badges (present / late / absent) must use both colour and text — never colour alone.
- Camera and geolocation permission prompts must be explained in plain language before the browser dialog appears.

### UX
- The check-in flow must be completable in under 60 seconds on a mid-range Android phone.
- The active session banner on the dashboard must be the most visually prominent element when a session is live.
- All loading states must use skeleton screens, not spinners, where the layout is known.
- The portal must be fully responsive — students will primarily use it on mobile browsers.

---

## Data Access Reference

All queries run as the authenticated student. RLS policies enforce access — no additional filtering by `student_id` is required in most queries, but it is good practice to include it for clarity.

| Need | Table / Function | Notes |
|---|---|---|
| Own profile | `user_profiles`, `students` | Join on `id = auth.uid()` |
| Active group | `group_memberships` | `status = 'active' AND student_id = auth.uid()` |
| Active session notification | `notifications` | `is_dismissed = false AND session_id IS NOT NULL` |
| Session live check | `class_sessions` | `ended_at IS NULL` |
| Own attendance | `attendance` | `student_id = auth.uid()` |
| Dispute on a record | `attendance_disputes` | `attendance_id = attendance.id` |
| Raise dispute | INSERT `attendance_disputes` | `raised_by = auth.uid()` |
| Course info | `courses` | Via `class_sessions.course_id` |
| System settings | `system_settings` | Read `gps_accuracy_floor_metres`, `late_threshold_minutes` |
| Mark notification read | UPDATE `notifications` | `user_id = auth.uid()` |
| Change password | `supabase.auth.updateUser` | Also set `must_change_password = false` on `user_profiles` |

---

## What You Must Not Build

- Any UI for managing other students, courses, groups, or sessions.
- Any ability to view other students' attendance records.
- Any admin or rep functionality.
- Any direct database writes outside of the operations listed above.
- Any bypass of the mandatory selfie or geolocation steps.
