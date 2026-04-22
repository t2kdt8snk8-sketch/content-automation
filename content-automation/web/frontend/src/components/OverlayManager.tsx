import { ChatPanel } from './ChatPanel.js';
import { FeedPanel } from './FeedPanel.js';
import { ProductionPanel } from './ProductionPanel.js';
import { ResearchPanel } from './ResearchPanel.js';
import { AgentPanel } from './AgentPanel.js';
import type { WsEvent } from '../hooks/useWebSocket.js';
import type { OverlayType } from '../constants/agentNames.js';

interface OverlayManagerProps {
  openOverlays: Set<OverlayType>;
  onClose: (type: OverlayType) => void;
  lastEvent: WsEvent | null;
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  onSend: (message: string) => void;
  onApprove: () => void;
  onFeedback: (message: string) => void;
  onCancel: () => void;
}

export function OverlayManager({
  openOverlays,
  onClose,
  lastEvent,
  wsStatus,
  onSend,
  onApprove,
  onFeedback,
  onCancel,
}: OverlayManagerProps) {
  const overlayArray = Array.from(openOverlays);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {overlayArray.map((type, index) => {
        const rightOffset = 12 + index * (380 + 12);

        return (
          <div
            key={type}
            style={{
              position: 'absolute',
              top: 48,
              right: rightOffset,
              bottom: 0,
              width: 380,
              background: 'rgba(18,26,49,0.88)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: 'auto',
            }}
          >
            {/* 헤더 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#e2e8f0',
                }}
              >
                {getPanelTitle(type)}
              </span>
              <button
                onClick={() => onClose(type as OverlayType)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* 콘텐츠 */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {renderPanel(type, lastEvent, wsStatus, onSend, onApprove, onFeedback, onCancel, () => onClose(type as OverlayType))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getPanelTitle(type: OverlayType | string): string {
  switch (type) {
    case 'chat':
      return '채팅';
    case 'production':
      return '제작';
    case 'whiteboard':
    case 'research_agent':
      return '리서치 아카이브';
    case 'opportunity':
      return '기회 카드';
    default:
      return `${type} 에이전트`;
  }
}

function renderPanel(
  type: OverlayType | string,
  lastEvent: WsEvent | null,
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error',
  onSend: (message: string) => void,
  onApprove: () => void,
  onFeedback: (message: string) => void,
  onCancel: () => void,
  onClose: () => void,
) {
  switch (type) {
    case 'chat':
      return (
        <ChatPanel
          wsStatus={wsStatus}
          lastEvent={lastEvent}
          onSend={onSend}
          onApprove={onApprove}
          onFeedback={onFeedback}
          onCancel={onCancel}
        />
      );
    case 'production':
      return <ProductionPanel />;
    case 'whiteboard':
    case 'research_agent':
      return <ResearchPanel />;
    case 'opportunity':
      return <FeedPanel lastEvent={lastEvent} />;
    default:
      return (
        <AgentPanel
          agentName={type as string}
          lastEvent={lastEvent}
          onClose={onClose}
        />
      );
  }
}
