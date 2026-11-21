import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/volunteer", () => ({ volunteerClient: () => ({}) }));
const { isRetryable } = await import("@/lib/offline/sync");

describe("outbox error classification", () => {
  it("retries network and JWT problems", () => {
    expect(isRetryable({ message: "Failed to fetch" })).toBe(true);
    expect(isRetryable({ code: "PGRST301", message: "JWT expired" })).toBe(true);
    expect(isRetryable({ code: "08006", message: "connection failure" })).toBe(true);
  });
  it("keeps validation/permission errors for review (no infinite retry)", () => {
    expect(isRetryable({ code: "42501", message: "new row violates row-level security policy" })).toBe(false);
    expect(isRetryable({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isRetryable({ code: "P0001", message: "food_duplicate" })).toBe(false);
    expect(isRetryable(null)).toBe(false);
  });
});
