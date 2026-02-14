/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import PropProofLayout from "@/components/common/PropProofLayout";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/propfirms",
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("next/link", () => {
  const Mock = ({ children, href }) => <a href={href}>{children}</a>;
  Mock.displayName = "NextLink";
  return { __esModule: true, default: Mock };
});
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
    }),
  }),
}));
jest.mock("@/config", () => ({
  __esModule: true,
  default: { auth: { loginUrl: "/signin" } },
}));

describe("PropProofLayout", () => {
  it("renders PropPulse brand and nav links", () => {
    render(
      <PropProofLayout>
        <div>Page content</div>
      </PropProofLayout>
    );
    expect(screen.getByText("PropPulse")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Payouts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Traders" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trading Study" })).toBeInTheDocument();
  });

  it("renders children in main", async () => {
    render(
      <PropProofLayout>
        <p>Page content</p>
      </PropProofLayout>
    );
    await screen.findByText("Page content");
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("shows Sign In when user is not loaded then null", async () => {
    render(<PropProofLayout><div /></PropProofLayout>);
    await screen.findByText("Sign In");
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/signin");
  });

  it("renders footer disclaimer", async () => {
    render(<PropProofLayout><div /></PropProofLayout>);
    await screen.findByText(/Technical Disclaimer/);
    expect(screen.getByText(/Data Integrity/)).toBeInTheDocument();
  });
});
