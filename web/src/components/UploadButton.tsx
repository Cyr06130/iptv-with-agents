"use client";

import { useRef, useState } from "react";
import { uploadPlaylist } from "@/lib/api";

type UploadButtonProps = {
  onUploadComplete: () => void;
};

export function UploadButton({ onUploadComplete }: UploadButtonProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      await uploadPlaylist(file);
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
    </>
  );
}
