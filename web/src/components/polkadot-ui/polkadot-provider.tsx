"use client";

import { config } from "@/lib/reactive-dot.config";
import { UnifiedAccountProvider } from "@/contexts/UnifiedAccountContext";
import { ReactiveDotProvider } from "@reactive-dot/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { PappProviderWrapper } from "./papp-provider";

const queryClient = new QueryClient();

export function PolkadotProvider({ children }: { children: ReactNode }): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ReactiveDotProvider config={config}>
        <PappProviderWrapper>
          <UnifiedAccountProvider>{children}</UnifiedAccountProvider>
        </PappProviderWrapper>
      </ReactiveDotProvider>
    </QueryClientProvider>
  );
}
