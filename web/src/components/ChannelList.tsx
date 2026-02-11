"use client";

import type { Channel } from "@/lib/types";

type ChannelListProps = {
  channels: Channel[];
  onSelect: (channel: Channel) => void;
  selectedId?: string;
};

export function ChannelList({
  channels,
  onSelect,
  selectedId,
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
        return (
          <button
            key={`${channel.id}-${index}`}
            onClick={() => onSelect(channel)}
            className={`w-full p-3 rounded-lg border transition-all duration-200 text-left ${
              isSelected
                ? "bg-accent-soft border-accent/30"
                : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--color-surface-secondary)] flex-shrink-0">
                {channel.logo_url ? (
                  <img
                    src={channel.logo_url}
                    alt={channel.name}
                    className="w-full h-full object-cover"
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
        );
      })}
    </div>
  );
}
