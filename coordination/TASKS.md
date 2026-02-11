# Task Assignments -- Security Remediation Sprint

**Created:** 2026-02-11
**Context:** Security audit findings for the chain interaction layer.
See `SECURITY_REPORT.md` for full findings and `DECISIONS.md` for architectural approach.

---

## Wave 1: CRITICAL + HIGH (No deployment until complete)

### TASK-SEC-01: Gate Dev Key Behind Environment Variable [F1]
**Agent:** blockchain-dev
**Priority:** CRITICAL
**Depends on:** None
**Files:** `web/src/lib/chain.ts`

**Description:**
The Alice dev key (`DEV_PHRASE` from `@polkadot-labs/hdkd-helpers`) is imported and used
unconditionally. This must be gated behind an environment variable.

**Acceptance criteria:**
1. Add constant `const USE_DEV_KEY = process.env.NEXT_PUBLIC_USE_DEV_KEY === "true";`
2. Wrap the entire `getAliceSigner()` function body: if `!USE_DEV_KEY`, throw an Error
   with message `"Dev key signing is disabled. Provide an external signer."`
3. Change `submitPlaylistToChain` signature to accept an optional `signer?: PolkadotSigner`
   parameter (4th parameter, after `channels`)
4. In `submitPlaylistToChain`, resolve the signer as:
   ```typescript
   const resolvedSigner = signer ?? (USE_DEV_KEY ? getAliceSigner() : null);
   if (!resolvedSigner) {
     throw new Error("No signer provided and dev key is disabled.");
   }
   ```
5. Use dynamic import for hdkd modules so they are tree-shaken when `USE_DEV_KEY` is false:
   ```typescript
   async function getAliceSigner(): Promise<PolkadotSigner> {
     if (!USE_DEV_KEY) throw new Error("Dev key signing is disabled.");
     const { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy } =
       await import("@polkadot-labs/hdkd-helpers");
     const { sr25519CreateDerive } = await import("@polkadot-labs/hdkd");
     // ... rest of key derivation
   }
   ```
6. Remove the top-level static imports of `DEV_PHRASE`, `entropyToMiniSecret`, `mnemonicToEntropy`,
   and `sr25519CreateDerive` (lines 4-9)
7. Add `NEXT_PUBLIC_USE_DEV_KEY=true` to `web/.env.development` (create if needed)
8. Verify: `npm run type-check` passes, `npm run build` passes

---

### TASK-SEC-02: Wire Wallet Signer into Chain Submission [F1 continued]
**Agent:** frontend-builder
**Priority:** CRITICAL
**Depends on:** TASK-SEC-01
**Files:** `web/src/lib/wallet-service.ts`, `web/src/hooks/useChainPlaylist.ts`,
`web/src/components/SaveToChainButton.tsx`, `web/src/app/page.tsx`

**Description:**
After TASK-SEC-01 makes the signer parameter optional, the frontend must pass a real
wallet signer when in production mode.

**Acceptance criteria:**
1. In `wallet-service.ts`, add a new export `getPolkadotSignerForAddress(address: string): Promise<PolkadotSigner>`:
   - Use `@polkadot/extension-dapp` `web3FromAddress()` to get the injector
   - Use `getPolkadotSigner()` from `polkadot-api/signer` to convert the extension
     signer to a PAPI-compatible signer (the extension provides `publicKey` and a `sign`
     callback accessible via `injector.signer.signRaw`)
   - If the extension signer does not support `signRaw`, throw with a descriptive message
2. Update `useChainPlaylist` hook's `saveToChain` callback to accept an optional
   `signer?: PolkadotSigner` and pass it through to `submitPlaylistToChain`
3. Update `SaveToChainButton`:
   - Import `getPolkadotSignerForAddress` from wallet-service
   - Before calling `saveToChain`, obtain the signer: `const signer = await getPolkadotSignerForAddress(address)`
   - Pass `signer` to `saveToChain`
   - Handle the case where signer retrieval fails (show error to user)
4. Verify: `npm run type-check` passes, build succeeds

---

### TASK-SEC-03: Verify CID After IPFS Fetch [F2]
**Agent:** blockchain-dev
**Priority:** HIGH
**Depends on:** None
**Files:** `web/src/lib/chain.ts`

