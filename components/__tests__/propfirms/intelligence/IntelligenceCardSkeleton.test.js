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

  it("renders three source placeholders", () => {
    const { container } = render(<IntelligenceCardSkeleton />);
    const placeholders = container.querySelectorAll(".grid .rounded-lg");
    expect(placeholders.length).toBe(3);
  });
});
