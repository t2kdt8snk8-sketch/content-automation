export type LastfmResult = {
  listeners: number;
  playcount: number;
  trackName: string;
  artistName: string;
  isMock: boolean;
};

const MOCK_DATA: LastfmResult = {
  listeners: 820000,
  playcount: 5400000,
  trackName: "Mock Track",
  artistName: "Mock Artist",
  isMock: true,
};

export async function fetchLastfm(
  track: string,
  artist: string,
  useMock = false
): Promise<LastfmResult> {
  if (useMock || !process.env.LASTFM_API_KEY) {
    return MOCK_DATA;
  }

  const apiKey = process.env.LASTFM_API_KEY;
  const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Last.fm API error: ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    return {
      listeners: 0,
      playcount: 0,
      trackName: track,
      artistName: artist,
      isMock: false,
    };
  }

  const info = data.track;
  return {
    listeners: parseInt(info.listeners ?? "0", 10),
    playcount: parseInt(info.playcount ?? "0", 10),
    trackName: info.name as string,
    artistName: info.artist?.name as string,
    isMock: false,
  };
}
