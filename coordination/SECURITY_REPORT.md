# Security Audit Report

## Audit Scope
Chain interaction layer: `web/src/lib/chain.ts`, `web/src/lib/wallet-service.ts`,
`web/src/hooks/useChainPlaylist.ts`, `web/src/components/VideoPlayer.tsx`,
`web/src/components/ChannelList.tsx`, `web/next.config.mjs`

## Findings Summary

| ID  | Severity | Title                                      | Status  |
|-----|----------|--------------------------------------------|---------|
| F1  | CRITICAL | Hardcoded Dev Key (Alice) in Client Bundle | Open    |
| F2  | HIGH     | IPFS Fetch Uses Unverified CID             | Open    |
| F3  | HIGH     | Gzip Decompression Bomb                    | Open    |
| F4  | HIGH     | Unvalidated stream_url/logo_url            | Open    |
| F5  | MEDIUM   | Remark Delimiter Injection                 | Open    |
| F6  | MEDIUM   | No WebSocket RPC Call Timeout              | Open    |
| F7  | MEDIUM   | Sequential 500-Block Scan Performance      | Open    |
| F8  | MEDIUM   | Unsafe JSON.parse on WebSocket Messages    | Open    |
| F9  | MEDIUM   | logo_url Enables User Tracking             | Open    |
| F10 | LOW      | No Content Security Policy                 | Open    |
| F11 | LOW      | No Reconnection Strategy for PAPI Client   | Open    |
| F12 | LOW      | Weak simpleHash Function                   | Open    |

## Architect Review Notes

### F1: CRITICAL -- Hardcoded Dev Key (Alice) Ships in Client Bundle
**Location:** `web/src/lib/chain.ts:77-88`
**Confirmed.** The `DEV_PHRASE` import from `@polkadot-labs/hdkd-helpers` is the well-known
Substrate development mnemonic ("bottom drive obey lake curtain smoke basket hold race lonely...").
`getAliceSigner()` is called unconditionally on every `submitPlaylistToChain()` invocation at line 266.
The wallet-service.ts provides `getSignerForAddress()` which is never used by chain.ts.

**Additional concern:** Since Alice is used for `Sudo.sudo()` calls (line 285-287), this means
any user of the app can execute privileged sudo operations on the bulletin chain. In production
this is a governance risk even if the bulletin chain is a test/demo chain.

**Remediation approach:**
1. Gate `getAliceSigner()` behind `process.env.NEXT_PUBLIC_USE_DEV_KEY === "true"`
2. When env var is unset/false, `submitPlaylistToChain` must accept an external signer parameter
3. Integrate wallet-service.ts signer into the chain submission flow
4. Tree-shake hdkd imports when dev key is disabled

### F2: HIGH -- IPFS Fetch Uses Unverified CID
**Location:** `web/src/lib/chain.ts:346-352`
**Confirmed.** The `loadPlaylistFromChain()` fetches from IPFS gateway using a CID extracted from
an on-chain remark, but never verifies that the fetched content actually matches the CID hash.
An attacker could:
- Compromise the IPFS gateway to serve different content for a valid CID
- Perform a DNS hijack on `ipfs.dotspark.app` to serve arbitrary gzipped M3U files

**Remediation:** After fetch, recompute `computeCID(compressed)` and compare `.toString()` to
`pointer.cid`. Reject on mismatch. Also add a max response size check (e.g., 10MB).

### F3: HIGH -- Gzip Decompression Bomb
**Location:** `web/src/lib/chain.ts:128-150`
**Confirmed.** The `gzipDecompress()` function accumulates chunks with no size limit.
A malicious 1KB compressed payload could decompress to gigabytes, crashing the browser tab.
The fetch at line 347-348 has a 15s timeout but no size limit on the response body.

**Remediation:**
- Add `MAX_COMPRESSED_SIZE = 10 * 1024 * 1024` (10MB) check on fetch response
- Add `MAX_DECOMPRESSED_SIZE = 50 * 1024 * 1024` (50MB) accumulator limit in gzipDecompress
- Abort decompression stream if limit exceeded

### F4: HIGH -- Unvalidated stream_url/logo_url from On-Chain Data
**Location:** `web/src/components/VideoPlayer.tsx:25,37-38`, `web/src/components/ChannelList.tsx:40-45`
**Confirmed.** URLs from on-chain data are rendered directly:
- `VideoPlayer`: `src` prop passed to `hls.loadSource(src)` and `video.src = src`
- `ChannelList`: `channel.logo_url` rendered as `<img src={channel.logo_url}>`

An attacker could store `javascript:alert(1)` or `data:text/html,...` URLs on-chain.
While modern browsers block `javascript:` in `<img src>`, `data:` URIs could be exploited
in video contexts and `javascript:` could be an issue if URLs are ever used in `<a href>`.

