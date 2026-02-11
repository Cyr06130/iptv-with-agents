"use client";

import { useChainPlaylist } from "@/hooks/useChainPlaylist";
import type { Playlist } from "@/lib/types";

type SaveToChainButtonProps = {
  address: string;
  source: string;
  playlist: Playlist;
};

const STATUS_LABELS: Record<string, string> = {
  idle: "Save to Chain",
  signing: "Signing...",
  submitting: "Submitting...",
  confirmed: "Saved!",
  error: "Retry Save",
};

export function SaveToChainButton({
  address,
  source,
  playlist,
}: SaveToChainButtonProps): JSX.Element {
  const { chainStatus, chainError, saveToChain } = useChainPlaylist();

  const isDisabled = chainStatus === "signing" || chainStatus === "submitting";

  async function handleClick(): Promise<void> {
    // TODO: Convert PJS wallet signer to PAPI PolkadotSigner for production use
    await saveToChain(address, source, playlist, undefined);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isDisabled}
        onClick={handleClick}
        className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
          chainStatus === "confirmed"
            ? "bg-success text-white"
            : chainStatus === "error"
              ? "bg-error hover:bg-error/90 text-white"
              : "bg-grey-900 dark:bg-grey-100 text-white dark:text-grey-900 hover:bg-grey-800 dark:hover:bg-grey-200"
        }`}
      >
        {STATUS_LABELS[chainStatus] ?? "Save to Chain"}
      </button>
      {chainError && (
        <span className="text-xs text-error max-w-[200px] truncate" title={chainError}>
          {chainError}
        </span>
      )}
    </div>
  );
}
