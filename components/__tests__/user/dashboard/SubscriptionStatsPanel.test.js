/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import SubscriptionStatsPanel from "@/components/user/dashboard/SubscriptionStatsPanel";

describe("SubscriptionStatsPanel", () => {
  it("shows loading skeleton when loading is true", () => {
    render(<SubscriptionStatsPanel stats={null} loading={true} />);
    expect(screen.queryByText("Weekly Digest")).not.toBeInTheDocument();
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("shows Weekly Digest and count when loaded with stats", () => {
    const stats = {
      subscribedCount: 3,
      nextDigestDate: "2026-03-01T08:00:00.000Z",
      firms: [],
    };
    render(<SubscriptionStatsPanel stats={stats} loading={false} />);
    expect(screen.getByText("Weekly Digest")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Firms subscribed")).toBeInTheDocument();
    expect(screen.getByText(/Next digest:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage subscriptions/i })).toHaveAttribute(
      "href",
      "/user/settings?tab=subscriptions"
    );
  });

  it("shows 0 firms and no next digest when stats empty", () => {
    render(<SubscriptionStatsPanel stats={{ subscribedCount: 0, nextDigestDate: null, firms: [] }} loading={false} />);
    expect(screen.getByText("Weekly Digest")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText(/Next digest:/)).not.toBeInTheDocument();
  });

  it("handles null stats with loading false", () => {
    render(<SubscriptionStatsPanel stats={null} loading={false} />);
    expect(screen.getByText("Weekly Digest")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
