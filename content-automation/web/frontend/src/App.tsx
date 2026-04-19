import { useCallback, useEffect, useState } from 'react';

import { LoginScreen } from './components/LoginScreen.js';
import { OfficeCanvas } from './components/OfficeCanvas.js';
import { OverlayManager } from './components/OverlayManager.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import type { WsEvent } from './hooks/useWebSocket.js';
import type { OverlayType } from './constants/agentNames.js';

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [events, setEvents] = useState<WsEvent | null>(null);
  const [openOverlays, setOpenOverlays] = useState<Set<OverlayType>>(new Set());

  // 페이지 로드 시 인증 확인
  useEffect(() => {
    void fetch('/api/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { authenticated?: boolean }) => {
        if (data.authenticated) {
          setToken('cookie');
        }
      })
      .catch(() => {/* 미인증 */});
  }, []);

  const handleEvent = useCallback((e: WsEvent) => {
    setEvents(e);
  }, []);

  const { status, send, lastEvent } = useWebSocket(token, handleEvent);

  const handleOverlayOpen = useCallback((type: OverlayType) => {
    const resolved = type === 'strategy_agent' ? 'opportunity'
      : type === 'research_agent' ? 'whiteboard'
      : type;
    setOpenOverlays((prev) => new Set(prev).add(resolved));
  }, []);

  const handleOverlayClose = useCallback((type: OverlayType) => {
    setOpenOverlays((prev) => {
      const next = new Set(prev);
      next.delete(type);
      return next;
    });
  }, []);

  const handleLogin = useCallback((t: string) => { setToken(t); }, []);
  const handleSend = useCallback((message: string) => { send({ type: 'run_workspace', message }); }, [send]);
  const handleApprove = useCallback(() => { send({ type: 'approve' }); }, [send]);
  const handleFeedback = useCallback((message: string) => { send({ type: 'feedback', message }); }, [send]);
  const handleCancel = useCallback(() => { send({ type: 'cancel' }); }, [send]);
  const handleLogout = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    sessionStorage.removeItem('auth_token');
    setToken(null);
  }, []);

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'radial-gradient(circle at top, #182341 0%, #0b1020 60%)', overflow: 'hidden', position: 'relative' }}>
      {/* 상단 바 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid #2d3d69',
        background: 'rgba(11,16,32,0.8)', backdropFilter: 'blur(4px)',
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>Marketing Workspace</span>
        <button
          onClick={() => { void handleLogout(); }}
          style={{
            background: 'transparent', border: '1px solid #2d3d69',
            color: 'rgba(255,255,255,0.5)', padding: '4px 12px',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
          }}
        >로그아웃</button>
      </div>

      {/* 오피스 캔버스 */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}>
        <OfficeCanvas
          lastEvent={lastEvent ?? events}
          onOverlayOpen={handleOverlayOpen}
        />
      </div>

      {/* 오버레이 매니저 */}
      <OverlayManager
        openOverlays={openOverlays}
        onClose={handleOverlayClose}
        lastEvent={lastEvent ?? events}
        wsStatus={status}
        onSend={handleSend}
        onApprove={handleApprove}
        onFeedback={handleFeedback}
        onCancel={handleCancel}
      />
    </div>
  );
}

export default App;
