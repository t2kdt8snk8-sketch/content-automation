import { z } from "zod";

export const sourceLinkSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  snippet: z.string().optional(),
});

export const createWorkflowSchema = z.object({
  mainTrack: z.string().trim().min(1, "곡명을 입력해 주세요."),
  mainArtist: z.string().trim().min(1, "아티스트명을 입력해 주세요."),
});

export const workflowIdSchema = z.object({
  workflowId: z.string().uuid("유효한 워크플로우 ID가 아닙니다."),
});

export const selectCandidateSchema = z.object({
  workflowId: z.string().uuid("유효한 워크플로우 ID가 아닙니다."),
  candidateId: z.string().uuid("유효한 후보 ID가 아닙니다."),
});

export const awarenessMetricSchema = z.object({
  level: z.number().int().min(1).max(5),
  melon: z.string().min(1),
  youtube: z.string().min(1),
  naver: z.string().min(1),
  timing: z.string().min(1),
});

export const trackDetailItemSchema = z.object({
  category: z.enum(["감상 원재료", "흥미 TMI"]),
  content: z.string().min(1),
});

export const trackDetailSchema = z.object({
  trackName: z.string().min(1),
  artistName: z.string().min(1),
  items: z.array(trackDetailItemSchema).min(1),
});

export const trackDetailsResponseSchema = z.object({
  tracks: z.array(trackDetailSchema).length(2),
});

export const conceptTrackManifestationSchema = z.object({
  trackName: z.string().min(1),
  artistName: z.string().min(1),
  manifestation: z.string().min(1),
});

export const conceptDetailResponseSchema = z.object({
  concept: z.string().min(1),
  hookTrack: conceptTrackManifestationSchema,
  mainTrack: conceptTrackManifestationSchema,
});

export const mainTrackAnalysisSchema = z.object({
  concept: z.string().min(1),
  conceptExplanation: z.string().min(1),
  conceptSource: z.enum(["web", "ai_inference"]),
});

export const researchCandidateSchema = z.object({
  trackName: z.string().min(1),
  artistName: z.string().min(1),
  soundConcept: z.string().min(1),
  connectionReason: z.string().min(1),
  awarenessMetric: awarenessMetricSchema,
});

export const researchResponseSchema = z.object({
  candidates: z.array(researchCandidateSchema).length(5),
});

export const slideDraftSchema = z.object({
  id: z.string().min(1),
  section: z.enum(["cover", "provoke", "hook", "concept", "main"]),
  headline: z.string().min(1),
  body: z.string(),
  pointWord: z.string().optional().or(z.literal("")),
});

export const copyDraftResponseSchema = z.object({
  slides: z.array(slideDraftSchema).min(4),
  captionAngle: z.string().min(1),
  captionReason: z.string().min(1),
  caption: z.string().min(1),
});

export const generateCopySchema = z.object({
  workflowId: z.string().uuid(),
  candidateId: z.string().uuid(),
});

export const exportSlidesSchema = z.object({
  workflowId: z.string().uuid(),
  copyDraft: z.object({
    hookTrack: z.string().min(1),
    hookArtist: z.string().min(1),
    mainTrack: z.string().min(1),
    mainArtist: z.string().min(1),
    slides: z.array(slideDraftSchema).min(1),
    captionAngle: z.string().min(1),
    captionReason: z.string().min(1),
    caption: z.string().min(1),
  }),
});
