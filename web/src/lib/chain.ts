"use client";

import { blake2b } from "@noble/hashes/blake2.js";
import { CID } from "multiformats/cid";
import * as multihash from "multiformats/hashes/digest";
import { Binary } from "polkadot-api";
import { getPolkadotSigner, type PolkadotSigner } from "polkadot-api/signer";
import type { PolkadotClient, TypedApi } from "polkadot-api";
import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";

import { bulletinchain } from "@polkadot-api/descriptors";
import { isHostedEnvironment, getHostSigner } from "@/hooks/useHostAccount";

import type {
  Channel,
  CompactChannel,
  ChainPlaylistResponse,
  Playlist,
} from "./types";
import { sanitizeUrl, sanitizeStreamUrl } from "./url-sanitizer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BULLETIN_ENDPOINT = "wss://bulletin.dotspark.app";
const IPFS_GATEWAY = "https://ipfs.dotspark.app/ipfs";
const SCAN_BLOCK_LIMIT = 500;
const USE_DEV_KEY = process.env.NEXT_PUBLIC_USE_DEV_KEY === "true";
const MAX_COMPRESSED_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DECOMPRESSED_SIZE = 50 * 1024 * 1024; // 50MB
const RPC_CALL_TIMEOUT_MS = 10_000;

// CID configuration (CIDv1 with blake2b-256)
const CID_CONFIG = {
  version: 1,
  codec: 0x55, // raw binary
  hashCode: 0xb220, // blake2b-256
  hashLength: 32,
} as const;

// ---------------------------------------------------------------------------
// Singleton Bulletin Chain PAPI Client
// ---------------------------------------------------------------------------

let bulletinClient: PolkadotClient | null = null;
let bulletinApi: TypedApi<typeof bulletinchain> | null = null;
let initPromise: Promise<{
  client: PolkadotClient;
  api: TypedApi<typeof bulletinchain>;
}> | null = null;

function getBulletinApi(): Promise<{
  client: PolkadotClient;
  api: TypedApi<typeof bulletinchain>;
}> {
  if (bulletinClient && bulletinApi) {
    return Promise.resolve({ client: bulletinClient, api: bulletinApi });
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const wsProvider = getWsProvider(BULLETIN_ENDPOINT);
    bulletinClient = createClient(wsProvider);
    bulletinApi = bulletinClient.getTypedApi(bulletinchain);
    return { client: bulletinClient, api: bulletinApi };
  })();

  return initPromise;
}

/** Destroy the PAPI client and reset all cached state so the next call reconnects. */
export function resetBulletinApi(): void {
  if (bulletinClient) {
    bulletinClient.destroy();
  }
  bulletinClient = null;
  bulletinApi = null;
  initPromise = null;
  aliceSigner = null;
}

// ---------------------------------------------------------------------------
// Alice dev signer (PAPI-compatible)
// ---------------------------------------------------------------------------

let aliceSigner: PolkadotSigner | null = null;

async function getAliceSigner(): Promise<PolkadotSigner> {
  if (!USE_DEV_KEY) throw new Error("Dev key signing is disabled. Provide an external signer.");
  if (aliceSigner) return aliceSigner;
  const { DEV_PHRASE, entropyToMiniSecret, mnemonicToEntropy } = await import("@polkadot-labs/hdkd-helpers");
  const { sr25519CreateDerive } = await import("@polkadot-labs/hdkd");
  const entropy = mnemonicToEntropy(DEV_PHRASE);
  const miniSecret = entropyToMiniSecret(entropy);
  const derive = sr25519CreateDerive(miniSecret);
  const keyPair = derive("//Alice");
  aliceSigner = getPolkadotSigner(keyPair.publicKey, "Sr25519", keyPair.sign);
  return aliceSigner;
}

// ---------------------------------------------------------------------------
// CID computation (blake2b-256, same as hackm3)
// ---------------------------------------------------------------------------

function computeCID(data: Uint8Array): CID {
  const hash = blake2b(data, { dkLen: CID_CONFIG.hashLength });
  const digest = multihash.create(CID_CONFIG.hashCode, hash);
  return CID.createV1(CID_CONFIG.codec, digest);
}

// ---------------------------------------------------------------------------
// Gzip compression / decompression (native browser APIs)
// ---------------------------------------------------------------------------

async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function gzipDecompress(data: Uint8Array, maxSize: number = MAX_DECOMPRESSED_SIZE): Promise<Uint8Array> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  let totalLen = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalLen += value.length;
    if (totalLen > maxSize) {
      await reader.cancel();
      throw new Error(`Decompressed data exceeds size limit of ${maxSize} bytes`);
    }
    chunks.push(value);
  }

  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// M3U serialization / parsing
// ---------------------------------------------------------------------------