**Description:**
After fetching compressed data from IPFS, recompute the CID and verify it matches
the on-chain pointer. Also add a max response size limit.

**Acceptance criteria:**
1. Add constants:
   ```typescript
   const MAX_COMPRESSED_SIZE = 10 * 1024 * 1024; // 10MB
   ```
2. In `loadPlaylistFromChain`, after `const response = await fetch(url, ...)`:
   - Check `Content-Length` header: if present and exceeds `MAX_COMPRESSED_SIZE`, return `{ found: false }`
   - After `response.arrayBuffer()`, check `compressed.byteLength > MAX_COMPRESSED_SIZE`, return `{ found: false }`
3. After creating the `compressed` Uint8Array, verify the CID:
   ```typescript
   const computedCid = computeCID(compressed);
   if (computedCid.toString() !== pointer.cid) {
     console.warn("CID mismatch: fetched content does not match on-chain pointer");
     return { found: false };
   }
   ```
4. Validate CID format before constructing URL. The CID from `pointer.cid` should be a valid
   CIDv1 string. Use `CID.parse(pointer.cid)` wrapped in try/catch; if it fails, return `{ found: false }`
5. Verify: `npm run type-check` passes

---

### TASK-SEC-04: Add Decompression Size Limit [F3]
**Agent:** blockchain-dev
**Priority:** HIGH
**Depends on:** None
**Files:** `web/src/lib/chain.ts`

**Description:**
The `gzipDecompress` function has no size limit on output. Add protection against
decompression bombs.

**Acceptance criteria:**
1. Add constant:
   ```typescript
   const MAX_DECOMPRESSED_SIZE = 50 * 1024 * 1024; // 50MB
   ```
2. Modify `gzipDecompress` to accept an optional `maxSize` parameter (default: `MAX_DECOMPRESSED_SIZE`)
3. In the decompression loop, track `totalLen` as chunks are received:
   ```typescript
   let totalLen = 0;
   for (;;) {
     const { done, value } = await reader.read();
     if (done) break;
     totalLen += value.length;
     if (totalLen > maxSize) {
       await reader.cancel();
       throw new Error(`Decompressed size exceeds limit of ${maxSize} bytes`);
     }
     chunks.push(value);
   }
   ```
4. In `loadPlaylistFromChain`, wrap the `gzipDecompress` call in try/catch and return
   `{ found: false }` on size limit error
5. Verify: `npm run type-check` passes

---

### TASK-SEC-05: Create URL Sanitization Utility [F4]
**Agent:** frontend-builder
**Priority:** HIGH
**Depends on:** None
**Files:** `web/src/lib/url-sanitizer.ts` (new), `web/src/lib/chain.ts`, `web/src/lib/types.ts`

**Description:**
Create a URL validation utility and apply it at data ingestion boundaries to prevent
`javascript:`, `data:`, and `blob:` URLs from entering the application state.

**Acceptance criteria:**
1. Create new file `web/src/lib/url-sanitizer.ts`:
   ```typescript
   const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

   /**
    * Validate that a URL string uses an allowed protocol (http/https only).
    * Returns the original string if valid, or null if invalid/malicious.
    */
   export function sanitizeUrl(url: string | null | undefined): string | null {
     if (!url) return null;
     try {
       const parsed = new URL(url);
       if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
         return url;
       }
       return null;
     } catch {
       return null;
     }
   }

   /**
    * Validate a stream URL. Same as sanitizeUrl but also rejects non-URL strings.
    */
   export function sanitizeStreamUrl(url: string): string | null {
     return sanitizeUrl(url);
   }
   ```
2. In `chain.ts`, import `sanitizeUrl` and `sanitizeStreamUrl`
3. In `parseM3U()`, after constructing each channel, sanitize URLs:
   - `stream_url`: `sanitizeStreamUrl(line)` -- if null, skip the channel entirely (do not push)
   - `logo_url`: `sanitizeUrl(pendingLogo)` (already nullable, so null is fine)
4. In `expandChannels()`, apply the same sanitization:
   - `stream_url`: `sanitizeStreamUrl(c.s)` -- if null, skip the channel
   - `logo_url`: `sanitizeUrl(c.l)`
