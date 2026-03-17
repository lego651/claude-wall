/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { YouTubeSection, type YouTubePick } from "./YouTubeSection";

// Mock fetch for the analytics call
global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

function makeVideo(overrides: Partial<YouTubePick> = {}): YouTubePick {
  return {
    rank: 1,
    video_id: "vid1",
    title: "Test Video",
    channel_name: "Test Channel",
    thumbnail_url: null,
    video_url: "https://youtube.com/watch?v=vid1",
    views: 1000,
    ai_summary: null,
    published_at: "2024-01-02T08:00:00Z",
    video_type: "video",
    ...overrides,
  };
}

function makeVideos(count: number): YouTubePick[] {
  return Array.from({ length: count }, (_, i) =>
    makeVideo({ rank: i + 1, video_id: `vid${i + 1}`, title: `Video ${i + 1}` })
  );
}

afterEach(() => {
  jest.clearAllMocks();
});

describe("YouTubeSection", () => {
  it("renders exactly 3 videos by default when more exist", () => {
    render(<YouTubeSection videos={makeVideos(7)} liveStreams={[]} />);
    expect(screen.getAllByRole("link").filter((l) => l.textContent?.includes("Video"))).toHaveLength(3);
  });

  it("shows expand button when more than 3 videos", () => {
    render(<YouTubeSection videos={makeVideos(7)} liveStreams={[]} />);
    expect(screen.getByRole("button", { name: /show 4 more/i })).toBeInTheDocument();
  });

  it("does not show expand button when 3 or fewer videos", () => {
    render(<YouTubeSection videos={makeVideos(3)} liveStreams={[]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows all videos after clicking expand", async () => {
    render(<YouTubeSection videos={makeVideos(7)} liveStreams={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /show/i }));
    await waitFor(() => {
      expect(screen.getAllByRole("link").filter((l) => l.textContent?.includes("Video"))).toHaveLength(7);
    });
  });

  it("hides expand button after clicking it", async () => {
    render(<YouTubeSection videos={makeVideos(7)} liveStreams={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /show/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  it("calls analytics API on expand", async () => {
    render(<YouTubeSection videos={makeVideos(5)} liveStreams={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /show/i }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/events/youtube-expand",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("does not render live streams section when liveStreams is empty", () => {
    render(<YouTubeSection videos={makeVideos(3)} liveStreams={[]} />);
    expect(screen.queryByText(/live streams now/i)).not.toBeInTheDocument();
  });

  it("renders live streams section when liveStreams has items", () => {
    const live = [
      makeVideo({ video_id: "live1", title: "Live Session", video_type: "live" }),
    ];
    render(<YouTubeSection videos={makeVideos(3)} liveStreams={live} />);
    expect(screen.getByText(/live streams now/i)).toBeInTheDocument();
    expect(screen.getByText("Live Session")).toBeInTheDocument();
  });

  it("shows LIVE badge on live stream cards", () => {
    const live = [makeVideo({ video_id: "live1", title: "Live Now", video_type: "live" })];
    render(<YouTubeSection videos={[]} liveStreams={live} />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("shows empty state when no videos", () => {
    render(<YouTubeSection videos={[]} liveStreams={[]} />);
    expect(screen.getByText(/no video picks yet/i)).toBeInTheDocument();
  });
});
