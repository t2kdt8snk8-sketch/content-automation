import { useCallback, useEffect, useState } from 'react';
import type { OpportunityCard } from '../hooks/useWebSocket.js';

interface ImageResult {
  url: string;
  title: string;
  query: string;
}

interface Decision {
  format: string;
  reason: string;
  outline: string[];
  image_queries: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type Stage = 'idle' | 'deciding' | 'ready' | 'producing' | 'done';

interface CardProductionState {
  stage: Stage;
  decision: Decision | null;
  images: ImageResult[];
  content: string;
  conversation: ChatMessage[];
  chatInput: string;
  chatLoading: boolean;
  userDirection: string;
}

const defaultState = (): CardProductionState => ({
  stage: 'idle',
  decision: null,
  images: [],
  content: '',
  conversation: [],
  chatInput: '',
  chatLoading: false,
  userDirection: '',
});

export function ProductionPanel() {
  const [cards, setCards] = useState<OpportunityCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, CardProductionState>>({});

  useEffect(() => {
    void fetch('/api/opportunities?status=approved', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setCards(data as OpportunityCard[]);
      })
      .catch(() => {});
  }, []);

  const getState = (id: string): CardProductionState => states[id] ?? defaultState();

  const patchState = useCallback((id: string, patch: Partial<CardProductionState>) => {
    setStates((prev) => ({ ...prev, [id]: { ...getState(id), ...patch } }));
  }, [states]);

