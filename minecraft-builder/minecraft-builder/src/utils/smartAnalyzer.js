/**
 * Smart Analyzer v2 — Building-aware Minecraft block converter
 *
 * Key improvements over v1:
 *   1. Flood-fill background removal (sky, clouds → air)
 *   2. Material-based block matching (not just color)
 *   3. 3D blueprint generation (front + side + top views)
 */

import BLOCKS from '../data/minecraftBlocks.js';
import { findClosestBlock } from './colorMatcher.js';

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════

const AIR = { id: 'air', name: 'Air', nameKo: '공기', category: 'air', rgb: [0, 0, 0], hex: '#000000' };
const FLOOD_FILL_TOLERANCE = 42; // Color distance threshold for flood-fill
const DEPTH_RATIO = 0.5; // Estimated depth = width × this ratio

// Pre-index blocks
const blockById = new Map(BLOCKS.map(b => [b.id, b]));

// ═══════════════════════════════════════════════════════════════
//  COLOR HELPERS
// ═══════════════════════════════════════════════════════════════

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s * 100, v * 100];
}

function colorDist(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function lum(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ═══════════════════════════════════════════════════════════════
//  STEP 1: EXTRACT COLOR GRID
// ═══════════════════════════════════════════════════════════════

function extractColorGrid(imageData, imgW, imgH, gridW, gridH) {
    const px = imageData.data;
    const cellW = imgW / gridW, cellH = imgH / gridH;
    const grid = [];

    for (let gy = 0; gy < gridH; gy++) {
        const row = [];
        for (let gx = 0; gx < gridW; gx++) {
            const x0 = Math.floor(gx * cellW), y0 = Math.floor(gy * cellH);
            const x1 = Math.floor((gx + 1) * cellW), y1 = Math.floor((gy + 1) * cellH);
            let rS = 0, gS = 0, bS = 0, n = 0;
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const i = (y * imgW + x) * 4;
                    rS += px[i]; gS += px[i + 1]; bS += px[i + 2]; n++;
                }
            }
            row.push([Math.round(rS / n), Math.round(gS / n), Math.round(bS / n)]);
        }
        grid.push(row);
    }
    return grid;
}

// ═══════════════════════════════════════════════════════════════
//  STEP 2: FLOOD-FILL BACKGROUND REMOVAL
// ═══════════════════════════════════════════════════════════════

/**
 * Flood-fill from image edges to find background (sky, open space).
 * Returns a boolean grid: true = background (→ air), false = building
 */
function detectBackground(colorGrid, gridW, gridH) {
    const bg = Array.from({ length: gridH }, () => new Array(gridW).fill(false));
    const visited = Array.from({ length: gridH }, () => new Array(gridW).fill(false));

    // Seed points: all cells on the top row + sides of top 40%
    const seeds = [];
    for (let x = 0; x < gridW; x++) seeds.push([0, x]); // top row
    for (let y = 1; y < Math.floor(gridH * 0.5); y++) {
        seeds.push([y, 0]);           // left edge
        seeds.push([y, gridW - 1]);   // right edge
    }

    // BFS flood-fill
    const queue = [];
    for (const [sy, sx] of seeds) {
        if (!visited[sy][sx]) {
            visited[sy][sx] = true;
            bg[sy][sx] = true;
            queue.push([sy, sx]);
        }
    }

    while (queue.length > 0) {
        const [cy, cx] = queue.shift();
        const [cr, cg, cb] = colorGrid[cy][cx];

        const neighbors = [[cy - 1, cx], [cy + 1, cx], [cy, cx - 1], [cy, cx + 1]];
        for (const [ny, nx] of neighbors) {
            if (ny < 0 || ny >= gridH || nx < 0 || nx >= gridW) continue;
            if (visited[ny][nx]) continue;

            const [nr, ng, nb] = colorGrid[ny][nx];
            const dist = colorDist(cr, cg, cb, nr, ng, nb);

            // Also check if this neighbor is "sky-like"
            const [h, s, v] = rgbToHsv(nr, ng, nb);
            const isSkyBlue = h >= 180 && h <= 260 && s > 10 && v > 35;
            const isBrightGray = s < 12 && v > 70; // Overcast sky / clouds
            const isSkyLike = isSkyBlue || isBrightGray;

            if (dist < FLOOD_FILL_TOLERANCE || (isSkyLike && dist < FLOOD_FILL_TOLERANCE * 1.5)) {
                visited[ny][nx] = true;
                bg[ny][nx] = true;
                queue.push([ny, nx]);
            }
        }
    }

    // Clean up: remove small isolated foreground patches inside background
    // (noise in the sky area)
    cleanSmallIslands(bg, gridW, gridH, false, 4);

    return bg;
}

