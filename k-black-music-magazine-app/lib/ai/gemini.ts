import {
  CONCEPT_EXTRACTOR_SYSTEM_PROMPT,
  RESEARCHER_SYSTEM_PROMPT,
  SOUND_CONCEPT_DETAIL_SYSTEM_PROMPT,
  TRACK_DETAIL_SYSTEM_PROMPT,
  buildConceptExtractionUserPrompt,
  buildConceptBasedResearchUserPrompt,
  buildSoundConceptDetailUserPrompt,
  buildTrackDetailUserPrompt,
} from "@/lib/ai/prompts";
import { deriveHookFitFromAwarenessMetric } from "@/lib/scoring/hook-fit";
import { setWorkflowDebug } from "@/lib/server/debug-store";
import { buildMockMainTrackAnalysis } from "@/lib/server/mock-data";
import { extractJsonBlock, safeJsonParse } from "@/lib/utils";
import { conceptDetailResponseSchema, mainTrackAnalysisSchema, researchResponseSchema, trackDetailsResponseSchema } from "@/lib/validators/workflow";
import type { ConceptDetail, HookCandidate, MainTrackAnalysis, SourceLink, TrackDetail } from "@/types/workflow";

const FLASH_MODEL = "gemini-3.1-flash-lite-preview";
const PRO_MODEL = "gemini-3.1-pro-preview";
const GEMINI_TIMEOUT_MS = 55000;

interface GroundingChunk {
  web?: { uri?: string; title?: string };
}

interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  groundingMetadata?: GroundingMetadata;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

function normalizeSources(metadata?: GroundingMetadata): SourceLink[] {
  const chunks = metadata?.groundingChunks ?? [];
  const seen = new Set<string>();

  return chunks
    .map((chunk) => {
      const url = chunk.web?.uri;
      const title = chunk.web?.title;
      if (!url || !title || seen.has(url)) return null;
      seen.add(url);
      return { title, url };
    })
    .filter((value): value is SourceLink => value !== null)
    .slice(0, 6);
}

