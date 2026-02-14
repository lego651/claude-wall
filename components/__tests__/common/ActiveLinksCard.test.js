/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import ActiveLinksCard from "@/components/common/ActiveLinksCard";

jest.mock("@/config", () => ({
  __esModule: true,
  default: { resend: { supportEmail: "support@test.com" } },
}));

describe("ActiveLinksCard", () => {
  it("renders title and description", () => {
    render(<ActiveLinksCard />);
    expect(screen.getByText("Verified firm payouts")).toBeInTheDocument();
    expect(screen.getByText(/Bar = your total payout/)).toBeInTheDocument();
  });

  it("shows loading spinner when loading", () => {
    render(<ActiveLinksCard loading />);
    expect(screen.getByText("Loading firms...")).toBeInTheDocument();
  });

  it("shows empty state when no firms", () => {
    render(<ActiveLinksCard verifiedFirms={[]} />);
    expect(screen.getByText("No verified firm payouts yet")).toBeInTheDocument();
  });

  it("renders firm list with names and amounts", () => {
    const firms = [
      { id: "f1", name: "Firm One", totalPayout: 5000 },
      { id: "f2", name: "Firm Two", totalPayout: 3000 },
    ];
    render(<ActiveLinksCard verifiedFirms={firms} />);
    expect(screen.getByText("Firm One")).toBeInTheDocument();
    expect(screen.getByText("Firm Two")).toBeInTheDocument();
    expect(screen.getByText("$5,000")).toBeInTheDocument();
    expect(screen.getByText("$3,000")).toBeInTheDocument();
  });

  it("links to firm detail page", () => {
    const firms = [{ id: "f1", name: "Firm One", totalPayout: 1000 }];
    render(<ActiveLinksCard verifiedFirms={firms} />);
    const link = screen.getByRole("link", { name: /Firm One/i });
    expect(link).toHaveAttribute("href", "/propfirms/f1");
  });

  it("sets img src to default logo on error", () => {
    const firms = [{ id: "f1", name: "Firm One", totalPayout: 1000, logo: "https://example.com/bad.png" }];
    render(<ActiveLinksCard verifiedFirms={firms} />);
    const img = screen.getByRole("img", { name: "Firm One" });
    fireEvent.error(img);
    expect(img.getAttribute("src")).toBe("/icon.png");
  });
});
