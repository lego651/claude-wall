// Mock data for PropProof demo

export const FIRMS = [
  {
    id: 1,
    name: "Apex Trader",
    logoUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=100&h=100&fit=crop",
  },
  {
    id: 2,
    name: "Topstep",
    logoUrl: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&h=100&fit=crop",
  },
  {
    id: 3,
    name: "FTMO",
    logoUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=100&h=100&fit=crop",
  },
];

export const MOCK_TRADERS = [
  {
    id: 1,
    displayName: "The Funded Lady",
    handle: "thefundedlady",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop",
    totalVerifiedPayout: 215000,
    last30DaysPayout: 22000,
    payoutCount: 47,
    bio: "Professional futures trader specializing in ES and NQ. Sharing my journey from zero to consistent profitability.",
    socialLinks: {
      twitter: "https://twitter.com/thefundedlady",
      youtube: "https://youtube.com/thefundedlady",
    },
    payouts: [
      { id: 1, firmId: 1, amount: 5000, timestamp: "2024-06-15T10:00:00Z" },
      { id: 2, firmId: 2, amount: 8500, timestamp: "2024-06-10T10:00:00Z" },
      { id: 3, firmId: 1, amount: 12000, timestamp: "2024-05-28T10:00:00Z" },
      { id: 4, firmId: 3, amount: 6200, timestamp: "2024-05-15T10:00:00Z" },
      { id: 5, firmId: 2, amount: 9800, timestamp: "2024-04-30T10:00:00Z" },
    ],
  },
  {
    id: 2,
    displayName: "Andrew Trader",
    handle: "andrewfx",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
    totalVerifiedPayout: 145200,
    last30DaysPayout: 12500,
    payoutCount: 32,
    bio: "Forex and futures trader. Documenting my prop firm journey.",
    socialLinks: {
      twitter: "https://twitter.com/andrewfx",
    },
    payouts: [
      { id: 6, firmId: 1, amount: 4500, timestamp: "2024-06-12T10:00:00Z" },
      { id: 7, firmId: 2, amount: 7200, timestamp: "2024-05-20T10:00:00Z" },
    ],
  },
  {
    id: 3,
    displayName: "Skalp Master",
    handle: "skalp_master",
    avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=128&h=128&fit=crop",
    totalVerifiedPayout: 89000,
    last30DaysPayout: 4500,
    payoutCount: 18,
    bio: "Scalper focused on high-probability setups.",
    socialLinks: {},
    payouts: [
      { id: 8, firmId: 3, amount: 3200, timestamp: "2024-06-08T10:00:00Z" },
    ],
  },
  {
    id: 4,
    displayName: "Pip Crusher",
    handle: "pipcrusher",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&fit=crop",
    totalVerifiedPayout: 67500,
    last30DaysPayout: 8200,
    payoutCount: 15,
    bio: "Full-time prop trader crushing it one pip at a time.",
    socialLinks: {
      twitter: "https://twitter.com/pipcrusher",
    },
    payouts: [
      { id: 9, firmId: 1, amount: 5500, timestamp: "2024-06-05T10:00:00Z" },
    ],
  },
  {
    id: 5,
    displayName: "Prop Hunter",
    handle: "prophunter",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop",
    totalVerifiedPayout: 42000,
    last30DaysPayout: 0,
    payoutCount: 12,
    bio: "Hunting profit opportunities in the markets daily.",
    socialLinks: {},
    payouts: [
      { id: 10, firmId: 2, amount: 3800, timestamp: "2024-05-10T10:00:00Z" },
    ],
  },
];
