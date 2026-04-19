import { NextRequest, NextResponse } from "next/server";
import { fetchLastfm } from "@/lib/lastfm";

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

  try {
    const result = await fetchLastfm(track, artist, useMock);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
