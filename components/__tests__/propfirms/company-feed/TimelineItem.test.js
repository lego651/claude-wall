/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import TimelineItem from "@/components/propfirms/company-feed/TimelineItem";

const BASE_ITEM = {
  id: 1,
  content_type: "company_news",
  title: "Instant Payouts Launched",
  ai_summary: "The firm launched instant payout processing today.",
  source_type: "firm_email",
  content_date: "2026-03-10",
};

describe("TimelineItem", () => {
  it("renders title and summary", () => {
    render(<TimelineItem item={BASE_ITEM} />);
    expect(screen.getByText("Instant Payouts Launched")).toBeInTheDocument();
    expect(screen.getByText("The firm launched instant payout processing today.")).toBeInTheDocument();
  });

  it("renders formatted date", () => {
    render(<TimelineItem item={BASE_ITEM} />);
    expect(screen.getByText("Mar 10, 2026")).toBeInTheDocument();
  });

  it("shows correct badge for company_news", () => {
    render(<TimelineItem item={BASE_ITEM} />);
    expect(screen.getByText("Company News")).toBeInTheDocument();
  });

  it("shows correct badge for rule_change", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, content_type: "rule_change" }} />);
    expect(screen.getByText("Rule Change")).toBeInTheDocument();
  });

  it("shows correct badge for promotion", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, content_type: "promotion" }} />);
    expect(screen.getByText("Promo")).toBeInTheDocument();
  });

  it("shows 'Update' badge for other content_type", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, content_type: "other" }} />);
    expect(screen.getByText("Update")).toBeInTheDocument();
  });

  it("shows 'Update' badge for unknown content_type", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, content_type: "unknown_type" }} />);
    expect(screen.getByText("Update")).toBeInTheDocument();
  });

  it("shows Email source label for firm_email", () => {
    render(<TimelineItem item={BASE_ITEM} />);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("shows correct source label for discord", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, source_type: "discord" }} />);
    expect(screen.getByText("Discord")).toBeInTheDocument();
  });

  it("shows correct source label for manual_upload", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, source_type: "manual_upload" }} />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("omits summary when ai_summary is empty", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, ai_summary: "" }} />);
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("handles missing content_date gracefully", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, content_date: null }} />);
    expect(screen.getByText("Instant Payouts Launched")).toBeInTheDocument();
  });

  it("shows raw source_type when not in the label map", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, source_type: "custom_source" }} />);
    expect(screen.getByText("custom_source")).toBeInTheDocument();
  });

  it("shows 'Other' when source_type is null", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, source_type: null }} />);
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("shows raw string when content_date is invalid", () => {
    render(<TimelineItem item={{ ...BASE_ITEM, content_date: "not-a-date" }} />);
    expect(screen.getByText("Instant Payouts Launched")).toBeInTheDocument();
  });
});
