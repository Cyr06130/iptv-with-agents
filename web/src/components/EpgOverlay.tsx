"use client";

import { useEffect, useMemo } from "react";
import { useEpg } from "@/hooks/useEpg";
import type { EpgProgram } from "@/lib/types";

type EpgOverlayProps = {
  channelId: string;
  channelName: string;
  onClose: () => void;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ProgramProgress({ program }: { program: EpgProgram }): JSX.Element {
  const percentage = useMemo((): number => {
    const now = Date.now();
    const start = new Date(program.start).getTime();
    const end = new Date(program.end).getTime();
    const duration = end - start;
    if (duration <= 0) return 0;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
  }, [program]);

  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
      <div
        className="h-full bg-[var(--color-accent)] rounded-full transition-[width] duration-1000"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function EpgOverlay({
  channelId,
  channelName,
  onClose,
}: EpgOverlayProps): JSX.Element {
  const { schedule, currentProgram, nextProgram, loading, hasEpg } =
    useEpg(channelId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const upcomingPrograms = useMemo((): EpgProgram[] => {
    if (!schedule) return [];
    const now = Date.now();
    return schedule.programs
      .filter((p) => new Date(p.start).getTime() > now)
      .sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
      )
      .slice(0, 5);
  }, [schedule]);

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col justify-end animate-slideUp"
      role="dialog"
      aria-label="Program Guide"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        role="presentation"
      />

      {/* Content panel */}
      <div className="relative z-10 max-h-[80%] flex flex-col rounded-t-xl bg-black/80 backdrop-blur-sm border-t border-white/10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-medium text-base truncate pr-4">
            {channelName} -- Program Guide
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors shrink-0"
            aria-label="Close program guide"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        {loading && (
          <div className="text-white/50 text-sm py-8 text-center">
            Loading program guide...
          </div>
        )}

        {!loading && !hasEpg && (
          <div className="text-white/50 text-sm py-8 text-center">
            No program guide available for this channel.
          </div>
        )}

        {!loading && hasEpg && (
          <div className="overflow-y-auto flex-1 space-y-4">
            {/* Current program */}
            {currentProgram ? (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-accent)] font-semibold">
                    Now
                  </span>
                  {currentProgram.category && (
                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
                      {currentProgram.category}
                    </span>
                  )}
                </div>
                <h3 className="text-white font-medium text-sm">
                  {currentProgram.title}
                </h3>
                <p className="text-white/50 text-xs mt-0.5">
                  {formatTime(currentProgram.start)} --{" "}
                  {formatTime(currentProgram.end)}
                </p>
                {currentProgram.description && (
                  <p className="text-white/40 text-xs mt-1 line-clamp-2">
                    {currentProgram.description}
                  </p>
                )}
                <ProgramProgress program={currentProgram} />
              </div>
            ) : (
              <div className="text-white/40 text-xs py-2">
                No program currently airing.
              </div>
            )}

            {/* Upcoming */}
            {upcomingPrograms.length > 0 && (
              <div>
                <h4 className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-2">
                  Up Next
                </h4>
                <div className="space-y-1">
                  {upcomingPrograms.map((program) => (
                    <div
                      key={program.id}
                      className="flex items-baseline gap-3 py-2 px-3 rounded-md hover:bg-white/5 transition-colors"
                    >
                      <span className="text-white/40 text-xs font-mono shrink-0 w-24">
                        {formatTime(program.start)} --{" "}
                        {formatTime(program.end)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-white/80 text-sm truncate block">
                          {program.title}
                        </span>
                        {program.category && (
                          <span className="text-white/30 text-[10px] font-mono">
                            {program.category}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