/**
 * Remove small isolated islands of 'targetVal' smaller than minSize
 */
function cleanSmallIslands(grid, w, h, targetVal, minSize) {
    const visited = Array.from({ length: h }, () => new Array(w).fill(false));

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (visited[y][x] || grid[y][x] !== targetVal) continue;

            // BFS to find connected component
            const component = [];
            const q = [[y, x]];
            visited[y][x] = true;
            while (q.length > 0) {
                const [cy, cx] = q.shift();
                component.push([cy, cx]);
                for (const [ny, nx] of [[cy - 1, cx], [cy + 1, cx], [cy, cx - 1], [cy, cx + 1]]) {
                    if (ny >= 0 && ny < h && nx >= 0 && nx < w && !visited[ny][nx] && grid[ny][nx] === targetVal) {
                        visited[ny][nx] = true;
                        q.push([ny, nx]);
                    }
                }
            }

            // If too small, flip to opposite value
            if (component.length < minSize) {
                for (const [py, px] of component) grid[py][px] = !targetVal;
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  STEP 3: EDGE DENSITY MAP (texture analysis)
// ═══════════════════════════════════════════════════════════════

function computeEdgeMap(imageData, imgW, imgH, gridW, gridH) {
    const px = imageData.data;
    const cellW = imgW / gridW, cellH = imgH / gridH;
    const map = [];

    for (let gy = 0; gy < gridH; gy++) {
        const row = [];
        for (let gx = 0; gx < gridW; gx++) {
            const x0 = Math.floor(gx * cellW) + 1;
            const y0 = Math.floor(gy * cellH) + 1;
            const x1 = Math.min(Math.floor((gx + 1) * cellW), imgW - 2);
            const y1 = Math.min(Math.floor((gy + 1) * cellH), imgH - 2);

            let edgeSum = 0, n = 0;
            const step = Math.max(1, Math.floor((x1 - x0) / 6));
            for (let y = y0; y < y1; y += step) {
                for (let x = x0; x < x1; x += step) {
                    const i = (y * imgW + x) * 4;
                    const l = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
                    const iL = (y * imgW + x - 1) * 4, iR = (y * imgW + x + 1) * 4;
                    const iU = ((y - 1) * imgW + x) * 4, iD = ((y + 1) * imgW + x) * 4;
                    const lL = px[iL] * 0.299 + px[iL + 1] * 0.587 + px[iL + 2] * 0.114;
                    const lR = px[iR] * 0.299 + px[iR + 1] * 0.587 + px[iR + 2] * 0.114;
                    const lU = px[iU] * 0.299 + px[iU + 1] * 0.587 + px[iU + 2] * 0.114;
                    const lD = px[iD] * 0.299 + px[iD + 1] * 0.587 + px[iD + 2] * 0.114;
                    edgeSum += Math.sqrt((lR - lL) ** 2 + (lD - lU) ** 2);
                    n++;
                }
            }
            row.push(n > 0 ? Math.min(1, edgeSum / n / 80) : 0);
        }
        map.push(row);
    }
    return map;
}

// ═══════════════════════════════════════════════════════════════
//  STEP 4: MATERIAL CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

/** Material block pools */
const MAT_BLOCKS = {
    brick: ['bricks', 'red_terracotta', 'orange_terracotta', 'granite'],
    stone: ['stone_bricks', 'cobblestone', 'andesite', 'stone', 'tuff'],
    concrete: ['smooth_stone', 'light_gray_concrete', 'white_concrete', 'polished_diorite', 'calcite'],
    wood: ['oak_planks', 'spruce_planks', 'dark_oak_planks', 'jungle_planks', 'oak_log', 'stripped_oak_log'],
    glass: ['glass', 'light_blue_stained_glass', 'cyan_stained_glass', 'gray_stained_glass'],
    roof_dark: ['deepslate_tiles', 'deepslate_bricks', 'gray_concrete', 'polished_blackstone_bricks'],
    roof_tile: ['bricks', 'red_terracotta', 'brown_terracotta'],
    metal: ['iron_block', 'light_gray_concrete'],
    door: ['dark_oak_planks', 'spruce_planks'],
    ground: ['dirt', 'gravel', 'cobblestone', 'stone'],
    grass: ['grass_block', 'moss_block'],
    leaves: ['oak_leaves', 'spruce_leaves'],
    white: ['white_concrete', 'smooth_quartz', 'quartz_block', 'snow_block', 'white_wool'],
    dark: ['black_concrete', 'obsidian', 'black_wool', 'deepslate'],
};

function classifyCell(r, g, b, yRatio, edgeDensity, bgGrid, x, y, colorGrid, gridW, gridH) {
    // Already marked as background
    if (bgGrid[y][x]) return 'air';

    const [h, s, v] = rgbToHsv(r, g, b);
    const l = lum(r, g, b);

    // ── Window detection ──
    // Dark/reflective patches surrounded by brighter wall pixels
    if (yRatio > 0.1 && yRatio < 0.8) {
        const avgNeighborLum = getNeighborAvgLum(colorGrid, x, y, gridW, gridH, bgGrid);
        if (avgNeighborLum !== null && avgNeighborLum - l > 35 && l < 120) {
            return 'glass';
        }
        // Bluish reflective window
        if (h >= 180 && h <= 250 && s > 10 && s < 55 && v > 25 && v < 75
            && avgNeighborLum !== null && avgNeighborLum - l > 20) {
            return 'glass';
        }
    }

    // ── Roof ── (upper portion, not background)
    if (yRatio < 0.35) {
        if (s < 20 && v < 45) return 'roof_dark';
        if (h >= 0 && h <= 30 && s > 20) return 'roof_tile';
        if (l < 80) return 'roof_dark';
    }

    // ── Brick ── red-brown + textured
    if (h >= 0 && h <= 40 && s > 25 && v > 20 && v < 85 && edgeDensity > 0.12) {
        return 'brick';
    }

    // ── Wood ── warm brown
    if (h >= 15 && h <= 50 && s > 18 && v > 15 && v < 70) {
        return 'wood';
    }

    // ── Stone ── low saturation, textured
    if (s < 18 && v > 20 && v < 75 && edgeDensity > 0.15) {
        return 'stone';
    }

    // ── Concrete ── low saturation, smooth
    if (s < 18 && v > 30 && v < 85 && edgeDensity < 0.15) {
        return 'concrete';
    }

    // ── White surfaces ──
    if (l > 200 && s < 15) return 'white';

    // ── Dark surfaces ──
    if (l < 35) return 'dark';

    // ── Vegetation ──
    if (s > 18 && h >= 60 && h <= 170) {
        if (yRatio > 0.8) return 'grass';
        return 'leaves';
    }

    // ── Ground ──
    if (yRatio > 0.85 && s > 10 && h >= 15 && h <= 50) {
        return 'ground';
    }

    // Fallback: pick by color
    return 'fallback';
}

function getNeighborAvgLum(colorGrid, x, y, w, h, bgGrid) {
    let sum = 0, n = 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && !bgGrid[ny][nx]) {
            const [r, g, b] = colorGrid[ny][nx];
            sum += lum(r, g, b);
            n++;
        }
    }
    return n > 0 ? sum / n : null;
}

