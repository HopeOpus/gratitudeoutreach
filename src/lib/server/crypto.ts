import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";

// Station PINs are stored as bcrypt hashes for verification, plus an AES-GCM
// copy (station_secrets, service-role only) so coordinators can print posters.
function key(): Buffer {
  const secret = process.env.JOIN_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error("JOIN_TOKEN_SECRET must be set (>= 32 chars)");
  return createHash("sha256").update(`${secret}:station-pins`).digest();
}

export function encryptPin(pin: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(pin, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}

export function decryptPin(enc: string | null | undefined, allowTraining: boolean): string | null {
  if (!enc) return null;
  if (enc.startsWith("training:")) return allowTraining ? enc.slice("training:".length) : null;
  const [v, iv, tag, ct] = enc.split(":");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function randomPin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function newJoinToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}
