/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import AdminLayout from "@/components/common/AdminLayout";

jest.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
}));
jest.mock("next/link", () => {
  const Mock = ({ children, href }) => <a href={href}>{children}</a>;
  Mock.displayName = "NextLink";
  return { __esModule: true, default: Mock };
});

describe("AdminLayout", () => {
  it("renders navigation with Trading Admin and nav items", () => {
    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>
    );
    expect(screen.getByText("Trading Admin")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
    expect(screen.getByText("Strategies")).toBeInTheDocument();
    expect(screen.getByText("Prop Firms")).toBeInTheDocument();
  });

  it("renders children in main", () => {
    render(
      <AdminLayout>
        <p>Admin content</p>
      </AdminLayout>
    );
    expect(screen.getByText("Admin content")).toBeInTheDocument();
  });

  it("renders footer with Data Privacy and copyright", () => {
    render(<AdminLayout><div /></AdminLayout>);
    expect(screen.getByText(/Data Privacy/)).toBeInTheDocument();
    expect(screen.getByText(/Trading Admin\. All rights reserved/)).toBeInTheDocument();
  });
});
