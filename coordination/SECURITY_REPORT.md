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

---

# EPG Feature Security Review

## Audit Scope

EPG (Electronic Program Guide) feature added across backend and frontend:

**Backend (Rust/Axum):**
- `backend/src/models/epg.rs` -- EpgProgram, EpgSchedule, EpgNowNext, EpgCache
- `backend/src/services/epg_parser.rs` -- XMLTV parser using quick-xml 0.36
- `backend/src/routes/epg.rs` -- GET /api/epg/{channel_id}, GET /api/epg/{channel_id}/now
- `backend/src/config.rs` -- EPG_SOURCE_URL, EPG_TTL_HOURS, EPG_REFRESH_MINS
- `backend/src/main.rs` -- EPG cache init, background fetcher (fetch_and_load_epg, start_epg_fetcher)
- `backend/src/models/channel.rs` -- tvg_id field
- `backend/src/services/m3u_parser.rs` -- tvg-id extraction

**Frontend (TypeScript/React):**
- `web/src/lib/types.ts` -- EpgProgram, EpgSchedule, EpgNowNext types
- `web/src/hooks/useEpg.ts` -- EPG data fetching hook
- `web/src/components/EpgOverlay.tsx` -- EPG overlay UI component
- `web/src/components/ChannelList.tsx` -- EPG icon on channel rows

## EPG Findings Summary

| ID   | Severity | Title                                                 | Status |
|------|----------|-------------------------------------------------------|--------|
| E1   | MEDIUM   | SSRF via EPG_SOURCE_URL Environment Variable          | Open   |
| E2   | MEDIUM   | No HTTP Timeout on EPG Fetch                          | Open   |
| E3   | MEDIUM   | Unbounded EPG Response Body Download                  | Open   |
| E4   | LOW      | EPG Cache Has No Maximum Entry Limit                  | Open   |
| E5   | LOW      | Unvalidated icon_url from XMLTV Data                  | Open   |
| E6   | LOW      | channel_id Reflected in Error Response JSON           | Open   |
| E7   | INFO     | unwrap_or_default on Attribute Parsing Silently Drops | Open   |
| E8   | INFO     | CORS Allows All Origins                               | Open   |

## EPG Findings Detail

### E1: MEDIUM -- SSRF via EPG_SOURCE_URL Environment Variable

- **File**: `backend/src/main.rs:126`
- **Issue**: The `fetch_and_load_epg` function calls `reqwest::get(epg_url)` where `epg_url` comes from the `EPG_SOURCE_URL` environment variable. There is no validation that this URL points to an external XMLTV source versus an internal service. An operator misconfiguration or env injection could cause the backend to make requests to internal network addresses (e.g., `http://169.254.169.254/latest/meta-data/` on AWS, or `http://localhost:xxxx/admin`).
- **Risk**: Server-Side Request Forgery (SSRF). If the backend runs in a cloud environment, this could leak instance metadata, access internal APIs, or scan internal ports.
- **Recommendation**: Validate `EPG_SOURCE_URL` at startup:
  1. Require `https://` scheme (or at minimum `http://` -- reject `file://`, `ftp://`, etc.)
  2. Reject RFC 1918 private addresses, link-local (169.254.x.x), and loopback (127.x.x.x)
  3. Reject hostnames that resolve to private IPs (DNS rebinding defense)

### E2: MEDIUM -- No HTTP Timeout on EPG Fetch

- **File**: `backend/src/main.rs:126`
- **Issue**: `reqwest::get(epg_url)` uses the default reqwest client with no timeout configured. Compare with `channel_checker.rs:14-15` which correctly builds a client with `.timeout(timeout)`. A slow or unresponsive EPG server would block the async task indefinitely, preventing EPG cache refreshes and potentially leaking a tokio task slot.
- **Risk**: Denial of service via resource exhaustion if the EPG source hangs. The background fetcher loop at lines 160-171 would stall permanently.
- **Recommendation**: Build a dedicated `reqwest::Client` with a connect and response timeout (e.g., 30 seconds) for EPG fetches. Store it in `AppState` or construct it in `start_epg_fetcher`.

### E3: MEDIUM -- Unbounded EPG Response Body Download

