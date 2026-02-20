/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import UserProfileCard from "@/components/common/UserProfileCard";

jest.mock("next/image", () => {
  const Mock = ({ src, alt, onError }) => (
    <img src={src} alt={alt} onError={onError} data-testid="avatar-img" />
  );
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

  it("renders trust score hint text", () => {
    render(<UserProfileCard displayName="A" trustScore={50} />);
    expect(screen.getByText("Share of received funds from verified prop firms")).toBeInTheDocument();
  });

  it("renders payout count", () => {
    render(<UserProfileCard displayName="A" payoutCount={12} />);
    expect(screen.getByText("12 verified")).toBeInTheDocument();
  });

  it("renders member since when provided", () => {
    render(<UserProfileCard displayName="A" memberSince="Jan 2024" />);
    expect(screen.getByText("Jan 2024")).toBeInTheDocument();
  });

  it("renders avatar when avatarUrl provided", () => {
    render(<UserProfileCard displayName="A" avatarUrl="https://example.com/avatar.png" />);
    const img = screen.getByTestId("avatar-img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("shows initials after avatar image errors", () => {
    render(
      <UserProfileCard displayName="Jane" avatarUrl="https://example.com/bad.png" />
    );
    const img = screen.getByTestId("avatar-img");
    fireEvent.error(img);
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("renders Twitter link when socialLinks.twitter provided", () => {
    render(
      <UserProfileCard
        displayName="A"
        socialLinks={{ twitter: "https://twitter.com/user" }}
      />
    );
    const links = screen.getAllByRole("link");
    const twitter = links.find((l) => l.getAttribute("href") === "https://twitter.com/user");
    expect(twitter).toBeInTheDocument();
  });

  it("renders YouTube link when socialLinks.youtube provided", () => {
    render(
      <UserProfileCard
        displayName="A"
        socialLinks={{ youtube: "https://youtube.com/@user" }}
      />
    );
    const links = screen.getAllByRole("link");
    const yt = links.find((l) => l.getAttribute("href") === "https://youtube.com/@user");
    expect(yt).toBeInTheDocument();
  });
});
