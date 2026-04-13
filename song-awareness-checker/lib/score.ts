export interface ScoreInput {
  googleTrendsWeb: number | null;     // 0–100 (KR, 12mo)
  googleTrendsYouTube: number | null; // 0–100 (KR, 12mo)
  lastfmListeners: number | null;
}

export interface ScoreResult {
  awarenessScore: number;
  breakdown: {
    googleTrendsWeb: number | null;
    googleTrendsYouTube: number | null;
    lastfm: number | null;
    lastfmNormalized: number | null;
  };
  availableSources: number;
}

// Last.fm listener counts mapped to 0–100 scale.
// ~5M listeners ≈ top-tier mainstream (100).
const LASTFM_MAX = 5_000_000;

export function normalizeLastfm(listeners: number): number {
  if (listeners <= 0) return 0;
  // Logarithmic scale so mid-tier artists aren't crushed.
  const score = (Math.log10(listeners + 1) / Math.log10(LASTFM_MAX + 1)) * 100;
  return Math.min(100, Math.round(score));
}

export function calculateScore(input: ScoreInput): ScoreResult {
  const lastfmNorm =
    input.lastfmListeners !== null
      ? normalizeLastfm(input.lastfmListeners)
      : null;

  // Korean search interest is the main signal.
  // Last.fm remains a secondary proxy for overall audience size.
  const weights = {
    googleTrendsWeb: 0.75,
    lastfm: 0.25,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  if (input.googleTrendsWeb !== null) {
    weightedSum += input.googleTrendsWeb * weights.googleTrendsWeb;
    totalWeight += weights.googleTrendsWeb;
  }
  if (lastfmNorm !== null) {
    weightedSum += lastfmNorm * weights.lastfm;
    totalWeight += weights.lastfm;
  }

  const awarenessScore =
    totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const availableSources = [input.googleTrendsWeb, lastfmNorm].filter(
    (v) => v !== null
  ).length;

  return {
    awarenessScore,
    breakdown: {
      googleTrendsWeb: input.googleTrendsWeb,
      googleTrendsYouTube: input.googleTrendsYouTube,
      lastfm: input.lastfmListeners,
      lastfmNormalized: lastfmNorm,
    },
    availableSources,
  };
}