- **File**: `backend/src/main.rs:126`
- **Issue**: The call `reqwest::get(epg_url).await?.text().await?` downloads the entire response body into memory as a `String` before passing it to the parser. While `parse_xmltv` checks `MAX_XML_SIZE` (50 MB) after the download, the download itself has no size limit. A malicious or misconfigured EPG source could serve a multi-gigabyte response, causing the backend to OOM-crash before the 50 MB check runs.
- **Risk**: Memory exhaustion denial of service. The backend process could be killed by the OS OOM killer.
- **Recommendation**: Use `reqwest::Response::bytes()` with a streaming reader that aborts after 50 MB. Alternatively, check `Content-Length` header first (though it can be spoofed, it provides an early rejection path), then stream with a byte counter.

### E4: LOW -- EPG Cache Has No Maximum Entry Limit

- **File**: `backend/src/models/epg.rs:57-58`
- **Issue**: `EpgCache.schedules` is a `HashMap<String, EpgSchedule>` with no capacity limit. The cache grows proportionally to the number of channels in the XMLTV feed that match `known_channel_ids`. While the `known_channel_ids` filter in `parse_xmltv` bounds this to channels in the loaded M3U playlist, an extremely large playlist (thousands of channels each with hundreds of programmes) could consume significant memory.
- **Risk**: Gradual memory growth. Low severity because the filter mechanism already bounds the data, but there is no hard upper limit.
- **Recommendation**: Consider adding a maximum programme count per channel (e.g., 200 programmes, covering ~1 week of hourly programming). Prune programmes with `end` times in the past during cache updates.

### E5: LOW -- Unvalidated icon_url from XMLTV Data

- **File**: `backend/src/services/epg_parser.rs:99-107`
- **Issue**: The `icon src` attribute from XMLTV programme elements is stored directly in `EpgProgram.icon_url` without URL validation. This URL is returned to the frontend via the API and could contain `javascript:`, `data:`, or `file://` URIs. This is the same class of issue as existing finding F4 (Unvalidated stream_url/logo_url).
- **Risk**: If the frontend renders `icon_url` as an image `src` or link `href`, it could be exploited for XSS or tracking. Currently `EpgOverlay.tsx` does not render `icon_url`, so the risk is latent but would surface if the UI is extended.
- **Recommendation**: Apply the same `sanitizeUrl()` protocol validation (allow only `http:` and `https:`) recommended in F4. Apply at the parser level before storing in the model.

### E6: LOW -- channel_id Reflected in Error Response JSON

- **File**: `backend/src/routes/epg.rs:31-33`
- **Issue**: The error response includes `"channel_id": channel_id` where `channel_id` is user-controlled input from the URL path. While JSON encoding prevents XSS in typical API consumers, if this response is ever rendered in a web page without proper escaping, the reflected value could be exploited. Additionally, reflecting arbitrary user input in error messages can aid enumeration.
- **Risk**: Low. Axum's JSON serialization via serde_json safely escapes special characters. React's JSX auto-escaping would also protect the frontend. The risk is theoretical.
- **Recommendation**: This is acceptable for development. In production, consider removing the reflection or truncating `channel_id` to a maximum length (e.g., 128 characters) to prevent abuse as a data exfiltration channel.

### E7: INFO -- unwrap_or_default on Attribute Parsing Silently Drops Errors

- **File**: `backend/src/services/epg_parser.rs:78-81`
- **Issue**: `std::str::from_utf8(attr_result.key.as_ref()).unwrap_or_default()` silently converts invalid UTF-8 attribute names and values to empty strings. This means malformed XML with invalid encoding will produce partial/incorrect results without any error indication.
- **Risk**: No security impact. Data quality issue only -- malformed XMLTV feeds could produce incomplete schedules with no logged warning.
- **Recommendation**: Consider logging a warning when UTF-8 conversion fails, so operators can diagnose bad EPG sources.

### E8: INFO -- CORS Allows All Origins (Existing)

