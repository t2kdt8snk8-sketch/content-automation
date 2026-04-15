import { useCallback, useEffect, useRef, useState } from 'react';

export interface OpportunityCard {
  card_id: string;
  created_at: string;
  title: string;
  summary: string;
  evidence: string[];
  recommended_formats: string[];
  suggested_angles: string[];
  opportunity_score: number;
  status: 'new' | 'approved' | 'rejected' | 'in_progress' | 'done';
  conversation: Array<{ role: string; content: string; created_at: string }>;
  source_research_ids: string[];
  updated_at: string | null;
}

export type WsEvent =
  | { type: 'mode'; mode: string; source?: string }
  | { type: 'plan_step'; agents: string[] }
  | { type: 'agent_started'; agent: string }
  | { type: 'agent_completed'; agent: string; content: string | null; error: string | null; elapsed_ms: number }
  | { type: 'workflow_completed'; final_output: string; total_ms?: number }
  | { type: 'workflow_failed'; error: string }
  | { type: 'workflow_cancelled' }
  | { type: 'chat_completed'; final_output: string }
  | { type: 'content_completed'; final_output: string; total_ms?: number }
  | { type: 'research_started'; goal: string; query: string }
  | { type: 'research_completed'; goal: string; summary: string; opportunities: unknown[] }
  | { type: 'opportunity_created'; card: OpportunityCard }
  | { type: 'opportunity_updated'; card: OpportunityCard }
  | { type: 'error'; error: string };

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketReturn {
  status: WsStatus;
  send: (data: Record<string, unknown>) => void;
  lastEvent: WsEvent | null;
}

export function useWebSocket(token: string | null, onEvent: (e: WsEvent) => void): UseWebSocketReturn {
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!token) return;

    setStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onerror = () => setStatus('error');
    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
    };
    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as WsEvent;
        setLastEvent(event);
        onEventRef.current(event);
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { status, send, lastEvent };
}
