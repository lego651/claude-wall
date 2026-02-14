/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import FirmWeeklyReportCard from "@/components/propfirms/payouts/FirmWeeklyReportCard";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("FirmWeeklyReportCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("renders title and feature list", async () => {
    global.fetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
    });
    render(<FirmWeeklyReportCard firmId="firm-1" />);
    await screen.findByText("Get Weekly Intelligence Reports");
    expect(screen.getByText(/One weekly digest email/)).toBeInTheDocument();
    expect(screen.getByText("Blockchain-verified payout summary")).toBeInTheDocument();
    expect(screen.getByText("Trustpilot sentiment analysis")).toBeInTheDocument();
  });

  it("shows Sign In to Follow when not authenticated", async () => {
    global.fetch.mockResolvedValueOnce({ status: 401 });
    render(<FirmWeeklyReportCard firmId="firm-1" />);
    await screen.findByRole("button", { name: /Sign In to Follow/i });
    fireEvent.click(screen.getByRole("button", { name: /Sign In to Follow/i }));
    expect(mockPush).toHaveBeenCalledWith("/signin");
  });

  it("shows next digest label", async () => {
    global.fetch.mockResolvedValueOnce({ status: 401 });
    render(<FirmWeeklyReportCard firmId="firm-1" />);
    await screen.findByText(/Next digest:/);
    expect(screen.getByText(/Next digest:/)).toBeInTheDocument();
  });
});
