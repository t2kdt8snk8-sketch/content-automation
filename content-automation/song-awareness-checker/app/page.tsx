"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from "recharts";

// ─── 타입 ─────────────────────────────────────────────────────────

interface ScoreData {
  awarenessScore: number;
  availableSources: number;
  breakdown: {
    googleTrendsWeb: number | null;
    googleTrendsYouTube: number | null;
    lastfm: number | null;
    lastfmNormalized: number | null;
  };
  meta: {
    trackName: string;
    artistName: string;
    lastfmPlaycount: number | null;
    isMock: boolean;
    errors: string[];
  };
}

type TrackInput = { id: string; track: string; artist: string };

type TrackResult =
  | (ScoreData & { id: string; status: "done" })
  | { id: string; status: "loading" }
  | { id: string; status: "error"; message: string };

interface HistoryEntry {
  id: string;
  timestamp: number;
  tracks: { trackName: string; artistName: string; score: number }[];
}

// ─── 유틸 ─────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function newRow(): TrackInput {
  return { id: uid(), track: "", artist: "" };
}

function parseTrackArtist(value: string): { track: string; artist: string } | null {
  const match = value.match(/^\s*(.+?)\s*[-–—]\s*(.+?)\s*$/);
  if (!match) return null;

  const [, track, artist] = match;
  if (!track || !artist) return null;

  return {
    track: track.trim(),
    artist: artist.trim(),
  };
}

function normalizeTrackForSearch(track: string): string {
  const original = track.trim();

  const cleaned = original
    .replace(/\((?:feat|ft)\.?\s+[^)]+\)/gi, "")
    .replace(/\[(?:feat|ft)\.?\s+[^\]]+\]/gi, "")
    .replace(/\s+(?:feat|ft)\.?\s+.+$/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || original;
}

function formatNum(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#ca8a04";
  return "#dc2626";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "한국에서 많이 알려진 곡";
  if (score >= 40) return "한국에서 어느 정도 알려진 곡";
  return "아직 한국에선 덜 알려진 곡";
}

function trendsEvidence(score: number | null): string {
  if (score === null) return "데이터 없음";
  if (score >= 70) return "한국에서 검색 반응이 활발함";
  if (score >= 40) return "한국에서 검색 반응이 꾸준한 편";
  return "한국에서 검색 반응이 아직 크지 않음";
}