/**
 * Pick the best block from a material pool, matching original color
 */
function pickFromPool(material, r, g, b) {
    if (material === 'air') return AIR;
    if (material === 'fallback') return findClosestBlock(r, g, b).block;

    const pool = MAT_BLOCKS[material];
    if (!pool) return findClosestBlock(r, g, b).block;

    let best = null, bestD = Infinity;
    for (const id of pool) {
        const blk = blockById.get(id);
        if (!blk) continue;
        const d = colorDist(r, g, b, blk.rgb[0], blk.rgb[1], blk.rgb[2]);
        if (d < bestD) { bestD = d; best = blk; }
    }
    return best || findClosestBlock(r, g, b).block;
}

// ═══════════════════════════════════════════════════════════════
//  STEP 5: POST-PROCESS — WINDOW CLUSTER REFINEMENT
// ═══════════════════════════════════════════════════════════════

function refineWindows(matGrid, w, h) {
    const out = matGrid.map(r => [...r]);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (out[y][x] !== 'glass') continue;
            // Count glass neighbors
            let gn = 0;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nx2 = x + dx, ny2 = y + dy;
                if (nx2 >= 0 && nx2 < w && ny2 >= 0 && ny2 < h && matGrid[ny2][nx2] === 'glass') gn++;
            }
            // Isolated glass pixel → revert
            if (gn === 0) out[y][x] = 'fallback';
        }
    }
    return out;
}

