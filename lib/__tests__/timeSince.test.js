import { timeSince, timeSinceShort } from "@/lib/utils/timeSince";

describe("timeSince", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-14T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns N/A for null or undefined", () => {
    expect(timeSince(null)).toBe("N/A");
    expect(timeSince(undefined)).toBe("N/A");
  });

  it("returns N/A for future dates", () => {
    expect(timeSince("2026-02-15T12:00:00.000Z")).toBe("N/A");
  });

  it("returns N/A for invalid timestamp", () => {
    expect(timeSince("not-a-date")).toBe("N/A");
  });

  it("returns 'Just now' for less than 1 minute ago", () => {
    expect(timeSince("2026-02-14T11:59:30.000Z")).toBe("Just now");
  });

  it("returns minutes when under 1 hour", () => {
    expect(timeSince("2026-02-14T11:55:00.000Z")).toBe("5m");
  });

  it("returns hours and minutes when over 1 hour", () => {
    expect(timeSince("2026-02-14T10:08:00.000Z")).toBe("1h 52m");
  });

  it("returns hours only when minutes are zero", () => {
    expect(timeSince("2026-02-14T11:00:00.000Z")).toBe("1h");
  });

  it("returns days and hours when over 24 hours", () => {
    expect(timeSince("2026-02-12T10:00:00.000Z")).toBe("2d 2hr");
  });

  it("returns date string when over 7 days", () => {
    const result = timeSince("2026-02-01T12:00:00.000Z");
    expect(result).toMatch(/Feb/);
    expect(result).toMatch(/1/);
  });

  it("includes year when different from current year", () => {
    jest.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const result = timeSince("2025-12-01T12:00:00.000Z");
    expect(result).toMatch(/2025|Dec/);
  });
});

describe("timeSinceShort", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-14T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns N/A for null or undefined", () => {
    expect(timeSinceShort(null)).toBe("N/A");
    expect(timeSinceShort(undefined)).toBe("N/A");
  });

  it("returns N/A for future dates", () => {
    expect(timeSinceShort("2026-02-15T12:00:00.000Z")).toBe("N/A");
  });

  it("returns compact minutes", () => {
    expect(timeSinceShort("2026-02-14T11:45:00.000Z")).toBe("15m");
  });

  it("returns compact hours", () => {
    expect(timeSinceShort("2026-02-14T10:00:00.000Z")).toBe("2h");
  });

  it("returns compact days", () => {
    expect(timeSinceShort("2026-02-12T12:00:00.000Z")).toBe("2d");
  });

  it("returns 'now' for less than 1 minute ago", () => {
    expect(timeSinceShort("2026-02-14T11:59:45.000Z")).toBe("now");
  });
});