function lastfmEvidence(score: number | null, listeners: number | null): string {
  const l = listeners !== null ? `${formatNum(listeners)}명 청취자` : "";
  if (score === null) return "데이터 없음";
  if (score >= 70) return `해외 포함 청취 규모가 큰 편 · ${l}`;
  if (score >= 40) return `해외 포함 청취층이 어느 정도 있음 · ${l}`;
  return `글로벌 청취 규모는 아직 작은 편 · ${l}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const HISTORY_KEY = "sac_history";

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);
  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="9" />
        <circle
          cx="56" cy="56" r={radius} fill="none"
          stroke={color} strokeWidth="9"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-gray-500 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function BarMeter({ label, value, note }: { label: string; value: number | null; note?: string }) {
  const pct = value !== null ? Math.round(value) : null;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-semibold text-gray-900">{label}</span>
        <div className="flex items-baseline gap-1.5">
          {note && <span className="text-[11px] text-gray-500">{note}</span>}
          <span className="text-sm font-bold text-gray-900">{pct !== null ? pct : "—"}</span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-900 rounded-full transition-all duration-700"
          style={{ width: pct !== null ? `${pct}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function TrackCard({ result }: { result: TrackResult }) {
  if (result.status === "loading") {
    return (
      <div className="border border-gray-200 rounded-2xl p-6 flex items-center justify-center h-48">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">측정 중…</p>
        </div>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="border border-red-100 bg-red-50 rounded-2xl p-6 flex items-center justify-center h-48">
        <p className="text-sm text-red-600 text-center">{result.message}</p>
      </div>
    );
  }

  const { awarenessScore, breakdown, meta, availableSources } = result;
  const label = scoreLabel(awarenessScore);
  const color = scoreColor(awarenessScore);

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gray-50 px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
          <span className="text-gray-500">♪</span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 truncate">{meta.trackName}</p>
          <p className="text-sm text-gray-700 truncate">{meta.artistName}</p>
        </div>
        {meta.isMock && (
          <span className="ml-auto text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">
            MOCK
          </span>
        )}
      </div>

      {/* 스코어 */}
      <div className="px-5 py-5 flex items-center gap-5 border-b border-gray-100">
        <ScoreRing score={awarenessScore} />
        <div>
          <p className="text-base font-bold" style={{ color }}>{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{availableSources}개 데이터 기준</p>
          {meta.errors.length > 0 && (
            <p className="text-xs text-red-500 mt-1">{meta.errors.join(" · ")}</p>
          )}
        </div>
      </div>

      {/* 지표 */}
      <div className="px-5 py-5 space-y-4">
        <BarMeter label="한국 검색 반응" value={breakdown.googleTrendsWeb} note="가중치 75%" />
        <BarMeter label="유튜브 검색 반응" value={breakdown.googleTrendsYouTube} note="참고용" />
        <BarMeter label="글로벌 청취 규모" value={breakdown.lastfmNormalized} note="가중치 25%" />
      </div>

      {/* 근거 */}
      <div className="px-5 pb-5 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">점수 근거</p>
        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2 text-xs text-gray-700">
          <p>
            <span className="font-semibold text-gray-900">Last.fm</span>
            {" · "}
            {lastfmEvidence(breakdown.lastfmNormalized, breakdown.lastfm)}
            {meta.lastfmPlaycount !== null && (
              <span className="text-gray-500"> · 누적 {formatNum(meta.lastfmPlaycount)}회 재생</span>
            )}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Google Trends KR</span>
            {" · "}
            {trendsEvidence(breakdown.googleTrendsWeb)}
            {breakdown.googleTrendsWeb !== null && (
              <span className="text-gray-500"> ({breakdown.googleTrendsWeb}/100)</span>
            )}
          </p>
          {breakdown.googleTrendsYouTube !== null && (
            <p className="text-gray-500">
              유튜브 검색 반응 {breakdown.googleTrendsYouTube}/100 · 참고용 지표
            </p>
          )}
        </div>

        {/* 원본 수치 */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-600">청취자 수</p>
            <p className="text-base font-bold text-gray-900">{formatNum(breakdown.lastfm)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-600">누적 재생 수</p>
            <p className="text-base font-bold text-gray-900">{formatNum(meta.lastfmPlaycount)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────

export default function Home() {
  const [inputs, setInputs] = useState<TrackInput[]>([newRow(), newRow()]);
  const [results, setResults] = useState<Map<string, TrackResult>>(new Map());
  const [loading, setLoading] = useState(false);
  const [useMock, setUseMock] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // 히스토리 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryEntry[]);
    } catch {}
  }, []);

  function saveHistory(entries: HistoryEntry[]) {
    setHistory(entries);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  }

  function removeHistoryEntry(id: string) {
    const updated = history.filter((entry) => entry.id !== id);
    saveHistory(updated);
  }

  // 입력 변경
  function updateInput(id: string, field: "track" | "artist", value: string) {
    setInputs((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        if (field === "track") {
          const parsed = parseTrackArtist(value);
          if (parsed) {
            return { ...r, track: parsed.track, artist: parsed.artist };
          }
        }

        return { ...r, [field]: value };
      })
    );
  }

  function addRow() {
    if (inputs.length < 5) setInputs((prev) => [...prev, newRow()]);
  }

  function removeRow(id: string) {
    if (inputs.length > 1) setInputs((prev) => prev.filter((r) => r.id !== id));
  }

  const validInputs = inputs.filter((r) => r.track.trim() && r.artist.trim());

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (validInputs.length === 0 || loading) return;

      setLoading(true);

      // 모든 유효 행을 loading 상태로 초기화
      const initMap = new Map<string, TrackResult>();
      validInputs.forEach((r) => initMap.set(r.id, { id: r.id, status: "loading" }));
      setResults(initMap);

      // 병렬 호출
      const fetches = validInputs.map(async (row) => {
        const normalizedTrack = normalizeTrackForSearch(row.track);
        const params = new URLSearchParams({
          track: normalizedTrack,
          artist: row.artist.trim(),
          ...(useMock ? { mock: "true" } : {}),
        });
        try {
          const res = await fetch(`/api/score?${params}`);
          if (!res.ok) {
            const body = await res.json();
            return { id: row.id, status: "error" as const, message: body.error ?? `HTTP ${res.status}` };
          }
          const data = (await res.json()) as ScoreData;
          return { id: row.id, status: "done" as const, ...data };
        } catch (err) {
          return { id: row.id, status: "error" as const, message: err instanceof Error ? err.message : "오류 발생" };
        }
      });

      const settled = await Promise.allSettled(fetches);
      const newMap = new Map<string, TrackResult>(initMap);

      settled.forEach((r) => {
        if (r.status === "fulfilled") {
          newMap.set(r.value.id, r.value);
        }
      });

      setResults(newMap);
      setLoading(false);

      // 히스토리 저장
      const historyTracks = settled
        .filter((r) => r.status === "fulfilled" && r.value.status === "done")
        .map((r) => {
          const v = (r as PromiseFulfilledResult<TrackResult>).value as ScoreData & { id: string; status: "done" };
          return { trackName: v.meta.trackName, artistName: v.meta.artistName, score: v.awarenessScore };
        });

      if (historyTracks.length > 0) {
        const entry: HistoryEntry = { id: uid(), timestamp: Date.now(), tracks: historyTracks };
        const updated = [entry, ...history].slice(0, 20);
        saveHistory(updated);
      }
    },
    [validInputs, loading, useMock, history]
  );

  // 비교 차트용 데이터
  const chartData = validInputs
    .map((row) => {
      const r = results.get(row.id);
      if (!r || r.status !== "done") return null;
      return {
        name: `${r.meta.artistName} — ${r.meta.trackName}`.slice(0, 28),
        score: r.awarenessScore,
      };
    })
    .filter(Boolean) as { name: string; score: number }[];

  const hasResults = chartData.length > 0;

  return (
    <main className="min-h-screen bg-white font-sans">
      {/* 헤더 */}
      <header className="border-b border-gray-200 px-8 py-5 flex items-center justify-between sticky top-0 bg-white z-10">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
            Black Music Magazine
          </p>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-none mt-0.5">
            Song Awareness Dashboard
          </h1>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={useMock}
            onChange={(e) => setUseMock(e.target.checked)}
            className="rounded border-gray-300 text-gray-900 focus:ring-0"
          />
          목 데이터
        </label>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        {/* 입력 영역 */}
        <section>
          <p className="text-2xl font-bold text-gray-900 mb-1">이 곡들, 한국에서 얼마나 알려져 있을까?</p>
          <p className="text-sm text-gray-600 mb-6">한국 검색 반응 중심으로 최대 5곡까지 비교</p>

          <form onSubmit={handleSearch} className="space-y-3">
            {inputs.map((row, i) => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="w-5 text-sm font-bold text-gray-400 text-right flex-shrink-0">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={row.track}
                  onChange={(e) => updateInput(row.id, "track", e.target.value)}
                  placeholder="곡명"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900 transition"
                />
                <input
                  type="text"
                  value={row.artist}
                  onChange={(e) => updateInput(row.id, "artist", e.target.value)}
                  placeholder="아티스트명"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900 transition"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={inputs.length === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              {inputs.length < 5 && (
                <button
                  type="button"
                  onClick={addRow}
                  className="text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition"
                >
                  + 곡 추가
                </button>
              )}
              <button
                type="submit"
                disabled={loading || validInputs.length === 0}
                className="flex-1 bg-gray-900 text-white text-sm font-bold rounded-lg py-2.5 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {loading ? "분석 중…" : `${validInputs.length}곡 한국 인지도 보기`}
              </button>
            </div>
          </form>
        </section>

        {/* 비교 차트 */}
        {hasResults && (
          <section>
            <p className="text-sm font-bold uppercase tracking-widest text-gray-700 mb-4">
              한국 인지도 비교
            </p>
            <div className="border border-gray-200 rounded-2xl p-6">
              <ResponsiveContainer width="100%" height={chartData.length * 52 + 20}>
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={190}
                    tick={{ fontSize: 12, fill: "#111827", fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#f9fafb" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0];
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-sm">
                          <p className="font-semibold text-gray-900">{d.payload.name}</p>
                          <p style={{ color: scoreColor(d.value as number) }} className="font-bold">
                            {d.value} / 100
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={scoreColor(entry.score)} />
                    ))}
                    <LabelList
                      dataKey="score"
                      position="right"
                      style={{ fontSize: 12, fontWeight: 700, fill: "#111827" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* 개별 카드 */}
        {results.size > 0 && (
          <section>
            <p className="text-sm font-bold uppercase tracking-widest text-gray-700 mb-4">
              곡별 상세
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {validInputs.map((row) => {
                const r = results.get(row.id);
                if (!r) return null;
                return <TrackCard key={row.id} result={r} />;
              })}
            </div>
          </section>
        )}

        {/* 히스토리 */}
        {history.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold uppercase tracking-widest text-gray-700">
                최근 조회 기록
              </p>
              <button
                type="button"
                onClick={() => saveHistory([])}
                className="text-xs text-gray-400 hover:text-gray-700 transition"
              >
                전체 기록 지우기
              </button>
            </div>
            <div className="space-y-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="border border-gray-100 rounded-xl px-4 py-3 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <p className="text-xs text-gray-500 flex-shrink-0 mt-0.5 w-24">
                      {formatDate(entry.timestamp)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {entry.tracks.map((t, i) => (
                        <span
                          key={i}
                          className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1"
                        >
                          <span className="font-medium text-gray-900">
                            {t.artistName} — {t.trackName}
                          </span>
                          <span
                            className="font-bold"
                            style={{ color: scoreColor(t.score) }}
                          >
                            {t.score}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHistoryEntry(entry.id)}
                    className="text-xs text-gray-400 hover:text-gray-700 transition flex-shrink-0"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