async function callGemini(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
): Promise<{ text: string; sources: SourceLink[] }> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { responseMimeType: "application/json", temperature },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`Gemini 요청 시간 초과 (${GEMINI_TIMEOUT_MS}ms)`);
    }
    throw new Error(error instanceof Error ? error.message : "Gemini 요청 실패");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Gemini HTTP ${response.status}: ${body.slice(0, 1200) || "응답 본문 없음"}`,
    );
  }

  const raw = await response.text();
  let payload: GeminiResponse;
  try {
    payload = JSON.parse(raw) as GeminiResponse;
  } catch (error) {
    throw new Error(
      `Gemini JSON 파싱 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}\n\n응답 일부:\n${raw.slice(0, 1200)}`,
    );
  }
  const first = payload.candidates?.[0];
  const text = first?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
  const sources = normalizeSources(first?.groundingMetadata);
  if (!text.trim()) {
    throw new Error(`Gemini 응답 본문이 비어 있습니다.\n\n응답 일부:\n${raw.slice(0, 1200)}`);
  }
  return { text, sources };
}

export async function extractConceptForWorkflow(input: {
  workflowId: string;
  mainTrack: string;
  mainArtist: string;
  externalContext?: string;
}): Promise<MainTrackAnalysis> {
  const fallback = buildMockMainTrackAnalysis();

  if (!process.env.GEMINI_API_KEY) return fallback;

  const prompt = buildConceptExtractionUserPrompt(input.mainTrack, input.mainArtist, input.externalContext);
  try {
    const result = await callGemini(PRO_MODEL, CONCEPT_EXTRACTOR_SYSTEM_PROMPT, prompt, 0.3);
    return mainTrackAnalysisSchema.parse(safeJsonParse(extractJsonBlock(result.text)));
  } catch {
    return fallback;
  }
}

export async function findCandidatesForConcept(input: {
  workflowId: string;
  mainTrack: string;
  mainArtist: string;
  concept: string;
  conceptExplanation: string;
}): Promise<HookCandidate[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY가 없어 후보 리서치를 진행할 수 없습니다.");
  }

  const prompt = buildConceptBasedResearchUserPrompt(
    input.mainTrack,
    input.mainArtist,
    input.concept,
    input.conceptExplanation,
  );

  let text = "";
  let sources: SourceLink[] = [];
  try {
    const result = await callGemini(PRO_MODEL, RESEARCHER_SYSTEM_PROMPT, prompt, 0.5);
    text = result.text;
    sources = result.sources;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini 후보 탐색 실패";
    setWorkflowDebug(input.workflowId, {
      gemini: {
        model: PRO_MODEL,
        prompt,
        error: message,
        rawResponse: "",
        searchNotes: [],
        sources: [],
      },
    });
    throw new Error(message);
  }

  try {
    const parsed = researchResponseSchema.parse(safeJsonParse(extractJsonBlock(text)));
    const candidates = parsed.candidates.map((candidate, index): HookCandidate => ({
      id: crypto.randomUUID(),
      trackName: candidate.trackName,
      artistName: candidate.artistName,
      soundConcept: candidate.soundConcept,
      connectionReason: candidate.connectionReason,
      awarenessMetric: candidate.awarenessMetric,
      hookFit: deriveHookFitFromAwarenessMetric(candidate.awarenessMetric),
      researchSources: sources,
      displayOrder: index + 1,
    }));

    setWorkflowDebug(input.workflowId, {
      gemini: {
        model: PRO_MODEL,
        prompt,
        rawText: text,
        rawResponse: text,
        searchNotes: sources.map((s) => s.title),
        sources,
      },
    });

    return candidates;
  } catch (error) {
    setWorkflowDebug(input.workflowId, {
      gemini: {
        model: PRO_MODEL,
        prompt,
        rawText: text,
        rawResponse: text,
        error: error instanceof Error ? error.message : "후보 파싱 실패",
        searchNotes: sources.map((s) => s.title),
        sources,
      },
    });
    throw new Error(error instanceof Error ? error.message : "후보 응답을 해석하지 못했습니다.");
  }
}

export async function researchTrackDetails(input: {
  hookTrack: string;
  hookArtist: string;
  mainTrack: string;
  mainArtist: string;
  externalContext?: string;
}): Promise<TrackDetail[]> {
  if (!process.env.GEMINI_API_KEY) {
    return [
      { trackName: input.hookTrack, artistName: input.hookArtist, items: [], sources: [] },
      { trackName: input.mainTrack, artistName: input.mainArtist, items: [], sources: [] },
    ];
  }

  const prompt = buildTrackDetailUserPrompt(input);
  const result = await callGemini(FLASH_MODEL, TRACK_DETAIL_SYSTEM_PROMPT, prompt, 0.4);

  const parsed = trackDetailsResponseSchema.parse(safeJsonParse(extractJsonBlock(result.text)));

  return parsed.tracks.map((track, i) => ({
    trackName: track.trackName,
    artistName: track.artistName,
    items: track.items,
    sources: i === 0 ? result.sources : result.sources,
  }));
}

export async function researchConceptDetail(input: {
  hookTrack: string;
  hookArtist: string;
  mainTrack: string;
  mainArtist: string;
  concept: string;
  conceptExplanation: string;
  externalContext?: string;
}): Promise<ConceptDetail> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      concept: input.concept,
      hookTrack: { trackName: input.hookTrack, artistName: input.hookArtist, manifestation: "" },
      mainTrack: { trackName: input.mainTrack, artistName: input.mainArtist, manifestation: "" },
    };
  }

  const prompt = buildSoundConceptDetailUserPrompt(input);
  const result = await callGemini(PRO_MODEL, SOUND_CONCEPT_DETAIL_SYSTEM_PROMPT, prompt, 0.4);
  return conceptDetailResponseSchema.parse(safeJsonParse(extractJsonBlock(result.text)));
}
