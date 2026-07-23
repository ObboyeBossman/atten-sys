# Claude Agent Rules — atten-sys

> These rules apply specifically to Claude (Anthropic) when operating as a development agent on this project.
> They extend and are subordinate to the design and quality standards defined in `AGENTS.md`.
> **Read `AGENTS.md` first. Read this file second. Do not begin implementation until both are understood.**

---

## Session Startup (Required Every Chat)

1. Pull the latest changes from the repository so the local copy is on the latest `main` commit:
```bash
git pull origin main
```
2. Read `.agents/AGENTS.md` in full.
3. Read this file (`CLAUDE.md`) in full.
4. Briefly confirm the current branch and last commit before writing any code.

---

## Git Identity

Configure these values before the first commit of every session — never commit as Claude or any other identity:

```bash
git config user.name "Obboye Bossman"
git config user.email "obboyebossman@gmail.com"
```

---

## Repository

```
https://github.com/ObboyeBossman/atten-sys.git
```

All pushes go to this repository. Never push to any other remote.  
After any push that required a PAT embedded in the remote URL, immediately scrub it:

```bash
git remote set-url origin https://github.com/ObboyeBossman/atten-sys.git
```

---

## Branching Strategy

- **Never work directly on `main` for new features or significant edits.**
- Create a feature branch at the start of every new page redesign or significant change:

```bash
git checkout -b feat/<feature-name>
```

Use descriptive branch names that reference the page or portal being redesigned:

| Work | Branch name |
|---|---|
| Login page redesign | `feat/redesign-login` |
| Student dashboard | `feat/redesign-student-dashboard` |
| Student check-in flow | `feat/redesign-student-checkin` |
| Lecturer live session | `feat/redesign-lecturer-live-session` |
| Rep attendance roster | `feat/redesign-rep-attendance-roster` |
| Admin dashboard | `feat/redesign-admin-dashboard` |

- Work on the feature branch. Commit and push every file change to that branch as you go (see **Commit Cadence** below).
- When the full page or objective is complete, run the build and all checks on the feature branch.
- Only after all checks pass clean, merge into `main`:

```bash
git checkout main
git merge feat/<feature-name>
git push origin main
```

- Delete both the local and remote feature branch after a successful merge:

```bash
git branch -d feat/<feature-name>
git push origin --delete feat/<feature-name>
```

- Work directly on `main` **only** for trivial single-line fixes where a branch would add no value — and only if explicitly agreed.

---

## Commit Cadence — Commit & Push on Every Change

This is the **primary workflow rule** for all development on this project.

### During development (every file save):

After **every file that is created or modified**, stage and commit it immediately:

```bash
git add <file>
git commit -m "<type>(<scope>): <short description>"
git push origin feat/<feature-name>
```

- Do not batch multiple file changes into one commit unless the changes are a single atomic unit (e.g., a component `.tsx` file and its co-located `.module.css` file).
- Each commit message must be meaningful and describe the exact change made to that file.
- Push to the feature branch after every commit — no local-only commits during active development.

### Commit message format

```
feat(login): add shake animation for failed auth
style(student-dashboard): anchor check-in CTA to thumb zone
fix(rep-roster): correct touch target size on student cards
refactor(auth): extract FloatingLabel into shared component
```

### After the full page or objective is complete:

Only once **all files for the feature have been committed and pushed** do you:

1. Run the build:
```bash
npm run build
```

2. Fix **every** build error — committing and pushing each fix to the feature branch individually.

3. Run lint and type-check:
```bash
npm run lint
```

4. Fix any errors, committing and pushing each fix.

5. Only when all checks pass clean, merge into `main` and push.

6. Delete the feature branch locally and remotely.

### Summary

| Phase | Action |
|---|---|
| Start of page redesign | Create feature branch |
| Every file added or changed | Commit → Push to feature branch immediately |
| Full page complete | Run build → Fix errors → Run lint → Fix errors → Merge to `main` → Push → Delete branch |

---

## Security — Credentials & Secrets

- **Never** print, log, echo, commit, or expose any credential (PAT, API key, Supabase service key, password, or secret).
- Use secrets only for the operation they were provided for.
- `.env.local` and `.env` files must never be committed. They are already in `.gitignore` — do not override this.
- Do not store or reuse credentials across sessions.

---

## Validation — Must Pass After Every Page (Not Before Every Push)

Build and lint checks run **after a complete page is finished** — not before every individual file push.

```bash
npm run build
```

- Resolve **all** build errors, committing and pushing each fix individually.

```bash
npm run lint
```

- All checks must pass clean before the page redesign is declared done and merged to `main`.
- **Never** leave the repository in a broken build state at the end of a session.

---

## CSS & Styling Rules

This project uses **CSS Modules** (`.module.css` co-located with each component or page). Follow these conventions:

- All styles go into the co-located `.module.css` file — never inline styles, never global classes except for theme tokens.
- Theme tokens (colors, spacing, type scale) are defined in:
  - `portal-light-theme.css` / `portal-dark-theme.css` — Student, Lecturer, Rep portals
  - `admin-light-theme.css` / `admin-dark-theme.css` — Super Admin portal only
- Use CSS custom properties (`var(--token-name)`) for all color, spacing, and type values.
- Never hardcode hex colors, pixel values for spacing, or font sizes outside of the theme token files.
- Input font size must be **exactly 16px minimum** — enforced to prevent iOS Safari auto-zoom.

---

## Implementation Standards

Follow `AGENTS.md` as the source of truth for design and code quality. Additionally, as Claude:

- Keep diffs minimal and focused — only change what is required for the task.
- Do not refactor unrelated code unless it directly blocks the task.
- Maintain backward compatibility unless instructed otherwise.
- Write production-ready, readable, maintainable code.
- Prefer semantic HTML, accessible patterns, and mobile-first layout.
- All new components must include all required interaction states (default, hover, focus, active, disabled, loading, success, error, empty) as defined in `AGENTS.md`.

---

## Redesign Workflow (Per Page)

Follow this order strictly for every page:

1. **Read** the existing page code fully before touching anything.
2. **Audit** — Identify what works and what violates the design principles in `AGENTS.md`.
3. **Plan** — State in 2–4 sentences what structural changes you are making and why.
4. **Build** — Implement the redesign on the feature branch, committing each file as you go.
5. **Verify** — Confirm the layout at 360px width, all interaction states, thumb-zone CTA placement, and 16px input font sizes.
6. **Build check** — Run `npm run build` and fix all errors.
7. **Merge** — Merge to `main`, push, delete the feature branch.
8. **Report** — Summarize changes made, files touched, and build results.

**Do not move to the next page until the user explicitly approves the current one.**

---

## Communication Protocol

**Before non-trivial work:**
- State the implementation plan in 2–4 sentences.
- Call out assumptions and risks upfront.
- Name the signature micro-interaction for the page before building it.

**After completing a page:**
- Summarize the changes made (files touched, what changed, why).
- Report build and lint results.
- Ask for approval before proceeding to the next page.

**If blocked:**
- State clearly what is blocking you and what you need to proceed.
- Do not guess or make assumptions about auth logic, database schema, or server actions — ask first.
