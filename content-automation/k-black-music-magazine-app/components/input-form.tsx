"use client";

import { useState } from "react";

interface InputFormProps {
  onSubmit: (values: { mainTrack: string; mainArtist: string }) => Promise<void>;
  disabled?: boolean;
}

export function InputForm({ onSubmit, disabled = false }: InputFormProps) {
  const [mainTrack, setMainTrack] = useState("");
  const [mainArtist, setMainArtist] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({ mainTrack, mainArtist });
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium text-cream/80" htmlFor="main-track">
          메인 곡명
        </label>
        <input
          id="main-track"
          value={mainTrack}
          onChange={(event) => setMainTrack(event.target.value)}
          placeholder="예: Redbone"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-base text-cream outline-none placeholder:text-cream/35 focus:border-bronze"
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-cream/80" htmlFor="main-artist">
          메인 아티스트명
        </label>
        <input
          id="main-artist"
          value={mainArtist}
          onChange={(event) => setMainArtist(event.target.value)}
          placeholder="예: Childish Gambino"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-base text-cream outline-none placeholder:text-cream/35 focus:border-bronze"
          disabled={disabled}
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="flex w-full items-center justify-center rounded-2xl bg-bronze px-5 py-4 text-base font-semibold text-white transition hover:bg-[#b47641] disabled:cursor-not-allowed disabled:bg-bronze/45"
      >
        {disabled ? "리서치 진행 중..." : "리서치 시작"}
      </button>
    </form>
  );
}
