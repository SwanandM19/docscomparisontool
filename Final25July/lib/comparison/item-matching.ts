import type { ExtractedLineItem } from "@/types/document";

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Token-set (Jaccard-style) similarity between two strings, 0..1.
 * Cheap, dependency-free, and good enough for matching short product/line
 * item descriptions across documents that describe the same thing with
 * slightly different wording.
 */
export function textSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeText(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface MatchedItemPair {
  itemA: ExtractedLineItem;
  itemB: ExtractedLineItem;
  similarity: number;
}

export interface ItemMatchResult {
  matched: MatchedItemPair[];
  onlyInA: ExtractedLineItem[]; // present in A, missing from B
  onlyInB: ExtractedLineItem[]; // present in B, extra/not expected in A
}

const SIMILARITY_THRESHOLD = 0.45;

/**
 * Matches line items between two documents. Prefers exact itemNo matches,
 * then falls back to description similarity above SIMILARITY_THRESHOLD,
 * greedily picking the best available pairing.
 */
export function matchLineItems(
  itemsA: ExtractedLineItem[],
  itemsB: ExtractedLineItem[]
): ItemMatchResult {
  const remainingB = [...itemsB];
  const matched: MatchedItemPair[] = [];
  const onlyInA: ExtractedLineItem[] = [];

  for (const itemA of itemsA) {
    // 1. Try exact item number match first (most reliable signal).
    let bestIdx = -1;
    if (itemA.itemNo) {
      bestIdx = remainingB.findIndex(
        (b) => b.itemNo && b.itemNo.trim() === itemA.itemNo!.trim()
      );
    }

    // 2. Fall back to best description similarity.
    if (bestIdx === -1) {
      let bestScore = 0;
      remainingB.forEach((b, idx) => {
        const score = textSimilarity(itemA.description, b.description);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = score >= SIMILARITY_THRESHOLD ? idx : bestIdx;
        }
      });
      if (bestScore < SIMILARITY_THRESHOLD) bestIdx = -1;
    }

    if (bestIdx >= 0) {
      const itemB = remainingB[bestIdx];
      matched.push({
        itemA,
        itemB,
        similarity: itemA.itemNo && itemB.itemNo === itemA.itemNo ? 1 : textSimilarity(itemA.description, itemB.description),
      });
      remainingB.splice(bestIdx, 1);
    } else {
      onlyInA.push(itemA);
    }
  }

  return { matched, onlyInA, onlyInB: remainingB };
}
