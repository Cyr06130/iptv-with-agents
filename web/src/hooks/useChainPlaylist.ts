"use client";

import { useState, useCallback } from "react";
import { submitPlaylistToChain, loadPlaylistFromChain } from "@/lib/chain";
import type { Playlist, ChainPlaylistResponse } from "@/lib/types";
import type { PolkadotSigner } from "polkadot-api/signer";

export type ChainStatus = "idle" | "signing" | "submitting" | "confirmed" | "error";

type UseChainPlaylistReturn = {
  chainStatus: ChainStatus;
  chainError: string | null;
  loadError: string | null;
  saveToChain: (address: string, source: string, playlist: Playlist, signer?: PolkadotSigner) => Promise<void>;
  loadFromChain: (address: string) => Promise<ChainPlaylistResponse | null>;
};

export function useChainPlaylist(): UseChainPlaylistReturn {
  const [chainStatus, setChainStatus] = useState<ChainStatus>("idle");
  const [chainError, setChainError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const saveToChain = useCallback(
    async (address: string, source: string, playlist: Playlist, signer?: PolkadotSigner): Promise<void> => {
      try {
        setChainError(null);
        setChainStatus("submitting");
        await submitPlaylistToChain(
          address,
          source,
          playlist.name,
          playlist.channels,
          signer
        );
        setChainStatus("confirmed");
      } catch (err) {
        setChainError(err instanceof Error ? err.message : "Failed to save to chain");
        setChainStatus("error");
      }
    },
    []
  );

  const loadFromChain = useCallback(
    async (address: string): Promise<ChainPlaylistResponse | null> => {
      try {
        setLoadError(null);
        const response = await loadPlaylistFromChain(address);
        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load from chain";
        setLoadError(msg);
        return null;
      }
    },
    []
  );

  return { chainStatus, chainError, loadError, saveToChain, loadFromChain };
}
