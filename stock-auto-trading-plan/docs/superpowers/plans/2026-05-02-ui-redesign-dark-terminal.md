# UI Redesign: Dark Terminal Mobile-First — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all HTML templates and CSS with a dark terminal aesthetic, mobile-first design (Hard Dark Terminal style).

**Architecture:** Pure HTML/CSS + minimal inline JS. No new backend code. No new Python dependencies. Google Fonts (JetBrains Mono) loaded via `<link>` in base.html. All 8 files replaced completely.

**Tech Stack:** Jinja2 templates, hand-rolled CSS (no framework), FastAPI/Uvicorn dev server

---

## File Map

| File | Action |
|------|--------|
| `app/web/static/app.css` | Full replacement |
| `app/web/templates/base.html` | Full replacement |
| `app/web/templates/login.html` | Full replacement (standalone, no base) |
| `app/web/templates/dashboard.html` | Full replacement |
| `app/web/templates/candidates.html` | Full replacement |
| `app/web/templates/memo_detail.html` | Full replacement (inline JS for tabs) |
| `app/web/templates/uploads.html` | Full replacement (inline JS for tabs) |
| `app/web/templates/exports.html` | Full replacement |

---

## How to run for visual testing

```bash
cd /Users/minsoopark/Downloads/Vibecoding/stock-auto-trading-plan
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Login at `http://127.0.0.1:8000/login` — use the `ADMIN_PASSWORD` from your `.env` file.

---

## Task 1: CSS Design System

**Files:**
- Modify: `app/web/static/app.css`

- [ ] **Step 1: Replace app.css completely**