5. Add explicit return type annotations on both exported functions
6. Verify: `npm run type-check` passes, `npm run lint` passes

---

## Wave 2: MEDIUM (Fix before beta)

### TASK-SEC-06: Fix Remark Delimiter Injection [F5]
**Agent:** blockchain-dev
**Priority:** MEDIUM
**Depends on:** None
**Files:** `web/src/lib/chain.ts`

**Description:**
URL-encode the playlist name in the on-chain remark to prevent `:` delimiter injection.

**Acceptance criteria:**
1. In `submitPlaylistToChain`, at line 305, encode the name:
   ```typescript
   const encodedName = encodeURIComponent(name);
   const pointerStr = `IPTVCID:${address}:${encodedName}:${cidString}`;
   ```
2. In `parseExtrinsicForPointer`, after extracting `name` at line 442, decode it:
   ```typescript
   const name = decodeURIComponent(decoded.slice(0, lastColon));
   ```
3. Add a comment explaining the encoding convention for future maintainers
4. Verify: both encoding and decoding round-trip correctly for names with colons,
   spaces, and unicode characters

---

### TASK-SEC-07: Add WebSocket RPC Call Timeout [F6]
**Agent:** blockchain-dev
**Priority:** MEDIUM
**Depends on:** None
**Files:** `web/src/lib/chain.ts`

**Description:**
Add a per-call timeout to the `createJsonRpcCaller` so that hung RPC calls do not
block indefinitely.

**Acceptance criteria:**
1. Add constant `const RPC_CALL_TIMEOUT_MS = 10_000;` (10 seconds)
2. In the `caller` function (line 519-528), after adding to `pending` map and sending
   the message, set a timeout:
   ```typescript
   const timeoutId = setTimeout(() => {
     const p = pending.get(id);
     if (p) {
       pending.delete(id);
       p.reject(new Error(`RPC call "${method}" timed out after ${RPC_CALL_TIMEOUT_MS}ms`));
     }
   }, RPC_CALL_TIMEOUT_MS);
   ```
3. In the `onmessage` handler, clear the timeout when a response is received:
   - This requires storing `timeoutId` alongside `resolve`/`reject` in the pending map
   - Update the pending map type to:
     ```typescript
     const pending = new Map<number, {
       resolve: (v: unknown) => void;
       reject: (e: Error) => void;
       timeoutId: ReturnType<typeof setTimeout>;
     }>();
     ```
   - In `onmessage`, call `clearTimeout(p.timeoutId)` before resolving/rejecting
4. In `onclose`, clear all pending timeouts before rejecting
5. Verify: `npm run type-check` passes

---

### TASK-SEC-08: Concurrent Block Scanning with AbortController [F7]
**Agent:** blockchain-dev
**Priority:** MEDIUM
**Depends on:** TASK-SEC-07
**Files:** `web/src/lib/chain.ts`, `web/src/hooks/useChainPlaylist.ts`

**Description:**
Replace sequential block-by-block scanning with batched concurrent requests.
Add AbortController support.

**Acceptance criteria:**
1. Modify `scanForCIDPointer` to accept an optional `signal?: AbortSignal` parameter
2. Modify `loadPlaylistFromChain` to accept an optional `signal?: AbortSignal` parameter
   and pass it through to `scanForCIDPointer` and the IPFS `fetch`
3. Rewrite the scan loop in `scanForCIDPointer`:
   ```typescript
   const BATCH_SIZE = 10;
   for (let batchStart = headNumber; batchStart > startBlock; batchStart -= BATCH_SIZE) {
     if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

     const batchEnd = Math.max(batchStart - BATCH_SIZE, startBlock);
     const blockNums = [];
     for (let i = batchStart; i > batchEnd; i--) {
       blockNums.push(i);
     }

     // Fetch all block hashes concurrently
     const hashes = await Promise.all(
       blockNums.map(n => rpcCall("chain_getBlockHash", [n]))
     );

     // Fetch all blocks concurrently
     const blocks = await Promise.all(
       hashes.map(h => rpcCall("chain_getBlock", [h]))
     );

     // Scan results sequentially (most recent first)
     for (let i = 0; i < blocks.length; i++) {
       const block = blocks[i] as { block: { extrinsics: string[] } };
       for (const ext of block.block.extrinsics) {
         const pointer = parseExtrinsicForPointer(ext, address, blockNums[i]);
         if (pointer) return pointer;
       }
     }
   }
   ```
