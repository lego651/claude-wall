/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import MonthlyPayoutChart from "@/components/common/MonthlyPayoutChart";

jest.mock("recharts", () => ({
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive">{children}</div>,
  Cell: () => null,
}));

describe("MonthlyPayoutChart", () => {
  it("renders title and period buttons", () => {
    render(<MonthlyPayoutChart />);
    expect(screen.getByText("Monthly Payout History")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "6M" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1Y" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ALL" })).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<MonthlyPayoutChart loading />);
    expect(screen.getByText("Loading chart data...")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(<MonthlyPayoutChart transactions={[]} />);
    expect(screen.getByText("No chart data available")).toBeInTheDocument();
  });

  it("shows Connect Wallet CTA when hasNoWallet and onConnectWallet provided", () => {
    const onConnect = jest.fn();
    render(
      <MonthlyPayoutChart
        transactions={[]}
        hasNoWallet
        onConnectWallet={onConnect}
      />
    );
    expect(screen.getByText("Connect your wallet to see payout history")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/i }));
    expect(onConnect).toHaveBeenCalled();
  });

  it("switches period when buttons are clicked", () => {
    const transactions = [
      { timestamp: Math.floor(Date.now() / 1000), amountUSD: 1000 },
    ];
    render(<MonthlyPayoutChart transactions={transactions} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1Y" }));
    fireEvent.click(screen.getByRole("button", { name: "ALL" }));
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });
});
