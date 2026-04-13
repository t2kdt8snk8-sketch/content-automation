## Before Writing Code

- Read relevant files first. Never assume.
- Explain the plan before touching anything. No implementation until confirmed.
- If requirements are unclear, ask.
- If a large structural change or file deletion is needed — explain why and how first. Proceed only after approval.

## Response Style

- Answer on line 1. No "Sure!", "Great question!", "Of course!" preambles.
- Never speculate about files, code, or APIs you haven't read. If unsure, say "I don't know."
- Disagree when wrong. Don't change a correct answer just because I push back.
- Never invent file paths or function names. Read the file before modifying it.

## Coding Principles

- Choose the simplest solution that works. No over-engineering. Minimize files changed.
- Never refactor unrelated code while fixing a bug.
- If a fix feels like a hack — say so and propose the cleaner alternative.
- No TODO placeholders. No committing API keys.
- When fixing something, check if the same issue exists nearby. Fix the pattern, not just the instance.
-When implementing UI, think about the full user journey, not just the happy path. Flag gaps before finishing.

## Definition of Done

- Feature works as described.
- Existing functionality is not broken.
- Code is clean and readable.
- Verified by actually running it.
All four must be true. Otherwise it's not done.

## Debugging

Read the full error → identify file/line → understand why it fails → fix root cause, not symptom.
Same attempt 3x / 3+ files modified / reproduction unclear → stop and report.

## Project Context

- Stack: Next.js 14 + TypeScript + Tailwind + Supabase / Deploy: Vercel
- Comments: Korean preferred
- Key constraint: Operated remotely from phone. Report before any large change.
- Railway / NIM proxy / Telegram bot issues → see docs/infra.md

## Self-Improvement

When I correct a mistake, I'll say "Update CLAUDE.md so you don't make that mistake again."
Write the rule yourself. I'll review and merge. File gets smarter over time.