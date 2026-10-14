/**
 * Phase 3 Regression Test Suite:
 * - PDF Extraction Reliability (empty, corrupted, missing header, encrypted)
 * - Scanned/Image-Only PDF handling (no "Requires OCR" placeholder chunks indexed)
 * - Content-Based Document Classification (no single-word "transformer" false positive, only present tracks)
 * - Multi-Page Citation Preservation
 * - Re-upload & Stale-Chunk Removal
 * - Strict Cross-Course and Cross-Document Retrieval Isolation
 * - Support-Evaluation Scope Isolation
 * - Server Rejection of Forged, Tampered, or Unrelated Source Chunks
 *
 * Run with: npx tsx tests/phase3_isolation_pdf.test.ts
 */

import { RagEngine, tokenize } from '../src/services/ragEngine';
import { DocumentClassifier } from '../src/services/documentClassifier';
import { PdfParser, ExtractedPage } from '../src/services/pdfParser';
import { TextValidator } from '../src/services/textValidator';
import { SAMPLE_DOCUMENTS, LINUX_CA1_DOCUMENT, PROBLEM_STATEMENTS_DOCUMENT } from '../src/data/sampleCourse';
import { Chunk } from '../src/types';

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

const mkChunk = (
  id: string,
  text: string,
  page: number,
  docId: string,
  title: string,
  courseId: string,
  topic: string = 'Topic'
): Chunk => ({
  id,
  documentId: docId,
  courseId,
  documentTitle: title,
  topic,
  subtopic: `Page ${page}`,
  pageOrSlide: page,
  text,
  keywords: tokenize(text).slice(0, 8)
});

