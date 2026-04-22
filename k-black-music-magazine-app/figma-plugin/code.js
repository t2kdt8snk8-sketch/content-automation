figma.showUI(__html__, { width: 300, height: 340, title: "K-Black 템플릿 내보내기" });

const TEMPLATE_SECTION_NAME = "TEMPLATE · SZA Carousel (Editable)";
const TEMPLATE_FRAME_NAMES = [
  "01 TEMPLATE · COVER",
  "02 TEMPLATE · PROVOKE",
  "03 TEMPLATE · HOOK INSIGHT",
];

const HIGHLIGHT_GREEN = { r: 0.18, g: 0.545, b: 0.29 };

function toSolid(color) {
  return [{ type: "SOLID", color }];
}

function sortedTextNodes(frame) {
  return frame
    .findAll((n) => n.type === "TEXT")
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

async function ensureTextFontsLoaded(textNode) {
  if (textNode.fontName !== figma.mixed) {
    await figma.loadFontAsync(textNode.fontName);
    return;
  }
  const len = textNode.characters.length;
  if (len <= 0) return;
  const fonts = textNode.getRangeAllFontNames(0, len);
  const uniq = new Map();
  for (const f of fonts) uniq.set(`${f.family}::${f.style}`, f);
  await Promise.all(Array.from(uniq.values()).map((f) => figma.loadFontAsync(f)));
}

async function setText(node, value) {
  await ensureTextFontsLoaded(node);
  node.characters = value || "";
}

function applyPointWord(textNode, fullText, pointWord) {
  if (!pointWord || !fullText) return;
  const start = fullText.indexOf(pointWord);
  if (start < 0) return;
  const end = start + pointWord.length;
  try {
    textNode.setRangeFills(start, end, toSolid(HIGHLIGHT_GREEN));
  } catch {
    // Keep export resilient even if range style fails.
  }
}

function resolveTemplateSection() {
  return figma.currentPage.findOne(
    (n) => n.type === "SECTION" && n.name === TEMPLATE_SECTION_NAME,
  );
}

function resolveTemplateFrames(section) {
  const frames = [];
  for (const name of TEMPLATE_FRAME_NAMES) {
    const frame = section.findOne((n) => n.type === "FRAME" && n.name === name);
    if (!frame || frame.type !== "FRAME") {
      throw new Error(`템플릿 프레임 누락: ${name}`);
    }
    frames.push(frame);
  }
  return frames;
}

function pickTemplateIndex(slide) {
  if (slide.section === "cover") return 0;
  if (slide.section === "provoke") return 1;
  return 2;
}

async function applySlideText(frame, slide, hookTrack) {
  const texts = sortedTextNodes(frame);
  if (texts.length === 0) return;

  if (slide.section === "cover") {
    await setText(texts[0], slide.headline || "[커버 헤드라인]");
    return;
  }

  if (slide.section === "provoke") {
    await setText(texts[0], hookTrack || "[HOOK TRACK]");
    if (texts[1]) {
      await setText(texts[1], slide.headline || `${hookTrack} 들으면서 이것도 모르는 거 아니죠?`);
    }
    return;
  }

  await setText(texts[0], slide.headline || "[헤드라인]");
  if (texts[1]) {
    const body = slide.body || "[본문]";
    await setText(texts[1], body);
    applyPointWord(texts[1], body, slide.pointWord || "");
  }
}

function placeFramesNearTemplate(frames, section) {
  const gap = 80;
  let x = section.x + section.width + 320;
  const y = section.y + 120;
  for (const frame of frames) {
    frame.x = x;
    frame.y = y;
    x += frame.width + gap;
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg.type !== "create-slides") return;

  try {
    const payload = msg.payload || {};
    const slides = Array.isArray(payload.slides) ? payload.slides : [];
    const hookTrack = payload.hookTrack || "";
    if (slides.length === 0) {
      throw new Error("내보낼 슬라이드가 없습니다.");
    }

    const section = resolveTemplateSection();
    if (!section || section.type !== "SECTION") {
      throw new Error(`템플릿 섹션을 찾지 못했습니다: ${TEMPLATE_SECTION_NAME}`);
    }
    const templates = resolveTemplateFrames(section);

    const created = [];
    for (let i = 0; i < slides.length; i += 1) {
      const slide = slides[i];
      const tIndex = pickTemplateIndex(slide);

      const frame = templates[tIndex].clone();
      frame.name = `${String(i + 1).padStart(2, "0")} ${slide.section || "slide"}`;
      await applySlideText(frame, slide, hookTrack);
      created.push(frame);
    }

    placeFramesNearTemplate(created, section);
    figma.currentPage.selection = created;
    figma.viewport.scrollAndZoomIntoView(created);
    figma.ui.postMessage({ type: "done", count: created.length });
  } catch (err) {
    figma.ui.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
