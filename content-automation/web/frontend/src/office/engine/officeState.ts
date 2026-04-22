import {
  AUTO_ON_FACING_DEPTH,
  AUTO_ON_SIDE_DEPTH,
  CHARACTER_HIT_HALF_WIDTH,
  CHARACTER_HIT_HEIGHT,
  CHARACTER_SITTING_OFFSET_PX,
  DISMISS_BUBBLE_FAST_FADE_SEC,
  FURNITURE_ANIM_INTERVAL_SEC,
  HUE_SHIFT_MIN_DEG,
  HUE_SHIFT_RANGE_DEG,
  INACTIVE_SEAT_TIMER_MIN_SEC,
  INACTIVE_SEAT_TIMER_RANGE_SEC,
  WAITING_BUBBLE_DURATION_SEC,
} from '../../constants.js';
import { getAnimationFrames, getCatalogEntry, getOnStateType } from '../layout/furnitureCatalog.js';
import {
  createDefaultLayout,
  getFootprintForItem,
  getScalePercents,
  getBlockedTiles,
  getPlacementBlockedTiles,
  getPlacementTiles,
  layoutToFurnitureInstances,
  layoutToSeats,
  layoutToTileMap,
} from '../layout/layoutSerializer.js';
import { findPath, getWalkableTiles, isWalkable } from '../layout/tileMap.js';
import { getRotatedType, isRotatable } from '../layout/furnitureCatalog.js';
import { getLoadedCharacterCount } from '../sprites/spriteData.js';
import type {
  Character,
  FurnitureInstance,
  OfficeLayout,
  PlacedFurniture,
  Seat,
  TileType as TileTypeVal,
} from '../types.js';
import { CharacterState, Direction, MATRIX_EFFECT_DURATION, TILE_SIZE } from '../types.js';
import { createCharacter, updateCharacter } from './characters.js';
import { matrixEffectSeeds } from './matrixEffect.js';

export class OfficeState {
  layout: OfficeLayout;
  tileMap: TileTypeVal[][];
  seats: Map<string, Seat>;
  blockedTiles: Set<string>;
  furniture: FurnitureInstance[];
  walkableTiles: Array<{ col: number; row: number }>;
  characters: Map<number, Character> = new Map();
  /** Accumulated time for furniture animation frame cycling */
  furnitureAnimTimer = 0;
  selectedAgentId: number | null = null;
  cameraFollowId: number | null = null;
  hoveredAgentId: number | null = null;
  hoveredTile: { col: number; row: number } | null = null;
  /** Maps "parentId:toolId" → sub-agent character ID (negative) */
  subagentIdMap: Map<string, number> = new Map();
  /** Reverse lookup: sub-agent character ID → parent info */
  subagentMeta: Map<number, { parentAgentId: number; parentToolId: string }> = new Map();
  private nextSubagentId = -1;

