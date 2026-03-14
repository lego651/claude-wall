/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import EmailIngestTab from "@/components/admin/EmailIngestTab";

function makeData(overrides = {}) {
  return {
    lastRun: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
    status: "ok",
    statusReason: "Running normally",
    stats: { processed: 20, inserted: 15, skipped: 4, errors: 0 },
    recentRuns: [
      { ranAt: new Date(Date.now() - 5 * 60000).toISOString(), inserted: 15, errors: 0 },
      { ranAt: new Date(Date.now() - 65 * 60000).toISOString(), inserted: 8, errors: 1 },
    ],
    ...overrides,
  };
}

describe("EmailIngestTab", () => {
  it("renders loading spinner when loading=true", () => {
    render(<EmailIngestTab loading={true} data={null} error={null} />);
    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
  });

  it("renders error alert when error is set", () => {
    render(<EmailIngestTab loading={false} data={null} error="Something went wrong" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders nothing when data is null and not loading or erroring", () => {
    const { container } = render(<EmailIngestTab loading={false} data={null} error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders OK status badge and last run time", () => {
    render(<EmailIngestTab loading={false} data={makeData()} error={null} />);
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getByText(/Last run:/)).toBeInTheDocument();
    expect(screen.getAllByText(/5m ago/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Warning status badge", () => {
    render(<EmailIngestTab loading={false} data={makeData({ status: "warning", statusReason: "Last run 45m ago" })} error={null} />);
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Last run 45m ago")).toBeInTheDocument();
  });

  it("renders Critical status badge", () => {
    render(<EmailIngestTab loading={false} data={makeData({ status: "critical", statusReason: "Never run" })} error={null} />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("renders stats row with correct values", () => {
    render(<EmailIngestTab loading={false} data={makeData()} error={null} />);
    expect(screen.getByText("Processed")).toBeInTheDocument();
    expect(screen.getAllByText("Inserted").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Skipped")).toBeInTheDocument();
    expect(screen.getAllByText("Errors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getAllByText("15").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("highlights errors count in red when errors > 0", () => {
    render(
      <EmailIngestTab
        loading={false}
        data={makeData({ stats: { processed: 10, inserted: 5, skipped: 2, errors: 3 } })}
        error={null}
      />
    );
    const errorsValue = screen.getByText("3");
    expect(errorsValue).toHaveClass("text-red-600");
  });

  it("does not highlight errors count when errors = 0", () => {
    render(<EmailIngestTab loading={false} data={makeData()} error={null} />);
    // errors stat box value is "0" — should NOT have text-red-600
    const errorsStatValue = screen.getAllByText("0")[0];
    expect(errorsStatValue).not.toHaveClass("text-red-600");
  });

  it("renders recent runs table", () => {
    render(<EmailIngestTab loading={false} data={makeData()} error={null} />);
    expect(screen.getByText("Recent runs")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    // "Inserted" appears in both stats headers and table header — confirm at least 2 occurrences
    expect(screen.getAllByText("Inserted").length).toBeGreaterThanOrEqual(2);
  });

  it("shows 'No runs recorded yet' when recentRuns is empty", () => {
    render(<EmailIngestTab loading={false} data={makeData({ recentRuns: [] })} error={null} />);
    expect(screen.getByText("No runs recorded yet.")).toBeInTheDocument();
  });

  it("highlights error count in table row when errors > 0", () => {
    const data = makeData({
      recentRuns: [{ ranAt: new Date(Date.now() - 5 * 60000).toISOString(), inserted: 3, errors: 2 }],
    });
    render(<EmailIngestTab loading={false} data={data} error={null} />);
    const errorCells = screen.getAllByText("2");
    expect(errorCells[0]).toHaveClass("text-red-600");
  });

  it("renders 'Never' when lastRun is null", () => {
    render(<EmailIngestTab loading={false} data={makeData({ lastRun: null })} error={null} />);
    expect(screen.getByText("Never")).toBeInTheDocument();
  });
});
