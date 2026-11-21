import { describe, expect, it } from "vitest";
import { normalizePhone, firstName, shortName, formatTime } from "@/lib/utils";
import { parseCardPayload, qrPayload, codeFromDigits, isCardCode } from "@/lib/cards";

describe("normalizePhone (E.164 +234)", () => {
  it.each([
    ["0803 123 4567", "+2348031234567"],
    ["08031234567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["7012345678", "+2347012345678"],
  ])("%s -> %s", (input, out) => expect(normalizePhone(input)).toBe(out));
  it.each(["", "123", "0603 123 4567", "080312345678", "abc"])("rejects %s", (input) => expect(normalizePhone(input)).toBeNull());
});

describe("card codes (QR holds only the code)", () => {
  it("formats the QR payload", () => expect(qrPayload("GO26-0142")).toBe("GC:GO26-0142"));
  it("parses QR payloads and plain codes", () => {
    expect(parseCardPayload("GC:GO26-0142")).toBe("GO26-0142");
    expect(parseCardPayload(" go26-0142 ")).toBe("GO26-0142");
    expect(parseCardPayload("GO26-R3-017")).toBe("GO26-R3-017");
  });
  it("rejects anything else (e.g. URLs, names)", () => {
    expect(parseCardPayload("https://example.com")).toBeNull();
    expect(parseCardPayload("Ada Okafor")).toBeNull();
    expect(parseCardPayload("")).toBeNull();
  });
  it("builds codes from keypad digits", () => {
    expect(codeFromDigits("GO26", "142")).toBe("GO26-0142");
    expect(codeFromDigits("GO26", "12345")).toBe("GO26-12345");
    expect(codeFromDigits("GO26", "")).toBeNull();
    expect(isCardCode("GO26-0142")).toBe(true);
  });
});

describe("names", () => {
  it("first and short names", () => {
    expect(firstName("Ada Okafor")).toBe("Ada");
    expect(shortName("Ada Grace Okafor")).toBe("Ada O.");
    expect(shortName("Ada")).toBe("Ada");
  });
});

describe("times are shown in Africa/Lagos", () => {
  it("formats 09:58 UTC as 10:58 WAT", () => expect(formatTime("2026-12-12T09:58:00Z")).toBe("10:58"));
});