  constructor(layout?: OfficeLayout) {
    this.layout = layout || createDefaultLayout();
    this.tileMap = layoutToTileMap(this.layout);
    this.seats = layoutToSeats(this.layout.furniture);
    this.blockedTiles = getBlockedTiles(this.layout.furniture);
    this.furniture = layoutToFurnitureInstances(this.layout.furniture);
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles);
  }

  private getSeatCenter(seat: Seat): { x: number; y: number } {
    return {
      x: seat.seatCol * TILE_SIZE + TILE_SIZE / 2 + (seat.seatOffsetX || 0),
      y: seat.seatRow * TILE_SIZE + TILE_SIZE / 2 + (seat.seatOffsetY || 0),
    };
  }

  /** Rebuild all derived state from a new layout. Reassigns existing characters.
   *  @param shift Optional pixel shift to apply when grid expands left/up */
  rebuildFromLayout(layout: OfficeLayout, shift?: { col: number; row: number }): void {
    this.layout = layout;
    this.tileMap = layoutToTileMap(layout);
    this.seats = layoutToSeats(layout.furniture);
    this.blockedTiles = getBlockedTiles(layout.furniture);
    this.rebuildFurnitureInstances();
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles);

    // Shift character positions when grid expands left/up
    if (shift && (shift.col !== 0 || shift.row !== 0)) {
      for (const ch of this.characters.values()) {
        ch.tileCol += shift.col;
        ch.tileRow += shift.row;
        ch.x += shift.col * TILE_SIZE;
        ch.y += shift.row * TILE_SIZE;
        // Clear path since tile coords changed
        ch.path = [];
        ch.moveProgress = 0;
      }
    }

    // Reassign characters to new seats, preserving existing assignments when possible
    for (const seat of this.seats.values()) {
      seat.assigned = false;
    }

    // First pass: try to keep characters at their existing seats
    for (const ch of this.characters.values()) {
      if (ch.seatId && this.seats.has(ch.seatId)) {
        const seat = this.seats.get(ch.seatId)!;
        if (!seat.assigned) {
          seat.assigned = true;
          // Snap character to seat position
          ch.tileCol = seat.seatCol;
          ch.tileRow = seat.seatRow;
          const center = this.getSeatCenter(seat);
          ch.x = center.x;
          ch.y = center.y;
          ch.dir = seat.facingDir;
          continue;
        }
      }
      ch.seatId = null; // will be reassigned below
    }

    // Second pass: assign remaining characters to free seats
    for (const ch of this.characters.values()) {
      if (ch.seatId) continue;
      const seatId = this.findFreeSeat();
      if (seatId) {
        this.seats.get(seatId)!.assigned = true;
        ch.seatId = seatId;
        const seat = this.seats.get(seatId)!;
        ch.tileCol = seat.seatCol;
        ch.tileRow = seat.seatRow;
        const center = this.getSeatCenter(seat);
        ch.x = center.x;
        ch.y = center.y;
        ch.dir = seat.facingDir;
      }
    }

    // Relocate any characters that ended up outside bounds or on non-walkable tiles
    for (const ch of this.characters.values()) {
      if (ch.seatId) continue; // seated characters are fine
      if (
        ch.tileCol < 0 ||
        ch.tileCol >= layout.cols ||
        ch.tileRow < 0 ||
        ch.tileRow >= layout.rows
      ) {
        this.relocateCharacterToWalkable(ch);
      }
    }
  }

  /** Move a character to a random walkable tile */
  private relocateCharacterToWalkable(ch: Character): void {
    if (this.walkableTiles.length === 0) return;
    const spawn = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
    ch.tileCol = spawn.col;
    ch.tileRow = spawn.row;
    ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
    ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
    ch.path = [];
    ch.moveProgress = 0;
  }

  getLayout(): OfficeLayout {
    return this.layout;
  }

  /** Snapshot of placed furniture entries (layout-space coordinates). */
  getPlacedFurniture(): PlacedFurniture[] {
    return this.layout.furniture.map((f) => ({ ...f }));
  }

  /** Find a placed furniture item by uid. */
  getPlacedFurnitureByUid(uid: string): PlacedFurniture | null {
    return this.layout.furniture.find((f) => f.uid === uid) ?? null;
  }

  /** Hit test furniture by world pixel position. Returns top-most uid or null. */
  getFurnitureAt(worldX: number, worldY: number): string | null {
    const candidates = this.layout.furniture
      .map((item, idx) => {
        const entry = getCatalogEntry(item.type);
        if (!entry) return null;
        const inst = this.furniture[idx];
        if (inst) {
          const scaleX = inst.scaleX ?? inst.scale ?? 1;
          const scaleY = inst.scaleY ?? inst.scale ?? 1;
          const spriteW = inst.sprite[0]?.length ?? entry.sprite[0]?.length ?? 0;
          const spriteH = inst.sprite.length ?? entry.sprite.length;
          return {
            uid: item.uid,
            x: inst.x,
            y: inst.y,
            w: spriteW * scaleX,
            h: spriteH * scaleY,
            z: inst.zY,
          };
        }

        const x = item.col * TILE_SIZE + (item.offsetX || 0);
        const y = item.row * TILE_SIZE + (item.offsetY || 0);
        const { scaleXPct, scaleYPct } = getScalePercents(item);
        const w = (entry.sprite[0]?.length ?? 0) * (scaleXPct / 100);
        const h = entry.sprite.length * (scaleYPct / 100);
        return { uid: item.uid, x, y, w, h, z: y + h };
      })
      .filter((v): v is { uid: string; x: number; y: number; w: number; h: number; z: number } => v !== null)
      .sort((a, b) => b.z - a.z);

    for (const c of candidates) {
      if (worldX >= c.x && worldX <= c.x + c.w && worldY >= c.y && worldY <= c.y + c.h) {
        return c.uid;
      }
    }
    return null;
  }

  private canPlaceFurnitureAt(type: string, col: number, row: number, excludeUid?: string): boolean {
    const entry = getCatalogEntry(type);
    if (!entry) return false;
    const existing = excludeUid ? this.layout.furniture.find((f) => f.uid === excludeUid) : null;
    const { footprintW, footprintH } = getFootprintForItem(existing ?? { scalePct: 100 }, entry);
    if (col < 0 || row < 0) return false;
    if (col + footprintW > this.layout.cols) return false;
    if (row + footprintH > this.layout.rows) return false;

    const blocked = getPlacementBlockedTiles(this.layout.furniture, excludeUid);
    const candidateTiles = getPlacementTiles(
      {
        uid: '__candidate__',
        type,
        col,
        row,
        ...(existing?.scalePct ? { scalePct: existing.scalePct } : {}),
        ...(existing?.scaleXPct ? { scaleXPct: existing.scaleXPct } : {}),
        ...(existing?.scaleYPct ? { scaleYPct: existing.scaleYPct } : {}),
      },
      entry,
    );

    for (const key of candidateTiles) {
      if (blocked.has(key)) return false;
    }
    return true;
  }

  canPlaceFurniture(type: string, col: number, row: number, excludeUid?: string): boolean {
    return this.canPlaceFurnitureAt(type, col, row, excludeUid);
  }

  placeFurniture(type: string, col: number, row: number): string | null {
    if (!this.canPlaceFurnitureAt(type, col, row)) return null;
    const uid = `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.layout.furniture.push({ uid, type, col, row });
    this.rebuildFromLayout(this.layout);
    return uid;
  }

  moveFurniture(uid: string, col: number, row: number): boolean {
    const idx = this.layout.furniture.findIndex((f) => f.uid === uid);
    if (idx < 0) return false;
    const item = this.layout.furniture[idx];
    if (!this.canPlaceFurnitureAt(item.type, col, row, uid)) return false;
    this.layout.furniture[idx] = { ...item, col, row };
    this.rebuildFromLayout(this.layout);
    return true;
  }

  removeFurniture(uid: string): boolean {
    const before = this.layout.furniture.length;
    this.layout.furniture = this.layout.furniture.filter((f) => f.uid !== uid);
    if (this.layout.furniture.length === before) return false;
    this.rebuildFromLayout(this.layout);
    return true;
  }

  rotateFurniture(uid: string, direction: 'cw' | 'ccw' = 'cw'): boolean {
    const idx = this.layout.furniture.findIndex((f) => f.uid === uid);
    if (idx < 0) return false;
    const item = this.layout.furniture[idx];
    if (!isRotatable(item.type)) return false;
    const rotated = getRotatedType(item.type, direction);
    if (!rotated) return false;
    if (!this.canPlaceFurnitureAt(rotated, item.col, item.row, uid)) return false;
    this.layout.furniture[idx] = { ...item, type: rotated };
    this.rebuildFromLayout(this.layout);
    return true;
  }

  nudgeFurnitureOffset(uid: string, dx: number, dy: number): boolean {
    const idx = this.layout.furniture.findIndex((f) => f.uid === uid);
    if (idx < 0) return false;
    const item = this.layout.furniture[idx];
    const nextX = (item.offsetX || 0) + dx;
    const nextY = (item.offsetY || 0) + dy;
    const MAX_OFFSET = 12;
    const clampedX = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, nextX));
    const clampedY = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, nextY));
    if (clampedX === (item.offsetX || 0) && clampedY === (item.offsetY || 0)) return false;
    this.layout.furniture[idx] = { ...item, offsetX: clampedX, offsetY: clampedY };
    this.rebuildFromLayout(this.layout);
    return true;
  }

  nudgeFurnitureScale(uid: string, deltaPct: number): boolean {
    const idx = this.layout.furniture.findIndex((f) => f.uid === uid);
    if (idx < 0) return false;
    const item = this.layout.furniture[idx];
    const { scaleXPct, scaleYPct } = getScalePercents(item);
    const nextX = scaleXPct + deltaPct;
    const nextY = scaleYPct + deltaPct;
    const MIN_SCALE_PCT = 25;
    const MAX_SCALE_PCT = 300;
    const clampedX = Math.max(MIN_SCALE_PCT, Math.min(MAX_SCALE_PCT, Math.round(nextX)));
    const clampedY = Math.max(MIN_SCALE_PCT, Math.min(MAX_SCALE_PCT, Math.round(nextY)));
    if (clampedX === scaleXPct && clampedY === scaleYPct) return false;
    this.layout.furniture[idx] = { ...item, scalePct: clampedX, scaleXPct: clampedX, scaleYPct: clampedY };
    this.rebuildFromLayout(this.layout);
    return true;
  }

  setFurnitureScale(uid: string, scalePct: number): boolean {
    const idx = this.layout.furniture.findIndex((f) => f.uid === uid);
    if (idx < 0) return false;
    const item = this.layout.furniture[idx];
    const MIN_SCALE_PCT = 25;
    const MAX_SCALE_PCT = 300;
    const clamped = Math.max(MIN_SCALE_PCT, Math.min(MAX_SCALE_PCT, Math.round(scalePct)));
    const { scaleXPct, scaleYPct } = getScalePercents(item);
    if (clamped === scaleXPct && clamped === scaleYPct) return false;
    this.layout.furniture[idx] = { ...item, scalePct: clamped, scaleXPct: clamped, scaleYPct: clamped };
    this.rebuildFromLayout(this.layout);
    return true;
  }

  nudgeFurnitureScaleX(uid: string, deltaPct: number): boolean {
    const idx = this.layout.furniture.findIndex((f) => f.uid === uid);
    if (idx < 0) return false;
    const item = this.layout.furniture[idx];
    const MIN_SCALE_PCT = 25;
    const MAX_SCALE_PCT = 300;
    const { scaleXPct, scaleYPct } = getScalePercents(item);
    const clampedX = Math.max(MIN_SCALE_PCT, Math.min(MAX_SCALE_PCT, Math.round(scaleXPct + deltaPct)));
    if (clampedX === scaleXPct) return false;
    this.layout.furniture[idx] = { ...item, scaleXPct: clampedX, scaleYPct };
    this.rebuildFromLayout(this.layout);
    return true;
  }

  nudgeFurnitureScaleY(uid: string, deltaPct: number): boolean {
    const idx = this.layout.furniture.findIndex((f) => f.uid === uid);
    if (idx < 0) return false;
    const item = this.layout.furniture[idx];
    const MIN_SCALE_PCT = 25;
    const MAX_SCALE_PCT = 300;
    const { scaleXPct, scaleYPct } = getScalePercents(item);
    const clampedY = Math.max(MIN_SCALE_PCT, Math.min(MAX_SCALE_PCT, Math.round(scaleYPct + deltaPct)));
    if (clampedY === scaleYPct) return false;
    this.layout.furniture[idx] = { ...item, scaleXPct, scaleYPct: clampedY };
    this.rebuildFromLayout(this.layout);
    return true;
  }

  setFurnitureScaleX(uid: string, scaleXPct: number): boolean {
    const idx = this.layout.furniture.findIndex((f) => f.uid === uid);
    if (idx < 0) return false;
    const item = this.layout.furniture[idx];
    const MIN_SCALE_PCT = 25;
    const MAX_SCALE_PCT = 300;
    const clampedX = Math.max(MIN_SCALE_PCT, Math.min(MAX_SCALE_PCT, Math.round(scaleXPct)));
    const current = getScalePercents(item);
    if (clampedX === current.scaleXPct) return false;
    this.layout.furniture[idx] = {
      ...item,
      scaleXPct: clampedX,
      scaleYPct: current.scaleYPct,
    };
    this.rebuildFromLayout(this.layout);
    return true;
  }

  setFurnitureScaleY(uid: string, scaleYPct: number): boolean {
    const idx = this.layout.furniture.findIndex((f) => f.uid === uid);
    if (idx < 0) return false;
    const item = this.layout.furniture[idx];
    const MIN_SCALE_PCT = 25;
    const MAX_SCALE_PCT = 300;
    const clampedY = Math.max(MIN_SCALE_PCT, Math.min(MAX_SCALE_PCT, Math.round(scaleYPct)));
    const current = getScalePercents(item);
    if (clampedY === current.scaleYPct) return false;
    this.layout.furniture[idx] = {
      ...item,
      scaleXPct: current.scaleXPct,
      scaleYPct: clampedY,
    };
    this.rebuildFromLayout(this.layout);
    return true;
  }

  /** Get the blocked-tile key for a character's own seat, or null */
  private ownSeatKey(ch: Character): string | null {
    if (!ch.seatId) return null;
    const seat = this.seats.get(ch.seatId);
    if (!seat) return null;
    return `${seat.seatCol},${seat.seatRow}`;
  }

  /** Temporarily unblock a character's own seat, run fn, then re-block */
  private withOwnSeatUnblocked<T>(ch: Character, fn: () => T): T {
    const key = this.ownSeatKey(ch);
    if (key) this.blockedTiles.delete(key);
    const result = fn();
    if (key) this.blockedTiles.add(key);
    return result;
  }

  private findFreeSeat(): string | null {
    // Build set of tiles occupied by electronics (PCs, monitors, etc.)
    const electronicsTiles = new Set<string>();
    for (const item of this.layout.furniture) {
      const entry = getCatalogEntry(item.type);
      if (!entry || entry.category !== 'electronics') continue;
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          electronicsTiles.add(`${item.col + dc},${item.row + dr}`);
        }
      }
    }

    // Collect free seats, split into those facing electronics and the rest
    const pcSeats: string[] = [];
    const otherSeats: string[] = [];
    for (const [uid, seat] of this.seats) {
      if (seat.assigned) continue;

      // Check if this seat faces electronics (same logic as auto-state detection)
      let facesPC = false;
      const dCol =
        seat.facingDir === Direction.RIGHT ? 1 : seat.facingDir === Direction.LEFT ? -1 : 0;
      const dRow = seat.facingDir === Direction.DOWN ? 1 : seat.facingDir === Direction.UP ? -1 : 0;
      for (let d = 1; d <= AUTO_ON_FACING_DEPTH && !facesPC; d++) {
        const tileCol = seat.seatCol + dCol * d;
        const tileRow = seat.seatRow + dRow * d;
        if (electronicsTiles.has(`${tileCol},${tileRow}`)) {
          facesPC = true;
          break;
        }
        if (dCol !== 0) {
          if (
            electronicsTiles.has(`${tileCol},${tileRow - 1}`) ||
            electronicsTiles.has(`${tileCol},${tileRow + 1}`)
          ) {
            facesPC = true;
            break;
          }
        } else {
          if (
            electronicsTiles.has(`${tileCol - 1},${tileRow}`) ||
            electronicsTiles.has(`${tileCol + 1},${tileRow}`)
          ) {
            facesPC = true;
            break;
          }
        }
      }
      (facesPC ? pcSeats : otherSeats).push(uid);
    }

    // Pick randomly: prefer PC seats, then any seat
    if (pcSeats.length > 0) return pcSeats[Math.floor(Math.random() * pcSeats.length)];
    if (otherSeats.length > 0) return otherSeats[Math.floor(Math.random() * otherSeats.length)];
    return null;
  }

  /**
   * Pick a diverse palette for a new agent based on currently active agents.
   * First 6 agents each get a unique skin (random order). Beyond 6, skins
   * repeat in balanced rounds with a random hue shift (≥45°).
   */
  private pickDiversePalette(): { palette: number; hueShift: number } {
    // Count how many non-sub-agents use each base palette (0-5)
    const paletteCount = getLoadedCharacterCount();
    const counts = new Array(paletteCount).fill(0) as number[];
    for (const ch of this.characters.values()) {
      if (ch.isSubagent) continue;
      if (ch.palette < paletteCount) counts[ch.palette]++;
    }
    const minCount = Math.min(...counts);
    // Available = palettes at the minimum count (least used)
    const available: number[] = [];
    for (let i = 0; i < paletteCount; i++) {
      if (counts[i] === minCount) available.push(i);
    }
    const palette = available[Math.floor(Math.random() * available.length)];
    // First round (minCount === 0): no hue shift. Subsequent rounds: random ≥45°.
    let hueShift = 0;
    if (minCount > 0) {
      hueShift = HUE_SHIFT_MIN_DEG + Math.floor(Math.random() * HUE_SHIFT_RANGE_DEG);
    }
    return { palette, hueShift };
  }

  addAgent(
    id: number,
    preferredPalette?: number,
    preferredHueShift?: number,
    preferredSeatId?: string,
    skipSpawnEffect?: boolean,
    folderName?: string,
  ): void {
    if (this.characters.has(id)) return;

    let palette: number;
    let hueShift: number;
    if (preferredPalette !== undefined) {
      palette = preferredPalette;
      hueShift = preferredHueShift ?? 0;
    } else {
      const pick = this.pickDiversePalette();
      palette = pick.palette;
      hueShift = pick.hueShift;
    }

    // Try preferred seat first, then any free seat
    let seatId: string | null = null;
    if (preferredSeatId && this.seats.has(preferredSeatId)) {
      const seat = this.seats.get(preferredSeatId)!;
      if (!seat.assigned) {
        seatId = preferredSeatId;
      }
    }
    if (!seatId) {
      seatId = this.findFreeSeat();
    }

    let ch: Character;
    if (seatId) {
      const seat = this.seats.get(seatId)!;
      seat.assigned = true;
      ch = createCharacter(id, palette, seatId, seat, hueShift);
      const center = this.getSeatCenter(seat);
      ch.x = center.x;
      ch.y = center.y;
    } else {
      // No seats — spawn at random walkable tile
      const spawn =
        this.walkableTiles.length > 0
          ? this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)]
          : { col: 1, row: 1 };
      ch = createCharacter(id, palette, null, null, hueShift);
      ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
      ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
      ch.tileCol = spawn.col;
      ch.tileRow = spawn.row;
    }

    if (folderName) {
      ch.folderName = folderName;
    }
    if (!skipSpawnEffect) {
      ch.matrixEffect = 'spawn';
      ch.matrixEffectTimer = 0;
      ch.matrixEffectSeeds = matrixEffectSeeds();
    }
    this.characters.set(id, ch);
  }

  removeAgent(id: number): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    if (ch.matrixEffect === 'despawn') return; // already despawning
    // Free seat and clear selection immediately
    if (ch.seatId) {
      const seat = this.seats.get(ch.seatId);
      if (seat) seat.assigned = false;
    }
    if (this.selectedAgentId === id) this.selectedAgentId = null;
    if (this.cameraFollowId === id) this.cameraFollowId = null;
    // Start despawn animation instead of immediate delete
    ch.matrixEffect = 'despawn';
    ch.matrixEffectTimer = 0;
    ch.matrixEffectSeeds = matrixEffectSeeds();
    ch.bubbleType = null;
  }

  /** Find seat uid at a given tile position, or null */
  getSeatAtTile(col: number, row: number): string | null {
    for (const [uid, seat] of this.seats) {
      if (seat.seatCol === col && seat.seatRow === row) return uid;
    }
    return null;
  }

  /** Reassign an agent from their current seat to a new seat */
  reassignSeat(agentId: number, seatId: string): void {
    const ch = this.characters.get(agentId);
    if (!ch) return;
    // Unassign old seat
    if (ch.seatId) {
      const old = this.seats.get(ch.seatId);
      if (old) old.assigned = false;
    }
    // Assign new seat
    const seat = this.seats.get(seatId);
    if (!seat || seat.assigned) return;
    seat.assigned = true;
    ch.seatId = seatId;
    // Pathfind to new seat (unblock own seat tile for this query)
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles),
    );
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
    } else {
      // Already at seat or no path — sit down
      ch.state = CharacterState.TYPE;
      ch.dir = seat.facingDir;
      const center = this.getSeatCenter(seat);
      ch.x = center.x;
      ch.y = center.y;
      ch.frame = 0;
      ch.frameTimer = 0;
      if (!ch.isActive) {
        ch.seatTimer = INACTIVE_SEAT_TIMER_MIN_SEC + Math.random() * INACTIVE_SEAT_TIMER_RANGE_SEC;
      }
    }
  }

  /** Send an agent back to their currently assigned seat */
  sendToSeat(agentId: number): void {
    const ch = this.characters.get(agentId);
    if (!ch || !ch.seatId) return;
    const seat = this.seats.get(ch.seatId);
    if (!seat) return;
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles),
    );
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
    } else {
      // Already at seat — sit down
      ch.state = CharacterState.TYPE;
      ch.dir = seat.facingDir;
      const center = this.getSeatCenter(seat);
      ch.x = center.x;
      ch.y = center.y;
      ch.frame = 0;
      ch.frameTimer = 0;
      if (!ch.isActive) {
        ch.seatTimer = INACTIVE_SEAT_TIMER_MIN_SEC + Math.random() * INACTIVE_SEAT_TIMER_RANGE_SEC;
      }
    }
  }

  /** Walk an agent to an arbitrary walkable tile (right-click command) */
  walkToTile(agentId: number, col: number, row: number): boolean {
    const ch = this.characters.get(agentId);
    if (!ch || ch.isSubagent) return false;
    if (!isWalkable(col, row, this.tileMap, this.blockedTiles)) {
      // Also allow walking to own seat tile (blocked for others but not self)
      const key = this.ownSeatKey(ch);
      if (!key || key !== `${col},${row}`) return false;
    }
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, col, row, this.tileMap, this.blockedTiles),
    );
    if (path.length === 0) return false;
    ch.path = path;
    ch.moveProgress = 0;
    ch.state = CharacterState.WALK;
    ch.frame = 0;
    ch.frameTimer = 0;
    return true;
  }

  /** Create a sub-agent character with the parent's palette. Returns the sub-agent ID. */
  addSubagent(parentAgentId: number, parentToolId: string): number {
    const key = `${parentAgentId}:${parentToolId}`;
    if (this.subagentIdMap.has(key)) return this.subagentIdMap.get(key)!;

    const id = this.nextSubagentId--;
    const parentCh = this.characters.get(parentAgentId);
    const palette = parentCh ? parentCh.palette : 0;
    const hueShift = parentCh ? parentCh.hueShift : 0;

    // Find the closest walkable tile to the parent, avoiding tiles occupied by other characters
    const parentCol = parentCh ? parentCh.tileCol : 0;
    const parentRow = parentCh ? parentCh.tileRow : 0;
    const dist = (c: number, r: number) => Math.abs(c - parentCol) + Math.abs(r - parentRow);

    // Build set of tiles occupied by existing characters
    const occupiedTiles = new Set<string>();
    for (const [, other] of this.characters) {
      occupiedTiles.add(`${other.tileCol},${other.tileRow}`);
    }

    let spawn = { col: parentCol, row: parentRow };
    if (this.walkableTiles.length > 0) {
      let closest = this.walkableTiles[0];
      let closestDist = Infinity;
      for (const tile of this.walkableTiles) {
        if (occupiedTiles.has(`${tile.col},${tile.row}`)) continue;
        const d = dist(tile.col, tile.row);
        if (d < closestDist) {
          closest = tile;
          closestDist = d;
        }
      }
      spawn = closest;
    }

    const ch = createCharacter(id, palette, null, null, hueShift);
    ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
    ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
    ch.tileCol = spawn.col;
    ch.tileRow = spawn.row;
    // Face the same direction as the parent agent
    if (parentCh) ch.dir = parentCh.dir;
    ch.isSubagent = true;
    ch.parentAgentId = parentAgentId;
    ch.matrixEffect = 'spawn';
    ch.matrixEffectTimer = 0;
    ch.matrixEffectSeeds = matrixEffectSeeds();
    this.characters.set(id, ch);

    this.subagentIdMap.set(key, id);
    this.subagentMeta.set(id, { parentAgentId, parentToolId });
    return id;
  }

  /** Remove a specific sub-agent character and free its seat */
  removeSubagent(parentAgentId: number, parentToolId: string): void {
    const key = `${parentAgentId}:${parentToolId}`;
    const id = this.subagentIdMap.get(key);
    if (id === undefined) return;

    const ch = this.characters.get(id);
    if (ch) {
      if (ch.matrixEffect === 'despawn') {
        // Already despawning — just clean up maps
        this.subagentIdMap.delete(key);
        this.subagentMeta.delete(id);
        return;
      }
      if (ch.seatId) {
        const seat = this.seats.get(ch.seatId);
        if (seat) seat.assigned = false;
      }
      // Start despawn animation — keep character in map for rendering
      ch.matrixEffect = 'despawn';
      ch.matrixEffectTimer = 0;
      ch.matrixEffectSeeds = matrixEffectSeeds();
      ch.bubbleType = null;
    }
    // Clean up tracking maps immediately so keys don't collide
    this.subagentIdMap.delete(key);
    this.subagentMeta.delete(id);
    if (this.selectedAgentId === id) this.selectedAgentId = null;
    if (this.cameraFollowId === id) this.cameraFollowId = null;
  }

  /** Remove all sub-agents belonging to a parent agent */
  removeAllSubagents(parentAgentId: number): void {
    const toRemove: string[] = [];
    for (const [key, id] of this.subagentIdMap) {
      const meta = this.subagentMeta.get(id);
      if (meta && meta.parentAgentId === parentAgentId) {
        const ch = this.characters.get(id);
        if (ch) {
          if (ch.matrixEffect === 'despawn') {
            // Already despawning — just clean up maps
            this.subagentMeta.delete(id);
            toRemove.push(key);
            continue;
          }
          if (ch.seatId) {
            const seat = this.seats.get(ch.seatId);
            if (seat) seat.assigned = false;
          }
          // Start despawn animation
          ch.matrixEffect = 'despawn';
          ch.matrixEffectTimer = 0;
          ch.matrixEffectSeeds = matrixEffectSeeds();
          ch.bubbleType = null;
        }
        this.subagentMeta.delete(id);
        if (this.selectedAgentId === id) this.selectedAgentId = null;
        if (this.cameraFollowId === id) this.cameraFollowId = null;
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      this.subagentIdMap.delete(key);
    }
  }

  /** Look up the sub-agent character ID for a given parent+toolId, or null */
  getSubagentId(parentAgentId: number, parentToolId: string): number | null {
    return this.subagentIdMap.get(`${parentAgentId}:${parentToolId}`) ?? null;
  }

  setAgentActive(id: number, active: boolean): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.isActive = active;
      if (!active) {
        // Sentinel -1: signals turn just ended, skip next seat rest timer.
        // Prevents the WALK handler from setting a 2-4 min rest on arrival.
        ch.seatTimer = -1;
        ch.path = [];
        ch.moveProgress = 0;
      }
      this.rebuildFurnitureInstances();
    }
  }

  /** Rebuild furniture instances with auto-state applied (active agents turn electronics ON) */
  private rebuildFurnitureInstances(): void {
    // Collect tiles where active agents face desks
    const autoOnTiles = new Set<string>();
    for (const ch of this.characters.values()) {
      if (!ch.isActive || !ch.seatId) continue;
      const seat = this.seats.get(ch.seatId);
      if (!seat) continue;
      // Find the desk tile(s) the agent faces from their seat
      const dCol =
        seat.facingDir === Direction.RIGHT ? 1 : seat.facingDir === Direction.LEFT ? -1 : 0;
      const dRow = seat.facingDir === Direction.DOWN ? 1 : seat.facingDir === Direction.UP ? -1 : 0;
      // Check tiles in the facing direction (desk could be 1-3 tiles deep)
      for (let d = 1; d <= AUTO_ON_FACING_DEPTH; d++) {
        const tileCol = seat.seatCol + dCol * d;
        const tileRow = seat.seatRow + dRow * d;
        autoOnTiles.add(`${tileCol},${tileRow}`);
      }
      // Also check tiles to the sides of the facing direction (desks can be wide)
      for (let d = 1; d <= AUTO_ON_SIDE_DEPTH; d++) {
        const baseCol = seat.seatCol + dCol * d;
        const baseRow = seat.seatRow + dRow * d;
        if (dCol !== 0) {
          // Facing left/right: check tiles above and below
          autoOnTiles.add(`${baseCol},${baseRow - 1}`);
          autoOnTiles.add(`${baseCol},${baseRow + 1}`);
        } else {
          // Facing up/down: check tiles left and right
          autoOnTiles.add(`${baseCol - 1},${baseRow}`);
          autoOnTiles.add(`${baseCol + 1},${baseRow}`);
        }
      }
    }

    if (autoOnTiles.size === 0) {
      this.furniture = layoutToFurnitureInstances(this.layout.furniture);
      return;
    }

    // Build modified furniture list with auto-state and animation applied
    const animFrame = Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC);
    const modifiedFurniture: PlacedFurniture[] = this.layout.furniture.map((item) => {
      const entry = getCatalogEntry(item.type);
      if (!entry) return item;
      // Check if any tile of this furniture overlaps an auto-on tile
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          if (autoOnTiles.has(`${item.col + dc},${item.row + dr}`)) {
            let onType = getOnStateType(item.type);
            if (onType !== item.type) {
              // Check if the on-state type has animation frames
              const frames = getAnimationFrames(onType);
              if (frames && frames.length > 1) {
                const frameIdx = animFrame % frames.length;
                onType = frames[frameIdx];
              }
              return { ...item, type: onType };
            }
            return item;
          }
        }
      }
      return item;
    });

    this.furniture = layoutToFurnitureInstances(modifiedFurniture);
  }

  setAgentTool(id: number, tool: string | null): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.currentTool = tool;
    }
  }

  showPermissionBubble(id: number): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.bubbleType = 'permission';
      ch.bubbleTimer = 0;
    }
  }

  clearPermissionBubble(id: number): void {
    const ch = this.characters.get(id);
    if (ch && ch.bubbleType === 'permission') {
      ch.bubbleType = null;
      ch.bubbleTimer = 0;
    }
  }

  showWaitingBubble(id: number): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.bubbleType = 'waiting';
      ch.bubbleTimer = WAITING_BUBBLE_DURATION_SEC;
    }
  }

  /** Dismiss bubble on click — permission: instant, waiting: quick fade */
  dismissBubble(id: number): void {
    const ch = this.characters.get(id);
    if (!ch || !ch.bubbleType) return;
    if (ch.bubbleType === 'permission') {
      ch.bubbleType = null;
      ch.bubbleTimer = 0;
    } else if (ch.bubbleType === 'waiting') {
      // Trigger immediate fade (0.3s remaining)
      ch.bubbleTimer = Math.min(ch.bubbleTimer, DISMISS_BUBBLE_FAST_FADE_SEC);
    }
  }

  update(dt: number): void {
    // Furniture animation cycling
    const prevFrame = Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC);
    this.furnitureAnimTimer += dt;
    const newFrame = Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC);
    if (newFrame !== prevFrame) {
      this.rebuildFurnitureInstances();
    }

    const toDelete: number[] = [];
    for (const ch of this.characters.values()) {
      // Handle matrix effect animation
      if (ch.matrixEffect) {
        ch.matrixEffectTimer += dt;
        if (ch.matrixEffectTimer >= MATRIX_EFFECT_DURATION) {
          if (ch.matrixEffect === 'spawn') {
            // Spawn complete — clear effect, resume normal FSM
            ch.matrixEffect = null;
            ch.matrixEffectTimer = 0;
            ch.matrixEffectSeeds = [];
          } else {
            // Despawn complete — mark for deletion
            toDelete.push(ch.id);
          }
        }
        continue; // skip normal FSM while effect is active
      }

      // Temporarily unblock own seat so character can pathfind to it
      this.withOwnSeatUnblocked(ch, () =>
        updateCharacter(ch, dt, this.walkableTiles, this.seats, this.tileMap, this.blockedTiles),
      );

      // Keep seated characters visually anchored to the chair, including fine offset nudges.
      if (ch.state === CharacterState.TYPE && ch.seatId) {
        const seat = this.seats.get(ch.seatId);
        if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
          const center = this.getSeatCenter(seat);
          ch.x = center.x;
          ch.y = center.y;
          ch.dir = seat.facingDir;
        }
      }

      // Tick bubble timer for waiting bubbles
      if (ch.bubbleType === 'waiting') {
        ch.bubbleTimer -= dt;
        if (ch.bubbleTimer <= 0) {
          ch.bubbleType = null;
          ch.bubbleTimer = 0;
        }
      }
    }
    // Remove characters that finished despawn
    for (const id of toDelete) {
      this.characters.delete(id);
    }
  }

  getCharacters(): Character[] {
    return Array.from(this.characters.values());
  }

  /** Get character at pixel position (for hit testing). Returns id or null. */
  getCharacterAt(worldX: number, worldY: number): number | null {
    const chars = this.getCharacters().sort((a, b) => b.y - a.y);
    for (const ch of chars) {
      // Skip characters that are despawning
      if (ch.matrixEffect === 'despawn') continue;
      // Character sprite is 16x24, anchored bottom-center
      // Apply sitting offset to match visual position
      const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
      const anchorY = ch.y + sittingOffset;
      const left = ch.x - CHARACTER_HIT_HALF_WIDTH;
      const right = ch.x + CHARACTER_HIT_HALF_WIDTH;
      const top = anchorY - CHARACTER_HIT_HEIGHT;
      const bottom = anchorY;
      if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
        return ch.id;
      }
    }
    return null;
  }
}
