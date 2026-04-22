import { useEffect, useMemo, useRef, useState } from 'react';

import { loadAssets } from '../office/assetLoader.js';
import { OfficeState } from '../office/engine/officeState.js';
import type { OfficeLayout } from '../office/types.js';
import { renderFrame, type EditorRenderState } from '../office/engine/renderer.js';
import { startGameLoop } from '../office/engine/gameLoop.js';
import { TILE_SIZE } from '../constants.js';
import type { WsEvent } from '../hooks/useWebSocket.js';
import { getFootprintForItem, getScalePercents } from '../office/layout/layoutSerializer.js';
import {
  getActiveCategories,
  getCatalogByCategory,
  getCatalogEntry,
  isRotatable,
  type FurnitureCategory,
} from '../office/layout/furnitureCatalog.js';

const ZOOM = 2;
const ASSET_BASE = '/static/';
const LAYOUT_ROW_OFFSET = 9;
const DEV_MODE = import.meta.env.DEV;
const EDITOR_LAYOUT_STORAGE_KEY = 'office-editor-layout-v1';

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

type HoldingState =
  | { kind: 'type'; type: string }
  | { kind: 'instance'; uid: string; type: string; scalePct?: number; scaleXPct?: number; scaleYPct?: number }
  | null;

interface TileHit {
  col: number;
  row: number;
  worldX: number;
  worldY: number;
}

function normalizeAssetType(type: string): string {
  let normalized = type.replace(/:left$/, '');
  normalized = normalized.replace(/_(FRONT|BACK|SIDE)(?:_(ON_\d+|OFF))?$/, '');
  normalized = normalized.replace(/_(ON_\d+|OFF)$/, '');
  return normalized;
}

function buildPlacedCounts(state: OfficeState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of state.getPlacedFurniture()) {
    const key = normalizeAssetType(item.type);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function formatHoldingText(holding: HoldingState): string {
  if (!holding) return '-';
  const kindLabel = holding.kind === 'type' ? '타입' : '기존 가구';
  return `${kindLabel}:${holding.type}`;
}

function isValidLayoutLike(value: unknown): value is OfficeLayout {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.cols === 'number' &&
    typeof obj.rows === 'number' &&
    Array.isArray(obj.tiles) &&
    Array.isArray(obj.furniture)
  );
}

