import "server-only";
import path from "node:path";
import { readFileSync } from "node:fs";
import { Font, Path, Svg } from "@react-pdf/renderer";
import QRCode from "qrcode";

// Sora 300/400/500 only — same rule as the app.
let registered = false;
export function registerFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "node_modules/@fontsource/sora/files");
  Font.register({
    family: "Sora",
    fonts: [
      { src: path.join(dir, "sora-latin-300-normal.woff"), fontWeight: 300 },
      { src: path.join(dir, "sora-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(dir, "sora-latin-500-normal.woff"), fontWeight: 500 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

export const C = {
  forest: "#07210D", leaf: "#188B12", leaf600: "#136F0E", fresh: "#53D34C", teal: "#09BFC2", teal700: "#057374",
  ink: "#272727", n25: "#F7F9F7", n50: "#EFF2EF", n100: "#E1E6E2", n500: "#6B756D", n700: "#3F4741", warning: "#B45309", danger: "#B42318",
};

export const mm = (v: number) => v * 2.8346;

const cache = new Map<string, Buffer>();
export function asset(rel: string): Buffer {
  if (!cache.has(rel)) cache.set(rel, readFileSync(path.join(process.cwd(), "public", rel)));
  return cache.get(rel)!;
}

/** Same string src => react-pdf embeds the image once per document. */
const uriCache = new Map<string, string>();
export function assetUri(rel: string): string {
  if (!uriCache.has(rel)) uriCache.set(rel, `data:image/png;base64,${asset(rel).toString("base64")}`);
  return uriCache.get(rel)!;
}

/** Vector QR (crisp on any printer, fast to render). */
export function QR({ value, size, color = C.forest }: { value: string; size: number; color?: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const data = qr.modules.data;
  let d = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (data[y * n + x]) {
        let run = 1;
        while (x + run < n && data[y * n + x + run]) run++;
        d += `M${x} ${y}h${run}v1h-${run}z`;
        x += run;
      } else x++;
    }
  }
  const quiet = 2;
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${n + quiet * 2} ${n + quiet * 2}`}>
      <Path d={d} fill={color} />
    </Svg>
  );
}
