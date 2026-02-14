/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import ConnectWalletModal from "@/components/user/dashboard/ConnectWalletModal";

jest.mock("@headlessui/react", () => {
  const Transition = ({ children, show }) => (show ? children : null);
  Transition.Child = ({ children }) => children;
  const Dialog = ({ children }) => <div data-testid="dialog">{children}</div>;
  Dialog.Panel = ({ children }) => <div>{children}</div>;
  Dialog.Title = ({ children }) => <h2>{children}</h2>;
  return { Dialog, Transition, Fragment: require("react").Fragment };
});

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () =>
        ({
          eq: () =>
            ({
              single: () =>
                Promise.resolve({
                  data: {
                    display_name: null,
                    bio: null,
                    handle: null,
                    twitter: null,
                    instagram: null,
                    youtube: null,
                    wallet_address: "",
                  },
                }),
            }),
        }),
  }),
}));

describe("ConnectWalletModal", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("renders nothing when closed", () => {
    render(<ConnectWalletModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
  });

  it("renders title and wallet input when open", async () => {
    render(<ConnectWalletModal isOpen onClose={() => {}} />);
    await screen.findByRole("heading", { name: "Connect Wallet" });
    expect(screen.getByPlaceholderText("0x...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect Wallet/i })).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = jest.fn();
    render(<ConnectWalletModal isOpen onClose={onClose} />);
    await screen.findByRole("button", { name: /Cancel/i });
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
