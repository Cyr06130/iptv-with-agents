"use client";

import type { Signer } from "@polkadot/types/types";

const APP_NAME = "IPTV_Stream";

export type DetectedWallet = {
  id: string;
  name: string;
  installed: boolean;
};

export type WalletAccount = {
  address: string;
  name?: string;
  source: string;
};

/** Known wallet metadata keyed by injectedWeb3 id. */
const WALLET_META: Record<string, string> = {
  talisman: "Talisman",
  "subwallet-js": "SubWallet",
  "polkadot-js": "Polkadot{.js}",
  "fearless-wallet": "Fearless Wallet",
  polkagate: "PolkaGate",
  enkrypt: "Enkrypt",
};

/**
 * Detect installed Polkadot wallet extensions by reading
 * `window.injectedWeb3`.
 */
export function getAvailableWallets(): DetectedWallet[] {
  if (typeof window === "undefined" || !window.injectedWeb3) return [];

  const wallets: DetectedWallet[] = [];
  for (const key of Object.keys(window.injectedWeb3)) {
    wallets.push({
      id: key,
      name: WALLET_META[key] ?? key,
      installed: true,
    });
  }
  return wallets;
}

/**
 * Wait for at least one wallet extension to appear in `window.injectedWeb3`.
 * Extensions may register after DOMContentLoaded so we poll briefly.
 */
export async function waitForWallets(timeoutMs = 2000): Promise<DetectedWallet[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const wallets = getAvailableWallets();
    if (wallets.length > 0) return wallets;
    await new Promise((r) => setTimeout(r, 200));
  }
  return getAvailableWallets();
}

/**
 * Enable wallet extensions and retrieve all accounts.
 * Uses `@polkadot/extension-dapp` which is the standard Polkadot extension API
 * (same as the demo's PolkadotWalletService).
 */
export async function connectWallet(): Promise<WalletAccount[]> {
  const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");

  const extensions = await web3Enable(APP_NAME);
  if (extensions.length === 0) {
    throw new Error(
      "No Polkadot wallet extensions found. Install Talisman, SubWallet, or Polkadot{.js}."
    );
  }

  const allAccounts = await web3Accounts();
  if (allAccounts.length === 0) {
    throw new Error("No accounts found. Create an account in your wallet extension.");
  }

  return allAccounts.map((acct) => ({
    address: acct.address,
    name: acct.meta.name ?? undefined,
    source: acct.meta.source,
  }));
}

/**
 * Obtain the PJS signer for a given address.
 * Used by `chain.ts` to sign `system.remarkWithEvent` extrinsics.
 */
export async function getSignerForAddress(address: string): Promise<Signer> {
  const { web3Enable, web3FromAddress } = await import("@polkadot/extension-dapp");

  // Ensure extensions are enabled (idempotent).
  await web3Enable(APP_NAME);

  const injector = await web3FromAddress(address);
  return injector.signer;
}
