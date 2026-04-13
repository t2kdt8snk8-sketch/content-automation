export type WorkflowStatus =
  | "draft"
  | "researching"
  | "researched"
  | "selected"
  | "failed";

export interface SourceLink {
  title: string;
  url: string;
  snippet?: string;
}

export interface ModelDebugLog {
  model: string;
  prompt?: string;
  rawText?: string;
  rawResponse?: string;
  error?: string;
  searchNotes?: string[];
  sources: SourceLink[];
}

export interface WorkflowDebug {
  gemini?: ModelDebugLog;
  claude?: ModelDebugLog;
}

export interface TrackDetailItem {
  category: "감상 원재료" | "흥미 TMI";
  content: string;
}

export interface TrackDetail {
  trackName: string;
  artistName: string;
  items: TrackDetailItem[];
  sources: SourceLink[];
}

export interface ConceptTrackManifestation {
  trackName: string;
  artistName: string;
  manifestation: string;
}

export interface ConceptDetail {
  concept: string;
  hookTrack: ConceptTrackManifestation;
  mainTrack: ConceptTrackManifestation;
}

export interface MainTrackAnalysis {
  concept: string;
  conceptExplanation: string;
  conceptSource: "web" | "ai_inference";
}

export interface SlideDraft {
  id: string;
  headline: string;
  body: string;
  pointWord?: string;
  section: "cover" | "provoke" | "hook" | "concept" | "main";
}

export interface CopyDraft {
  hookTrack: string;
  hookArtist: string;
  mainTrack: string;
  mainArtist: string;
  slides: SlideDraft[];
  captionAngle: string;
  captionReason: string;
  caption: string;
}

export interface ExportedAsset {
  slideId: string;
  fileName: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  localPath?: string;
  previewDataUrl?: string;
}

export interface AwarenessMetric {
  level: number;
  melon: string;
  youtube: string;
  naver: string;
  timing: string;
}

export interface HookFitMetrics {
  awarenessScore: number;
  momentumScore: number;
  oversaturationScore: number;
  hookFitScore: number;
  awarenessTier: 1 | 2 | 3 | 4 | 5;
  hookBucket: "too_niche" | "sweet_spot" | "too_famous";
}

export interface HookCandidate {
  id: string;
  trackName: string;
  artistName: string;
  soundConcept: string;
  connectionReason: string;
  awarenessMetric: AwarenessMetric;
  hookFit?: HookFitMetrics;
  researchSources: SourceLink[];
  displayOrder: number;
}

export interface Workflow {
  id: string;
  mainTrack: string;
  mainArtist: string;
  status: WorkflowStatus;
  selectedCandidateId: string | null;
  candidates: HookCandidate[];
  mainTrackAnalysis?: MainTrackAnalysis;
  mainTrackExternalContext?: string;
  copyDraft?: CopyDraft;
  trackDetails?: TrackDetail[];
  conceptDetail?: ConceptDetail;
  debug?: WorkflowDebug;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowInput {
  mainTrack: string;
  mainArtist: string;
}

export interface WorkflowResponse {
  workflow: Workflow;
}
