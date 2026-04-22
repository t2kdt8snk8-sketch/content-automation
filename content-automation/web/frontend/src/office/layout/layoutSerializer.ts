import type { ColorValue } from '../../components/ui/types.js';
import { getColorizedSprite } from '../colorize.js';
import type {
  FurnitureCatalogEntry,
  FurnitureInstance,
  OfficeLayout,
  PlacedFurniture,
  Seat,
  TileType as TileTypeVal,
} from '../types.js';
import { DEFAULT_COLS, DEFAULT_ROWS, Direction, TILE_SIZE, TileType } from '../types.js';
import { getCatalogEntry, getOrientationInGroup } from './furnitureCatalog.js';

function getScaledFootprintSize(
  entry: FurnitureCatalogEntry,
  scaleXPct?: number,
  scaleYPct?: number,
  scalePct?: number,
): { footprintW: number; footprintH: number } {
  const scaleX = (scaleXPct ?? scalePct ?? 100) / 100;
  const scaleY = (scaleYPct ?? scalePct ?? 100) / 100;
  return {
    footprintW: Math.max(1, Math.ceil(entry.footprintW * scaleX)),
    footprintH: Math.max(1, Math.ceil(entry.footprintH * scaleY)),
  };
}

export function getScalePercents(
  item: Pick<PlacedFurniture, 'scalePct' | 'scaleXPct' | 'scaleYPct'>,
): { scaleXPct: number; scaleYPct: number } {
  return {
    scaleXPct: item.scaleXPct ?? item.scalePct ?? 100,
    scaleYPct: item.scaleYPct ?? item.scalePct ?? 100,
  };
}

export function getFootprintForItem(
  item: Pick<PlacedFurniture, 'scalePct' | 'scaleXPct' | 'scaleYPct'>,
  entry: FurnitureCatalogEntry,
): { footprintW: number; footprintH: number } {
  const { scaleXPct, scaleYPct } = getScalePercents(item);
  return getScaledFootprintSize(entry, scaleXPct, scaleYPct, item.scalePct);
}

/** Convert flat tile array from layout into 2D grid */
export function layoutToTileMap(layout: OfficeLayout): TileTypeVal[][] {
  const map: TileTypeVal[][] = [];
  for (let r = 0; r < layout.rows; r++) {
    const row: TileTypeVal[] = [];
    for (let c = 0; c < layout.cols; c++) {
      row.push(layout.tiles[r * layout.cols + c]);
    }
    map.push(row);
  }
  return map;
}

/** Convert placed furniture into renderable FurnitureInstance[] */
export function layoutToFurnitureInstances(furniture: PlacedFurniture[]): FurnitureInstance[] {
  // Pre-compute desk zY per tile so surface items can sort in front of desks
  const deskZByTile = new Map<string, number>();
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry || !entry.isDesk) continue;
    const deskZY = item.row * TILE_SIZE + entry.sprite.length;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`;
        const prev = deskZByTile.get(key);
        if (prev === undefined || deskZY > prev) deskZByTile.set(key, deskZY);
      }
    }
  }

  const instances: FurnitureInstance[] = [];
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    const { scaleXPct, scaleYPct } = getScalePercents(item);
    const scaleX = scaleXPct / 100;
    const scaleY = scaleYPct / 100;
    const offsetX = item.offsetX || 0;
    const offsetY = item.offsetY || 0;
    const x = item.col * TILE_SIZE + offsetX;
    const y = item.row * TILE_SIZE + offsetY;
    let zY = item.row * TILE_SIZE + entry.sprite.length;

    // Chair z-sorting: ensure characters sitting on chairs render correctly
    if (entry.category === 'chairs') {
      if (entry.orientation === 'back') {
        // Back-facing chairs render IN FRONT of the seated character
        // (the chair back visually occludes the character behind it).
        // Use the bottom footprint row so it sorts after the character
        // even when the chair has background tiles that push seats down.
        zY = (item.row + entry.footprintH) * TILE_SIZE + 1;
      } else {
        // All other chairs: cap zY to first row bottom so characters
        // at any seat tile render in front of the chair
        zY = (item.row + 1) * TILE_SIZE;
      }
    }

    // Surface items render in front of the desk they sit on
    if (entry.canPlaceOnSurfaces) {
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          const deskZ = deskZByTile.get(`${item.col + dc},${item.row + dr}`);
          if (deskZ !== undefined && deskZ + 0.5 > zY) zY = deskZ + 0.5;
        }
      }
    }

    // Colorize sprite if this furniture has a color override
    let sprite = entry.sprite;
    if (item.color) {
      const { h, s, b: bv, c: cv } = item.color;
      sprite = getColorizedSprite(
        `furn-${item.type}-${h}-${s}-${bv}-${cv}-${item.color.colorize ? 1 : 0}`,
        entry.sprite,
        item.color,
      );
    }

    // Determine if this instance should be mirrored (side asset used in "left" orientation)
    let mirrored = false;
    if (entry.mirrorSide) {
      const orientInGroup = getOrientationInGroup(item.type);
      if (orientInGroup === 'left') {
        mirrored = true;
      }
    }

    instances.push({ sprite, x, y, scaleX, scaleY, zY, ...(mirrored ? { mirrored: true } : {}) });
  }
  return instances;
}

/** Get all tiles blocked by furniture footprints, optionally excluding a set of tiles.
 *  Skips top backgroundTiles rows so characters can walk through them. */
export function getBlockedTiles(
  furniture: PlacedFurniture[],
  excludeTiles?: Set<string>,
): Set<string> {
  const tiles = new Set<string>();
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    const bgRows = entry.backgroundTiles || 0;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < bgRows) continue; // skip background rows — characters can walk through
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`;
        if (excludeTiles && excludeTiles.has(key)) continue;
        tiles.add(key);
      }
    }
  }
  return tiles;
}

