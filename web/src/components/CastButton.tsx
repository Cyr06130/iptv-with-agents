"use client";

import { useState, useRef, useEffect } from "react";
import type { PeerDevice, DeviceType, PendingOutgoingTransfer } from "@/lib/sync-types";

type CastButtonProps = {
  peers: PeerDevice[];
  pending: PendingOutgoingTransfer | null;
  onSend: (targetDeviceType: DeviceType) => void;
};

const DEVICE_ICONS: Record<DeviceType, string> = {
  mobile: "\u{1F4F1}",
  desktop: "\u{1F5A5}\uFE0F",
  web: "\u{1F310}",
};

export function CastButton({ peers, pending, onSend }: CastButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Dedupe peers by device type, or fall back to default targets
  const DEFAULT_TARGETS: PeerDevice[] = [
    { name: "Mobile", type: "mobile", peerId: "" },
    { name: "Desktop App", type: "desktop", peerId: "" },
    { name: "Web Browser", type: "web", peerId: "" },
  ];

  let targets: PeerDevice[];
  if (peers.length > 0) {
    const uniqueTypes = new Map<DeviceType, PeerDevice>();
    for (const peer of peers) {
      if (!uniqueTypes.has(peer.type)) {
        uniqueTypes.set(peer.type, peer);
      }
    }
    targets = Array.from(uniqueTypes.values());
  } else {
    targets = DEFAULT_TARGETS;
  }

  if (pending) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] text-xs">
        <span className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        Waiting for approval...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-surface-secondary)]/80 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
          <line x1="2" y1="20" x2="2.01" y2="20" />
        </svg>
        Send to
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 right-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden min-w-[160px] z-20">
          {targets.map((peer) => (
            <button
              key={peer.type}
              type="button"
              onClick={() => {
                onSend(peer.type);
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors text-left"
            >
              <span>{DEVICE_ICONS[peer.type]}</span>
              <span>{peer.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
