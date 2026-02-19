"use client";

import type { IncomingTransfer } from "@/lib/sync-types";

type TransferNotificationProps = {
  transfer: IncomingTransfer;
  onApprove: () => void;
  onReject: () => void;
  onAccept: () => void;
  onDismiss: () => void;
};

export function TransferNotification({
  transfer,
  onApprove,
  onReject,
  onAccept,
  onDismiss,
}: TransferNotificationProps): JSX.Element {
  const isGatekeeper = transfer.role === "gatekeeper";
  const isSelfTarget = isGatekeeper && transfer.toDeviceType === "mobile";

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in slide-in-from-bottom-4">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-base">
            {transfer.channel.logo_url ? (
              <img
                src={transfer.channel.logo_url}
                alt=""
                className="w-6 h-6 rounded object-cover"
              />
            ) : (
              "\u{1F4FA}"
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isGatekeeper ? (
              <>
                <p className="text-sm font-medium text-[var(--color-text-primary)] leading-tight">
                  {transfer.fromDevice} wants to send
                </p>
                <p className="text-sm text-accent font-semibold truncate mt-0.5">
                  {transfer.channel.name}
                </p>
                {!isSelfTarget && (
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    to {transfer.toDeviceType === "desktop" ? "Desktop App" : "Web Browser"}
                  </p>
                )}
                {isSelfTarget && (
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    to this device
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-[var(--color-text-primary)] leading-tight">
                  Stream incoming
                </p>
                <p className="text-sm text-accent font-semibold truncate mt-0.5">
                  {transfer.channel.name}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                  Approved by {transfer.fromDevice}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          {isGatekeeper && !isSelfTarget && (
            <>
              <button
                type="button"
                onClick={onReject}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => { onApprove(); }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Approve
              </button>
            </>
          )}
          {isGatekeeper && isSelfTarget && (
            <>
              <button
                type="button"
                onClick={onDismiss}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => { onApprove(); onAccept(); }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Watch Now
              </button>
            </>
          )}
          {!isGatekeeper && (
            <>
              <button
                type="button"
                onClick={onDismiss}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Watch Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