function isConservativePlacement(entry: FurnitureCatalogEntry): boolean {
  return entry.isDesk || entry.category === 'chairs' || entry.category === 'storage';
}

function getPlacementInsets(footprintW: number, footprintH: number): { insetX: number; insetY: number } {
  // Keep conservative categories fully blocked regardless of scale.
  // entry thresholds mapped to effective footprint size.
  // (desks/chairs/storage are handled by caller through no-inset policy.)
  const insetX = footprintW >= 5 ? 2 : footprintW >= 3 ? 1 : 0;
  const insetY = footprintH >= 5 ? 2 : footprintH >= 3 ? 1 : 0;
  return { insetX, insetY };
}

function getItemPlacementInsets(
  entry: FurnitureCatalogEntry,
  footprintW: number,
  footprintH: number,
): { insetX: number; insetY: number } {
  if (isConservativePlacement(entry)) return { insetX: 0, insetY: 0 };
  return getPlacementInsets(footprintW, footprintH);
}

/** Placement-only collision tiles.
 *  Keeps desks/chairs/storage conservative, while easing decor/wall/electronics overlap pressure. */
export function getPlacementTiles(item: PlacedFurniture, entry: FurnitureCatalogEntry): Set<string> {
  const tiles = new Set<string>();
  const { footprintW, footprintH } = getFootprintForItem(item, entry);
  const bgRows = entry.backgroundTiles || 0;
  const { insetX, insetY } = getItemPlacementInsets(entry, footprintW, footprintH);

  let dcStart = insetX;
  let dcEnd = footprintW - 1 - insetX;
  if (dcStart > dcEnd) {
    const center = Math.floor((footprintW - 1) / 2);
    dcStart = center;
    dcEnd = center;
  }

  let drStart = Math.max(bgRows, insetY);
  let drEnd = footprintH - 1 - insetY;
  if (drStart > drEnd) {
    const center = Math.min(footprintH - 1, Math.max(bgRows, Math.floor((footprintH - 1) / 2)));
    drStart = center;
    drEnd = center;
  }

  for (let dr = drStart; dr <= drEnd; dr++) {
    for (let dc = dcStart; dc <= dcEnd; dc++) {
      tiles.add(`${item.col + dc},${item.row + dr}`);
    }
  }
  return tiles;
}

/** Get tiles blocked for placement purposes — skips top backgroundTiles rows per item */
export function getPlacementBlockedTiles(
  furniture: PlacedFurniture[],
  excludeUid?: string,
): Set<string> {
  const tiles = new Set<string>();
  for (const item of furniture) {
    if (item.uid === excludeUid) continue;
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    const placementTiles = getPlacementTiles(item, entry);
    for (const t of placementTiles) {
      tiles.add(t);
    }
  }
  return tiles;
}

/** Map chair orientation to character facing direction */
function orientationToFacing(orientation: string): Direction {
  switch (orientation) {
    case 'front':
      return Direction.DOWN;
    case 'back':
      return Direction.UP;
    case 'left':
      return Direction.LEFT;
    case 'right':
    case 'side':
      return Direction.RIGHT;
    default:
      return Direction.DOWN;
  }
}

function inferFacingFromType(type: string): Direction | null {
  const upper = type.toUpperCase();
  if (upper.includes('BACK')) return Direction.UP;
  if (upper.includes('FRONT')) return Direction.DOWN;
  if (upper.includes('LEFT')) return Direction.LEFT;
  if (upper.includes('RIGHT') || upper.includes('SIDE') || upper.includes('REVERSED')) {
    return Direction.RIGHT;
  }
  return null;
}

