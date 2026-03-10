/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, act } from "@testing-library/react";
import PropFirmSidebar from "@/components/propfirms/PropFirmSidebar";

jest.mock("next/link", () => {
  const Mock = ({ children, href }) => <a href={href}>{children}</a>;
  Mock.displayName = "NextLink";
  return { __esModule: true, default: Mock };
});
jest.mock("@/lib/theme", () => ({ THEME: { primary: "#635BFF" } }));
jest.mock("@/lib/logoUtils", () => ({
  getFirmLogoUrl: jest.fn((firm) => firm?.logo_url ?? "/icon.png"),
  DEFAULT_LOGO_URL: "/icon.png",
}));
jest.mock("recharts", () => ({
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

import * as logoUtils from "@/lib/logoUtils";

const emptyTrend = { overall_score: null, weeks: [], payout_daily: { consecutive_days_not_paid: 0 } };

function makeTrend({ tpWeeks = [], payoutWeeks = [], consecutiveDaysNotPaid = 0, overallScore = null } = {}) {
  const weeks = tpWeeks.map((avg, i) => ({
    week_from: `2026-0${i + 1}-01`,
    week_to: `2026-0${i + 1}-07`,
    avg_rating: avg,
    payout_total: payoutWeeks[i] ?? null,
  }));
  return {
    overall_score: overallScore,
    weeks,
    payout_daily: { consecutive_days_not_paid: consecutiveDaysNotPaid },
  };
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(emptyTrend),
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

describe("PropFirmSidebar", () => {
  it("renders display name from firm", () => {
    render(<PropFirmSidebar firmId="fundingpips" firm={{ name: "FundingPips", website: "https://fundingpips.com" }} />);
    expect(screen.getByRole("heading", { name: "FundingPips", level: 1 })).toBeInTheDocument();
  });

  it("renders display name from firmId when firm has no name", () => {
    render(<PropFirmSidebar firmId="funding-pips" firm={null} />);
    expect(screen.getByRole("heading", { name: "Funding Pips", level: 1 })).toBeInTheDocument();
  });

  it("renders website link with host only", () => {
    render(<PropFirmSidebar firmId="fundingpips" firm={{ name: "F", website: "https://fundingpips.com/" }} />);
    expect(screen.getByRole("link", { name: /fundingpips\.com/i })).toHaveAttribute("href", "https://fundingpips.com/");
  });

  it("renders Intelligence Status heading without a global badge", () => {
    render(<PropFirmSidebar firmId="fundingpips" firm={{ name: "F" }} />);
    expect(screen.getByText("Intelligence Status")).toBeInTheDocument();
    const stableBadges = screen.getAllByText("STABLE");
    expect(stableBadges.length).toBe(2);
  });

  it("renders View full analytics link to intelligence page", () => {
    render(<PropFirmSidebar firmId="fundingpips" firm={{ name: "F" }} />);
    expect(screen.getByRole("link", { name: /View full analytics/i })).toHaveAttribute("href", "/propfirms/fundingpips/intelligence");
  });

  it("renders Signal Alert card with Setup Alerts button", () => {
    render(<PropFirmSidebar firmId="fundingpips" firm={{ name: "F" }} />);
    expect(screen.getByText("Signal Alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Setup Alerts/i })).toBeInTheDocument();
  });

  it("renders Payout, Trustpilot, and Social signal rows", () => {
    render(<PropFirmSidebar firmId="fundingpips" firm={{ name: "F" }} />);
    expect(screen.getByText(/Payout/)).toBeInTheDocument();
    expect(screen.getByText(/Trustpilot/)).toBeInTheDocument();
    expect(screen.getByText(/Social/)).toBeInTheDocument();
  });

  it("renders without firm (uses firmId for display name and default website)", () => {
    render(<PropFirmSidebar firmId="the5ers" firm={null} />);
    expect(screen.getByRole("heading", { name: "The5ers", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /the5ers\.com/i })).toHaveAttribute("href", "https://the5ers.com");
  });

  it("shows initials when firm has no logo url", () => {
    logoUtils.getFirmLogoUrl.mockReturnValue("");
    render(<PropFirmSidebar firmId="fundingpips" firm={{ name: "FundingPips", website: "https://fundingpips.com" }} />);
    expect(screen.getByText("FU")).toBeInTheDocument();
  });

  it("fetches trend data on mount", () => {
    render(<PropFirmSidebar firmId="fundingpips" firm={{ name: "F" }} />);
    expect(global.fetch).toHaveBeenCalledWith("/api/v2/propfirms/fundingpips/trustpilot-trend");
  });

  describe("Trustpilot status badges", () => {
    it("shows STABLE when fewer than 2 weeks", async () => {
      global.fetch.mockResolvedValue({ json: () => Promise.resolve(makeTrend({ tpWeeks: [4.2] })) });
      render(<PropFirmSidebar firmId="fp" firm={{ name: "F" }} />);
      await waitFor(() => expect(screen.getAllByText("STABLE")).toHaveLength(2));
    });

    it("shows WATCH when 2 consecutive weekly rating drops", async () => {
      // DESC order: most recent first → 3.8, 4.0, 4.2 = 2 drops
      global.fetch.mockResolvedValue({ json: () => Promise.resolve(makeTrend({ tpWeeks: [3.8, 4.0, 4.2] })) });
      render(<PropFirmSidebar firmId="fp" firm={{ name: "F" }} />);
      await waitFor(() => expect(screen.getByText("WATCH")).toBeInTheDocument());
      expect(screen.getByText(/Trustpilot rating has slipped/i)).toBeInTheDocument();
    });

    it("shows ALERT when 3 consecutive weekly rating drops", async () => {
      // DESC: 3.6, 3.8, 4.0, 4.2 = 3 drops
      global.fetch.mockResolvedValue({ json: () => Promise.resolve(makeTrend({ tpWeeks: [3.6, 3.8, 4.0, 4.2] })) });
      render(<PropFirmSidebar firmId="fp" firm={{ name: "F" }} />);
      await waitFor(() => expect(screen.getByText("ALERT")).toBeInTheDocument());
      expect(screen.getByText(/Sustained Trustpilot rating decline/i)).toBeInTheDocument();
    });
  });

  describe("Payout status badges", () => {
    it("shows STABLE when consecutive_days_not_paid < 2", async () => {
      global.fetch.mockResolvedValue({ json: () => Promise.resolve(makeTrend({ consecutiveDaysNotPaid: 0 })) });
      render(<PropFirmSidebar firmId="fp" firm={{ name: "F" }} />);
      await waitFor(() => expect(screen.getAllByText("STABLE")).toHaveLength(2));
      expect(screen.getByText(/Consistent payout volume/i)).toBeInTheDocument();
    });

    it("shows WATCH when consecutive_days_not_paid >= 2", async () => {
      global.fetch.mockResolvedValue({ json: () => Promise.resolve(makeTrend({ consecutiveDaysNotPaid: 2 })) });
      render(<PropFirmSidebar firmId="fp" firm={{ name: "F" }} />);
      await waitFor(() => expect(screen.getByText("WATCH")).toBeInTheDocument());
      expect(screen.getByText(/Multiple missed payout days/i)).toBeInTheDocument();
    });

    it("shows ALERT when 3+ consecutive days not paid and 3+ weekly drops", async () => {
      // DESC order payout totals: 100, 200, 300, 400 = 3 drops
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve(makeTrend({
          payoutWeeks: [100, 200, 300, 400],
          tpWeeks: [4.0, 4.0, 4.0, 4.0],
          consecutiveDaysNotPaid: 3,
        })),
      });
      render(<PropFirmSidebar firmId="fp" firm={{ name: "F" }} />);
      await waitFor(() => expect(screen.getByText("ALERT")).toBeInTheDocument());
      expect(screen.getByText(/3\+ consecutive days without payouts/i)).toBeInTheDocument();
    });

    it("stays WATCH (not ALERT) when 3+ days not paid but weekly drops < 3", async () => {
      global.fetch.mockResolvedValue({ json: () => Promise.resolve(makeTrend({ consecutiveDaysNotPaid: 3 })) });
      render(<PropFirmSidebar firmId="fp" firm={{ name: "F" }} />);
      await waitFor(() => expect(screen.getByText("WATCH")).toBeInTheDocument());
      expect(screen.queryByText("ALERT")).not.toBeInTheDocument();
    });
  });

  describe("bar charts", () => {
    it("renders payout bar chart when 2+ payout weeks available", async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve(makeTrend({ payoutWeeks: [1000, 2000], tpWeeks: [4.0, 4.0] })),
      });
      render(<PropFirmSidebar firmId="fp" firm={{ name: "F" }} />);
      await waitFor(() => expect(screen.getAllByTestId("bar-chart").length).toBeGreaterThanOrEqual(1));
    });

    it("renders trustpilot bar chart when 2+ tp weeks available", async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve(makeTrend({ tpWeeks: [4.2, 4.0] })),
      });
      render(<PropFirmSidebar firmId="fp" firm={{ name: "F" }} />);
      await waitFor(() => expect(screen.getAllByTestId("bar-chart").length).toBeGreaterThanOrEqual(1));
    });
  });
});
