"use client";

import { AccountId } from "@polkadot-api/substrate-bindings";
import { createAccountsProvider } from "@novasamatech/product-sdk";
import type { PolkadotSigner } from "polkadot-api";
import { useEffect, useState } from "react";

export type HostAccount = {
  address: string;
  name?: string;
  publicKey: Uint8Array;
};

type UseHostAccountsResult = {
  accounts: HostAccount[];
  loading: boolean;
  isHosted: boolean;
};

/**
 * Returns true when running inside Polkadot Desktop (Electron webview) or an iframe.
 * Safe to call during SSR — returns false when window is undefined.
 */
export function isHostedEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return window.__HOST_WEBVIEW_MARK__ === true || window !== window.top;
}

/**
 * Fetches accounts provided by the host (Polkadot Desktop) when running
 * in a hosted environment. Returns an empty list when not hosted.
 */
export function useHostAccounts(): UseHostAccountsResult {
  const [accounts, setAccounts] = useState<HostAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const isHosted = isHostedEnvironment();

  useEffect(() => {
    if (!isHosted) return;

    let cancelled = false;
    setLoading(true);

    const provider = createAccountsProvider();
    Promise.resolve(provider.getNonProductAccounts())
      .then((result) => {
        if (cancelled) return;

        if (result.isOk()) {
          const hostAccounts: HostAccount[] = result.value.map((raw) => {
            const address = AccountId().dec(raw.publicKey);
            return {
              address,
              name: raw.name,
              publicKey: raw.publicKey,
            };
          });
          setAccounts(hostAccounts);
        } else {
          setAccounts([]);
        }
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isHosted]);

  return { accounts, loading, isHosted };
}

/**
 * Returns a PAPI-compatible PolkadotSigner that delegates signing to the
 * host's SignPayloadModal. Pass the raw publicKey from HostAccount.
 */
export function getHostSigner(publicKey: Uint8Array): PolkadotSigner {
  const provider = createAccountsProvider();
  return provider.getNonProductAccountSigner({
    dotNsIdentifier: "",
    derivationIndex: 0,
    publicKey,
  });
}