4. In `useChainPlaylist.ts`, store an AbortController ref so the scan can be cancelled
   when the component unmounts or the user disconnects their wallet
5. Verify: `npm run type-check` passes

---

### TASK-SEC-09: Safe JSON.parse in WebSocket Handler [F8]
**Agent:** blockchain-dev
**Priority:** MEDIUM
**Depends on:** None
**Files:** `web/src/lib/chain.ts`

**Description:**
Wrap `JSON.parse` in the WebSocket `onmessage` handler with a try/catch.

**Acceptance criteria:**
1. At line 492-505, wrap the JSON.parse and subsequent logic in try/catch:
   ```typescript
   ws.onmessage = (event) => {
     try {
       const data = JSON.parse(event.data as string) as {
         id: number;
         result?: unknown;
         error?: { message: string };
       };
       if (typeof data.id !== "number") return;
       const p = pending.get(data.id);
       if (!p) return;
       pending.delete(data.id);
       clearTimeout(p.timeoutId); // if TASK-SEC-07 is done
       if (data.error) {
         p.reject(new Error(data.error.message));
       } else {
         p.resolve(data.result);
       }
     } catch {
       // Malformed WebSocket message -- ignore silently
     }
   };
   ```
2. Add `typeof data.id !== "number"` guard as shown above
3. Verify: `npm run type-check` passes

---

### TASK-SEC-10: Unsubscribe from signSubmitAndWatch [A1]
**Agent:** blockchain-dev
**Priority:** MEDIUM
**Depends on:** None
**Files:** `web/src/lib/chain.ts`

**Description:**
The `signSubmitAndWatch` observable subscriptions are never cleaned up after finalization.

**Acceptance criteria:**
1. Capture the subscription returned by `.subscribe()` at lines 290 and 312
2. Call `subscription.unsubscribe()` in both the `next` handler (after finalized)
   and the `error` handler
3. Example pattern:
   ```typescript
   const storeResult = await new Promise<string>((resolve, reject) => {
     const sub = sudoStoreTx.signSubmitAndWatch(signer).subscribe({
       next: (event) => {
         if (event.type === "finalized") {
           sub.unsubscribe();
           if (event.ok) {
             resolve(event.txHash);
           } else {
             reject(new Error("TransactionStorage.store failed on-chain"));
           }
         }
       },
       error: (err) => {
         sub.unsubscribe();
         reject(err);
       },
     });
   });
   ```
4. Apply the same pattern to the remark transaction at lines 312-325
5. Verify: `npm run type-check` passes

---

## Wave 3: LOW + Cleanup (Fix before v1.0)

### TASK-SEC-11: Add Content Security Policy Headers [F10]
**Agent:** frontend-builder
**Priority:** LOW
**Depends on:** None
**Files:** `web/next.config.mjs`

**Description:**
Add security headers to the Next.js configuration.

**Acceptance criteria:**
1. Add an `async headers()` function to the Next.js config:
   ```javascript
   async headers() {
     return [
       {
         source: "/(.*)",
         headers: [
           {
             key: "Content-Security-Policy",
             value: [
               "default-src 'self'",
               "script-src 'self' 'wasm-unsafe-eval'",
               "style-src 'self' 'unsafe-inline'",
               "connect-src 'self' wss://bulletin.dotspark.app https://ipfs.dotspark.app",
               "img-src 'self' https: data:",
               "media-src 'self' https: blob:",
               "font-src 'self'",
               "frame-ancestors 'none'",
             ].join("; "),
           },
           { key: "X-Frame-Options", value: "DENY" },
           { key: "X-Content-Type-Options", value: "nosniff" },
           { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
           { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
         ],
       },
     ];
   },
   ```
2. Note: `'wasm-unsafe-eval'` is needed for PAPI's sr25519 WASM module.
   `'unsafe-inline'` is needed for Tailwind CSS (consider nonces in future).
   `blob:` is needed for hls.js media segments.
