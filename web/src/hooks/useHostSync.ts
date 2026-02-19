"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  joinSyncRoom,
  sendOnline,
  sendOffline,
  sendTransferRequest,
  sendApproval,
  sendRejection,
  subscribeSyncActions,
} from "@/lib/chat-sync";
import { sanitizeStreamUrl } from "@/lib/url-sanitizer";
import { isHostedEnvironment } from "@/hooks/useHostAccount";
import type { Channel } from "@/lib/types";
import type {
  DeviceType,
  PeerDevice,
  IncomingTransfer,
  PendingOutgoingTransfer,
  SyncMessage,
} from "@/lib/sync-types";
import { channelToPayload } from "@/lib/sync-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRANSFER_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authSourceToDeviceType(
  source: "host" | "papp" | "extension" | null
): DeviceType {
  switch (source) {
    case "host":
      return "desktop";
    case "papp":
      return "mobile";
    case "extension":
    default:
      return "web";
  }
}

function deviceTypeLabel(dt: DeviceType): string {
  switch (dt) {
    case "desktop":
      return "Desktop App";
    case "mobile":
      return "Mobile";
    case "web":
      return "Web Browser";
  }
}

function payloadToChannel(ch: { n: string; s: string; g: string; l: string | null }): Channel | null {
  const stream = sanitizeStreamUrl(ch.s);
  if (!stream) return null;
  return {
    id: crypto.randomUUID(),
    name: ch.n,
    group: ch.g,
    logo_url: ch.l,
    stream_url: stream,
    is_live: true,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

type UseHostSyncResult = {
  available: boolean;
  peers: PeerDevice[];
  sendTransfer: (targetDeviceType: DeviceType, channel: Channel) => Promise<string>;
  pendingTransfer: PendingOutgoingTransfer | null;
  incomingTransfer: IncomingTransfer | null;
  approveTransfer: () => void;
  rejectTransfer: () => void;
  acceptTransfer: () => Channel | null;
  dismissTransfer: () => void;
  /** Toast-style status message for the user */
  toastMessage: string | null;
  clearToast: () => void;
};

export function useHostSync(
  address: string | null,
  authSource: "host" | "papp" | "extension" | null,
  _currentChannelId: string | null
): UseHostSyncResult {
  const [available, setAvailable] = useState(false);
  const [peers, setPeers] = useState<PeerDevice[]>([]);
  const [pendingTransfer, setPendingTransfer] = useState<PendingOutgoingTransfer | null>(null);
  const [incomingTransfer, setIncomingTransfer] = useState<IncomingTransfer | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selfPeerId = useRef<string | null>(null);
  const pendingRef = useRef<PendingOutgoingTransfer | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep pendingRef in sync
  useEffect(() => {
    pendingRef.current = pendingTransfer;
  }, [pendingTransfer]);

  const myDeviceType = authSourceToDeviceType(authSource);
  const myDeviceName = deviceTypeLabel(myDeviceType);
  const isMobile = myDeviceType === "mobile";

  // Auto-clear toast after 4s
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  const handleMessage = useCallback(
    (msg: SyncMessage, peer: string) => {
      switch (msg.t) {
        case "online":
          setPeers((prev) => {
            // Replace if same name or add new
            const filtered = prev.filter((p) => p.name !== msg.d);
            return [...filtered, { name: msg.d, type: msg.dt, peerId: peer }];
          });
          break;

        case "offline":
          setPeers((prev) => prev.filter((p) => p.name !== msg.d));
          break;

        case "transfer":
          // Only Mobile handles transfer requests as gatekeeper
          if (!isMobile) break;
          {
            const ch = payloadToChannel(msg.ch);
            if (!ch) break;
            setIncomingTransfer({
              role: msg.to === "mobile" ? "target" : "gatekeeper",
              requestId: msg.rid,
              fromDevice: msg.from,
              toDeviceType: msg.to,
              channel: ch,
            });
          }
          break;

        case "approved":
          // Non-mobile devices act on approved messages targeting them
          if (msg.to === myDeviceType && !isMobile) {
            const ch = payloadToChannel(msg.ch);
            if (!ch) break;
            setIncomingTransfer({
              role: "target",
              requestId: msg.rid ?? crypto.randomUUID(),
              fromDevice: msg.from,
              toDeviceType: msg.to,
              channel: ch,
            });
          }
          // Sender gets confirmation
          if (pendingRef.current && msg.rid === pendingRef.current.requestId) {
            clearPendingTransfer();
            setToastMessage("Transfer approved");
          }
          break;

        case "rejected":
          if (pendingRef.current && msg.rid === pendingRef.current.requestId) {
            clearPendingTransfer();
            setToastMessage("Transfer declined");
          }
          break;
      }
    },
    [isMobile, myDeviceType] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ---------------------------------------------------------------------------
  // Lifecycle: join room, subscribe, announce
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!address || !isHostedEnvironment()) {
      setAvailable(false);
      setPeers([]);
      return;
    }

    let cancelled = false;

    (async () => {
      const joined = await joinSyncRoom(address);
      if (cancelled || !joined) return;

      setAvailable(true);

      // Subscribe
      const sub = subscribeSyncActions(address, selfPeerId, handleMessage);

      // Announce online
      await sendOnline(address, myDeviceName, myDeviceType);

      // Cleanup
      if (cancelled) {
        sub?.unsubscribe();
        return;
      }

      // Store cleanup fn
      cleanupRef.current = () => {
        sub?.unsubscribe();
        // Best-effort offline announcement
        sendOffline(address, myDeviceName).catch(() => {});
      };
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      setAvailable(false);
      setPeers([]);
      setPendingTransfer(null);
      setIncomingTransfer(null);
    };
  }, [address, myDeviceName, myDeviceType, handleMessage]);

  const cleanupRef = useRef<(() => void) | null>(null);

  // beforeunload → send offline
  useEffect(() => {
    if (!address || !available) return;
    const addr = address;
    const name = myDeviceName;
    const handler = (): void => {
      sendOffline(addr, name).catch(() => {});
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [address, available, myDeviceName]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function clearPendingTransfer(): void {
    setPendingTransfer(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  const sendTransferAction = useCallback(
    async (targetDeviceType: DeviceType, channel: Channel): Promise<string> => {
      if (!address) {
        setToastMessage("Connect wallet to send streams");
        return "";
      }
      if (!available) {
        setToastMessage("Sync not available outside host environment");
        return "";
      }

      const requestId = crypto.randomUUID();
      const payload = channelToPayload(channel);

      if (isMobile) {
        // Mobile self-approves — no round-trip needed
        await sendApproval(address, myDeviceName, targetDeviceType, payload);
        setToastMessage(`Sent to ${deviceTypeLabel(targetDeviceType)}`);
        return requestId;
      }

      // Non-mobile: send transfer request and wait for Mobile approval
      await sendTransferRequest(address, requestId, myDeviceName, targetDeviceType, payload);
      setPendingTransfer({ requestId, target: targetDeviceType });

      // Timeout after 30s
      timeoutRef.current = setTimeout(() => {
        if (pendingRef.current?.requestId === requestId) {
          setPendingTransfer(null);
          setToastMessage("Transfer timed out");
        }
      }, TRANSFER_TIMEOUT_MS);

      return requestId;
    },
    [address, isMobile, myDeviceName]
  );

  const approveTransferAction = useCallback(() => {
    if (!incomingTransfer || !address) return;
    const payload = channelToPayload(incomingTransfer.channel);

    if (incomingTransfer.role === "gatekeeper" && incomingTransfer.toDeviceType !== "mobile") {
      // Forward approval to the target device
      sendApproval(
        address,
        myDeviceName,
        incomingTransfer.toDeviceType,
        payload,
        incomingTransfer.requestId
      ).catch(() => {});
    }
    // If to === "mobile", Mobile is both gatekeeper and target — just play locally
    setIncomingTransfer(null);
  }, [incomingTransfer, address, myDeviceName]);

  const rejectTransferAction = useCallback(() => {
    if (!incomingTransfer || !address) return;
    sendRejection(address, incomingTransfer.requestId).catch(() => {});
    setIncomingTransfer(null);
  }, [incomingTransfer, address]);

  const acceptTransferAction = useCallback((): Channel | null => {
    if (!incomingTransfer) return null;
    const ch = incomingTransfer.channel;
    setIncomingTransfer(null);
    return ch;
  }, [incomingTransfer]);

  const dismissTransferAction = useCallback(() => {
    setIncomingTransfer(null);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  return {
    available,
    peers,
    sendTransfer: sendTransferAction,
    pendingTransfer,
    incomingTransfer,
    approveTransfer: approveTransferAction,
    rejectTransfer: rejectTransferAction,
    acceptTransfer: acceptTransferAction,
    dismissTransfer: dismissTransferAction,
    toastMessage,
    clearToast,
  };
}
