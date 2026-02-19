import { createProductChatManager } from "@novasamatech/product-sdk";
import type { ReceivedChatAction } from "@novasamatech/product-sdk";
import { isHostedEnvironment } from "@/hooks/useHostAccount";
import type {
  SyncMessage,
  DeviceType,
  SyncChannelPayload,
} from "./sync-types";

// ---------------------------------------------------------------------------
// Singleton chat manager
// ---------------------------------------------------------------------------

type ChatManager = ReturnType<typeof createProductChatManager>;
type Subscription = { unsubscribe: VoidFunction };

let chatManager: ChatManager | null = null;

function getChatManager(): ChatManager | null {
  if (!isHostedEnvironment()) return null;
  if (!chatManager) {
    chatManager = createProductChatManager();
  }
  return chatManager;
}

function roomId(address: string): string {
  return `iptv-sync-${address}`;
}

// ---------------------------------------------------------------------------
// Room lifecycle
// ---------------------------------------------------------------------------

export async function joinSyncRoom(
  address: string
): Promise<boolean> {
  const mgr = getChatManager();
  if (!mgr) return false;
  try {
    await mgr.registerRoom({
      roomId: roomId(address),
      name: "IPTV Sync",
      icon: "",
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Send helpers
// ---------------------------------------------------------------------------

async function sendRaw(
  address: string,
  payload: SyncMessage
): Promise<void> {
  const mgr = getChatManager();
  if (!mgr) return;
  await mgr.sendMessage(roomId(address), {
    tag: "Text",
    value: JSON.stringify(payload),
  });
}

export async function sendOnline(
  address: string,
  deviceName: string,
  deviceType: DeviceType
): Promise<void> {
  await sendRaw(address, { t: "online", d: deviceName, dt: deviceType });
}

export async function sendOffline(
  address: string,
  deviceName: string
): Promise<void> {
  await sendRaw(address, { t: "offline", d: deviceName });
}

export async function sendTransferRequest(
  address: string,
  requestId: string,
  from: string,
  to: DeviceType,
  channel: SyncChannelPayload
): Promise<void> {
  await sendRaw(address, {
    t: "transfer",
    rid: requestId,
    from,
    to,
    ch: channel,
  });
}

export async function sendApproval(
  address: string,
  from: string,
  to: DeviceType,
  channel: SyncChannelPayload,
  requestId?: string
): Promise<void> {
  await sendRaw(address, {
    t: "approved",
    ...(requestId ? { rid: requestId } : {}),
    from,
    to,
    ch: channel,
  });
}

export async function sendRejection(
  address: string,
  requestId: string
): Promise<void> {
  await sendRaw(address, { t: "rejected", rid: requestId });
}

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

/**
 * Subscribe to incoming sync messages for a given address.
 * Filters by room and ignores non-Text / non-MessagePosted payloads.
 * Returns null if the environment doesn't support chat.
 */
export function subscribeSyncActions(
  address: string,
  selfPeerId: { current: string | null },
  callback: (msg: SyncMessage, peer: string) => void
): Subscription | null {
  const mgr = getChatManager();
  if (!mgr) return null;

  const rid = roomId(address);

  return mgr.subscribeAction((action: ReceivedChatAction) => {
    if (action.roomId !== rid) return;

    // Ignore own messages
    if (selfPeerId.current && action.peer === selfPeerId.current) return;

    if (action.payload.tag !== "MessagePosted") return;
    const inner = action.payload.value;
    if (inner.tag !== "Text") return;

    try {
      const parsed = JSON.parse(inner.value) as SyncMessage;
      if (typeof parsed === "object" && parsed !== null && "t" in parsed) {
        callback(parsed, action.peer);
      }
    } catch {
      // Ignore non-JSON messages
    }
  });
}
