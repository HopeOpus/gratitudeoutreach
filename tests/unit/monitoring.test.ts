import { describe, expect, it } from "vitest";
import { scrub, routeShape } from "@/lib/monitoring";

describe("error reports carry no personal data", () => {
  it("scrubs phones, emails, card codes and ids", () => {
    const s = scrub("Failed for Ada +2348031234567 ada@x.com card GO26-0142 visit 0190c7b2-1a2b-7c3d-8e4f-123456789abc");
    expect(s).not.toMatch(/2348031234567|ada@x\.com|GO26-0142|0190c7b2/);
  });
  it("keeps only the route shape", () => {
    expect(routeShape("/s/p/0190c7b2-1a2b-7c3d-8e4f-123456789abc/serve?x=1")).toBe("/s/p/:id/serve");
  });
});
