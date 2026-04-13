import { NextRequest, NextResponse } from "next/server";
import { fetchTrends } from "@/lib/trends";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  const useMock = searchParams.get("mock") === "true";

  if (!query) {
    return NextResponse.json({ error: "query parameter required" }, { status: 400 });
  }

  try {
    const result = await fetchTrends(query, useMock);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
