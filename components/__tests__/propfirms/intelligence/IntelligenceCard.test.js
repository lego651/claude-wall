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

  it("renders POSITIVE category with green badge", () => {
    const item = { ...defaultItem, category: "POSITIVE", confidence: "LOW" };
    const { container } = render(<IntelligenceCard item={item} />);
    expect(screen.getByText("Positive")).toBeInTheDocument();
    const dot = container.querySelector(".bg-emerald-500");
    expect(dot).toBeInTheDocument();
  });

  it("renders INFORMATIONAL category with grey dot", () => {
    const item = { ...defaultItem, category: "INFORMATIONAL", confidence: "LOW" };
    const { container } = render(<IntelligenceCard item={item} />);
    expect(screen.getByText("Informational")).toBeInTheDocument();
    const dot = container.querySelector(".bg-slate-400");
    expect(dot).toBeInTheDocument();
  });

  it("renders REPUTATION with amber dot when confidence is not HIGH", () => {
    const item = { ...defaultItem, category: "REPUTATION", confidence: "LOW" };
    const { container } = render(<IntelligenceCard item={item} />);
    const dot = container.querySelector(".bg-amber-400");
    expect(dot).toBeInTheDocument();
  });

  it("renders REPUTATION with red dot when confidence is HIGH", () => {
    const item = { ...defaultItem, category: "REPUTATION", confidence: "HIGH" };
    const { container } = render(<IntelligenceCard item={item} />);
    const dot = container.querySelector(".bg-red-500");
    expect(dot).toBeInTheDocument();
  });

  it("renders unknown category with fallback label and amber dot", () => {
    const item = { ...defaultItem, category: "CUSTOM_TYPE", confidence: "MEDIUM" };
    render(<IntelligenceCard item={item} />);
    expect(screen.getByText("CUSTOM_TYPE")).toBeInTheDocument();
  });
});