```css
/* ===== TOKENS ===== */
:root {
  --bg: #0a0e0d;
  --surface: #111a18;
  --surface-2: #1a2622;
  --border: #1e2e2b;
  --border-strong: #2e4a44;
  --accent: #00ff9d;
  --accent-dim: #00cc7a;
  --negative: #ff4d4d;
  --warning: #ffb347;
  --text: #e8f0ee;
  --text-2: #a8bcb8;
  --text-3: #7a8a87;
  --mono: 'JetBrains Mono', 'Courier New', monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  --radius: 8px;
  --radius-sm: 6px;
  --shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

/* ===== RESET ===== */
*, *::before, *::after { box-sizing: border-box; }
html { background: var(--bg); }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.5;
}
a { color: inherit; text-decoration: none; }
button, input, textarea, select { font: inherit; }
h1, h2, h3, h4 { margin: 0; font-weight: 800; }
p { margin: 0; }
ul, ol { margin: 0; padding: 0; list-style: none; }
dl, dd, dt { margin: 0; }

/* ===== SITE HEADER ===== */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 52px;
  background: rgba(10, 14, 13, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: stretch;
  padding: 0 16px;
  gap: 0;
}

.site-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: 0.02em;
  white-space: nowrap;
  margin-right: 8px;
}

.site-logo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.site-nav {
  display: flex;
  align-items: stretch;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}
.site-nav::-webkit-scrollbar { display: none; }

.site-nav a {
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: color 0.1s;
}
.site-nav a:hover { color: var(--text); }
.site-nav a.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.site-logout {
  display: flex;
  align-items: center;
  padding: 0 0 0 8px;
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  flex-shrink: 0;
}
.site-logout:hover { color: var(--text-2); }

/* ===== MAIN CONTENT ===== */
.main-content {
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: 20px 16px 72px;
}

@media (min-width: 768px) {
  .main-content { padding: 28px 24px 80px; }
}

/* ===== PAGE HEADER ===== */
.page-header { margin-bottom: 20px; }

.eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 4px;
}

.page-title {
  font-size: clamp(24px, 6vw, 36px);
  font-weight: 850;
  color: var(--text);
  line-height: 1.1;
  margin-bottom: 6px;
}

.page-lede {
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.55;
  max-width: 640px;
}

/* ===== STAT GRID ===== */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

@media (min-width: 640px) {
  .stat-grid { grid-template-columns: repeat(4, 1fr); }
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-strong);
  border-radius: var(--radius);
  padding: 16px 14px 14px;
  position: relative;
}

.stat-card.s-accent { border-left-color: var(--accent); }
.stat-card.s-positive { border-left-color: var(--accent-dim); }
.stat-card.s-warning { border-left-color: var(--warning); }
.stat-card.s-negative { border-left-color: var(--negative); }

.stat-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2);
  margin-bottom: 10px;
}

.stat-value {
  font-family: var(--mono);
  font-size: 44px;
  line-height: 1;
  font-weight: 700;
  color: var(--text);
}

.stat-card.s-accent .stat-value { color: var(--accent); }
.stat-card.s-positive .stat-value { color: var(--accent-dim); }
.stat-card.s-warning .stat-value { color: var(--warning); }
.stat-card.s-negative .stat-value { color: var(--negative); }

/* ===== CARD ===== */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.card-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text);
}

.card-meta {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ===== PIPELINE ===== */
.pipeline {
  display: grid;
  gap: 8px;
}

@media (min-width: 640px) {
  .pipeline { grid-template-columns: repeat(4, 1fr); }
}

.pipeline-step {
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  padding: 14px 12px;
}

.pipeline-step.ps-done { border-left-color: var(--accent-dim); }
.pipeline-step.ps-active {
  border-left-color: var(--accent);
  background: rgba(0, 255, 157, 0.04);
}

.pipeline-num {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-3);
  margin-bottom: 4px;
}

.pipeline-name {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  margin-bottom: 3px;
}

.pipeline-step.ps-active .pipeline-name { color: var(--accent); }

.pipeline-desc {
  font-size: 12px;
  color: var(--text-2);
}

/* ===== QUICK ACTIONS ===== */
.quick-actions {
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
}

@media (min-width: 640px) {
  .quick-actions { grid-template-columns: repeat(2, 1fr); }
}

/* ===== DASHBOARD GRID ===== */
.dash-grid {
  display: grid;
  gap: 12px;
}

@media (min-width: 768px) {
  .dash-grid {
    grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
  }
}

/* ===== BUTTONS ===== */
button, .btn {
  appearance: none;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text);
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  cursor: pointer;
  width: 100%;
  transition: background 0.1s, border-color 0.1s;
}

button:hover, .btn:hover {
  background: var(--surface);
  border-color: var(--text-3);
}

button.primary, .btn.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #0a0e0d;
  font-weight: 900;
}

button.primary:hover, .btn.primary:hover {
  background: #00e88d;
}

button.ghost, .btn.ghost {
  border-color: var(--border);
  background: transparent;
  color: var(--text-2);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ===== KV LIST ===== */
.kv-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}

.kv-row:last-child { border-bottom: none; }

.kv-key {
  font-size: 13px;
  color: var(--text-2);
  flex-shrink: 0;
}

.kv-val {
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
  text-align: right;
  font-family: var(--mono);
  word-break: break-all;
}

/* ===== FORMS ===== */
.form-stack { display: grid; gap: 10px; }

input[type="text"],
input[type="password"],
input[type="file"],
textarea {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 12px;
  color: var(--text);
  font-size: 14px;
}

input::placeholder, textarea::placeholder { color: var(--text-3); }
input:focus, textarea:focus {
  outline: none;
  border-color: var(--accent);
}

textarea { min-height: 90px; resize: vertical; }

label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ===== BADGE ===== */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.badge.b-green {
  background: rgba(0, 204, 122, 0.15);
  color: var(--accent-dim);
  border: 1px solid rgba(0, 204, 122, 0.3);
}

.badge.b-yellow {
  background: rgba(255, 179, 71, 0.15);
  color: var(--warning);
  border: 1px solid rgba(255, 179, 71, 0.3);
}

.badge.b-red {
  background: rgba(255, 77, 77, 0.15);
  color: var(--negative);
  border: 1px solid rgba(255, 77, 77, 0.3);
}

.badge.b-neutral {
  background: var(--surface-2);
  color: var(--text-2);
  border: 1px solid var(--border);
}

/* ===== SCORE ===== */
.score-badge {
  font-family: var(--mono);
  font-size: 18px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text);
  flex-shrink: 0;
}

.score-badge.sc-high { background: rgba(0, 204, 122, 0.15); color: var(--accent-dim); }
.score-badge.sc-mid { background: rgba(255, 179, 71, 0.15); color: var(--warning); }
.score-badge.sc-low { background: rgba(255, 77, 77, 0.15); color: var(--negative); }

.score-bar-track {
  height: 6px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
  margin-top: 8px;
}

.score-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}
.score-bar-fill.sc-mid { background: var(--warning); }
.score-bar-fill.sc-low { background: var(--negative); }

/* ===== SPARKLINE ===== */
.sparkline {
  width: 100%;
  display: block;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  margin-bottom: 12px;
}

.spark-main {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.spark-bg {
  fill: none;
  stroke: rgba(0, 255, 157, 0.2);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sparkline circle {
  fill: var(--bg);
  stroke: var(--accent);
  stroke-width: 2.5;
}

/* ===== CANDIDATE CARD ===== */
.candidate-list { display: grid; gap: 12px; }

.candidate-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.candidate-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.ticker {
  font-family: var(--mono);
  font-size: 30px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}

.candidate-date {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}

.candidate-reason {
  font-size: 14px;
  color: var(--text);
  line-height: 1.55;
  margin-bottom: 12px;
}

.candidate-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.candidate-actions { display: grid; gap: 8px; }

/* ===== MEMO DETAIL ===== */
.memo-banner {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 16px 16px;
  margin-bottom: 16px;
}

.memo-ticker-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.memo-ticker {
  font-family: var(--mono);
  font-size: 36px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}

.memo-reco {
  font-size: 16px;
  font-weight: 800;
  color: var(--accent);
  margin-top: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.memo-score-large {
  font-family: var(--mono);
  font-size: 52px;
  font-weight: 700;
  line-height: 1;
  text-align: right;
  flex-shrink: 0;
}

.memo-score-large.sc-high { color: var(--accent-dim); }
.memo-score-large.sc-mid { color: var(--warning); }
.memo-score-large.sc-low { color: var(--negative); }

.memo-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ===== MEMO TABS ===== */
.memo-tabs {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
  gap: 0;
}
.memo-tabs::-webkit-scrollbar { display: none; }

.memo-tab {
  flex: 0 0 auto;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  background: none;
  border-radius: 0;
  border-left: none;
  border-top: none;
  border-right: none;
  border-bottom: 2px solid transparent;
  min-height: auto;
  width: auto;
  transition: color 0.1s;
}

.memo-tab:hover { color: var(--text); }
.memo-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.memo-tab-panel { display: none; }
.memo-tab-panel.active { display: block; }

/* ===== PRICE MAP ===== */
.price-band {
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--negative), var(--warning), var(--accent-dim));
  margin-bottom: 20px;
}

.price-points {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  text-align: center;
}

.price-point { display: grid; justify-items: center; gap: 6px; }

.price-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid var(--warning);
  background: var(--bg);
}
.price-dot.pd-stop { border-color: var(--negative); }
.price-dot.pd-review { border-color: var(--accent-dim); }

.price-plabel { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.05em; }
.price-pvalue { font-family: var(--mono); font-size: 18px; font-weight: 700; color: var(--text); }

/* ===== RADAR CHART ===== */
.radar-wrap {
  max-width: 280px;
  margin: 0 auto 20px;
}

.radar-fill {
  fill: rgba(0, 255, 157, 0.1);
  stroke: var(--accent);
  stroke-width: 2;
}

.radar-grid-line {
  fill: none;
  stroke: var(--border-strong);
  stroke-width: 1.5;
}

.radar-grid-line.inner {
  stroke-dasharray: 4 4;
}

.radar-chart circle {
  fill: var(--bg);
  stroke: var(--accent);
  stroke-width: 2;
}

/* ===== SCORE BARS ===== */
.score-bars-list { display: grid; gap: 12px; }

.score-bar-row {
  display: grid;
  grid-template-columns: 76px 1fr 36px;
  align-items: center;
  gap: 10px;
}

.sbar-label { font-size: 12px; color: var(--text-2); font-weight: 700; }
.sbar-num { font-family: var(--mono); font-size: 12px; color: var(--text); text-align: right; }

/* ===== SCENARIO ===== */
.scenario-grid { display: grid; gap: 10px; }

@media (min-width: 640px) {
  .scenario-grid { grid-template-columns: repeat(2, 1fr); }
}

.scenario-card {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px;
}
.scenario-card.bull { border-left-color: var(--accent-dim); }
.scenario-card.bear { border-left-color: var(--negative); }

.scenario-label {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}
.scenario-card.bull .scenario-label { color: var(--accent-dim); }
.scenario-card.bear .scenario-label { color: var(--negative); }

.scenario-text { font-size: 14px; color: var(--text); line-height: 1.55; }

/* ===== INSIGHT LIST ===== */
.insight-list { display: grid; gap: 8px; }

.insight-list li {
  position: relative;
  padding: 10px 12px 10px 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-size: 14px;
  color: var(--text);
  line-height: 1.45;
}

.insight-list li::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 16px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-dim);
}
.insight-list.bad li::before { background: var(--negative); }

/* ===== RISK TAGS ===== */
.risk-grid { display: flex; flex-wrap: wrap; gap: 8px; }

.risk-tag {
  background: rgba(255, 77, 77, 0.1);
  border: 1px solid rgba(255, 77, 77, 0.25);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--negative);
}

/* ===== STICKY BAR ===== */
.sticky-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  background: rgba(10, 14, 13, 0.95);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
  padding: 12px 16px;
  display: grid;
  grid-template-columns: 1fr 1fr 1.5fr;
  gap: 8px;
}

/* ===== SECTION TABS ===== */
.section-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}

.section-tab {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  background: none;
  border-radius: 0;
  border-left: none;
  border-top: none;
  border-right: none;
  border-bottom: 2px solid transparent;
  min-height: auto;
  width: auto;
  transition: color 0.1s;
}

.section-tab:hover { color: var(--text); }
.section-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.section-panel { display: none; }
.section-panel.active { display: block; }

/* ===== WATCHLIST ===== */
.watchlist-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

@media (min-width: 640px) {
  .watchlist-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1024px) {
  .watchlist-grid { grid-template-columns: repeat(4, 1fr); }
}

.watch-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px 12px;
}

.watch-ticker {
  font-family: var(--mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
}

.watch-name { font-size: 13px; color: var(--text-2); }
.watch-sector { font-size: 11px; color: var(--text-3); margin-top: 2px; }

/* ===== LEAN EXPORT ===== */
.export-summary {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px 20px;
  margin-bottom: 16px;
  text-align: center;
}

.export-count {
  font-family: var(--mono);
  font-size: 60px;
  font-weight: 700;
  color: var(--accent-dim);
  line-height: 1;
  margin-bottom: 8px;
}

.export-label { font-size: 14px; color: var(--text-2); }

.terminal-card {
  background: #0d1a15;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  overflow-x: auto;
  margin-bottom: 12px;
}

.terminal-dots { display: flex; gap: 6px; margin-bottom: 14px; }
.terminal-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-strong);
}

.terminal-card pre {
  margin: 0;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--accent);
  line-height: 1.7;
}

/* ===== PERFORMANCE CHART ===== */
.perf-chart { width: 100%; display: block; }

.perf-chart .c-main {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.perf-chart .c-soft {
  fill: none;
  stroke: rgba(0, 204, 122, 0.25);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.perf-chart circle {
  fill: var(--surface);
  stroke: var(--accent);
  stroke-width: 3;
}

.perf-chart line {
  stroke: var(--border-strong);
  stroke-width: 1;
  stroke-dasharray: 6 4;
}

.bar-row { display: grid; gap: 6px; margin-bottom: 12px; }
.bar-label { font-size: 12px; color: var(--text-2); font-weight: 700; }
.bar-track { height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.bar-fill { height: 100%; border-radius: inherit; background: var(--accent-dim); }
.bar-fill.neg { background: var(--negative); }

/* ===== LOGIN PAGE ===== */
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px 16px;
  background: var(--bg);
}

.login-card {
  width: min(900px, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

@media (min-width: 640px) {
  .login-card {
    display: grid;
    grid-template-columns: 1fr 380px;
  }
}

.login-visual {
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  padding: 32px;
  min-height: 220px;
  display: grid;
  align-content: center;
  gap: 20px;
}

@media (min-width: 640px) {
  .login-visual {
    border-bottom: none;
    border-right: 1px solid var(--border);
    min-height: 480px;
  }
}

.login-chart path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.login-chart circle {
  fill: var(--surface-2);
  stroke: var(--accent);
  stroke-width: 3;
}

.login-mini-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.9fr 1fr;
  gap: 6px;
}

.login-tile {
  height: 56px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
}

.lt1 { background: rgba(0, 255, 157, 0.12); }
.lt2 { background: rgba(255, 179, 71, 0.12); }
.lt3 { background: rgba(0, 179, 204, 0.12); }
.lt4 { background: rgba(255, 77, 77, 0.12); }
.lt5 { background: rgba(0, 255, 157, 0.08); }
.lt6 { background: rgba(36, 91, 159, 0.12); }

.login-form-wrap {
  padding: 32px 24px;
  display: grid;
  align-content: center;
}

.login-eyebrow {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-bottom: 6px;
}

.login-title {
  font-size: 22px;
  font-weight: 850;
  color: var(--text);
  margin-bottom: 6px;
}

.login-sub {
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 24px;
  line-height: 1.5;
}

.login-form { display: grid; gap: 12px; }

/* ===== UTILS ===== */
.notice {
  background: rgba(0, 204, 122, 0.1);
  border: 1px solid rgba(0, 204, 122, 0.3);
  border-radius: var(--radius-sm);
  color: var(--accent-dim);
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 16px;
}

.error-msg {
  color: var(--negative);
  font-size: 13px;
  font-weight: 700;
}

.empty-state {
  background: var(--surface);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 24px;
  text-align: center;
  color: var(--text-2);
  font-size: 14px;
}

.section-gap { margin-bottom: 12px; }
.row-gap { display: grid; gap: 8px; }
```

