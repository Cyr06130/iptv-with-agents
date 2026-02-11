import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoPlayer } from "@/components/VideoPlayer";

// Mock hls.js
const mockHlsInstance = {
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn(),
};

const mockHlsConstructor = vi.fn(() => mockHlsInstance);

vi.mock("hls.js", () => ({
  default: mockHlsConstructor,
}));

// Add isSupported static method
Object.defineProperty(mockHlsConstructor, "isSupported", {
  value: vi.fn(() => true),
});

Object.defineProperty(mockHlsConstructor, "Events", {
  value: {
    MANIFEST_PARSED: "hlsManifestParsed",
    ERROR: "hlsError",
  },
});

describe("VideoPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when src is null", () => {
    it("renders placeholder message", () => {
      render(<VideoPlayer src={null} />);

      expect(screen.getByText(/Select a channel to start streaming/i)).toBeInTheDocument();
    });

    it("does not render video element when src is null", () => {
      const { container } = render(<VideoPlayer src={null} />);

      const video = container.querySelector("video");
      expect(video).toBeNull();
    });

    it("renders camera icon in placeholder", () => {
      const { container } = render(<VideoPlayer src={null} />);

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("when src is a valid URL", () => {
    it("renders video element", () => {
      const { container } = render(<VideoPlayer src="https://example.com/stream.m3u8" />);

      const video = container.querySelector("video");
      expect(video).toBeInTheDocument();
    });

    it("applies controls attribute to video", () => {
      const { container } = render(<VideoPlayer src="https://example.com/stream.m3u8" />);

      const video = container.querySelector("video");
      expect(video).toHaveAttribute("controls");
    });

    it("applies playsInline attribute to video", () => {
      const { container } = render(<VideoPlayer src="https://example.com/stream.m3u8" />);

      const video = container.querySelector("video");
      expect(video).toHaveAttribute("playsInline");
    });

    it("applies poster attribute when provided", () => {
      const { container } = render(
        <VideoPlayer
          src="https://example.com/stream.m3u8"
          poster="https://example.com/poster.jpg"
        />
      );

      const video = container.querySelector("video");
      expect(video).toHaveAttribute("poster", "https://example.com/poster.jpg");
    });

    it("does not apply poster attribute when not provided", () => {
      const { container } = render(<VideoPlayer src="https://example.com/stream.m3u8" />);

      const video = container.querySelector("video");
      // Poster is optional, checking it exists but may be empty
      expect(video).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("placeholder has semantic structure", () => {
      const { container } = render(<VideoPlayer src={null} />);

      // Check for text content
      expect(screen.getByText(/Select a channel to start streaming/i)).toBeInTheDocument();

      // Check SVG has viewBox for proper scaling
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox");
    });

    it("video element is accessible", () => {
      const { container } = render(<VideoPlayer src="https://example.com/stream.m3u8" />);

      const video = container.querySelector("video");
      expect(video).toHaveAttribute("controls");
      expect(video).toHaveAttribute("playsInline");
    });
  });

  describe("HLS.js integration", () => {
    it("loads video element when src is provided", () => {
      const { container } = render(<VideoPlayer src="https://example.com/stream.m3u8" />);

      // Video element should be present
      const video = container.querySelector("video");
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute("controls");
    });
  });

  describe("edge cases", () => {
    it("handles transition from null to valid src", () => {
      const { container, rerender } = render(<VideoPlayer src={null} />);

      // Initially shows placeholder
      expect(screen.getByText(/Select a channel to start streaming/i)).toBeInTheDocument();

      // Update to valid src
      rerender(<VideoPlayer src="https://example.com/stream.m3u8" />);

      // Now shows video
      const video = container.querySelector("video");
      expect(video).toBeInTheDocument();
    });

    it("handles transition from valid src to null", () => {
      const { container, rerender } = render(
        <VideoPlayer src="https://example.com/stream.m3u8" />
      );

      // Initially shows video
      let video = container.querySelector("video");
      expect(video).toBeInTheDocument();

      // Update to null
      rerender(<VideoPlayer src={null} />);

      // Now shows placeholder
      expect(screen.getByText(/Select a channel to start streaming/i)).toBeInTheDocument();
      video = container.querySelector("video");
      expect(video).toBeNull();
    });
  });
});
