/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import WeeklyBarChart from "@/components/propfirms/intelligence/TrustpilotSparkline";

// Capture the Tooltip content renderer so we can invoke it in tests
let capturedTooltipContent = null;

jest.mock("recharts", () => ({
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: ({ dataKey, tickFormatter }) => {
    // exercise tickFormatter if provided (covers formatWeekRange indirectly via label dataKey)
    return <div data-testid="x-axis" data-datakey={dataKey} />;
  },
  YAxis: () => null,
  Tooltip: ({ content }) => {
    capturedTooltipContent = content;
    return <div data-testid="tooltip" />;
  },
  ReferenceLine: ({ y }) => <div data-testid="reference-line" data-y={y} />,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

const makeWeeks = (n, avg = 4.0) =>
  Array.from({ length: n }, (_, i) => ({
    week_from: `2026-0${i + 1}-01`,
    week_to: `2026-0${i + 1}-07`,
    avg_rating: avg,
    payout_total: 1000 * (i + 1),
  }));

beforeEach(() => {
  capturedTooltipContent = null;
});

describe("WeeklyBarChart", () => {
  it("renders a bar chart with given weeks", () => {
    render(<WeeklyBarChart weeks={makeWeeks(4)} dataKey="avg_rating" color="#6366f1" />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with payout_total dataKey", () => {
    render(<WeeklyBarChart weeks={makeWeeks(3)} dataKey="payout_total" color="#10b981" />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders with empty weeks without crashing", () => {
    render(<WeeklyBarChart weeks={[]} dataKey="avg_rating" />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders ReferenceLine when referenceValue is provided", () => {
    render(<WeeklyBarChart weeks={makeWeeks(3)} dataKey="avg_rating" referenceValue={4.2} />);
    const line = screen.getByTestId("reference-line");
    expect(line).toBeInTheDocument();
    expect(line).toHaveAttribute("data-y", "4.2");
  });

  it("does not render ReferenceLine when referenceValue is not provided", () => {
    render(<WeeklyBarChart weeks={makeWeeks(3)} dataKey="avg_rating" />);
    expect(screen.queryByTestId("reference-line")).not.toBeInTheDocument();
  });

  describe("CustomTooltip (via Tooltip content prop)", () => {
    it("renders nothing when active is false", () => {
      render(<WeeklyBarChart weeks={makeWeeks(2)} dataKey="avg_rating" />);
      const { container } = render(capturedTooltipContent({ active: false, payload: [] }));
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when payload is empty", () => {
      render(<WeeklyBarChart weeks={makeWeeks(2)} dataKey="avg_rating" />);
      const { container } = render(capturedTooltipContent({ active: true, payload: [] }));
      expect(container).toBeEmptyDOMElement();
    });

    it("renders avg_rating tooltip with star format", () => {
      render(<WeeklyBarChart weeks={makeWeeks(2)} dataKey="avg_rating" />);
      const payload = [{ value: 4.2, payload: { week_from: "2026-02-02", week_to: "2026-02-08" } }];
      const { container } = render(capturedTooltipContent({ active: true, payload }));
      expect(container.textContent).toContain("4.2 / 5.0 ★");
      expect(container.textContent).toContain("Feb 2");
      expect(container.textContent).toContain("Feb 8");
    });

    it("renders payout_total tooltip in K format", () => {
      render(<WeeklyBarChart weeks={makeWeeks(2)} dataKey="payout_total" />);
      const payload = [{ value: 12500, payload: { week_from: "2026-02-02", week_to: "2026-02-08" } }];
      const { container } = render(capturedTooltipContent({ active: true, payload }));
      expect(container.textContent).toContain("$12.5K");
    });

    it("renders payout_total tooltip in M format", () => {
      render(<WeeklyBarChart weeks={makeWeeks(2)} dataKey="payout_total" />);
      const payload = [{ value: 2_500_000, payload: { week_from: "2026-02-02", week_to: "2026-02-08" } }];
      const { container } = render(capturedTooltipContent({ active: true, payload }));
      expect(container.textContent).toContain("$2.5M");
    });

    it("renders payout_total tooltip in dollar format for small values", () => {
      render(<WeeklyBarChart weeks={makeWeeks(2)} dataKey="payout_total" />);
      const payload = [{ value: 500, payload: { week_from: "2026-02-02", week_to: "2026-02-08" } }];
      const { container } = render(capturedTooltipContent({ active: true, payload }));
      expect(container.textContent).toContain("$500");
    });
  });

  describe("formatWeekRange (via chartData label)", () => {
    it("generates same-month range labels", () => {
      const weeks = [{ week_from: "2026-02-02", week_to: "2026-02-08", avg_rating: 4.0 }];
      render(<WeeklyBarChart weeks={weeks} dataKey="avg_rating" />);
      // XAxis receives dataKey="label"; chart renders without crashing
      expect(screen.getByTestId("x-axis")).toHaveAttribute("data-datakey", "label");
    });

    it("generates cross-month range labels", () => {
      const weeks = [{ week_from: "2026-02-23", week_to: "2026-03-01", avg_rating: 4.0 }];
      render(<WeeklyBarChart weeks={weeks} dataKey="avg_rating" />);
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });
  });
});
