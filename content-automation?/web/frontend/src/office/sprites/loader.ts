/**
 * 브라우저 Canvas API로 pixel-agents PNG 에셋을 디코딩.
 * shared/assets/pngDecoder.ts의 브라우저 포팅.
 *
 * char_N.png 포맷: 112×96px
 *   - 가로: 7 프레임 × 16px (walk0, walk1, walk2, type0, type1, read0, read1)
 *   - 세로: 3 방향 × 32px  (down, up, right)
 */

import type { SpriteData } from '../types.js';
import { setFloorSprites } from '../floorTiles.js';
import { setCharacterTemplates } from './spriteData.js';

const CHAR_FRAME_W = 16;
const CHAR_FRAME_H = 32;
const CHAR_FRAMES_PER_ROW = 7;
const CHARACTER_DIRECTIONS = ['down', 'up', 'right'] as const;
type CharDir = typeof CHARACTER_DIRECTIONS[number];

export interface CharacterDirectionSprites {
  down: SpriteData[];
  up: SpriteData[];
  right: SpriteData[];
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  if (a < 2) return '';
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

function extractFrame(
  imageData: ImageData,
  frameX: number,
  frameY: number,
  imgWidth: number,
): SpriteData {
  const sprite: string[][] = [];
  for (let y = 0; y < CHAR_FRAME_H; y++) {
    const row: string[] = [];
    for (let x = 0; x < CHAR_FRAME_W; x++) {
      const idx = ((frameY + y) * imgWidth + (frameX + x)) * 4;
      row.push(rgbaToHex(
        imageData.data[idx],
        imageData.data[idx + 1],
        imageData.data[idx + 2],
        imageData.data[idx + 3],
      ));
    }
    sprite.push(row);
  }
  return sprite;
}

async function decodeCharacterPng(src: string): Promise<CharacterDirectionSprites> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  const result: CharacterDirectionSprites = { down: [], up: [], right: [] };

  for (let dirIdx = 0; dirIdx < CHARACTER_DIRECTIONS.length; dirIdx++) {
    const dir: CharDir = CHARACTER_DIRECTIONS[dirIdx];
    const rowY = dirIdx * CHAR_FRAME_H;
    const frames: SpriteData[] = [];
    for (let f = 0; f < CHAR_FRAMES_PER_ROW; f++) {
      frames.push(extractFrame(imageData, f * CHAR_FRAME_W, rowY, img.width));
    }
    result[dir] = frames;
  }

  return result;
}

// ── Floor 타일 ─────────────────────────────────────────────────

const FLOOR_TILE_SIZE = 16;

async function decodeFloorPng(src: string): Promise<SpriteData> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  const sprite: string[][] = [];
  for (let y = 0; y < FLOOR_TILE_SIZE; y++) {
    const row: string[] = [];
    for (let x = 0; x < FLOOR_TILE_SIZE; x++) {
      const idx = (y * img.width + x) * 4;
      row.push(rgbaToHex(
        imageData.data[idx],
        imageData.data[idx + 1],
        imageData.data[idx + 2],
        imageData.data[idx + 3],
      ));
    }
    sprite.push(row);
  }
  return sprite;
}

// ── 전역 캐시 ──────────────────────────────────────────────────

let loadedCharacters: CharacterDirectionSprites[] | null = null;
let loadedFloors: SpriteData[] | null = null;
const loadedFurnitureImages = new Map<string, HTMLImageElement>();

export interface FurniturePlacement {
  type: string;
  col: number;
  row: number;
  mirrored: boolean;
}

export interface LayoutTileColor {
  h: number;
  s: number;
  b: number;
  c: number;
}

// JSON 레이아웃 → 우리 캔버스 row 오프셋
// row 9(원본)에 벽 장식 가구가 있으므로 row 9부터 포함 = 12행
const LAYOUT_ROW_OFFSET = 9;
const LAYOUT_ROWS = 12; // rows 9~20 (22행 중 가시 영역)
const LAYOUT_COLS = 20; // cols 0~19 (col 20은 void)

let layoutFurniture: FurniturePlacement[] = [];
let layoutTiles: number[][] = [];
let layoutTileColors: Array<LayoutTileColor | null>[] = [];

export async function loadAllAssets(basePath: string): Promise<void> {
  // 캐릭터 6종 병렬 로드
  const charPromises = Array.from({ length: 6 }, (_, i) =>
    decodeCharacterPng(`${basePath}/characters/char_${i}.png`),
  );

  // 바닥 타일 병렬 로드 (floor_0 ~ floor_8)
  const floorPromises = Array.from({ length: 9 }, (_, i) =>
    decodeFloorPng(`${basePath}/floors/floor_${i}.png`),
  );

  // 가구 카탈로그 + 레이아웃 JSON 로드
  const [catalogRes, layoutRes] = await Promise.all([
    fetch(`${basePath}/furniture-catalog.json`),
    fetch(`${basePath}/default-layout-1.json`),
  ]);
  const catalog: Array<{ id: string; furniturePath: string }> = await catalogRes.json();
  const layout: {
    cols: number;
    tiles: number[];
    tileColors: Array<LayoutTileColor | null>;
    furniture: Array<{ type: string; col: number; row: number }>;
  } = await layoutRes.json();

  // 레이아웃 tiles/tileColors 저장 (row 오프셋 -9: row 9 벽 장식 포함)
  const rawTiles: number[] = layout.tiles;
  const rawColors: Array<LayoutTileColor | null> = layout.tileColors;
  const fullCols: number = layout.cols; // 21

  layoutTiles = [];
  layoutTileColors = [];
  for (let r = 0; r < LAYOUT_ROWS; r++) {
    const tileRow: number[] = [];
    const colorRow: Array<LayoutTileColor | null> = [];
    for (let c = 0; c < LAYOUT_COLS; c++) {
      const idx = (r + LAYOUT_ROW_OFFSET) * fullCols + c;
      tileRow.push(rawTiles[idx] ?? 255);
      colorRow.push(rawColors[idx] ?? null);
    }
    layoutTiles.push(tileRow);
    layoutTileColors.push(colorRow);
  }

  // 가구 배치 저장 (row 오프셋 -9)
  layoutFurniture = layout.furniture.map((f: { type: string; col: number; row: number }) => {
    const mirrored = f.type.endsWith(':left');
    const baseType = mirrored ? f.type.replace(/:left$/, '') : f.type;
    return { type: baseType, col: f.col, row: f.row - LAYOUT_ROW_OFFSET, mirrored };
  });

  // 가구 PNG를 HTMLImageElement로 로드
  const furniturePromises = catalog.map(async (item) => {
    const img = await loadImage(`${basePath}/${item.furniturePath}`);
    loadedFurnitureImages.set(item.id, img);
  });

  const [chars, floors] = await Promise.all([
    Promise.all(charPromises),
    Promise.all(floorPromises),
    Promise.all(furniturePromises),
  ]);

  loadedCharacters = chars;
  loadedFloors = floors;
  setFloorSprites(floors);
  setCharacterTemplates(chars);
}

export function getLoadedCharacters(): CharacterDirectionSprites[] | null {
  return loadedCharacters;
}

export function getLoadedFloors(): SpriteData[] | null {
  return loadedFloors;
}

export function getFurnitureImage(typeId: string): HTMLImageElement | null {
  return loadedFurnitureImages.get(typeId) ?? null;
}

export function getLayoutFurniture(): FurniturePlacement[] {
  return layoutFurniture;
}

export function getLayoutTiles(): number[][] {
  return layoutTiles;
}

export function getLayoutTileColors(): Array<LayoutTileColor | null>[] {
  return layoutTileColors;
}
