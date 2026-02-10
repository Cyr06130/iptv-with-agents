"use client";

import { useWallet } from "@/hooks/useWallet";

export function WalletButton(): JSX.Element {
  const { account, isConnecting, connect, disconnect } = useWallet();

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (account) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-muted">
          {truncateAddress(account.address)}
        </span>
        <button
          onClick={disconnect}
          className="px-4 py-2 bg-surface hover:bg-surface/80 text-text rounded-lg border border-border transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