function serializeToM3U(channels: Channel[]): string {
  const lines: string[] = ["#EXTM3U"];
  for (const ch of channels) {
    let extinf = "#EXTINF:-1";
    if (ch.group) extinf += ` group-title="${ch.group}"`;
    if (ch.logo_url) extinf += ` tvg-logo="${ch.logo_url}"`;
    extinf += `,${ch.name}`;
    lines.push(extinf);
    lines.push(ch.stream_url);
  }
  return lines.join("\n") + "\n";
}

function parseM3U(content: string): Channel[] {
  const channels: Channel[] = [];
  const lines = content.split(/\r?\n/);

  let pendingName = "";
  let pendingGroup = "";
  let pendingLogo: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "#EXTM3U") continue;

    if (line.startsWith("#EXTINF:")) {
      const groupMatch = line.match(/group-title="([^"]*)"/);
      pendingGroup = groupMatch ? groupMatch[1] : "";
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      pendingLogo = logoMatch ? logoMatch[1] : null;
      const commaIdx = line.lastIndexOf(",");
      pendingName = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : "";
      continue;
    }

    if (line.startsWith("#")) continue;

    // Validate URLs before adding channel
    const sanitizedStreamUrl = sanitizeStreamUrl(line);
    if (!sanitizedStreamUrl) {
      // Skip invalid stream URLs
      pendingName = "";
      pendingGroup = "";
      pendingLogo = null;
      continue;
    }

    channels.push({
      id: simpleHash(sanitizedStreamUrl),
      name: pendingName || line,
      group: pendingGroup,
      logo_url: sanitizeUrl(pendingLogo),
      stream_url: sanitizedStreamUrl,
      is_live: false,
    });
    pendingName = "";
    pendingGroup = "";
    pendingLogo = null;
  }

  return channels;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simpleHash(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const hash = blake2b(bytes, { dkLen: 8 });
  return Array.from(hash).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function compactifyChannels(channels: Channel[]): CompactChannel[] {
  return channels.map((ch) => ({
    n: ch.name,
    g: ch.group,
    l: ch.logo_url,
    s: ch.stream_url,
  }));
}

export function expandChannels(compact: CompactChannel[]): Channel[] {
  return compact.flatMap((c) => {
    const sanitizedStreamUrl = sanitizeStreamUrl(c.s);
    if (!sanitizedStreamUrl) return [];

    return [{
      id: simpleHash(sanitizedStreamUrl),
      name: c.n,
      group: c.g,
      logo_url: sanitizeUrl(c.l),
      stream_url: sanitizedStreamUrl,
      is_live: false,
    }];
  });
}

// ---------------------------------------------------------------------------
// Save playlist to Bulletin Chain
// ---------------------------------------------------------------------------

/**
 * Store a playlist on the Bulletin Chain using TransactionStorage.store().
 *
 * When running inside a host environment (Polkadot Desktop), the user signs
 * directly via the host signer — no Sudo wrapper is used.
 *
 * When running in standalone dev mode, falls back to Alice dev key with
 * Sudo.sudo() wrapper.
 *
 * Flow:
 *   1. Serialize channels → M3U → gzip compress
 *   2. Store compressed data on-chain (directly or via Sudo)
 *   3. Compute CID locally (blake2b-256)
 *   4. system.remark_with_event("IPTVCID:{address}:{name}:{cid}") as pointer
 *
 * @param address - SS58 address of the account
 * @param _source - auth source (unused, kept for API compatibility)
 * @param name - playlist name
 * @param channels - channels to serialize
 * @param publicKey - raw public key for host signing (from HostAccount/UnifiedAccount)
 * @param signer - optional external signer override
 */
export async function submitPlaylistToChain(
  address: string,
  _source: string,
  name: string,
  channels: Channel[],
  publicKey?: Uint8Array,
  signer?: PolkadotSigner
): Promise<string> {
  if (!address || address.length < 46 || address.length > 48) {
    throw new Error("Invalid SS58 address format");
  }

  let apiResult: { api: TypedApi<typeof bulletinchain> };
  try {
    apiResult = await getBulletinApi();
  } catch {
    resetBulletinApi();
    apiResult = await getBulletinApi();
  }
  const { api } = apiResult;

  // Resolve signer: explicit override > host signer (when hosted) > Alice dev key
  const hosted = isHostedEnvironment();
  const resolvedSigner: PolkadotSigner = signer
    ?? (hosted && publicKey ? getHostSigner(publicKey) : await getAliceSigner());

  // 1. Serialize -> M3U -> gzip compress
  const m3uString = serializeToM3U(channels);
  const rawBytes = new TextEncoder().encode(m3uString);
  const compressed = await gzipCompress(rawBytes);

  // 2. Compute CID from compressed data
  const cid = computeCID(compressed);
  const cidString = cid.toString();

  // 3. Store data — host path: user signs directly; dev path: Sudo wrapper
  const storeTx = api.tx.TransactionStorage.store({
    data: Binary.fromBytes(compressed),
  });

  let storeResult: string;

  if (hosted && publicKey) {
    // Host: user signs TransactionStorage.store() directly (no Sudo)
    storeResult = await new Promise<string>((resolve, reject) => {
      const sub = storeTx.signSubmitAndWatch(resolvedSigner).subscribe({
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
        error: (err) => { sub.unsubscribe(); reject(err); },
      });
    });
  } else {
    // Dev: wrap in Sudo.sudo() signed by Alice
    // decodedCall may be a Promise in newer PAPI versions
    const decodedCallRaw = storeTx.decodedCall;
    const decodedCall =
      decodedCallRaw instanceof Promise ? await decodedCallRaw : decodedCallRaw;
    const sudoStoreTx = api.tx.Sudo.sudo({
      call: decodedCall,
    });

    storeResult = await new Promise<string>((resolve, reject) => {
      const sub = sudoStoreTx.signSubmitAndWatch(resolvedSigner).subscribe({
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
        error: (err) => { sub.unsubscribe(); reject(err); },
      });
    });
  }

  // 4. Submit CID pointer remark: IPTVCID:{address}:{encodedName}:{cid}
  const encodedName = encodeURIComponent(name);
  const pointerStr = `IPTVCID:${address}:${encodedName}:${cidString}`;
  const pointerBytes = new TextEncoder().encode(pointerStr);

  const remarkTx = api.tx.System.remark_with_event({
    remark: Binary.fromBytes(pointerBytes),
  });

  await new Promise<void>((resolve, reject) => {
    const remarkSub = remarkTx.signSubmitAndWatch(resolvedSigner).subscribe({
      next: (event) => {
        if (event.type === "finalized") {
          remarkSub.unsubscribe();
          if (event.ok) {
            resolve();
          } else {
            reject(new Error("CID pointer remark failed on-chain"));
          }
        }
      },
      error: (err) => { remarkSub.unsubscribe(); reject(err); },
    });
  });

  return `${storeResult}:${cidString}`;
}

// ---------------------------------------------------------------------------
// Load playlist from Bulletin Chain
// ---------------------------------------------------------------------------

/**
 * Scan recent Bulletin Chain blocks for the user's latest IPTVCID pointer remark.
 * Then fetch the compressed M3U from the IPFS gateway using the CID.
 */
export async function loadPlaylistFromChain(
  address: string,
  signal?: AbortSignal
): Promise<ChainPlaylistResponse> {
  if (!address || address.length < 46 || address.length > 48) {
    throw new Error("Invalid SS58 address format");
  }

  // Scan blocks for CID pointer remarks using raw JSON-RPC (with retry)
  let pointer: CIDPointer | null;
  try {
    pointer = await scanForCIDPointer(address, signal);
  } catch {
    resetBulletinApi();
    pointer = await scanForCIDPointer(address, signal);
  }
  if (!pointer) return { found: false };

  // Validate CID format before constructing URL
  try {
    CID.parse(pointer.cid);
  } catch {
    return { found: false };
  }

  // Fetch from IPFS gateway
  const url = `${IPFS_GATEWAY}/${pointer.cid}`;
  const fetchSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
    : AbortSignal.timeout(15000);
  const response = await fetch(url, {
    signal: fetchSignal,
  });
  if (!response.ok) {
    return { found: false };
  }

  // Check Content-Length header for compressed size limit
  const contentLength = response.headers.get("Content-Length");
  if (contentLength && parseInt(contentLength, 10) > MAX_COMPRESSED_SIZE) {
    return { found: false };
  }

  const arrayBuffer = await response.arrayBuffer();
  const compressed = new Uint8Array(arrayBuffer);

  // Verify compressed size after download
  if (compressed.byteLength > MAX_COMPRESSED_SIZE) {
    return { found: false };
  }

  // Verify CID matches fetched content
  const computedCid = computeCID(compressed);
  if (computedCid.toString() !== pointer.cid) {
    return { found: false };
  }

  // Decompress and parse M3U (with size limit protection)
  let decompressed: Uint8Array;
  try {
    decompressed = await gzipDecompress(compressed);
  } catch {
    return { found: false };
  }

  const m3uContent = new TextDecoder().decode(decompressed);
  const channels = parseM3U(m3uContent);
  if (channels.length === 0) return { found: false };

  const playlist: Playlist = {
    name: pointer.name,
    channels,
    last_checked: null,
    source: "chain",
  };

  return {
    found: true,
    playlist,
    block_number: pointer.blockNumber,
    cid: pointer.cid,
  };
}

// ---------------------------------------------------------------------------
// Block scanning via raw JSON-RPC over WebSocket
// ---------------------------------------------------------------------------

type CIDPointer = {
  cid: string;
  name: string;
  blockNumber: number;
};

async function scanForCIDPointer(
  address: string,
  signal?: AbortSignal
): Promise<CIDPointer | null> {
  // Use a temporary WebSocket for JSON-RPC block scanning
  const rpcCall = createJsonRpcCaller(BULLETIN_ENDPOINT);

  try {
    const headerResult = (await rpcCall("chain_getHeader", [])) as {
      number: string;
    };
    const headNumber = parseInt(headerResult.number, 16);
    const startBlock = Math.max(headNumber - SCAN_BLOCK_LIMIT, 0);

    const BATCH_SIZE = 10;
    for (let batchStart = headNumber; batchStart > startBlock; batchStart -= BATCH_SIZE) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const batchEnd = Math.max(batchStart - BATCH_SIZE, startBlock);
      const blockNums: number[] = [];
      for (let i = batchStart; i > batchEnd; i--) blockNums.push(i);

      const hashes = await Promise.all(blockNums.map(n => rpcCall("chain_getBlockHash", [n])));
      const blocks = await Promise.all(hashes.map(h => rpcCall("chain_getBlock", [h])));

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i] as { block: { extrinsics: string[] } };
        for (const ext of block.block.extrinsics) {
          const pointer = parseExtrinsicForPointer(ext, address, blockNums[i]);
          if (pointer) return pointer;
        }
      }
    }

    return null;
  } finally {
    rpcCall.close();
  }
}

