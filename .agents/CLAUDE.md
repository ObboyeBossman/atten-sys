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

- Default: work directly on `main` unless explicitly instructed otherwise.
- Push to `main` only after the build passes with zero errors.
- Create a separate branch **only if**:
  - explicitly asked, or
  - the session is approaching its context limit and the work is not yet stable.

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

## Validation — Must Pass Before Every Push

```bash
npm run build
```

- Resolve **all** build errors before pushing.
- Also run lint and type-check if they exist in `package.json`:

```bash
npm run lint   # if present
npm run typecheck  # if present
```

- Do not push code that fails any of the above.

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

1. Do **not** leave the repository broken or half-finished.
2. Complete a coherent, buildable subset of the work.
3. Verify `npm run build` passes.
4. Commit and push to a **separate branch** (not `main`).
5. Leave a clear written summary covering:
   - What was completed
   - What remains
   - Assumptions made
   - Recommended next steps

Never push broken or partial code to `main`.

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
