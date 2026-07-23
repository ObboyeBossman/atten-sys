# Claude Agent Rules — atten-sys

> These rules apply specifically to Claude (Anthropic) when operating as a development agent on this project.
> They extend and are subordinate to the design and quality standards defined in `AGENTS.md`.
> **Read `AGENTS.md` first. Read this file second. Do not begin implementation until both are understood.**

---

## Session Startup (Required Every Chat)

1. Clone or pull the repository so the local copy is on the latest `main` commit.
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

## Branching Strategy

- **Never work directly on `main` for new features or serious edits.**
- Create a feature branch at the start of every new feature or significant change:

```bash
git checkout -b feat/<feature-name>
```

- Work on that branch. Commit and push every file change to the feature branch as you go (see **Commit Cadence** below).
- When the full feature or objective is complete, run build and all checks on the branch.
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
- Work directly on `main` **only** for trivial, single-line fixes where a branch would add no value — and only if explicitly agreed.

---

## Commit Cadence — Commit & Push on Every Change

This is the **primary workflow rule** for all development on this project.

### During development (every file save):

1. After **every file that is created or modified**, stage and commit it immediately:

```bash
git add <file>
git commit -m "<type>(<scope>): <short description>"
git push origin feat/<feature-name>
```

- Do not batch multiple file changes into one commit unless the changes are a single atomic unit (e.g., a component file and its co-located type file).
- Each commit message must be meaningful and describe the exact change made to that file.
- Push to the feature branch after every commit — no local-only commits during active development.

### After the full feature or objective is complete:

Only once **all files for the feature have been committed and pushed to the feature branch** do you:

1. Run the build:

```bash
npm run build
```

2. Fix **every** build error that arises — committing and pushing each fix to the feature branch individually as you go.

3. Run lint and type-check if available:

```bash
npm run lint       # if present
npm run typecheck  # if present
```

4. Fix any errors, committing and pushing each fix.

5. Only when all checks pass clean, merge into `main` and push:

```bash
git checkout main
git merge feat/<feature-name>
git push origin main
```

6. Delete the feature branch locally and remotely:

```bash
git branch -d feat/<feature-name>
git push origin --delete feat/<feature-name>
```

### Summary

| Phase | Action |
|---|---|
| Start of feature | Create feature branch |
| Every file added or changed | Commit → Push to feature branch immediately |
| Full feature complete | Run build → Fix errors (commit each fix) → Run lint/typecheck → Fix errors (commit each fix) → Merge to `main` → Push |

---

## Security — Credentials & Secrets

- **Never** print, log, echo, commit, or expose any credential (PAT, API key, password, secret).
- Use secrets only for the operation they were provided for.
- After any `git push` that required a PAT embedded in the remote URL, immediately scrub it:

```bash
git remote set-url origin https://github.com/ObboyeBossman/atten-sys.git
```

- Do not store or reuse credentials across sessions.

---

## Validation — Must Pass After Every Feature (Not Before Every Push)

Build and lint checks run **after a complete feature or objective is finished** — not before every individual file push. See the **Commit Cadence** section above for the full workflow.

```bash
npm run build
```

- Resolve **all** build errors, committing and pushing each fix individually.
- Also run lint and type-check if they exist in `package.json`:

```bash
npm run lint       # if present
npm run typecheck  # if present
```

- All checks must pass clean before the feature is declared done.
- **Never** leave the repository in a broken state at the end of a session.

---

## Implementation Standards

Follow the conventions established in `AGENTS.md` as the source of truth for design and code quality.
Additionally, as Claude:

- Keep diffs minimal and focused — only change what is required for the task.
- Do not refactor unrelated code unless it directly blocks the task.
- Maintain backward compatibility unless instructed otherwise.
- Write production-ready, readable, maintainable code.
- Prefer semantic HTML, accessible patterns, and mobile-first layout — as defined in `AGENTS.md`.

---

## Communication Protocol

**Before non-trivial work:**
- State the implementation plan in 2–4 sentences.
- Call out assumptions and risks upfront.

**After completing work:**
- Summarise the changes made (what files, what changed, why).
- Report build and lint results explicitly.
- Note any remaining issues or follow-up recommendations.

---

## Context Limit Handling

If the session is approaching its context limit:

1. Do **not** leave the repository mid-file or in an incoherent state.
2. Finish the current file change, commit, and push it to the feature branch.
3. Do **not** merge into `main` — the feature branch is the safe holding place.
4. Leave a clear written summary covering:
   - What was completed
   - What files were committed and pushed
   - What remains before the branch can be merged
   - Assumptions made
   - Recommended next steps for the next session

Every committed file should be pushed to the feature branch — never leave unpushed local commits at session end.

---

## Relationship to AGENTS.md

| Concern | Source of truth |
|---|---|
| Design philosophy & visual language | `AGENTS.md` |
| Interaction & motion principles | `AGENTS.md` |
| Mobile-first & responsive rules | `AGENTS.md` |
| Git identity, branching, security | `CLAUDE.md` (this file) |
| Build validation & push rules | `CLAUDE.md` (this file) |
| Communication & session workflow | `CLAUDE.md` (this file) |

When there is any conflict, `AGENTS.md` wins on design decisions; `CLAUDE.md` wins on workflow and process decisions.
