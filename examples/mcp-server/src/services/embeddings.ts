/**
 * Semantic Search Engine (TF-IDF based)
 * 
 * Zero-dependency local semantic search using TF-IDF vectors
 * and cosine similarity. No API keys needed.
 * 
 * Indexes all glossary terms at startup for instant search.
 */

import { allTerms, type GlossaryTerm } from "@stbr/solana-glossary";

interface TermVector {
  termId: string;
  vector: Map<string, number>;
  magnitude: number;
}

// Stopwords to filter out common terms
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "that", "this", "these", "those", "each", "every", "all",
  "both", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "just",
  "and", "but", "or", "if", "while", "because", "until", "although",
  "it", "its", "they", "them", "their", "we", "our", "you", "your",
  "he", "she", "his", "her", "which", "who", "whom", "what", "where",
  "when", "how", "there", "here", "also", "about", "up",
]);

/** Tokenize text into normalized words */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

/** Calculate term frequency */
function tf(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  // Normalize by document length
  const len = tokens.length || 1;
  for (const [k, v] of freq) {
    freq.set(k, v / len);
  }
  return freq;
}

/** Calculate vector magnitude */
function magnitude(vec: Map<string, number>): number {
  let sum = 0;
  for (const v of vec.values()) {
    sum += v * v;
  }
  return Math.sqrt(sum);
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: Map<string, number>, aMag: number, b: Map<string, number>, bMag: number): number {
  if (aMag === 0 || bMag === 0) return 0;

  let dot = 0;
  // Iterate over the smaller map for efficiency
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [key, val] of smaller) {
    const otherVal = larger.get(key);
    if (otherVal !== undefined) {
      dot += val * otherVal;
    }
  }

  return dot / (aMag * bMag);
}

// ─── Index ────────────────────────────────────────────────

let _index: TermVector[] | null = null;
let _idf: Map<string, number> | null = null;
let _indexed = false;

/** Build the search index from all glossary terms */
function buildIndex(): void {
  if (_indexed) return;

  const docCount = allTerms.length;
  const docFreq = new Map<string, number>();
  const rawDocs: Array<{ termId: string; tokens: string[] }> = [];

  // Phase 1: Tokenize all documents and count document frequencies
  for (const term of allTerms) {
    const text = [
      term.term,
      term.term, // double-weight the term name
      term.definition,
      term.category.replace(/-/g, " "),
      ...(term.aliases ?? []),
    ].join(" ");

    const tokens = tokenize(text);
    rawDocs.push({ termId: term.id, tokens });

    const uniqueTokens = new Set(tokens);
    for (const t of uniqueTokens) {
      docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
  }

  // Phase 2: Calculate IDF
  _idf = new Map<string, number>();
  for (const [token, count] of docFreq) {
    _idf.set(token, Math.log(docCount / (count + 1)) + 1);
  }

  // Phase 3: Build TF-IDF vectors
  _index = rawDocs.map(({ termId, tokens }) => {
    const termFreq = tf(tokens);
    const vector = new Map<string, number>();

    for (const [token, tfVal] of termFreq) {
      const idfVal = _idf!.get(token) ?? 1;
      vector.set(token, tfVal * idfVal);
    }

    return {
      termId,
      vector,
      magnitude: magnitude(vector),
    };
  });

  _indexed = true;
}

export interface SemanticResult {
  term: GlossaryTerm;
  score: number;
}

/**
 * Semantic search across the glossary.
 * 
 * @param query - Natural language query
 * @param limit - Max results (default 10)
 * @param threshold - Min similarity score (default 0.05)
 */
export function semanticSearch(
  query: string,
  limit = 10,
  threshold = 0.05
): SemanticResult[] {
  buildIndex();

  // Build query vector
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const queryTf = tf(queryTokens);
  const queryVector = new Map<string, number>();

  for (const [token, tfVal] of queryTf) {
    const idfVal = _idf!.get(token) ?? 1;
    queryVector.set(token, tfVal * idfVal);
  }

  const queryMag = magnitude(queryVector);
  if (queryMag === 0) return [];

  // Score all documents
  const results: SemanticResult[] = [];
  const termMap = new Map(allTerms.map(t => [t.id, t]));

  for (const doc of _index!) {
    const score = cosineSimilarity(queryVector, queryMag, doc.vector, doc.magnitude);
    if (score >= threshold) {
      const term = termMap.get(doc.termId);
      if (term) {
        results.push({ term, score });
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Get the total number of indexed terms
 */
export function getIndexStats(): { totalTerms: number; totalTokens: number; indexed: boolean } {
  buildIndex();
  return {
    totalTerms: _index!.length,
    totalTokens: _idf!.size,
    indexed: _indexed,
  };
}
