import { createHash } from "crypto";

/**
 * Normalizes text for comparison/hashing:
 * - Converts to lowercase
 * - Removes extra whitespace
 * - Strips punctuation
 * - Trims leading/trailing whitespace
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Computes SHA-256 hash of normalized text.
 * Used for exact duplicate detection.
 */
export function computeTextHash(text: string): string {
  const normalized = normalizeText(text);
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Computes a simhash for fuzzy matching.
 * Simhash produces similar hashes for similar content.
 *
 * Algorithm:
 * 1. Extract words from text
 * 2. Hash each word to a 64-bit value
 * 3. For each bit position, sum +1 if bit is 1, -1 if bit is 0
 * 4. Final hash has bit 1 if sum > 0, else 0
 */
export function computeSimHash(text: string): string {
  const normalized = normalizeText(text);
  const words = normalized.split(" ").filter((w) => w.length > 0);

  if (words.length === 0) {
    return "0".repeat(16); // 64 bits as hex
  }

  // 64-bit simhash using array of bit counts
  const bitCounts = new Array(64).fill(0);

  for (const word of words) {
    // Hash the word to get 64 bits
    const hash = createHash("md5").update(word).digest();

    // Use first 8 bytes (64 bits)
    for (let i = 0; i < 64; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      const bit = (hash[byteIndex] >> bitIndex) & 1;
      bitCounts[i] += bit ? 1 : -1;
    }
  }

  // Convert bit counts to final hash
  let result = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if (bitCounts[i] > 0) {
      result |= BigInt(1) << BigInt(i);
    }
  }

  return result.toString(16).padStart(16, "0");
}

/**
 * Computes Hamming distance between two simhashes.
 * Lower distance = more similar.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  const a = BigInt("0x" + hash1);
  const b = BigInt("0x" + hash2);
  let xor = a ^ b;
  let distance = 0;

  while (xor > 0) {
    distance += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }

  return distance;
}

/**
 * Computes similarity ratio between two simhashes (0-1).
 * 1 = identical, 0 = completely different.
 */
export function simHashSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  return 1 - distance / 64;
}

/**
 * Computes Jaccard similarity between two texts (0-1).
 * Uses word sets for comparison.
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).split(" ").filter(Boolean));
  const words2 = new Set(normalizeText(text2).split(" ").filter(Boolean));

  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
