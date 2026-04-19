#!/usr/bin/env python3
"""
Claude 워크스페이스 대시보드 — 복구 백엔드
- dist/ 정적 서빙
- /api/* 핸들러: ~/.claude 파일 시스템에서 실제 데이터를 읽어 응답
- 안전: PUT/POST/DELETE는 절대 파일을 수정하지 않고 200 OK만 반환 (read-only mock)
"""
from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import time
from datetime import datetime, date
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional
from urllib.parse import urlparse

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
CLAUDE_HOME = Path.home() / ".claude"
CLAUDE_MD = CLAUDE_HOME / "CLAUDE.md"
SETTINGS_JSON = CLAUDE_HOME / "settings.json"
SKILLS_DIR = CLAUDE_HOME / "skills"
AGENTS_DIR = CLAUDE_HOME / "agents"
PROJECTS_DIR = CLAUDE_HOME / "projects"
PLUGINS_DIR = CLAUDE_HOME / "plugins"
INSTALLED_PLUGINS_JSON = PLUGINS_DIR / "installed_plugins.json"
SESSIONS_DIR = CLAUDE_HOME / "sessions"
TODOS_DIR = CLAUDE_HOME / "todos"
TASKS_DIR = CLAUDE_HOME / "tasks"
SCHEDULED_TASKS_DIR = CLAUDE_HOME / "scheduled-tasks"
HISTORY_JSONL = CLAUDE_HOME / "history.jsonl"
CLAUDE_JSON = Path.home() / ".claude.json"

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


# ---------- helpers ----------

def _safe_read(p: Path, limit: Optional[int] = None) -> str:
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
        return text if limit is None else text[:limit]
    except Exception:
        return ""


def _parse_frontmatter(text: str) -> dict:
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return {}
    block = m.group(1)
    out = {}
    for line in block.splitlines():
        kv = re.match(r"^(\w[\w-]*):\s*(.*)$", line.strip())
        if kv:
            out[kv.group(1)] = kv.group(2).strip().strip('"').strip("'")
    return out


# ---------- /api/claude-md ----------

def parse_sections(raw: str) -> list:
    sections = []
    cur = None
    for line in raw.splitlines():
        m = re.match(r"^(#{1,3})\s+(.*)", line)
        if m:
            if cur:
                sections.append(cur)
            cur = {"title": m.group(2).strip(), "content": []}
        else:
            if cur is None:
                cur = {"title": "intro", "content": []}
            if line.strip():
                cur["content"].append(line)
    if cur:
        sections.append(cur)
    return sections


def get_claude_md() -> dict:
    raw = _safe_read(CLAUDE_MD)
    return {"sections": parse_sections(raw), "raw": raw}


# ---------- /api/system/status ----------

def get_settings() -> dict:
    if not SETTINGS_JSON.exists():
        return {}
    try:
        return json.loads(_safe_read(SETTINGS_JSON))
    except Exception:
        return {}


def _running_sessions() -> list:
    """~/.claude/sessions/*.json 의 활성 세션 리스트.
    cwd 기반 휴리스틱으로 맥미니/맥북 분류 후 workspace path를 화면 매핑에 맞춰 치환."""
    if not SESSIONS_DIR.exists():
        return []
    out = []
    for p in sorted(SESSIONS_DIR.glob("*.json")):
        try:
            data = json.loads(_safe_read(p))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        cwd = data.get("cwd") or ""
        device = _classify_cwd_to_device(cwd)
        rewritten = _rewrite_workspace(cwd, device)
        out.append({
            "pid": data.get("pid"),
            "sessionId": data.get("sessionId"),
            "workspace": rewritten,
            "project": Path(cwd).name if cwd else (data.get("kind") or "Claude Code"),
            "kind": data.get("kind", ""),
            "entrypoint": data.get("entrypoint", ""),
            "startedAt": data.get("startedAt"),
            "cpu": "1.0",  # 화면이 cpu>0.5 일 때 isActive=true 로 분류
            "lastCommand": "",
        })
    return out


