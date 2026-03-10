/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import IntelligenceCard from "@/components/propfirms/intelligence/IntelligenceCard";

const defaultItem = {
  id: "1",
  category: "RISK",
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
    expect(screen.getByText("Risk Alert")).toBeInTheDocument();
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

  it("renders RISK category with red dot", () => {
    const { container } = render(<IntelligenceCard item={defaultItem} />);
    expect(screen.getByText("Risk Alert")).toBeInTheDocument();
    const dot = container.querySelector(".bg-red-500");
    expect(dot).toBeInTheDocument();
  });

  it("renders without References when no sources", () => {
    const item = { ...defaultItem, sources: undefined };
    render(<IntelligenceCard item={item} />);
    expect(screen.getByText("Test intelligence title")).toBeInTheDocument();
    expect(screen.queryByText("References:")).not.toBeInTheDocument();
  });

  it("renders POSITIVE category with green badge and dot", () => {
    const item = { ...defaultItem, category: "POSITIVE", confidence: "LOW" };
    const { container } = render(<IntelligenceCard item={item} />);
    expect(screen.getByText("Positive")).toBeInTheDocument();
    const dot = container.querySelector(".bg-emerald-500");
    expect(dot).toBeInTheDocument();
  });

  it("renders WATCH category with amber dot", () => {
    const item = { ...defaultItem, category: "WATCH", confidence: "LOW" };
    const { container } = render(<IntelligenceCard item={item} />);
    expect(screen.getByText("Watch")).toBeInTheDocument();
    const dot = container.querySelector(".bg-amber-400");
    expect(dot).toBeInTheDocument();
  });

  it("renders unknown category with fallback label and grey dot", () => {
    const item = { ...defaultItem, category: "CUSTOM_TYPE", confidence: "MEDIUM" };
    render(<IntelligenceCard item={item} />);
    expect(screen.getByText("CUSTOM_TYPE")).toBeInTheDocument();
  });

  it("renders star rating colored by score and short date in pill", () => {
    const item = {
      ...defaultItem,
      sources: [
        { id: "s1", url: "https://trustpilot.com/1", label: "Trustpilot Review", domain: "trustpilot.com", date: "2025-02-27", rating: 1 },
        { id: "s2", url: "https://trustpilot.com/2", label: "Trustpilot Review #2", domain: "trustpilot.com", date: "2025-02-20", rating: 5 },
      ],
    };
    const { container } = render(<IntelligenceCard item={item} />);
    expect(screen.getByText("★1")).toBeInTheDocument();
    expect(screen.getByText("★1").className).toContain("text-red-400");
    expect(screen.getByText("★5")).toBeInTheDocument();
    expect(screen.getByText("★5").className).toContain("text-emerald-500");
    expect(screen.getByText("· 02-27")).toBeInTheDocument();
  });

  it("renders pill without rating/date when both are null", () => {
    const item = {
      ...defaultItem,
      sources: [
        { id: "s1", url: "https://example.com/1", label: "Source 1", domain: "example.com", date: null, rating: null },
      ],
    };
    render(<IntelligenceCard item={item} />);
    expect(screen.getByText("Source 1")).toBeInTheDocument();
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });
});
