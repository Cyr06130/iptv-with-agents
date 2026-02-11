"use client";

import dynamic from "next/dynamic";
import { WalletProvider } from "@/contexts/WalletContext";

/**
 * Client-only wrapper that prevents SSR errors from wallet extensions
 * reading `window.injectedWeb3`.
 *
 * Pattern taken from the Spektr SDK demo's ClientOnlyPolkadotProvider.
 */
function InnerProviders({ children }: { children: React.ReactNode }): JSX.Element {
  return <WalletProvider>{children}</WalletProvider>;
}

export const Providers = dynamic(() => Promise.resolve(InnerProviders), {
  ssr: false,
});
