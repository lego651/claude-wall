/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import AccountSettingsModal from "@/components/user/dashboard/AccountSettingsModal";

jest.mock("@headlessui/react", () => {
  const Transition = ({ children, show }) => (show ? children : null);
  Transition.Child = ({ children }) => children;
  const Dialog = ({ children }) => <div>{children}</div>;
  Dialog.Panel = ({ children }) => <div>{children}</div>;
  Dialog.Title = ({ children }) => <h2>{children}</h2>;
  return { Dialog, Transition, Fragment: require("react").Fragment };
});

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: {
            user: {
              id: "u1",
              email: "u@test.com",
              user_metadata: { name: "User" },
            },
          },
        }),
    },
    from: () => ({
      select: () =>
        ({
          eq: () =>
            ({
              single: () =>
                Promise.resolve({
                  data: {
                    display_name: "User",
                    bio: "",
                    handle: "user",
                    wallet_address: "",
                    twitter: "",
                    youtube: "",
                  },
                }),
            }),
        }),
  }),
}));

describe("AccountSettingsModal", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("renders nothing when closed", () => {
    render(<AccountSettingsModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText("Account Settings")).not.toBeInTheDocument();
  });

  it("renders form fields when open", async () => {
    render(<AccountSettingsModal isOpen onClose={() => {}} />);
    await screen.findByRole("heading", { name: "Account Settings" });
    expect(screen.getByPlaceholderText("Enter your display name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("username")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Discard Changes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Update Profile/i })).toBeInTheDocument();
  });

  it("calls onClose when Discard is clicked", async () => {
    const onClose = jest.fn();
    render(<AccountSettingsModal isOpen onClose={onClose} />);
    await screen.findByRole("button", { name: /Discard Changes/i });
    fireEvent.click(screen.getByRole("button", { name: /Discard Changes/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
