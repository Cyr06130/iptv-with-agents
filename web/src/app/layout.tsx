import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { ConnectWallet } from "@/components/ConnectWallet";
import "./globals.css";

export const metadata: Metadata = {
  title: "IPTV for friends!",
  description: "Decentralized IPTV streaming",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <Providers>
          <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
            <header className="sticky top-0 z-40 h-16 bg-[var(--color-surface)]/95 backdrop-blur-xl border-b border-[var(--color-border)] px-6 md:px-12">
              <div className="h-full flex items-center justify-between max-w-[1536px] mx-auto">
                <h1 className="font-serif text-2xl text-[var(--color-text-primary)] tracking-tight">
                  IPTV for friends!
                </h1>
                <ConnectWallet />
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
