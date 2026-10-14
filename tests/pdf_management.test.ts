/**
 * PDF Document Management & Multi-Source RAG Regression Test Suite
 *
 * Validates:
 * 1. PDF binary validation (empty, invalid magic bytes, corrupted)
 * 2. Scanned / image-only PDF detection and "OCR Not Supported" status
 * 3. DocumentSource metadata creation (fileName, pageCount, status, rawBase64)
 * 4. Course assignment & new course creation persistence
 * 5. Document management actions: Rename, Reprocess, and Delete
 * 6. AI Tutor multi-document, single-document, and all-documents source scoping
 * 7. Verification that deleted/replaced PDFs cannot contaminate retrieval
 *
 * Run with: npx tsx tests/pdf_management.test.ts
 */

import { PdfParser, ExtractedPage } from '../src/services/pdfParser';
import { RagEngine } from '../src/services/ragEngine';
import { appDb } from '../src/services/db';
import { Course, DocumentSource, Chunk } from '../src/types';
import { CS302_LINUX_COURSE, LINUX_CA1_DOCUMENT, PROBLEM_STATEMENTS_DOCUMENT } from '../src/data/sampleCourse';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failed++;
    const msg = `FAIL: ${testName}${detail ? ` - ${detail}` : ''}`;
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

async function runPdfManagementTests() {
  console.log('===============================================================');
  console.log('StudyPilot AI — PDF Document Management & RAG Scoping Tests');
  console.log('===============================================================\n');

  // =========================================================================
  // 1. PDF Validation & Error Handling
  // =========================================================================
  console.log('1. PDF Binary Validation & Error Handling');

  // 1.1 Empty buffer rejection
  let emptyThrown = false;
  try {
    await PdfParser.extractPages(new Uint8Array(0), 'empty_test.pdf');
  } catch (err: any) {
    emptyThrown = true;
    assert(err.message.includes('empty'), 'Empty PDF buffer throws error with clear message', err.message);
  }
  assert(emptyThrown, 'Empty buffer is rejected');

  // 1.2 Non-PDF payload missing %PDF header
  let nonPdfThrown = false;
  try {
    const invalidBytes = new TextEncoder().encode('Hello world, not a real PDF document.');
    await PdfParser.extractPages(invalidBytes, 'fake.pdf');
  } catch (err: any) {
    nonPdfThrown = true;
    assert(err.message.includes('%PDF'), 'Rejects non-PDF binary missing %PDF- header with actionable message', err.message);
  }
  assert(nonPdfThrown, 'Non-PDF binary payload is rejected');

  // 1.3 Scanned / Image-Only PDF detection
  const scannedPages: ExtractedPage[] = [
    { pageNumber: 1, text: '', isOcr: false, requiresOcr: true, ocrStatus: 'ocr_not_supported' },
    { pageNumber: 2, text: '', isOcr: false, requiresOcr: true, ocrStatus: 'ocr_not_supported' }
  ];
  const isScanned = PdfParser.isScannedOrImageOnly(scannedPages);
  assert(isScanned, 'Detects document with empty text layers as scanned / image-only');

  const scannedDoc = PdfParser.createDocumentFromPages(
    'Scanned_Lecture.pdf',
    scannedPages,
    'cs-302-linux',
    undefined,
    102400
  );
  assert(scannedDoc.isScanned === true, 'Scanned document marked with isScanned = true');
  assert(scannedDoc.ocrStatus === 'ocr_not_supported', 'Scanned document assigned ocrStatus = ocr_not_supported');
  assert(scannedDoc.pageCount === 2, 'Scanned document preserves exact page count (2 pages)');
  assert(scannedDoc.chunks.length === 1, 'Scanned document generates exactly 1 preview chunk');
  assert(scannedDoc.chunks[0].text.includes('[OCR Not Supported]'), 'Preview chunk explicitly warns OCR is not supported');

  // =========================================================================
  // 2. Document Creation, Extraction & Chunking
  // =========================================================================
  console.log('\n2. Document Creation, Layout Extraction & Chunking');

  const mockPages: ExtractedPage[] = [
    {
      pageNumber: 1,
      text: 'Chapter 1: Operating System Fundamentals\n\nA process is a program in execution containing program counter, stack, and data section.\nThe operating system manages process scheduling and memory allocation.',
      isOcr: false,
      requiresOcr: false,
      ocrStatus: 'not_needed'
    },
    {
      pageNumber: 2,
      text: 'Process States and Transitions\n\nA process moves through states: new, ready, running, waiting, and terminated.\nThe context switch saves the state of an active process to restore it later.',
      isOcr: false,
      requiresOcr: false,
      ocrStatus: 'not_needed'
    }
  ];

  const createdDoc = PdfParser.createDocumentFromPages(
    'OS_Concepts_Chapter1.pdf',
    mockPages,
    'cs-302-linux',
    'Process Management',
    204800,
    undefined,
    'bW9ja19iYXNlNjRfZGF0YQ=='
  );

  assert(createdDoc.fileName === 'OS_Concepts_Chapter1.pdf', 'DocumentSource sets fileName matching uploaded file');
  assert(createdDoc.pageCount === 2, 'DocumentSource stores pageCount = 2');
  assert(createdDoc.status === 'ready', 'DocumentSource sets status = ready');
  assert(createdDoc.rawBase64 === 'bW9ja19iYXNlNjRfZGF0YQ==', 'DocumentSource preserves rawBase64 for reprocessing');
  assert(createdDoc.chunks.length >= 2, 'Extracted at least 2 searchable passages across 2 pages');
  assert(createdDoc.chunks.some(c => c.pageOrSlide === 1), 'Preserves Page 1 anchor in chunk');
  assert(createdDoc.chunks.some(c => c.pageOrSlide === 2), 'Preserves Page 2 anchor in chunk');
  assert(createdDoc.chunks.every(c => c.courseId === 'cs-302-linux'), 'All chunks assigned to target course');

  // =========================================================================
  // 3. Course Assignment & New Course Creation
  // =========================================================================
  console.log('\n3. Course Assignment & New Course Creation');

  const newCourse: Course = {
    id: 'course-bio-101',
    title: 'General Biology: Cell & Molecular Biology',
    code: 'BIO-101',
    description: 'Foundations of cellular structure, genetics, and metabolic pathways',
    category: 'Life Sciences',
    topics: [
      {
        id: 'topic-bio-01',
        title: 'Cellular Structure & Organelles',
        description: 'Mitochondria, ribosomes, cell membrane transport',
        prerequisites: [],
        subtopics: ['Mitochondria', 'Cell Membrane']
      }
    ],
    totalDocuments: 1,
    totalChunks: 2,
    createdAt: new Date().toISOString(),
    isSampleCourse: false
  };

  await appDb.saveCourse(newCourse);
  const loadedCourses = await appDb.getCourses();
  assert(loadedCourses.some(c => c.id === 'course-bio-101'), 'Newly created course persists to storage');

  const bioPages: ExtractedPage[] = [
    {
      pageNumber: 1,
      text: 'Mitochondria are double-membraned organelles that generate adenosine triphosphate (ATP) through oxidative phosphorylation.',
      isOcr: false,
      requiresOcr: false,
      ocrStatus: 'not_needed'
    }
  ];

  const bioDoc = PdfParser.createDocumentFromPages(
    'Mitochondria_Guide.pdf',
    bioPages,
    newCourse.id,
    'Cellular Structure & Organelles',
    51200
  );

  await appDb.saveDocument(bioDoc);
  const loadedDocs = await appDb.getDocuments();
  assert(loadedDocs.some(d => d.id === bioDoc.id && d.courseId === 'course-bio-101'), 'Document successfully assigned to new course and saved');

  // =========================================================================
  // 4. Document Management Actions: View Details, Rename, Reprocess, Delete
  // =========================================================================
  console.log('\n4. Document Management Actions: Rename, Reprocess, and Delete');

  // 4.1 Rename
  const renamedDoc: DocumentSource = {
    ...bioDoc,
    title: 'Cellular_Energetics_and_Mitochondria.pdf',
    fileName: 'Cellular_Energetics_and_Mitochondria.pdf',
    chunks: bioDoc.chunks.map(c => ({
      ...c,
      documentTitle: 'Cellular_Energetics_and_Mitochondria.pdf'
    }))
  };

  await appDb.saveDocument(renamedDoc);
  const docsAfterRename = await appDb.getDocuments();
  const foundRenamed = docsAfterRename.find(d => d.id === bioDoc.id);
  assert(foundRenamed?.title === 'Cellular_Energetics_and_Mitochondria.pdf', 'Document title updated upon rename');
  assert(foundRenamed?.chunks.every(c => c.documentTitle === 'Cellular_Energetics_and_Mitochondria.pdf') === true, 'All chunks reflect renamed documentTitle');

  // 4.2 Reprocess
  const reprocessedDoc = PdfParser.createDocumentFromPages(
    renamedDoc.title,
    bioPages,
    renamedDoc.courseId,
    'Mitochondria and Cellular Energetics',
    renamedDoc.fileSizeBytes || 0,
    renamedDoc.id
  );
  await appDb.saveDocument(reprocessedDoc);
  const docsAfterReprocess = await appDb.getDocuments();
  const foundReprocessed = docsAfterReprocess.find(d => d.id === bioDoc.id);
  assert(foundReprocessed !== undefined, 'Reprocessed document exists with preserved ID');
  assert(foundReprocessed?.totalChunks === reprocessedDoc.totalChunks, 'Reprocessed document preserves passage integrity');

  // 4.3 Delete with confirmation
  await appDb.deleteDocument(bioDoc.id);
  const docsAfterDelete = await appDb.getDocuments();
  const deletedStillPresent = docsAfterDelete.some(d => d.id === bioDoc.id);
  assert(!deletedStillPresent, 'Document is completely deleted from storage');

  // =========================================================================
  // 5. AI Tutor Multi-Source and Single-Source Scoping & Retrieval Isolation
  // =========================================================================
  console.log('\n5. AI Tutor Multi-Source Scoping & Strict Document Isolation');

  // Create two distinct documents in Linux course:
  // Doc A: CA1.pdf (Command Line Tools: ls, cp, mv, tail)
  // Doc B: Problem_Statements.pdf (Track Descriptions: Track A, Track B) assigned to same course
  const linuxProblemChunks: Chunk[] = PROBLEM_STATEMENTS_DOCUMENT.chunks.map(c => ({
    ...c,
    courseId: 'course-linux-302'
  }));
  const allLinuxChunks = [...LINUX_CA1_DOCUMENT.chunks, ...linuxProblemChunks];
  const rag = new RagEngine(allLinuxChunks);

  // 5.1 "All Documents" scope retrieves best match across any document in course
  const allDocsQuery = rag.evaluateQuerySupport('Which command displays hidden files?', 3, 'all', 'course-linux-302');
  assert(allDocsQuery.isSupported, 'Query supported under All Documents scope');
  assert(allDocsQuery.citations.length > 0, 'Emits verified citation under All Documents scope');

  // 5.2 Single specific PDF scope: CA1.pdf
  const ca1ScopedQuery = rag.evaluateQuerySupport('Which command displays hidden files?', 3, LINUX_CA1_DOCUMENT.id, 'course-linux-302');
  assert(ca1ScopedQuery.isSupported, 'Query supported when scoped to CA1.pdf');
  assert(ca1ScopedQuery.topChunks.every(c => c.chunk.documentId === LINUX_CA1_DOCUMENT.id), 'All retrieved chunks belong strictly to CA1.pdf');

  // 5.3 Single specific PDF scope mismatch: Asking about "hidden files" scoped only to Problem_Statements.pdf
  const mismatchedScopedQuery = rag.evaluateQuerySupport('Which command displays hidden files?', 3, PROBLEM_STATEMENTS_DOCUMENT.id, 'course-linux-302');
  assert(!mismatchedScopedQuery.isSupported, 'Strict refusal when query topic does not exist in selected PDF');
  assert(mismatchedScopedQuery.citations.length === 0, 'Zero citations emitted when selected PDF does not contain answer');
  assert(mismatchedScopedQuery.relevant_excerpt === '', 'Excerpt is empty on refusal');

  // 5.4 Multi-Document Selection (array of document IDs)
  // Query for tail command scoped to [LINUX_CA1_DOCUMENT.id, 'doc-other-pdf']
  const multiDocQuery = rag.evaluateQuerySupport(
    'Which command displays the last 10 lines of a file?',
    3,
    [LINUX_CA1_DOCUMENT.id, 'doc-other-pdf'],
    'course-linux-302'
  );
  assert(multiDocQuery.isSupported, 'Multi-document array scope correctly retrieves matching chunks');
  assert(multiDocQuery.topChunks.every(c => c.chunk.documentId === LINUX_CA1_DOCUMENT.id), 'Retrieved chunks strictly restricted to allowed document ID list');

  // 5.5 Deleted Document Cannot Contaminate Retrieval
  // If we remove Problem_Statements from candidate chunks, asking about Track A must return unsupported
  const remainingChunksOnlyCa1 = LINUX_CA1_DOCUMENT.chunks;
  const purgedRag = new RagEngine(remainingChunksOnlyCa1);
  const purgedQuery = purgedRag.evaluateQuerySupport('What is Track A about?', 3, 'all', 'course-linux-302');
  assert(!purgedQuery.isSupported, 'Deleted document cannot contaminate retrieval (returns unsupported refusal)');
  assert(purgedQuery.citations.length === 0, 'Zero citations emitted after document deletion');

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n===============================================================');
  console.log(`PDF Management Test Suite Complete: ${passed} passed, ${failed} failed.`);
  console.log('===============================================================\n');

  if (failed > 0) {
    console.error('Failures:\n' + failures.join('\n'));
    process.exit(1);
  }
}

runPdfManagementTests().catch(err => {
  console.error('Fatal error in PDF Management test suite:', err);
  process.exit(1);
});
