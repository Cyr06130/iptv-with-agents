"use client";

import type { Channel } from "@/lib/types";

type ChannelListProps = {
  channels: Channel[];
  onSelect: (channel: Channel) => void;
  selectedId?: string;
  editMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onEpgClick?: (channel: Channel) => void;
};

export function ChannelList({
  channels,
  onSelect,
  selectedId,
  editMode,
  selectedIds,
  onToggleSelect,
  onEpgClick,
}: ChannelListProps): JSX.Element {
  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)] text-sm">
        No channels found
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-y-auto h-full p-3">
      {channels.map((channel, index) => {
        const isSelected = channel.id === selectedId;
        const isChecked = editMode && selectedIds?.has(channel.id);
        return (
          <div
            key={`${channel.id}-${index}`}
            className={`flex items-center gap-2 rounded-lg border transition-all duration-200 ${
              isChecked
                ? "ring-1 ring-accent/40 border-accent/30 bg-accent-soft"
                : isSelected
                  ? "bg-accent-soft border-accent/30"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:shadow-sm"
            }`}
          >
            {editMode && (
              <label className="flex items-center pl-3 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isChecked ?? false}
                  onChange={() => onToggleSelect?.(channel.id)}
                  className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
                />
              </label>
            )}
            <button
              onClick={() => onSelect(channel)}
              className="flex-1 p-3 text-left min-w-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--color-surface-secondary)] flex-shrink-0">
                  {channel.logo_url ? (
                    <img
                      src={channel.logo_url}
                      alt={channel.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-text-tertiary)] text-xs font-mono">
                      TV
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-medium text-sm text-[var(--color-text-primary)] truncate">
                      {channel.name}
                    </h3>
                    {channel.is_live && (
                      <span className="flex items-center gap-1 text-xs text-success shrink-0">
                        <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <span className="inline-block px-1.5 py-0.5 bg-[var(--color-surface-secondary)] rounded-sm text-xs text-[var(--color-text-tertiary)] font-mono">
                    {channel.group}
                  </span>
                </div>
              </div>
            </button>
            {!editMode && channel.tvg_id && onEpgClick && (
              <button
                type="button"
                title="Program Guide"
                onClick={(e) => {
                  e.stopPropagation();
                  onEpgClick(channel);
                }}
                className="pr-3 text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors shrink-0"
              >
                <svg
                  className="w-8 h-6"
                  fill="currentColor"
                  viewBox="0 0 200 140"
                >
                  <rect x="4" y="4" width="192" height="132" rx="18" ry="18" fill="none" stroke="currentColor" strokeWidth="14" />
                  <text x="100" y="95" textAnchor="middle" fontSize="72" fontWeight="bold" fontFamily="sans-serif" fill="currentColor">EPG</text>
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