// ═══════════════════════════════════════════════════════════════
//  STEP 6: BUILD FRONT VIEW
// ═══════════════════════════════════════════════════════════════

function buildFrontView(colorGrid, bgGrid, edgeMap, gridW, gridH) {
    // Classify materials
    let matGrid = [];
    for (let y = 0; y < gridH; y++) {
        const row = [];
        for (let x = 0; x < gridW; x++) {
            const [r, g, b] = colorGrid[y][x];
            row.push(classifyCell(r, g, b, y / gridH, edgeMap[y][x], bgGrid, x, y, colorGrid, gridW, gridH));
        }
        matGrid.push(row);
    }

    // Refine windows
    matGrid = refineWindows(matGrid, gridW, gridH);

    // Convert to blocks
    const grid = [];
    const paletteMap = new Map();

    for (let y = 0; y < gridH; y++) {
        const row = [];
        for (let x = 0; x < gridW; x++) {
            const [r, g, b] = colorGrid[y][x];
            const mat = matGrid[y][x];
            const block = pickFromPool(mat, r, g, b);
            row.push({ ...block, material: mat });

            if (block.id !== 'air') {
                const e = paletteMap.get(block.id) || { block, count: 0 };
                e.count++;
                paletteMap.set(block.id, e);
            }
        }
        grid.push(row);
    }

    return { grid, matGrid, palette: [...paletteMap.values()].sort((a, b) => b.count - a.count) };
}

// ═══════════════════════════════════════════════════════════════
//  STEP 7: GENERATE SIDE VIEW (estimated)
// ═══════════════════════════════════════════════════════════════

function buildSideView(frontGrid, frontMatGrid, gridW, gridH) {
    const depth = Math.max(4, Math.round(gridW * DEPTH_RATIO));
    const side = [];
    const paletteMap = new Map();

    for (let y = 0; y < gridH; y++) {
        const row = [];

        // Find the dominant wall material for this row (excluding air, glass)
        const rowMats = frontMatGrid[y].filter(m => m !== 'air' && m !== 'glass' && m !== 'fallback');
        const wallMat = mode(rowMats) || 'concrete';

        // Find dominant wall block
        const wallBlocks = frontGrid[y].filter(b => b.id !== 'air');
        const wallBlock = wallBlocks.length > 0 ? wallBlocks[Math.floor(wallBlocks.length / 2)] : pickFromPool(wallMat, 128, 128, 128);

        for (let x = 0; x < depth; x++) {
            // Check if this row is all air in front (building hasn't started yet)
            const isAirRow = frontMatGrid[y].every(m => m === 'air');
            if (isAirRow) {
                row.push({ ...AIR, material: 'air' });
                continue;
            }

            // First and last column = edge blocks (same as front edge)
            // Middle = wall material
            const isEdge = x === 0 || x === depth - 1;

            // For roof rows, continue roof material
            if (frontMatGrid[y].some(m => m.startsWith('roof'))) {
                const roofMat = frontMatGrid[y].find(m => m.startsWith('roof')) || 'roof_dark';
                const block = pickFromPool(roofMat, wallBlock.rgb[0], wallBlock.rgb[1], wallBlock.rgb[2]);
                row.push({ ...block, material: roofMat });
                if (block.id !== 'air') {
                    const e = paletteMap.get(block.id) || { block, count: 0 };
                    e.count++;
                    paletteMap.set(block.id, e);
                }
                continue;
            }

            // Add occasional windows on side wall
            if (!isEdge && x > 1 && x < depth - 2 && y > gridH * 0.2 && y < gridH * 0.75
                && x % 3 === 1 && y % 4 < 2
                && frontMatGrid[y].some(m => m === 'glass')) {
                const block = pickFromPool('glass', 150, 180, 210);
                row.push({ ...block, material: 'glass' });
                const e = paletteMap.get(block.id) || { block, count: 0 };
                e.count++;
                paletteMap.set(block.id, e);
            } else {
                row.push({ ...wallBlock, material: wallMat });
                if (wallBlock.id !== 'air') {
                    const e = paletteMap.get(wallBlock.id) || { block: wallBlock, count: 0 };
                    e.count++;
                    paletteMap.set(wallBlock.id, e);
                }
            }
        }
        side.push(row);
    }

    return { grid: side, width: depth, height: gridH, palette: [...paletteMap.values()].sort((a, b) => b.count - a.count) };
}

