import { useCallback, useEffect, useState } from 'react';
import type { OpportunityCard, WsEvent } from '../hooks/useWebSocket.js';

const SCORE_COLOR = (score: number) =>
  score >= 75 ? '#4ade80' : score >= 60 ? '#facc15' : '#94a3b8';

const STATUS_LABEL: Record<OpportunityCard['status'], string> = {
  new: '● NEW',
  approved: '✓ 승인',
  rejected: '✗ 패스',
  in_progress: '⚙ 진행중',
  done: '✓ 완료',
};

interface FeedPanelProps {
  lastEvent: WsEvent | null;
}

export function FeedPanel({ lastEvent }: FeedPanelProps) {
  const [cards, setCards] = useState<OpportunityCard[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const [chatLoading, setChatLoading] = useState<Record<string, boolean>>({});

  // 초기 로드
  useEffect(() => {
    void fetch('/api/opportunities', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: OpportunityCard[]) => setCards(data))
      .catch(() => {/* 무시 */});
  }, []);

  // WebSocket 실시간 업데이트
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'opportunity_created') {
      setCards((prev) => [lastEvent.card, ...prev]);
    } else if (lastEvent.type === 'opportunity_updated') {
      setCards((prev) =>
        prev.map((c) => (c.card_id === lastEvent.card.card_id ? lastEvent.card : c))
      );
    }
  }, [lastEvent]);

  const handleStatus = useCallback(
    async (cardId: string, status: OpportunityCard['status']) => {
      const res = await fetch(`/api/opportunities/${cardId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = (await res.json()) as OpportunityCard;
        setCards((prev) => prev.map((c) => (c.card_id === cardId ? updated : c)));
      }
    },
    []
  );

  const handleChat = useCallback(
    async (cardId: string) => {
      const message = chatInputs[cardId]?.trim();
      if (!message) return;
      setChatLoading((prev) => ({ ...prev, [cardId]: true }));
      setChatInputs((prev) => ({ ...prev, [cardId]: '' }));

      try {
        const res = await fetch(`/api/opportunities/${cardId}/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        if (res.ok) {
          const data = (await res.json()) as { reply: string; conversation: OpportunityCard['conversation'] };
          setCards((prev) =>
            prev.map((c) =>
              c.card_id === cardId ? { ...c, conversation: data.conversation } : c
            )
          );
        }
      } finally {
        setChatLoading((prev) => ({ ...prev, [cardId]: false }));
      }
    },
    [chatInputs]
  );

  if (cards.length === 0) {
    return (
      <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 13 }}>기회 카드가 없습니다</div>
        <div style={{ fontSize: 11, marginTop: 8 }}>strategy_agent가 리서치를 분석하면 여기에 표시됩니다</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1 }}>
      {cards.map((card) => {
        const isExpanded = expandedId === card.card_id;
        return (
          <div
            key={card.card_id}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid #2d3d69',
              padding: '12px 14px',
              fontFamily: 'monospace',
            }}
          >
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', flex: 1, marginRight: 8 }}>
                {card.title}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: SCORE_COLOR(card.opportunity_score), fontWeight: 700 }}>
                  {card.opportunity_score}점
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  {STATUS_LABEL[card.status]}
                </span>
              </div>
            </div>

            {/* 요약 */}
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 10px', lineHeight: 1.6 }}>
              {card.summary}
            </p>

            {/* 근거 */}
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>근거</span>
              <ul style={{ margin: '4px 0 0', padding: '0 0 0 14px', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                {card.evidence.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>

            {/* 추천 포맷 & 각도 */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 11 }}>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>포맷: </span>
                <span style={{ color: '#93c5fd' }}>{card.recommended_formats.join(' · ')}</span>
              </div>
            </div>
            {card.suggested_angles.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>각도</span>
                <ul style={{ margin: '4px 0 0', padding: '0 0 0 14px', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                  {card.suggested_angles.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', gap: 8 }}>
              {card.status === 'new' && (
                <>
                  <button
                    onClick={() => void handleStatus(card.card_id, 'approved')}
                    style={btnStyle('#16a34a')}
                  >
                    승인
                  </button>
                  <button
                    onClick={() => void handleStatus(card.card_id, 'rejected')}
                    style={btnStyle('#7f1d1d')}
                  >
                    패스
                  </button>
                </>
              )}
              <button
                onClick={() => setExpandedId(isExpanded ? null : card.card_id)}
                style={btnStyle('#1e3a5f')}
              >
                {isExpanded ? '대화 닫기 ▲' : '대화하기 ▼'}
              </button>
            </div>

            {/* 인라인 대화창 */}
            {isExpanded && (
              <div style={{ marginTop: 12, borderTop: '1px solid #2d3d69', paddingTop: 10 }}>
                <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {card.conversation.map((msg, i) => (
                    <div
                      key={i}
                      style={{
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        background: msg.role === 'user' ? '#1e3a5f' : 'rgba(255,255,255,0.06)',
                        padding: '6px 10px',
                        maxWidth: '85%',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.85)',
                        lineHeight: 1.5,
                      }}
                    >
                      {msg.content}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={chatInputs[card.card_id] ?? ''}
                    onChange={(e) => setChatInputs((prev) => ({ ...prev, [card.card_id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleChat(card.card_id); } }}
                    placeholder="이 기회에 대해 물어보기..."
                    disabled={chatLoading[card.card_id]}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid #2d3d69',
                      color: 'white',
                      padding: '6px 8px',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => void handleChat(card.card_id)}
                    disabled={chatLoading[card.card_id]}
                    style={btnStyle('#1e3a5f')}
                  >
                    {chatLoading[card.card_id] ? '...' : '전송'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.8)',
    padding: '4px 10px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
  };
}
