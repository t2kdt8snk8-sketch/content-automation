import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "검증 단계가 제거되었습니다." }, { status: 410 });
}
