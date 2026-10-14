/**
 * Phase 2 regression tests: truthful answers, honest citations, no fabricated scores.
 *
 * These tests build chunks directly (no PDF parsing) so they run without network access.
 * Run with: npx tsx tests/truthfulness.test.ts
 */

import { readFileSync } from 'fs';
import { RagEngine, tokenize } from '../src/services/ragEngine';
import {
  GroundingVerifier,
  checkClaims,
  selectSupportingExcerpt,
  excerptIsFromChunk
} from '../src/services/groundingVerifier';
import { buildTutorResponse } from '../src/server/tutorResponseBuilder';
import { ApiClient } from '../src/services/api';
import { EvaluationLabRunner } from '../src/services/evaluationLab';
import { VERIFIED_QUESTION_BANK } from '../src/services/quizEngine';
import { SAMPLE_DOCUMENTS, LINUX_CA1_DOCUMENT } from '../src/data/sampleCourse';
import { Chunk, ChunkCitation } from '../src/types';

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    failed++;
    const msg = `FAIL: ${name}${detail ? ` - ${detail}` : ''}`;
    errors.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

const mk = (id: string, text: string, page: number, docId = 'doc-a', title = 'Doc A.pdf', course = 'course-1'): Chunk => ({
  id,
  documentId: docId,
  courseId: course,
  documentTitle: title,
  topic: 'T',
  subtopic: 'S',
  pageOrSlide: page,
  text,
  keywords: tokenize(text).slice(0, 8)
});

// A hackathon-style document whose Track D text deliberately differs from the old canned sentence.
const trackDText =
  'Track D: Personalized Tutoring & Adaptive Learning\n\nTrack D asks teams to build a quiz generator that adapts difficulty for secondary school physics students.';
const trackCText =
  'Track C: Contrastive Speech Analytics & Temporal Flaw Grounding\n\nTrack C centers on comparing two spoken recordings to locate timing flaws.';
const psChunks = [mk('c-track-c', trackCText, 2, 'doc-ps', 'Problem Statements.pdf'), mk('c-track-d', trackDText, 2, 'doc-ps', 'Problem Statements.pdf')];

// A Linux-style document whose answer differs from the old canned "ls -la" sentence.
const linuxText =
  '1. Which command displays hidden files?\nAnswer: Run find . -maxdepth 1 -name ".*" to list dotfiles in the current folder.';
const linuxChunks = [mk('c-linux-1', linuxText, 1, 'doc-linux', 'CA1.pdf', 'course-linux')];

