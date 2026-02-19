"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { EpgSchedule, EpgProgram } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

type UseEpgReturn = {
  schedule: EpgSchedule | null;
  currentProgram: EpgProgram | null;
  nextProgram: EpgProgram | null;
  loading: boolean;
  error: string | null;
  hasEpg: boolean;
};

export function useEpg(channelId: string | null): UseEpgReturn {
  const [schedule, setSchedule] = useState<EpgSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEpg, setHasEpg] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  const fetchSchedule = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/epg/${encodeURIComponent(id)}`);
      if (res.status === 404) {
        setHasEpg(false);
        setSchedule(null);
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch EPG: ${res.status}`);
      }
      const data = (await res.json()) as EpgSchedule;
      setSchedule(data);
      setHasEpg(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load EPG");
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!channelId) {
      setSchedule(null);
      setError(null);
      setHasEpg(true);
      setLoading(false);
      return;
    }

    fetchSchedule(channelId);

    const interval = setInterval(() => {
      fetchSchedule(channelId);
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [channelId, fetchSchedule]);

  // Update current time every 30 seconds for progress tracking
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const currentProgram = useMemo((): EpgProgram | null => {
    if (!schedule) return null;
    return (
      schedule.programs.find((p) => {
        const start = new Date(p.start).getTime();
        const end = new Date(p.end).getTime();
        return now >= start && now < end;
      }) ?? null
    );
  }, [schedule, now]);

  const nextProgram = useMemo((): EpgProgram | null => {
    if (!schedule) return null;
    const upcoming = schedule.programs
      .filter((p) => new Date(p.start).getTime() > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return upcoming[0] ?? null;
  }, [schedule, now]);

  return { schedule, currentProgram, nextProgram, loading, error, hasEpg };
}
