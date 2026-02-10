"use client";

import { useEffect, useRef, useState } from "react";

type VideoPlayerProps = {
  src: string | null;
  poster?: string;
};

export function VideoPlayer({ src, poster }: VideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !src) return;

    const video = videoRef.current;

    // Check if HLS is supported
    if (src.endsWith(".m3u8")) {
      // Dynamic import for HLS.js
      import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play();
            setIsPlaying(true);
          });

          return () => {
            hls.destroy();
          };
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS support (Safari)
          video.src = src;
          video.addEventListener("loadedmetadata", () => {
            video.play();
            setIsPlaying(true);
          });
        }
      });
    } else {
      // Regular video source
      video.src = src;
      video.play();
      setIsPlaying(true);
    }

    return () => {
      video.pause();
      video.src = "";
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.code === "Space") {
        e.preventDefault();
        if (video.paused) {
          video.play();
          setIsPlaying(true);
        } else {
          video.pause();
          setIsPlaying(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!src) {
    return (
      <div className="w-full h-full bg-surface rounded-lg flex items-center justify-center">
        <div className="text-center text-text-muted">
          <svg
            className="w-16 h-16 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg">Select a channel to start streaming</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        controls
        poster={poster}
        className="w-full h-full"
        playsInline
      />
    </div>
  );
}
