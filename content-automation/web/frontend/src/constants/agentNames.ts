// web/frontend/src/constants/agentNames.ts

export const AGENT_DISPLAY_NAMES = {
  research_agent: '리서처',
  strategy_agent: '전략가',
  copy_agent: '카피라이터',
  script_agent: '스크립터',
  image_prompt_agent: '이미지 디렉터',
  format_agent: '포맷터',
  scanner_agent: '트렌드 스캐너',
} as const;

/** Known fixed types + arbitrary agent name strings (e.g. 'research_agent').
 *  `string` is intentional — overlay types include dynamic agent IDs. */
export type OverlayType = 'chat' | 'production' | 'whiteboard' | string;
