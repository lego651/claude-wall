/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import IntelligenceCardSkeleton from "@/components/propfirms/intelligence/IntelligenceCardSkeleton";

describe("IntelligenceCardSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<IntelligenceCardSkeleton />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders three reference placeholders", () => {
    const { container } = render(<IntelligenceCardSkeleton />);
    const refPills = container.querySelector('[data-testid="skeleton-ref-pills"]');
    expect(refPills).toBeInTheDocument();
    expect(refPills.children.length).toBe(3);
  });
});