- **File**: `backend/src/main.rs:80-83`
- **Issue**: The CORS middleware uses `Any` for origin, methods, and headers. This is noted as intentional for development. The EPG endpoints inherit this permissive policy.
- **Risk**: In production, any website could call the EPG API and extract schedule data. Since EPG data is not sensitive, the risk is informational, but it should be tightened before deployment.
- **Recommendation**: Restrict CORS origins to the frontend domain in production configuration.

## Approved (EPG)

The following aspects of the EPG implementation were reviewed and found to be satisfactory:

1. **XML Bomb / Billion Laughs Prevention**: `quick-xml` 0.36 does NOT expand DTD entities by default. The `Reader::from_str` constructor does not enable DTD processing, and `quick-xml`'s default configuration has `expand_empty_elements = false` and does not resolve external entities. The 50 MB `MAX_XML_SIZE` check in `epg_parser.rs:35-37` provides an additional layer of defense. XXE attacks are effectively mitigated.

2. **No External Entity (XXE) Injection**: `quick-xml` does not support loading external entities (no network or filesystem access during parsing). This is safe by design.

3. **Frontend XSS Protection**: All EPG data (title, description, category) is rendered via JSX curly-brace expressions in `EpgOverlay.tsx`, which React auto-escapes. There is no use of `dangerouslySetInnerHTML` or `innerHTML` anywhere in the EPG components. The search found zero matches across the entire `web/src/` directory.

4. **Input Validation on channel_id**: Axum's `Path<String>` extractor URL-decodes the path segment. The value is used only as a HashMap key lookup via `cache.get_schedule(&channel_id)`. There is no path traversal risk because no filesystem operations are performed with this value.

5. **EPG Parser Filtering**: The `known_channel_ids` filter in `parse_xmltv` ensures only channels present in the loaded M3U playlist are processed. This naturally bounds the cache size and prevents an attacker-controlled XMLTV source from injecting arbitrary channel data.

6. **Cache Staleness Check**: The TTL-based cache invalidation in `EpgCache::is_stale()` is correctly implemented using `Instant::elapsed()`, which is monotonic and not subject to clock skew.

7. **Background Fetcher Safety**: The `start_epg_fetcher` spawns a single tokio task with proper error handling (`tracing::error!` on failure, continues loop). Fetch errors do not crash the backend.

8. **Frontend `encodeURIComponent` on channel_id**: The `useEpg` hook at `useEpg.ts:29` correctly uses `encodeURIComponent(id)` when constructing the API URL, preventing injection into the URL path.

9. **Type Safety**: All EPG types use strict TypeScript types with no `any`. The `EpgProgram` fields are properly typed as `string` and optional fields use `?` syntax.

10. **No Sensitive Data Exposure**: EPG data is public programme schedule information. No authentication tokens, private keys, or user-specific data flows through the EPG pipeline.

---

# Host Auth Integration Security Review

## Audit Scope

Host authentication integration for Polkadot Desktop (Electron webview) environment.
Files reviewed:

- `web/src/hooks/useHostAccount.ts` (new file)
- `web/src/contexts/UnifiedAccountContext.tsx` (modified)
- `web/src/components/ConnectWallet.tsx` (modified)
- `web/src/lib/chain.ts` (modified)
- `web/node_modules/@novasamatech/product-sdk/dist/accounts.js` (SDK internals)
- `web/node_modules/@novasamatech/product-sdk/dist/sandboxTransport.js` (SDK internals)

## Host Auth Findings Summary

| ID  | Severity | Title                                                    | Status |
|-----|----------|----------------------------------------------------------|--------|
| H1  | MEDIUM   | isHostedEnvironment() iframe check is spoofable          | Open   |
| H2  | LOW      | postMessage targetOrigin is wildcard ('*')               | Note   |
| H3  | LOW      | getHostSigner creates new provider per call              | Open   |
| H4  | INFO     | publicKey stored in React state / UnifiedAccount         | OK     |
| H5  | INFO     | AccountId().enc() may throw on invalid publicKey         | OK     |

## Host Auth Findings Detail

### H1: MEDIUM -- isHostedEnvironment() iframe check is spoofable