// ═══════════════════════════════════════════════════════════════
//  STEP 8: GENERATE TOP VIEW (estimated)
// ═══════════════════════════════════════════════════════════════

function buildTopView(frontGrid, frontMatGrid, gridW, gridH) {
    const depth = Math.max(4, Math.round(gridW * DEPTH_RATIO));
    const top = [];
    const paletteMap = new Map();

    // Determine building bounds from front view (find leftmost/rightmost non-air columns)
    let leftBound = gridW, rightBound = 0;
    for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            if (frontMatGrid[y][x] !== 'air') {
                leftBound = Math.min(leftBound, x);
                rightBound = Math.max(rightBound, x);
            }
        }
    }

    // Determine roof material from top rows of front view
    let roofMat = 'roof_dark';
    for (let y = 0; y < Math.min(gridH * 0.3, 10); y++) {
        for (let x = leftBound; x <= rightBound; x++) {
            if (frontMatGrid[y] && frontMatGrid[y][x] && frontMatGrid[y][x].startsWith('roof')) {
                roofMat = frontMatGrid[y][x];
            }
        }
    }

    // Determine wall material
    const wallMats = [];
    for (let y = Math.floor(gridH * 0.3); y < gridH; y++) {
        for (let x = leftBound; x <= rightBound; x++) {
            if (frontMatGrid[y] && frontMatGrid[y][x] && frontMatGrid[y][x] !== 'air' && frontMatGrid[y][x] !== 'glass') {
                wallMats.push(frontMatGrid[y][x]);
            }
        }
    }
    const wallMat = mode(wallMats) || 'concrete';

    // Build top-down grid (depth rows × width columns)
    for (let z = 0; z < depth; z++) {
        const row = [];
        for (let x = 0; x < gridW; x++) {
            const insideBuilding = x >= leftBound && x <= rightBound;

            if (!insideBuilding) {
                row.push({ ...AIR, material: 'air' });
                continue;
            }

            const isEdge = z === 0 || z === depth - 1 || x === leftBound || x === rightBound;
            const mat = isEdge ? wallMat : roofMat;
            const block = pickFromPool(mat, 128, 128, 128);
            row.push({ ...block, material: mat });

            if (block.id !== 'air') {
                const e = paletteMap.get(block.id) || { block, count: 0 };
                e.count++;
                paletteMap.set(block.id, e);
            }
        }
        top.push(row);
    }

    return { grid: top, width: gridW, height: depth, palette: [...paletteMap.values()].sort((a, b) => b.count - a.count) };
}

