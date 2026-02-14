/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import ButtonSupport from "@/components/common/ButtonSupport";

jest.mock("crisp-sdk-web", () => ({
  Crisp: {
    chat: { show: jest.fn(), open: jest.fn() },
  },
}));
jest.mock("@/config", () => ({
  __esModule: true,
  default: {
    crisp: { id: "test-crisp-id" },
    resend: { supportEmail: "support@example.com" },
    appName: "TestApp",
  },
}));

describe("ButtonSupport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.open;
    window.open = jest.fn();
  });

  it("renders Support button", () => {
    render(<ButtonSupport />);
    expect(screen.getByRole("button", { name: /support/i })).toBeInTheDocument();
  });

  it("opens Crisp chat when Crisp is configured and button is clicked", () => {
    const { Crisp } = require("crisp-sdk-web");
    render(<ButtonSupport />);
    fireEvent.click(screen.getByRole("button", { name: /support/i }));
    expect(Crisp.chat.show).toHaveBeenCalled();
    expect(Crisp.chat.open).toHaveBeenCalled();
  });

});
