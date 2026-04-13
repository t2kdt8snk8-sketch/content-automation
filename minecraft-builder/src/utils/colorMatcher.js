/**
 * Color Matcher — Maps RGB colors to closest Minecraft block
 * Uses CIE76 (ΔE) color distance in Lab color space
 */

import BLOCKS from '../data/minecraftBlocks.js';

// ─── RGB → Lab conversion ────────────────────────────────────

function rgbToXyz(r, g, b) {
    let rr = r / 255, gg = g / 255, bb = b / 255;
    rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
    gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
    bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;
    rr *= 100; gg *= 100; bb *= 100;
    return [
        rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375,
        rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750,
        rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041,
    ];
}

function xyzToLab(x, y, z) {
    const refX = 95.047, refY = 100.000, refZ = 108.883;
    let xx = x / refX, yy = y / refY, zz = z / refZ;
    const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116);
    xx = f(xx); yy = f(yy); zz = f(zz);
    return [116 * yy - 16, 500 * (xx - yy), 200 * (yy - zz)];
}

function rgbToLab(r, g, b) {
    const [x, y, z] = rgbToXyz(r, g, b);
    return xyzToLab(x, y, z);
}

// ─── CIE76 Color Distance ────────────────────────────────────

function deltaE(lab1, lab2) {
    return Math.sqrt(
        Math.pow(lab1[0] - lab2[0], 2) +
        Math.pow(lab1[1] - lab2[1], 2) +
        Math.pow(lab1[2] - lab2[2], 2)
    );
}

// ─── Pre-calculate Lab values for all blocks ─────────────────

const blockLabCache = BLOCKS.map(block => ({
    ...block,
    lab: rgbToLab(block.rgb[0], block.rgb[1], block.rgb[2]),
}));

// ─── Main matching functions ─────────────────────────────────

/**
 * Find the closest Minecraft block to a given RGB color
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @param {string[]} [categories] - Optional category filter
 * @returns {{ block: object, distance: number }}
 */
export function findClosestBlock(r, g, b, categories = null) {
    const targetLab = rgbToLab(r, g, b);
    let bestMatch = null;
    let bestDist = Infinity;

    const pool = categories
        ? blockLabCache.filter(b => categories.includes(b.category))
        : blockLabCache;

    for (const block of pool) {
        const dist = deltaE(targetLab, block.lab);
        if (dist < bestDist) {
            bestDist = dist;
            bestMatch = block;
        }
    }

    return { block: bestMatch, distance: bestDist };
}

/**
 * Find top N closest blocks to a given RGB color
 */
export function findTopBlocks(r, g, b, n = 5, categories = null) {
    const targetLab = rgbToLab(r, g, b);
    const pool = categories
        ? blockLabCache.filter(b => categories.includes(b.category))
        : blockLabCache;

    const scored = pool.map(block => ({
        block,
        distance: deltaE(targetLab, block.lab),
    }));

    scored.sort((a, b) => a.distance - b.distance);
    return scored.slice(0, n);
}

/**
 * Convert an entire grid of RGB values to Minecraft blocks
 * @param {number[][][]} colorGrid - 2D array of [r, g, b] values
 * @param {string[]} [categories] - Optional category filter
 * @returns {{ grid: object[][], palette: Map }}
 */
export function convertGridToBlocks(colorGrid, categories = null) {
    const palette = new Map();
    const grid = colorGrid.map(row =>
        row.map(([r, g, b]) => {
            const { block, distance } = findClosestBlock(r, g, b, categories);
            const count = palette.get(block.id) || { block, count: 0 };
            count.count++;
            palette.set(block.id, count);
            return { ...block, distance };
        })
    );

    // Sort palette by count descending
    const sortedPalette = [...palette.values()].sort((a, b) => b.count - a.count);

    return { grid, palette: sortedPalette };
}

export { rgbToLab, deltaE };