/** Find mode (most frequent) element of array */
function mode(arr) {
    if (arr.length === 0) return null;
    const counts = {};
    for (const v of arr) counts[v] = (counts[v] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ═══════════════════════════════════════════════════════════════
//  TIPS GENERATION
// ═══════════════════════════════════════════════════════════════

function generateTips(matGrid, frontPalette, bgGrid, w, h) {
    const tips = [];
    const total = w * h;

    // Count materials
    const matCounts = {};
    for (const row of matGrid) for (const m of row) matCounts[m] = (matCounts[m] || 0) + 1;

    // Background removal stat
    let bgCount = 0;
    for (const row of bgGrid) for (const v of row) if (v) bgCount++;
    const bgPct = (bgCount / total * 100).toFixed(0);
    if (bgPct > 10) {
        tips.push(`배경 ${bgPct}%를 감지하여 제거했습니다. 건물을 꽉 채워 찍으면 더 정확한 도면을 얻을 수 있어요.`);
    }

    // Window hint
    if (matCounts.glass > 0) {
        tips.push(`창문 ${matCounts.glass}칸 감지 → 유리 블록 배치. 실제 건축 시 유리판(Glass Pane)을 사용하면 더 사실적입니다.`);
    }

    // Roof hint
    const roofCount = (matCounts.roof_dark || 0) + (matCounts.roof_tile || 0);
    if (roofCount > 0) {
        tips.push(`지붕 ${roofCount}칸 감지. 계단 블록이나 반 블록을 사용하면 경사 지붕을 표현할 수 있어요.`);
    }

    // Material mix hint
    if (matCounts.brick > 0 && matCounts.stone > 0) {
        tips.push(`벽돌과 석재가 함께 감지되었습니다. 테라코타를 섞어 쓰면 질감 변화를 줄 수 있어요.`);
    }

    // Top block
    if (frontPalette.length > 0) {
        const top = frontPalette[0];
        tips.push(`가장 많이 쓰인 블록: ${top.block.nameKo} (${top.count}개) — 이 블록을 먼저 충분히 준비하세요!`);
    }

    // 3D hint
    tips.push(`측면도와 평면도는 정면 사진에서 추정한 것입니다. 사이드 사진도 업로드하면 더 정확한 3D 도면을 만들 수 있어요. (추후 업데이트 예정)`);

    // Scale
    const depth = Math.max(4, Math.round(w * DEPTH_RATIO));
    tips.push(`건축 규모: 가로 ${w} × 높이 ${h} × 깊이 ${depth}블록 (1블록 = 1m)`);

    return tips;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN ENTRY
// ═══════════════════════════════════════════════════════════════

/**
 * Smart analysis v2 — full pipeline
 *
 * @returns {{ front, side, top, tips, materialSummary }}
 *   Each view has: { grid, palette, width, height }
 */
export function smartAnalyze(img, gridW = 48, gridH = 0, onProgress = () => { }) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);

    const aspect = img.height / img.width;
    const actualH = gridH > 0 ? gridH : Math.round(gridW * aspect);
    const actualW = gridW;

    onProgress(5);

    // 1. Color grid
    const colorGrid = extractColorGrid(imageData, img.width, img.height, actualW, actualH);
    onProgress(15);

    // 2. Background removal
    const bgGrid = detectBackground(colorGrid, actualW, actualH);
    onProgress(30);

    // 3. Edge map
    const edgeMap = computeEdgeMap(imageData, img.width, img.height, actualW, actualH);
    onProgress(45);

    // 4. Front view (main blueprint)
    const front = buildFrontView(colorGrid, bgGrid, edgeMap, actualW, actualH);
    front.width = actualW;
    front.height = actualH;
    onProgress(60);

    // 5. Side view (estimated)
    const side = buildSideView(front.grid, front.matGrid, actualW, actualH);
    onProgress(75);

    // 6. Top view (estimated)
    const top = buildTopView(front.grid, front.matGrid, actualW, actualH);
    onProgress(88);

    // 7. Material summary
    const matCounts = {};
    for (const row of front.matGrid) for (const m of row) matCounts[m] = (matCounts[m] || 0) + 1;

    // 8. Tips
    const tips = generateTips(front.matGrid, front.palette, bgGrid, actualW, actualH);
    onProgress(100);

    return {
        front: { grid: front.grid, palette: front.palette, width: actualW, height: actualH },
        side,
        top,
        tips,
        materialSummary: matCounts,
    };
}

export default smartAnalyze;
