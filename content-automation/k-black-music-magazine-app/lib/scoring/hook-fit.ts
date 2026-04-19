export interface HookFitInputs {
  melonTop100: boolean;
  melonLikes: number | null;
  youtubeKoreanReactionVideos: number | null;
  communityMentions: number | null;
  recentYoutubeGrowth: number | null;
  recentCommunityGrowth: number | null;
}

import type { AwarenessMetric, HookFitMetrics } from "@/types/workflow";

export interface HookFitScores extends HookFitMetrics {
  awarenessScore: number;
  momentumScore: number;
  oversaturationScore: number;
  hookFitScore: number;
  awarenessTier: 1 | 2 | 3 | 4 | 5;
  hookBucket: "too_niche" | "sweet_spot" | "too_famous";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function logNormalize(value: number | null, maxValue: number) {
  if (!value || value <= 0) {
    return 0;
  }

  return Math.min(1, Math.log10(value + 1) / Math.log10(maxValue + 1));
}

function positiveNormalize(value: number | null, ceiling: number) {
  if (!value || value <= 0) {
    return 0;
  }

  return Math.min(1, value / ceiling);
}

function parseApproximateCount(text: string) {
  const normalized = text.replaceAll(",", "");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);

  if (!match) {
    return null;
  }

  const base = Number(match[1]);
  if (Number.isNaN(base)) {
    return null;
  }

  if (normalized.includes("500개 이상")) return 500;
  if (normalized.includes("200개 이상")) return 200;
  if (normalized.includes("100개 이상")) return 100;
  if (normalized.includes("50개 이상")) return 50;
  if (normalized.includes("30개 내외")) return 30;
  if (normalized.includes("40개 내외")) return 40;
  if (normalized.includes("80개")) return 80;

  return base;
}

function deriveAwarenessTier(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score < 20) return 1;
  if (score < 38) return 2;
  if (score < 56) return 3;
  if (score < 74) return 4;
  return 5;
}

export function calculateHookFitScores(input: HookFitInputs): HookFitScores {
  const likesScore = logNormalize(input.melonLikes, 500000) * 18;
  const youtubeScore = logNormalize(input.youtubeKoreanReactionVideos, 200) * 37;
  const communityScore = logNormalize(input.communityMentions, 500) * 25;
  const melonChartScore = input.melonTop100 ? 20 : 0;

  const awarenessScore = clamp(likesScore + youtubeScore + communityScore + melonChartScore);

  const youtubeMomentum = positiveNormalize(input.recentYoutubeGrowth, 1) * 60;
  const communityMomentum = positiveNormalize(input.recentCommunityGrowth, 1) * 40;
  const momentumScore = clamp(youtubeMomentum + communityMomentum);

  const oversaturationBase =
    (input.melonTop100 ? 45 : 0) +
    clamp((logNormalize(input.melonLikes, 500000) - 0.72) * 100, 0, 100) * 0.2 +
    clamp((logNormalize(input.youtubeKoreanReactionVideos, 200) - 0.8) * 100, 0, 100) * 0.2 +
    clamp((logNormalize(input.communityMentions, 500) - 0.8) * 100, 0, 100) * 0.15;
  const oversaturationScore = clamp(oversaturationBase);

  const awarenessTier = deriveAwarenessTier(awarenessScore);
  const sweetSpotCenter = 56;
  const sweetSpotScore = clamp(100 - Math.abs(awarenessScore - sweetSpotCenter) * 2.05);

  let hookFitScore = clamp(sweetSpotScore * 0.68 + momentumScore * 0.32);

  if (awarenessTier === 5) {
    hookFitScore = clamp(hookFitScore - 22);
  }

  if (awarenessTier <= 2) {
    hookFitScore = clamp(hookFitScore - 18);
  }

  if (oversaturationScore >= 60) {
    hookFitScore = clamp(hookFitScore - 14);
  }

  const hookBucket =
    awarenessTier === 5 || oversaturationScore >= 60
      ? "too_famous"
      : awarenessTier <= 2
        ? "too_niche"
        : "sweet_spot";

  return {
    awarenessScore: Math.round(awarenessScore),
    momentumScore: Math.round(momentumScore),
    oversaturationScore: Math.round(oversaturationScore),
    hookFitScore: Math.round(hookFitScore),
    awarenessTier,
    hookBucket,
  };
}

export function deriveHookFitFromAwarenessMetric(metric: AwarenessMetric): HookFitScores {
  const melonTop100 = metric.melon.includes("있음");
  const melonLikes = melonTop100 ? 140000 : metric.level === 4 ? 60000 : metric.level === 3 ? 22000 : 5000;
  const youtubeKoreanReactionVideos = parseApproximateCount(metric.youtube);
  const communityMentions = parseApproximateCount(metric.naver);
  const recentYoutubeGrowth =
    metric.timing === "지금 올리기 좋음" ? 0.9 : metric.timing === "무난함" ? 0.35 : 0.05;
  const recentCommunityGrowth =
    metric.timing === "지금 올리기 좋음" ? 0.75 : metric.timing === "무난함" ? 0.28 : 0.04;

  const scores = calculateHookFitScores({
    melonTop100,
    melonLikes,
    youtubeKoreanReactionVideos,
    communityMentions,
    recentYoutubeGrowth,
    recentCommunityGrowth,
  });

  return {
    ...scores,
    awarenessTier: deriveAwarenessTier(metric.level * 20),
    hookBucket:
      metric.level === 5 ? "too_famous" : metric.level <= 2 ? "too_niche" : scores.hookBucket,
  };
}
