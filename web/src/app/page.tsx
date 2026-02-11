"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaylist } from "@/hooks/usePlaylist";
import { useChainPlaylist } from "@/hooks/useChainPlaylist";
import { useUnifiedAccount } from "@/contexts/UnifiedAccountContext";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ChannelList } from "@/components/ChannelList";
import { SearchBar } from "@/components/SearchBar";
import { UploadButton } from "@/components/UploadButton";
import { SaveToChainButton } from "@/components/SaveToChainButton";
import { LoadFromChainPrompt } from "@/components/LoadFromChainPrompt";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import type { Channel, ChainPlaylistResponse } from "@/lib/types";

export default function Home(): JSX.Element {
  const {
    playlist,
    filteredChannels,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    liveOnly,
    setLiveOnly,
    refreshPlaylist,
    setPlaylistData,
    removeChannels,
  } = usePlaylist();

  const { selectedAccount: account } = useUnifiedAccount();
  const { loadFromChain } = useChainPlaylist();

  const totalChannels = playlist?.channels.length ?? 0;
  const liveChannels = playlist?.channels.filter((ch) => ch.is_live).length ?? 0;
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  const [chainPrompt, setChainPrompt] = useState<ChainPlaylistResponse | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function handleToggleEditMode(): void {
    if (editMode) {
      setSelectedForDelete(new Set());
    }
    setEditMode(!editMode);
  }

  function handleToggleSelect(id: string): void {
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleConfirmDelete(): Promise<void> {
    await removeChannels(selectedForDelete);
    setSelectedForDelete(new Set());
    setEditMode(false);
    setShowDeleteModal(false);
  }

  const checkChainPlaylist = useCallback(
    async (address: string): Promise<void> => {
      const response = await loadFromChain(address);
      if (response?.found && response.playlist) {
        setChainPrompt(response);
      }
    },
    [loadFromChain]
  );

  useEffect(() => {
    if (account) {
      checkChainPlaylist(account.address);
    } else {
      setChainPrompt(null);
    }
  }, [account, checkChainPlaylist]);

  function handleAcceptChainPlaylist(): void {
    if (chainPrompt?.playlist) {
      setPlaylistData(chainPrompt.playlist);
    }
    setChainPrompt(null);
  }

  function handleDismissChainPrompt(): void {
    setChainPrompt(null);
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-[var(--color-text-tertiary)] text-sm">Loading playlist...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-error text-sm">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      <div className="w-1/3 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-bg)]">
        {/* Toolbar */}
        <div className="p-4 border-b border-[var(--color-border)] space-y-3">
          <div className="flex gap-2">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search channels..."
            />
            <UploadButton onUploadComplete={refreshPlaylist} />
            {totalChannels > 0 && (
              <button
                type="button"
                onClick={handleToggleEditMode}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  editMode
                    ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                    : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/80"
                }`}
              >
                {editMode ? "Done" : "Edit"}
              </button>
            )}
          </div>

          {/* Stats row + live filter + delete/chain save */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[var(--color-text-tertiary)] tracking-widest uppercase">
                {totalChannels} channels
              </span>
              {liveChannels > 0 && (
                <button
                  type="button"
                  onClick={() => setLiveOnly(!liveOnly)}
                  aria-pressed={liveOnly}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                    liveOnly
                      ? "bg-success/15 text-success ring-1 ring-success/30"
                      : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/80"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${liveOnly ? "bg-success animate-pulse" : "bg-success/60"}`} />
                  {liveChannels} live
                </button>
              )}
            </div>
            {editMode && selectedForDelete.size > 0 ? (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete ({selectedForDelete.size})
              </button>
            ) : (
              account && playlist && playlist.channels.length > 0 && (
                <SaveToChainButton
                  address={account.address}
                  source={account.source}
                  playlist={playlist}
                />
              )
            )}
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-hidden">
          <ChannelList
            channels={filteredChannels}
            onSelect={setSelectedChannel}
            selectedId={selectedChannel?.id}
            editMode={editMode}
            selectedIds={selectedForDelete}
            onToggleSelect={handleToggleSelect}
          />
        </div>
      </div>

      {/* Player */}
      <div className="w-2/3 p-6 bg-[var(--color-bg)]">
        <VideoPlayer
          src={selectedChannel?.stream_url ?? null}
          poster={selectedChannel?.logo_url ?? undefined}
        />
      </div>

      {/* Chain playlist prompt */}
      {chainPrompt?.found && chainPrompt.playlist && (
        <LoadFromChainPrompt
          playlistName={chainPrompt.playlist.name}
          channelCount={chainPrompt.playlist.channels.length}
          blockNumber={chainPrompt.block_number ?? 0}
          onAccept={handleAcceptChainPlaylist}
          onDismiss={handleDismissChainPrompt}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <ConfirmDeleteModal
          count={selectedForDelete.size}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