function inferFacingFromAdjacentDesks(
  item: PlacedFurniture,
  entry: { footprintW: number; footprintH: number; backgroundTiles?: number },
  deskTiles: Set<string>,
): Direction | null {
  const startCol = item.col;
  const endCol = item.col + entry.footprintW - 1;
  const startRow = item.row + (entry.backgroundTiles ?? 0);
  const endRow = item.row + entry.footprintH - 1;

  const scores: Array<{ dir: Direction; score: number }> = [
    { dir: Direction.UP, score: 0 },
    { dir: Direction.DOWN, score: 0 },
    { dir: Direction.LEFT, score: 0 },
    { dir: Direction.RIGHT, score: 0 },
  ];

  for (let c = startCol; c <= endCol; c++) {
    if (deskTiles.has(`${c},${startRow - 1}`)) scores[0].score++;
    if (deskTiles.has(`${c},${endRow + 1}`)) scores[1].score++;
  }
  for (let r = startRow; r <= endRow; r++) {
    if (deskTiles.has(`${startCol - 1},${r}`)) scores[2].score++;
    if (deskTiles.has(`${endCol + 1},${r}`)) scores[3].score++;
  }

  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 0 ? scores[0].dir : null;
}

/** Generate seats from chair furniture.
 *  Facing priority: 1) chair orientation, 2) adjacent desk, 3) forward (DOWN). */
export function layoutToSeats(furniture: PlacedFurniture[]): Map<string, Seat> {
  const seats = new Map<string, Seat>();

  // Build set of all desk tiles
  const deskTiles = new Set<string>();
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry || !entry.isDesk) continue;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        deskTiles.add(`${item.col + dc},${item.row + dr}`);
      }
    }
  }

  // Generate exactly one seat per chair for stable facing/placement.
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry || entry.category !== 'chairs') continue;
    const bgRows = entry.backgroundTiles ?? 0;

    const seatAreaRows = Math.max(1, entry.footprintH - bgRows);
    const baseSeatCol = item.col;
    const baseSeatRow = item.row + bgRows;
    const centerOffsetX = ((entry.footprintW - 1) * TILE_SIZE) / 2;
    const centerOffsetY = ((seatAreaRows - 1) * TILE_SIZE) / 2;

    // Determine facing direction:
    // 1) Adjacent desk side with strongest overlap
    // 2) Chair orientation metadata
    // 3) Type-name hint
    // 4) Default DOWN
    let facingDir: Direction = Direction.DOWN;
    const deskFacing = inferFacingFromAdjacentDesks(item, entry, deskTiles);
    const orientationFacing = entry.orientation ? orientationToFacing(entry.orientation) : null;
    const typeFacing = inferFacingFromType(item.type);
    facingDir = deskFacing ?? orientationFacing ?? typeFacing ?? Direction.DOWN;

    seats.set(item.uid, {
      uid: item.uid,
      seatCol: baseSeatCol,
      seatRow: baseSeatRow,
      seatOffsetX: (item.offsetX || 0) + centerOffsetX,
      seatOffsetY: (item.offsetY || 0) + centerOffsetY,
      facingDir,
      assigned: false,
    });
  }

  return seats;
}

/** Get the set of tiles occupied by seats (so they can be excluded from blocked tiles)
 * @internal */
export function getSeatTiles(seats: Map<string, Seat>): Set<string> {
  const tiles = new Set<string>();
  for (const seat of seats.values()) {
    tiles.add(`${seat.seatCol},${seat.seatRow}`);
  }
  return tiles;
}

/** Default floor colors for the two rooms */
const DEFAULT_LEFT_ROOM_COLOR: ColorValue = { h: 35, s: 30, b: 15, c: 0 }; // warm beige
const DEFAULT_RIGHT_ROOM_COLOR: ColorValue = { h: 25, s: 45, b: 5, c: 10 }; // warm brown

/** Create a minimal fallback layout (used only when no default-layout.json exists) */
export function createDefaultLayout(): OfficeLayout {
  const W = TileType.WALL;
  const F1 = TileType.FLOOR_1;
  const F2 = TileType.FLOOR_2;

  const tiles: TileTypeVal[] = [];
  const tileColors: Array<ColorValue | null> = [];

  for (let r = 0; r < DEFAULT_ROWS; r++) {
    for (let c = 0; c < DEFAULT_COLS; c++) {
      if (r === 0 || r === DEFAULT_ROWS - 1 || c === 0 || c === DEFAULT_COLS - 1) {
        tiles.push(W);
        tileColors.push(null);
      } else if (c < 10) {
        tiles.push(F1);
        tileColors.push(DEFAULT_LEFT_ROOM_COLOR);
      } else {
        tiles.push(F2);
        tileColors.push(DEFAULT_RIGHT_ROOM_COLOR);
      }
    }
  }

  // Minimal fallback with no furniture — the default-layout.json provides the real default
  return { version: 1, cols: DEFAULT_COLS, rows: DEFAULT_ROWS, tiles, tileColors, furniture: [] };
}

