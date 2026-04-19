import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? "입력값을 확인해 주세요.",
      },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

  return NextResponse.json({ error: message }, { status: 500 });
}