async function main() {
  console.log('Running Phase 2 truthfulness tests...\n');

  // ---------------------------------------------------------------------------------------
  console.log('1. Answers come from the document, never from canned text');
  const rag = new RagEngine(psChunks);
  const trackD = rag.evaluateQuerySupport('What is Track D about?');
  assert(trackD.isSupported, 'Track D question is supported by the chunk');
  assert(trackD.answer.includes('quiz generator'), `Answer reflects the document's own Track D text (got "${trackD.answer}")`);
  assert(!trackD.answer.includes('curriculum-aligned'), 'Old canned Track D sentence is not returned');
  assert(psChunks[1].text.includes(trackD.answer), 'Answer is a verbatim substring of the retrieved chunk');
  assert(trackD.citations[0]?.chunkId === 'c-track-d' && trackD.citations[0]?.pageOrSlide === 2, 'Citation keeps real chunk id and page 2');

  const linuxRes = new RagEngine(linuxChunks).evaluateQuerySupport('Which command displays hidden files?');
  assert(linuxRes.isSupported, 'Linux question is supported');
  assert(linuxRes.answer.includes('find .') && !linuxRes.answer.includes('ls -la'), `Linux answer comes from the document, not a canned "ls -la" (got "${linuxRes.answer}")`);

  const ragSource = readFileSync(new URL('../src/services/ragEngine.ts', import.meta.url), 'utf8');
  assert(!/conciseAnswer|curriculum-aligned|Cardiovascular Risk Visualization & Prediction, developing/.test(ragSource), 'ragEngine source contains no canned answer strings');

  // ---------------------------------------------------------------------------------------
  console.log('\n2. Questions the document cannot answer are refused honestly');
  const ml = rag.evaluateQuerySupport('Explain gradient descent and learning rate decay');
  assert(!ml.isSupported && ml.support_status === 'unsupported', 'Gradient descent question on a tracks-only document is unsupported');
  assert(ml.citations.length === 0 && ml.relevant_excerpt === '', 'No citation or excerpt is manufactured');
  assert(ml.answer.includes('does not provide enough evidence'), 'Honest insufficient-evidence message');
  assert(ml.confidence === 0 && ml.retrievalRelevance === 0, 'No made-up confidence for refusals');

  const headingOnly = new RagEngine([mk('c-h', 'Track D: Personalized Tutoring & Adaptive Learning', 2)]).evaluateQuerySupport('What is Track D about?');
  assert(!headingOnly.isSupported && headingOnly.citations.length === 0, 'A chunk that is only a heading cannot produce a supported answer');

  // ---------------------------------------------------------------------------------------
  console.log('\n3. Scores are measured, never invented');
  const qTerms = Array.from(new Set(tokenize('What is Track D about?')));
  const chunkTerms = new Set(tokenize(psChunks[1].text));
  const expectedRelevance = Number((qTerms.filter(t => chunkTerms.has(t)).length / qTerms.length).toFixed(2));
  assert(trackD.citations[0].relevanceScore === expectedRelevance, `relevanceScore equals measured question-term coverage (${expectedRelevance})`);
  assert(trackD.citations[0].lexicalOverlap === undefined, 'A direct quote carries no lexical-overlap score');
  assert(trackD.citations[0].supportKind === 'direct_quote', 'Direct quote is labelled as such, not as "verified"');
  assert(![0.85, 0.88, 0.95, 0.98, 1].includes(trackD.citations[0].relevanceScore as number) || expectedRelevance === 1, 'No hardcoded score constants leak into citations');

  const guarded = [
    'src/services/ragEngine.ts', 'src/server/geminiService.ts', 'src/server/tutorResponseBuilder.ts',
    'src/services/api.ts', 'src/services/groundingVerifier.ts', 'src/services/quizEngine.ts',
    'src/services/evaluationLab.ts', 'src/components/common/CitationDrawer.tsx', 'src/App.tsx'
  ];
  const fakeScore = /(?:relevanceScore|evidenceConfidence|confidence)\s*[:=]\s*(?:[\w.?\s]*\?\?\s*)?[01]?\.\d+/;
  const offenders = guarded.filter(f => fakeScore.test(readFileSync(new URL('../' + f, import.meta.url), 'utf8')));
  assert(offenders.length === 0, 'No hardcoded confidence/relevance literals in the guarded source files', offenders.join(', '));
  const wholeSource = guarded.map(f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
  assert(!/Verified Grounded|Verified Source Grounding|BM25 Verified/.test(wholeSource), 'Misleading "Verified ..." labels are gone');

  // ---------------------------------------------------------------------------------------
  console.log('\n4. Verifier measures overlap and says so');
  const gdText = 'Gradient descent computes parameter updates by taking steps proportional to the negative gradient of the loss function.';
  const gd = mk('c-gd', gdText, 3);
  const baseCit: ChunkCitation = { chunkId: 'c-gd', documentTitle: 'Doc A.pdf', pageOrSlide: 3, excerpt: gdText };
  const strong = GroundingVerifier.verifyCitation(baseCit, gd, 'Gradient descent updates parameters along the negative gradient of the loss function.');
  assert(strong.status === 'strong_overlap', 'Well-overlapping answer is reported as strong term overlap');
  assert(/not a correctness check/.test(strong.statusLabel) && !/verified/i.test(strong.statusLabel.replace(/unverified/gi, '')), 'Label states it is not a correctness check and never says "verified"');
  assert(strong.citation.relevanceScore === undefined, 'Verifier does not overwrite retrieval relevance with its own score');
  assert(strong.lexicalOverlap === strong.citation.lexicalOverlap, 'Overlap reported once, consistently');

  const fabricated = GroundingVerifier.verifyCitation({ ...baseCit, excerpt: 'Gradient descent was invented by Cauchy in 1847 and always converges.' }, gd, 'Gradient descent updates parameters along the negative gradient.');
  assert(excerptIsFromChunk(fabricated.citation.excerpt, gd.text), 'A fabricated excerpt is replaced by real text from the chunk');
  assert(!fabricated.citation.excerpt.includes('Cauchy'), 'Fabricated quotation is never displayed');

  const wrongNumber = GroundingVerifier.verifyCitation(
    { chunkId: 'c-tail', documentTitle: 'CA1.pdf', pageOrSlide: 1, excerpt: 'tail -n 10 filename displays the last 10 lines of the specified file.' },
    mk('c-tail', 'tail -n 10 filename displays the last 10 lines of the specified file.', 1),
    'tail -n 20 filename displays the last 20 lines of the file.'
  );
  assert(wrongNumber.status === 'unverified_insufficient', 'An answer stating a number the source does not contain is not supported');
  assert((wrongNumber.citation.unmatchedTerms || []).includes('20'), 'The unmatched number is reported to the user');

  const twoClaims = checkClaims(
    'Gradient descent updates parameters along the negative gradient of the loss function. The Byzantine Empire fell to Ottoman artillery.',
    [gd]
  );
  assert(twoClaims.length === 2 && twoClaims[0].supported && !twoClaims[1].supported, 'Each sentence is checked separately; the unrelated one is flagged');
  const mixed = GroundingVerifier.verifyCitation(baseCit, gd, 'Gradient descent updates parameters along the negative gradient of the loss function. The Byzantine Empire fell to Ottoman artillery.');
  assert(mixed.status !== 'strong_overlap', 'An answer with an unsupported sentence is never rated strong');

  // ---------------------------------------------------------------------------------------
  console.log('\n5. Excerpts are the relevant real sentences, not the first 200 characters');
  const longChunk = 'Introduction paragraph about general course logistics and grading policy that goes on for a while to pad the start of the chunk. ' +
    'Office hours are held on Fridays in room 12. The vanishing gradient problem makes early layers learn slowly because derivatives shrink exponentially. ' +
    'Final remarks mention the library opening times and exam registration deadlines.';
  const ex = selectSupportingExcerpt(longChunk, 'Why do early layers learn slowly with vanishing gradients?');
  assert(ex.includes('vanishing gradient problem') && !ex.includes('Introduction paragraph'), `Excerpt is the sentence that answers the question (got "${ex}")`);
  assert(excerptIsFromChunk(ex, longChunk), 'Excerpt is verbatim text from the chunk');

  // ---------------------------------------------------------------------------------------
  console.log('\n6. Model output is never trusted (Gemini response handling)');
  const retrieved = [mk('c-gd', gdText, 3), mk('c-other', 'Office hours are on Fridays in room twelve.', 5)];
  const q = 'How does gradient descent update parameters?';

  const goodModel = buildTutorResponse({
    support_status: 'supported',
    answer: 'Gradient descent updates parameters along the negative gradient of the loss function.',
    relevant_excerpt: 'x', citedChunkIds: ['c-gd'],
    supportingQuotes: [{ chunkId: 'c-gd', quote: 'steps proportional to the negative gradient of the loss function' }],
    evidenceConfidence: 0.99, suggestedFollowUps: ['Why?']
  }, q, retrieved);
  assert(!goodModel.isRefusal && goodModel.citations.length === 1, 'Well-supported model answer keeps one real citation');
  assert(goodModel.evidenceConfidence === undefined, 'Model self-reported confidence (0.99) is ignored');
  assert(goodModel.citations[0].excerpt === 'steps proportional to the negative gradient of the loss function', 'Model quote is used only because it really appears in the chunk');
  assert(goodModel.citations[0].pageOrSlide === 3 && goodModel.citations[0].chunkId === 'c-gd', 'Page and chunk id come from the retrieved chunk');

  const badQuote = buildTutorResponse({
    support_status: 'supported', answer: 'Gradient descent updates parameters along the negative gradient of the loss function.',
    relevant_excerpt: '', citedChunkIds: ['c-gd'], supportingQuotes: [{ chunkId: 'c-gd', quote: 'Gradient descent always finds the global minimum.' }]
  }, q, retrieved);
  assert(!badQuote.citations[0].excerpt.includes('global minimum') && excerptIsFromChunk(badQuote.citations[0].excerpt, gdText), 'A quote the model invented is replaced with real chunk text');

  const invented = buildTutorResponse({
    support_status: 'supported', answer: 'Gradient descent updates parameters along the negative gradient.', relevant_excerpt: '', citedChunkIds: ['chk-does-not-exist']
  }, q, retrieved);
  assert(invented.isRefusal && invented.citations.length === 0, 'A citation to a chunk that was never retrieved is dropped, leaving an honest refusal');

  const wrongChunk = buildTutorResponse({
    support_status: 'supported', answer: 'Gradient descent updates parameters along the negative gradient of the loss function.', relevant_excerpt: '', citedChunkIds: ['c-other']
  }, q, retrieved);
  assert(wrongChunk.isRefusal, 'Citing a chunk that does not contain the answer produces a refusal, not a misleading citation');

  const partial = buildTutorResponse({
    support_status: 'supported',
    answer: 'Gradient descent updates parameters along the negative gradient of the loss function. It was invented in 1847 by Cauchy.',
    relevant_excerpt: '', citedChunkIds: ['c-gd']
  }, q, retrieved);
  assert(partial.support_status === 'partially_supported' && (partial.unsupportedClaims || []).some(c => c.includes('Cauchy')), 'Unsupported extra statement is labelled, answer marked partially supported');

  const refusal = buildTutorResponse({ support_status: 'unsupported', isRefusal: true, answer: 'x', citedChunkIds: ['c-gd'] }, q, retrieved);
  assert(refusal.isRefusal && refusal.citations.length === 0, 'Model refusal yields no citations');

  // ---------------------------------------------------------------------------------------
  console.log('\n7. Client re-checks server citations (mocked network)');
  const realFetch = globalThis.fetch;
  const withServer = (chatBody: any | Error) => {
    (globalThis as any).fetch = async (url: string) => {
      if (String(url).includes('/api/health')) return { ok: true, json: async () => ({ status: 'ok', hasGeminiKey: true, model: 'x', version: '1' }) };
      if (chatBody instanceof Error) throw chatBody;
      return { ok: true, json: async () => chatBody };
    };
  };
  try {
    const answer = 'Gradient descent updates parameters along the negative gradient of the loss function.';
    const asked = 'How does gradient descent update parameters?';

    withServer({ status: 'success', support_status: 'supported', answer, citations: [{ chunkId: 'c-gd', documentTitle: 'Doc A.pdf', pageOrSlide: 3, excerpt: 'made up text', relevanceScore: 0.99 }], suggestedFollowUps: [] });
    const ok = await new ApiClient().askTutor(asked, 'course-1', retrieved, 'intermediate', []);
    assert(!ok.isRefusal && ok.citations?.length === 1, 'Valid server citation is kept');
    assert(excerptIsFromChunk(ok.citations![0].excerpt, gdText), 'Client replaces the server\'s made-up excerpt with real chunk text');
    assert(ok.evidenceConfidence === undefined, 'No confidence value is attached to the message');
    assert(ok.citations![0].pageOrSlide === 3, 'Real page number preserved');

    withServer({ status: 'success', support_status: 'supported', answer, citations: [{ chunkId: 'ghost', documentTitle: 'Ghost.pdf', pageOrSlide: 9, excerpt: 'nothing' }] });
    const ghost = await new ApiClient().askTutor(asked, 'course-1', retrieved, 'intermediate', []);
    assert(Boolean(ghost.isRefusal) && (ghost.citations || []).length === 0, 'Citation to a chunk outside the retrieved set is rejected');

    withServer({ status: 'success', support_status: 'supported', answer }); // no citations at all
    const none = await new ApiClient().askTutor(asked, 'course-1', retrieved, 'intermediate', []);
    assert(Boolean(none.isRefusal), 'Answer without citations is not presented as supported (no local citation is substituted)');

    withServer({ status: 'fallback', message: 'down' });
    const fb = await new ApiClient().askTutor(asked, 'course-1', retrieved, 'intermediate', []);
    assert(fb.retrievalMode === 'deterministic-bm25' && !fb.isRefusal, 'Server fallback signal gives the local extractive answer');
    assert(gdText.includes(fb.content), 'Fallback answer is verbatim document text');
    assert(fb.evidenceConfidence === undefined, 'Fallback message carries no confidence value');

    withServer(new Error('network down'));
    const net = await new ApiClient().askTutor(asked, 'course-1', retrieved, 'intermediate', []);
    assert(net.retrievalMode === 'deterministic-bm25', 'Network failure falls back to the local extractive answer');
  } finally {
    globalThis.fetch = realFetch;
  }

  // ---------------------------------------------------------------------------------------
  console.log('\n8. Evaluation lab reports "not applicable" instead of perfect scores');
  const lab = new EvaluationLabRunner();
  const refCase = lab.evaluateSingleCase({ id: 'r1', category: 'unsupported-refusal', question: 'How do you configure BGP routing on Cisco IOS?', targetChunkIds: [], referenceAnswer: '', expectedRefusal: true, difficulty: 'easy' });
  assert(refCase.passed && refCase.contextPrecision === null && refCase.contextRecall === null, 'Refusal case: retrieval metrics are null, not 1.0');
  assert(refCase.faithfulness === null && refCase.answerRelevancy === null && refCase.citationAccuracy === null, 'Refusal case: faithfulness/relevancy/citation accuracy are null, not 1.0/0.95');
  const run = await lab.runBenchmarkSuite();
  const supportedResults = run.results.filter(r => !r.expectedRefusal && r.faithfulness !== null);
  const manualAvg = supportedResults.reduce((a, r) => a + (r.faithfulness as number), 0) / supportedResults.length;
  assert(Math.abs((run.averageFaithfulness as number) - manualAvg) < 0.001, 'Average faithfulness excludes not-applicable refusal cases');
  assert(!/gemini/i.test(run.modelUsed), 'Evaluation run no longer claims a Gemini model was used');

  // ---------------------------------------------------------------------------------------
  console.log('\n9. Quiz source references are real and unscored');
  const sampleChunks = [...SAMPLE_DOCUMENTS, LINUX_CA1_DOCUMENT].flatMap(d => d.chunks);
  const quizProblems: string[] = [];
  for (const item of VERIFIED_QUESTION_BANK) {
    for (const c of item.sourceCitations) {
      const ch = sampleChunks.find(x => x.id === c.chunkId);
      if (!ch) { quizProblems.push(`${item.id}: chunk ${c.chunkId} missing`); continue; }
      if ((c as any).relevanceScore !== undefined) quizProblems.push(`${item.id}: has a hardcoded score`);
      if (ch.documentTitle !== c.documentTitle) quizProblems.push(`${item.id}: title mismatch`);
      if (ch.pageOrSlide !== c.pageOrSlide) quizProblems.push(`${item.id}: page mismatch`);
      if (!excerptIsFromChunk(c.excerpt, ch.text)) quizProblems.push(`${item.id}: excerpt not verbatim`);
    }
  }
  assert(quizProblems.length === 0, 'Every quiz citation points at a real chunk, matching title/page, with a verbatim excerpt and no score', quizProblems.join('; '));

  return { passed, failed, errors };
}

main().then(res => {
  console.log(`\nTruthfulness Suite Complete: ${res.passed} passed, ${res.failed} failed.`);
  if (res.errors.length > 0) {
    console.error('Errors:', res.errors);
    process.exit(1);
  }
});
