// CI guard: Sora 300/400/500 only. Fails on semibold/bold anywhere in source.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src"];
const bad = [/\bfont-(semibold|bold|extrabold|black)\b/, /font-weight:\s*(600|700|800|900|bold)/i, /fontWeight:\s*["']?(600|700|800|900|bold)/];
const hits = [];
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css|mjs)$/.test(f)) {
      readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        if (bad.some((r) => r.test(line))) hits.push(`${p}:${i + 1}: ${line.trim()}`);
      });
    }
  }
}
roots.forEach(walk);
if (hits.length) {
  console.error("Font weight above 500 found (Sora 300/400/500 only):\n" + hits.join("\n"));
  process.exit(1);
}
console.log("✓ No font weights above 500");
