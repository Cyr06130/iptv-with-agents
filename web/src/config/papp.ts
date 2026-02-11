"use client";

import { createPappAdapter, SS_UNSTABLE_STAGE_ENDPOINTS, type PappAdapter } from "@novasamatech/host-papp";
import { createLazyClient, createPapiStatementStoreAdapter } from "@novasamatech/statement-store";
import { getWsProvider } from "@polkadot-api/ws-provider";

const DEV_METADATA_URL =
  "https://gist.githubusercontent.com/valentunn/97938ca74b8d984f62ec95c7e633e24f/raw/b52f8ca43d8c3661d4360b16ca54652ad0a4f664/test_metadata.json";

export const PAPP_CONFIG = {
  appId:
    process.env.NEXT_PUBLIC_PAPP_APP_ID || "https://iptv.dotspark.app",
  metadataUrl:
    process.env.NEXT_PUBLIC_PAPP_METADATA_URL || DEV_METADATA_URL,
  useUnstableEndpoints:
    process.env.NEXT_PUBLIC_PAPP_USE_UNSTABLE === "true",
} as const;

let cachedAdapter: PappAdapter | null = null;

export function getPappAdapter(): PappAdapter {
  if (!cachedAdapter) {
    const adapters = PAPP_CONFIG.useUnstableEndpoints
      ? {
          lazyClient: createLazyClient(getWsProvider(SS_UNSTABLE_STAGE_ENDPOINTS)),
        }
      : undefined;

    cachedAdapter = createPappAdapter({
      appId: PAPP_CONFIG.appId,
      metadata: PAPP_CONFIG.metadataUrl,
      adapters,
    });
  }
  return cachedAdapter;
}