function parseExtrinsicForPointer(
  hexExtrinsic: string,
  address: string,
  blockNum: number
): CIDPointer | null {
  // The remark data in a SCALE-encoded extrinsic is hard to decode without
  // a full SCALE decoder. Instead, search for the IPTVCID prefix in the hex.
  const prefix = `IPTVCID:${address}:`;
  const prefixHex = toHex(new TextEncoder().encode(prefix));

  const idx = hexExtrinsic.indexOf(prefixHex);
  if (idx === -1) return null;

  // Extract the remaining bytes after prefix
  const afterPrefix = hexExtrinsic.slice(idx + prefixHex.length);
  // Find the end of the ASCII content (CID + name are ASCII)
  const decoded = hexToAscii(afterPrefix);
  // Format: {name}:{cid}
  // CID starts with 'b' (base32) — find the last colon
  const lastColon = decoded.lastIndexOf(":");
  if (lastColon === -1) return null;

  const rawName = decoded.slice(0, lastColon);
  const name = decodeURIComponent(rawName);
  const cid = decoded.slice(lastColon + 1).replace(/[^a-zA-Z0-9]/g, "");

  if (!cid || !name) return null;

  return { cid, name, blockNumber: blockNum };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToAscii(hex: string): string {
  let result = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code < 32 || code > 126) break; // stop at non-printable
    result += String.fromCharCode(code);
  }
  return result;
}

