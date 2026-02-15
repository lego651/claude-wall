/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import SubscriptionsSection from "@/components/user/settings/SubscriptionsSection";

describe("SubscriptionsSection", () => {
  const mockFirms = {
    data: [
      { id: "f1", name: "Firm One", logo: null, website: null },
      { id: "f2", name: "Firm Two", logo: null, website: null },
    ],
  };
  const mockSubscriptions = {
    subscriptions: [{ id: "sub1", firm_id: "f1", firm: { name: "Firm One" } }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("shows loading spinner initially", () => {
    global.fetch.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<SubscriptionsSection />);
    expect(container.querySelector(".loading.loading-spinner")).toBeInTheDocument();
  });

  it("shows Firm Newsletters and firms list after load", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFirms) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSubscriptions) });
    render(<SubscriptionsSection />);
    await screen.findByText("Firm Newsletters");
    await screen.findByText("Firm One");
    await screen.findByText("Firm Two");
    expect(screen.getByText(/1 Subscribed/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search firms...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "subscribed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "unsubscribed" })).toBeInTheDocument();
  });

  it("shows empty state when no firms from propfirms API", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ subscriptions: [] }) });
    render(<SubscriptionsSection />);
    await screen.findByText("Firm Newsletters");
    await screen.findByText("No firms found");
    expect(screen.getByText(/Try adjusting your search or filters/)).toBeInTheDocument();
  });

  it("filters firms by search", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFirms) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSubscriptions) });
    render(<SubscriptionsSection />);
    await screen.findByText("Firm One");
    const search = screen.getByPlaceholderText("Search firms...");
    fireEvent.change(search, { target: { value: "Two" } });
    expect(screen.getByText("Firm Two")).toBeInTheDocument();
    expect(screen.queryByText("Firm One")).not.toBeInTheDocument();
  });

  it("filters by subscribed tab", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFirms) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSubscriptions) });
    render(<SubscriptionsSection />);
    await screen.findByText("Firm One");
    fireEvent.click(screen.getByRole("button", { name: "subscribed" }));
    expect(screen.getByText("Firm One")).toBeInTheDocument();
    expect(screen.queryByText("Firm Two")).not.toBeInTheDocument();
  });

  it("calls DELETE when unsubscribing", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFirms) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSubscriptions) })
      .mockResolvedValueOnce({ ok: true });
    render(<SubscriptionsSection />);
    await screen.findByText("Firm One");
    const unsubscribeBtn = screen.getByRole("button", { name: "Unsubscribe" });
    fireEvent.click(unsubscribeBtn);
    await screen.findByText("Firm One"); // still in DOM while we wait
    expect(global.fetch).toHaveBeenCalledWith("/api/subscriptions/f1", { method: "DELETE" });
  });

  it("calls POST when subscribing", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFirms) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ subscriptions: [] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ subscription: { firm_id: "f2" } }) });
    render(<SubscriptionsSection />);
    await screen.findByText("Firm Two");
    const subscribeBtns = screen.getAllByRole("button", { name: "Subscribe" });
    fireEvent.click(subscribeBtns[1]);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/subscriptions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firm_id: "f2" }),
      })
    );
  });

  it("shows footer with count", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockFirms) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSubscriptions) });
    render(<SubscriptionsSection />);
    await screen.findByText("Firm Newsletters");
    expect(screen.getByText(/Showing 2 of 2 available prop firms/)).toBeInTheDocument();
  });

  it("handles propfirms API error", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ subscriptions: [] }) });
    render(<SubscriptionsSection />);
    await screen.findByText("Firm Newsletters");
    await screen.findByText("No firms found");
    spy.mockRestore();
  });
});