3. Test that the app loads correctly with the CSP in place:
   - `npm run build && npm start` and check browser console for CSP violations
   - Verify HLS playback still works
   - Verify wallet connection still works
4. Verify: `npm run build` passes

---

### TASK-SEC-12: Add PAPI Client Reconnection [F11]
**Agent:** blockchain-dev
**Priority:** LOW
**Depends on:** None
**Files:** `web/src/lib/chain.ts`

**Description:**
Add connection health checking and automatic reconnection for the singleton PAPI client.

**Acceptance criteria:**
1. Add a `resetBulletinApi()` function:
   ```typescript
   function resetBulletinApi(): void {
     if (bulletinClient) {
       try { bulletinClient.destroy(); } catch { /* ignore */ }
     }
     bulletinClient = null;
     bulletinApi = null;
     initPromise = null;
   }
   ```
2. Wrap `getBulletinApi()` calls in `submitPlaylistToChain` and `loadPlaylistFromChain`
   with a try/catch. On connection error, call `resetBulletinApi()` and retry once.
3. Export `resetBulletinApi` so that the hook layer can call it on detected failures
4. Verify: `npm run type-check` passes

---

### TASK-SEC-13: Replace simpleHash with Blake2b [F12]
**Agent:** blockchain-dev
**Priority:** LOW
**Depends on:** None
**Files:** `web/src/lib/chain.ts`

**Description:**
Replace the weak DJB2-style hash with a truncated blake2b hash for channel IDs.

**Acceptance criteria:**
1. Replace `simpleHash` implementation:
   ```typescript
   function simpleHash(str: string): string {
     const bytes = new TextEncoder().encode(str);
     const hash = blake2b(bytes, { dkLen: 8 }); // 8 bytes = 64-bit
     return Array.from(hash).map(b => b.toString(16).padStart(2, "0")).join("");
   }
   ```
2. blake2b is already imported at line 3, so no new dependency needed
3. Note: This changes channel IDs, which means existing localStorage favorites
   will not match. This is acceptable since IDs are ephemeral.
4. Verify: `npm run type-check` passes

---

### TASK-SEC-14: Improve Error Feedback for Chain Load Failures [A2, A3]
**Agent:** frontend-builder
**Priority:** LOW
**Depends on:** TASK-SEC-08
**Files:** `web/src/hooks/useChainPlaylist.ts`, `web/src/lib/chain.ts`

**Description:**
The `loadFromChain` callback silently swallows all errors. Add error state feedback
and address validation.

**Acceptance criteria:**
1. In `useChainPlaylist.ts`, add a `loadError` state alongside `chainError`:
   ```typescript
   const [loadError, setLoadError] = useState<string | null>(null);
   ```
2. In `loadFromChain`, set the error state on failure instead of returning null:
   ```typescript
   const loadFromChain = useCallback(async (address: string) => {
     try {
       setLoadError(null);
       const response = await loadPlaylistFromChain(address);
       return response;
     } catch (err) {
       const msg = err instanceof Error ? err.message : "Failed to load from chain";
       setLoadError(msg);
       return null;
     }
   }, []);
   ```
3. Return `loadError` from the hook
4. In `chain.ts`, add basic SS58 address format validation at the start of
   `submitPlaylistToChain` and `loadPlaylistFromChain`:
   ```typescript
   if (!address || address.length < 46 || address.length > 48) {
     throw new Error("Invalid SS58 address format");
   }
   ```
5. Verify: `npm run type-check` passes

---

### TASK-SEC-15: Remove eslint-disable and Fix RPC Caller Types [A4]
**Agent:** blockchain-dev
**Priority:** LOW
**Depends on:** TASK-SEC-07
**Files:** `web/src/lib/chain.ts`

**Description:**
Remove the `eslint-disable` comment and properly type the RPC caller.