**Remediation:** Create a `sanitizeUrl()` utility that validates protocol is `http:` or `https:`
only. Apply at the data ingestion boundary (parseM3U, expandChannels) not at render time.

### F5: MEDIUM -- Remark Delimiter Injection
**Location:** `web/src/lib/chain.ts:304-306, 439`
**Confirmed.** The remark format `IPTVCID:{address}:{name}:{cid}` uses `:` as delimiter.
If a user's playlist name contains `:`, the `lastIndexOf(":")` parsing at line 439 will
incorrectly split the name/CID boundary. Example: playlist name "My:Playlist" would cause
CID to be "Playlist" and name to be "My".

**Remediation:** URL-encode the `name` field in the remark (encodeURIComponent), decode on parse.

### F6: MEDIUM -- No WebSocket RPC Call Timeout
**Location:** `web/src/lib/chain.ts:475-540`
**Confirmed.** The `createJsonRpcCaller` pending map entries have no timeout. If the WebSocket
connection stalls or a response is never received, the Promise hangs indefinitely.

**Remediation:** Add a per-call timeout (10 seconds) that rejects the pending promise and
removes it from the map.

### F7: MEDIUM -- Sequential 500-Block Scan Performance
**Location:** `web/src/lib/chain.ts:399-417`
**Confirmed.** Up to 1000 sequential RPC calls (2 per block: getBlockHash + getBlock) for a
500-block scan. This is extremely slow (30+ seconds on typical connections).

**Remediation:**
- Batch blocks in groups (e.g., 10 concurrent requests using Promise.all)
- Add AbortController support so users can cancel the scan
- Reduce default SCAN_BLOCK_LIMIT or add pagination

### F8: MEDIUM -- Unsafe JSON.parse on WebSocket Messages
**Location:** `web/src/lib/chain.ts:492-505`
**Confirmed.** `JSON.parse(event.data)` at line 493 has no try/catch. A malformed WebSocket
message will throw an uncaught exception, potentially crashing the scan.

**Remediation:** Wrap in try/catch, log warning, and continue.

### F9: MEDIUM -- logo_url Enables User Tracking (Duplicate of F4)
**Location:** `web/src/components/ChannelList.tsx:40-45`
Attacker-controlled logo_url loaded as `<img src>` makes HTTP requests to attacker servers,
leaking IP addresses. Subsumed by F4 fix (URL validation) but consider also proxying logos
through the backend in a future phase.

### F10: LOW -- No Content Security Policy
**Location:** `web/next.config.mjs`
**Confirmed.** No security headers configured. The config only has webpack customization.

**Remediation:** Add security headers via `next.config.mjs` `headers()` function:
- `Content-Security-Policy` restricting script-src, connect-src, img-src, media-src
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### F11: LOW -- No Reconnection Strategy for PAPI Client
**Location:** `web/src/lib/chain.ts:47-71`
**Confirmed.** The singleton `getBulletinApi()` caches the client but never checks if the
WebSocket has disconnected. Once the connection drops, all subsequent calls will fail.

**Remediation:** Add connection health check. On failure, reset `bulletinClient`, `bulletinApi`,
and `initPromise` to null, then re-initialize.

### F12: LOW -- Weak simpleHash Function
**Location:** `web/src/lib/chain.ts:213-221`
**Confirmed.** DJB2 hash variant that returns a 32-bit integer as hex. Collision probability
is high for large channel lists. However, this is only used for React list keys and channel
selection state, not for security purposes.

**Remediation:** Replace with a truncated blake2b hash (already imported) for better collision
resistance. Low priority since collisions only affect UI behavior, not security.

## Additional Findings from Code Review

### A1: MEDIUM -- signSubmitAndWatch subscription never unsubscribed
**Location:** `web/src/lib/chain.ts:290-301, 312-325`
The `.subscribe()` calls in `submitPlaylistToChain` never call `.unsubscribe()` after receiving
the "finalized" event. This could leak resources if the observable continues emitting.

### A2: LOW -- useChainPlaylist silently swallows load errors
**Location:** `web/src/hooks/useChainPlaylist.ts:45-47`
The `loadFromChain` callback catches all errors and returns `null`. The user gets no feedback
that the chain scan failed.

### A3: LOW -- No input validation on address parameter
**Location:** `web/src/lib/chain.ts:259, 338`
The `address` parameter in `submitPlaylistToChain` and `loadPlaylistFromChain` is not validated
as a valid SS58 address before being used in remark construction and hex searching.

### A4: INFO -- eslint-disable for any type in RPC caller
**Location:** `web/src/lib/chain.ts:518-519`
The `// eslint-disable-next-line @typescript-eslint/no-explicit-any` override should be removed
by properly typing the caller function.
