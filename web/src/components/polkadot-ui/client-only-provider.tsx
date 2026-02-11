"use client";

import dynamic from "next/dynamic";

export const ClientOnlyPolkadotProvider = dynamic(
  () =>
    import("./polkadot-provider").then((mod) => {
      // Polyfill crypto.randomUUID (not available on older mobile browsers)
      if (typeof globalThis !== "undefined" && globalThis.crypto && !globalThis.crypto.randomUUID) {
        globalThis.crypto.randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
          return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
            (
              Number(c) ^
              (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
            ).toString(16),
          ) as `${string}-${string}-${string}-${string}-${string}`;
        };
      }
      return mod.PolkadotProvider;
    }),
  { ssr: false },
);