- [ ] **Step 2: Start server and verify no style errors**

```bash
cd /Users/minsoopark/Downloads/Vibecoding/stock-auto-trading-plan
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Open `http://127.0.0.1:8000/login` — page should load (even if unstyled), no 500 errors.

- [ ] **Step 3: Commit**

```bash
git add app/web/static/app.css
git commit -m "feat(ui): replace CSS with dark terminal design system"
```

---

## Task 2: Base Template (Header + Nav)

**Files:**
- Modify: `app/web/templates/base.html`

- [ ] **Step 1: Replace base.html**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ title or "AI Investment Research" }}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/app.css">
  </head>
  <body>
    <header class="site-header">
      <a class="site-logo" href="/dashboard">
        <span class="site-logo-dot"></span>
        AI Research
      </a>
      <nav class="site-nav">
        <a href="/dashboard" {% if request.url.path == '/dashboard' or request.url.path == '/' %}class="active"{% endif %}>대시보드</a>
        <a href="/candidates" {% if request.url.path.startswith('/candidates') or request.url.path.startswith('/memos') %}class="active"{% endif %}>후보</a>
        <a href="/uploads" {% if request.url.path == '/uploads' %}class="active"{% endif %}>데이터</a>
        <a href="/exports" {% if request.url.path == '/exports' %}class="active"{% endif %}>LEAN</a>
      </nav>
      <a class="site-logout" href="/logout">로그아웃</a>
    </header>
    <main class="main-content">
      {% block content %}{% endblock %}
    </main>
  </body>
