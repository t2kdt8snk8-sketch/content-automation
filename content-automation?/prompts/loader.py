from __future__ import annotations

from functools import lru_cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PROMPTS_DIR.parent
WORKSPACE_ROOT = PROJECT_ROOT.parent

_SKILL_MAP: dict[str, list[Path]] = {
    "copy_agent": [
        WORKSPACE_ROOT / ".agents" / "skills" / "social-content" / "SKILL.md",
        WORKSPACE_ROOT / "claude-skills" / "marketing-skill" / "content-humanizer" / "SKILL.md",
        WORKSPACE_ROOT / "claude-skills" / "marketing-skill" / "content-production" / "SKILL.md",
    ],
    "script_agent": [
        WORKSPACE_ROOT / "claude-skills" / "marketing-skill" / "video-content-strategist" / "SKILL.md",
    ],
    "format_agent": [
        WORKSPACE_ROOT / "claude-skills" / "marketing-skill" / "content-humanizer" / "SKILL.md",
        WORKSPACE_ROOT / "claude-skills" / "marketing-skill" / "brand-guidelines" / "SKILL.md",
    ],
    "research_agent": [
        WORKSPACE_ROOT / "claude-skills" / "marketing-skill" / "social-media-analyzer" / "SKILL.md",
        WORKSPACE_ROOT / ".agents" / "skills" / "content-strategy" / "SKILL.md",
    ],
    "scanner_agent": [
        WORKSPACE_ROOT / "claude-skills" / "marketing-skill" / "social-media-analyzer" / "SKILL.md",
        WORKSPACE_ROOT / ".agents" / "skills" / "content-strategy" / "SKILL.md",
    ],
}


def _strip_frontmatter(text: str) -> str:
    if not text.startswith("---"):
        return text

    parts = text.split("---", 2)
    if len(parts) < 3:
        return text
    return parts[2].strip()


def _compact_skill_excerpt(path: Path) -> str:
    raw = _strip_frontmatter(path.read_text(encoding="utf-8"))
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    excerpt_lines: list[str] = []

    for line in lines:
        if line.startswith("# "):
            excerpt_lines.append(line.replace("# ", ""))
            continue
        if line.startswith("## "):
            excerpt_lines.append(line)
            continue
        if line.startswith("- ") or line.startswith("1. ") or line.startswith("2. "):
            excerpt_lines.append(line)
            continue
        if len(excerpt_lines) < 12:
            excerpt_lines.append(line)
        if len("\n".join(excerpt_lines)) > 1600:
            break

    return "\n".join(excerpt_lines[:16]).strip()


@lru_cache
def load_prompt(name: str) -> str:
    prompt_path = PROMPTS_DIR / f"{name}.md"
    base_prompt = prompt_path.read_text(encoding="utf-8").strip()

    skill_paths = _SKILL_MAP.get(name, [])
    excerpts: list[str] = []
    for path in skill_paths:
        if not path.exists():
            continue
        excerpt = _compact_skill_excerpt(path)
        if excerpt:
            excerpts.append(f"[Skill: {path.parent.name}]\n{excerpt}")

    if not excerpts:
        return base_prompt

    return (
        f"{base_prompt}\n\n"
        "[Reference skill notes]\n"
        "Use the following notes as supporting guidance. Follow them when helpful, "
        "but prioritize the current task, audience, and factual accuracy.\n\n"
        f"{'\n\n'.join(excerpts)}"
    )
