"use client";

import { useState, useCallback } from "react";

type InjectedAccountWithMeta = {
  address: string;
  meta: {
    name?: string;
    source: string;
  };
};

type UseWalletReturn = {
  account: InjectedAccountWithMeta | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

export function useWallet(): UseWalletReturn {
  const [account, setAccount] = useState<InjectedAccountWithMeta | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      if (typeof window === "undefined") {
        throw new Error("Window not available");
      }

      const { web3Enable, web3Accounts } = await import(
        "@polkadot/extension-dapp"
      );

      const extensions = await web3Enable("IPTV Stream");
      if (extensions.length === 0) {
        throw new Error("No Polkadot extension found");
      }

      const accounts = await web3Accounts();
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
  }, []);

  return { account, isConnecting, connect, disconnect };
}