</html>
```

- [ ] **Step 2: Verify header appears on dashboard**

Open `http://127.0.0.1:8000/dashboard` (after login).  
Check: dark header, 4 tabs visible, "대시보드" tab has accent underline.

- [ ] **Step 3: Commit**

```bash
git add app/web/templates/base.html
git commit -m "feat(ui): replace base template with dark tab header"
```

---

## Task 3: Login Page

**Files:**
- Modify: `app/web/templates/login.html`

- [ ] **Step 1: Replace login.html**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>로그인 — AI Investment Research</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/app.css">
  </head>
  <body>
    <div class="login-page">
      <div class="login-card">
        <section class="login-visual" aria-hidden="true">
          <div class="login-mini-grid">
            <span class="login-tile lt1"></span>
            <span class="login-tile lt2"></span>
            <span class="login-tile lt3"></span>
            <span class="login-tile lt4"></span>
            <span class="login-tile lt5"></span>
            <span class="login-tile lt6"></span>
          </div>
          <svg class="login-chart" viewBox="0 0 360 120" role="img" aria-label="차트">
            <path d="M10 86 C58 42 84 66 126 52 S196 32 238 58 302 76 350 28"></path>
            <circle cx="238" cy="58" r="7"></circle>
            <circle cx="350" cy="28" r="7"></circle>
          </svg>
        </section>
        <section class="login-form-wrap">
          <p class="login-eyebrow">AI Stock Research Desk</p>
          <h1 class="login-title">투자 보조 시스템</h1>
          <p class="login-sub">자동 수집, AI 의견서, 사람 승인 흐름을 한 화면에서 관리.</p>
          <form class="login-form" method="post" action="/login">
            <div>
              <label for="pw">관리 비밀번호</label>
              <input id="pw" type="password" name="password" autocomplete="current-password" required>
            </div>
            {% if error %}<p class="error-msg">{{ error }}</p>{% endif %}
            <button type="submit" class="primary">로그인</button>
          </form>
        </section>
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 2: Verify login page**

Open `http://127.0.0.1:8000/login`.  
Check: dark background, two-panel card (visual left / form right on desktop), accent chart line, green login button.

- [ ] **Step 3: Commit**

```bash
git add app/web/templates/login.html
git commit -m "feat(ui): redesign login page — dark terminal style"
```

---

## Task 4: Dashboard

**Files:**
- Modify: `app/web/templates/dashboard.html`

Template variables from backend:
- `watchlist_count`, `candidate_count`, `memo_count`, `pending_count` — integers
- `latest_run` — object with `.status`, `.source`, `.message` (or None)
- `summary` — object with `.average_return`, `.average_excess_return`, `.count`

- [ ] **Step 1: Replace dashboard.html**

```html
{% extends "base.html" %}
{% block content %}

{# ===== STAT SUMMARY ===== #}
<div class="stat-grid">
  <div class="stat-card s-accent">
    <div class="stat-label">감시 중</div>
    <div class="stat-value">{{ watchlist_count }}</div>
  </div>
  <div class="stat-card {% if candidate_count > 0 %}s-accent{% endif %}">
    <div class="stat-label">후보</div>
    <div class="stat-value">{{ candidate_count }}</div>
  </div>
  <div class="stat-card {% if pending_count > 0 %}s-warning{% endif %}">
    <div class="stat-label">승인 대기</div>
    <div class="stat-value">{{ pending_count }}</div>
  </div>
  <div class="stat-card s-positive">
    <div class="stat-label">의견서 총계</div>
    <div class="stat-value">{{ memo_count }}</div>
  </div>
</div>

{# ===== QUICK ACTIONS ===== #}
<div class="quick-actions section-gap">
  <form method="post" action="/run/collect">
    <button class="primary">▶ 데이터 수집 + 후보 갱신</button>
  </form>
  <a class="btn ghost" href="/candidates">후보 검토 →</a>
</div>

{# ===== PIPELINE ===== #}
<div class="card section-gap">
  <div class="card-head">
    <span class="card-title">자동 처리 흐름</span>
    <span class="card-meta">장마감 후 루틴</span>
  </div>
  <div class="pipeline">
    <div class="pipeline-step ps-active">
      <div class="pipeline-num">01</div>
      <div class="pipeline-name">데이터 수집</div>
      <div class="pipeline-desc">자동 수집 + CSV 백업</div>
    </div>
    <div class="pipeline-step {% if candidate_count > 0 %}ps-done{% endif %}">
      <div class="pipeline-num">02</div>
      <div class="pipeline-name">후보 선별</div>
      <div class="pipeline-desc">기본 모델 필터</div>
    </div>
    <div class="pipeline-step {% if memo_count > 0 %}ps-done{% endif %}">
      <div class="pipeline-num">03</div>
      <div class="pipeline-name">AI 의견서</div>
      <div class="pipeline-desc">고정 양식 초안</div>
    </div>
    <div class="pipeline-step {% if pending_count > 0 %}ps-active{% endif %}">
      <div class="pipeline-num">04</div>
      <div class="pipeline-name">승인 대기</div>
      <div class="pipeline-desc">자동 주문 없음</div>
    </div>
  </div>
</div>

{# ===== DETAIL GRID ===== #}
<div class="dash-grid">

  {# 최근 수집 #}
  <div class="card">
    <div class="card-head">
      <span class="card-title">최근 수집</span>
      <span class="card-meta">data run</span>
    </div>
    {% if latest_run %}
      <div class="kv-row"><span class="kv-key">상태</span><span class="kv-val">{{ latest_run.status }}</span></div>
      <div class="kv-row"><span class="kv-key">출처</span><span class="kv-val">{{ latest_run.source }}</span></div>
      <div class="kv-row"><span class="kv-key">메시지</span><span class="kv-val">{{ latest_run.message }}</span></div>
    {% else %}
      <p class="empty-state">수집 기록 없음. 관심종목 추가 후 수집 실행.</p>
    {% endif %}
  </div>

  {# 성과 요약 #}
  <div class="card">
    <div class="card-head">
      <span class="card-title">10일 성과 요약</span>
      <span class="card-meta">score tracking</span>
    </div>
    {% set avg = summary.average_return * 100 %}
    {% set excess = summary.average_excess_return * 100 %}
    <svg class="perf-chart" viewBox="0 0 420 140" role="img" aria-label="성과 차트">
      <line x1="24" y1="100" x2="396" y2="100"></line>
      <path class="c-soft" d="M28 102 C74 70 116 108 162 76 S248 44 300 78 352 118 392 50"></path>
      <path class="c-main" d="M28 116 C74 86 116 98 162 84 S248 66 300 88 352 78 392 64"></path>
      <circle cx="392" cy="64" r="7"></circle>
    </svg>
    <div class="bar-row">
      <div class="bar-label">평균 수익 {{ "%.2f"|format(avg) }}%</div>
      <div class="bar-track">
        <div class="bar-fill {% if avg < 0 %}neg{% endif %}" style="width: {{ [avg|abs * 5, 100]|min }}%"></div>
      </div>
    </div>
    <div class="bar-row">
      <div class="bar-label">초과수익 {{ "%.2f"|format(excess) }}%</div>
      <div class="bar-track">
        <div class="bar-fill {% if excess < 0 %}neg{% endif %}" style="width: {{ [excess|abs * 5, 100]|min }}%"></div>
      </div>
    </div>
    <div style="margin-top: 12px;">
      <div class="kv-row"><span class="kv-key">표본</span><span class="kv-val">{{ summary.count }}</span></div>
    </div>
    <div style="margin-top: 12px;">
      <form method="post" action="/run/performance">
        <button>성과 업데이트</button>
      </form>
    </div>
  </div>

</div>
{% endblock %}
```

