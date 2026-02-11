import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelList } from "@/components/ChannelList";
import type { Channel } from "@/lib/types";

const mockChannels: Channel[] = [
  {
    id: "1",
    name: "Channel One",
    group: "News",
    logo_url: "https://example.com/logo1.png",
    stream_url: "https://example.com/stream1.m3u8",
    is_live: true,
  },
  {
    id: "2",
    name: "Channel Two",
    group: "Sports",
    logo_url: null,
    stream_url: "https://example.com/stream2.m3u8",
    is_live: false,
  },
  {
    id: "3",
    name: "Channel Three",
    group: "Entertainment",
    logo_url: "https://example.com/logo3.png",
    stream_url: "https://example.com/stream3.m3u8",
    is_live: false,
  },
];

describe("ChannelList", () => {
  describe("when channels array is empty", () => {
    it("renders 'No channels found' message", () => {
      render(<ChannelList channels={[]} onSelect={vi.fn()} />);

      expect(screen.getByText("No channels found")).toBeInTheDocument();
    });
  });

  describe("when logo_url is null", () => {
    it("renders fallback div instead of img", () => {
      const channels: Channel[] = [
        {
          id: "1",
          name: "No Logo Channel",
          group: "Test",
          logo_url: null,
          stream_url: "https://example.com/stream.m3u8",
          is_live: false,
        },
      ];

      const { container } = render(<ChannelList channels={channels} onSelect={vi.fn()} />);

      // Should have TV text fallback
      expect(screen.getByText("TV")).toBeInTheDocument();

      // Should not have img element
      const img = container.querySelector("img");
      expect(img).toBeNull();
    });
  });

  describe("when logo_url is valid", () => {
    it("renders img element with correct src and alt", () => {
      const channels: Channel[] = [
        {
          id: "1",
          name: "Logo Channel",
          group: "Test",
          logo_url: "https://example.com/logo.png",
          stream_url: "https://example.com/stream.m3u8",
          is_live: false,
        },
      ];

      const { container } = render(<ChannelList channels={channels} onSelect={vi.fn()} />);

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/logo.png");
      expect(img).toHaveAttribute("alt", "Logo Channel");
    });
  });

  describe("onSelect callback", () => {
    it("fires when channel button is clicked", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(<ChannelList channels={mockChannels} onSelect={onSelect} />);

      const firstChannel = screen.getByRole("button", { name: /Channel One/i });
      await user.click(firstChannel);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(mockChannels[0]);
    });

    it("fires with correct channel when clicking different channels", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(<ChannelList channels={mockChannels} onSelect={onSelect} />);

      const secondChannel = screen.getByRole("button", { name: /Channel Two/i });
      await user.click(secondChannel);

      expect(onSelect).toHaveBeenCalledWith(mockChannels[1]);
    });
  });

  describe("selected channel visual distinction", () => {
    it("applies selected styles when channel.id matches selectedId", () => {
      render(
        <ChannelList channels={mockChannels} onSelect={vi.fn()} selectedId="1" />
      );

      const selectedButton = screen.getByRole("button", { name: /Channel One/i });
      expect(selectedButton).toHaveClass("bg-accent-soft", "border-accent/30");
    });

    it("applies default styles when channel.id does not match selectedId", () => {
      render(
        <ChannelList channels={mockChannels} onSelect={vi.fn()} selectedId="1" />
      );

      const unselectedButton = screen.getByRole("button", { name: /Channel Two/i });
      expect(unselectedButton).toHaveClass("bg-[var(--color-surface)]");
    });

    it("applies default styles when no selectedId is provided", () => {
      render(<ChannelList channels={mockChannels} onSelect={vi.fn()} />);

      const button = screen.getByRole("button", { name: /Channel One/i });
      expect(button).toHaveClass("bg-[var(--color-surface)]");
    });
  });

  describe("accessibility", () => {
    it("renders channels as buttons with accessible names", () => {
      render(<ChannelList channels={mockChannels} onSelect={vi.fn()} />);

      expect(screen.getByRole("button", { name: /Channel One/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Channel Two/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Channel Three/i })).toBeInTheDocument();
    });

    it("displays channel group information", () => {
      render(<ChannelList channels={mockChannels} onSelect={vi.fn()} />);

      expect(screen.getByText("News")).toBeInTheDocument();
      expect(screen.getByText("Sports")).toBeInTheDocument();
      expect(screen.getByText("Entertainment")).toBeInTheDocument();
    });

    it("displays live indicator for live channels", () => {
      render(<ChannelList channels={mockChannels} onSelect={vi.fn()} />);

      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("does not display live indicator for non-live channels", () => {
      const channels: Channel[] = [
        {
          id: "1",
          name: "Offline Channel",
          group: "Test",
          logo_url: null,
          stream_url: "https://example.com/stream.m3u8",
          is_live: false,
        },
      ];

      render(<ChannelList channels={channels} onSelect={vi.fn()} />);

      expect(screen.queryByText("Live")).not.toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles channels with empty names", () => {
      const channels: Channel[] = [
        {
          id: "1",
          name: "",
          group: "Test",
          logo_url: null,
          stream_url: "https://example.com/stream.m3u8",
          is_live: false,
        },
      ];

      render(<ChannelList channels={channels} onSelect={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("handles channels with empty groups", () => {
      const channels: Channel[] = [
        {
          id: "1",
          name: "No Group Channel",
          group: "",
          logo_url: null,
          stream_url: "https://example.com/stream.m3u8",
          is_live: false,
        },
      ];

      const { container } = render(<ChannelList channels={channels} onSelect={vi.fn()} />);

      // Group badge should still exist but be empty
      expect(container.querySelector(".font-mono")).toBeInTheDocument();
    });

    it("handles very long channel names", () => {
      const channels: Channel[] = [
        {
          id: "1",
          name: "A".repeat(100),
          group: "Test",
          logo_url: null,
          stream_url: "https://example.com/stream.m3u8",
          is_live: false,
        },
      ];

      render(<ChannelList channels={channels} onSelect={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("renders multiple channels with same id using index as fallback key", () => {
      const channels: Channel[] = [
        {
          id: "1",
          name: "Channel A",
          group: "Test",
          logo_url: null,
          stream_url: "https://example.com/stream.m3u8",
          is_live: false,
        },
        {
          id: "1",
          name: "Channel B",
          group: "Test",
          logo_url: null,
          stream_url: "https://example.com/stream.m3u8",
          is_live: false,
        },
      ];

      render(<ChannelList channels={channels} onSelect={vi.fn()} />);

      expect(screen.getByRole("button", { name: /Channel A/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Channel B/i })).toBeInTheDocument();
    });
  });
});
