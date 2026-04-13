import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ArchiveEntry {
  mainTrack: string;
  mainArtist: string;
  hookTrack: string;
  hookArtist: string;
  concept: string;
  awarenessLevel?: number;
  captionAngle?: string;
}

export async function saveToArchive(entry: ArchiveEntry): Promise<void> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return;

  await supabase.from("archive").insert({
    main_track: entry.mainTrack,
    main_artist: entry.mainArtist,
    hook_track: entry.hookTrack,
    hook_artist: entry.hookArtist,
    concept: entry.concept,
    awareness_level: entry.awarenessLevel ?? null,
    caption_angle: entry.captionAngle ?? null,
  });
}

export async function getArchive(): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("archive")
    .select("hook_track, hook_artist, concept, main_track, main_artist")
    .order("created_at", { ascending: false })
    .limit(30);

  if (!data) return [];

  return data.map(
    (row) =>
      `훅: ${row.hook_track} (${row.hook_artist}) / 개념: ${row.concept} / 메인: ${row.main_track} (${row.main_artist})`,
  );
}
