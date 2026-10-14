/**
 * Citation Support Checker
 *
 * IMPORTANT — what this module does and does NOT do:
 *   - It measures LEXICAL overlap: how many of an answer's content terms (words, numbers, command
 *     flags) appear in the cited passage. It also checks that every number / command flag the
 *     answer states actually appears in the passage.
 *   - It does NOT prove that a claim is factually correct, and it cannot detect a claim that reuses
 *     the passage's words but reverses its meaning ("X is NOT used for Y").
 *   - Nothing here is a probability or a model confidence. Scores are plain ratios (0-1).
 *
 * Every excerpt returned is copied from the real chunk text; this module never writes quotations.
 */

import { Chunk, ChunkCitation } from '../types';
import { TextValidator } from './textValidator';
import { tokenize } from './ragEngine';

export type GroundingStatus =
  | 'strong_overlap'          // >= 70% of answer terms found in the cited excerpt, every claim and number/flag found
  | 'partial_overlap'         // 60% - 69% overlap, or high overlap but one claim is not covered
  | 'unverified_insufficient' // < 60% overlap, missing numbers/flags, heading-only, or missing chunk
  | 'corrupted_source';       // chunk fails readability or contains PDF syntax

export interface ClaimCheck {
  /** One sentence of the answer. */
  claim: string;
  /** True when >= 60% of the claim's terms AND all its numbers/flags are found in a cited chunk. */
  supported: boolean;
  /** Fraction (0-1) of the claim's content terms found in the best-matching cited chunk. */
  coverage: number;
  /** Claim terms (numbers, flags, keywords) not found in the best-matching chunk. */
  unmatchedTerms: string[];
  /** Id of the chunk that matched best (undefined when no chunks were supplied). */
  chunkId?: string;
}

export interface CitationVerificationResult {
  citation: ChunkCitation;
  status: GroundingStatus;
  statusLabel: string;
  /** Fraction (0-1) of answer terms found in the displayed excerpt. A lexical measure only. */
  lexicalOverlap: number;
  /** @deprecated Alias of lexicalOverlap kept for backward compatibility. Not a correctness score. */
  evidenceScore: number;
  /** Fraction (0-1) of answer terms found anywhere in the whole cited chunk. */
  chunkOverlap: number;
  matchedKeywords: string[];
  isReadableSource: boolean;
  explanation: string;
  claimChecks: ClaimCheck[];
}

export const STRONG_OVERLAP_THRESHOLD = 0.70;
export const PARTIAL_OVERLAP_THRESHOLD = 0.60;
export const CLAIM_SUPPORT_THRESHOLD = 0.60;

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const stem = (w: string) => w.toLowerCase().replace(/(?:ing|ies|es|s|ed|ly)$/, '');

export function normalizeWs(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

export interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

/**
 * Splits text into sentences / lines, returning each with its exact offsets in the original string
 * so that excerpts can be copied verbatim.
 */
export function sentenceSpans(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  if (!text) return spans;

  const push = (rawStart: number, rawEnd: number) => {
    let s = rawStart;
    let e = rawEnd;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) spans.push({ text: text.slice(s, e), start: s, end: e });
  };

  let start = 0;
  const re = /([.!?]+)(?=\s|$)|\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m[0] === '\n' ? m.index : m.index + m[0].length;
    push(start, end);
    start = m.index + m[0].length;
  }
  push(start, text.length);
  return spans;
}

/** Content terms (stopwords removed), de-duplicated by stem. */
function contentTerms(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokenize(text)) {
    if (t.length < 2 && !/^\d$/.test(t)) continue;
    const s = stem(t);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(t);
  }
  return out;
}

/**
 * Numbers, command flags (-n, --all) and `inline code` in a piece of text.
 * If an answer states one of these and the source does not contain it, the claim is not supported.
 */
export function criticalTerms(text: string): string[] {
  const found = new Set<string>();
  const src = text || '';
  (src.match(/\b\d+(?:\.\d+)?\b/g) || []).forEach(n => found.add(n));
  (src.match(/(?:^|\s)(--?[a-zA-Z][\w-]*)/g) || []).forEach(f => found.add(f.trim().toLowerCase()));
  (src.match(/`([^`]+)`/g) || []).forEach(c => found.add(c.replace(/`/g, '').trim().toLowerCase()));
  return Array.from(found);
}

