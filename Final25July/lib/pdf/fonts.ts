import { Font } from "@react-pdf/renderer";
import type { TranslationLanguage } from "@/types/translation";

/**
 * Font family name to use across every generated PDF. Noto Sans Devanagari
 * covers both Latin and मराठी / Devanagari, so a single family renders mixed
 * English + Marathi (and Hindi) content — the built-in Helvetica can't draw
 * Devanagari at all (every glyph becomes a blank box).
 */
export const PDF_FONT_FAMILY = "NotoDeva";

let registered = false;

/**
 * Registers the Devanagari-capable fonts with @react-pdf. Safe to call many
 * times — it only registers once. The TTFs are fetched from a CDN on first
 * render and cached for the life of the process.
 */
export function registerDevanagariFonts(): void {
  if (registered) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      {
        src: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",
        fontWeight: 400,
      },
      {
        src: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Bold.ttf",
        fontWeight: 700,
      },
    ],
  });
  // Don't hyphenate — it mangles Devanagari and long reference codes.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

/**
 * One Noto Sans family per non-Devanagari script the Translation section
 * supports, following the exact same registration pattern as
 * registerDevanagariFonts() above — added, not restructured. Keyed by the
 * script's family name (see SCRIPT_FONT_FAMILY) rather than by language,
 * since several languages can share a script family. German, French, and
 * Spanish aren't listed here — they use standard Latin, already covered by
 * PDF_FONT_FAMILY, same as English.
 *
 * `src` is optional per-entry: the Indic scripts share one CDN/repo layout
 * so `folder`/`file` builds their URL; Japanese/Chinese live in a
 * differently-laid-out repo (the CJK "super-font" covering all Han
 * unification glyphs), so they set `src` directly instead.
 */
const SCRIPT_FONTS: Record<
  string,
  { family: string; folder?: string; file?: string; src?: { regular: string; bold: string } }
> = {
  gu: { family: "NotoGujarati", folder: "NotoSansGujarati", file: "NotoSansGujarati" },
  bn: { family: "NotoBengali", folder: "NotoSansBengali", file: "NotoSansBengali" },
  ta: { family: "NotoTamil", folder: "NotoSansTamil", file: "NotoSansTamil" },
  te: { family: "NotoTelugu", folder: "NotoSansTelugu", file: "NotoSansTelugu" },
  kn: { family: "NotoKannada", folder: "NotoSansKannada", file: "NotoSansKannada" },
  ml: { family: "NotoMalayalam", folder: "NotoSansMalayalam", file: "NotoSansMalayalam" },
  pa: { family: "NotoGurmukhi", folder: "NotoSansGurmukhi", file: "NotoSansGurmukhi" },
  ja: {
    family: "NotoCJKjp",
    src: {
      regular: "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf",
      bold: "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Bold.otf",
    },
  },
  zh: {
    family: "NotoCJKsc",
    src: {
      regular: "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
      bold: "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf",
    },
  },
};

const scriptRegistered = new Set<string>();

/**
 * Returns the @react-pdf font family that can render the given language's
 * script, registering it with @react-pdf on first use. English, Marathi,
 * Hindi, German, French, and Spanish all reuse the existing Devanagari/Latin
 * family untouched.
 */
export function pdfFontFamilyForLanguage(lang: TranslationLanguage): string {
  const entry = SCRIPT_FONTS[lang];
  if (!entry) {
    registerDevanagariFonts();
    return PDF_FONT_FAMILY;
  }

  if (!scriptRegistered.has(lang)) {
    const regularSrc =
      entry.src?.regular ??
      `https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/${entry.folder}/${entry.file}-Regular.ttf`;
    const boldSrc =
      entry.src?.bold ??
      `https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/${entry.folder}/${entry.file}-Bold.ttf`;

    Font.register({
      family: entry.family,
      fonts: [
        { src: regularSrc, fontWeight: 400 },
        { src: boldSrc, fontWeight: 700 },
      ],
    });
    scriptRegistered.add(lang);
  }

  return entry.family;
}
