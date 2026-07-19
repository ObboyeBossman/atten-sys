# ATTEN-SYS

University Attendance Management System — track, verify, and manage student attendance digitally.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **File Storage**: Cloudflare R2 (S3-compatible)
- **Styles**: Tailwind CSS v4
- **PWA**: next-pwa

## Getting Started

**Prerequisites:** Node.js 20+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the env template and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

3. Push database migrations:
   ```bash
   npx supabase db push
   ```

4. Run the dev server:
   ```bash
   npm run dev
   ```

## Environment Variables

See [`.env.example`](.env.example) for all required variables.

## Seeding

### Full 3-year seed (recommended for testing)

Populates every table with realistic data spanning three academic years:

```bash
npx tsx --env-file=.env.local scripts/seed-full.ts
```

**What it creates:**
- 3 academic years (2022/2023 · 2023/2024 · 2024/2025)
- 6 semesters (5 archived, 1 active)
- 10 lecturers, ~170 students across promoted cohorts
- 12 groups (BC/ITS and HN/ITS, Levels 100–300)
- 6 courses per group per semester with timetables
- 10 sessions per course per archived semester (all closed)
- Realistic attendance (≈75% present, ≈10% late, ≈15% absent)
- Disputes, notifications, and audit log entries
- One live (open) session per current group for dashboard testing

**Default password for all seeded users:** `Atten@2022`

| Role | Email |
|------|-------|
| Super Admin | `admin@ttu.edu.gh` |
| Lecturer | `kwame.asante@ttu.edu.gh` |
| Student (BC/ITS/24 L100) | `bcits24001@ttu.edu.gh` |
| Course Rep (BC/ITS/24 L100) | `bcits24001@ttu.edu.gh` |

> Students are created with `must_change_password = true` — they will be prompted to change on first login.

### Quick user-only seed (legacy)

Seeds 1 admin, 5 lecturers, 5 students with no institution data:

```bash
npx tsx --env-file=.env.local scripts/seed-users.ts
```