- **File**: `web/src/hooks/useHostAccount.ts:24-27`
- **Code**: `return window.__HOST_WEBVIEW_MARK__ === true || window !== window.top;`
- **Issue**: The `isHostedEnvironment()` function uses two detection signals: (1) a global
  `window.__HOST_WEBVIEW_MARK__` boolean set by the Electron webview preload script, and
  (2) an iframe check (`window !== window.top`). The iframe check means that ANY website
  that embeds this IPTV app in an iframe will be detected as a "hosted" environment. This
  could cause the app to attempt host API calls to a non-existent `__HOST_API_PORT__`, which
  will time out harmlessly (the SDK polls for 20 seconds then throws). However, this also
  means the app skips showing the normal "Sign in" / "Connect Wallet" UI if `isConnected`
  is somehow true.

  More importantly, the `__HOST_WEBVIEW_MARK__` global can be set by any JavaScript running
  in the same context before the app loads. In a legitimate Polkadot Desktop environment,
  the Electron preload script sets this via `contextBridge` or direct injection. But in a
  browser context, a malicious browser extension or injected script could set
  `window.__HOST_WEBVIEW_MARK__ = true` to trick the app into thinking it is hosted.

  **Practical risk**: LOW. The actual signing still goes through the SDK's `sandboxTransport`
  which communicates via `MessagePort` (`__HOST_API_PORT__`). If no real host is present,
  `getWebviewPort()` will poll 200 times (20 seconds) then throw an error. The attacker
  cannot intercept signing requests unless they also control the MessagePort, which requires
  preload script access (Electron privilege). So the detection spoofing alone does not enable
  unauthorized signing.

  **However**, spoofing `isHostedEnvironment()` to `true` does change the signer selection
  in `chain.ts:321-322`:
  ```
  const resolvedSigner = signer
    ?? (hosted && publicKey ? getHostSigner(publicKey) : await getAliceSigner());
  ```
  If `hosted` is true and `publicKey` is provided, the code will use `getHostSigner()` which
  will fail to communicate with a non-existent host. This is a denial-of-service vector for
  playlist saving, not a key compromise vector.

- **Recommendation**: This is an acceptable design given the SDK's architecture. The SDK
  itself uses the same detection pattern (`sandboxTransport.js:19-25`). The real security
  boundary is the MessagePort transport, not the boolean flag. Consider documenting that
  `isHostedEnvironment()` is a hint, not a security gate. No code change required.

### H2: LOW -- postMessage targetOrigin is wildcard ('*')

- **File**: `web/node_modules/@novasamatech/product-sdk/dist/sandboxTransport.js:75`
- **Code**: `getParentWindow().postMessage(message, '*', [message.buffer]);`
- **Issue**: In iframe mode, the SDK posts messages to the parent window using `'*'` as
  the target origin. This means any parent origin can receive the message. In a legitimate
  Polkadot Desktop setup this is acceptable because the host is trusted. But if the app is
  embedded in a malicious iframe parent, the parent could receive the raw SCALE-encoded
  signing payloads.

  The SDK also validates incoming messages: `isValidIframeMessage` checks
  `event.source === sourceEnv` (must come from the known parent window) and
  `event.data.constructor.name === 'Uint8Array'`. This provides some protection against
  message injection from sibling frames.

  For the webview path, messages go through `MessagePort` which is a point-to-point channel
  and does not suffer from this issue.

- **Risk**: This is an upstream SDK design decision, not a bug in the IPTV app. The IPTV
  app has no control over the SDK's postMessage target origin. In practice, the risk is
  limited because: (a) in the webview path, MessagePort is used instead; (b) in the iframe
  path, the parent is expected to be the trusted Polkadot Desktop renderer.
- **Recommendation**: No action needed from the IPTV app. If this is a concern, it should
  be raised upstream with the `@novasamatech/product-sdk` maintainers.

### H3: LOW -- getHostSigner creates new provider per call

- **File**: `web/src/hooks/useHostAccount.ts:82-89`
- **Code**:
  ```typescript
  export function getHostSigner(publicKey: Uint8Array): PolkadotSigner {
    const provider = createAccountsProvider();
    return provider.getNonProductAccountSigner({
      dotNsIdentifier: "",
      derivationIndex: 0,
      publicKey,
    });
  }
  ```