- [ ] **Step 2: Verify dashboard**

Open `http://127.0.0.1:8000/dashboard`.  
Check: 4 stat cards with large mono numbers, pipeline 4 steps, performance chart renders, quick action buttons full-width.

- [ ] **Step 3: Commit**

```bash
git add app/web/templates/dashboard.html
git commit -m "feat(ui): redesign dashboard — stat grid + pipeline + perf chart"
```

---

## Task 5: Candidates Page

**Files:**
- Modify: `app/web/templates/candidates.html`

Template variables:
- `items` — list of Candidate objects: `.ticker`, `.as_of_date`, `.baseline_score`, `.candidate_reason`, `.risk_status`, `.id`, `.memos` (list)

Score classification helper: score ≥ 70 = high, 50–69 = mid, < 50 = low.

- [ ] **Step 1: Replace candidates.html**

```html
{% extends "base.html" %}
{% block content %}

<div class="page-header">
  <p class="eyebrow">Signal Review</p>
  <h1 class="page-title">후보 종목</h1>
  <p class="page-lede">기본 모델이 먼저 고른 종목. 여기서 AI 의견서를 생성하면 근거, 반대 근거, 위험 조건까지 고정 양식으로 나온다.</p>
</div>

<div class="candidate-list">
  {% for item in items %}
    {% set score = item.baseline_score|int %}
    {% if score >= 70 %}{% set sc = "sc-high" %}
    {% elif score >= 50 %}{% set sc = "sc-mid" %}
    {% else %}{% set sc = "sc-low" %}{% endif %}

    {% set risk = item.risk_status|lower %}
    {% if risk == "ok" or risk == "low" %}{% set rb = "b-green" %}
    {% elif risk == "medium" or risk == "watch" %}{% set rb = "b-yellow" %}
    {% else %}{% set rb = "b-red" %}{% endif %}

    <article class="candidate-card">
      <div class="candidate-header">
        <div>
          <div class="ticker">{{ item.ticker }}</div>
          <div class="candidate-date">{{ item.as_of_date }}</div>
        </div>
        <div class="score-badge {{ sc }}">{{ "%.0f"|format(item.baseline_score) }}</div>
      </div>

      <svg class="sparkline" viewBox="0 0 320 80" role="img" aria-label="점수 시각화">
        <path class="spark-bg" d="M12 56 C48 34 74 58 106 30 S168 10 206 38 260 62 308 14"></path>
        <path class="spark-main" d="M12 62 C48 50 74 54 106 42 S168 30 206 44 260 38 308 26"></path>
        <circle cx="308" cy="26" r="5"></circle>
      </svg>

      <div class="score-bar-track">
        <div class="score-bar-fill {{ sc }}" style="width: {{ [score, 100]|min }}%"></div>
      </div>

      <p class="candidate-reason" style="margin-top: 12px;">{{ item.candidate_reason }}</p>

      <div class="candidate-badges">
        <span class="badge {{ rb }}">위험: {{ item.risk_status }}</span>
        <span class="badge b-neutral">기본 모델</span>
        <span class="badge b-neutral">의견서 가능</span>
      </div>

      <div class="candidate-actions">
        <form method="post" action="/candidates/{{ item.id }}/memo">
          <button class="primary">AI 의견서 생성</button>
        </form>
        {% if item.memos %}
          <a class="btn ghost" href="/memos/{{ item.memos[-1].id }}">최근 의견서 →</a>
        {% endif %}
      </div>
    </article>
  {% else %}
    <div class="empty-state">
      <strong>후보 없음</strong><br>
      대시보드에서 데이터 수집/후보 갱신을 먼저 실행.
    </div>
  {% endfor %}
</div>
{% endblock %}
```

- [ ] **Step 2: Verify candidates page**

Open `http://127.0.0.1:8000/candidates`.  
Check: cards stacked full-width, ticker 30px mono, score badge color-coded, sparkline renders, risk badge colored dot, buttons stacked.

- [ ] **Step 3: Commit**

```bash
git add app/web/templates/candidates.html
git commit -m "feat(ui): redesign candidates page — dark cards with score badges"
```

---

## Task 6: Memo Detail Page

**Files:**
- Modify: `app/web/templates/memo_detail.html`

