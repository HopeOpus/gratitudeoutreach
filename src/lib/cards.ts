/** QR payloads contain ONLY the card code (FR-2.3): `GC:GO26-0142`. */
export const QR_PREFIX = "GC:";
const CODE_RE = /^[A-Z0-9]{2,6}-(?:R\d{1,3}-)?\d{3,5}$/;

export function qrPayload(code: string): string {
  return `${QR_PREFIX}${code}`;
}

export function isCardCode(code: string): boolean {
  return CODE_RE.test(code);
}

/** Accepts `GC:GO26-0142`, `GO26-0142`, or lowercase/whitespace variants. Returns null otherwise. */
export function parseCardPayload(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().toUpperCase();
  if (s.startsWith(QR_PREFIX)) s = s.slice(QR_PREFIX.length);
  s = s.replace(/\s+/g, "");
  return isCardCode(s) ? s : null;
}

/** Keypad entry: prefix "GO26" + digits "142" -> "GO26-0142". */
export function codeFromDigits(prefix: string, digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (!d) return null;
  const width = Math.max(4, d.length);
  return `${prefix}-${d.padStart(width, "0")}`;
}