// ---------------------------------------------------------------------------
// JSON-RPC over WebSocket helper
// ---------------------------------------------------------------------------

type RpcCaller = {
  (method: string, params: unknown[]): Promise<unknown>;
  close: () => void;
};

function createJsonRpcCaller(endpoint: string): RpcCaller {
  let idCounter = 1;
  let ws: WebSocket | null = null;
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timeoutId: ReturnType<typeof setTimeout> }
  >();
  let openPromise: Promise<void> | null = null;

  function ensureOpen(): Promise<void> {
    if (ws && ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (openPromise) return openPromise;

    openPromise = new Promise<void>((resolve, reject) => {
      ws = new WebSocket(endpoint);
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket connection failed"));
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            id: unknown;
            result?: unknown;
            error?: { message: string };
          };
          if (typeof data.id !== "number") return;
          const p = pending.get(data.id);
          if (!p) return;
          clearTimeout(p.timeoutId);
          pending.delete(data.id);
          if (data.error) {
            p.reject(new Error(data.error.message));
          } else {
            p.resolve(data.result);
          }
        } catch {
          // Ignore malformed JSON messages
        }
      };
      ws.onclose = () => {
        openPromise = null;
        for (const [, p] of pending) {
          clearTimeout(p.timeoutId);
          p.reject(new Error("WebSocket closed"));
        }
        pending.clear();
      };
    });
    return openPromise;
  }

  const call = async (
    method: string,
    params: unknown[]
  ): Promise<unknown> => {
    await ensureOpen();
    const id = idCounter++;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`RPC call ${method} timed out after ${RPC_CALL_TIMEOUT_MS}ms`));
      }, RPC_CALL_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timeoutId });
      ws!.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  };

  return Object.assign(call, {
    close: () => { if (ws) { ws.close(); ws = null; } openPromise = null; },
  }) as RpcCaller;
}
