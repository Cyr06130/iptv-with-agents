import type { Channel } from "./types";

// ---------------------------------------------------------------------------
// Device types
// ---------------------------------------------------------------------------

export type DeviceType = "web" | "desktop" | "mobile";

export type PeerDevice = {
  name: string;
  type: DeviceType;
  /** Peer identifier from the chat action (opaque string from host) */
  peerId: string;
};

// ---------------------------------------------------------------------------
// Compact channel payload (matches CompactChannel convention)
// ---------------------------------------------------------------------------

export type SyncChannelPayload = {
  n: string;
  s: string;
  g: string;
  l: string | null;
};

// ---------------------------------------------------------------------------
// Sync protocol messages (compact keys to minimize message size)
// ---------------------------------------------------------------------------

export type OnlineMessage = {
  t: "online";
  /** Device display name */
  d: string;
  /** Device type */
  dt: DeviceType;
};

export type OfflineMessage = {
  t: "offline";
  d: string;
};

export type TransferMessage = {
  t: "transfer";
  /** Request ID (UUID) */
  rid: string;
  /** Sender device name */
  from: string;
  /** Target device type */
  to: DeviceType;
  /** Channel to transfer */
  ch: SyncChannelPayload;
};

export type ApprovedMessage = {
  t: "approved";
  /** Request ID (may be absent for Mobile self-approvals) */
  rid?: string;
  /** Approver device name */
  from: string;
  /** Target device type */
  to: DeviceType;
  /** Channel to play */
  ch: SyncChannelPayload;
};

export type RejectedMessage = {
  t: "rejected";
  rid: string;
};

export type SyncMessage =
  | OnlineMessage
  | OfflineMessage
  | TransferMessage
  | ApprovedMessage
  | RejectedMessage;

// ---------------------------------------------------------------------------
// Hook state types
// ---------------------------------------------------------------------------

export type IncomingTransfer = {
  /** "gatekeeper" = Mobile asked to approve; "target" = this device should play */
  role: "gatekeeper" | "target";
  requestId: string;
  fromDevice: string;
  toDeviceType: DeviceType;
  channel: Channel;
};

export type PendingOutgoingTransfer = {
  requestId: string;
  target: DeviceType;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function channelToPayload(ch: Channel): SyncChannelPayload {
  return { n: ch.name, s: ch.stream_url, g: ch.group, l: ch.logo_url };
}