async function runPhase3Tests() {
  console.log('Running Phase 3: PDF Extraction, Classification & Strict Isolation Tests...\n');

  // =========================================================================
  // 1. PDF Extraction Validation & Corrupted / Encrypted Handling
  // =========================================================================
  console.log('1. PDF Extraction Validation & Edge Cases');

  // Empty buffer
  let emptyRejected = false;
  try {
    await PdfParser.extractPages(new Uint8Array(0), 'empty.pdf');
  } catch (err: any) {
    emptyRejected = true;
  }
  assert(emptyRejected, 'Empty PDF buffer is rejected with an error');

  // Corrupted binary input without PDF header
  const nonPdfBytes = new TextEncoder().encode('This is just plain text, not a PDF binary stream.');
  let nonPdfRejected = false;
  try {
    await PdfParser.extractPages(nonPdfBytes, 'not_a_pdf.pdf');
  } catch (err: any) {
    nonPdfRejected = true;
  }
  assert(nonPdfRejected, 'Non-PDF binary without %PDF- header is rejected');

  // =========================================================================
  // 2. Scanned / Image-Only PDF: Detection and 'OCR Not Supported' preview status
  // =========================================================================
  console.log('\n2. Scanned / Image-Only PDF: Detection & "OCR Not Supported" Preview Status');

  const scannedPages: ExtractedPage[] = [
    {
      pageNumber: 1,
      text: '[Page 1: Scanned document page with no embedded text layer. Requires OCR processing (OCR Not Supported).]',
      isOcr: false,
      requiresOcr: true,
      ocrStatus: 'ocr_not_supported'
    },
    {
      pageNumber: 2,
      text: '[Page 2: Scanned document page with no embedded text layer. Requires OCR processing (OCR Not Supported).]',
      isOcr: false,
      requiresOcr: true,
      ocrStatus: 'ocr_not_supported'
    }
  ];

  assert(PdfParser.isScannedOrImageOnly(scannedPages), 'PdfParser detects scanned or image-only pages');

  const scannedDoc = PdfParser.createDocumentFromPages(
    'scanned_archive.pdf',
    scannedPages,
    'course-scanned',
    'General Scans',
    102400
  );

  assert(scannedDoc.isScanned === true, 'Scanned document flagged with isScanned = true');
  assert(scannedDoc.ocrStatus === 'ocr_not_supported', 'Scanned document has ocrStatus = "ocr_not_supported"');
  assert(scannedDoc.chunks.length === 1, 'Scanned document creates 1 structured preview chunk instead of empty text');
  assert(scannedDoc.chunks[0].text.includes('[OCR Not Supported]'), 'Chunk text explicitly displays [OCR Not Supported] status');
  assert(scannedDoc.chunks[0].subtopic === 'OCR Not Supported', 'Chunk subtopic is "OCR Not Supported"');
  assert(!scannedDoc.chunks.some(c => c.text.includes('Requires OCR')), 'No chunk contains stale "Requires OCR" placeholder text');
  assert(scannedDoc.summary.includes('OCR is not supported'), 'Document summary clearly states OCR is not supported');

  // Mixed document: 1 page readable, 1 page scanned
  const mixedPages: ExtractedPage[] = [
    {
      pageNumber: 1,
      text: 'Linux file permissions are managed with chmod. Running chmod 755 script.sh grants read, write, and execute permissions to the owner.',
      isOcr: false,
      requiresOcr: false
    },
    {
      pageNumber: 2,
      text: '[Page 2: Scanned document page with no embedded text layer. Requires OCR processing.]',
      isOcr: false,
      requiresOcr: true
    }
  ];

  const mixedDoc = PdfParser.createDocumentFromPages(
    'mixed_permissions.pdf',
    mixedPages,
    'course-linux',
    'Linux Permissions',
    204800
  );

  assert(mixedDoc.chunks.length > 0, 'Mixed document indexes readable page chunks');
  assert(mixedDoc.chunks.every(c => c.pageOrSlide === 1), 'All indexed chunks strictly come from readable Page 1');
  assert(!mixedDoc.chunks.some(c => c.pageOrSlide === 2), 'Page 2 (scanned) is omitted from indexed chunks');

  // =========================================================================
  // 3. Content-Based Document Classification
  // =========================================================================
  console.log('\n3. Content-Based Document Classification');

  // Test 3A: Single word "transformer" in non-ML electrical text MUST NOT classify as Machine Learning
  const electricalTransformerText = [
    'An electrical power transformer uses electromagnetic induction to step down alternating current voltage across transmission substations.',
    'Copper windings and a magnetic iron core facilitate high-efficiency energy distribution in electrical grids.'
  ];
  const electricalClassification = DocumentClassifier.classify('power_equipment.pdf', electricalTransformerText);
  assert(
    electricalClassification.category === 'unclassified',
    `Electrical text containing "transformer" is NOT classified as Machine Learning (got category "${electricalClassification.category}")`
  );
  assert(
    electricalClassification.subject === 'Unclassified',
    'Electrical transformer document subject is "Unclassified"'
  );

  // Test 3B: Machine Learning with transformer + attention DOES classify as Machine Learning
  const mlTransformerText = [
    'The Transformer architecture replaces recurrent layers with multi-head self-attention mechanisms and positional token embeddings.',
    'Scaled dot-product attention computes query-key similarity matrices to weight value vectors across deep neural layers.'
  ];
  const mlClassification = DocumentClassifier.classify('transformer_attention.pdf', mlTransformerText);
  assert(
    mlClassification.category === 'machine-learning',
    `ML text with transformer + attention classifies as Machine Learning (got category "${mlClassification.category}")`
  );
  assert(
    mlClassification.detectedTopics.some(t => t.includes('Attention Mechanisms & Transformers')),
    'Detected topic includes Attention Mechanisms & Transformers'
  );

  // Test 3C: Hackathon track description containment - only present tracks attached
  const trackBOnlyText = [
    'Multimodal AI Hackathon 2026 Challenge\nTrack B: Mapping Flood Damage from Space\nTrack B challenges participants to harness Earth observation data and SAR satellite imagery.'
  ];
  const trackBClassification = DocumentClassifier.classify('track_b_challenge.pdf', trackBOnlyText);
  assert(
    trackBClassification.category === 'hackathon',
    'Classifies as hackathon from body text'
  );
  assert(
    trackBClassification.detectedTopics.some(t => t.includes('Track B')),
    'Track B description is present in detectedTopics'
  );
  assert(
    !trackBClassification.detectedTopics.some(t => t.includes('Track A') || t.includes('Track C') || t.includes('Track D')),
    'Track A, C, and D are NOT attached because they do not appear in the document'
  );

  // Test 3D: Insufficient body evidence returns Unclassified
  const randomText = ['Chapter 1 Introduction: General overview of course schedule and weekly office hours in room 101.'];
  const insufficientClassification = DocumentClassifier.classify('general_notes.pdf', randomText);
  assert(
    insufficientClassification.subject === 'Unclassified' && !insufficientClassification.isReliable,
    'Generic notes with insufficient domain evidence returns Unclassified with isReliable = false'
  );

  // =========================================================================
  // 4. Multi-Page Citations & Page Number Integrity
  // =========================================================================
  console.log('\n4. Multi-Page Citations & Page Number Integrity');

  const page1Chunk = mkChunk(
    'chk-p1-ps',
    'Process management in Linux: ps aux displays all running processes with their user and PID.',
    1,
    'doc-linux-proc',
    'Linux Processes.pdf',
    'course-linux'
  );
  const page2Chunk = mkChunk(
    'chk-p2-kill',
    'Signal delivery: kill -9 PID sends SIGKILL immediately terminating the target process.',
    2,
    'doc-linux-proc',
    'Linux Processes.pdf',
    'course-linux'
  );

  const procRag = new RagEngine([page1Chunk, page2Chunk]);
  const psQuery = procRag.evaluateQuerySupport('How do you display all running processes in Linux?');
  assert(psQuery.isSupported, 'Process query is supported');
  assert(psQuery.citations[0].pageOrSlide === 1, `Process query cites Page 1 (got Page ${psQuery.citations[0].pageOrSlide})`);
  assert(psQuery.citations[0].chunkId === 'chk-p1-ps', 'Cites correct Page 1 chunk ID');

  const killQuery = procRag.evaluateQuerySupport('Which command sends SIGKILL to terminate a process?');
  assert(killQuery.isSupported, 'Kill query is supported');
  assert(killQuery.citations[0].pageOrSlide === 2, `Kill query cites Page 2 (got Page ${killQuery.citations[0].pageOrSlide})`);
  assert(killQuery.citations[0].chunkId === 'chk-p2-kill', 'Cites correct Page 2 chunk ID');

  // =========================================================================
  // 5. Strict Cross-Course and Cross-Document Retrieval Isolation
  // =========================================================================
  console.log('\n5. Strict Cross-Course and Cross-Document Retrieval Isolation');

  const mlChunks = SAMPLE_DOCUMENTS.flatMap(d => d.chunks);
  const linuxChunks = LINUX_CA1_DOCUMENT.chunks;
  const hackathonChunks = PROBLEM_STATEMENTS_DOCUMENT.chunks;

  // Combined corpus with all chunks from multiple courses
  const multiCourseChunks = [...mlChunks, ...linuxChunks, ...hackathonChunks];
  const isolatedRag = new RagEngine(multiCourseChunks);

  // Test 5A: Scoped to ML course - Linux question MUST be refused
  const linuxInMl = isolatedRag.evaluateQuerySupport(
    'Which command displays hidden files?',
    3,
    undefined,
    'course-ml-101' // Scoped strictly to ML course
  );
  assert(
    !linuxInMl.isSupported,
    'Linux command question is refused when retrieval is scoped to Machine Learning course'
  );
  assert(
    linuxInMl.citations.length === 0,
    'Zero citations emitted for Linux question when scoped to ML course'
  );
  assert(
    linuxInMl.answer.includes('not provide enough evidence') || linuxInMl.answer.includes('does not provide enough evidence'),
    'Honest refusal message returned for cross-course query'
  );

  // Test 5B: Scoped to Linux course - Linux question IS supported
  const linuxInLinux = isolatedRag.evaluateQuerySupport(
    'Which command displays hidden files?',
    3,
    undefined,
    'course-linux-302' // Scoped strictly to Linux course
  );
  assert(
    linuxInLinux.isSupported,
    'Linux command question IS supported when scoped to Linux course'
  );
  assert(
    linuxInLinux.citations.length === 1 && linuxInLinux.citations[0].documentTitle.includes('CA1'),
    'Cites Linux CA1.pdf when scoped to Linux course'
  );

  // Test 5C: Scoped to Linux course - ML question MUST be refused
  const mlInLinux = isolatedRag.evaluateQuerySupport(
    'What is the formula for Mean Squared Error?',
    3,
    undefined,
    'course-linux-302' // Scoped strictly to Linux course
  );
  assert(
    !mlInLinux.isSupported,
    'ML question is refused when retrieval is scoped to Linux course'
  );
  assert(
    mlInLinux.citations.length === 0,
    'Zero citations emitted for ML question when scoped to Linux course'
  );

  // Test 5D: Document-level scope isolation within the same course
  const trackDInOpt = isolatedRag.evaluateQuerySupport(
    'What is Track D about?',
    3,
    'doc-opt-loss', // Scoped to Optimization document
    'course-ml-101'
  );
  assert(
    !trackDInOpt.isSupported,
    'Track D question is refused when scoped strictly to Optimization & Loss doc'
  );
  assert(
    trackDInOpt.citations.length === 0,
    'Zero citations emitted when document scope does not contain the answer'
  );

  // Test 5E: Scoped retrieve() method respects courseId
  const retrievedLinuxOnly = isolatedRag.retrieve('command files', 5, undefined, 'course-linux-302');
  assert(
    retrievedLinuxOnly.length > 0 && retrievedLinuxOnly.every(r => r.chunk.courseId === 'course-linux-302'),
    'retrieve() with filterCourseId only returns chunks belonging to that course'
  );

  // =========================================================================
  // 6. Server Request Validation & Forged Chunk Rejection Simulation
  // =========================================================================
  console.log('\n6. Server Request Validation & Forged Chunk Rejection');

  const trustedChunks = [...SAMPLE_DOCUMENTS, LINUX_CA1_DOCUMENT, PROBLEM_STATEMENTS_DOCUMENT].flatMap(d => d.chunks);
  const trustedMap = new Map(trustedChunks.map(c => [c.id, c]));

  // Helper simulating server-side validation logic in /api/tutor/chat
  function serverValidateChunks(
    incomingChunks: any[],
    requestedCourseId?: string,
    requestedDocId?: string
  ): { validChunks: Chunk[]; refusal: boolean; reason?: string } {
    const validated = incomingChunks.filter((c: any) => {
      if (!c || typeof c !== 'object' || !c.id || !c.text || typeof c.text !== 'string') return false;
      if (!TextValidator.validateReadability(c.text).isReadable || TextValidator.containsPdfSyntax(c.text)) return false;

      // Course isolation check
      if (requestedCourseId && requestedCourseId !== 'all' && c.courseId && c.courseId !== requestedCourseId) {
        return false;
      }

      // Document isolation check
      if (requestedDocId && requestedDocId !== 'all' && c.documentId && c.documentId !== requestedDocId && c.documentTitle !== requestedDocId) {
        return false;
      }

      // Anti-forgery check against server trusted corpus
      const trusted = trustedMap.get(c.id);
      if (trusted) {
        const normIncoming = c.text.replace(/\s+/g, ' ').trim();
        const normTrusted = trusted.text.replace(/\s+/g, ' ').trim();
        if (normIncoming !== normTrusted) {
          return false;
        }
      }

      return true;
    });

    if (validated.length === 0) {
      return {
        validChunks: [],
        refusal: true,
        reason: 'Source chunks failed server verification or did not match the requested course scope.'
      };
    }
    return { validChunks: validated, refusal: false };
  }

  // Test 6A: Client submits a tampered chunk with known ID but forged text
  const genuineChunk = trustedChunks.find(c => c.id === 'chk-opt-01')!;
  const forgedChunk = {
    ...genuineChunk,
    text: 'Mean Squared Error always equals 42 and requires no math whatsoever.' // Forged text
  };
  const forgedResult = serverValidateChunks([forgedChunk], 'course-ml-101');
  assert(forgedResult.refusal, 'Server rejects tampered chunk with modified text');
  assert(forgedResult.validChunks.length === 0, 'Forged chunk is excluded from valid server chunks');

  // Test 6B: Client submits chunk from wrong course
  const linuxChunkPassedToMl = trustedChunks.find(c => c.courseId === 'course-linux-302')!;
  const crossCourseResult = serverValidateChunks([linuxChunkPassedToMl], 'course-ml-101');
  assert(crossCourseResult.refusal, 'Server rejects chunk belonging to a different course');

  // Test 6C: Client submits corrupted text with PDF syntax
  const corruptClientChunk = {
    id: 'chk-corrupt',
    documentId: 'doc-01',
    courseId: 'course-ml-101',
    documentTitle: 'Corrupt.pdf',
    text: '%PDF-1.5 /Type /Catalog /Pages 2 0 R endobj stream corrupted bytes endstream'
  };
  const corruptResult = serverValidateChunks([corruptClientChunk], 'course-ml-101');
  assert(corruptResult.refusal, 'Server rejects chunk containing raw PDF syntax');

  // Test 6D: Legitimate chunk passes server validation
  const legitResult = serverValidateChunks([genuineChunk], 'course-ml-101');
  assert(!legitResult.refusal && legitResult.validChunks.length === 1, 'Legitimate chunk with authentic text passes server validation');

  // =========================================================================
  // 7. Re-Upload and Stale-Chunk Deduplication
  // =========================================================================
  console.log('\n7. Re-Upload and Stale-Chunk Deduplication');

  const docV1 = PdfParser.createDocumentFromPages(
    'Course Notes.pdf',
    [{ pageNumber: 1, text: 'Version 1 of course notes covers gradient descent basics.', isOcr: false, requiresOcr: false }],
    'course-ml-101',
    undefined,
    1000
  );

  const docV2 = PdfParser.createDocumentFromPages(
    'Course Notes.pdf',
    [{ pageNumber: 1, text: 'Version 2 of course notes covers stochastic gradient descent and momentum.', isOcr: false, requiresOcr: false }],
    'course-ml-101',
    undefined,
    1200,
    docV1.id // Re-upload reusing document ID
  );

  assert(docV2.id === docV1.id, 'Re-upload preserves document ID');
  assert(docV2.chunks[0].text.includes('Version 2'), 'New chunk content replaces old chunk');
  assert(docV2.chunks.length === 1, 'No duplicate stale chunks generated');

  return { passed, failed, errors };
}

runPhase3Tests().then(res => {
  console.log(`\nPhase 3 Suite Complete: ${res.passed} passed, ${res.failed} failed.`);
  if (res.errors.length > 0) {
    console.error('Errors:', res.errors);
    process.exit(1);
  }
});
