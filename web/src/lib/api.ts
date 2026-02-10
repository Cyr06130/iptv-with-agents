import type { Playlist } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function fetchPlaylist(): Promise<Playlist> {
  const res = await fetch(`${API_URL}/api/playlist`);
  if (!res.ok) {
    throw new Error(`Failed to fetch playlist: ${res.status}`);
  }
  return res.json() as Promise<Playlist>;
}
