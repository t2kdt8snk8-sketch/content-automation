## Thinking Protocol

- Read relevant files first. Never assume.
- Explain the plan before touching anything. No implementation until confirmed.
- If requirements are unclear, ask.
- If a large structural change or file deletion is needed — explain why and how first. Proceed only after approval.

## Response Style

- Answer on line 1. No "Sure!", "Great question!", "Of course!" preambles.
- Never speculate about files, code, or APIs you haven't read. If unsure, say "I don't know."
- Disagree when wrong. Don't change a correct answer just because I push back.
- If a better approach exists, say so before implementing. Don't work around a problem — name it.
- Never invent file paths or function names. Read the file before modifying it.
- **Communication for Beginner:** 사용자가 코딩 초보자임을 항상 인지할 것. 전문 용어 사용을 완전히 배제할 필요는 없으나, 용어를 사용할 때 맥락상 쉽게 이해할 수 있도록 친절하게 풀어서 설명할 것. 어려운 용어의 남발을 지양할 것.

## Coding Principles

- Choose the simplest solution that works. No over-engineering. Minimize files changed.
- Never refactor unrelated code while fixing a bug.
- When fixing something, check if the same or similar issue exists nearby. Fix the pattern, not just the instance.
- If a fix feels like a hack — say so and propose the cleaner alternative.
- When implementing UI, think about the full user journey, not just the happy path. Flag gaps before finishing.
- No TODO placeholders. No committing API keys.

## Definition of Done

- Feature works as described.
- Existing functionality is not broken.
- Code is clean and readable.
- Verified by actually running it.
All four must be true. Otherwise it's not done.

## Debugging

Read the full error → identify file/line → understand why it fails → fix root cause, not symptom.
Same attempt 3x / 3+ files modified / reproduction unclear → stop and report.

## Self-Improvement

When I correct a mistake, I'll say "Update CLAUDE.md so you don't make that mistake again."
Write the rule yourself. I'll review and merge. File gets smarter over time.

---

## Tools

- 새 기능 구현 시작 전 → Superpowers brainstorming 사용할지 유저에게 먼저 물어볼 것
- 버그/에러 발생 시 → Superpowers systematic-debugging 사용할지 유저에게 먼저 물어볼 것
- 완료 선언 전 → Superpowers verification-before-completion 사용할지 유저에게 먼저 물어볼 것
- 라이브러리 문서 필요 시 → Context7 사용 (알고 있어도 사용할 것)
- 새 작업 시작 시 → 프로젝트에 Repowise MCP 설정이 있으면 `get_overview()`로 먼저 전체 구조 파악할 것
- PRD/기획서 받았을 때 → Taskmaster `parse_prd`로 태스크 분해 후 시작
- UI/프론트엔드 작업 시 → Frontend Design 스킬 연결 여부 먼저 확인 후 유저에게 알릴 것

---

## Expert Skills Routing (Hyper-Optimized)
- We have 100+ domain-expert skills. To save tokens (Current window: ~28k), follow this nested lookup:
  1. Identify the high-level category in `docs/SKILLS_MASTER_INDEX.md`.
  2. Pick the specific **Sub-Role** (e.g., `Engineering -> Security`).
  3. Read only that sub-role index file (e.g., `docs/skills_index/engineering-team/security_and_compliance.md`).
  4. Use `activate_skill(name="...")` for the chosen skill.
- **NEVER** read the entire skill library. Only read what fits the current task.
- **Skill file base path:** All skill `.md` files are located under `claude-skills/docs/skills/{category}/{skill-name}.md`.
  - Engineering (POWERFUL): `claude-skills/docs/skills/engineering/`
  - Engineering Team: `claude-skills/docs/skills/engineering-team/`
  - Marketing: `claude-skills/docs/skills/marketing-skill/`
  - Product: `claude-skills/docs/skills/product-team/`
  - If `activate_skill` or the Skill tool fails, **read the file directly** using the path above.