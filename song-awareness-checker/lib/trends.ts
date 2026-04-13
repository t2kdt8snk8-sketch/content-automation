export type TrendsResult = {
  webTrend: number;
  youtubeTrend: number;
  isMock: boolean;
};

type TrendsData = {
  interest_over_time?: {
    timeline_data?: Array<{ values?: Array<{ extracted_value?: number }> }>;
  };
};

const MOCK_DATA: TrendsResult = {
  webTrend: 45,
  youtubeTrend: 38,
  isMock: true,
};

function averageInterest(data: TrendsData): number {
  const timeline = data?.interest_over_time?.timeline_data ?? [];
  if (timeline.length === 0) return 0;
  const sum = timeline.reduce(
    (acc: number, point: { values?: Array<{ extracted_value?: number }> }) => {
      const val = point?.values?.[0]?.extracted_value ?? 0;
      return acc + val;
    },
    0
  );
  return Math.round(sum / timeline.length);
}

export async function fetchTrends(query: string, useMock = false): Promise<TrendsResult> {
  if (useMock || !process.env.SERPAPI_KEY) {
    return MOCK_DATA;
  }

  const apiKey = process.env.SERPAPI_KEY;

  const [webRes, ytRes] = await Promise.all([
    fetch(
      `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(query)}&geo=KR&date=today%2012-m&api_key=${apiKey}`
    ),
    fetch(
      `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(query)}&geo=KR&date=today%2012-m&search_type=youtube_search&api_key=${apiKey}`
    ),
  ]);

  if (!webRes.ok || !ytRes.ok) {
    throw new Error(`SerpAPI error: web=${webRes.status}, yt=${ytRes.status}`);
  }

  const [webData, ytData] = (await Promise.all([
    webRes.json(),
    ytRes.json(),
  ])) as [TrendsData, TrendsData];

  return {
    webTrend: averageInterest(webData),
    youtubeTrend: averageInterest(ytData),
    isMock: false,
  };
}
