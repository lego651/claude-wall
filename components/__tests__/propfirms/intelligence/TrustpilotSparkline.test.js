/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import TrustpilotSparkline from "@/components/propfirms/intelligence/TrustpilotSparkline";

jest.mock("recharts", () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

const makeWeeks = (n, avgRating = 4.0) =>
  Array.from({ length: n }, (_, i) => ({
    week_from: `2026-0${i + 1}-01`,
    week_to: `2026-0${i + 1}-07`,
    avg_rating: avgRating,
    review_count: 10,
    rating_change: 0,
  }));

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe("TrustpilotSparkline", () => {
  it("shows skeleton while loading", () => {
    global.fetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<TrustpilotSparkline firmId="fundingpips" />);
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows placeholder when fewer than 2 weeks", async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ overall_score: 4.2, weeks: makeWeeks(1) }),
    });
    render(<TrustpilotSparkline firmId="fundingpips" />);
    await waitFor(() =>
      expect(screen.getByText(/Trend data building/i)).toBeInTheDocument()
    );
  });

  it("shows placeholder when weeks is empty", async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ overall_score: null, weeks: [] }),
    });
    render(<TrustpilotSparkline firmId="fundingpips" />);
    await waitFor(() =>
      expect(screen.getByText(/Trend data building/i)).toBeInTheDocument()
    );
  });

  it("shows sparkline and scores when 2+ weeks of data", async () => {
    global.fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ overall_score: 4.2, weeks: makeWeeks(4, 4.0) }),
    });
    render(<TrustpilotSparkline firmId="fundingpips" />);
    await waitFor(() =>
      expect(screen.getByTestId("line-chart")).toBeInTheDocument()
    );
    expect(screen.getByText(/This week/i)).toBeInTheDocument();
    expect(screen.getByText(/Overall/i)).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("4.2")).toBeInTheDocument();
  });

  it("shows green delta when weekly > overall", async () => {
    global.fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ overall_score: 3.8, weeks: makeWeeks(4, 4.5) }),
    });
    render(<TrustpilotSparkline firmId="fundingpips" />);
    await waitFor(() => screen.getByTestId("line-chart"));
    const delta = screen.getByText(/\+0\.7/);
    expect(delta).toHaveClass("text-emerald-500");
  });

  it("shows red delta when weekly < overall by more than 0.3", async () => {
    global.fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ overall_score: 4.5, weeks: makeWeeks(4, 4.0) }),
    });
    render(<TrustpilotSparkline firmId="fundingpips" />);
    await waitFor(() => screen.getByTestId("line-chart"));
    const delta = screen.getByText(/-0\.5/);
    expect(delta).toHaveClass("text-red-500");
  });

  it("shows grey delta when weekly < overall by 0.3 or less", async () => {
    global.fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ overall_score: 4.2, weeks: makeWeeks(4, 4.0) }),
    });
    render(<TrustpilotSparkline firmId="fundingpips" />);
    await waitFor(() => screen.getByTestId("line-chart"));
    const delta = screen.getByText(/-0\.2/);
    expect(delta).toHaveClass("text-slate-400");
  });

  it("shows placeholder when fetch fails", async () => {
    global.fetch.mockRejectedValue(new Error("network error"));
    render(<TrustpilotSparkline firmId="fundingpips" />);
    await waitFor(() =>
      expect(screen.getByText(/Trend data building/i)).toBeInTheDocument()
    );
  });

  it("fetches from the correct endpoint", async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ overall_score: null, weeks: [] }),
    });
    render(<TrustpilotSparkline firmId="fundednext" />);
    await waitFor(() => screen.getByText(/Trend data building/i));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v2/propfirms/fundednext/trustpilot-trend"
    );
  });
});