**Acceptance criteria:**
1. Replace the `any` typed `caller` with a properly typed function:
   ```typescript
   async function call(method: string, params: unknown[]): Promise<unknown> {
     await ensureOpen();
     const id = idCounter++;
     return new Promise((resolve, reject) => {
       const timeoutId = setTimeout(() => { /* ... */ }, RPC_CALL_TIMEOUT_MS);
       pending.set(id, { resolve, reject, timeoutId });
       ws!.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
     });
   }

   const rpcCaller = call as RpcCaller;
   rpcCaller.close = () => { /* ... */ };
   return rpcCaller;
   ```
2. Or alternatively, create the caller using `Object.assign`:
   ```typescript
   return Object.assign(call, {
     close: () => { ws?.close(); ws = null; openPromise = null; },
   }) as RpcCaller;
   ```
3. Remove the `// eslint-disable-next-line` comment at line 518
4. Verify: `npm run lint` passes, `npm run type-check` passes

---

## Test Tasks (ux-tester)

### TASK-SEC-T1: Unit Tests for URL Sanitizer
**Agent:** ux-tester
**Priority:** HIGH
**Depends on:** TASK-SEC-05
**Files:** `web/__tests__/lib/url-sanitizer.test.ts` (new)

**Description:**
Write comprehensive unit tests for the URL sanitization utility.

**Acceptance criteria:**
1. Create test file `web/__tests__/lib/url-sanitizer.test.ts`
2. Test cases for `sanitizeUrl`:
   - Returns valid `http://` URLs unchanged
   - Returns valid `https://` URLs unchanged
   - Returns `null` for `javascript:alert(1)` URLs
   - Returns `null` for `data:text/html,...` URLs
   - Returns `null` for `blob:...` URLs
   - Returns `null` for `ftp://` URLs
   - Returns `null` for empty string
   - Returns `null` for null input
   - Returns `null` for undefined input
   - Returns `null` for malformed URLs (no protocol)
   - Returns `null` for `javascript:` with various case permutations (`JavaScript:`, `JAVASCRIPT:`)
   - Returns valid URLs with ports (e.g., `http://localhost:3000/path`)
   - Returns valid URLs with query strings and fragments
3. Test cases for `sanitizeStreamUrl`:
   - Same as `sanitizeUrl` but also test typical HLS URLs (`.m3u8`)
4. Verify: `npm run test` passes

---

### TASK-SEC-T2: Unit Tests for Chain.ts Security Fixes
**Agent:** ux-tester
**Priority:** HIGH
**Depends on:** TASK-SEC-01, TASK-SEC-03, TASK-SEC-04, TASK-SEC-06
**Files:** `web/__tests__/lib/chain.test.ts` (new)

**Description:**
Write unit tests covering the security-critical chain.ts functions.

**Acceptance criteria:**
1. Create test file `web/__tests__/lib/chain.test.ts`
2. Test `gzipDecompress` with size limit:
   - Verify that decompressing normal data works
   - Verify that exceeding `MAX_DECOMPRESSED_SIZE` throws an error
   - Verify the error message mentions the size limit
3. Test `computeCID`:
   - Verify deterministic CID for known input
   - Verify different inputs produce different CIDs
4. Test remark encoding (F5 fix):
   - Create a mock playlist name with `:` characters
   - Verify `encodeURIComponent` is used in the remark string
   - Verify round-trip: encode then decode preserves the original name
5. Test dev key gating (F1 fix):
   - When `NEXT_PUBLIC_USE_DEV_KEY` is not set, `getAliceSigner()` should throw
   - When `NEXT_PUBLIC_USE_DEV_KEY=true`, `getAliceSigner()` should return a signer
   (Note: mock the environment variable using `vi.stubEnv`)
6. Mock the WebSocket and PAPI dependencies appropriately
7. Verify: `npm run test` passes

---

### TASK-SEC-T3: Unit Tests for WebSocket RPC Caller Timeout
**Agent:** ux-tester
**Priority:** MEDIUM
**Depends on:** TASK-SEC-07, TASK-SEC-09
**Files:** `web/__tests__/lib/rpc-caller.test.ts` (new)

**Description:**
Test the timeout and error handling behavior of the JSON-RPC WebSocket caller.

**Acceptance criteria:**
1. Create test file `web/__tests__/lib/rpc-caller.test.ts`
2. Mock `WebSocket` in the test environment
3. Test cases:
   - RPC call resolves when response is received within timeout
   - RPC call rejects with timeout error when no response is received
   - Malformed JSON message does not crash (F8 fix)
   - `data.id` that is not a number is ignored
   - WebSocket close rejects all pending calls
   - `close()` method cleans up the WebSocket
