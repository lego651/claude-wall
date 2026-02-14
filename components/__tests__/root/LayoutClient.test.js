/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import LayoutClient from "@/components/root/LayoutClient";

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
    },
  }),
}));
jest.mock("crisp-sdk-web", () => ({
  Crisp: {
    configure: jest.fn(),
    chat: { hide: jest.fn(), onChatClosed: jest.fn(), show: jest.fn(), open: jest.fn() },
    session: { setData: jest.fn() },
  },
}));
jest.mock("nextjs-toploader", () => {
  const Mock = () => null;
  Mock.displayName = "NextTopLoader";
  return { __esModule: true, default: Mock };
});
jest.mock("react-hot-toast", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));
jest.mock("react-tooltip", () => ({
  Tooltip: () => <div data-testid="tooltip" />,
}));
jest.mock("@/config", () => ({
  __esModule: true,
  default: { colors: { main: "#6366f1" }, crisp: {} },
}));

describe("LayoutClient", () => {
  it("renders children", () => {
    render(
      <LayoutClient>
        <span>Page content</span>
      </LayoutClient>
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("renders Toaster and tooltip container", () => {
    render(<LayoutClient><div /></LayoutClient>);
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
  });
});
