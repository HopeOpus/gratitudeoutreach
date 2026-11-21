# Gratitude Connect — Design System

All colours come from the Gratitude Outreach logo (`public/brand/`). Typeface: **Sora** in **Light (300), Regular (400) and Medium (500) only**. Never use Semibold or Bold.

---

## 1. Brand colours (from the logo)

| Token | Hex | Where it comes from | Use |
|---|---|---|---|
| `forest` | **#07210D** | Icon background | App header, sidebar, dark surfaces, primary text on light tints |
| `leaf` | **#188B12** | Dark-green figures | Primary brand colour, primary buttons, active states |
| `fresh` | **#53D34C** | Light-green figures | Success, highlights, accents on dark surfaces, progress |
| `teal` | **#09BFC2** | The "heads" (dots) | Secondary accent, info, live/realtime indicators, focus rings on dark |
| `ink` | **#272727** | Wordmark text | Body text on light surfaces |

### Contrast rules (tested)

| Pair | Ratio | Verdict |
|---|---|---|
| `forest` on white | 17.0 : 1 | ✅ Any text |
| `ink` on white | 14.9 : 1 | ✅ Body text |
| `leaf` #188B12 on white | 4.43 : 1 | ⚠️ Large text (≥ 18.66 px Medium) and button fills with white text only. **Not for small text.** |
| `leaf-700` #136F0E on white | 5.5+ : 1 | ✅ Links and small green text |
| `fresh` #53D34C on white | 1.95 : 1 | ❌ Never text on white. Fills and decoration only |
| `teal` #09BFC2 on white | 2.27 : 1 | ❌ Never text on white. Use `teal-700` #057374 for teal text |
| `fresh` on `forest` | 8.8 : 1 | ✅ Great for text on dark |
| `teal` on `forest` | 7.5 : 1 | ✅ Great for text on dark |
| white on `leaf` | 4.43 : 1 | ✅ Buttons (text at 16 px Medium; acceptable as UI component); prefer `leaf-600` #136F0E for small buttons |

---

## 2. Full palette (tints and shades)

```
forest:  50 #EBEDEC  100 #CDD3CF  300 #9CA69E  500 #5E6F62  900 #07210D  950 #041408
leaf:    50 #EDF6EC  100 #D1E8D0  200 #A3D1A0  400 #69B465  500 #188B12  600 #136F0E  700 #0E530B
fresh:   50 #F1FBF1  100 #DDF6DB  200 #BAEDB7  400 #8FE28B  500 #53D34C  600 #42A93D  700 #327F2E
teal:    50 #EBFAFA  100 #CEF2F3  200 #9DE5E7  400 #5FD5D7  500 #09BFC2  600 #07999B  700 #057374
ink:     #272727
```

### Neutrals (green-tinted, so greys feel on-brand)
```
neutral-0    #FFFFFF   page cards
neutral-25   #F7F9F7   page background
neutral-50   #EFF2EF   subtle fills, table stripes
neutral-100  #E1E6E2   borders
neutral-300  #B5BEB7   disabled borders
neutral-500  #6B756D   secondary text (5.0:1 on white ✅)
neutral-700  #3F4741   strong secondary text
neutral-900  #272727   = ink
```

### Functional colours (not in the logo; needed for status)
```
warning   #B45309  (text)   bg #FEF3C7   — low stock, abnormal vitals (mild)
danger    #B42318  (text)   bg #FEE4E2   — errors, urgent flags, BP ≥ 160/100
info      #057374  (teal-700) bg #EBFAFA
success   #136F0E  (leaf-600) bg #EDF6EC
confidential #4B3F72 (text) bg #EFEBFA   — 🔒 confidential badges (distinct from status colours)
```

---

## 3. Station colour coding

Each station gets an accent for its chip, icon background and timeline dot. Always pair the colour with an icon and a label; never use colour alone.

