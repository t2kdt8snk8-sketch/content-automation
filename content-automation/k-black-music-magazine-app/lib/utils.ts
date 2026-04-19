export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function extractJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("JSON 응답을 찾지 못했습니다.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(firstBrace, index + 1);
      }
    }
  }

  throw new Error("JSON 객체의 끝을 찾지 못했습니다.");
}

export function safeJsonParse<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const repaired = text
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[“”]/g, "\"")
      .replace(/[‘’]/g, "'");

    try {
      return JSON.parse(repaired) as T;
    } catch {
      const excerpt = repaired.slice(0, 800);
      const message = error instanceof Error ? error.message : "JSON 파싱 실패";
      throw new Error(`${message}\n\n응답 일부:\n${excerpt}`);
    }
  }
}