  // 포맷 결정 + 이미지 검색
  const handleDecide = useCallback(async (cardId: string) => {
    patchState(cardId, { stage: 'deciding' });
    try {
      const res = await fetch(`/api/production/${cardId}/decide`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json() as { decision: Decision; images: ImageResult[] };
      patchState(cardId, {
        stage: 'ready',
        decision: data.decision,
        images: data.images,
        conversation: [{
          role: 'assistant',
          content: `**${data.decision.format}** 포맷을 추천합니다.\n\n${data.decision.reason}\n\n구성: ${data.decision.outline.join(' → ')}\n\n이 방향으로 제작할까요? 아니면 수정하고 싶은 부분을 알려주세요.`,
        }],
      });
    } catch {
      patchState(cardId, { stage: 'idle' });
    }
  }, [patchState]);

  // 콘텐츠 제작
  const handleProduce = useCallback(async (cardId: string) => {
    const s = getState(cardId);
    patchState(cardId, { stage: 'producing' });
    try {
      const res = await fetch(`/api/production/${cardId}/produce`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: s.decision?.format ?? '',
          user_direction: s.userDirection,
          conversation: s.conversation,
        }),
      });
      const data = await res.json() as { content: string; format: string; images: ImageResult[] };
      patchState(cardId, {
        stage: 'done',
        content: data.content,
        images: data.images,
        conversation: [...s.conversation, {
          role: 'assistant',
          content: `**${data.format}** 제작이 완료됐습니다. 아래에서 결과물을 확인하세요.`,
        }],
      });
    } catch {
      patchState(cardId, { stage: 'ready' });
    }
  }, [states, patchState]);

  // 대화
  const handleChat = useCallback(async (cardId: string) => {
    const s = getState(cardId);
    const message = s.chatInput.trim();
    if (!message) return;

    const newConv: ChatMessage[] = [...s.conversation, { role: 'user', content: message }];
    patchState(cardId, { chatInput: '', chatLoading: true, conversation: newConv });

    try {
      const res = await fetch(`/api/production/${cardId}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversation: newConv }),
      });
      const data = await res.json() as { reply: string };
      patchState(cardId, {
        chatLoading: false,
        userDirection: message, // 마지막 사용자 요청을 방향으로 저장
        conversation: [...newConv, { role: 'assistant', content: data.reply }],
      });
    } catch {
      patchState(cardId, { chatLoading: false });
    }
  }, [states, patchState]);

  const selected = cards.find((c) => c.card_id === selectedId);
  const selectedState = selectedId ? getState(selectedId) : null;

  if (cards.length === 0) {
    return (
      <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 13 }}>승인된 기회 카드가 없습니다</div>
        <div style={{ fontSize: 11, marginTop: 8 }}>피드 탭에서 카드를 승인하면 여기에 표시됩니다</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12, overflow: 'hidden', flex: 1 }}>
      {/* 왼쪽: 카드 목록 */}
      <div style={{ width: 200, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cards.map((card) => {
          const s = getState(card.card_id);
          const isActive = selectedId === card.card_id;
          return (
            <div
              key={card.card_id}
              onClick={() => setSelectedId(card.card_id)}
              style={{
                padding: '8px 10px',
                background: isActive ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActive ? '#60a5fa' : '#2d3d69'}`,
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, lineHeight: 1.4 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 10, color: stageColor(s.stage) }}>
                {stageLabel(s.stage)}
              </div>
            </div>
          );
        })}
      </div>

      {/* 오른쪽: 제작 영역 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 12, margin: 'auto' }}>
            카드를 선택하세요
          </div>
        ) : (
          <>
            {/* 카드 요약 */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #2d3d69', flexShrink: 0 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                {selected.title}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                {selected.summary.slice(0, 100)}...
              </div>
            </div>

            {/* 대화창 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedState?.conversation.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.role === 'user' ? '#1e3a5f' : 'rgba(255,255,255,0.06)',
                    padding: '8px 12px',
                    maxWidth: '88%',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.85)',
                    lineHeight: 1.6,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              ))}

              {/* 완성된 콘텐츠 */}
              {selectedState?.stage === 'done' && selectedState.content && (
                <div style={{
                  background: 'rgba(74,222,128,0.06)',
                  border: '1px solid rgba(74,222,128,0.2)',
                  padding: '12px 14px',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}>
                  {selectedState.content}
                </div>
              )}

              {/* 참고 이미지 */}
              {selectedState?.images && selectedState.images.length > 0 && selectedState.stage !== 'idle' && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase' }}>
                    참고 이미지
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedState.images.slice(0, 5).map((img, i) => (
                      <a key={i} href={img.url} target="_blank" rel="noreferrer">
                        <img
                          src={img.url}
                          alt={img.title}
                          style={{ width: 80, height: 80, objectFit: 'cover', border: '1px solid #2d3d69' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 하단 액션 */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid #2d3d69', flexShrink: 0 }}>
              {selectedState?.stage === 'idle' && (
                <button onClick={() => void handleDecide(selected.card_id)} style={btnStyle('#1e3a5f')}>
                  포맷 분석 시작
                </button>
              )}
              {selectedState?.stage === 'deciding' && (
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>분석 중...</div>
              )}
              {(selectedState?.stage === 'ready' || selectedState?.stage === 'done') && (
                <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={selectedState?.chatInput ?? ''}
                      onChange={(e) => patchState(selected.card_id, { chatInput: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleChat(selected.card_id);
                        }
                      }}
                      placeholder="방향 조율 또는 수정 요청..."
                      disabled={selectedState?.chatLoading}
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
                      onClick={() => void handleChat(selected.card_id)}
                      disabled={selectedState?.chatLoading}
                      style={btnStyle('#2d3d69')}
                    >
                      {selectedState?.chatLoading ? '...' : '전송'}
                    </button>
                  </div>
                  <button
                    onClick={() => void handleProduce(selected.card_id)}
                    style={btnStyle('#16a34a')}
                  >
                    {selectedState?.stage === 'done' ? '다시 제작' : '제작 시작'}
                  </button>
                </div>
              )}
              {selectedState?.stage === 'producing' && (
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Gemini가 제작 중...</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function stageLabel(stage: Stage): string {
  switch (stage) {
    case 'idle': return '대기';
    case 'deciding': return '분석 중...';
    case 'ready': return '준비됨';
    case 'producing': return '제작 중...';
    case 'done': return '✓ 완료';
  }
}

function stageColor(stage: Stage): string {
  switch (stage) {
    case 'done': return '#4ade80';
    case 'producing':
    case 'deciding': return '#facc15';
    default: return 'rgba(255,255,255,0.3)';
  }
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.8)',
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
    width: '100%',
  };
}