- **Issue**: Each call to `getHostSigner()` creates a new `createAccountsProvider()` instance
  which internally creates a new `createHostApi(transport)` instance. While the `transport`
  is a module-level singleton (`sandboxTransport`), the provider and hostApi layers are
  recreated each time. In `chain.ts:321-322`, `getHostSigner` is called once per
  `submitPlaylistToChain` invocation, but the returned signer is used for two transactions
  (store + remark), so it is reused within a single save operation. This is not a security
  vulnerability, but unnecessary resource allocation.

- **Recommendation**: Consider caching the provider at module scope. Low priority.

### H4: INFO -- publicKey stored in React state and UnifiedAccount

- **File**: `web/src/contexts/UnifiedAccountContext.tsx:25`, `web/src/hooks/useHostAccount.ts:51-56`
- **Issue**: The raw `publicKey` (Uint8Array, 32 bytes) from the host is stored in React
  state and passed through the `UnifiedAccount` type. This is a PUBLIC key, not a private
  key. It is equivalent to the information available in the SS58 address and carries no
  additional security risk. The public key is needed to construct the signer for host-mode
  signing via `getHostSigner(publicKey)`.

- **Verdict**: SAFE. Public keys are not sensitive. No private key material crosses the
  webview boundary. The private key remains in the host process (Polkadot Desktop) and
  signing is delegated via the `signPayload` host API call, which triggers the host's
  native approval modal.

### H5: INFO -- AccountId().enc() may throw on invalid publicKey

- **File**: `web/src/hooks/useHostAccount.ts:51`
- **Code**: `const address = AccountId().enc(raw.publicKey);`
- **Issue**: If the host returns a malformed publicKey (wrong length, not 32 bytes), the
  `AccountId().enc()` call will throw. The error is not caught within the `.map()` callback,
  which would cause the entire `getNonProductAccounts` promise chain to reject. The `.catch()`
  at line 63-65 handles this by setting accounts to an empty array, so the app degrades
  gracefully.

- **Verdict**: OK. The error handling is adequate. The catch-all `.catch()` prevents the
  error from propagating and the user sees no accounts (correct behavior for invalid data).

## Approved (Host Auth)

The following aspects of the host auth integration were reviewed and found to be satisfactory:

1. **No private keys cross the webview boundary.** The SDK's `getNonProductAccountSigner`
   (in `accounts.js:114-170`) delegates all signing to `hostApi.signPayload()` which sends
   the unsigned payload over the MessagePort/postMessage transport to the host process. The
   host shows a native approval modal before signing. The IPTV app never has access to the
   private key.

2. **No auto-signing without user consent.** Every `signPayload` call goes through the
   SDK transport to the host, which presents a confirmation modal. There is no mechanism in
   the SDK to bypass this approval flow. The IPTV app calls `signSubmitAndWatch(resolvedSigner)`
   which triggers the host signer, which in turn calls `hostApi.signPayload` -- always
   requiring user approval on the host side.

3. **Disconnect no-op for host accounts is correct.** In `UnifiedAccountContext.tsx:177-178`,
   `disconnect()` returns early when `selectedAccount?.source === "host"`. This is correct
   because host accounts are managed by the host application (Polkadot Desktop), not by the
   embedded web app. The web app cannot and should not disconnect the user from their host
   wallet. The "Disconnect All" button is also correctly hidden in the UI when `authSource`
   is `"host"` (`ConnectWallet.tsx:198`).

4. **Error handling does not leak sensitive info.** Error paths in `useHostAccount.ts` use
   generic fallbacks: `.catch(() => setAccounts([]))` (line 63-65). The `chain.ts` error
   messages like "TransactionStorage.store failed on-chain" are generic and do not expose
   internal state. The `useChainPlaylist.ts` extracts only `err.message` for display.

5. **localStorage usage is safe.** The `SELECTED_ACCOUNT_KEY` stores only the SS58 address
   (a public identifier). No private keys, session tokens, or signing material is stored in
   localStorage. The stored address is used only for re-selecting the previously chosen
   account on page reload.

