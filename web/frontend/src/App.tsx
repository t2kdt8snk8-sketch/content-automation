import { useCallback, useEffect, useState } from 'react';

import { ChatPanel } from './components/ChatPanel.js';
import { FeedPanel } from './components/FeedPanel.js';
import { LoginScreen } from './components/LoginScreen.js';
import { OfficeCanvas } from './components/OfficeCanvas.js';
import { ProductionPanel } from './components/ProductionPanel.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import type { WsEvent } from './hooks/useWebSocket.js';

type Tab = 'chat' | 'feed' | 'production';

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [events, setEvents] = useState<WsEvent | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [newCardCount, setNewCardCount] = useState(0);

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
    // 피드 탭이 아닌 상태에서 새 카드 수신 시 뱃지 표시
    if (e.type === 'opportunity_created') {
      setNewCardCount((n) => n + 1);
    }
  }, []);

  const { status, send, lastEvent } = useWebSocket(token, handleEvent);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'feed') setNewCardCount(0);
  }, []);

  const handleLogin = useCallback((t: string) => { setToken(t); }, []);
  const handleSend = useCallback((message: string) => { send({ type: 'run_workspace', message }); }, [send]);
  const handleApprove = useCallback(() => { send({ type: 'approve' }); }, [send]);
  const handleFeedback = useCallback((message: string) => { send({ type: 'feedback', message }); }, [send]);
  const handleCancel = useCallback(() => { send({ type: 'cancel' }); }, [send]);
  const handleLogout = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setToken(null);
  }, []);

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(circle at top, #182341 0%, #0b1020 60%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 상단 바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid #2d3d69',
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
          Marketing Workspace
        </span>
        <button
          onClick={() => { void handleLogout(); }}
          style={{
            background: 'transparent',
            border: '1px solid #2d3d69',
            color: 'rgba(255,255,255,0.5)',
            padding: '4px 12px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: 13,
          }}
        >
          로그아웃
        </button>
      </div>

      {/* 메인 컨텐츠 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 16,
          padding: 16,
          overflow: 'hidden',
        }}
      >
        {/* 왼쪽: 픽셀 오피스 */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <OfficeCanvas lastEvent={lastEvent ?? events} />
        </div>

        {/* 오른쪽: 탭 패널 */}
        <div
          style={{
            flex: 1,
            background: 'rgba(18,26,49,0.8)',
            border: '2px solid #2d3d69',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '4px 4px 0 #0a0a14',
            minWidth: 0,
          }}
        >
          {/* 탭 헤더 */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #2d3d69',
              flexShrink: 0,
            }}
          >
            {(['chat', 'feed', 'production'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                style={{
                  background: activeTab === tab ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #60a5fa' : '2px solid transparent',
                  color: activeTab === tab ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab === 'chat' ? '채팅' : tab === 'feed' ? '피드' : '제작'}
                {tab === 'feed' && newCardCount > 0 && activeTab !== 'feed' && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      borderRadius: '50%',
                      width: 16,
                      height: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {newCardCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 12 }}>
            {activeTab === 'chat' ? (
              <ChatPanel
                wsStatus={status}
                lastEvent={lastEvent ?? events}
                onSend={handleSend}
                onApprove={handleApprove}
                onFeedback={handleFeedback}
                onCancel={handleCancel}
              />
            ) : activeTab === 'feed' ? (
              <FeedPanel lastEvent={lastEvent ?? events} />
            ) : (
              <ProductionPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
