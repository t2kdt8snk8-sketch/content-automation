import { useCallback, useEffect, useRef, useState } from 'react';

import type { WsEvent } from '../hooks/useWebSocket.js';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatPanelProps {
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastEvent: WsEvent | null;
  onSend: (message: string) => void;
  onApprove: () => void;
  onFeedback: (message: string) => void;
  onCancel: () => void;
}

export function ChatPanel({ wsStatus, lastEvent, onSend, onApprove, onFeedback, onCancel }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 이벤트 처리
  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case 'mode':
        setMessages((prev) => [...prev, {
          role: 'system',
          content: `모드: ${lastEvent.mode}${lastEvent.source ? ` (${lastEvent.source})` : ''}`,
        }]);
        break;

      case 'plan_step':
        setWaitingApproval(true);
        setMessages((prev) => [...prev, {
          role: 'system',
          content: `실행 예정: ${lastEvent.agents.join(' → ')}`,
        }]);
        break;

      case 'agent_started':
        setActiveAgents((prev) => [...new Set([...prev, lastEvent.agent])]);
        setWaitingApproval(false);
        break;

      case 'agent_completed':
        setActiveAgents((prev) => prev.filter((a) => a !== lastEvent.agent));
        if (lastEvent.content) {
          setMessages((prev) => [...prev, {
            role: 'system',
            content: `[${lastEvent.agent}] ${lastEvent.elapsed_ms}ms`,
          }]);
        }
        if (lastEvent.error) {
          setMessages((prev) => [...prev, {
            role: 'system',
            content: `[${lastEvent.agent}] 오류: ${lastEvent.error}`,
          }]);
        }
        break;

      case 'workflow_completed':
      case 'content_completed':
        setIsRunning(false);
        setActiveAgents([]);
        setWaitingApproval(false);
        if (lastEvent.final_output) {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: lastEvent.final_output,
          }]);
        }
        break;

      case 'chat_completed':
        setIsRunning(false);
        setActiveAgents([]);
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: lastEvent.final_output,
        }]);
        break;

      case 'workflow_failed':
        setIsRunning(false);
        setActiveAgents([]);
        setWaitingApproval(false);
        setMessages((prev) => [...prev, {
          role: 'system',
          content: `오류: ${lastEvent.error}`,
        }]);
        break;

      case 'workflow_cancelled':
        setIsRunning(false);
        setActiveAgents([]);
        setWaitingApproval(false);
        break;

      case 'research_started':
        setMessages((prev) => [...prev, {
          role: 'system',
          content: `리서치 시작: ${lastEvent.query}`,
        }]);
        break;

      case 'research_completed':
        setIsRunning(false);
        setActiveAgents([]);
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: lastEvent.summary,
        }]);
        break;
    }
  }, [lastEvent]);

  // 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const msg = input.trim();
    if (!msg || isRunning) return;
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setIsRunning(true);
    onSend(msg);
  }, [input, isRunning, onSend]);

  const handleFeedback = useCallback(() => {
    const msg = feedbackInput.trim();
    if (!msg) return;
    onFeedback(msg);
    setFeedbackInput('');
  }, [feedbackInput, onFeedback]);

  const statusColor = {
    connected: '#34d399',
    connecting: '#fbbf24',
    disconnected: '#6b7280',
    error: '#f87171',
  }[wsStatus];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      {/* 상단 상태 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
          {wsStatus === 'connected' ? '연결됨' : wsStatus === 'connecting' ? '연결 중...' : '연결 끊김'}
        </span>
        {activeAgents.length > 0 && (
          <span style={{ fontSize: 12, color: '#3794ff', marginLeft: 'auto', fontFamily: 'monospace' }}>
            ▶ {activeAgents.join(', ')}
          </span>
        )}
      </div>

      {/* 메시지 목록 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 4,
        }}
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 승인/피드백 영역 */}
      {waitingApproval && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onApprove}
            style={{ flex: 1, padding: '8px 0', background: '#34d399', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}
          >
            ✓ 승인
          </button>
          <input
            value={feedbackInput}
            onChange={(e) => setFeedbackInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFeedback(); }}
            placeholder="수정 요청..."
            style={{ flex: 2, padding: '8px', background: '#0d1428', border: '1px solid #2d3d69', color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'monospace' }}
          />
          <button
            onClick={handleFeedback}
            style={{ padding: '8px 12px', background: '#3a4a6a', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13 }}
          >
            전송
          </button>
        </div>
      )}

      {/* 입력창 */}
      <div style={{ display: 'flex', gap: 6 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isRunning}
          placeholder={isRunning ? '실행 중...' : '콘텐츠 요청을 입력하세요 (Enter 전송)'}
          rows={2}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: '#0d1428',
            border: '1px solid #2d3d69',
            color: 'rgba(255,255,255,0.9)',
            resize: 'none',
            fontSize: 14,
            fontFamily: 'monospace',
            opacity: isRunning ? 0.6 : 1,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={handleSend}
            disabled={isRunning || !input.trim()}
            style={{
              flex: 1,
              padding: '0 16px',
              background: isRunning || !input.trim() ? '#3a4a6a' : '#5b8cff',
              color: 'white',
              border: 'none',
              cursor: isRunning || !input.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontFamily: 'monospace',
              fontSize: 14,
            }}
          >
            전송
          </button>
          {isRunning && (
            <button
              onClick={onCancel}
              style={{ padding: '4px 16px', background: '#3a1a1a', color: '#f87171', border: '1px solid #f87171', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12 }}
            >
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', padding: '2px 4px' }}>
        › {message.content}
      </div>
    );
  }

  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        padding: '8px 12px',
        background: isUser ? '#1e3a5f' : '#1e2a1e',
        border: `1px solid ${isUser ? '#2d5a9f' : '#2a4a2a'}`,
        whiteSpace: 'pre-wrap',
        fontSize: 13,
        fontFamily: 'monospace',
        lineHeight: 1.5,
        color: 'rgba(255,255,255,0.9)',
        boxShadow: '2px 2px 0 #0a0a14',
      }}
    >
      {message.content}
    </div>
  );
}
