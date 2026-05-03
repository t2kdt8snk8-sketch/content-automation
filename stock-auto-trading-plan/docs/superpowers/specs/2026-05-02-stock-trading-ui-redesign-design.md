# UI/UX Redesign — Stock Auto Trading Dashboard

**Date:** 2026-05-02  
**Scope:** Complete replacement of all HTML templates + CSS in `app/web/`  
**Stack:** Jinja2 templates + single CSS file (no framework added)

---

## Goals

- Mobile-first layout (360px base)
- Dark terminal aesthetic (Bloomberg-style)
- Summary at top → detail below on every page
- Strong visual hierarchy: important = large + bright, secondary = visible (not invisible gray)
- Aggressive use of visual elements: sparklines, score dials, progress bars, price bands, radar charts
- Keep all meaningful content; trim purely decorative filler

---

## Design System

### Colors

| Variable | Value | Use |
|----------|-------|-----|
| `--bg` | `#0a0e0d` | Page background |
| `--surface` | `#111a18` | Card / panel background |
| `--surface-2` | `#1a2622` | Elevated card / input bg |
| `--border` | `#1e2e2b` | Card borders |
| `--border-strong` | `#2e4a44` | Active/focused borders |
| `--accent` | `#00ff9d` | Primary CTA, active state, highlights |
| `--accent-dim` | `#00cc7a` | Positive values, success |
| `--negative` | `#ff4d4d` | Negative values, danger, blocked |
| `--warning` | `#ffb347` | Warning, medium risk |
| `--text` | `#e8f0ee` | Primary text |
| `--text-2` | `#a8bcb8` | Secondary text (visible, not ghost) |
| `--text-3` | `#7a8a87` | Tertiary labels only — never for important data |

### Typography

- **Numbers / Tickers:** `JetBrains Mono, 'Courier New', monospace` — loaded from Google Fonts
- **Labels / Body:** `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
- Scale: stat numbers 48px, ticker 32px, section titles 18px, body 14px, labels 11px (uppercase)

### Spacing & Radius

- Base unit: 8px
- Card radius: 8px
- Button radius: 6px
- Mobile padding: 16px horizontal

---

## Navigation

### Header (all pages, sticky top)

```
┌──────────────────────────────────────────┐
│  ▪ AI Research   대시보드│후보│데이터│LEAN │
└──────────────────────────────────────────┘
```

- Height: 52px
- Background: `#0a0e0d` + `backdrop-filter: blur(12px)` + bottom border `--border`
- Logo: small square icon + text, left
- Tabs: right-aligned, 4 tabs always visible (no scroll, no hamburger)
- Active tab: `--accent` underline 2px, text `--text`
- Inactive tab: text `--text-2`, no underline
- Logout: small link inside header far right (after LEAN tab), text `--text-3`, only when logged in

### Desktop (768px+)

- Header expands max-width to 1180px centered
- Tabs spaced with more padding

---

## Pages

### Login

**Layout:** centered card, full viewport height

**Top half (visual):** dark grid background + animated-looking SVG chart lines (static SVG)
- Mini market tiles grid (decorative, colorful)
- Chart line SVG in accent color

**Bottom half (form):**
- Eyebrow: `AI Stock Research Desk`
- Title: `투자 보조 시스템` — 32px, bold, `--text`
- Subtitle: `--text-2`, 14px
- Password input — full width, dark styled
- Submit button — full width, accent bg

---

### Dashboard

**Top: Stat Summary Grid (2×2)**

Each stat card:
- Label: 11px uppercase `--text-3`
- Number: 48px mono `--text` (not dimmed)
- Color accent bar on left edge: accent (neutral stat), `--accent-dim` (positive), `--negative` (blocked/alert)

Cards:
1. 감시 중 — neutral
2. 후보 — accent if >0
3. 승인 대기 — warning color if >0
4. 승인 완료 — accent-dim

**Middle: Pipeline Status**

4 steps, mobile = vertical stack, desktop = horizontal row.

Each step has:
- Step number + name
- State indicator: `완료` = `--accent-dim` left border + dim bg, `진행중` = `--accent` left border + bright, `대기` = `--border-strong` left border + `--surface`
- Short description (14px `--text-2`)

**Bottom: Quick Actions**

Two full-width buttons stacked:
- `데이터 수집` — secondary style (border only)
- `후보 갱신` — primary style (accent bg)

