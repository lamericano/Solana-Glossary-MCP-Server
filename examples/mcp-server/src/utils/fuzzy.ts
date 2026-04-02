/**
 * Fuzzy Matching Engine
 * 
 * Lightweight fuzzy search with scoring for glossary term matching.
 * No external dependencies — uses Levenshtein distance and bigram similarity.
 */

/** Calculate Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/** Generate character bigrams from a string */
function bigrams(s: string): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    result.add(s.substring(i, i + 2));
  }
  return result;
}

/** Dice coefficient for bigram similarity (0-1) */
function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export interface FuzzyMatch<T> {
  item: T;
  score: number; // 0-1, higher is better
  matchType: "exact" | "prefix" | "contains" | "fuzzy";
}

export interface FuzzySearchOptions {
  /** Minimum score to include in results (0-1) */
  threshold?: number;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Fuzzy search over a list of items.
 * 
 * @param query - The search query
 * @param items - Items to search
 * @param getFields - Function to extract searchable text fields from an item
 * @param options - Search configuration
 */
export function fuzzySearch<T>(
  query: string,
  items: T[],
  getFields: (item: T) => string[],
  options: FuzzySearchOptions = {}
): FuzzyMatch<T>[] {
  const { threshold = 0.3, limit = 20 } = options;
  const q = query.toLowerCase().trim();

  if (q.length === 0) return [];

  const results: FuzzyMatch<T>[] = [];

  for (const item of items) {
    const fields = getFields(item).map(f => f.toLowerCase());
    let bestScore = 0;
    let bestType: FuzzyMatch<T>["matchType"] = "fuzzy";

    for (const field of fields) {
      // Exact match
      if (field === q) {
        bestScore = 1.0;
        bestType = "exact";
        break;
      }

      // Prefix match
      if (field.startsWith(q)) {
        const score = 0.9 * (q.length / field.length);
        if (score > bestScore) {
          bestScore = Math.max(score, 0.7); // Prefix always scores at least 0.7
          bestType = "prefix";
        }
        continue;
      }

      // Contains match
      if (field.includes(q)) {
        const score = 0.6 * (q.length / field.length);
        if (score > bestScore) {
          bestScore = Math.max(score, 0.5);
          bestType = "contains";
        }
        continue;
      }

      // Fuzzy match (Levenshtein + Dice)
      const maxLen = Math.max(q.length, field.length);
      const levDist = levenshtein(q, field.substring(0, q.length + 5)); // Compare only relevant portion
      const levScore = 1 - levDist / maxLen;
      const diceScore = diceCoefficient(q, field);
      const fuzzyScore = (levScore * 0.6 + diceScore * 0.4);

      if (fuzzyScore > bestScore) {
        bestScore = fuzzyScore;
        bestType = "fuzzy";
      }
    }

    if (bestScore >= threshold) {
      results.push({ item, score: bestScore, matchType: bestType });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}
