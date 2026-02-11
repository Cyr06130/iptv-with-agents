import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelList } from "@/components/ChannelList";
import type { Channel } from "@/lib/types";

const channelWithEpg: Channel = {
  id: "1",
  name: "BBC One",
  group: "News",
  logo_url: "https://example.com/bbc1.png",
  stream_url: "https://example.com/bbc1.m3u8",
  is_live: true,
  tvg_id: "bbc1.uk",
};

const channelWithoutEpg: Channel = {
  id: "2",
  name: "Local Radio",
  group: "Music",
  logo_url: null,
  stream_url: "https://example.com/radio.m3u8",
  is_live: false,
};

describe("ChannelList EPG icon", () => {
  describe("visibility based on tvg_id", () => {
    it("renders EPG icon on channels that have tvg_id", () => {
      render(
        <ChannelList
          channels={[channelWithEpg]}
          onSelect={vi.fn()}
          onEpgClick={vi.fn()}
        />
      );

      const epgButton = screen.getByTitle("Program Guide");
      expect(epgButton).toBeInTheDocument();
    });

    it("does NOT render EPG icon on channels without tvg_id", () => {
      render(
        <ChannelList
          channels={[channelWithoutEpg]}
          onSelect={vi.fn()}
          onEpgClick={vi.fn()}
        />
      );

      expect(screen.queryByTitle("Program Guide")).not.toBeInTheDocument();
    });

    it("renders EPG icon only for channels with tvg_id in a mixed list", () => {
      render(
        <ChannelList
          channels={[channelWithEpg, channelWithoutEpg]}
          onSelect={vi.fn()}
          onEpgClick={vi.fn()}
        />
      );

      const epgButtons = screen.getAllByTitle("Program Guide");
      expect(epgButtons).toHaveLength(1);
    });

    it("does NOT render EPG icon when onEpgClick is not provided", () => {
      render(
        <ChannelList
          channels={[channelWithEpg]}
          onSelect={vi.fn()}
        />
      );

      expect(screen.queryByTitle("Program Guide")).not.toBeInTheDocument();
    });
  });

  describe("click behavior", () => {
    it("calls onEpgClick with the channel when EPG icon is clicked", async () => {
      const user = userEvent.setup();
      const onEpgClick = vi.fn();

      render(
        <ChannelList
          channels={[channelWithEpg]}
          onSelect={vi.fn()}
          onEpgClick={onEpgClick}
        />
      );

      const epgButton = screen.getByTitle("Program Guide");
      await user.click(epgButton);

      expect(onEpgClick).toHaveBeenCalledTimes(1);
      expect(onEpgClick).toHaveBeenCalledWith(channelWithEpg);
    });

    it("does NOT trigger onSelect when EPG icon is clicked", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onEpgClick = vi.fn();

      render(
        <ChannelList
          channels={[channelWithEpg]}
          onSelect={onSelect}
          onEpgClick={onEpgClick}
        />
      );

      const epgButton = screen.getByTitle("Program Guide");
      await user.click(epgButton);

      expect(onEpgClick).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("edit mode", () => {
    it("hides EPG icon when editMode is true", () => {
      render(
        <ChannelList
          channels={[channelWithEpg]}
          onSelect={vi.fn()}
          onEpgClick={vi.fn()}
          editMode={true}
          selectedIds={new Set()}
          onToggleSelect={vi.fn()}
        />
      );

      expect(screen.queryByTitle("Program Guide")).not.toBeInTheDocument();
    });

    it("shows EPG icon when editMode is false", () => {
      render(
        <ChannelList
          channels={[channelWithEpg]}
          onSelect={vi.fn()}
          onEpgClick={vi.fn()}
          editMode={false}
        />
      );

      expect(screen.getByTitle("Program Guide")).toBeInTheDocument();
    });
  });
});