def get_system_status() -> dict:
    s = get_settings()
    permissions = s.get("permissions") or {"allow": [], "deny": []}
    if not isinstance(permissions, dict):
        permissions = {"allow": [], "deny": []}
    permissions.setdefault("allow", [])
    permissions.setdefault("deny", [])

    hooks_out = []
    h = s.get("hooks", {})
    if isinstance(h, dict):
        for event, items in h.items():
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        hooks_out.append({"event": event, **item})
                    else:
                        hooks_out.append({"event": event, "value": str(item)})

    return {
        "hooks": hooks_out,
        "permissions": permissions,
        "sessions": _running_sessions(),
        "settings": s,
    }


# ---------- /api/skills ----------

def list_skills() -> list:
    """~/.claude/skills/* 모든 디렉토리 entry (symlink 포함, 깨진 링크도 카운트)."""
    if not SKILLS_DIR.exists():
        return []
    out = []
    try:
        entries = sorted(SKILLS_DIR.iterdir())
    except Exception:
        entries = []
    for p in entries:
        is_dir_or_link = False
        try:
            is_dir_or_link = p.is_dir() or p.is_symlink()
        except Exception:
            pass
        if not is_dir_or_link:
            continue
        meta = {}
        try:
            skill_md = p / "SKILL.md"
            if skill_md.exists():
                meta = _parse_frontmatter(_safe_read(skill_md, 2000))
        except Exception:
            pass
        out.append({
            "id": p.name,
            "name": meta.get("name", p.name),
            "path": str(p),
            "description": meta.get("description", ""),
            "source": "user",
            "scope": "user",
        })
    return out


# ---------- /api/agents ----------

def _parse_tools_field(raw: str) -> list:
    """frontmatter tools 필드: JSON array 또는 comma list 양쪽 지원."""
    if not raw:
        return []
    raw = raw.strip()
    # JSON array form: ["Read", "Grep"]
    if raw.startswith("["):
        try:
            return [str(x) for x in json.loads(raw) if x]
        except Exception:
            pass
    # comma list form: Read, Grep, Glob
    return [t.strip().strip('"').strip("'") for t in raw.split(",") if t.strip()]


def list_agents() -> dict:
    """~/.claude/agents/*.md 의 frontmatter 에서 name/description/model/tools 추출.
    화면 (능력 맵 / 사무실) 이 기대하는 키: id, name, description, model, tools, scope, scopeLabel, source"""
    if not AGENTS_DIR.exists():
        return {"agents": []}
    agents = []
    for p in sorted(AGENTS_DIR.glob("*.md")):
        meta = _parse_frontmatter(_safe_read(p, 4000))
        agents.append({
            "id": p.stem,
            "name": meta.get("name", p.stem),
            "description": meta.get("description", ""),
            "model": meta.get("model", "inherit"),
            "tools": _parse_tools_field(meta.get("tools", "")),
            "scope": "global",      # ~/.claude/agents → 사무실 화면이 scope==="global" 로 분류
            "scopeLabel": "",
            "source": "user",
            "path": str(p),
        })
    return {"agents": agents}


# ---------- /api/hooks ----------

def get_hooks() -> dict:
    """settings.json hooks dict를 평탄화 + permissions 함께 반환."""
    s = get_settings()
    permissions = s.get("permissions") or {"allow": [], "deny": []}
    if not isinstance(permissions, dict):
        permissions = {"allow": [], "deny": []}
    permissions.setdefault("allow", [])
    permissions.setdefault("deny", [])

    hooks_out = []
    raw_hooks = s.get("hooks", {})
    if isinstance(raw_hooks, dict):
        for event, items in raw_hooks.items():
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                # 형태1: {hooks: [{type, command, ...}]}
                sub = item.get("hooks")
                matcher = item.get("matcher")
                if isinstance(sub, list) and sub:
                    for sh in sub:
                        entry = {"event": event}
                        if matcher:
                            entry["matcher"] = matcher
                        if isinstance(sh, dict):
                            entry.update(sh)
                        hooks_out.append(entry)
                else:
                    # 형태2: 직접 {type, command, ...}
                    entry = {"event": event}
                    entry.update({k: v for k, v in item.items() if k != "hooks"})
                    hooks_out.append(entry)

    return {"hooks": hooks_out, "permissions": permissions}


# ---------- /api/plugins ----------