| Station | Accent | Icon (lucide) |
|---|---|---|
| Registration | `forest` #07210D | `ClipboardPen` |
| Prayer | `teal-600` #07999B | `HandHeart` |
| Counselling | `#4B3F72` (confidential violet) | `MessagesSquare` |
| Medical | `#B42318` (medical red) | `Stethoscope` |
| Food | `leaf` #188B12 | `UtensilsCrossed` |
| Clothing | `fresh-600` #42A93D | `Shirt` |
| Custom | `neutral-700` #3F4741 | admin picks icon |

---

## 4. Typography: Sora

Load from Google Fonts with `next/font/google`:
```ts
import { Sora } from "next/font/google";
export const sora = Sora({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-sora", display: "swap" });
```

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `display` | 40 / 48 | 300 Light | Dashboard hero numbers (KPIs) |
| `h1` | 28 / 36 | 500 Medium | Page titles |
| `h2` | 22 / 30 | 500 Medium | Section titles, beneficiary name on profile |
| `h3` | 18 / 26 | 500 Medium | Card titles |
| `body-lg` | 17 / 26 | 400 Regular | Volunteer forms (mobile default) |
| `body` | 15 / 24 | 400 Regular | Desktop body |
| `label` | 14 / 20 | 500 Medium | Form labels, buttons, chips |
| `caption` | 13 / 18 | 400 Regular | Timestamps, helper text (min. colour `neutral-500`) |
| `code` | 20 / 28 | 500 Medium, `tracking-wider`, tabular nums | Card codes like **GO26-0142** |

Rules:
- Emphasis comes from **Medium (500)**, size and colour, never bold.
- Light (300) only at 28 px and above (thin strokes vanish in sunlight at small sizes).
- Use `font-variant-numeric: tabular-nums` for counts, vitals and codes.
- Minimum text size on mobile: 13 px; form inputs 17 px (also stops iOS zoom).

---

## 5. Spacing, radius, elevation

- **Spacing scale (px):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Radius:** `sm` 8 · `md` 12 (inputs, buttons) · `lg` 16 (cards) · `xl` 24 (bottom sheets, scan button) · `full` (chips, avatars).
- **Elevation:** keep it flat. Cards use a 1 px `neutral-100` border plus `shadow-sm` (`0 1px 2px rgba(7,33,13,0.06)`). Bottom sheets and modals: `0 -8px 24px rgba(7,33,13,0.12)`.
- **Touch targets:** at least 48 × 48 px; primary actions on mobile are 56 px tall, full width.

---

## 6. Core components

| Component | Spec |
|---|---|
| **AppHeader (mobile)** | `forest` background, white mark (transparent icon) at 28 px, station name in `fresh` Medium 15, sync indicator on the right. 56 px tall. |
| **SyncIndicator** | Pill: ● `fresh` "Synced" · ● `warning` "Offline · 12 pending" · animated ● `teal` "Syncing…" · ● `danger` "Sync error — tap". |
| **ScanButton** | Hero 160 px circle or 64 px full-width bar, `leaf` fill, white `ScanLine` icon, label "Scan card". Pulses gently (respects `prefers-reduced-motion`). |
| **CodeKeypad** | `GO26-` fixed prefix chip, 4-digit entry, 72 px keys. |
| **PersonCard** | Name (h3), code badge (`code` token on `neutral-50`), meta line (age range · gender · community), returning badge (`teal-50` bg / `teal-700` text). |
| **NeedChip** | Station icon + label; states: Pending (outline `neutral-300`), Served (`leaf-50` bg, `leaf-700` text, ✓ + time), Declined (`neutral-50`, strikethrough, reason tooltip), Referred (`teal-50`, ↪ icon). |
| **TimelineItem** | Left dot in station colour; station name (label), time (caption), volunteer first name; summary line; 🔒 variant shows "Confidential session recorded" with a `confidential` badge. New items animate in with a 2 s `fresh-50` highlight. |
| **AlertBanner** | Rounded `md`, icon left, `warning` / `danger` / `info` palettes, always with text. |
| **VitalsInput** | Numeric fields with units; out-of-range values turn the field border `warning`/`danger` and show a hint ("High — consider referral"). |
| **StockPicker** | Item rows with remaining count; low (`warning`), out (`disabled` + "Out of stock"). |
| **KPI tile (dashboard)** | Label (caption, `neutral-500`), value (display, Light 300, `forest`), delta/sparkline in `leaf`. |
| **StationCard (dashboard)** | Station icon chip, Served / Pending / Avg time, stock bar (`fresh` → `warning` → `danger`), active volunteers avatars. |
| **Buttons** | Primary: `leaf` bg, white text, hover `leaf-600`. Secondary: white bg, `leaf-700` text, `neutral-100` border. Ghost: transparent, `forest` text. Destructive: `danger`. All Medium 500, radius `md`, heights 40 (desktop) / 56 (mobile primary). |
| **Inputs** | 52 px mobile, 1 px `neutral-100` border, focus: 2 px `leaf` ring plus 2 px offset; error: `danger` border plus message below. |
| **BottomSheet** | Used for confirmations, duplicates and referrals on mobile. Radius `xl` top. |
| **Toast** | Success toast after save: `forest` background, `fresh` check icon, "Saved · Medical for Ada O." plus **Undo** (10 s). |