Template variables:
- `memo` — object: `.ticker`, `.recommendation`, `.total_score`, `.as_of_date`, `.risk_status`, `.approval_status`, `.confidence`, `.max_weight`, `.holding_period`, `.stop_price`, `.entry_price`, `.review_price`, `.score_price_trend`, `.score_fundamental`, `.score_news_event`, `.score_flow_volume`, `.score_reward_risk`, `.bull_case`, `.bear_case`, `.id`
- `key_reasons` — list of strings
- `counter_reasons` — list of strings
- `do_not_trade` — list of strings
- `risk_messages` — list of strings

- [ ] **Step 1: Replace memo_detail.html**

```html
{% extends "base.html" %}
{% block content %}
{% if not memo %}
  <p class="error-msg" style="padding: 20px;">의견서를 찾을 수 없음.</p>
{% else %}
  {% set score = memo.total_score|int %}
  {% if score >= 70 %}{% set sc = "sc-high" %}
  {% elif score >= 50 %}{% set sc = "sc-mid" %}
  {% else %}{% set sc = "sc-low" %}{% endif %}

  {% set risk = memo.risk_status|lower %}
  {% if risk == "ok" or risk == "low" %}{% set rb = "b-green" %}
  {% elif risk == "medium" or risk == "watch" %}{% set rb = "b-yellow" %}
  {% else %}{% set rb = "b-red" %}{% endif %}

  {% set appr = memo.approval_status|lower %}
  {% if appr == "approved" %}{% set ab = "b-green" %}
  {% elif appr == "rejected" %}{% set ab = "b-red" %}
  {% else %}{% set ab = "b-neutral" %}{% endif %}

  {# ===== SUMMARY BANNER ===== #}
  <div class="memo-banner">
    <div class="memo-ticker-row">
      <div>
        <div class="memo-ticker">{{ memo.ticker }}</div>
        <div class="memo-reco">{{ memo.recommendation }}</div>
      </div>
      <div class="memo-score-large {{ sc }}">{{ "%.0f"|format(memo.total_score) }}</div>
    </div>
    <div class="memo-meta-row">
      <span class="badge b-neutral">{{ memo.as_of_date }}</span>
      <span class="badge {{ rb }}">위험: {{ memo.risk_status }}</span>
      <span class="badge {{ ab }}">{{ memo.approval_status }}</span>
    </div>
  </div>

  {# ===== PRICE BAND QUICK VIEW ===== #}
  <div class="card section-gap">
    <div class="card-head">
      <span class="card-title">판단 가격대</span>
      <span class="card-meta">entry corridor</span>
    </div>
    <div class="price-band"></div>
    <div class="price-points">
      <div class="price-point">
        <div class="price-dot pd-stop"></div>
        <div class="price-plabel">손절</div>
        <div class="price-pvalue">{{ "%.2f"|format(memo.stop_price) }}</div>
      </div>
      <div class="price-point">
        <div class="price-dot"></div>
        <div class="price-plabel">진입</div>
        <div class="price-pvalue">{{ "%.2f"|format(memo.entry_price) }}</div>
      </div>
      <div class="price-point">
        <div class="price-dot pd-review"></div>
        <div class="price-plabel">재평가</div>
        <div class="price-pvalue">{{ "%.2f"|format(memo.review_price) }}</div>
      </div>
    </div>
  </div>

  {# ===== TAB NAV ===== #}
  <div class="memo-tabs" role="tablist">
    <button class="memo-tab active" data-tab="scores">점수지도</button>
    <button class="memo-tab" data-tab="details">상세</button>
    <button class="memo-tab" data-tab="scenario">시나리오</button>
    <button class="memo-tab" data-tab="reasons">근거</button>
    <button class="memo-tab" data-tab="risk">위험</button>
  </div>

  {# === TAB: 점수지도 === #}
  <div class="memo-tab-panel active" id="tab-scores">
    <div class="card">
      <div class="card-head">
        <span class="card-title">점수 지도</span>
        <span class="card-meta">fixed rubric</span>
      </div>
      <div class="radar-wrap">
        <svg class="radar-chart" viewBox="0 0 320 280" role="img" aria-label="점수 레이더 차트">
          <polygon class="radar-grid-line" points="160,24 284,104 236,238 84,238 36,104"></polygon>
          <polygon class="radar-grid-line inner" points="160,72 238,122 208,204 112,204 82,122"></polygon>
          <polygon class="radar-fill" points="160,48 250,116 222,210 98,218 68,108"></polygon>
          <circle cx="160" cy="48" r="6"></circle>
          <circle cx="250" cy="116" r="6"></circle>
          <circle cx="222" cy="210" r="6"></circle>
          <circle cx="98" cy="218" r="6"></circle>
          <circle cx="68" cy="108" r="6"></circle>
        </svg>
      </div>
      <div class="score-bars-list">
        <div class="score-bar-row">
          <span class="sbar-label">가격/추세</span>
          <div class="score-bar-track"><div class="score-bar-fill" style="width: {{ [memo.score_price_trend * 5, 100]|min }}%"></div></div>
          <span class="sbar-num">{{ memo.score_price_trend }}</span>
        </div>
        <div class="score-bar-row">
          <span class="sbar-label">실적/재무</span>
          <div class="score-bar-track"><div class="score-bar-fill" style="width: {{ [memo.score_fundamental * 5, 100]|min }}%"></div></div>
          <span class="sbar-num">{{ memo.score_fundamental }}</span>
        </div>
        <div class="score-bar-row">
          <span class="sbar-label">뉴스/이벤트</span>
          <div class="score-bar-track"><div class="score-bar-fill" style="width: {{ [memo.score_news_event * 5, 100]|min }}%"></div></div>
          <span class="sbar-num">{{ memo.score_news_event }}</span>
        </div>
        <div class="score-bar-row">
          <span class="sbar-label">수급/거래량</span>
          <div class="score-bar-track"><div class="score-bar-fill" style="width: {{ [memo.score_flow_volume * 6.67, 100]|min }}%"></div></div>
          <span class="sbar-num">{{ memo.score_flow_volume }}</span>
        </div>
        <div class="score-bar-row">
          <span class="sbar-label">손익비</span>
          <div class="score-bar-track"><div class="score-bar-fill" style="width: {{ [memo.score_reward_risk * 4, 100]|min }}%"></div></div>
          <span class="sbar-num">{{ memo.score_reward_risk }}</span>
        </div>
      </div>
    </div>
  </div>

  {# === TAB: 상세 === #}
  <div class="memo-tab-panel" id="tab-details">
    <div class="card">
      <div class="card-head">
        <span class="card-title">상세 정보</span>
        <span class="card-meta">decision data</span>
      </div>
      <div class="kv-row"><span class="kv-key">확신도</span><span class="kv-val">{{ "%.0f"|format(memo.confidence) }}</span></div>
      <div class="kv-row"><span class="kv-key">위험 상태</span><span class="kv-val">{{ memo.risk_status }}</span></div>
      <div class="kv-row"><span class="kv-key">승인 상태</span><span class="kv-val">{{ memo.approval_status }}</span></div>
      <div class="kv-row"><span class="kv-key">최대비중</span><span class="kv-val">{{ "%.1f"|format(memo.max_weight * 100) }}%</span></div>
      <div class="kv-row"><span class="kv-key">보유 기간</span><span class="kv-val">{{ memo.holding_period }}</span></div>
      <div class="kv-row"><span class="kv-key">손절가</span><span class="kv-val">{{ "%.2f"|format(memo.stop_price) }}</span></div>
      <div class="kv-row"><span class="kv-key">진입가</span><span class="kv-val">{{ "%.2f"|format(memo.entry_price) }}</span></div>
      <div class="kv-row"><span class="kv-key">재평가가</span><span class="kv-val">{{ "%.2f"|format(memo.review_price) }}</span></div>
    </div>
  </div>

  {# === TAB: 시나리오 === #}
  <div class="memo-tab-panel" id="tab-scenario">
    <div class="scenario-grid">
      <article class="scenario-card bull">
        <div class="scenario-label">↑ 상승 시나리오</div>
        <p class="scenario-text">{{ memo.bull_case }}</p>
      </article>
      <article class="scenario-card bear">
        <div class="scenario-label">↓ 하락 시나리오</div>
        <p class="scenario-text">{{ memo.bear_case }}</p>
      </article>
    </div>
  </div>

  {# === TAB: 근거 === #}
  <div class="memo-tab-panel" id="tab-reasons">
    <div class="card section-gap">
      <div class="card-head">
        <span class="card-title">핵심 근거</span>
        <span class="card-meta">why it can work</span>
      </div>
      <ul class="insight-list">
        {% for reason in key_reasons %}
          <li>{{ reason }}</li>
        {% else %}
          <li>저장된 핵심 근거 없음.</li>
        {% endfor %}
      </ul>
    </div>
    <div class="card">
      <div class="card-head">
        <span class="card-title">반대 근거</span>
        <span class="card-meta">what can break</span>
      </div>
      <ul class="insight-list bad">
        {% for reason in counter_reasons %}
          <li>{{ reason }}</li>
        {% else %}
          <li>저장된 반대 근거 없음.</li>
        {% endfor %}
      </ul>
    </div>
  </div>

  {# === TAB: 위험 === #}
  <div class="memo-tab-panel" id="tab-risk">
    <div class="card">
      <div class="card-head">
        <span class="card-title">거래 금지 조건</span>
        <span class="card-meta">risk gate</span>
      </div>
      <div class="risk-grid">
        {% for item in do_not_trade %}
          <span class="risk-tag">{{ item }}</span>
        {% endfor %}
        {% for item in risk_messages %}
          <span class="risk-tag">{{ item }}</span>
        {% endfor %}
        {% if not do_not_trade and not risk_messages %}
          <span style="color: var(--text-2); font-size: 14px;">별도 조건 없음</span>
        {% endif %}
      </div>
    </div>
  </div>

  {# ===== STICKY ACTIONS ===== #}
  <div class="sticky-bar">
    <form method="post" action="/memos/{{ memo.id }}/telegram">
      <button>텔레그램</button>
    </form>
    <form method="post" action="/memos/{{ memo.id }}/decision">
      <input type="hidden" name="decision" value="rejected">
      <button class="ghost">거절</button>
    </form>
    <form method="post" action="/memos/{{ memo.id }}/decision">
      <input type="hidden" name="decision" value="approved">
      <button class="primary" {% if memo.risk_status == "blocked" %}disabled{% endif %}>
        {% if memo.risk_status == "blocked" %}차단됨{% else %}승인 기록 ▶{% endif %}
      </button>
    </form>
  </div>

  <script>
    (function() {
      var tabs = document.querySelectorAll('.memo-tab');
      var panels = document.querySelectorAll('.memo-tab-panel');
      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          tabs.forEach(function(t) { t.classList.remove('active'); });
          panels.forEach(function(p) { p.classList.remove('active'); });
          tab.classList.add('active');
          document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
      });
    })();
  </script>
{% endif %}
{% endblock %}
```