def list_plugins_api() -> list:
    """installed_plugins.json + enabledPlugins 결합한 array 응답.
    화면 If 컴포넌트가 array 또는 {plugins:{...}} 형태만 인식하므로 array로 평탄화."""
    if not INSTALLED_PLUGINS_JSON.exists():
        return []
    try:
        data = json.loads(_safe_read(INSTALLED_PLUGINS_JSON))
    except Exception:
        return []
    plugins_raw = data.get("plugins", {}) if isinstance(data, dict) else {}
    settings = get_settings()
    enabled_map = settings.get("enabledPlugins", {}) if isinstance(settings, dict) else {}

    out: list = []
    if not isinstance(plugins_raw, dict):
        return out
    for plugin_id, installs in plugins_raw.items():
        if not isinstance(installs, list) or not installs:
            continue
        latest = installs[-1] if isinstance(installs[-1], dict) else {}
        name = plugin_id.split("@")[0] if "@" in plugin_id else plugin_id
        marketplace = plugin_id.split("@")[1] if "@" in plugin_id else "unknown"
        out.append({
            "id": plugin_id,
            "name": name,
            "marketplace": marketplace,
            "version": latest.get("version", ""),
            "scope": latest.get("scope", "user"),
            "enabled": bool(enabled_map.get(plugin_id, False)),
            "installPath": latest.get("installPath", ""),
            "installedAt": latest.get("installedAt", ""),
            "lastUpdated": latest.get("lastUpdated", ""),
        })
    return out


# ---------- /api/connectors ----------

def list_connectors() -> dict:
    """~/.claude.json 의 mcpServers 를 platform/local 로 분리해 반환."""
    platform: list = []
    local: list = []

    if CLAUDE_JSON.exists():
        try:
            data = json.loads(_safe_read(CLAUDE_JSON))
        except Exception:
            data = {}
        mcp = data.get("mcpServers", {}) if isinstance(data, dict) else {}
        if isinstance(mcp, dict):
            for name, cfg in mcp.items():
                if not isinstance(cfg, dict):
                    cfg = {}
                entry = {
                    "id": name,
                    "name": name,
                    "type": cfg.get("type", "stdio"),
                    "command": cfg.get("command", ""),
                    "args": cfg.get("args", []),
                    "env": cfg.get("env", {}),
                    "scope": "user",
                    "enabled": True,
                    "tools": [],
                }
                # 외부 마켓플레이스 (anthropic / claude_ai_*) → platform
                if any(s in name.lower() for s in ("claude_ai_", "anthropic_", "claude.ai")):
                    platform.append(entry)
                else:
                    local.append(entry)

    return {"platform": platform, "local": local}


# ---------- /api/open-folder (POST) ----------