/** Serialize layout to JSON string
 * @internal */
export function serializeLayout(layout: OfficeLayout): string {
  return JSON.stringify(layout);
}

// ── Furniture type migration ────────────────────────────────────

/** Map old hardcoded FurnitureType values to new manifest-based IDs */
const LEGACY_TYPE_MAP: Record<string, string | null> = {
  desk: 'DESK_FRONT',
  chair: 'WOODEN_CHAIR_FRONT',
  bookshelf: 'BOOKSHELF',
  plant: 'PLANT',
  cooler: null, // no equivalent in new assets — remove
  whiteboard: 'WHITEBOARD',
  pc: 'PC_FRONT_OFF',
  lamp: null, // no equivalent in new assets — remove
};

/** Migrate old furniture type strings to new manifest IDs */
function migrateFurnitureTypes(furniture: PlacedFurniture[]): PlacedFurniture[] {
  const migrated: PlacedFurniture[] = [];
  for (const item of furniture) {
    const newType = LEGACY_TYPE_MAP[item.type];
    if (newType === undefined) {
      // Not a legacy type — keep as-is
      migrated.push(item);
    } else if (newType !== null) {
      // Migrate to new type
      migrated.push({ ...item, type: newType });
    }
    // newType === null → remove the item (no equivalent)
  }
  return migrated;
}

/** Deserialize layout from JSON string, migrating old tile types if needed
 * @internal */
export function deserializeLayout(json: string): OfficeLayout | null {
  try {
    const obj = JSON.parse(json);
    if (obj && obj.version === 1 && Array.isArray(obj.tiles) && Array.isArray(obj.furniture)) {
      return migrateLayout(obj as OfficeLayout);
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}

/**
 * Ensure layout has tileColors. If missing, generate defaults based on tile types.
 * Exported for use by message handlers that receive layouts over the wire.
 */
export function migrateLayoutColors(layout: OfficeLayout): OfficeLayout {
  return migrateLayout(layout);
}

/**
 * Migrate old layouts that use legacy tile types (TILE_FLOOR=1, WOOD_FLOOR=2, CARPET=3, DOORWAY=4)
 * to the new pattern-based system. Also migrates old furniture type strings and old VOID value.
 */
function migrateLayout(layout: OfficeLayout): OfficeLayout {
  // Migrate furniture types
  layout = { ...layout, furniture: migrateFurnitureTypes(layout.furniture) };

  // Migrate old VOID value (was 8, now 255) — only for legacy layouts since FLOOR_8 reuses value 8
  const OLD_VOID = 8;
  if (!layout.layoutRevision && layout.tiles.includes(OLD_VOID as TileTypeVal)) {
    layout = {
      ...layout,
      tiles: layout.tiles.map((t) => (t === OLD_VOID ? (TileType.VOID as TileTypeVal) : t)),
    };
  }

  if (layout.tileColors && layout.tileColors.length === layout.tiles.length) {
    return layout; // Already migrated tile colors
  }

  // Check if any tiles use old values (1-4) — these map directly to FLOOR_1-4
  // but need color assignments
  const tileColors: Array<ColorValue | null> = [];
  for (const tile of layout.tiles) {
    switch (tile) {
      case 0: // WALL
        tileColors.push(null);
        break;
      case 1: // was TILE_FLOOR → FLOOR_1 beige
        tileColors.push(DEFAULT_LEFT_ROOM_COLOR);
        break;
      case 2: // was WOOD_FLOOR → FLOOR_2 brown
        tileColors.push(DEFAULT_RIGHT_ROOM_COLOR);
        break;
      case 3: // was CARPET → FLOOR_3 purple
        tileColors.push({ h: 280, s: 40, b: -5, c: 0 });
        break;
      case 4: // was DOORWAY → FLOOR_4 tan
        tileColors.push({ h: 35, s: 25, b: 10, c: 0 });
        break;
      default:
        // Floor tile types without colors — use neutral gray
        tileColors.push(tile > 0 && tile !== TileType.VOID ? { h: 0, s: 0, b: 0, c: 0 } : null);
    }
  }

  return { ...layout, tileColors };
}
