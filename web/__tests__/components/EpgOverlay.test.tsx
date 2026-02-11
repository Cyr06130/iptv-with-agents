import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EpgOverlay } from "@/components/EpgOverlay";
import type { EpgProgram, EpgSchedule } from "@/lib/types";

// Build test programs relative to "now"
const now = Date.now();
const hour = 60 * 60 * 1000;

const currentProgram: EpgProgram = {
  id: "p1",
  channel_id: "bbc1",
  title: "Evening News",
  description: "Latest headlines and weather",
  start: new Date(now - hour).toISOString(),
  end: new Date(now + hour).toISOString(),
  category: "News",
};

const nextProgram: EpgProgram = {
  id: "p2",
  channel_id: "bbc1",
  title: "Drama Hour",
  description: "A gripping drama",
  start: new Date(now + hour).toISOString(),
  end: new Date(now + 2 * hour).toISOString(),
  category: "Drama",
};

const upcomingProgram: EpgProgram = {
  id: "p3",
  channel_id: "bbc1",
  title: "Late Show",
  start: new Date(now + 2 * hour).toISOString(),
  end: new Date(now + 3 * hour).toISOString(),
};

const mockSchedule: EpgSchedule = {
  channel_id: "bbc1",
  programs: [currentProgram, nextProgram, upcomingProgram],
};

// Mock the useEpg hook
const mockUseEpg = vi.fn();
vi.mock("@/hooks/useEpg", () => ({
  useEpg: (...args: unknown[]) => mockUseEpg(...args),
}));

describe("EpgOverlay", () => {
  const defaultProps = {
    channelId: "bbc1",
    channelName: "BBC One",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEpg.mockReturnValue({
      schedule: mockSchedule,
      currentProgram,
      nextProgram,
      loading: false,
      error: null,
      hasEpg: true,
    });
  });

  describe("loading state", () => {
    it("renders loading message when data is being fetched", () => {
      mockUseEpg.mockReturnValue({
        schedule: null,
        currentProgram: null,
        nextProgram: null,
        loading: true,
        error: null,
        hasEpg: true,
      });

      render(<EpgOverlay {...defaultProps} />);

      expect(screen.getByText("Loading program guide...")).toBeInTheDocument();
    });
  });

  describe("no EPG data", () => {
    it("displays 'No program guide available' when API returns 404", () => {
      mockUseEpg.mockReturnValue({
        schedule: null,
        currentProgram: null,
        nextProgram: null,
        loading: false,
        error: null,
        hasEpg: false,
      });

      render(<EpgOverlay {...defaultProps} />);

      expect(
        screen.getByText("No program guide available for this channel.")
      ).toBeInTheDocument();
    });
  });

  describe("current program display", () => {
    it("displays current program title", () => {
      render(<EpgOverlay {...defaultProps} />);

      expect(screen.getByText("Evening News")).toBeInTheDocument();
    });

    it("shows Now label for current program", () => {
      render(<EpgOverlay {...defaultProps} />);

      expect(screen.getByText("Now")).toBeInTheDocument();
    });

    it("shows program category when available", () => {
      render(<EpgOverlay {...defaultProps} />);

      expect(screen.getByText("News")).toBeInTheDocument();
    });

    it("shows program description when available", () => {
      render(<EpgOverlay {...defaultProps} />);

      expect(
        screen.getByText("Latest headlines and weather")
      ).toBeInTheDocument();
    });

    it("shows 'No program currently airing' when no current program", () => {
      mockUseEpg.mockReturnValue({
        schedule: mockSchedule,
        currentProgram: null,
        nextProgram,
        loading: false,
        error: null,
        hasEpg: true,
      });

      render(<EpgOverlay {...defaultProps} />);

      expect(
        screen.getByText("No program currently airing.")
      ).toBeInTheDocument();
    });
  });

  describe("progress bar", () => {
    it("renders progress bar for current program", () => {
      const { container } = render(<EpgOverlay {...defaultProps} />);

      // Progress bar has bg-[var(--color-accent)] class
      const progressBar = container.querySelector(
        ".bg-\\[var\\(--color-accent\\)\\]"
      );
      expect(progressBar).toBeInTheDocument();
    });

    it("progress bar has width between 0% and 100%", () => {
      const { container } = render(<EpgOverlay {...defaultProps} />);

      const progressBar = container.querySelector(
        ".bg-\\[var\\(--color-accent\\)\\]"
      ) as HTMLElement;
      expect(progressBar).toBeInTheDocument();
      const width = parseFloat(progressBar.style.width);
      expect(width).toBeGreaterThanOrEqual(0);
      expect(width).toBeLessThanOrEqual(100);
    });
  });

  describe("upcoming programs", () => {
    it("shows Up Next section with upcoming programs", () => {
      render(<EpgOverlay {...defaultProps} />);

      expect(screen.getByText("Up Next")).toBeInTheDocument();
    });

    it("displays upcoming program titles", () => {
      render(<EpgOverlay {...defaultProps} />);

      expect(screen.getByText("Drama Hour")).toBeInTheDocument();
      expect(screen.getByText("Late Show")).toBeInTheDocument();
    });

    it("displays category for upcoming programs when available", () => {
      render(<EpgOverlay {...defaultProps} />);

      expect(screen.getByText("Drama")).toBeInTheDocument();
    });
  });

  describe("channel name in header", () => {
    it("shows channel name in header", () => {
      render(<EpgOverlay {...defaultProps} />);

      expect(
        screen.getByText("BBC One -- Program Guide")
      ).toBeInTheDocument();
    });
  });

  describe("close behavior", () => {
    it("fires onClose when close button is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<EpgOverlay {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByLabelText("Close program guide");
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("fires onClose when Escape key is pressed", () => {
      const onClose = vi.fn();

      render(<EpgOverlay {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("fires onClose when backdrop is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<EpgOverlay {...defaultProps} onClose={onClose} />);

      // Backdrop has role="presentation"
      const backdrop = screen.getByRole("presentation");
      await user.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("has dialog role with accessible label", () => {
      render(<EpgOverlay {...defaultProps} />);

      const dialog = screen.getByRole("dialog", { name: "Program Guide" });
      expect(dialog).toBeInTheDocument();
    });

    it("close button has accessible label", () => {
      render(<EpgOverlay {...defaultProps} />);

      const closeButton = screen.getByLabelText("Close program guide");
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe("hook invocation", () => {
    it("passes channelId to useEpg hook", () => {
      render(<EpgOverlay {...defaultProps} />);

      expect(mockUseEpg).toHaveBeenCalledWith("bbc1");
    });
  });
});