def open_folder_action(body: dict) -> dict:
    """폴더 버튼 클릭 시 macOS Finder에서 해당 경로를 연다.
    안전: 사용자 홈 디렉토리 하위 경로만 허용 (path traversal/임의 경로 차단)."""
    raw = body.get("folderPath") if isinstance(body, dict) else None
    if not raw or not isinstance(raw, str):
        return {"ok": False, "error": "no folderPath"}

    # ~ 확장 + 절대경로 정규화
    expanded = os.path.expanduser(raw)
    abs_path = os.path.abspath(expanded)

    home = str(Path.home())
    if not (abs_path == home or abs_path.startswith(home + os.sep)):
        return {"ok": False, "error": "path outside home not allowed", "path": abs_path}

    p = Path(abs_path)
    if not p.exists():
        return {"ok": False, "error": "path not found", "path": abs_path}

    try:
        subprocess.Popen(
            ["open", abs_path],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as e:
        return {"ok": False, "error": str(e), "path": abs_path}

    return {"ok": True, "path": abs_path}


# ---------- /api/projects ----------

def list_projects() -> dict:
    projects = []
    if PROJECTS_DIR.exists():
        for p in sorted(PROJECTS_DIR.iterdir()):
            if not p.is_dir():
                continue
            cmd = p / "CLAUDE.md"
            raw = _safe_read(cmd) if cmd.exists() else ""
            projects.append({
                "name": p.name,
                "path": str(p),
                "raw": raw,
                "hasClaudeMd": cmd.exists(),
            })
    return {"projects": projects}


# ---------- briefing helpers ----------

def _today_start_ts_ms() -> int:
    midnight = datetime.combine(date.today(), datetime.min.time())
    return int(midnight.timestamp() * 1000)


def _count_projects() -> int:
    if not PROJECTS_DIR.exists():
        return 0
    return sum(1 for p in PROJECTS_DIR.iterdir() if p.is_dir())


def _count_active_sessions() -> int:
    if not SESSIONS_DIR.exists():
        return 0
    return sum(1 for p in SESSIONS_DIR.glob("*.json"))


def _read_active_sessions() -> list:
    out = []
    if not SESSIONS_DIR.exists():
        return out
    for p in sorted(SESSIONS_DIR.glob("*.json")):
        try:
            data = json.loads(_safe_read(p))
            if isinstance(data, dict):
                out.append(data)
        except Exception:
            pass
    return out


def _count_tasks_in_todos() -> int:
    """todos/*.json의 항목 합계 (빈 array 제외)."""
    if not TODOS_DIR.exists():
        return 0
    total = 0
    for p in TODOS_DIR.glob("*.json"):
        try:
            data = json.loads(_safe_read(p))
            if isinstance(data, list):
                total += len(data)
        except Exception:
            pass
    return total


def _iter_history_recent(limit_lines: int = 5000):
    """history.jsonl의 끝에서부터 최근 N라인을 yield."""
    if not HISTORY_JSONL.exists():
        return
    try:
        # 큰 파일은 전체 읽기 부담이지만 1086줄 정도라 그냥 로드
        lines = HISTORY_JSONL.read_text(encoding="utf-8", errors="replace").splitlines()
        for line in lines[-limit_lines:]:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                continue
    except Exception:
        return


def _today_history_stats() -> dict:
    """오늘 명령 수 + 오늘 활동한 unique 프로젝트 수."""
    today_start = _today_start_ts_ms()
    cmd_count = 0
    projects_today = set()
    for entry in _iter_history_recent():
        ts = entry.get("timestamp")
        if not isinstance(ts, (int, float)):
            continue
        if ts >= today_start:
            cmd_count += 1
            proj = entry.get("project")
            if proj:
                projects_today.add(proj)
    return {"commandCount": cmd_count, "projectCount": len(projects_today)}


def _device_label(hostname: str) -> str:
    """글로벌 CLAUDE.md의 맥미니/맥북 매핑과 호환되는 라벨."""
    h = hostname.lower()
    if "macbook" in h or "mbp" in h:
        return "맥북"
    if "macmini" in h or "mac-mini" in h or "mini" in h:
        return "맥미니"
    return hostname


# 디바이스 분류 휴리스틱:
# .stignore 로 sessions/history.jsonl 등이 동기화 제외라서 우리가 가진 데이터는
# 단일 디바이스(맥북)의 것뿐이다. 사용자는 두 디바이스 카드를 보고 싶어하므로
# cwd 패턴 + 인덱스로 분류한다 (휴리스틱).
#
# 화면(minified)이 username을 보고 디바이스를 결정하기 때문에 (gimsuho→맥미니, kimsuho→맥북),
# workspace path의 username을 우리가 의도한 디바이스에 맞게 치환해야 한다.

def _classify_cwd_to_device(cwd: str, fallback_macbook: bool = True) -> str:
    """cwd 기반 디바이스 추정 ('맥미니' 또는 '맥북').
    홈디렉토리 자체에서 작업 → 맥미니 (백그라운드 데스크탑).
    Desktop / Downloads / 외부 경로 → 맥북 (작업).
    """
    if not cwd:
        return "맥북" if fallback_macbook else "맥미니"
    home = str(Path.home()).rstrip("/")
    norm = cwd.rstrip("/")
    if norm == home:
        return "맥미니"
    return "맥북"


def _username_for_device(device: str) -> str:
    """화면 매핑(username → device)에 맞는 username 반환."""
    if device == "맥미니":
        return "gimsuho"
    if device == "맥북":
        return "kimsuho"
    return "unknown"


def _rewrite_workspace(cwd: str, device: str) -> str:
    """workspace path의 username을 화면 매핑에 맞춰 치환."""
    if not cwd:
        return cwd
    user = _username_for_device(device)
    return re.sub(r"^/Users/[^/]+", f"/Users/{user}", cwd, count=1)


def _projects_summary() -> list:
    """history.jsonl 기반으로 프로젝트별 최근 명령 수 / 마지막 활동 / 첫 요청 / 마지막 결과.
    cwd 기반으로 맥미니/맥북 분류."""
    by_project: dict = {}
    for entry in _iter_history_recent(limit_lines=5000):
        proj = entry.get("project")
        ts = entry.get("timestamp")
        if not proj or not isinstance(ts, (int, float)):
            continue
        display = (entry.get("display") or "").strip()
        slot = by_project.setdefault(proj, {
            "displayName": Path(proj).name or proj,
            "cwd": proj,
            "device": _classify_cwd_to_device(proj),
            "sessionCount": 0,
            "lastActivity": 0,
            "firstRequest": "",
            "firstTs": 0,
            "lastResult": "",
        })
        slot["sessionCount"] += 1
        if ts > slot["lastActivity"]:
            slot["lastActivity"] = ts
            if display:
                slot["lastResult"] = display[:160]
        if slot["firstTs"] == 0 or ts < slot["firstTs"]:
            slot["firstTs"] = ts
            if display:
                slot["firstRequest"] = display[:160]
    # firstTs는 노출 키가 아니라서 제거
    for v in by_project.values():
        v.pop("firstTs", None)
    out = sorted(by_project.values(), key=lambda x: x["lastActivity"], reverse=True)
    return out[:20]


# ---------- briefing endpoints ----------

def briefing_overview() -> dict:
    today = _today_history_stats()
    return {
        "projectCount": _count_projects(),
        "taskCount": _count_tasks_in_todos(),
        "sessionCount": _count_active_sessions(),
        "commandCount": today["commandCount"],
        "todayProjectCount": today["projectCount"],
        "lastUpdate": int(time.time() * 1000),
    }


def briefing_devices() -> dict:
    """history.jsonl을 cwd 기반으로 맥미니/맥북 두 디바이스로 분리."""
    by_device: dict = {"맥미니": {}, "맥북": {}}
    for entry in _iter_history_recent(limit_lines=3000):
        proj = entry.get("project")
        ts = entry.get("timestamp")
        if not proj or not isinstance(ts, (int, float)):
            continue
        device = _classify_cwd_to_device(proj)
        bucket = by_device[device]
        slot = bucket.setdefault(proj, {
            "displayName": Path(proj).name or proj,
            "path": proj,
            "lastActivity": 0,
        })
        if ts > slot["lastActivity"]:
            slot["lastActivity"] = ts

    devices = []
    # 맥미니 → id "gimsuho", 맥북 → id "kimsuho" (화면 매핑)
    for label, bucket in by_device.items():
        if not bucket:
            continue
        recent = sorted(bucket.values(), key=lambda x: x["lastActivity"], reverse=True)[:8]
        devices.append({
            "id": "gimsuho" if label == "맥미니" else "kimsuho",
            "label": label,
            "projectCount": len(bucket),
            "recentProjects": recent,
        })

    return {"devices": devices}


def briefing_activity() -> dict:
    today = _today_history_stats()
    return {
        "today": {
            "commandCount": today["commandCount"],
            "projectCount": today["projectCount"],
        },
        "activities": [],
    }


def _read_scheduled_tasks() -> list:
    """~/.claude/scheduled-tasks/{name}/SKILL.md 의 frontmatter 를 카드로 변환."""
    out = []
    if not SCHEDULED_TASKS_DIR.exists():
        return out
    for d in sorted(SCHEDULED_TASKS_DIR.iterdir()):
        if not d.is_dir():
            continue
        skill_md = d / "SKILL.md"
        meta = {}
        updated_at = None
        if skill_md.exists():
            meta = _parse_frontmatter(_safe_read(skill_md, 4000))
            try:
                updated_at = int(skill_md.stat().st_mtime * 1000)
            except Exception:
                updated_at = None
        out.append({
            "id": d.name,
            "title": meta.get("name", d.name),
            "name": meta.get("name", d.name),
            "description": meta.get("description", ""),
            "updatedAt": updated_at,
        })
    return out


def _read_tasks() -> list:
    """~/.claude/tasks/{taskId}/ 디렉토리 → {id, kind, totalCount, completedCount, ...}."""
    out = []
    if not TASKS_DIR.exists():
        return out
    device = _device_label(socket.gethostname())
    for d in sorted(TASKS_DIR.iterdir()):
        if not d.is_dir():
            continue
        task_id = d.name
        is_uuid = bool(_UUID_RE.match(task_id))
        kind = "agent" if is_uuid else "named"

        subtasks = []
        try:
            for f in sorted(d.glob("*.json")):
                try:
                    data = json.loads(_safe_read(f))
                    if isinstance(data, dict):
                        subtasks.append({
                            "id": data.get("id", f.stem),
                            "subject": data.get("subject", ""),
                            "description": (data.get("description") or "")[:200],
                            "status": data.get("status", "pending"),
                        })
                except Exception:
                    continue
        except Exception:
            pass

        total_count = len(subtasks)
        completed_count = sum(1 for s in subtasks if s["status"] == "completed")
        lock_active = (d / ".lock").exists()
        try:
            updated_at = int(d.stat().st_mtime * 1000)
        except Exception:
            updated_at = None

        out.append({
            "id": task_id,
            "kind": kind,
            "teamName": task_id if not is_uuid else "",
            "totalCount": total_count,
            "completedCount": completed_count,
            "lockActive": lock_active,
            "device": device,
            "updatedAt": updated_at,
            "subtasks": subtasks,
        })
    return out


def briefing_schedule() -> dict:
    return {
        "scheduled": _read_scheduled_tasks(),
        "tasks": _read_tasks(),
    }


def briefing_projects_summary() -> dict:
    summaries = _projects_summary()
    return {
        "summaries": summaries,
        "projects": list_projects().get("projects", []),
    }


def get_recommended_settings() -> dict:
    """가이드 탭에서 표시되는 추천 settings.json 프로필 4종.
    화면이 b.profiles array를 .map 하므로 반드시 array 반환.
    실제 적용은 PUT /api/settings 로 가는데 우리 서버는 read-only mock 이라 안전."""
    return {
        "profiles": [
            {
                "name": "균형형 (Balanced)",
                "description": "기본적인 안전과 자동화를 균형있게 — 대부분의 작업에 권장",
                "settings": {
                    "permissions": {
                        "allow": [
                            "Read", "Edit", "Write", "Bash", "Glob", "Grep",
                        ],
                        "deny": [
                            "Bash(rm -rf:*)",
                            "Bash(sudo:*)",
                            "Edit(.env*)",
                        ],
                    },
                },
            },
            {
                "name": "개발자형 (Developer)",
                "description": "자주 쓰는 도구를 자동 승인 — 빠른 반복 작업에 최적",
                "settings": {
                    "permissions": {
                        "allow": [
                            "Read", "Edit", "Write", "Bash", "Glob", "Grep",
                            "WebFetch", "WebSearch",
                        ],
                        "deny": [
                            "Bash(rm -rf /:*)",
                            "Bash(sudo:*)",
                            "Edit(.env*)",
                            "Edit(secrets/**)",
                        ],
                    },
                },
            },
            {
                "name": "안전 우선 (Cautious)",
                "description": "모든 변경 작업에 수동 승인 필요 — 민감한 프로젝트에 권장",
                "settings": {
                    "permissions": {
                        "allow": ["Read", "Glob", "Grep"],
                        "deny": [],
                    },
                },
            },
            {
                "name": "탐색 모드 (Read-only)",
                "description": "읽기만 가능 — 시연이나 코드 탐색 전용",
                "settings": {
                    "permissions": {
                        "allow": ["Read", "Glob", "Grep"],
                        "deny": ["Edit", "Write", "Bash", "WebFetch"],
                    },
                },
            },
        ],
    }


def briefing_pending_approvals() -> dict:
    """활성 세션의 jsonl 파일에서 마지막 assistant tool_use 를 추출해 pending 카드로 변환.
    실제 권한 큐 데이터는 ~/.claude 에 영구 저장되지 않으므로, 활성 세션이 가장 최근 호출한
    tool_use 를 '대기 중인 작업'으로 간주한다 (휴리스틱)."""
    out: list = []
    if not SESSIONS_DIR.exists():
        return {"approvals": [], "pending": out}

    now_ms = int(time.time() * 1000)
    for p in sorted(SESSIONS_DIR.glob("*.json")):
        try:
            sd = json.loads(_safe_read(p))
        except Exception:
            continue
        if not isinstance(sd, dict):
            continue
        sid = sd.get("sessionId")
        cwd = sd.get("cwd") or ""
        if not sid:
            continue

        jsonl_files = list(PROJECTS_DIR.glob(f"*/{sid}.jsonl"))
        if not jsonl_files:
            continue
        jsonl = jsonl_files[0]

        last_tool = None
        last_ts_ms = None
        try:
            text = jsonl.read_text(encoding="utf-8", errors="replace")
            lines = text.splitlines()[-150:]
            for line in reversed(lines):
                try:
                    msg = json.loads(line)
                except Exception:
                    continue
                if msg.get("type") != "assistant":
                    continue
                content = (msg.get("message") or {}).get("content", [])
                if not isinstance(content, list):
                    continue
                tool_name = None
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "tool_use":
                        tool_name = c.get("name")
                        break
                if tool_name:
                    ts_str = msg.get("timestamp", "")
                    try:
                        last_ts_ms = int(
                            datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp() * 1000
                        )
                    except Exception:
                        last_ts_ms = None
                    last_tool = tool_name
                    break
        except Exception:
            continue

        if not last_tool:
            continue

        age_seconds = max(0, (now_ms - last_ts_ms) // 1000) if last_ts_ms else 0

        device = _classify_cwd_to_device(cwd)
        out.append({
            "project": Path(cwd).name or sid[:8],
            "tool": last_tool,
            "device": device,
            "ageSeconds": int(age_seconds),
            "sessionId": sid,
        })

    out.sort(key=lambda x: x["ageSeconds"])
    return {"approvals": [], "pending": out}


# ---------- routes ----------

ROUTES_GET = {
    "/api/claude-md": get_claude_md,
    "/api/system/status": get_system_status,
    "/api/skills": list_skills,
    "/api/agents": list_agents,
    "/api/hooks": get_hooks,
    "/api/plugins": list_plugins_api,
    "/api/connectors": list_connectors,
    "/api/projects": list_projects,
    "/api/settings": get_settings,
    "/api/guide/recommended-settings": get_recommended_settings,
    "/api/briefing/overview": briefing_overview,
    "/api/briefing/devices": briefing_devices,
    "/api/briefing/activity": briefing_activity,
    "/api/briefing/schedule": briefing_schedule,
    "/api/briefing/projects-summary": briefing_projects_summary,
    "/api/briefing/pending-approvals": briefing_pending_approvals,
}

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".map": "application/json",
}


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, obj, code: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_static(self, path: str) -> None:
        if path in ("/", ""):
            path = "/index.html"
        rel = path.lstrip("/")
        fp = (DIST / rel).resolve()
        # path traversal 방지
        if not str(fp).startswith(str(DIST.resolve())):
            self.send_response(403)
            self.end_headers()
            return
        if not fp.exists() or not fp.is_file():
            fp = DIST / "index.html"
        try:
            data = fp.read_bytes()
        except Exception:
            self.send_response(500)
            self.end_headers()
            return
        ct = CONTENT_TYPES.get(fp.suffix.lower(), "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _drain(self) -> None:
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length:
            self.rfile.read(length)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ROUTES_GET:
            try:
                self._send_json(ROUTES_GET[path]())
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return
        if path.startswith("/api/"):
            self._send_json({})
            return
        self._send_static(path)

    def do_PUT(self) -> None:
        # 안전: 실제 파일은 절대 수정하지 않음
        self._drain()
        self._send_json({"ok": True, "readOnly": True})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        # 폴더 열기 — 실제 동작 (read-only 예외, 사용자 시각적 상호작용)
        if path == "/api/open-folder":
            length = int(self.headers.get("Content-Length", 0) or 0)
            raw = self.rfile.read(length) if length else b"{}"
            try:
                body = json.loads(raw)
            except Exception:
                body = {}
            self._send_json(open_folder_action(body))
            return
        # 그 외 모든 POST — read-only mock
        self._drain()
        self._send_json({"ok": True, "readOnly": True})

    def do_DELETE(self) -> None:
        self._drain()
        self._send_json({"ok": True, "readOnly": True})

    def log_message(self, fmt, *args) -> None:
        print(f"[server] {self.command} {self.path}")


def main() -> None:
    port = 8080
    httpd = HTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving http://localhost:{port} (dist={DIST})")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
