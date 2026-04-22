import { useEffect, useRef, useState } from 'react';
import { AGENT_DISPLAY_NAMES } from '../constants/agentNames.js';
import type { WsEvent } from '../hooks/useWebSocket.js';

interface AgentPanelProps {
  agentName: string;
  lastEvent: WsEvent | null;
  onClose: () => void;
}

interface AgentLog {
  time: string;
  text: string;
  type: 'started' | 'completed' | 'error' | 'info';
}

function formatTime() {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AgentPanel({ agentName, lastEvent, onClose }: AgentPanelProps) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isActive, setIsActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const displayName = (AGENT_DISPLAY_NAMES as Record<string, string>)[agentName] ?? agentName;

  useEffect(() => {
    if (!lastEvent) return;
    if ('agent' in lastEvent && lastEvent.agent !== agentName) return;

    if (lastEvent.type === 'agent_started' && lastEvent.agent === agentName) {
      setIsActive(true);
      setLogs((prev) => [...prev, { time: formatTime(), text: '작업 시작', type: 'started' }]);
    } else if (lastEvent.type === 'agent_completed' && lastEvent.agent === agentName) {
      setIsActive(false);
      const text = lastEvent.error
        ? `오류: ${lastEvent.error}`
        : `완료 (${Math.round(lastEvent.elapsed_ms / 1000)}초)`;
      setLogs((prev) => [...prev, { time: formatTime(), text, type: lastEvent.error ? 'error' : 'completed' }]);
    }
  }, [lastEvent, agentName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const logColor: Record<AgentLog['type'], string> = {
    started: '#60a5fa',
    completed: '#34d399',
    error: '#f87171',
    info: 'rgba(255,255,255,0.5)',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            {displayName}
          </span>
          {isActive && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#34d399', display: 'inline-block',
            }} />
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}
        >×</button>
      </div>

      {/* 로그 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {logs.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 12 }}>
            아직 활동 없음
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontFamily: 'monospace', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{log.time}</span>
              <span style={{ color: logColor[log.type] }}>{log.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
