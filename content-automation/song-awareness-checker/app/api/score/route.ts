import { NextRequest, NextResponse } from "next/server";
import { calculateScore } from "@/lib/score";
import { fetchLastfm } from "@/lib/lastfm";
import { fetchTrends } from "@/lib/trends";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track");
  const artist = searchParams.get("artist");
  const useMock = searchParams.get("mock") === "true";

  if (!track || !artist) {
    return NextResponse.json(
      { error: "track and artist parameters required" },
      { status: 400 }
    );
  }

  const [trendsRes, lastfmRes] = await Promise.allSettled([
    fetchTrends(`${track} ${artist}`, useMock),
    fetchLastfm(track, artist, useMock),
  ]);

  type TrendsPayload = {
    webTrend?: number;
    youtubeTrend?: number;
    isMock?: boolean;
    error?: string;
  };
  type LastfmPayload = {
    listeners?: number;
    playcount?: number;
    trackName?: string;
    artistName?: string;
    isMock?: boolean;
    error?: string;
  };

  let trends: TrendsPayload = {};
  let lastfm: LastfmPayload = {};
  const errors: string[] = [];

  if (trendsRes.status === "fulfilled") {
    trends = trendsRes.value as TrendsPayload;
  } else {
    errors.push("Google Trends: failed to fetch");
  }

  if (lastfmRes.status === "fulfilled") {
    lastfm = lastfmRes.value as LastfmPayload;
  } else {
    errors.push("Last.fm: failed to fetch");
  }

  const result = calculateScore({
    googleTrendsWeb: trends.webTrend ?? null,
    googleTrendsYouTube: trends.youtubeTrend ?? null,
    lastfmListeners: lastfm.listeners ?? null,
  });

  return NextResponse.json({
    ...result,
    meta: {
      trackName: lastfm.trackName ?? track,
      artistName: lastfm.artistName ?? artist,
      lastfmPlaycount: lastfm.playcount ?? null,
      isMock: !!(trends.isMock || lastfm.isMock),
      errors,
    },
  });
}
