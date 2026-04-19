/**
 * 브라우저에서 /static/assets/ 의 PNG 에셋을 디코딩해서
 * spriteData, floorTiles, wallTiles, furnitureCatalog에 주입한다.
 * VS Code 메시지 시스템 없이 직접 호출.
 */

import { setCharacterTemplates } from './sprites/spriteData.js';
import { setFloorSprites } from './floorTiles.js';
import { setWallSprites } from './wallTiles.js';
import { buildDynamicCatalog } from './layout/furnitureCatalog.js';

// ── 공유 상수 (shared/assets/constants.ts 인라인) ─────────────────
const PNG_ALPHA_THRESHOLD = 2;
const WALL_PIECE_WIDTH = 16;
const WALL_PIECE_HEIGHT = 32;
const WALL_GRID_COLS = 4;
const WALL_BITMASK_COUNT = 16;
const FLOOR_TILE_SIZE = 16;
const CHARACTER_DIRECTIONS = ['down', 'up', 'right'] as const;
const CHAR_FRAME_W = 16;
const CHAR_FRAME_H = 32;
const CHAR_FRAMES_PER_ROW = 7;

type CharDir = typeof CHARACTER_DIRECTIONS[number];

interface CharacterDirectionSprites {
  down: string[][][];
  up: string[][][];
  right: string[][][];
}

interface AssetIndex {
  floors: string[];
  walls: string[];
  characters: string[];
  defaultLayout: string | null;
}

interface CatalogEntry {
  id: string;
  label: string;
  category: string;
  furniturePath: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  canPlaceOnWalls: boolean;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
  groupId?: string;
  orientation?: string;
  state?: string;
  mirrorSide?: boolean;
  rotationScheme?: string;
  animationGroup?: string;
  frame?: number;
}

// ── PNG 디코딩 헬퍼 ──────────────────────────────────────────────

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  if (a < PNG_ALPHA_THRESHOLD) return '';
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface DecodedPng {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number): [number, number, number, number] {
  const idx = (y * width + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

function readSprite(png: DecodedPng, w: number, h: number, ox = 0, oy = 0): string[][] {
  const sprite: string[][] = [];
  for (let y = 0; y < h; y++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = getPixel(png.data, png.width, ox + x, oy + y);
      row.push(rgbaToHex(r, g, b, a));
    }
    sprite.push(row);
  }
  return sprite;
}

async function decodePng(url: string): Promise<DecodedPng> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PNG: ${url} (${res.status})`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: imageData.data };
}

// ── 에셋별 디코드 ────────────────────────────────────────────────

async function decodeCharacters(base: string, index: AssetIndex): Promise<CharacterDirectionSprites[]> {
  const sprites: CharacterDirectionSprites[] = [];
  for (const relPath of index.characters) {
    const path = relPath.startsWith('characters/') ? relPath : `characters/${relPath}`;
    const png = await decodePng(`${base}assets/${path}`);
    const byDir: CharacterDirectionSprites = { down: [], up: [], right: [] };
    for (let dirIdx = 0; dirIdx < CHARACTER_DIRECTIONS.length; dirIdx++) {
      const dir: CharDir = CHARACTER_DIRECTIONS[dirIdx];
      const rowOffsetY = dirIdx * CHAR_FRAME_H;
      const frames: string[][][] = [];
      for (let frame = 0; frame < CHAR_FRAMES_PER_ROW; frame++) {
        frames.push(readSprite(png, CHAR_FRAME_W, CHAR_FRAME_H, frame * CHAR_FRAME_W, rowOffsetY));
      }
      byDir[dir] = frames;
    }
    sprites.push(byDir);
  }
  return sprites;
}

async function decodeFloors(base: string, index: AssetIndex): Promise<string[][][]> {
  const floors: string[][][] = [];
  for (const relPath of index.floors) {
    const path = relPath.startsWith('floors/') ? relPath : `floors/${relPath}`;
    const png = await decodePng(`${base}assets/${path}`);
    floors.push(readSprite(png, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE));
  }
  return floors;
}

async function decodeWalls(base: string, index: AssetIndex): Promise<string[][][][]> {
  const wallSets: string[][][][] = [];
  for (const relPath of index.walls) {
    const path = relPath.startsWith('walls/') ? relPath : `walls/${relPath}`;
    const png = await decodePng(`${base}assets/${path}`);
    const set: string[][][] = [];
    for (let mask = 0; mask < WALL_BITMASK_COUNT; mask++) {
      const ox = (mask % WALL_GRID_COLS) * WALL_PIECE_WIDTH;
      const oy = Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_HEIGHT;
      set.push(readSprite(png, WALL_PIECE_WIDTH, WALL_PIECE_HEIGHT, ox, oy));
    }
    wallSets.push(set);
  }
  return wallSets;
}

async function decodeFurniture(base: string, catalog: CatalogEntry[]): Promise<Record<string, string[][]>> {
  const sprites: Record<string, string[][]> = {};
  for (const entry of catalog) {
    const png = await decodePng(`${base}assets/${entry.furniturePath}`);
    sprites[entry.id] = readSprite(png, entry.width, entry.height);
  }
  return sprites;
}

// ── 공개 API ─────────────────────────────────────────────────────

let loaded = false;
let cachedLayout: unknown = null;

export async function loadAssets(basePath: string): Promise<unknown> {
  if (loaded) return cachedLayout;
  loaded = true;

  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;

  const [assetIndex, catalog] = await Promise.all([
    fetch(`${base}assets/asset-index.json`).then((r) => r.json()) as Promise<AssetIndex>,
    fetch(`${base}assets/furniture-catalog.json`).then((r) => r.json()) as Promise<CatalogEntry[]>,
  ]);

  const [characters, floorSprites, wallSets, furnitureSprites] = await Promise.all([
    decodeCharacters(base, assetIndex),
    decodeFloors(base, assetIndex),
    decodeWalls(base, assetIndex),
    decodeFurniture(base, catalog),
  ]);

  setCharacterTemplates(characters);
  setFloorSprites(floorSprites);
  setWallSprites(wallSets);
  buildDynamicCatalog({ catalog, sprites: furnitureSprites });

  const layoutPath = assetIndex.defaultLayout
    ? `${base}assets/${assetIndex.defaultLayout}`
    : `${base}assets/default-layout-1.json`;
  const layout = await fetch(layoutPath).then((r) => r.json());

  console.log(`[AssetLoader] 완료: ${characters.length}명, ${floorSprites.length}개 바닥, ${wallSets.length}개 벽, ${catalog.length}개 가구`);

  cachedLayout = layout;
  return layout;
}
