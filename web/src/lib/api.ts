import type { Playlist } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function fetchPlaylist(): Promise<Playlist> {
  const res = await fetch(`${API_URL}/api/playlist`);
  if (!res.ok) {
    throw new Error(`Failed to fetch playlist: ${res.status}`);
  }
  return res.json() as Promise<Playlist>;
}

export async function uploadPlaylist(file: File): Promise<{ status: string; channels_loaded: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/playlist/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Failed to upload playlist: ${res.status}`);
  }
  return res.json() as Promise<{ status: string; channels_loaded: number }>;
}
