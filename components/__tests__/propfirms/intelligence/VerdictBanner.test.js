/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import VerdictBanner from "@/components/propfirms/intelligence/VerdictBanner";

const highIncident = { id: 1, severity: "high", title: "Fraud Allegations" };
const medIncident = { id: 2, severity: "medium", title: "Payout Delays" };
const lowIncident = { id: 3, severity: "low", title: "Minor Issue" };
const positiveIncident = { id: 4, severity: "low", title: "Great Support" };

describe("VerdictBanner", () => {
  it("shows STABLE when incidents is empty", () => {
    render(<VerdictBanner incidents={[]} />);
    expect(screen.getByText("Stable — No Major Issues Detected")).toBeInTheDocument();
    expect(screen.getByText("No significant risk signals in the last 30 days.")).toBeInTheDocument();
  });

  it("shows ELEVATED when any incident has high severity", () => {
    render(<VerdictBanner incidents={[highIncident, medIncident]} />);
    expect(screen.getByText("Elevated Risk — Active Issues Detected")).toBeInTheDocument();
    expect(screen.getByText(/Fraud Allegations/)).toBeInTheDocument();
  });

  it("shows MONITORING when no high-severity but medium exists", () => {
    render(<VerdictBanner incidents={[medIncident, lowIncident]} />);
    expect(screen.getByText("Monitoring — Issues Worth Watching")).toBeInTheDocument();
    expect(screen.getByText(/Payout Delays/)).toBeInTheDocument();
  });

  it("shows STABLE when only low severity incidents", () => {
    render(<VerdictBanner incidents={[lowIncident, positiveIncident]} />);
    expect(screen.getByText("Stable — No Major Issues Detected")).toBeInTheDocument();
  });

  it("lists up to 2 top titles in ELEVATED banner", () => {
    const incidents = [
      { id: 1, severity: "high", title: "Title One" },
      { id: 2, severity: "high", title: "Title Two" },
      { id: 3, severity: "high", title: "Title Three" },
    ];
    render(<VerdictBanner incidents={incidents} />);
    expect(screen.getByText(/Title One/)).toBeInTheDocument();
    expect(screen.getByText(/Title One · Title Two/)).toBeInTheDocument();
  });
});
