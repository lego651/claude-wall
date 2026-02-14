/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import MetricsCards from "@/components/common/MetricsCards";

describe("MetricsCards", () => {
  it("renders three metric labels", () => {
    render(<MetricsCards totalVerified={1000} last30Days={200} avgPayout={500} />);
    expect(screen.getByText("Total Verified")).toBeInTheDocument();
    expect(screen.getByText("Last 30 Days")).toBeInTheDocument();
    expect(screen.getByText("Avg. Payout")).toBeInTheDocument();
  });

  it("displays formatted values", () => {
    render(<MetricsCards totalVerified={1000} last30Days={200} avgPayout={500} />);
    expect(screen.getByText("$1,000")).toBeInTheDocument();
    expect(screen.getByText("$200")).toBeInTheDocument();
    expect(screen.getByText("$500")).toBeInTheDocument();
  });

  it("shows loading state when loading is true", () => {
    render(<MetricsCards loading totalVerified={0} last30Days={0} avgPayout={0} />);
    const loadings = screen.getAllByText("Loading...");
    expect(loadings.length).toBe(3);
  });
});