---

## 7. Iconography and imagery

- **Icons:** `lucide-react`, 1.75 px stroke, 20 px (inline) / 24 px (nav) / 32 px (station tiles).
- **Brand mark:** the logo's circle of figures. Use `gratitude-mark-transparent.svg` on dark headers and `gratitude-icon.svg` (with its forest background) as the PWA/app icon.
- **Wordmark:** `gratitude-logo.svg` on light, `gratitude-logo-white.svg` on `forest`.
- **Decorative motif (sparingly):** the logo's leaf arcs, at 6% opacity in `fresh`, as a background flourish on login, empty states and report covers.
- No stock photos of beneficiaries. Use illustrations or the motif only (dignity and privacy).

---

## 8. Themes

- **Light (default)** is optimised for outdoor sunlight.
- **Dark (optional, dashboard only):** surface `forest-950` #041408, cards `forest` #07210D, text white / `forest-100`, accents `fresh` and `teal` (both pass contrast on forest).

---

## 9. Motion

- Durations: 150 ms (micro), 250 ms (sheets), 400 ms (page).
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Successful save: check-mark draw plus a light haptic (`navigator.vibrate(30)` where supported).
- Respect `prefers-reduced-motion`: disable the pulse and highlight animations.

---

## 10. Tailwind config (drop-in)

```ts
// tailwind.config.ts (extend)
colors: {
  forest: { 50:"#EBEDEC",100:"#CDD3CF",300:"#9CA69E",500:"#5E6F62",900:"#07210D",950:"#041408", DEFAULT:"#07210D" },
  leaf:   { 50:"#EDF6EC",100:"#D1E8D0",200:"#A3D1A0",400:"#69B465",500:"#188B12",600:"#136F0E",700:"#0E530B", DEFAULT:"#188B12" },
  fresh:  { 50:"#F1FBF1",100:"#DDF6DB",200:"#BAEDB7",400:"#8FE28B",500:"#53D34C",600:"#42A93D",700:"#327F2E", DEFAULT:"#53D34C" },
  teal:   { 50:"#EBFAFA",100:"#CEF2F3",200:"#9DE5E7",400:"#5FD5D7",500:"#09BFC2",600:"#07999B",700:"#057374", DEFAULT:"#09BFC2" },
  ink: "#272727",
  neutral: { 0:"#FFFFFF",25:"#F7F9F7",50:"#EFF2EF",100:"#E1E6E2",300:"#B5BEB7",500:"#6B756D",700:"#3F4741",900:"#272727" },
  warning: { DEFAULT:"#B45309", bg:"#FEF3C7" },
  danger:  { DEFAULT:"#B42318", bg:"#FEE4E2" },
  confidential: { DEFAULT:"#4B3F72", bg:"#EFEBFA" },
},
fontFamily: { sans: ["var(--font-sora)", "system-ui", "sans-serif"] },
fontWeight: { light: "300", normal: "400", medium: "500" }, // intentionally no semibold/bold
```

If using Tailwind v4 (CSS-first), put the same values in `@theme { --color-forest: #07210D; ... }` in `globals.css`.
