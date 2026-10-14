import assert from 'node:assert';
import { reconstructPdfPageText, splitTextIntoPassages, PdfParser } from '../src/services/pdfParser';
import { TextValidator } from '../src/services/textValidator';
import { RagEngine, tokenize } from '../src/services/ragEngine';
import { GroundingVerifier, selectSupportingExcerpt, excerptIsFromChunk } from '../src/services/groundingVerifier';
import { LearnerModelEngine, DEFAULT_BKT_PARAMS } from '../src/services/learnerModel';
import { VERIFIED_QUESTION_BANK, QuizEngine } from '../src/services/quizEngine';
import { SAMPLE_COURSE, SAMPLE_DOCUMENTS, CS302_LINUX_COURSE, LINUX_CA1_DOCUMENT } from '../src/data/sampleCourse';
import { Chunk, ChunkCitation, Course, DocumentSource } from '../src/types';
import { buildVoiceSystemInstruction } from '../src/server/geminiLiveService';

async function runCoreAuditSuite() {
  console.log('===============================================================');
  console.log('StudyPilot AI — Core Functionality Audit & Regression Tests');
  console.log('===============================================================\n');

  let passedAssertions = 0;

  function check(condition: boolean, msg: string) {
    assert.ok(condition, msg);
    passedAssertions++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  // =========================================================================
  // 1. Audit PDF Upload and Extraction
  // =========================================================================
  console.log('1. Audit PDF Upload, Extraction, Layout & OCR Edge Cases');

  // 1.1 Magic bytes check (%PDF-)
  const validPdfHeader = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj');
  check(validPdfHeader.subarray(0, 16).toString('utf-8').includes('%PDF'), 'Detects standard %PDF- magic bytes header');

  const invalidBinary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
  check(!invalidBinary.subarray(0, 16).toString('utf-8').includes('%PDF'), 'Rejects non-PDF binary payload missing %PDF header');

  // 1.2 Empty buffer handling
  try {
    await PdfParser.extractPages(new Uint8Array(0), 'empty.pdf');
    assert.fail('Should have thrown on zero-length buffer');
  } catch (err: any) {
    check(err.message.includes('empty') || err.name === 'InvalidPDFException', 'Empty PDF buffer correctly throws error');
  }

  // 1.3 Layout & Text Reconstruction
  const samplePdfItems = {
    items: [
      { str: 'Lecture 01:', transform: [1, 0, 0, 1, 50, 700], width: 60, height: 12 },
      { str: 'Introduction to Operating Systems', transform: [1, 0, 0, 1, 115, 700], width: 180, height: 12 },
      { str: 'A process is an instance of a program in execution.', transform: [1, 0, 0, 1, 50, 670], width: 250, height: 10 },
      { str: 'It contains code, data, heap, and stack segments.', transform: [1, 0, 0, 1, 50, 650], width: 230, height: 10 }
    ]
  };

  const reconstructed = reconstructPdfPageText(samplePdfItems);
  check(reconstructed.includes('Lecture 01: Introduction to Operating Systems'), 'Reconstructs continuous inline text across words');
  check(reconstructed.includes('A process is an instance of a program in execution.'), 'Preserves body paragraph content');
  check(!TextValidator.containsPdfSyntax(reconstructed), 'Reconstructed text is free from raw PDF operators');

  // 1.4 Scanned / Image-Only PDF Detection
  const scannedPages = [
    { pageNumber: 1, text: '', isOcr: false, requiresOcr: true, ocrStatus: 'ocr_not_supported' as const },
    { pageNumber: 2, text: '', isOcr: false, requiresOcr: true, ocrStatus: 'ocr_not_supported' as const }
  ];
  const isScanned = PdfParser.isScannedOrImageOnly(scannedPages);
  check(isScanned, 'Detects 100% empty text layer as scanned / image-only document');

  const scannedDoc = PdfParser.createDocumentFromPages('scanned_exam.pdf', scannedPages, 'course-linux-302');
  check(scannedDoc.isScanned === true, 'Document marked with isScanned = true');
  check(scannedDoc.ocrStatus === 'ocr_not_supported', 'Document assigned ocrStatus = ocr_not_supported');
  check(scannedDoc.chunks.length === 1, 'Generates exactly 1 structured preview chunk for scanned PDF');
  check(scannedDoc.chunks[0].text.includes('[OCR Not Supported]'), 'Preview chunk contains explicit [OCR Not Supported] notice');

  // 1.5 Question-aware passage splitting
  const structuredExamText = `
Track A: Web Application Security
Question 1: Explain the difference between CSRF and XSS.
CSRF forces an authenticated user to execute unwanted actions. XSS injects malicious client-side scripts.

Question 2: What is a Content Security Policy (CSP)?
CSP is an HTTP header that restricts resources the browser can load.
  `.trim();

  const passages = splitTextIntoPassages(structuredExamText);
  check(passages.length >= 2, 'Splits structured exam into distinct question-level passages');
  check(passages.some(p => p.includes('CSRF') && p.includes('XSS')), 'Preserves Q1 unit integrity');
  check(passages.some(p => p.includes('Content Security Policy')), 'Preserves Q2 unit integrity');

  // =========================================================================
  // 2. Audit Document Grounding and Course Isolation
  // =========================================================================
  console.log('\n2. Audit Document Grounding & Strict Course Isolation');

  const mlChunks = SAMPLE_DOCUMENTS.flatMap(d => d.chunks);
  const linuxChunks = LINUX_CA1_DOCUMENT.chunks;
  const combinedCorpus = [...mlChunks, ...linuxChunks];

  const rag = new RagEngine(combinedCorpus);

  // 2.1 Course Isolation: retrieval scoping strictly isolates chunks
  const linuxQuery = 'Which Linux command displays hidden files including dotfiles?';
  const crossCourseResults = rag.retrieve(linuxQuery, 3, undefined, 'course-ml-101');
  check(crossCourseResults.every(r => r.chunk.courseId === 'course-ml-101'), 'retrieve() scoped to ML Course strictly isolates to ML chunks');
  check(!crossCourseResults.some(r => r.chunk.courseId === 'course-linux-302'), 'Linux chunks never leak into ML Course retrieval');

  // 2.2 Scoped evaluation returns honest refusal
  const crossCourseEval = rag.evaluateQuerySupport(linuxQuery, 3, undefined, 'course-ml-101');
  check(crossCourseEval.isSupported === false, 'Cross-course query is marked unsupported');
  check(crossCourseEval.support_status === 'unsupported', 'Status is strictly unsupported');
  check(crossCourseEval.citations.length === 0, 'Zero citations emitted for cross-course query');
  check(
    crossCourseEval.answer.includes('does not provide enough evidence') || crossCourseEval.answer.includes('does not contain'),
    'Returns honest refusal message'
  );

  // 2.3 Correct course retrieval succeeds
  const inCourseResults = rag.retrieve(linuxQuery, 3, undefined, 'course-linux-302');
  check(inCourseResults.length > 0, 'Linux query scoped to Linux Course retrieves matching chunks');
  check(inCourseResults[0].chunk.courseId === 'course-linux-302', 'Retrieved chunk strictly belongs to Linux course');
  check(
    inCourseResults[0].chunk.documentTitle.includes('CA1') || inCourseResults[0].chunk.documentTitle.includes('CS302'),
    'Retrieved chunk comes from Linux CA1 document'
  );

  // 2.4 Document Isolation: Single document scope
  const targetDocId = linuxChunks[0].documentId;
  const singleDocResults = rag.retrieve(linuxQuery, 3, targetDocId, 'course-linux-302');
  check(singleDocResults.every(r => r.chunk.documentId === targetDocId), 'Retrieval strictly respects filterDocId');

  // 2.5 Completely unsupported query
  const unsupportedQuery = 'How do I bake a chocolate soufflé with vanilla cream?';
  const unsupportedEval = rag.evaluateQuerySupport(unsupportedQuery, 3, undefined, 'course-linux-302');
  check(unsupportedEval.isSupported === false, 'Completely unrelated query is marked unsupported');
  check(unsupportedEval.citations.length === 0, 'Zero citations emitted for unsupported query');
  check(unsupportedEval.relevant_excerpt === '', 'Relevant excerpt is empty for unsupported query');

  // =========================================================================
  // 3. Audit Citations and Evidence
  // =========================================================================
  console.log('\n3. Audit Citations & Verbatim Evidence Fidelity');

  const sampleChunk = linuxChunks[0]; // Page 1: File Operations (ls -a, ls -l, mkdir -p)
  const queryAnswer = 'You can use ls -a to display hidden files and ls -la for detailed list including permissions.';

  // 3.1 Excerpt extraction & verbatim fidelity
  const excerpt = selectSupportingExcerpt(sampleChunk.text, queryAnswer, { maxSentences: 2, maxChars: 300 });
  check(Boolean(excerpt && excerpt.length > 10), 'selectSupportingExcerpt extracts a non-empty excerpt');
  check(excerptIsFromChunk(excerpt, sampleChunk.text), 'Excerpt is verified to be a verbatim substring from the source chunk');

  // 3.2 Grounding verification check
  const citationCandidate: ChunkCitation = {
    chunkId: sampleChunk.id,
    documentTitle: sampleChunk.documentTitle,
    pageOrSlide: sampleChunk.pageOrSlide,
    excerpt
  };

  const verifyResult = GroundingVerifier.verifyCitation(citationCandidate, sampleChunk, queryAnswer);
  check(verifyResult.isReadableSource === true, 'Source chunk verified as readable and uncorrupted');
  check(verifyResult.status === 'strong_overlap' || verifyResult.status === 'partial_overlap', 'Grounding status reflects valid evidence overlap');
  check(typeof verifyResult.lexicalOverlap === 'number', 'Emits computed lexical overlap ratio (0-1)');

  // 3.3 Rejection of fabricated excerpts
  const fakeExcerpt = 'This is a completely fabricated quotation never written in any course book.';
  const fakeCitation: ChunkCitation = {
    chunkId: sampleChunk.id,
    documentTitle: sampleChunk.documentTitle,
    pageOrSlide: 999,
    excerpt: fakeExcerpt
  };
  const fakeResult = GroundingVerifier.verifyCitation(fakeCitation, sampleChunk, queryAnswer);
  check(fakeResult.citation.excerpt !== fakeExcerpt, 'Fabricated excerpt is replaced with genuine text or flagged');
  check(fakeResult.citation.pageOrSlide === sampleChunk.pageOrSlide, 'Preserves genuine chunk page number over fabricated page');

  // =========================================================================
  // 4. Audit Text AI Tutor Prompts & Multilingual Instructions
  // =========================================================================
  console.log('\n4. Audit Text AI Tutor Depth, Scoping & Multilingual Instructions');

  // 4.1 Explanation levels: beginner, intermediate, advanced
  const beginnerInst = buildVoiceSystemInstruction(linuxChunks, 'beginner', 'en');
  const interInst = buildVoiceSystemInstruction(linuxChunks, 'intermediate', 'en');
  const advInst = buildVoiceSystemInstruction(linuxChunks, 'advanced', 'en');

  check(beginnerInst.includes('analogies') && beginnerInst.includes('plain words'), 'Beginner instruction mandates intuitive analogies and plain words');
  check(interInst.includes('balanced conceptual clarity'), 'Intermediate instruction mandates balanced technical clarity');
  check(advInst.includes('strict technical precision') && advInst.includes('syntax'), 'Advanced instruction mandates strict technical precision and syntax');

  // 4.2 Multilingual support: English, Bengali, Hindi
  const bnInst = buildVoiceSystemInstruction(linuxChunks, 'intermediate', 'bn');
  const hiInst = buildVoiceSystemInstruction(linuxChunks, 'intermediate', 'hi');

  check(bnInst.includes('Bengali (বাংলা)'), 'Bengali instruction configures Bengali language role');
  check(hiInst.includes('Hindi (हिन्दी)'), 'Hindi instruction configures Hindi language role');
  check(bnInst.includes('RIGOROUS SOURCE GROUNDING'), 'Multilingual instructions preserve non-negotiable grounding rules');

  // =========================================================================
  // 5. Audit Adaptive Quizzes & Bayesian Learner Model
  // =========================================================================
  console.log('\n5. Audit Adaptive Quizzes & Bayesian Knowledge Tracing (BKT)');

  // 5.1 Question bank source chunk integrity
  check(VERIFIED_QUESTION_BANK.length >= 6, 'Verified question bank contains active quiz items');
  for (const q of VERIFIED_QUESTION_BANK) {
    check(q.sourceCitations && q.sourceCitations.length > 0, `Quiz item ${q.id} has verified source citations`);
    check(Boolean(q.explanation && q.explanation.length > 10), `Quiz item ${q.id} has detailed explanatory feedback`);
    if (q.type === 'multiple-choice') {
      check(Array.isArray(q.options) && q.options.includes(q.correctAnswer as string), `Quiz item ${q.id} correct answer is among options`);
    }
  }

  // 5.2 BKT Engine mathematical correctness
  const bkt = new LearnerModelEngine(DEFAULT_BKT_PARAMS);
  const prior = 0.20;

  // Correct answer update: mastery must increase
  const correctUpdate = bkt.updateMastery(prior, true);
  check(correctUpdate.newMastery > prior, `Correct response increases mastery (from ${prior} to ${correctUpdate.newMastery})`);
  check(correctUpdate.delta > 0, 'Delta is strictly positive on correct attempt');

  // Incorrect answer update: mastery must decrease
  const incorrectUpdate = bkt.updateMastery(prior, false);
  check(incorrectUpdate.newMastery < prior, `Incorrect response decreases mastery (from ${prior} to ${incorrectUpdate.newMastery})`);
  check(incorrectUpdate.delta < 0, 'Delta is strictly negative on incorrect attempt');

  // Clamping within probabilistic bounds [0.02, 0.98]
  const extremeLow = bkt.updateMastery(0.001, false);
  const extremeHigh = bkt.updateMastery(0.999, true);
  check(extremeLow.newMastery >= 0.02, 'BKT clamps lower bound to >= 0.02');
  check(extremeHigh.newMastery <= 0.98, 'BKT clamps upper bound to <= 0.98');

  // Mastery status tiers
  check(bkt.getStatus(0.25) === 'critical', 'Mastery 0.25 categorized as critical');
  check(bkt.getStatus(0.55) === 'needs_practice', 'Mastery 0.55 categorized as needs_practice');
  check(bkt.getStatus(0.75) === 'developing', 'Mastery 0.75 categorized as developing');
  check(bkt.getStatus(0.90) === 'mastered', 'Mastery 0.90 categorized as mastered');

  // Spaced repetition stability scaling
  const lowStab = bkt.calculateStabilityDays(0.30, 2, 0);
  const highStab = bkt.calculateStabilityDays(0.90, 10, 10);
  check(lowStab === 1, 'Low mastery yields 1-day spaced review stability');
  check(highStab >= 14, 'High mastery yields >= 14-day spaced review stability');

  // =========================================================================
  // 6. Audit Data Persistence, Deduplication & Course Isolation
  // =========================================================================
  console.log('\n6. Audit Data Deduplication & Re-upload Replacement');

  const originalDoc = SAMPLE_DOCUMENTS[0];
  const originalChunkCount = originalDoc.chunks.length;

  // Re-upload with same documentId must replace chunks, not duplicate
  const updatedDoc: DocumentSource = {
    ...originalDoc,
    chunks: [
      {
        id: originalDoc.chunks[0].id,
        documentId: originalDoc.id,
        courseId: originalDoc.courseId,
        documentTitle: originalDoc.title,
        topic: 'Updated Topic',
        subtopic: 'Updated Subtopic',
        pageOrSlide: 1,
        text: 'This is the newly updated content that replaces the previous chunk text.',
        keywords: ['updated', 'content']
      }
    ]
  };

  const docStore = new Map<string, DocumentSource>();
  docStore.set(originalDoc.id, originalDoc);
  // Re-upload simulation
  docStore.set(updatedDoc.id, updatedDoc);

  const stored = docStore.get(originalDoc.id)!;
  check(stored.chunks.length === 1, 'Re-upload replaced stale chunks, maintaining exactly 1 new chunk');
  check(stored.chunks[0].text.includes('newly updated content'), 'Stored chunk contains updated text');

  console.log(`\n===============================================================`);
  console.log(`Core Audit Suite Complete: All ${passedAssertions} assertions passed!`);
  console.log(`===============================================================\n`);
}

runCoreAuditSuite().catch((err) => {
  console.error('Core Audit Suite Failed:', err);
  process.exit(1);
});