function containsCritical(haystack: string, term: string): boolean {
  const h = haystack.toLowerCase();
  if (/^\d/.test(term)) {
    return new RegExp(`(?<![\\d.])${term.replace('.', '\\.')}(?![\\d])`).test(h);
  }
  return h.includes(term.toLowerCase());
}

function termCoverage(terms: string[], targetText: string): { matched: string[]; unmatched: string[]; ratio: number } {
  if (terms.length === 0) return { matched: [], unmatched: [], ratio: 0 };
  const targetStems = new Set(tokenize(targetText).map(stem));
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const t of terms) {
    (targetStems.has(stem(t)) ? matched : unmatched).push(t);
  }
  return { matched, unmatched, ratio: matched.length / terms.length };
}

/** A bare section title such as "Track D: Personalized Tutoring" or "Question 3". */
export function isBareHeadingText(text: string): boolean {
  const clean = (text || '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return (
    clean.length > 0 &&
    clean.length < 80 &&
    /^(?:Track\s+[A-D]|Chapter|Section|Unit|Topic|Q(?:uestion)?\s*\d+)\b/i.test(clean) &&
    !clean.includes('.') &&
    words.length <= 10
  );
}

/** Whether `excerpt` (ignoring whitespace and a trailing ellipsis) appears in `chunkText`. */
export function excerptIsFromChunk(excerpt: string, chunkText: string): boolean {
  const e = normalizeWs(excerpt).replace(/(?:…|\.\.\.)$/, '').trim();
  if (!e) return false;
  return normalizeWs(chunkText).includes(e);
}

// ---------------------------------------------------------------------------
// Excerpt selection
// ---------------------------------------------------------------------------

/**
 * Picks the sentence(s) of `chunkText` that best match `targetText` (an answer or question) and
 * returns them verbatim. Never returns text that is not in the chunk (except a trailing "…" when a
 * single sentence has to be shortened).
 */
export function selectSupportingExcerpt(
  chunkText: string,
  targetText: string,
  opts: { maxSentences?: number; maxChars?: number } = {}
): string {
  const maxSentences = opts.maxSentences ?? 2;
  const maxChars = opts.maxChars ?? 320;
  const spans = sentenceSpans(chunkText);
  if (spans.length === 0) return '';

  const targetTerms = contentTerms(targetText);
  const scored = spans.map((span, idx) => {
    const cov = termCoverage(targetTerms, span.text);
    return { span, idx, matched: cov.matched.length, heading: isBareHeadingText(span.text) };
  });

  // Prefer the sentence matching the most target terms; avoid bare headings; then prefer longer text.
  scored.sort((a, b) => {
    if (b.matched !== a.matched) return b.matched - a.matched;
    if (a.heading !== b.heading) return a.heading ? 1 : -1;
    return b.span.text.length - a.span.text.length;
  });

  let best = scored[0];
  if (best.heading) {
    const nonHeading = scored.find(s => !s.heading && s.matched >= best.matched);
    if (nonHeading) best = nonHeading;
  }

  const first = best.idx;
  let last = best.idx;

  // Extend with the following sentence when it adds more matching terms and still fits.
  while (last - first + 1 < maxSentences && last + 1 < spans.length) {
    const next = spans[last + 1];
    const currentText = chunkText.slice(spans[first].start, spans[last].end);
    const before = termCoverage(targetTerms, currentText).matched.length;
    const after = termCoverage(targetTerms, chunkText.slice(spans[first].start, next.end)).matched.length;
    if (after > before && next.end - spans[first].start <= maxChars) last += 1;
    else break;
  }

  let excerpt = chunkText.slice(spans[first].start, spans[last].end).trim();
  if (excerpt.length > maxChars) {
    const cut = excerpt.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(' ');
    excerpt = (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
  }
  return excerpt;
}

// ---------------------------------------------------------------------------
// Claim-level checks
// ---------------------------------------------------------------------------

function stripMarkdown(s: string): string {
  return s.replace(/^[\s>*\-•\d.)]+/, '').replace(/\*\*|__/g, '').trim();
}

