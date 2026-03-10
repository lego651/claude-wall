/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CompanyFeedTab from "@/components/propfirms/company-feed/CompanyFeedTab";

const SAMPLE_ITEMS = [
  {
    id: 1,
    content_type: "company_news",
    title: "New Feature Released",
    ai_summary: "The firm released a new trading feature.",
    source_type: "firm_email",
    content_date: "2026-03-10",
  },
  {
    id: 2,
    content_type: "rule_change",
    title: "Drawdown Rules Updated",
    ai_summary: "Max drawdown reduced from 10% to 8%.",
    source_type: "firm_email",
    content_date: "2026-03-09",
  },
  {
    id: 3,
    content_type: "promotion",
    title: "20% Off This Week",
    ai_summary: "Use code SPRING20 for 20% off.",
    source_type: "firm_email",
    content_date: "2026-03-08",
  },
];

function mockFetch(data, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  });
}

describe("CompanyFeedTab", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows loading skeleton initially", () => {
    mockFetch({ items: SAMPLE_ITEMS });
    render(<CompanyFeedTab firmId="fundingpips" />);
    expect(screen.getByLabelText("Loading company feed")).toBeInTheDocument();
  });

  it("renders section heading", async () => {
    mockFetch({ items: SAMPLE_ITEMS });
    render(<CompanyFeedTab firmId="fundingpips" />);
    await waitFor(() => expect(screen.getByText("Company Feed")).toBeInTheDocument());
  });

  it("shows Updates tab by default with non-promotion items", async () => {
    mockFetch({ items: SAMPLE_ITEMS });
    render(<CompanyFeedTab firmId="fundingpips" />);

    await waitFor(() => {
      expect(screen.getByText("New Feature Released")).toBeInTheDocument();
      expect(screen.getByText("Drawdown Rules Updated")).toBeInTheDocument();
      // Promotion should not appear in Updates tab
      expect(screen.queryByText("20% Off This Week")).not.toBeInTheDocument();
    });
  });

  it("shows only promotions when Promotions tab is clicked", async () => {
    mockFetch({ items: SAMPLE_ITEMS });
    render(<CompanyFeedTab firmId="fundingpips" />);

    await waitFor(() => screen.getByText("New Feature Released"));

    fireEvent.click(screen.getByRole("button", { name: "Promotions" }));

    expect(screen.getByText("20% Off This Week")).toBeInTheDocument();
    expect(screen.queryByText("New Feature Released")).not.toBeInTheDocument();
    expect(screen.queryByText("Drawdown Rules Updated")).not.toBeInTheDocument();
  });

  it("shows empty state when no updates", async () => {
    mockFetch({ items: [{ id: 1, content_type: "promotion", title: "Promo" }] });
    render(<CompanyFeedTab firmId="fundingpips" />);

    await waitFor(() =>
      expect(screen.getByText("No updates from this firm yet.")).toBeInTheDocument()
    );
  });

  it("shows empty state when no promotions", async () => {
    mockFetch({ items: [{ id: 1, content_type: "company_news", title: "News", ai_summary: "s", source_type: "firm_email", content_date: "2026-03-10" }] });
    render(<CompanyFeedTab firmId="fundingpips" />);

    await waitFor(() => screen.getByText("News"));
    fireEvent.click(screen.getByRole("button", { name: "Promotions" }));

    expect(screen.getByText("No promotions from this firm yet.")).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    render(<CompanyFeedTab firmId="fundingpips" />);

    await waitFor(() =>
      expect(screen.getByText("Unable to load company feed.")).toBeInTheDocument()
    );
  });

  it("shows error state when fetch throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    render(<CompanyFeedTab firmId="fundingpips" />);

    await waitFor(() =>
      expect(screen.getByText("Unable to load company feed.")).toBeInTheDocument()
    );
  });

  it("handles empty items array", async () => {
    mockFetch({ items: [] });
    render(<CompanyFeedTab firmId="fundingpips" />);

    await waitFor(() =>
      expect(screen.getByText("No updates from this firm yet.")).toBeInTheDocument()
    );
  });

  it("does not fetch when firmId is not provided", () => {
    global.fetch = jest.fn();
    render(<CompanyFeedTab firmId="" />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders tab buttons for Updates and Promotions", async () => {
    mockFetch({ items: [] });
    render(<CompanyFeedTab firmId="fundingpips" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Updates" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Promotions" })).toBeInTheDocument();
    });
  });
});