4. Use `vi.useFakeTimers()` to control timeout behavior
5. Verify: `npm run test` passes

---

### TASK-SEC-T4: E2E Test for CSP Headers
**Agent:** ux-tester
**Priority:** LOW
**Depends on:** TASK-SEC-11
**Files:** `web/__tests__/e2e/security-headers.spec.ts` (new)

**Description:**
Verify that security headers are present in HTTP responses.

**Acceptance criteria:**
1. Create Playwright test `web/__tests__/e2e/security-headers.spec.ts`
2. Test cases:
   - Response includes `Content-Security-Policy` header
   - CSP includes `frame-ancestors 'none'`
   - Response includes `X-Frame-Options: DENY`
   - Response includes `X-Content-Type-Options: nosniff`
   - Response includes `Referrer-Policy: strict-origin-when-cross-origin`
3. Note: This test requires the Next.js production server (`npm run build && npm start`),
   as dev server may not include custom headers
4. Verify: `npx playwright test security-headers` passes

---

### TASK-SEC-T5: Component Tests for URL Validation in VideoPlayer and ChannelList
**Agent:** ux-tester
**Priority:** HIGH
**Depends on:** TASK-SEC-05
**Files:** `web/__tests__/components/VideoPlayer.test.tsx` (new),
`web/__tests__/components/ChannelList.test.tsx` (new)

**Description:**
Verify that components handle sanitized (null) URLs correctly.

**Acceptance criteria:**
1. `VideoPlayer.test.tsx`:
   - When `src` is `null`, renders the placeholder state (no video element)
   - When `src` is a valid `https://` URL, renders a video element
   - Accessibility: video element has `controls` attribute
   - Keyboard: Space key toggles play/pause
2. `ChannelList.test.tsx`:
   - When `logo_url` is `null`, renders the "TV" fallback instead of an `<img>`
   - When `logo_url` is a valid URL, renders an `<img>` with the URL
   - Channels with empty names display correctly
   - `onSelect` callback fires when a channel button is clicked
   - Selected channel gets the correct visual treatment (CSS class check)
   - Accessibility: buttons have accessible names
3. Use React Testing Library + Vitest
4. Mock `hls.js` dynamic import in VideoPlayer tests
5. Verify: `npm run test` passes

---

## Task Dependency Graph

```
Wave 1 (Parallel start):
  TASK-SEC-01 (dev key gate)     ---> TASK-SEC-02 (wallet signer wiring)
  TASK-SEC-03 (CID verify)       \
  TASK-SEC-04 (decompression)     +--> TASK-SEC-T2 (chain.ts tests)
  TASK-SEC-05 (URL sanitizer)    ---> TASK-SEC-T1 (sanitizer tests)
                                  ---> TASK-SEC-T5 (component tests)

Wave 2 (Can start immediately, lower priority):
  TASK-SEC-06 (delimiter fix)    ---> TASK-SEC-T2
  TASK-SEC-07 (RPC timeout)      ---> TASK-SEC-08 (concurrent scan)
                                  ---> TASK-SEC-09 (safe JSON.parse)
                                  ---> TASK-SEC-T3 (RPC caller tests)
                                  ---> TASK-SEC-15 (type cleanup)
  TASK-SEC-10 (unsubscribe)

Wave 3 (After Wave 1+2):
  TASK-SEC-11 (CSP headers)      ---> TASK-SEC-T4 (CSP E2E test)
  TASK-SEC-12 (reconnection)
  TASK-SEC-13 (better hash)
  TASK-SEC-14 (error feedback)   depends on TASK-SEC-08
```

## Agent Workload Summary

| Agent             | Wave 1 | Wave 2 | Wave 3 | Tests | Total |
|-------------------|--------|--------|--------|-------|-------|
| blockchain-dev    | 3      | 5      | 3      | 0     | 11    |
| frontend-builder  | 2      | 0      | 2      | 0     | 4     |
| ux-tester         | 0      | 0      | 0      | 5     | 5     |