/**
 * Splits an answer into sentences and checks each one against the supplied cited chunks.
 * A sentence is "supported" only if >= 60% of its content terms AND all of its numbers/flags
 * appear in at least one cited chunk. This is still lexical — see the module header.
 */
export function checkClaims(answerText: string, chunks: Chunk[]): ClaimCheck[] {
  const checks: ClaimCheck[] = [];
  for (const span of sentenceSpans(answerText || '')) {
    const claim = stripMarkdown(span.text);
    const terms = contentTerms(claim);
    const critical = criticalTerms(claim);
    if (terms.length < 2 && critical.length === 0) continue; // not a checkable factual claim

    let best: ClaimCheck = { claim, supported: false, coverage: 0, unmatchedTerms: terms.slice(0, 8) };
    for (const chunk of chunks) {
      const cov = termCoverage(terms, chunk.text);
      const missingCritical = critical.filter(c => !containsCritical(chunk.text, c));
      const supported = cov.ratio >= CLAIM_SUPPORT_THRESHOLD && missingCritical.length === 0;
      const candidate: ClaimCheck = {
        claim,
        supported,
        coverage: Number(cov.ratio.toFixed(2)),
        unmatchedTerms: Array.from(new Set([...missingCritical, ...cov.unmatched])).slice(0, 8),
        chunkId: chunk.id
      };
      if ((candidate.supported && !best.supported) || (candidate.supported === best.supported && candidate.coverage > best.coverage)) {
        best = candidate;
      }
    }
    checks.push(best);
  }
  return checks;
}

// ---------------------------------------------------------------------------
// Citation verification
// ---------------------------------------------------------------------------

const DISCLAIMER = 'This is a lexical term-overlap measure; it does not prove the claim is factually correct.';