- [ ] **Step 2: Verify memo detail**

Navigate to a memo (from candidates page → AI 의견서 생성, or directly via `/memos/1`).  
Check: banner with ticker + score, price band gradient, all 5 tabs switch correctly, sticky bar at bottom, approved button disabled when risk_status is "blocked".

- [ ] **Step 3: Commit**

```bash
git add app/web/templates/memo_detail.html
git commit -m "feat(ui): redesign memo detail — tabbed layout with sticky actions"
```

---

## Task 7: Data / Uploads Page

**Files:**
- Modify: `app/web/templates/uploads.html`

Template variables:
- `items` — list of Watchlist objects: `.ticker`, `.name`, `.sector`
- `message` — string (optional success message)

- [ ] **Step 1: Replace uploads.html**

```html
{% extends "base.html" %}
{% block content %}

<div class="page-header">
  <p class="eyebrow">Data Intake</p>
  <h1 class="page-title">데이터 관리</h1>
  <p class="page-lede">관심종목은 한 번 넣어두면 자동 수집 루틴이 사용한다. CSV는 자동 수집 실패 시 백업 입력용.</p>
</div>

{# Summary #}
<div class="stat-grid" style="grid-template-columns: repeat(2, 1fr); max-width: 300px; margin-bottom: 20px;">
  <div class="stat-card s-accent">
    <div class="stat-label">관심종목</div>
    <div class="stat-value">{{ items|length }}</div>
  </div>
</div>

{% if message %}<div class="notice">{{ message }}</div>{% endif %}

{# Section Tabs #}
<div class="section-tabs">
  <button class="section-tab active" data-sec="add">종목 추가</button>
  <button class="section-tab" data-sec="csv">CSV 업로드</button>
  <button class="section-tab" data-sec="list">목록</button>
</div>

{# ADD #}
<div class="section-panel active" id="sec-add">
  <div class="card">
    <div class="card-head">
      <span class="card-title">관심종목 추가</span>
      <span class="card-meta">watchlist</span>
    </div>
    <form method="post" action="/watchlist" class="form-stack">
      <div>
        <label for="ticker">Ticker</label>
        <input id="ticker" name="ticker" placeholder="예: AAPL" required>
      </div>
      <div>
        <label for="name">이름</label>
        <input id="name" name="name" placeholder="Apple Inc.">
      </div>
      <div>
        <label for="sector">섹터</label>
        <input id="sector" name="sector" placeholder="Technology">
      </div>
      <div>
        <label for="notes">메모</label>
        <textarea id="notes" name="notes" placeholder="기타 메모"></textarea>
      </div>
      <button class="primary">저장</button>
    </form>
  </div>
</div>

{# CSV #}
<div class="section-panel" id="sec-csv">
  <div class="card section-gap">
    <div class="card-head">
      <span class="card-title">관심종목 CSV</span>
      <span class="card-meta">watchlist import</span>
    </div>
    <form method="post" action="/uploads/watchlist" enctype="multipart/form-data" class="form-stack">
      <input type="file" name="file" accept=".csv" required>
      <button>관심종목 CSV 업로드</button>
    </form>
  </div>
  <div class="card">
    <div class="card-head">
      <span class="card-title">가격 CSV</span>
      <span class="card-meta">price data</span>
    </div>
    <form method="post" action="/uploads/prices" enctype="multipart/form-data" class="form-stack">
      <input type="file" name="file" accept=".csv" required>
      <button>가격 CSV 업로드</button>
    </form>
  </div>
</div>

{# LIST #}
<div class="section-panel" id="sec-list">
  {% if items %}
    <div class="watchlist-grid">
      {% for item in items %}
        <div class="watch-card">
          <div class="watch-ticker">{{ item.ticker }}</div>
          <div class="watch-name">{{ item.name or "이름 없음" }}</div>
          <div class="watch-sector">{{ item.sector or "섹터 없음" }}</div>
        </div>
      {% endfor %}
    </div>
  {% else %}
    <p class="empty-state">관심종목 없음. 종목 추가 탭에서 추가.</p>
  {% endif %}
</div>

<script>
  (function() {
    var tabs = document.querySelectorAll('.section-tab');
    var panels = document.querySelectorAll('.section-panel');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        panels.forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('sec-' + tab.dataset.sec).classList.add('active');
      });
    });
  })();
</script>
{% endblock %}
```