6. **Import chains are clean -- no circular dependencies.** The dependency graph is:
   - `useHostAccount.ts` imports from `@novasamatech/product-sdk`, `@polkadot-api/substrate-bindings`, `polkadot-api`, `react`
   - `UnifiedAccountContext.tsx` imports from `useHostAccount.ts` (hooks only)
   - `chain.ts` imports from `useHostAccount.ts` (pure functions only: `isHostedEnvironment`, `getHostSigner`)
   - `ConnectWallet.tsx` imports from `UnifiedAccountContext.tsx`
   - No circular imports exist between these files.

7. **Host auth priority ordering is correct.** The `authSource` priority in
   `UnifiedAccountContext.tsx:124-129` is host > papp > extension. The account merge order
   (lines 97-121) is host first, then papp, then extension, with address deduplication.
   This ensures host accounts always take precedence when running in Polkadot Desktop.

8. **Signer resolution fallback chain is safe.** In `chain.ts:320-322`:
   ```
   const resolvedSigner = signer ?? (hosted && publicKey ? getHostSigner(publicKey) : await getAliceSigner());
   ```
   The fallback order is: explicit signer > host signer (when hosted AND publicKey exists) >
   Alice dev key (when USE_DEV_KEY is true). The `&&` guard on `publicKey` prevents creating
   a host signer without a valid public key. If neither path works, `getAliceSigner()` throws
   when `USE_DEV_KEY` is false, which is the correct behavior for production.

9. **ConnectWallet UI correctly handles hosted state.** When `isHosted && isConnected`
   (`ConnectWallet.tsx:80`), the UI shows a static account display with no authentication
   actions (no "Sign in", no "Connect Wallet", no "Disconnect"). This is correct because
   the host manages the account lifecycle.

10. **Host signing path correctly skips Sudo wrapper.** In `chain.ts:340-356`, when hosted
    with a publicKey, `TransactionStorage.store()` is submitted directly without the
    `Sudo.sudo()` wrapper. This is the correct behavior: host users sign with their own key
    and do not need (and should not use) sudo privileges. The dev path retains the Sudo
    wrapper for Alice-based testing.

## Addendum: publicKey Propagation Chain Review

Additional files reviewed for publicKey propagation:

- `web/src/hooks/useChainPlaylist.ts` (modified -- added `publicKey?: Uint8Array` parameter)
- `web/src/components/SaveToChainButton.tsx` (modified -- accepts and forwards `publicKey` prop)
- `web/src/app/page.tsx` (modified -- passes `account.publicKey` to SaveToChainButton)

### publicKey Data Flow

```
page.tsx:190    account.publicKey  (from UnifiedAccount)
    |
    v
SaveToChainButton.tsx:34    publicKey  (prop, passed through)
    |
    v
useChainPlaylist.ts:33      publicKey  (forwarded to submitPlaylistToChain)
    |
    v
chain.ts:303                publicKey  (used to resolve signer)
    |
    v
useHostAccount.ts:83        getHostSigner(publicKey)  (creates SDK signer)
```

### Findings

**No additional security issues found.** The publicKey propagation is a clean passthrough:

1. **No mutation or side effects along the chain.** Each layer passes the `Uint8Array`
   reference without modification. No cloning, encoding, or transformation occurs between
   `page.tsx` and the final `getHostSigner()` call.

2. **Optional parameter handling is correct.** All layers declare `publicKey?: Uint8Array`
   (optional). When `publicKey` is `undefined` (non-host accounts), it propagates as
   `undefined` through the chain, and `chain.ts:321` correctly falls through to the Alice
   dev key path via the `hosted && publicKey` guard.

3. **SaveToChainButton does not expose publicKey in the DOM.** The component uses `publicKey`
   only as a passthrough to `saveToChain()`. It is never rendered, logged, or included in
   error messages displayed to the user.

4. **page.tsx accesses `account.publicKey` safely.** At line 190, `account.publicKey` is
   accessed from the `UnifiedAccount` type which declares it as `publicKey?: Uint8Array`.
   For extension and papp accounts, this field is `undefined`, which correctly disables
   host signing in the downstream chain.

5. **Error display in SaveToChainButton is safe.** The `chainError` string at line 54 comes
   from `useChainPlaylist.ts:38` which extracts `err.message` or uses a generic fallback.
   No publicKey or signing details are included in user-facing error text.
