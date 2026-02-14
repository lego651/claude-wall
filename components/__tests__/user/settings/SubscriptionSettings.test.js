/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import SubscriptionSettings from "@/components/user/settings/SubscriptionSettings";

jest.mock("next/link", () => {
  const Mock = ({ children, href }) => <a href={href}>{children}</a>;
  Mock.displayName = "NextLink";
  return { __esModule: true, default: Mock };
});

describe("SubscriptionSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    global.confirm = jest.fn(() => false);
  });

  it("shows loading then empty state when no subscriptions", async () => {
    global.fetch.mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({ subscriptions: [] }) });
    render(<SubscriptionSettings />);
    await screen.findByText("Weekly Digest");
    await screen.findByText(/not following any firms yet/, { timeout: 3000 });
    expect(screen.getByRole("link", { name: "Browse firms" })).toHaveAttribute("href", "/propfirms");
  });

  it("shows empty state when fetch returns 401", async () => {
    global.fetch.mockResolvedValue({ status: 401, ok: false });
    render(<SubscriptionSettings />);
    await screen.findByText("Weekly Digest");
    await screen.findByText(/not following any firms yet/, { timeout: 3000 });
  });

  it("handles fetch error and shows empty state", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch.mockRejectedValue(new Error("Network error"));
    render(<SubscriptionSettings />);
    await screen.findByText("Weekly Digest");
    await screen.findByText(/not following any firms yet/, { timeout: 3000 });
    spy.mockRestore();
  });

  it("shows list of followed firms when subscriptions exist", async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          subscriptions: [
            {
              id: "sub1",
              firm_id: "firm-1",
              subscribed_at: "2025-01-01T00:00:00Z",
              firm: { name: "Firm One" },
            },
          ],
        }),
    });
    render(<SubscriptionSettings />);
    await screen.findByText("Firm One");
    expect(screen.getByText("Firm One")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument();
  });

  it("removes firm from list when Unfollow is clicked", async () => {
    global.fetch
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            subscriptions: [
              { id: "sub1", firm_id: "f1", subscribed_at: "2025-01-01", firm: { name: "F1" } },
            ],
          }),
      })
      .mockResolvedValueOnce({ status: 200, ok: true });
    render(<SubscriptionSettings />);
    await screen.findByText("F1");
    const unfollowBtn = screen.getByRole("button", { name: "Unfollow" });
    fireEvent.click(unfollowBtn);
    await screen.findByText(/not following any firms yet/, { timeout: 3000 });
    expect(screen.queryByText("F1")).not.toBeInTheDocument();
  });

  it("shows Unfollow all button when there are subscriptions", async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          subscriptions: [
            { id: "sub1", firm_id: "f1", subscribed_at: "2025-01-01", firm: { name: "F1" } },
          ],
        }),
    });
    render(<SubscriptionSettings />);
    await screen.findByText("Unfollow all");
    expect(screen.getByRole("button", { name: "Unfollow all" })).toBeInTheDocument();
  });

  it("clears all subscriptions when Unfollow all is confirmed", async () => {
    global.confirm.mockReturnValue(true);
    global.fetch
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            subscriptions: [
              { id: "sub1", firm_id: "f1", subscribed_at: "2025-01-01", firm: { name: "F1" } },
            ],
          }),
      })
      .mockResolvedValue({ status: 200, ok: true });
    render(<SubscriptionSettings />);
    await screen.findByText("F1");
    fireEvent.click(screen.getByRole("button", { name: "Unfollow all" }));
    await screen.findByText(/not following any firms yet/, { timeout: 3000 });
    expect(screen.queryByText("F1")).not.toBeInTheDocument();
  });

  it("sets logo img to default on error", async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          subscriptions: [
            {
              id: "sub1",
              firm_id: "f1",
              subscribed_at: "2025-01-01",
              firm: { name: "F1", logo_url: "https://example.com/bad.png" },
            },
          ],
        }),
    });
    const { container } = render(<SubscriptionSettings />);
    await screen.findByText("F1");
    const logoImg = container.querySelector('img[src="https://example.com/bad.png"]');
    expect(logoImg).toBeTruthy();
    fireEvent.error(logoImg);
    expect(logoImg.getAttribute("src")).toBe("/icon.png");
  });
});
