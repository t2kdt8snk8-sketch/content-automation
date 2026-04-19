import { YoutubeTranscript } from "youtube-transcript";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_VIDEOS = 5;
const MAX_TRANSCRIPT_CHARS = 3000;

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: { title: string; description: string };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
}

export interface YouTubeResult {
  videoId: string;
  title: string;
  url: string;
  text: string; // transcript or description fallback
}

async function searchVideos(query: string): Promise<YouTubeSearchItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(MAX_VIDEOS),
    relevanceLanguage: "en",
    key: apiKey,
  });

  try {
    const res = await fetch(`${YOUTUBE_API_BASE}/search?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as YouTubeSearchResponse;
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function extractTranscript(videoId: string, fallback: string): Promise<string> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    const full = segments.map((s) => s.text).join(" ");
    return full.slice(0, MAX_TRANSCRIPT_CHARS);
  } catch {
    // 자막 없으면 영상 설명으로 fallback
    return fallback.slice(0, 800);
  }
}

export async function collectYouTubeSources(
  trackName: string,
  artistName: string,
): Promise<YouTubeResult[]> {
  const query = `${trackName} ${artistName} sound analysis production breakdown`;
  const items = await searchVideos(query);
  if (items.length === 0) return [];

  const results = await Promise.allSettled(
    items.map(async (item): Promise<YouTubeResult> => {
      const videoId = item.id.videoId;
      const text = await extractTranscript(videoId, item.snippet.description);
      return {
        videoId,
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        text,
      };
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<YouTubeResult> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((r) => r.text.trim().length > 0);
}