export function OfficeCanvas({ lastEvent }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OfficeState | null>(null);
  const renderOffsetRef = useRef({ offsetX: 0, offsetY: 0 });
  const roomPhotoRef = useRef<HTMLImageElement | null>(null);

  const [editorEnabled, setEditorEnabled] = useState<boolean>(DEV_MODE);
  const [categories, setCategories] = useState<Array<{ id: FurnitureCategory; label: string }>>([]);
  const [activeCategory, setActiveCategory] = useState<FurnitureCategory | null>(null);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [holding, setHolding] = useState<HoldingState>(null);
  const [statusText, setStatusText] = useState<string>('');
  const [hoverTile, setHoverTile] = useState<{ col: number; row: number } | null>(null);
  const [placedCounts, setPlacedCounts] = useState<Record<string, number>>({});

  const persistLayout = (): void => {
    const state = stateRef.current;
    if (!state) return;
    try {
      localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(state.getLayout()));
    } catch {
      // Ignore storage quota / private mode failures.
    }
  };

  const paletteEntries = useMemo(() => {
    if (!activeCategory) return [];
    return getCatalogByCategory(activeCategory);
  }, [activeCategory]);

  const toTileHit = (evt: React.MouseEvent<HTMLCanvasElement>): TileHit | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const { offsetX, offsetY } = renderOffsetRef.current;

    const worldX = (x - offsetX) / ZOOM;
    const worldY = (y - offsetY) / ZOOM;
    const col = Math.floor(worldX / TILE_SIZE);
    const row = Math.floor(worldY / TILE_SIZE);

    const state = stateRef.current;
    if (!state) return null;
    const layout = state.getLayout();
    if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) return null;

    return { col, row, worldX, worldY };
  };

  const updateHoverStatus = (hit: TileHit | null): void => {
    const state = stateRef.current;
    if (!state) return;

    if (!hit) {
      setHoverTile(null);
      return;
    }

    setHoverTile({ col: hit.col, row: hit.row });

    if (holding?.kind === 'type') {
      const ok = state.canPlaceFurniture(holding.type, hit.col, hit.row);
      setStatusText(ok ? '배치 가능' : '배치 불가');
      return;
    }

    if (holding?.kind === 'instance') {
      const ok = state.canPlaceFurniture(holding.type, hit.col, hit.row, holding.uid);
      setStatusText(ok ? '이동 가능' : '이동 불가');
      return;
    }
  };

  const cancelHolding = (): void => {
    setHolding(null);
    setStatusText('취소됨');
  };

  const handlePlaceOrPick = (hit: TileHit): void => {
    const state = stateRef.current;
    if (!state) return;

    if (holding?.kind === 'type') {
      const uid = state.placeFurniture(holding.type, hit.col, hit.row);
      if (!uid) {
        setStatusText('배치 실패: 충돌/벽 규칙/범위 확인');
        return;
      }
      persistLayout();
      setPlacedCounts(buildPlacedCounts(state));
      setSelectedUid(uid);
      setHolding(null);
      setStatusText(`배치 완료 (${holding.type})`);
      return;
    }

    if (holding?.kind === 'instance') {
      const ok = state.moveFurniture(holding.uid, hit.col, hit.row);
      if (!ok) {
        setStatusText('이동 실패: 충돌/벽 규칙/범위 확인');
        return;
      }
      persistLayout();
      setPlacedCounts(buildPlacedCounts(state));
      setSelectedUid(holding.uid);
      setHolding(null);
      setStatusText('이동 완료');
      return;
    }

    const pickedUid = state.getFurnitureAt(hit.worldX, hit.worldY);
    if (!pickedUid) {
      setSelectedUid(null);
      setStatusText('가구 없음');
      return;
    }

    const item = state.getPlacedFurnitureByUid(pickedUid);
    if (!item) {
      setStatusText('가구 조회 실패');
      return;
    }

    setSelectedUid(pickedUid);
    setHolding({
      kind: 'instance',
      uid: pickedUid,
      type: item.type,
      scalePct: item.scalePct,
      scaleXPct: item.scaleXPct,
      scaleYPct: item.scaleYPct,
    });
    setStatusText(`집기: ${item.type}`);
  };

  const handleExport = (): void => {
    const state = stateRef.current;
    if (!state) return;
    const layout = state.getLayout();

    const exported = {
      ...layout,
      furniture: layout.furniture.map((f) => ({
        ...f,
        // Required by this editor workflow: convert visible row to persisted json row.
        row: f.row + LAYOUT_ROW_OFFSET,
      })),
    };

    const blob = new Blob([`${JSON.stringify(exported, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'default-layout-1.edited.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatusText('JSON 다운로드 완료 (+9 보정 적용)');
  };

  const handleDeleteSelected = (): void => {
    const state = stateRef.current;
    if (!state || !selectedUid) return;
    const ok = state.removeFurniture(selectedUid);
    if (!ok) {
      setStatusText('삭제 실패');
      return;
    }
    persistLayout();
    setPlacedCounts(buildPlacedCounts(state));
    setHolding(null);
    setSelectedUid(null);
    setStatusText('삭제 완료');
  };

  const handleRotateSelected = (): void => {
    const state = stateRef.current;
    if (!state || !selectedUid) return;
    const ok = state.rotateFurniture(selectedUid, 'cw');
    if (!ok) {
      setStatusText('회전 불가');
      return;
    }
    persistLayout();
    setPlacedCounts(buildPlacedCounts(state));
    setStatusText('회전 완료');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!editorEnabled) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTypingTarget =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable === true;
      if (isTypingTarget) return;

      if (e.key === 'Escape') {
        cancelHolding();
        return;
      }

      const isDeleteShortcut =
        e.key === 'Delete' || e.key === 'Backspace' || e.key.toLowerCase() === 'x';
      if (isDeleteShortcut && selectedUid) {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      if (selectedUid && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        const state = stateRef.current;
        if (!state) return;
        const delta = e.key === '[' ? -5 : 5;
        const scaled = state.nudgeFurnitureScale(selectedUid, delta);
        if (scaled) {
          persistLayout();
          const selected = state.getPlacedFurnitureByUid(selectedUid);
          const scales = selected ? getScalePercents(selected) : { scaleXPct: 100, scaleYPct: 100 };
          setStatusText(`크기 조절: X ${scales.scaleXPct}% / Y ${scales.scaleYPct}%`);
        }
        return;
      }

      if (selectedUid && (e.key === ',' || e.key === '.' || e.key === '<' || e.key === '>')) {
        e.preventDefault();
        const state = stateRef.current;
        if (!state) return;
        const delta = e.key === ',' || e.key === '<' ? -5 : 5;
        const scaled = state.nudgeFurnitureScaleX(selectedUid, delta);
        if (scaled) {
          persistLayout();
          const selected = state.getPlacedFurnitureByUid(selectedUid);
          const scales = selected ? getScalePercents(selected) : { scaleXPct: 100, scaleYPct: 100 };
          setStatusText(`가로 크기: X ${scales.scaleXPct}% / Y ${scales.scaleYPct}%`);
        }
        return;
      }

      if (selectedUid && (e.key === '-' || e.key === '=')) {
        e.preventDefault();
        const state = stateRef.current;
        if (!state) return;
        const delta = e.key === '-' ? -5 : 5;
        const scaled = state.nudgeFurnitureScaleY(selectedUid, delta);
        if (scaled) {
          persistLayout();
          const selected = state.getPlacedFurnitureByUid(selectedUid);
          const scales = selected ? getScalePercents(selected) : { scaleXPct: 100, scaleYPct: 100 };
          setStatusText(`세로 크기: X ${scales.scaleXPct}% / Y ${scales.scaleYPct}%`);
        }
        return;
      }

      if (e.shiftKey && selectedUid) {
        const state = stateRef.current;
        if (!state) return;
        const delta =
          e.key === 'ArrowLeft'
            ? [-1, 0]
            : e.key === 'ArrowRight'
              ? [1, 0]
              : e.key === 'ArrowUp'
                ? [0, -1]
                : e.key === 'ArrowDown'
                  ? [0, 1]
                  : null;
        if (delta) {
          e.preventDefault();
          const moved = state.nudgeFurnitureOffset(selectedUid, delta[0], delta[1]);
          if (moved) {
            persistLayout();
            const selected = state.getPlacedFurnitureByUid(selectedUid);
            setStatusText(`미세 이동: (${selected?.offsetX || 0}, ${selected?.offsetY || 0})px`);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorEnabled, selectedUid]);

  useEffect(() => {
    const img = new Image();
    img.src = `${ASSET_BASE}assets/room-photo.png`;
    img.onload = () => {
      roomPhotoRef.current = img;
    };
  }, []);

  useEffect(() => {
    void loadAssets(ASSET_BASE)
      .then((layout) => {
        let initialLayout = layout as OfficeLayout;
        try {
          const raw = localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (isValidLayoutLike(parsed)) {
              initialLayout = parsed;
            }
          }
        } catch {
          // Ignore parse/storage failures and fall back to bundled layout.
        }

        const state = new OfficeState(initialLayout);
        stateRef.current = state;
        setPlacedCounts(buildPlacedCounts(state));

        state.addAgent(1, 0, 0, undefined, true);
        state.addAgent(2, 1, 0, undefined, true);
        state.addAgent(3, 2, 0, undefined, true);
        state.addAgent(4, 3, 0, undefined, true);
        state.addAgent(5, 4, 0, undefined, true);

        const nextCategories = getActiveCategories();
        setCategories(nextCategories);
        if (nextCategories.length > 0) {
          setActiveCategory(nextCategories[0].id);
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[AssetLoader] 에셋 로딩 실패:', error);
        setStatusText(`에셋 로딩 실패: ${message}`);
      });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

        const selected = selectedUid ? state.getPlacedFurnitureByUid(selectedUid) : null;
        const selectedEntry = selected ? getCatalogEntry(selected.type) : null;
        const selectedFootprintW = selected && selectedEntry ? getFootprintForItem(selected, selectedEntry).footprintW : 1;
        const selectedFootprintH = selected && selectedEntry ? getFootprintForItem(selected, selectedEntry).footprintH : 1;

        const heldType = holding?.type ?? null;
        const heldEntry = heldType ? getCatalogEntry(heldType) : null;
        const heldScaleX =
          holding?.kind === 'instance'
            ? Math.max(0.25, (holding.scaleXPct ?? holding.scalePct ?? 100) / 100)
            : 1;
        const heldScaleY =
          holding?.kind === 'instance'
            ? Math.max(0.25, (holding.scaleYPct ?? holding.scalePct ?? 100) / 100)
            : 1;

        const ghostValid =
          !!heldType &&
          !!hoverTile &&
          (holding?.kind === 'instance'
            ? state.canPlaceFurniture(heldType, hoverTile.col, hoverTile.row, holding.uid)
            : state.canPlaceFurniture(heldType, hoverTile.col, hoverTile.row));

        const editorState: EditorRenderState | undefined = editorEnabled
          ? {
              showGrid: true,
              ghostSprite: heldEntry?.sprite ?? null,
              ghostMirrored: false,
              ghostScaleX: heldScaleX,
              ghostScaleY: heldScaleY,
              ghostCol: hoverTile?.col ?? -1,
              ghostRow: hoverTile?.row ?? -1,
              ghostValid,
              selectedCol: selected?.col ?? 0,
              selectedRow: selected?.row ?? 0,
              selectedW: selectedFootprintW,
              selectedH: selectedFootprintH,
              hasSelection: !!selected,
              isRotatable: selected ? isRotatable(selected.type) : false,
              deleteButtonBounds: null,
              rotateButtonBounds: null,
              showGhostBorder: false,
              ghostBorderHoverCol: -999,
              ghostBorderHoverRow: -999,
            }
          : undefined;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const offsets = renderFrame(
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
          editorState,
          layout.tileColors,
          layout.cols,
          layout.rows,
          {
            backgroundImage: roomPhotoRef.current,
            hideTileLayer: true,
          },
        );
        renderOffsetRef.current = offsets;
      },
    });

    return stop;
  }, [editorEnabled, hoverTile, holding, selectedUid]);

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
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => {
          if (!editorEnabled) return;
          updateHoverStatus(toTileHit(e));
        }}
        onClick={(e) => {
          if (!editorEnabled) return;
          const hit = toTileHit(e);
          if (!hit) return;
          handlePlaceOrPick(hit);
        }}
        onContextMenu={(e) => {
          if (!editorEnabled) return;
          e.preventDefault();
          cancelHolding();
        }}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          border: '2px solid #2d3d69',
          boxShadow: '4px 4px 0 #0a0a14',
        }}
      />

      {DEV_MODE && (
        <div
          style={{
            width: 310,
            background: 'rgba(8, 12, 24, 0.92)',
            color: '#dbeafe',
            border: '1px solid #334155',
            padding: 8,
            fontFamily: 'monospace',
            fontSize: 12,
            maxHeight: 700,
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <strong>배치 에디터 (클릭 전용)</strong>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={editorEnabled}
                onChange={(e) => setEditorEnabled(e.target.checked)}
              />
              활성화
            </label>
          </div>

          {editorEnabled && (
            <>
              <div style={{ marginBottom: 6 }}>
                <div style={{ marginBottom: 4 }}>카테고리</div>
                <select
                  value={activeCategory ?? ''}
                  onChange={(e) => setActiveCategory(e.target.value as FurnitureCategory)}
                  style={{ width: '100%', background: '#0f172a', color: '#e2e8f0' }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  maxHeight: 150,
                  overflow: 'auto',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 4,
                  marginBottom: 8,
                }}
              >
                {paletteEntries.map((entry) => (
                  <button
                    key={entry.type}
                    onClick={() => {
                      setHolding({ kind: 'type', type: entry.type });
                      setStatusText(`놓기 대기: ${entry.type}`);
                    }}
                    style={{
                      textAlign: 'left',
                      background: holding?.kind === 'type' && holding.type === entry.type ? '#1d4ed8' : '#1e293b',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      padding: '4px 6px',
                      cursor: 'pointer',
                    }}
                  >
                    {(() => {
                      const count = placedCounts[normalizeAssetType(entry.type)] ?? 0;
                      if (count <= 0) return entry.label;
                      return count > 1 ? `✓ ${entry.label} (${count})` : `✓ ${entry.label}`;
                    })()}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
                <button onClick={handleDeleteSelected} style={{ cursor: 'pointer' }} disabled={!selectedUid}>
                  삭제
                </button>
                <button
                  onClick={handleRotateSelected}
                  style={{ cursor: 'pointer' }}
                  disabled={!selectedUid || !isRotatable(stateRef.current?.getPlacedFurnitureByUid(selectedUid)?.type ?? '')}
                >
                  회전
                </button>
                <button onClick={handleExport} style={{ cursor: 'pointer' }}>
                  JSON 내보내기
                </button>
              </div>

              <div style={{ lineHeight: 1.4 }}>
                <div>집은 상태: {formatHoldingText(holding)}</div>
                <div>선택 항목: {selectedUid ?? '-'}</div>
                <div>
                  선택 오프셋:{' '}
                  {selectedUid
                    ? (() => {
                        const item = stateRef.current?.getPlacedFurnitureByUid(selectedUid);
                        return item ? `${item.offsetX || 0}, ${item.offsetY || 0}px` : '-';
                      })()
                    : '-'}
                </div>
                <div>
                  선택 크기:{' '}
                  {selectedUid
                    ? (() => {
                        const item = stateRef.current?.getPlacedFurnitureByUid(selectedUid);
                        if (!item) return '-';
                        const scales = getScalePercents(item);
                        return `X ${scales.scaleXPct}% / Y ${scales.scaleYPct}%`;
                      })()
                    : '-'}
                </div>
                {selectedUid && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ marginBottom: 2 }}>전체 크기</div>
                    <input
                      type="range"
                      min={25}
                      max={300}
                      step={1}
                      value={
                        (() => {
                          const item = stateRef.current?.getPlacedFurnitureByUid(selectedUid);
                          if (!item) return 100;
                          return item.scalePct ?? getScalePercents(item).scaleXPct;
                        })()
                      }
                      onChange={(e) => {
                        const state = stateRef.current;
                        if (!state || !selectedUid) return;
                        const value = Number(e.target.value);
                        const changed = state.setFurnitureScale(selectedUid, value);
                        if (changed) {
                          persistLayout();
                          const selected = state.getPlacedFurnitureByUid(selectedUid);
                          const scales = selected ? getScalePercents(selected) : { scaleXPct: 100, scaleYPct: 100 };
                          setStatusText(`크기 조절: X ${scales.scaleXPct}% / Y ${scales.scaleYPct}%`);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                    <div style={{ marginTop: 6, marginBottom: 2 }}>가로(X) 크기</div>
                    <input
                      type="range"
                      min={25}
                      max={300}
                      step={1}
                      value={
                        (() => {
                          const item = stateRef.current?.getPlacedFurnitureByUid(selectedUid);
                          if (!item) return 100;
                          return getScalePercents(item).scaleXPct;
                        })()
                      }
                      onChange={(e) => {
                        const state = stateRef.current;
                        if (!state || !selectedUid) return;
                        const value = Number(e.target.value);
                        const changed = state.setFurnitureScaleX(selectedUid, value);
                        if (changed) {
                          persistLayout();
                          const selected = state.getPlacedFurnitureByUid(selectedUid);
                          const scales = selected ? getScalePercents(selected) : { scaleXPct: 100, scaleYPct: 100 };
                          setStatusText(`가로 크기: X ${scales.scaleXPct}% / Y ${scales.scaleYPct}%`);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                    <div style={{ marginTop: 6, marginBottom: 2 }}>세로(Y) 크기</div>
                    <input
                      type="range"
                      min={25}
                      max={300}
                      step={1}
                      value={
                        (() => {
                          const item = stateRef.current?.getPlacedFurnitureByUid(selectedUid);
                          if (!item) return 100;
                          return getScalePercents(item).scaleYPct;
                        })()
                      }
                      onChange={(e) => {
                        const state = stateRef.current;
                        if (!state || !selectedUid) return;
                        const value = Number(e.target.value);
                        const changed = state.setFurnitureScaleY(selectedUid, value);
                        if (changed) {
                          persistLayout();
                          const selected = state.getPlacedFurnitureByUid(selectedUid);
                          const scales = selected ? getScalePercents(selected) : { scaleXPct: 100, scaleYPct: 100 };
                          setStatusText(`세로 크기: X ${scales.scaleXPct}% / Y ${scales.scaleYPct}%`);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                <div>
                  호버 타일: {hoverTile ? `${hoverTile.col},${hoverTile.row}` : '-'}
                </div>
                <div>상태: {statusText || '-'}</div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  ESC/우클릭: 취소, Del/Backspace/X: 삭제, Shift+방향키: 미세 이동(1px), [ ]: 전체 크기, {'< >'}: 가로, -/=: 세로
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
