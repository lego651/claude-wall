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
});
