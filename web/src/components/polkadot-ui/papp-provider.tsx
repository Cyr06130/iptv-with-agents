"use client";

import { PappProvider } from "@novasamatech/host-papp-react-ui";
import { getPappAdapter } from "@/config/papp";
import { useMemo, type ReactNode } from "react";

export function PappProviderWrapper({ children }: { children: ReactNode }): JSX.Element {
  const adapter = useMemo(() => getPappAdapter(), []);

  return <PappProvider adapter={adapter}>{children}</PappProvider>;
}
