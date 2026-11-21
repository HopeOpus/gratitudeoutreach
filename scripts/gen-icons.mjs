// Generates PWA icons from public/brand/gratitude-icon.svg (forest background).
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/brand/gratitude-icon.svg", import.meta.url));
const out = new URL("../public/icons/", import.meta.url);
await mkdir(out, { recursive: true });

await sharp(svg).resize(192, 192).png().toFile(new URL("icon-192.png", out).pathname);
await sharp(svg).resize(512, 512).png().toFile(new URL("icon-512.png", out).pathname);
await sharp(svg).resize(180, 180).png().toFile(new URL("apple-touch-icon.png", out).pathname);
// Maskable: mark at 70% inside the safe zone on forest.
const inner = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#07210D" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(new URL("icon-maskable-512.png", out).pathname);
// Logo PNGs for PDFs (react-pdf has limited SVG support).
await sharp(await readFile(new URL("../public/brand/gratitude-logo.svg", import.meta.url))).resize({ width: 1200 }).png().toFile(new URL("logo-1200.png", out).pathname);
await sharp(await readFile(new URL("../public/brand/gratitude-logo-white.svg", import.meta.url))).resize({ width: 1200 }).png().toFile(new URL("logo-white-1200.png", out).pathname);
await sharp(svg).resize(256, 256).png().toFile(new URL("icon-256.png", out).pathname);
console.log("icons written to public/icons");
// Small logos for PDFs (embedded once per document as a data URI).
await sharp(await readFile(new URL("../public/brand/gratitude-logo.svg", import.meta.url))).resize({ width: 480 }).png({ palette: true }).toFile(new URL("logo-480.png", out).pathname);
