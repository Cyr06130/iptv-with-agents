"use client";

import { useState } from "react";
import { usePlaylist } from "@/hooks/usePlaylist";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ChannelList } from "@/components/ChannelList";
import { SearchBar } from "@/components/SearchBar";
import type { Channel } from "@/lib/types";

export default function Home(): JSX.Element {
  const {
    filteredChannels,
    loading,
    error,
    searchQuery,
    setSearchQuery,
  } = usePlaylist();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  if (loading) {
    return (
      <div className="h-[calc(100vh-73px)] flex items-center justify-center">
        <div className="text-text-muted">Loading playlist...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-73px)] flex items-center justify-center">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-73px)] flex">
      <div className="w-1/3 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search channels..."
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <ChannelList
            channels={filteredChannels}
            onSelect={setSelectedChannel}
            selectedId={selectedChannel?.id}
          />
        </div>
      </div>
      <div className="w-2/3 p-6">
        <VideoPlayer
          src={selectedChannel?.stream_url ?? null}
          poster={selectedChannel?.logo_url ?? undefined}
        />
      </div>
    </div>
  );
}
