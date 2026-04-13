import type { CopyDraft, SlideDraft } from "@/types/workflow";

const HEADLINE_FONT = `"Noto Serif KR", "Noto Serif", serif`;
const BODY_FONT = `"Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const QUOTE_STYLE = `font-family: 'Noto Serif KR', serif; font-weight: 700; color: #2E8B4A;`;
const OPEN_QUOTE = `<span style="${QUOTE_STYLE}">&#x201C;</span>`;
const CLOSE_QUOTE = `<span style="${QUOTE_STYLE}">&#x201D;</span>`;

function applyPointWord(bodyHtml: string, pointWord?: string): string {
  if (!pointWord) return bodyHtml;
  const escaped = escapeHtml(pointWord);
  return bodyHtml.replace(escaped, `${OPEN_QUOTE} <strong>${escaped}</strong> ${CLOSE_QUOTE}`);
}

export function renderSlideHtml(
  copyDraft: CopyDraft,
  slide: SlideDraft,
  index: number,
) {
  const isCover = slide.section === "cover";
  const isProvoke = slide.section === "provoke";
  const provokeHeadline = `${escapeHtml(copyDraft.hookTrack)} 들으면서<br>이것도 모르는 거 아니죠?`;

  const bodyHtml = applyPointWord(escapeHtml(slide.body ?? "").replace(/\n/g, "<br />"), slide.pointWord);

  // 폰트 경로: 한글 디렉토리명 등 non-ASCII 문자 처리
  const fontBase = `file://${encodeURI(process.cwd())}/public/fonts`;

  const fontFaces = `
    @font-face {
      font-family: "Noto Serif KR";
      src: url("${fontBase}/noto-serif-kr/NotoSerifKR-Bold.ttf") format("truetype");
      font-weight: 700;
      font-style: normal;
    }
    @font-face {
      font-family: "Playfair Display";
      src: url("${fontBase}/playfairdisplay/PlayfairDisplay-Bold.ttf") format("truetype");
      font-weight: 700;
      font-style: normal;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("${fontBase}/pretendard/Pretendard-Regular.otf") format("opentype");
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("${fontBase}/pretendard/Pretendard-Medium.otf") format("opentype");
      font-weight: 500;
      font-style: normal;
    }
    @font-face {
      font-family: "Pretendard";
      src: url("${fontBase}/pretendard/Pretendard-Bold.otf") format("opentype");
      font-weight: 700;
      font-style: normal;
    }
  `;

  // 커버: 텍스트 상단 고정 레이아웃 (피그마 COVER 슬라이드 기준)
  if (isCover) {
    return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <style>
      ${fontFaces}
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 1080px;
        height: 1350px;
        overflow: hidden;
        background: #111;
      }
      .frame { position: relative; width: 1080px; height: 1350px; overflow: hidden; }
      .headline {
        position: absolute;
        left: 50px;
        top: 79px;
        width: 980px;
        font-family: ${HEADLINE_FONT};
        font-weight: 700;
        font-size: 90px;
        line-height: 1.5;
        letter-spacing: -0.02em;
        color: #f5f0e8;
        word-break: keep-all;
        text-align: left;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <p class="headline">당신의 취향,<br>얼마나 알고 계시나요?</p>
    </div>
  </body>
</html>`;
  }

  // 프로보크: 훅 곡명(Playfair Display 96px) + 질문 텍스트(Noto Serif KR 40px)
  // 나머지(3~9장): headline + body 모두 slide 데이터 그대로, 아래에서 위로 쌓는 구조
  if (isProvoke) {
    return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <style>
      ${fontFaces}
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { width: 1080px; height: 1350px; overflow: hidden; background: #262626; }
      .frame { position: relative; width: 1080px; height: 1350px; overflow: hidden; }
      .hook-title {
        position: absolute;
        left: 95px;
        top: 131px;
        width: 566px;
        font-family: "Playfair Display", serif;
        font-weight: 700;
        font-size: 96px;
        line-height: normal;
        letter-spacing: -0.02em;
        color: #f5f0e8;
      }
      .question {
        position: absolute;
        left: 95px;
        top: 296px;
        width: 494px;
        font-family: ${HEADLINE_FONT};
        font-weight: 700;
        font-size: 40px;
        line-height: 60px;
        color: #f5f0e8;
        word-break: keep-all;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <p class="hook-title">${escapeHtml(copyDraft.hookTrack)}</p>
      <p class="question">${escapeHtml(copyDraft.hookTrack)} 들으면서 이것도<br>모르는 거 아니죠?</p>
    </div>
  </body>
</html>`;
  }

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <style>
      ${fontFaces}
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { width: 1080px; height: 1350px; overflow: hidden; background: #111; }
      .frame { position: relative; width: 1080px; height: 1350px; overflow: hidden; }
      .gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.88) 100%);
      }
      .text-block {
        position: absolute;
        bottom: 50px;
        left: 54px;
        width: 984px;
      }
      .headline {
        font-family: ${HEADLINE_FONT};
        font-weight: 700;
        font-size: 48px;
        line-height: 1.32;
        letter-spacing: -0.02em;
        color: #f5f0e8;
        word-break: keep-all;
        text-align: justify;
        margin-bottom: 28px;
      }
      .body {
        font-family: ${BODY_FONT};
        font-weight: 400;
        font-size: 36px;
        line-height: 55px;
        color: #f5f0e8;
        white-space: pre-wrap;
        word-break: keep-all;
        text-align: justify;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="gradient"></div>
      <div class="text-block">
        <p class="headline">${escapeHtml(slide.headline)}</p>
        ${slide.body ? `<p class="body">${bodyHtml}</p>` : ""}
      </div>
    </div>
  </body>
</html>`;
}
