"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchPlaylist } from "@/lib/api";
import type { Playlist, Channel } from "@/lib/types";

type UsePlaylistReturn = {
  playlist: Playlist | null;
  filteredChannels: Channel[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  liveOnly: boolean;
  setLiveOnly: (value: boolean) => void;
  refreshPlaylist: () => Promise<void>;
  setPlaylistData: (data: Playlist) => void;
};

export function usePlaylist(): UsePlaylistReturn {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);

  const loadPlaylist = useCallback(async (): Promise<void> => {
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
  }, []);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  const filteredChannels = useMemo(() => {
    if (!playlist) return [];

    let channels = playlist.channels;

    if (liveOnly) {
      channels = channels.filter((ch) => ch.is_live);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter(
        (channel) =>
          channel.name.toLowerCase().includes(query) ||
          channel.group.toLowerCase().includes(query)
      );
    }

    return channels;
  }, [playlist, searchQuery, liveOnly]);

  const setPlaylistData = useCallback((data: Playlist): void => {
    setPlaylist(data);
    setError(null);
    setLoading(false);
  }, []);

  return {
    playlist,
    filteredChannels,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    liveOnly,
    setLiveOnly,
    refreshPlaylist: loadPlaylist,
    setPlaylistData,
  };
}
