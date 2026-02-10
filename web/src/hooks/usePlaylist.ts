"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchPlaylist } from "@/lib/api";
import type { Playlist, Channel } from "@/lib/types";

type UsePlaylistReturn = {
  playlist: Playlist | null;
  filteredChannels: Channel[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
};

export function usePlaylist(): UsePlaylistReturn {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadPlaylist(): Promise<void> {
      try {
        setLoading(true);
        const data = await fetchPlaylist();
        setPlaylist(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load playlist");
        setPlaylist(null);
      } finally {
        setLoading(false);
      }
    }

    loadPlaylist();
  }, []);

  const filteredChannels = useMemo(() => {
    if (!playlist) return [];
    if (!searchQuery.trim()) return playlist.channels;

    const query = searchQuery.toLowerCase();
    return playlist.channels.filter(
      (channel) =>
        channel.name.toLowerCase().includes(query) ||
        channel.group.toLowerCase().includes(query)
    );
  }, [playlist, searchQuery]);

  return {
    playlist,
    filteredChannels,
    loading,
    error,
    searchQuery,
    setSearchQuery,
  };
}
