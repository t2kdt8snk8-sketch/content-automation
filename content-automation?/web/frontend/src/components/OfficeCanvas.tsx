import { useEffect, useRef } from 'react';

import { loadAssets } from '../office/assetLoader.js';
import { OfficeState } from '../office/engine/officeState.js';
import type { OfficeLayout } from '../office/types.js';
import { renderFrame } from '../office/engine/renderer.js';
import { startGameLoop } from '../office/engine/gameLoop.js';
import { TILE_SIZE } from '../constants.js';
import type { WsEvent } from '../hooks/useWebSocket.js';

const ZOOM = 2;
const ASSET_BASE = '/static/';

// 에이전트 이름 → 숫자 ID 매핑
const agentIdMap = new Map<string, number>();
let nextAgentId = 1;

function getAgentId(name: string): number {
  if (!agentIdMap.has(name)) {
    agentIdMap.set(name, nextAgentId++);
  }
  return agentIdMap.get(name)!;
}

interface OfficeCanvasProps {
  lastEvent?: WsEvent | null;
}

export function OfficeCanvas({ lastEvent }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OfficeState | null>(null);

  // 에셋 로드 → OfficeState 초기화 → 에이전트 자동 스폰
  useEffect(() => {
    void loadAssets(ASSET_BASE).then((layout) => {
      const state = new OfficeState(layout as OfficeLayout);
      stateRef.current = state;

      // 기본 에이전트 5명 자동 스폰 (idle 상태로 돌아다님)
      state.addAgent(1, 0, 0, undefined, true);
      state.addAgent(2, 1, 0, undefined, true);
      state.addAgent(3, 2, 0, undefined, true);
      state.addAgent(4, 3, 0, undefined, true);
      state.addAgent(5, 4, 0, undefined, true);
    });
  }, []);

  // 게임 루프 — 캔버스 크기를 레이아웃에 맞게 고정
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 레이아웃 21×22 타일, ZOOM=2 → 672×704px
    canvas.width = 21 * TILE_SIZE * ZOOM;
    canvas.height = 22 * TILE_SIZE * ZOOM;

    const stop = startGameLoop(canvas, {
      update: (dt) => {
        stateRef.current?.update(dt);
      },
      render: (ctx) => {
        const state = stateRef.current;
        if (!state) return;
        const layout = state.getLayout();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderFrame(
          ctx,
          canvas.width,
          canvas.height,
          state.tileMap,
          state.furniture,
          [...state.characters.values()],
          ZOOM,
          0,
          0,
          undefined,
          undefined,
          layout.tileColors,
          layout.cols,
          layout.rows,
        );
      },
    });

    return stop;
  }, []);

  // WebSocket 이벤트 → 에이전트 책상 이동
  useEffect(() => {
    if (!lastEvent) return;
    const state = stateRef.current;
    if (!state) return;

    if (lastEvent.type === 'agent_started') {
      const id = getAgentId(lastEvent.agent);
      if (!state.characters.has(id)) {
        state.addAgent(id, undefined, undefined, undefined, false, lastEvent.agent);
      }
    } else if (lastEvent.type === 'agent_completed') {
      const id = agentIdMap.get(lastEvent.agent);
      if (id !== undefined) state.removeAgent(id);
    } else if (lastEvent.type === 'opportunity_created') {
      // strategy_agent가 기회 카드를 생성 — 3초간 캐릭터 표시 후 제거
      const id = getAgentId('strategy_agent');
      if (!state.characters.has(id)) {
        state.addAgent(id, undefined, undefined, undefined, false, 'strategy_agent');
        setTimeout(() => {
          state.removeAgent(id);
          agentIdMap.delete('strategy_agent');
        }, 3000);
      }
    } else if (
      lastEvent.type === 'workflow_completed' ||
      lastEvent.type === 'workflow_failed' ||
      lastEvent.type === 'workflow_cancelled' ||
      lastEvent.type === 'chat_completed' ||
      lastEvent.type === 'content_completed'
    ) {
      for (const id of agentIdMap.values()) {
        state.removeAgent(id);
      }
    }
  }, [lastEvent]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        imageRendering: 'pixelated',
        border: '2px solid #2d3d69',
        boxShadow: '4px 4px 0 #0a0a14',
      }}
    />
  );
}
