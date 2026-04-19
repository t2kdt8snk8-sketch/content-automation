import Parser from "rss-parser";

const parser = new Parser({ timeout: 10000 });

const RSS_FEEDS: { name: string; url: string }[] = [
  { name: "Attack Magazine", url: "https://www.attackmagazine.com/feed/" },
  { name: "Sound on Sound", url: "https://www.soundonsound.com/rss.xml" },
  { name: "Pitchfork", url: "https://pitchfork.com/rss/reviews/tracks/feed/rss" },
  { name: "Red Bull Music Academy", url: "https://daily.redbullmusicacademy.com/feed" },
];

const MAX_SNIPPET_CHARS = 600;

export interface WebzineResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export async function collectWebzineSources(
  trackName: string,
  artistName: string,
): Promise<WebzineResult[]> {
  const keywords = [trackName, artistName, ...artistName.split(" "), ...trackName.split(" ")].filter(
    (k) => k.length > 2,
  );

  const feedResults = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return { source: feed.name, items: parsed.items ?? [] };
    }),
  );

  const results: WebzineResult[] = [];

  for (const result of feedResults) {
    if (result.status !== "fulfilled") continue;
    const { source, items } = result.value;

    for (const item of items) {
      const title = item.title ?? "";
      const snippet = (item.contentSnippet ?? item.summary ?? "").slice(0, MAX_SNIPPET_CHARS);
      const url = item.link ?? "";

      if (!url) continue;
      if (!matchesKeywords(title + " " + snippet, keywords)) continue;

      results.push({ title, snippet, url, source });
    }
  }

  return results;
}
