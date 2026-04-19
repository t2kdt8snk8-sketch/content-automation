import { useEffect, useRef, useState } from 'react';

import { loadAssets } from '../office/assetLoader.js';
import { OfficeState } from '../office/engine/officeState.js';
import type { OfficeLayout } from '../office/types.js';
import { renderFrame } from '../office/engine/renderer.js';
import { startGameLoop } from '../office/engine/gameLoop.js';
import { TILE_SIZE } from '../constants.js';
import type { WsEvent } from '../hooks/useWebSocket.js';
import { AGENT_DISPLAY_NAMES, type OverlayType } from '../constants/agentNames.js';

const ZOOM = 2;
const ASSET_BASE = '/static/';

// 에이전트 이름 → 숫자 ID 매핑
// 기본 5명은 모듈 로드 시점에 미리 등록 — WebSocket 이벤트보다 반드시 먼저 실행되어야 함
const agentIdMap = new Map<string, number>([
  ['research_agent', 1],
  ['strategy_agent', 2],
  ['copy_agent', 3],
  ['script_agent', 4],
  ['image_prompt_agent', 5],
]);
let nextAgentId = 6;

function getAgentId(name: string): number {
  if (!agentIdMap.has(name)) {
    agentIdMap.set(name, nextAgentId++);
  }
  return agentIdMap.get(name)!;
}

interface OfficeCanvasProps {
  lastEvent?: WsEvent | null;
  onOverlayOpen: (type: OverlayType) => void;
}

export function OfficeCanvas({ lastEvent, onOverlayOpen }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OfficeState | null>(null);
  const [showPcMenu, setShowPcMenu] = useState(false);

  // 에셋 로드 → OfficeState 초기화 → 에이전트 자동 스폰
  useEffect(() => {
    void loadAssets(ASSET_BASE).then((layout) => {
      const state = new OfficeState(layout as OfficeLayout);
      stateRef.current = state;

      // 기본 에이전트 5명 자동 스폰 (idle 상태로 돌아다님)
      state.addAgent(1, 0, 0, undefined, true, undefined, AGENT_DISPLAY_NAMES.research_agent);
      state.addAgent(2, 1, 0, undefined, true, undefined, AGENT_DISPLAY_NAMES.strategy_agent);
      state.addAgent(3, 2, 0, undefined, true, undefined, AGENT_DISPLAY_NAMES.copy_agent);
      state.addAgent(4, 3, 0, undefined, true, undefined, AGENT_DISPLAY_NAMES.script_agent);
      state.addAgent(5, 4, 0, undefined, true, undefined, AGENT_DISPLAY_NAMES.image_prompt_agent);
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
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          border: '2px solid #2d3d69',
          boxShadow: '4px 4px 0 #0a0a14',
        }}
        onClick={(e) => {
          const worldX = e.nativeEvent.offsetX / ZOOM;
          const worldY = e.nativeEvent.offsetY / ZOOM;

          // Character click first
          const charId = stateRef.current?.getCharacterAt(worldX, worldY);
          if (charId !== null && charId !== undefined) {
            const agentName = Array.from(agentIdMap.entries()).find(([, id]) => id === charId)?.[0];
            if (agentName) {
              onOverlayOpen(agentName);
              return;
            }
          }

          // Furniture click
          const furniture = stateRef.current?.getFurnitureAt(worldX, worldY);
          if (furniture === 'PC') {
            setShowPcMenu(true);
            return;
          }
          if (furniture === 'WHITEBOARD') {
            onOverlayOpen('whiteboard');
            return;
          }
        }}
        onMouseMove={(e) => {
          const worldX = e.nativeEvent.offsetX / ZOOM;
          const worldY = e.nativeEvent.offsetY / ZOOM;
          const charId = stateRef.current?.getCharacterAt(worldX, worldY);
          const furniture = stateRef.current?.getFurnitureAt(worldX, worldY);
          e.currentTarget.style.cursor = (charId !== null && charId !== undefined) || furniture ? 'pointer' : 'default';
        }}
      />
      {showPcMenu && (
        <div
          onClick={() => setShowPcMenu(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(18,26,49,0.95)',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minWidth: 160,
              zIndex: 21,
            }}
          >
            <button
              onClick={() => { setShowPcMenu(false); onOverlayOpen('chat'); }}
              style={{
                background: 'transparent', border: '1px solid #2d3d69',
                color: 'rgba(255,255,255,0.85)', padding: '8px 12px',
                cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
              }}
            >
              💬 채팅
            </button>
            <button
              onClick={() => { setShowPcMenu(false); onOverlayOpen('production'); }}
              style={{
                background: 'transparent', border: '1px solid #2d3d69',
                color: 'rgba(255,255,255,0.85)', padding: '8px 12px',
                cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
              }}
            >
              ✍️ 직접 제작
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
