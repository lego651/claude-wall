/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
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

import * as logoUtils from "@/lib/logoUtils";

describe("PropFirmSidebar", () => {
  it("renders display name from firm", () => {
    render(
      <PropFirmSidebar
        firmId="fundingpips"
        firm={{ name: "FundingPips", website: "https://fundingpips.com" }}
      />
    );
    expect(screen.getByRole("heading", { name: "FundingPips", level: 1 })).toBeInTheDocument();
  });

  it("renders display name from firmId when firm has no name", () => {
    render(<PropFirmSidebar firmId="funding-pips" firm={null} />);
    expect(screen.getByRole("heading", { name: "Funding Pips", level: 1 })).toBeInTheDocument();
  });

  it("renders website link with host only", () => {
    render(
      <PropFirmSidebar
        firmId="fundingpips"
        firm={{ name: "F", website: "https://fundingpips.com/" }}
      />
    );
    const link = screen.getByRole("link", { name: /fundingpips\.com/i });
    expect(link).toHaveAttribute("href", "https://fundingpips.com/");
  });

  it("renders Intelligence Status heading and Stable badge", () => {
    render(<PropFirmSidebar firmId="fundingpips" firm={{ name: "F" }} />);
    expect(screen.getByText("Intelligence Status")).toBeInTheDocument();
    expect(screen.getByText("Stable")).toBeInTheDocument();
  });

  it("renders View full analytics link to intelligence page", () => {
    render(<PropFirmSidebar firmId="fundingpips" firm={{ name: "F" }} />);
    const link = screen.getByRole("link", { name: /View full analytics/i });
    expect(link).toHaveAttribute("href", "/propfirms/fundingpips/intelligence");
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
    const siteLink = screen.getByRole("link", { name: /the5ers\.com/i });
    expect(siteLink).toHaveAttribute("href", "https://the5ers.com");
  });

  it("shows initials when firm has no logo url", () => {
    logoUtils.getFirmLogoUrl.mockReturnValue("");
    render(
      <PropFirmSidebar
        firmId="fundingpips"
        firm={{ name: "FundingPips", website: "https://fundingpips.com" }}
      />
    );
    expect(screen.getByText("FU")).toBeInTheDocument();
  });

});
