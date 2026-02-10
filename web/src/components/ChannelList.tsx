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
      <div className="flex items-center justify-center h-full text-text-muted">
        No channels found
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto h-full p-4">
      {channels.map((channel) => {
        const isSelected = channel.id === selectedId;
        return (
          <button
            key={channel.id}
            onClick={() => onSelect(channel)}
            className={`w-full p-3 rounded-lg border transition-all text-left ${
              isSelected
                ? "bg-primary/20 border-primary"
                : "bg-surface border-border hover:border-border/60 hover:bg-surface/80"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded overflow-hidden bg-background flex-shrink-0">
                {channel.logo_url ? (
                  <img
                    src={channel.logo_url}
                    alt={channel.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                    No Logo
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-text truncate">
                    {channel.name}
                  </h3>
                  {channel.is_live && (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      Live
                    </span>
                  )}
                </div>
                <span className="inline-block px-2 py-0.5 bg-background rounded text-xs text-text-muted">
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
