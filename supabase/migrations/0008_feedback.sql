-- ============================================================
-- 0008_feedback.sql
-- Feedback / reviews / recommendations from students & lecturers
-- ============================================================

create type feedback_author_role as enum ('student', 'lecturer');
create type feedback_category as enum (
  'general',
  'attendance_system',
  'course_experience',
  'lecturer_feedback',
  'platform_suggestion',
  'technical_issue',
  'other'
);
create type feedback_sentiment as enum ('positive', 'neutral', 'negative');

create table if not exists feedback (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references auth.users(id) on delete cascade,
  author_role     feedback_author_role not null,
  category        feedback_category not null default 'general',
  sentiment       feedback_sentiment not null default 'neutral',
  rating          smallint check (rating between 1 and 5),
  title           text not null,
  body            text not null,
  is_anonymous    boolean not null default false,
  is_read_admin   boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- index for admin view (unread first, newest first)
create index feedback_admin_idx on feedback (is_read_admin, created_at desc);
-- index for per-author history
create index feedback_author_idx on feedback (author_id, created_at desc);

-- updated_at trigger
create or replace function set_feedback_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger feedback_updated_at
  before update on feedback
  for each row execute procedure set_feedback_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
alter table feedback enable row level security;

-- Authors can insert their own feedback
create policy "feedback_insert_own"
  on feedback for insert
  with check (auth.uid() = author_id);

-- Authors can read their own feedback
create policy "feedback_select_own"
  on feedback for select
  using (auth.uid() = author_id);

-- Authors can update their own feedback (within cooldown — enforced in app)
create policy "feedback_update_own"
  on feedback for update
  using (auth.uid() = author_id);

-- Admins (service role) can read everything — handled via service client
