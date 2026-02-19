"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { uploadPlaylist } from "@/lib/api";

type UploadButtonProps = {
  onUploadComplete: () => void;
  hasExistingPlaylist: boolean;
};

type UploadMode = "append" | "replace";

export function UploadButton({ onUploadComplete, hasExistingPlaylist }: UploadButtonProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;

    if (hasExistingPlaylist) {
      setPendingFile(file);
    } else {
      doUpload(file, "replace");
    }
  }

  async function doUpload(file: File, mode: UploadMode): Promise<void> {
    try {
      setUploading(true);
      setPendingFile(null);
      await uploadPlaylist(file, mode);
      onUploadComplete();
    } catch {
      // Let the playlist hook's error state handle display
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleModeSelect(mode: UploadMode): void {
    if (pendingFile) {
      doUpload(pendingFile, mode);
    }
  }

  function handleCancel(): void {
    setPendingFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".m3u,.m3u8"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="shrink-0 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover active:bg-accent-active disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {uploading ? "Uploading..." : "Upload M3U"}
      </button>

      {pendingFile && (
        <UploadModeModal
          onSelect={handleModeSelect}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}

type UploadModeModalProps = {
  onSelect: (mode: UploadMode) => void;
  onCancel: () => void;
};

function UploadModeModal({ onSelect, onCancel }: UploadModeModalProps): JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    cancelRef.current?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Playlist already loaded"
    >
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 shadow-xl max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          Playlist already loaded
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          You already have channels loaded. What would you like to do?
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
            onClick={() => onSelect("replace")}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => onSelect("append")}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            Append
          </button>
        </div>
      </div>
    </div>
  );
}
