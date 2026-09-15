/**
 * Minimal RTF writer — enough to produce a Word-openable .rtf document with
 * headings, paragraphs, and full Unicode (Devanagari) support.
 *
 * RTF stores non-ASCII characters as `\uN?` where N is the signed 16-bit code
 * unit, so Marathi text round-trips correctly into Word / LibreOffice.
 */

/** Escapes one run of text into RTF-safe content, Unicode included. */
function escapeRtfText(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const code = input.charCodeAt(i);
    if (ch === "\\") out += "\\\\";
    else if (ch === "{") out += "\\{";
    else if (ch === "}") out += "\\}";
    else if (ch === "\n") out += "\\par\n";
    else if (ch === "\r") continue;
    else if (ch === "\t") out += "\\tab ";
    else if (code < 128) out += ch;
    else {
      const signed = code > 32767 ? code - 65536 : code;
      out += `\\u${signed}?`;
    }
  }
  return out;
}

export interface RtfBlock {
  /** "h1" | "h2" render bold + larger; "p" is a normal paragraph. */
  style: "h1" | "h2" | "p";
  text: string;
}

/** Builds a complete RTF document string from an ordered list of blocks. */
export function buildRtfDocument(blocks: RtfBlock[]): string {
  const body = blocks
    .map((block) => {
      const content = escapeRtfText(block.text);
      if (block.style === "h1") return `{\\pard\\sa180\\b\\fs36 ${content}\\par}`;
      if (block.style === "h2") return `{\\pard\\sa120\\sb120\\b\\fs28 ${content}\\par}`;
      return `{\\pard\\sa120\\fs24 ${content}\\par}`;
    })
    .join("\n");

  return (
    `{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1` +
    `{\\fonttbl{\\f0\\fnil Segoe UI;}{\\f1\\fnil Nirmala UI;}}` +
    `\\f0\\fs24\n${body}\n}`
  );
}

/** Triggers a browser download of `content` as an .rtf file. */
export function downloadRtf(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "application/rtf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".rtf") ? fileName : `${fileName}.rtf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
