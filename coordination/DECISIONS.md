# Architectural Decisions

## 2024-01-01: Project Structure
- Adopted Axum backend + FRAME pallets + Next.js frontend architecture
- See ADRs in `docs/decisions/` for detailed rationale

## 2026-02-11: Security Remediation Sprint -- Chain Interaction Layer

### Context
Security audit of the chain interaction layer identified 13 findings (1 CRITICAL, 3 HIGH,
5 MEDIUM, 3 LOW) plus 4 additional findings from architect code review. This decision
documents the remediation approach and task decomposition.

### Decision: Phased Remediation in 3 Waves

**Wave 1 (CRITICAL + HIGH) -- Must-fix before any deployment:**
- F1: Dev key gating + wallet signer integration
- F2: CID verification after IPFS fetch
- F3: Decompression bomb protection (size limits)
- F4: URL sanitization utility + application at data boundaries

**Wave 2 (MEDIUM) -- Fix before beta:**
- F5: URL-encode playlist name in remark
- F6: WebSocket RPC call timeout
- F7: Concurrent block scanning with AbortController
- F8: Safe JSON.parse in WebSocket handler
- A1: Unsubscribe from signSubmitAndWatch observables

**Wave 3 (LOW + cleanup) -- Fix before v1.0:**
- F10: Content Security Policy headers
- F11: PAPI client reconnection
- F12: Better hash function
- A2-A4: Error feedback, address validation, type cleanup

### Decision: URL Sanitization at Data Boundary
URLs will be validated at the **data ingestion** layer (parseM3U, expandChannels,
loadPlaylistFromChain) rather than at render time. This prevents malicious URLs from
ever entering the application state. The sanitizeUrl utility will:
- Parse URL using the `URL` constructor
- Validate `protocol` is `http:` or `https:`
- Return `null` for invalid URLs, which existing components already handle

### Decision: Signer Architecture
The `submitPlaylistToChain` function signature will change to accept an optional
`PolkadotSigner` parameter. When provided, it uses the external signer directly.
When absent and `NEXT_PUBLIC_USE_DEV_KEY === "true"`, it falls back to Alice.
When absent and dev key is disabled, it throws an error.

The `SaveToChainButton` component will need to obtain a PAPI-compatible signer from
the wallet extension. Since `wallet-service.ts` currently returns a PJS `Signer` type,
we will need a bridge or direct PAPI signer creation from the extension.

### Decision: Block Scan Concurrency
Replace sequential block scanning with batched concurrent requests:
- Process blocks in batches of 10 using `Promise.all`
- Accept an `AbortSignal` parameter to allow cancellation
- This reduces 500-block scan time from ~30s to ~5s

### Decision: CSP Configuration
The Content Security Policy must allow:
- `script-src 'self'` (plus `'unsafe-eval'` for WASM if needed by PAPI)
- `connect-src 'self' wss://bulletin.dotspark.app https://ipfs.dotspark.app`
- `img-src 'self' https: data:` (data: needed for inline SVGs, https: for logos)
- `media-src 'self' https: blob:` (blob: needed for hls.js)
- `frame-ancestors 'none'`
