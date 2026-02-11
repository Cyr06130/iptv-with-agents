"use client";

import { useEffect, useRef } from "react";

type ConfirmDeleteModalProps = {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDeleteModal({
  count,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps): JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${count} channel${count !== 1 ? "s" : ""}`}
    >
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 shadow-xl max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          Delete channels
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Delete {count} channel{count !== 1 ? "s" : ""}? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/80 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
