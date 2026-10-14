/**
 * Turns the model's raw JSON into a StructuredTutorResponse WITHOUT trusting it.
 *
 * - The model's self-reported confidence is ignored (it is not even requested).
 * - Only chunks that were actually retrieved can be cited; invented chunk ids are dropped.
 * - A quote is shown only if it really appears in the cited chunk; otherwise the best-matching
 *   sentences are copied from the chunk itself.
 * - Each answer sentence is checked against the cited text; unsupported ones are listed, and an
 *   answer with no supported statement becomes an honest refusal.
 *
 * Kept free of SDK imports so it can be unit-tested without network access or API keys.
 */

import { Chunk, ChunkCitation, StructuredTutorResponse, SupportStatus } from '../types';
import { GroundingVerifier, checkClaims, excerptIsFromChunk, selectSupportingExcerpt } from '../services/groundingVerifier';
import { tokenize } from '../services/ragEngine';

export function buildTutorResponse(parsed: any, query: string, retrievedChunks: Chunk[]): StructuredTutorResponse {
  parsed = parsed || {};
  const rawSupportStatus = (parsed.support_status as SupportStatus) || 'supported';
  const modelSaysUnsupported = rawSupportStatus === 'unsupported' || Boolean(parsed.isRefusal);
  const INSUFFICIENT = 'The uploaded course material does not provide enough evidence to answer this question.';

  const refuse = (reason: string): StructuredTutorResponse => ({
    answer: INSUFFICIENT,
    support_status: 'unsupported',
    citations: [],
    relevant_excerpt: '',
    isRefusal: true,
    refusalReason: reason,
    suggestedFollowUps: parsed.suggestedFollowUps || []
  });

  if (modelSaysUnsupported) {
    return refuse(parsed.refusalReason || 'Insufficient source evidence in uploaded course materials.');
  }

  const answerText: string = String(parsed.answer || '');

  // Only chunks we actually retrieved can be cited; ids invented by the model are dropped.
  const citedIds: string[] = Array.from(new Set((parsed.citedChunkIds || []) as string[]));
  const citedChunks = citedIds
    .map(id => retrievedChunks.find(c => c.id === id))
    .filter(Boolean) as Chunk[];

  if (!answerText.trim() || citedChunks.length === 0) {
    return refuse('The model did not cite any retrieved passage, so no source support can be shown.');
  }

  const queryTerms = Array.from(new Set(tokenize(query)));
  const quotes: { chunkId: string; quote: string }[] = Array.isArray(parsed.supportingQuotes) ? parsed.supportingQuotes : [];

  const citations: ChunkCitation[] = citedChunks.map(chunk => {
    // Use the model's quote only if it really appears in the chunk; otherwise copy the best
    // matching sentences from the chunk ourselves. We never show unverified quoted text.
    const modelQuote = quotes.find(q => q.chunkId === chunk.id)?.quote || '';
    const excerpt = excerptIsFromChunk(modelQuote, chunk.text)
      ? modelQuote.trim()
      : selectSupportingExcerpt(chunk.text, answerText, { maxSentences: 3, maxChars: 450 });
    const chunkTerms = new Set(tokenize(chunk.text));
    const matched = queryTerms.filter(t => chunkTerms.has(t)).length;
    const base: ChunkCitation = {
      chunkId: chunk.id,
      documentTitle: chunk.documentTitle,
      pageOrSlide: chunk.pageOrSlide,
      timestamp: chunk.timestampStart ? `${chunk.timestampStart}-${chunk.timestampEnd}` : undefined,
      excerpt,
      relevanceScore: queryTerms.length > 0 ? Number((matched / queryTerms.length).toFixed(2)) : undefined
    };
    return GroundingVerifier.verifyCitation(base, chunk, answerText).citation;
  });

  // Statement-by-statement check. The model's own confidence is never used.
  const claimChecks = checkClaims(answerText, citedChunks);
  const unsupportedClaims = claimChecks.filter(c => !c.supported).map(c => c.claim);
  const anySupported = claimChecks.length === 0 ? false : claimChecks.some(c => c.supported);

  if (!anySupported) {
    return refuse('None of the answer\'s statements could be matched to the cited passages.');
  }

  const finalStatus: SupportStatus =
    unsupportedClaims.length > 0 || rawSupportStatus === 'partially_supported' ? 'partially_supported' : 'supported';

  return {
    answer: answerText,
    support_status: finalStatus,
    citations,
    relevant_excerpt: citations[0]?.excerpt || '',
    isRefusal: false,
    suggestedFollowUps: parsed.suggestedFollowUps || [],
    unsupportedClaims
  };
}
