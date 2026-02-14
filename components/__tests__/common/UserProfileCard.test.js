/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import UserProfileCard from "@/components/common/UserProfileCard";

jest.mock("next/image", () => {
  const Mock = ({ src, alt }) => <img src={src} alt={alt} />;
  Mock.displayName = "NextImage";
  return { __esModule: true, default: Mock };
});

describe("UserProfileCard", () => {
  it("renders display name and handle", () => {
    render(<UserProfileCard displayName="Jane Doe" handle="janedoe" />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("@janedoe")).toBeInTheDocument();
  });

  it("renders initials when no avatar and no displayName", () => {
    render(<UserProfileCard />);
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("renders bio when provided", () => {
    render(<UserProfileCard displayName="A" bio="Trader and developer" />);
    expect(screen.getByText("Trader and developer")).toBeInTheDocument();
  });

  it("renders trust score", () => {
    render(<UserProfileCard displayName="A" trustScore={85} />);
    expect(screen.getByText("85/100")).toBeInTheDocument();
  });

  it("renders payout count", () => {
    render(<UserProfileCard displayName="A" payoutCount={12} />);
    expect(screen.getByText("12 verified")).toBeInTheDocument();
  });

  it("renders member since when provided", () => {
    render(<UserProfileCard displayName="A" memberSince="Jan 2024" />);
    expect(screen.getByText("Jan 2024")).toBeInTheDocument();
  });
});
