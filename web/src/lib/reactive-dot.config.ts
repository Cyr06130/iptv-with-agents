import { defineConfig } from "@reactive-dot/core";
import { InjectedWalletProvider } from "@reactive-dot/core/wallets.js";
import { getWsProvider } from "polkadot-api/ws-provider";
import { bulletinchain } from "@polkadot-api/descriptors";

const bulletinProvider = getWsProvider("wss://bulletin.dotspark.app");

export const config = defineConfig({
  chains: {
    bulletinchain: {
      descriptor: bulletinchain,
      provider: bulletinProvider,
    },
  },
  wallets: [new InjectedWalletProvider()],
});
