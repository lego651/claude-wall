/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import IntelligenceCard from "@/components/propfirms/intelligence/IntelligenceCard";

const defaultItem = {
  id: "1",
  category: "REPUTATION",
  date: "Jan 15, 2025",
  title: "Test intelligence title",
  summary: "Test summary text",
  confidence: "HIGH",
  tags: ["tag1", "tag2"],
  sources: [
    { id: "s1", url: "https://example.com/1", label: "Source 1", domain: "example.com", date: "2025-01-10" },
  ],
};

describe("IntelligenceCard", () => {
  it("renders category badge, title and date", () => {
    render(<IntelligenceCard item={defaultItem} />);
    expect(screen.getByText("Reputation")).toBeInTheDocument();
    expect(screen.getByText("Jan 15, 2025")).toBeInTheDocument();
    expect(screen.getByText("Test intelligence title")).toBeInTheDocument();
    expect(screen.getByText("Test summary text")).toBeInTheDocument();
  });

  it("renders References with source link", () => {
    render(<IntelligenceCard item={defaultItem} />);
    expect(screen.getByText("References:")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Source 1/i });
    expect(link).toHaveAttribute("href", "https://example.com/1");
  });

  it("renders Operational category with blue styling", () => {
    const item = { ...defaultItem, category: "OPERATIONAL" };
    render(<IntelligenceCard item={item} />);
    expect(screen.getByText("Operational")).toBeInTheDocument();
  });

  it("renders without References when no sources", () => {
    const item = { ...defaultItem, sources: undefined };
    render(<IntelligenceCard item={item} />);
    expect(screen.getByText("Test intelligence title")).toBeInTheDocument();
    expect(screen.queryByText("References:")).not.toBeInTheDocument();
  });
});
