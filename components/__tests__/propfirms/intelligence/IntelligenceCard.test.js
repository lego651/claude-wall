/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import IntelligenceCard from "@/components/propfirms/intelligence/IntelligenceCard";

const defaultItem = {
  category: "REPUTATION",
  date: "2025-01-15",
  confidence: "HIGH",
  title: "Test intelligence title",
  summary: "Test summary text",
  tags: ["tag1", "tag2"],
  sources: [
    { id: "s1", url: "https://example.com/1", label: "Source 1", domain: "example.com", date: "2025-01-10" },
  ],
};

describe("IntelligenceCard", () => {
  it("renders category, date, title and summary", () => {
    render(<IntelligenceCard item={defaultItem} isLast={false} />);
    expect(screen.getByText("REPUTATION · 2025-01-15")).toBeInTheDocument();
    expect(screen.getByText("CONFIDENCE: HIGH")).toBeInTheDocument();
    expect(screen.getByText("Test intelligence title")).toBeInTheDocument();
    expect(screen.getByText("Test summary text")).toBeInTheDocument();
  });

  it("renders tags", () => {
    render(<IntelligenceCard item={defaultItem} isLast={false} />);
    expect(screen.getByText("tag1")).toBeInTheDocument();
    expect(screen.getByText("tag2")).toBeInTheDocument();
  });

  it("renders supporting evidence with source link", () => {
    render(<IntelligenceCard item={defaultItem} isLast={false} />);
    expect(screen.getByText("Supporting evidence")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Source 1/i });
    expect(link).toHaveAttribute("href", "https://example.com/1");
  });

  it("renders MEDIUM confidence badge", () => {
    const item = { ...defaultItem, confidence: "MEDIUM" };
    render(<IntelligenceCard item={item} isLast={false} />);
    expect(screen.getByText("CONFIDENCE: MEDIUM")).toBeInTheDocument();
  });

  it("renders without tags and sources", () => {
    const item = { ...defaultItem, tags: undefined, sources: undefined };
    render(<IntelligenceCard item={item} isLast={false} />);
    expect(screen.getByText("Test intelligence title")).toBeInTheDocument();
    expect(screen.queryByText("Supporting evidence")).not.toBeInTheDocument();
  });
});
