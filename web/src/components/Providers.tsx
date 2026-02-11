"use client";

import { ClientOnlyPolkadotProvider } from "@/components/polkadot-ui/client-only-provider";

export function Providers({ children }: { children: React.ReactNode }): JSX.Element {
  return <ClientOnlyPolkadotProvider>{children}</ClientOnlyPolkadotProvider>;
}
