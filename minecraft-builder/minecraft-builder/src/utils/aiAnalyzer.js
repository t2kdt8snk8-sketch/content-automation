/**
 * AI Analyzer — Calls proxy server to analyze building images via AI
 * Stage 1: Vision model (building analysis)
 * Stage 2: LLM (block grid generation)
 */

import BLOCKS from '../data/minecraftBlocks.js';

const API_BASE = '/api';

// ─── Available block IDs for the prompt ─────────────────────

const BLOCK_ID_LIST = BLOCKS.map(b => b.id).join(', ');

// ─── Prompts ────────────────────────────────────────────────

const VISION_PROMPT = `You are an expert architectural analyst. Analyze this building photograph and return a JSON object describing its exterior features.

RESPOND ONLY WITH VALID JSON, no markdown or explanation.

Required JSON format:
{
  "building_type": "residential|commercial|tower|castle|church|bridge|skyscraper|house|apartment|other",
  "floors": <number>,
  "features": [
    {
      "type": "wall|window|roof|door|balcony|column|trim|foundation|chimney",
      "material": "<material description>",
      "color_hex": "<dominant hex color>",
      "area_percent": <percentage of facade this covers>,
      "pattern": "<description of any repeating pattern or null>"
    }
  ],
  "width_to_height_ratio": <number like 1.5>,
  "symmetry": <true|false>,
  "style": "<architectural style description>",
  "recommended_scale": "<suggested minecraft scale like 32x48>"
}`;

function buildGridPrompt(analysis, width, height) {
    return `You are a Minecraft building expert. Based on this building analysis, create a ${width}×${height} block grid that recreates the building's front facade in Minecraft.

BUILDING ANALYSIS:
${JSON.stringify(analysis, null, 2)}

AVAILABLE BLOCK IDs (use ONLY these):
${BLOCK_ID_LIST}, air

RULES:
1. Each cell must be a valid block ID from the list above
2. "air" for sky/empty space
3. Recreate the building shape, materials, windows, roof, door
4. Use glass/glass_pane for windows
5. Use appropriate stone/brick/wood for walls based on the building material
6. Use stair-like patterns for sloped roofs (alternate blocks)
7. Maintain the building's proportions and symmetry
8. Ground level should have foundation blocks
9. Make repeating window patterns consistent

RESPOND ONLY WITH VALID JSON:
{
  "grid": [
    ["air", "air", "stone_bricks", "stone_bricks", "air"],
    ...
  ],
  "tips": ["<helpful building tip 1>", "<tip 2>"],
  "block_summary": [
    {"id": "stone_bricks", "name_ko": "석재 벽돌", "count": 45, "usage": "main wall"},
    ...
  ]
}

The grid array should have exactly ${height} rows, each with exactly ${width} elements.`;
}

// ─── Session Token ──────────────────────────────────────────

function getToken() {
    return sessionStorage.getItem('mc_session_token');
}
function setToken(token) {
    sessionStorage.setItem('mc_session_token', token);
}
function authHeaders() {
    const token = getToken();
    return token ? { 'x-session-token': token } : {};
}

// ─── API Calls ──────────────────────────────────────────────

/**
 * Set API keys on the server session
 */
export async function setApiKeys(visionKey, llmKey) {
    const res = await fetch(`${API_BASE}/set-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visionKey, llmKey }),
    });
    if (!res.ok) throw new Error('Failed to set API keys');
    const data = await res.json();
    setToken(data.token);
    return data;
}

/**
 * Check if API keys are set
 */
export async function checkKeys() {
    try {
        const res = await fetch(`${API_BASE}/health`, {
            headers: authHeaders(),
        });
        const data = await res.json();
        return data.keysSet || false;
    } catch {
        return false;
    }
}

/**
 * Full AI analysis pipeline:
 * 1. Send image to vision model for building analysis
 * 2. Send analysis to LLM for grid generation
 *
 * @param {string} imageBase64 - Base64 encoded image
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {{ grid: string[][], analysis: object, tips: string[], blockSummary: object[] }}
 */
export async function analyzeWithAI(imageBase64, width, height, onProgress = () => { }) {
    onProgress(10);

    // Stage 1: Vision Analysis
    const visionRes = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
            stage: 'vision',
            image: imageBase64,
            prompt: VISION_PROMPT,
        }),
    });

    if (!visionRes.ok) {
        const err = await visionRes.json().catch(() => ({}));
        throw new Error(err.error || 'Vision analysis failed');
    }

    const visionData = await visionRes.json();
    let analysis;

    try {
        analysis = typeof visionData.result === 'string'
            ? JSON.parse(visionData.result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
            : visionData.result;
    } catch {
        throw new Error('Failed to parse vision analysis result');
    }

    onProgress(50);

    // Stage 2: Grid Generation
    const gridPrompt = buildGridPrompt(analysis, width, height);
    const gridRes = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
            stage: 'grid',
            prompt: gridPrompt,
        }),
    });

    if (!gridRes.ok) {
        const err = await gridRes.json().catch(() => ({}));
        throw new Error(err.error || 'Grid generation failed');
    }

    const gridData = await gridRes.json();
    let gridResult;

    try {
        gridResult = typeof gridData.result === 'string'
            ? JSON.parse(gridData.result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
            : gridData.result;
    } catch {
        throw new Error('Failed to parse grid generation result');
    }

    onProgress(100);

    return {
        grid: gridResult.grid,
        analysis,
        tips: gridResult.tips || [],
        blockSummary: gridResult.block_summary || [],
    };
}
