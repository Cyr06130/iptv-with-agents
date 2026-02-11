"use client";

import { useEffect, useRef, useCallback } from "react";

type LoadFromChainPromptProps = {
  playlistName: string;
  channelCount: number;
  blockNumber: number;
  onAccept: () => void;
  onDismiss: () => void;
};

export function LoadFromChainPrompt({
  playlistName,
  channelCount,
  blockNumber,
  onAccept,
  onDismiss,
}: LoadFromChainPromptProps): JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onDismiss]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    acceptRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-grey-950/70 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chain-prompt-title"
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="chain-prompt-title" className="font-serif text-xl text-[var(--color-text-primary)] mb-2">
          On-Chain Playlist Found
        </h2>
        <p className="text-[var(--color-text-secondary)] text-sm mb-5 leading-relaxed">
          A playlist was found on-chain for your wallet. Would you like to load it?
        </p>
        <div className="bg-[var(--color-surface-secondary)] rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-tertiary)]">Name</span>
            <span className="text-[var(--color-text-primary)] font-medium">{playlistName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-tertiary)]">Channels</span>
            <span className="text-[var(--color-text-primary)] font-medium">{channelCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-tertiary)]">Block</span>
            <span className="font-mono text-xs text-[var(--color-text-primary)]">#{blockNumber}</span>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="px-5 py-2.5 border-2 border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl font-medium text-sm hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-secondary)] transition-all duration-200"
          >
            Dismiss
          </button>
          <button
            ref={acceptRef}
            type="button"
            onClick={onAccept}
            className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-hover active:bg-accent-active transition-colors duration-200"
          >
            Load Playlist
          </button>
        </div>
      </div>
    </div>
  );
}
