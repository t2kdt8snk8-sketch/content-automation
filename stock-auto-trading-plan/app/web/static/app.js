/* AI Investment Research — UI infra (vanilla) */

(function () {
  'use strict';

  // ===== Toast =====
  const TOAST_TIMEOUT = 4500;
  function ensureToastStack() {
    let stack = document.getElementById('toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'toast-stack';
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }
  function dismissToast(el) {
    if (!el) return;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  }
  window.toast = function (message, type, options) {
    const stack = ensureToastStack();
    const el = document.createElement('div');
    el.className = 'toast t-' + (type || 'ok');
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.textContent = message || '';
    el.appendChild(msg);
    if (options && options.cta && options.href) {
      const a = document.createElement('a');
      a.className = 'cta';
      a.href = options.href;
      a.textContent = options.cta;
      el.appendChild(a);
    }
    const close = document.createElement('button');
    close.className = 'close';
    close.setAttribute('aria-label', '닫기');
    close.textContent = '×';
    close.addEventListener('click', () => dismissToast(el));
    el.appendChild(close);
    stack.appendChild(el);
    setTimeout(() => dismissToast(el), TOAST_TIMEOUT);
    return el;
  };

  // ===== Hash state =====
  function readHashSet() {
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return new Set();
    return new Set(raw.split(',').filter(Boolean));
  }
  function writeHashSet(set) {
    const arr = Array.from(set);
    if (arr.length === 0) {
      history.replaceState(null, '', location.pathname + location.search);
    } else {
      history.replaceState(null, '', location.pathname + location.search + '#' + arr.join(','));
    }
  }

  // ===== Collapsible cards =====
  function bindCollapsibles() {
    const open = readHashSet();
    document.querySelectorAll('[data-collapsible]').forEach((card) => {
      const id = card.getAttribute('data-collapsible');
      const head = card.querySelector('.collapsible-head');
      if (!head) return;
      if (id && open.has(id)) card.classList.add('is-open');
      head.addEventListener('click', () => {
        card.classList.toggle('is-open');
        if (id) {
          const cur = readHashSet();
          if (card.classList.contains('is-open')) cur.add(id); else cur.delete(id);
          writeHashSet(cur);
        }
      });
    });
  }

  // ===== Expand rows (inline within cards/lists) =====
  function bindExpandRows() {
    document.querySelectorAll('[data-expand-row]').forEach((row) => {
      const detail = row.nextElementSibling;
      if (!detail || !detail.classList.contains('expand-row-detail')) return;
      row.addEventListener('click', () => {
        row.classList.toggle('is-open');
      });
    });
  }

  // ===== Tabs (memo / uploads sections) =====
  function bindTabs() {
    document.querySelectorAll('[data-tab-group]').forEach((group) => {
      const buttons = group.querySelectorAll('[data-tab]');
      const panels = document.querySelectorAll(
        '[data-tab-panel-group="' + group.getAttribute('data-tab-group') + '"]'
      );
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-tab');
          buttons.forEach((b) => b.classList.toggle('active', b === btn));
          panels.forEach((p) =>
            p.classList.toggle('active', p.getAttribute('data-tab-panel') === target)
          );
          btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        });
      });
    });
  }

  // ===== Toggle group (perf 5/10/20) =====
  function bindToggleGroups() {
    document.querySelectorAll('[data-toggle-group]').forEach((group) => {
      const buttons = group.querySelectorAll('.toggle-btn');
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          buttons.forEach((b) => b.classList.toggle('is-active', b === btn));
          const target = btn.getAttribute('data-target');
          const root = group.getAttribute('data-toggle-group');
          document.querySelectorAll('[data-toggle-panel="' + root + '"]').forEach((p) => {
            p.classList.toggle('active', p.getAttribute('data-target') === target);
          });
        });
      });
    });
  }

  // ===== SSE: collection pipeline =====
  let sseSource = null;
  let sseRetry = 0;
  function startRunStream() {
    const target = document.getElementById('run-progress');
    if (!target) return;
    if (sseSource) sseSource.close();
    try {
      sseSource = new EventSource('/api/run/stream');
    } catch (e) {
      return;
    }
    sseSource.onmessage = function (ev) {
      try {
        const data = JSON.parse(ev.data);
        renderRunStep(target, data);
        if (data.kind === 'pipeline_done') {
          window.toast(data.message || '데이터 처리 완료', 'ok', {
            cta: '후보 보기 →',
            href: '/candidates',
          });
          setTimeout(() => location.reload(), 800);
        } else if (data.kind === 'pipeline_error') {
          window.toast('처리 중 오류: ' + (data.message || '알 수 없음'), 'err');
        }
      } catch (e) {}
    };
    sseSource.onerror = function () {
      if (sseSource) sseSource.close();
      sseSource = null;
      sseRetry = Math.min(sseRetry + 1, 5);
      setTimeout(startRunStream, 1000 * sseRetry);
    };
  }

  function renderRunStep(target, data) {
    if (!data || !data.step) return;
    const stepEl = target.querySelector('[data-step="' + data.step + '"]');
    if (!stepEl) return;
    stepEl.classList.remove('is-active', 'is-done', 'is-error');
    if (data.status === 'running') stepEl.classList.add('is-active');
    else if (data.status === 'done') stepEl.classList.add('is-done');
    else if (data.status === 'error') stepEl.classList.add('is-error');
    const note = stepEl.querySelector('.step-note');
    if (note && data.message) note.textContent = data.message;
    const time = stepEl.querySelector('.step-time');
    if (time && data.at) time.textContent = data.at;
  }

  // ===== Run collection (background fetch) =====
  function bindRunForms() {
    document.querySelectorAll('[data-run-collect]').forEach((form) => {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const btn = form.querySelector('button');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner"></span> 시작 중…';
        }
        fetch('/run/collect', { method: 'POST' })
          .then((r) => {
            if (!r.ok) throw new Error('실패');
            const card = document.getElementById('run-progress-card');
            if (card) card.classList.add('is-open');
            window.toast('데이터 수집 시작', 'ok');
            startRunStream();
          })
          .catch(() => {
            window.toast('수집 시작 실패', 'err');
          })
          .finally(() => {
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = btn.getAttribute('data-label') || '데이터 수집';
            }
          });
      });
    });
  }

  // ===== Inline memo generation (candidate card) =====
  function bindMemoGenerate() {
    document.querySelectorAll('[data-generate-memo]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const candidateId = btn.getAttribute('data-generate-memo');
        const card = btn.closest('[data-candidate-card]');
        if (card) card.classList.add('is-loading');
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> AI 분석 중…';
        fetch('/candidates/' + candidateId + '/memo', { method: 'POST', headers: { Accept: 'application/json' } })
          .then((r) => r.json().catch(() => ({})))
          .then((data) => {
            if (data && data.memo_id) {
              window.toast('의견서 생성됨', 'ok', { cta: '메모 보기 →', href: '/memos/' + data.memo_id });
              setTimeout(() => { location.href = '/memos/' + data.memo_id; }, 600);
            } else {
              window.toast('의견서 생성 실패', 'err');
              if (card) card.classList.remove('is-loading');
              btn.disabled = false;
              btn.innerHTML = orig;
            }
          })
          .catch(() => {
            window.toast('네트워크 오류', 'err');
            if (card) card.classList.remove('is-loading');
            btn.disabled = false;
            btn.innerHTML = orig;
          });
      });
    });
  }

  // ===== Scheduler poll =====
  function bindSchedulerPoll() {
    const target = document.getElementById('scheduler-status');
    if (!target) return;
    function fetchStatus() {
      fetch('/api/scheduler/status').then((r) => r.json()).then((data) => {
        const next = target.querySelector('[data-next-run]');
        const last = target.querySelector('[data-last-run]');
        if (next && data.next_run_at) next.textContent = data.next_run_at;
        if (last && data.last_run) last.textContent = data.last_run;
      }).catch(() => {});
    }
    fetchStatus();
    setInterval(fetchStatus, 30000);
  }

  // ===== Copy to clipboard =====
  function bindCopy() {
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-copy');
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            window.toast('복사됨', 'ok');
          });
        }
      });
    });
  }

  // ===== Boot =====
  document.addEventListener('DOMContentLoaded', () => {
    bindCollapsibles();
    bindExpandRows();
    bindTabs();
    bindToggleGroups();
    bindRunForms();
    bindMemoGenerate();
    bindSchedulerPoll();
    bindCopy();

    // server-pushed initial toast (via meta)
    const initialToast = document.querySelector('meta[name="toast"]');
    if (initialToast) {
      const msg = initialToast.getAttribute('content') || '';
      const type = initialToast.getAttribute('data-type') || 'ok';
      if (msg) window.toast(msg, type);
    }

    // if pipeline already running, attach SSE
    if (document.getElementById('run-progress')) {
      const isRunning = document.body.getAttribute('data-run-running') === '1';
      if (isRunning) startRunStream();
    }
  });

  window.addEventListener('beforeunload', () => {
    if (sseSource) sseSource.close();
  });
})();