export class GroundingVerifier {
  /**
   * Measures how well a cited chunk's text overlaps with an answer, and rebuilds the excerpt from
   * the real chunk when the supplied one is not genuinely part of it.
   */
  public static verifyCitation(
    citation: ChunkCitation,
    chunk: Chunk | undefined,
    answerText: string
  ): CitationVerificationResult {
    if (!chunk) {
      return {
        citation: { ...citation, lexicalOverlap: 0, supportKind: 'unchecked' },
        status: 'unverified_insufficient',
        statusLabel: 'Unverified — missing source chunk',
        lexicalOverlap: 0,
        evidenceScore: 0,
        chunkOverlap: 0,
        matchedKeywords: [],
        isReadableSource: false,
        explanation: `Chunk ID ${citation.chunkId} does not exist in the active knowledge base.`,
        claimChecks: []
      };
    }

    const readability = TextValidator.validateReadability(chunk.text);
    if (!readability.isReadable) {
      return {
        citation: { ...citation, lexicalOverlap: 0, supportKind: 'corrupted_source' },
        status: 'corrupted_source',
        statusLabel: 'Unverified — corrupted source chunks',
        lexicalOverlap: 0,
        evidenceScore: 0,
        chunkOverlap: 0,
        matchedKeywords: [],
        isReadableSource: false,
        explanation: `Source text is unreadable: ${readability.reason}. Cannot check claims against corrupted data.`,
        claimChecks: []
      };
    }

    const answerTerms = contentTerms(answerText);
    if (answerTerms.length === 0 || tokenize(chunk.text).length === 0) {
      return {
        citation: { ...citation, lexicalOverlap: 0, supportKind: 'unchecked' },
        status: 'unverified_insufficient',
        statusLabel: 'Unverified — insufficient readable source evidence (0% term overlap)',
        lexicalOverlap: 0,
        evidenceScore: 0,
        chunkOverlap: 0,
        matchedKeywords: [],
        isReadableSource: true,
        explanation: 'Not enough answer text or chunk text to measure overlap.',
        claimChecks: []
      };
    }

    // Use the supplied excerpt only if it genuinely appears in the chunk; otherwise rebuild it.
    const suppliedExcerpt = (citation.excerpt || '').trim();
    const excerpt = excerptIsFromChunk(suppliedExcerpt, chunk.text)
      ? suppliedExcerpt
      : selectSupportingExcerpt(chunk.text, answerText);

    const chunkCov = termCoverage(answerTerms, chunk.text);
    const excerptCov = termCoverage(answerTerms, excerpt);
    const chunkOverlap = Number(chunkCov.ratio.toFixed(2));

    const bareHeading = isBareHeadingText(excerpt);
    const rawOverlap = bareHeading ? Math.min(0.25, excerptCov.ratio) : excerptCov.ratio;
    const lexicalOverlap = Number(rawOverlap.toFixed(2));
    const pct = Math.round(lexicalOverlap * 100);

    const claimChecks = checkClaims(answerText, [chunk]);
    const unsupportedClaims = claimChecks.filter(c => !c.supported);
    const missingCritical = criticalTerms(answerText).filter(c => !containsCritical(chunk.text, c));

    let status: GroundingStatus;
    let statusLabel: string;
    let explanation: string;
    let supportKind: NonNullable<ChunkCitation['supportKind']>;

    if (bareHeading) {
      status = 'unverified_insufficient';
      supportKind = 'heading_only';
      statusLabel = `Unverified — excerpt is a section heading only (${pct}% term overlap)`;
      explanation = `The excerpt is only a section title ("${excerpt}") with no explanatory text. ${DISCLAIMER}`;
    } else if (missingCritical.length > 0) {
      status = 'unverified_insufficient';
      supportKind = 'weak_overlap';
      statusLabel = `Unverified — insufficient readable source evidence (${pct}% term overlap); answer states terms not found in the cited text: ${missingCritical.slice(0, 4).join(', ')}`;
      explanation = `The answer contains numbers or command flags that do not appear in the cited chunk. ${DISCLAIMER}`;
    } else if (lexicalOverlap >= STRONG_OVERLAP_THRESHOLD && unsupportedClaims.length === 0) {
      status = 'strong_overlap';
      supportKind = 'strong_overlap';
      statusLabel = `Strong term overlap with cited text (${pct}%) — not a correctness check`;
      explanation = `${excerptCov.matched.length} of ${answerTerms.length} answer terms appear in the excerpt from ${chunk.documentTitle}${chunk.pageOrSlide ? ` (page ${chunk.pageOrSlide})` : ''}. ${DISCLAIMER}`;
    } else if (lexicalOverlap >= PARTIAL_OVERLAP_THRESHOLD) {
      status = 'partial_overlap';
      supportKind = 'partial_overlap';
      statusLabel = `Partial term overlap with cited text (${pct}%) — some statements unconfirmed`;
      explanation = unsupportedClaims.length > 0
        ? `These statements are not covered by the cited text: ${unsupportedClaims.map(c => `"${c.claim}"`).join('; ')}. ${DISCLAIMER}`
        : `Only some answer terms appear in the excerpt. ${DISCLAIMER}`;
    } else {
      status = 'unverified_insufficient';
      supportKind = 'weak_overlap';
      statusLabel = `Unverified — insufficient readable source evidence (${pct}% term overlap)`;
      explanation = `Only ${pct}% of the answer's terms appear in the cited excerpt, below the ${Math.round(PARTIAL_OVERLAP_THRESHOLD * 100)}% needed to call it partially supported. ${DISCLAIMER}`;
    }

    return {
      citation: {
        ...citation,
        pageOrSlide: chunk.pageOrSlide ?? citation.pageOrSlide,
        documentTitle: chunk.documentTitle ?? citation.documentTitle,
        excerpt,
        lexicalOverlap,
        supportKind,
        unmatchedTerms: Array.from(new Set([...missingCritical, ...excerptCov.unmatched])).slice(0, 8)
      },
      status,
      statusLabel,
      lexicalOverlap,
      evidenceScore: lexicalOverlap,
      chunkOverlap,
      matchedKeywords: excerptCov.matched.slice(0, 6),
      isReadableSource: true,
      explanation,
      claimChecks
    };
  }
}
