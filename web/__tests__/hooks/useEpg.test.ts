import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useEpg } from "@/hooks/useEpg";
import type { EpgSchedule } from "@/lib/types";

const now = Date.now();
const hour = 60 * 60 * 1000;

const mockSchedule: EpgSchedule = {
  channel_id: "bbc1",
  programs: [
    {
      id: "p1",
      channel_id: "bbc1",
      title: "Morning Show",
      start: new Date(now - 2 * hour).toISOString(),
      end: new Date(now - hour).toISOString(),
    },
    {
      id: "p2",
      channel_id: "bbc1",
      title: "Noon News",
      start: new Date(now - 30 * 60 * 1000).toISOString(),
      end: new Date(now + 30 * 60 * 1000).toISOString(),
      category: "News",
    },
    {
      id: "p3",
      channel_id: "bbc1",
      title: "Afternoon Drama",
      start: new Date(now + hour).toISOString(),
      end: new Date(now + 2 * hour).toISOString(),
    },
    {
      id: "p4",
      channel_id: "bbc1",
      title: "Late Night",
      start: new Date(now + 3 * hour).toISOString(),
      end: new Date(now + 4 * hour).toISOString(),
    },
  ],
};

describe("useEpg", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(now);
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("initial loading state", () => {
    it("returns loading=true initially, then loading=false after fetch completes", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSchedule), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const { result } = renderHook(() => useEpg("bbc1"));

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe("fetch URL", () => {
    it("fetches from correct URL with encoded channel_id", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSchedule), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      renderHook(() => useEpg("bbc 1/test"));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          "http://localhost:3001/api/epg/bbc%201%2Ftest"
        );
      });
    });
  });

  describe("null channelId", () => {
    it("does not fetch when channelId is null", () => {
      renderHook(() => useEpg(null));

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns default state when channelId is null", () => {
      const { result } = renderHook(() => useEpg(null));

      expect(result.current.schedule).toBeNull();
      expect(result.current.currentProgram).toBeNull();
      expect(result.current.nextProgram).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasEpg).toBe(true);
    });
  });

  describe("404 response", () => {
    it("sets hasEpg=false on 404 response without setting error", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(null, { status: 404 })
      );

      const { result } = renderHook(() => useEpg("unknown-channel"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasEpg).toBe(false);
      expect(result.current.schedule).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe("successful response", () => {
    it("returns schedule data after successful fetch", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSchedule), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const { result } = renderHook(() => useEpg("bbc1"));

      await waitFor(() => {
        expect(result.current.schedule).not.toBeNull();
      });

      expect(result.current.schedule?.channel_id).toBe("bbc1");
      expect(result.current.schedule?.programs).toHaveLength(4);
      expect(result.current.hasEpg).toBe(true);
    });

    it("returns currentProgram when a program spans current time", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSchedule), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const { result } = renderHook(() => useEpg("bbc1"));

      await waitFor(() => {
        expect(result.current.currentProgram).not.toBeNull();
      });

      expect(result.current.currentProgram?.title).toBe("Noon News");
    });

    it("returns nextProgram as the earliest future program", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSchedule), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const { result } = renderHook(() => useEpg("bbc1"));

      await waitFor(() => {
        expect(result.current.nextProgram).not.toBeNull();
      });

      expect(result.current.nextProgram?.title).toBe("Afternoon Drama");
    });
  });

  describe("error handling", () => {
    it("sets error on non-ok response (non-404)", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(null, { status: 500 })
      );

      const { result } = renderHook(() => useEpg("bbc1"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to fetch EPG: 500");
      expect(result.current.schedule).toBeNull();
    });

    it("sets error on network failure", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useEpg("bbc1"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Network error");
      expect(result.current.schedule).toBeNull();
    });
  });

  describe("channel change", () => {
    it("refetches when channelId changes", async () => {
      const schedule2: EpgSchedule = {
        channel_id: "itv1",
        programs: [],
      };

      fetchSpy
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockSchedule), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(schedule2), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

      const { result, rerender } = renderHook(
        ({ id }: { id: string }) => useEpg(id),
        { initialProps: { id: "bbc1" } }
      );

      await waitFor(() => {
        expect(result.current.schedule?.channel_id).toBe("bbc1");
      });

      rerender({ id: "itv1" });

      await waitFor(() => {
        expect(result.current.schedule?.channel_id).toBe("itv1");
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