- [ ] **Step 2: Verify uploads page**

Open `http://127.0.0.1:8000/uploads`.  
Check: count stat card, 3 tabs switch correctly, form inputs dark-styled, watchlist grid shows in 목록 tab.

- [ ] **Step 3: Commit**

```bash
git add app/web/templates/uploads.html
git commit -m "feat(ui): redesign data page — tabbed sections with dark forms"
```

---

## Task 8: LEAN Export Page

**Files:**
- Modify: `app/web/templates/exports.html`

No template variables (static page).

- [ ] **Step 1: Replace exports.html**

```html
{% extends "base.html" %}
{% block content %}

<div class="page-header">
  <p class="eyebrow">QuantConnect</p>
  <h1 class="page-title">LEAN 내보내기</h1>
  <p class="page-lede">승인된 의견서만 LEAN이 읽을 수 있는 CSV로 뽑는다. 실제 주문 연결은 다음 단계에서 붙인다.</p>
</div>

<div class="export-summary">
  <div class="export-count">CSV</div>
  <div class="export-label">승인된 의견서 → LEAN 신호 파일</div>
</div>

<div style="margin-bottom: 16px;">
  <a class="btn primary" href="/exports/lean.csv" style="font-size: 16px; min-height: 52px;">
    lean_signals.csv 다운로드 ↓
  </a>
</div>

<div class="card-head" style="margin-bottom: 8px;">
  <span class="card-title">파이프라인</span>
  <span class="card-meta">approved only</span>
</div>

<div class="pipeline section-gap" style="grid-template-columns: repeat(3, 1fr);">
  <div class="pipeline-step ps-done">
    <div class="pipeline-num">01</div>
    <div class="pipeline-name">AI 의견서</div>
    <div class="pipeline-desc">생성 완료</div>
  </div>
  <div class="pipeline-step ps-done">
    <div class="pipeline-num">02</div>
    <div class="pipeline-name">사람 승인</div>
    <div class="pipeline-desc">최종 결정 기록</div>
  </div>
  <div class="pipeline-step ps-active">
    <div class="pipeline-num">03</div>
    <div class="pipeline-name">LEAN CSV</div>
    <div class="pipeline-desc">여기서 다운로드</div>
  </div>
</div>

<div class="terminal-card">
  <div class="terminal-dots">
    <span></span><span></span><span></span>
  </div>
  <pre>ticker,weight,entry,stop,review
AAPL,0.05,196.40,188.20,211.00
MSFT,0.04,412.10,398.80,437.50</pre>
</div>

{% endblock %}
```

- [ ] **Step 2: Verify exports page**

Open `http://127.0.0.1:8000/exports`.  
Check: "CSV" large accent text, full-width download button, 3-step pipeline, terminal card with green monospaced text.

- [ ] **Step 3: Commit**

```bash
git add app/web/templates/exports.html
git commit -m "feat(ui): redesign LEAN export page — terminal card + download CTA"
```

---

## Task 9: Full Pass — Cross-Page Check

No code changes. Visual QA across all pages.

- [ ] **Step 1: Login → Dashboard → Candidates → Memo → Data → LEAN**

Walk through each page on mobile width (360px viewport in DevTools).  
Check for each page:
- No horizontal scroll (content fits 360px)
- Stat numbers / ticker text not clipped
- Buttons tappable height ≥ 44px
- No invisible-gray text for important data
- Dark background consistent

- [ ] **Step 2: Tablet check (640px)**

Resize to 640px. Check:
- Stat grid becomes 4-column
- Pipeline becomes 4-column
- Watchlist becomes 3-column
- Login card shows two-panel layout

- [ ] **Step 3: Desktop check (1024px+)**

Resize to 1200px. Check:
- Header tabs not cramped
- Dashboard detail grid side-by-side
- Content max-width 1180px centered

- [ ] **Step 4: Final commit**

```bash
git add -p  # confirm no unexpected files
git commit -m "feat(ui): complete dark terminal mobile-first redesign"
```
