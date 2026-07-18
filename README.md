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
