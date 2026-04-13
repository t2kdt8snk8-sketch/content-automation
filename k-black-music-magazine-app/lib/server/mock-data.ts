import { deriveHookFitFromAwarenessMetric } from "@/lib/scoring/hook-fit";
import type { HookCandidate, MainTrackAnalysis, SourceLink } from "@/types/workflow";

function source(title: string, url: string, snippet: string): SourceLink {
  return { title, url, snippet };
}

export function buildMockCandidates(mainTrack: string, mainArtist: string): HookCandidate[] {
  const mockConcept = buildMockMainTrackAnalysis().concept;

  const seeds = [
    {
      trackName: "Talk 2 Me",
      artistName: "Montell Fish",
      soundConcept: mockConcept,
      connectionReason: `보컬이 박자보다 살짝 뒤에 얹히는 레이백 처리가 ${mainTrack}와 같은 방식으로 구현됩니다.`,
      awarenessMetric: { level: 3, melon: "TOP100 진입 이력 없음", youtube: "한국어 반응 영상 약 20개", naver: "블로그 글 30개 내외", timing: "무난함" },
    },
    {
      trackName: "Snooze",
      artistName: "SZA",
      soundConcept: mockConcept,
      connectionReason: "드럼이 정박보다 늦게 떨어지는 레이백 그루브가 곡 전체의 느낌을 결정합니다.",
      awarenessMetric: { level: 4, melon: "TOP100 진입 이력 없음", youtube: "한국어 반응 영상 약 80개", naver: "블로그 글 100개 이상", timing: "지금 올리기 좋음" },
    },
    {
      trackName: "After Last Night",
      artistName: "Silk Sonic",
      soundConcept: mockConcept,
      connectionReason: "베이스와 드럼이 비트 뒤에 앉는 레이백 리듬감이 곡의 여유로운 질감을 만들어냅니다.",
      awarenessMetric: { level: 4, melon: "TOP100 진입 이력 없음", youtube: "한국어 반응 영상 약 60개", naver: "블로그 글 80개 내외", timing: "무난함" },
    },
    {
      trackName: "Redbone",
      artistName: "Childish Gambino",
      soundConcept: mockConcept,
      connectionReason: "오프비트 하이햇과 레이백 드럼이 만들어내는 독특한 그루브가 이 곡의 핵심입니다.",
      awarenessMetric: { level: 5, melon: "TOP100 진입 이력 있음", youtube: "한국어 반응 영상 200개 이상", naver: "블로그 글 500개 이상", timing: "타이밍 아님" },
    },
    {
      trackName: "ICU",
      artistName: "Coco Jones",
      soundConcept: mockConcept,
      connectionReason: "보컬이 박자 뒤에 유유히 놓이는 레이백 처리가 감정 밀도를 높이는 방식으로 작동합니다.",
      awarenessMetric: { level: 3, melon: "TOP100 진입 이력 없음", youtube: "한국어 반응 영상 약 25개", naver: "블로그 글 40개 내외", timing: "지금 올리기 좋음" },
    },
  ];

  return seeds.map((item, index) => ({
    id: crypto.randomUUID(),
    ...item,
    hookFit: deriveHookFitFromAwarenessMetric(item.awarenessMetric),
    researchSources: [
      source(
        `${item.artistName} 공식 페이지`,
        `https://example.com/research/${index + 1}`,
        `${item.trackName} 관련 기본 레퍼런스`,
      ),
    ],
    displayOrder: index + 1,
  }));
}

export function buildMockMainTrackAnalysis(): MainTrackAnalysis {
  return {
    concept: "레이백",
    conceptExplanation:
      "보컬이나 악기가 박자보다 살짝 뒤에 얹히는 기법입니다. 악보상 정박에 맞추는 게 아니라 의도적으로 늦게 시작해서 느슨하고 여유로운 그루브를 만들어냅니다. 이 곡에서는 보컬 라인이 비트 뒤에 따라오는 방식으로 이 느낌이 납니다.",
    conceptSource: "ai_inference",
  };
}