---

### Candidates (후보)

**Page header:** eyebrow + title + lede (lede in `--text-2` at 14px — readable)

**Candidate Cards (stacked, full width)**

Each card:

```
┌────────────────────────────────────┐
│  AAPL              [72] ██████░░░  │  ← ticker 32px mono + score badge + mini bar
│  2026-01-15                        │  ← date, --text-3
│  ─────────────────────────────── │
│  [sparkline SVG full width]        │
│  ─────────────────────────────── │
│  진입 근거: 텍스트 2줄...           │  ← 14px --text
│                                    │
│  ● 위험: LOW    ● 기본 모델         │  ← colored dot badges
│                                    │
│  [AI 의견서 생성]                   │  ← full width primary
│  [최근 의견서 →]                    │  ← full width ghost (only if exists)
└────────────────────────────────────┘
```

Score badge: number 20px mono, background color-coded:
- 70+ : `--accent-dim` bg
- 50–69: `--warning` bg
- <50: `--negative` bg

Risk badge: colored dot + text — green/yellow/red

---

### Memo Detail (의견서 상세)

**Top Summary Banner**

Full-width dark card:
```
AAPL · BUY                    [84]
2026-01-15  |  위험: LOW  |  승인대기
```
- Ticker + recommendation: 28px bold `--text`
- Score: 48px mono, color-coded by value
- Meta row: date, risk, approval — 12px, color-coded badges

**Price Band Visualization**

Horizontal gradient bar (red → yellow → green) with 3 price point markers:
- 손절 (red circle), 진입 (yellow), 재평가 (green)
- Price numbers: 14px mono below each marker

**Content Tabs (horizontal scroll)**

`점수지도 | 가격 | 시나리오 | 근거 | 위험`

Each tab panel:

**점수지도:**
- Radar chart SVG (full width, 280px tall)
- Score bars below: 5 dimensions, each with label + colored bar + number

**가격:**
- Entry / stop / review KV list
- 확신도, 최대비중, 보유기간, 승인상태

**시나리오:**
- Bull card (green left border) + Bear card (red left border)
- Both visible stacked mobile, side by side desktop

**근거:**
- 핵심 근거 list (green dot)
- 반대 근거 list (red dot)

**위험:**
- 거래 금지 조건 tag grid (red-tinted cards)

**Sticky Bottom Bar**

```
[텔레그램 전송]  [거절]  [승인 기록 ▶]
```
- 승인 disabled when `risk_status == "blocked"` — visually grayed, tooltip "blocked"
- Background `--surface` + blur + top border

---

### Data (데이터)

**Top Summary:** `관심종목 N개` — 24px mono

**Section Tabs:** `관심종목 추가 | CSV 업로드 | 목록`

**추가 tab:** Form with dark-styled inputs (full width), save button

**CSV 업로드 tab:**
- Two upload cards (watchlist / 가격) each with file input + button

**목록 tab:**
- 2-column grid on mobile, 3-column desktop
- Each watch card: ticker 20px mono, name, sector — all visible, no ghost text

---

### LEAN Export

**Top Summary Banner:**
- `승인 완료 N개` — 48px mono `--accent-dim`
- Subtitle: `LEAN CSV 준비됨`

**Export Button:** Full width, accent, large (52px height)

**Terminal Preview Card:**
- Dark bg `#0d1a15`, monospace pre
- Dot row (decorative) at top
- CSV preview content

---

## Responsive Breakpoints

| Breakpoint | Changes |
|------------|---------|
| 360px (base) | Single column, all stacked |
| 640px | 2-col stat grid, 2-col watchlist |
| 768px | Side-by-side panels where appropriate, wider padding |
| 1024px+ | Max-width container centered, 3-col watchlist |

---

## Files Changed

- `app/web/static/app.css` — full replacement
- `app/web/templates/base.html` — full replacement
- `app/web/templates/login.html` — full replacement
- `app/web/templates/dashboard.html` — full replacement
- `app/web/templates/candidates.html` — full replacement
- `app/web/templates/memo_detail.html` — full replacement
- `app/web/templates/uploads.html` — full replacement
- `app/web/templates/exports.html` — full replacement

No backend changes. No new dependencies beyond Google Fonts (JetBrains Mono via CDN in `<head>`).
