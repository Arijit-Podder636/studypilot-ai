/**
 * Comprehensive Regression Test Suite:
 * - PDF Layout Reconstruction & Header/Footer Stripping
 * - Corrupted Stream Rejection & Scanned Page Handling
 * - Question-Isolated Passage Chunking
 * - Regression Verification for Specific Linux Command Questions
 * - Structured Response Schema & Page Citation Accuracy
 * - Strict Evidence-Based Grounding & Honest Refusal
 */

import { TextValidator } from '../src/services/textValidator';
import { GroundingVerifier } from '../src/services/groundingVerifier';
import { PdfParser } from '../src/services/pdfParser';
import { RagEngine } from '../src/services/ragEngine';
import { Chunk, ChunkCitation } from '../src/types/index';

// Valid minimal 1-page PDF
function createValidTestPdf(): Uint8Array {
  const content = 'Machine learning optimization and gradient descent fundamentals';
  const pdfString = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj
4 0 obj<</Length ${content.length + 30}>>stream
BT /F1 14 Tf 20 80 Td (${content}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
340
%%EOF`;
  return new TextEncoder().encode(pdfString);
}

// Scanned PDF with zero text glyphs
function createScannedTestPdf(): Uint8Array {
  const pdfString = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj
4 0 obj<</Length 0>>stream
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
280
%%EOF`;
  return new TextEncoder().encode(pdfString);
}

// Realistic 2-page Linux Exam PDF simulating CA1.pdf with questions across multiple pages
function createLinuxExamPdf(): Uint8Array {
  const page1Content = `BT
/F1 12 Tf
40 360 Td (CS302 Systems Administration Midterm Exam - CA1) Tj
0 -35 Td (1. Which command displays hidden files?) Tj
0 -20 Td (Answer: ls -la or ls -a displays all files including hidden files starting with a dot.) Tj
0 -35 Td (2. Which command displays the last 10 lines of a file?) Tj
0 -20 Td (Answer: tail -n 10 filename displays the last 10 lines of the specified file.) Tj
ET`;

  const page2Content = `BT
/F1 12 Tf
40 360 Td (CS302 Systems Administration Midterm Exam - CA1) Tj
0 -35 Td (3. Which command displays the first 10 lines of a file?) Tj
0 -20 Td (Answer: head -n 10 filename displays the first 10 lines of the specified file.) Tj
0 -35 Td (4. What is the difference between cp and mv?) Tj
0 -20 Td (Answer: cp creates a duplicate copy leaving the source intact, whereas mv renames or moves the file.) Tj
0 -35 Td (Page 2 of 2) Tj
ET`;

  const pdfString = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R 5 0 R]/Count 2>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 500 450]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj
4 0 obj<</Length ${page1Content.length}>>stream
${page1Content}
endstream
endobj
5 0 obj<</Type/Page/MediaBox[0 0 500 450]/Parent 2 0 R/Resources<<>>/Contents 6 0 R>>endobj
6 0 obj<</Length ${page2Content.length}>>stream
${page2Content}
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000120 00000 n 
0000000222 00000 n 
0000000570 00000 n 
0000000672 00000 n 
trailer<</Size 7/Root 1 0 R>>
startxref
1050
%%EOF`;

  return new TextEncoder().encode(pdfString);
}

// Realistic 2-page Hackathon Problem Statements PDF with 4 Challenge Tracks
// NOTE: MediaBox is 900pt wide on purpose. With a 500pt page, pdf.js drops text that runs past the page edge
// and the long Track sentences were silently truncated (e.g. '...deliver ada'). The old canned answers hid this.
function createProblemStatementsPdf(): Uint8Array {
  const page1Content = `BT
/F1 12 Tf
40 380 Td (Multimodal AI Hackathon 2026 - Problem Statements & Challenge Tracks) Tj
0 -35 Td (Track A: Cardiovascular Risk Visualization & Prediction) Tj
0 -20 Td (Track A focuses on developing predictive models and interactive clinical visual dashboards for cardiovascular health.) Tj
0 -35 Td (Track B: Mapping Flood Damage from Space) Tj
0 -20 Td (Track B challenges participants to harness Earth observation data and SAR satellite imagery for flood damage mapping.) Tj
ET`;

  const page2Content = `BT
/F1 12 Tf
40 380 Td (Multimodal AI Hackathon 2026 - Problem Statements & Challenge Tracks) Tj
0 -35 Td (Track C: Contrastive Speech Analytics & Temporal Flaw Grounding) Tj
0 -20 Td (Track C centers on temporal acoustic analysis and speech prosody evaluation to detect flaws in spoken presentations.) Tj
0 -35 Td (Track D: Personalized Tutoring & Adaptive Learning) Tj
0 -20 Td (Track D focuses on engineering intelligent multimodal tutoring platforms that deliver adaptive pedagogy and grounded retrieval.) Tj
ET`;

  const pdfString = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R 5 0 R]/Count 2>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 900 450]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj
4 0 obj<</Length ${page1Content.length}>>stream
${page1Content}
endstream
endobj
5 0 obj<</Type/Page/MediaBox[0 0 900 450]/Parent 2 0 R/Resources<<>>/Contents 6 0 R>>endobj
6 0 obj<</Length ${page2Content.length}>>stream
${page2Content}
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000120 00000 n 
0000000222 00000 n 
0000000670 00000 n 
0000000772 00000 n 
trailer<</Size 7/Root 1 0 R>>
startxref
1250
%%EOF`;

  return new TextEncoder().encode(pdfString);
}

export async function runPdfCitationRegressionTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ PASS: ${testName}`);
    } else {
      failed++;
      const msg = `FAIL: ${testName}${detail ? ` - ${detail}` : ''}`;
      errors.push(msg);
      console.error(`  ✗ ${msg}`);
    }
  }

  console.log('Running PDF Extraction & Citation Verification Regression Tests...\n');

  // Test 1: Normal Text PDF extraction
  try {
    const validPdfBytes = createValidTestPdf();
    const pages = await PdfParser.extractPages(validPdfBytes, 'test_textbook.pdf');
    assert(pages.length === 1, 'Normal PDF extracts correct page count (1)');
    assert(pages[0].pageNumber === 1, 'Preserves actual page number 1');
    assert(pages[0].text.includes('Machine learning optimization'), 'Extracts readable text from text PDF');
    assert(!TextValidator.containsPdfSyntax(pages[0].text), 'Extracted text does not contain %PDF, endobj, or stream');
  } catch (err: any) {
    assert(false, 'Normal PDF extraction test failed', err.message);
  }

  // Test 2: Scanned PDF handling (zero text)
  try {
    const scannedPdfBytes = createScannedTestPdf();
    const scannedPages = await PdfParser.extractPages(scannedPdfBytes, 'scanned_doc.pdf');
    assert(scannedPages.length === 1, 'Scanned PDF extracts page entry');
    assert(scannedPages[0].requiresOcr === true, 'Scanned page flagged with requiresOcr = true');
    assert(scannedPages[0].text.includes('Requires OCR processing'), 'Scanned page has transparent OCR notice without invented text');
  } catch (err: any) {
    assert(false, 'Scanned PDF test failed', err.message);
  }

  // Test 3: Raw PDF syntax and corrupted input rejection
  const rawPdfByteString = `%PDF-1.5
1 0 obj
<</Type /Catalog /Pages 2 0 R>>
endobj
2 0 obj
<</Type /Pages /Kids [3 0 R] /Count 1>>
endobj
stream
x^¥\x00\x02\x05\xFF\xFEcorrupted_binary_stream
endstream`;

  assert(TextValidator.containsPdfSyntax(rawPdfByteString), 'TextValidator detects raw PDF syntax signatures');
  const readCheck = TextValidator.validateReadability(rawPdfByteString);
  assert(!readCheck.isReadable, 'TextValidator rejects raw PDF internals as unreadable');
  assert(readCheck.hasPdfSyntax, 'Flags hasPdfSyntax = true');

  // Test 4: Corrupted binary characters rejection
  const binaryGarbage = '\x00\x01\x02\x03\x04\x05\x06%PDF\x0E\x0F\x10\x11\x12\x13\x14\x15';
  const binaryCheck = TextValidator.validateReadability(binaryGarbage);
  assert(!binaryCheck.isReadable, 'Rejects low-entropy non-printable binary strings');

  // Test 5: Empty extraction handling
  const emptyCheck = TextValidator.validateReadability('   \n\t  ');
  assert(!emptyCheck.isReadable, 'Rejects empty or whitespace extraction');

  // Test 6: Meaningful citation verification on supported answer
  const validChunk: Chunk = {
    id: 'chk-test-01',
    documentId: 'doc-01',
    courseId: 'course-ml-101',
    documentTitle: 'CA1.pdf',
    topic: 'Optimization',
    subtopic: 'Gradient Descent',
    pageOrSlide: 3,
    text: 'Gradient descent computes parameter updates by taking steps proportional to the negative gradient of the loss function.',
    keywords: ['gradient', 'descent', 'updates', 'loss']
  };

  const citationInput: ChunkCitation = {
    chunkId: 'chk-test-01',
    documentTitle: 'CA1.pdf',
    pageOrSlide: 3,
    excerpt: validChunk.text,
    relevanceScore: 1.0
  };

  const supportedAnswer = 'Gradient descent updates parameters iteratively along the negative gradient of the loss function.';
  const verifiedResult = GroundingVerifier.verifyCitation(citationInput, validChunk, supportedAnswer);

  assert(verifiedResult.status === 'strong_overlap', 'GroundingVerifier reports strong term overlap for well-supported claim against valid chunk (status renamed from "verified": overlap is not proof of correctness)');
  assert(verifiedResult.evidenceScore >= 0.70, 'Evidence score meets verified threshold');
  assert(verifiedResult.evidenceScore < 1.0, 'Never emits false 100% score (bounded realistically)');
  assert(verifiedResult.isReadableSource, 'Identifies valid chunk as readable source');

  // Test 7: Citation verification rejects corrupted source chunk
  const corruptedChunk: Chunk = {
    id: 'chk-corrupt-01',
    documentId: 'doc-02',
    courseId: 'course-ml-101',
    documentTitle: 'CA1.pdf',
    topic: 'Corrupted Stream',
    subtopic: 'Page 1',
    pageOrSlide: 1,
    text: '%PDF-1.5 /Type /Catalog /Pages 2 0 R endobj stream corrupted bytes endstream',
    keywords: ['pdf', 'catalog', 'endobj']
  };

  const corruptCitation: ChunkCitation = {
    chunkId: 'chk-corrupt-01',
    documentTitle: 'CA1.pdf',
    pageOrSlide: 1,
    excerpt: corruptedChunk.text,
    relevanceScore: 1.0
  };

  const corruptVerification = GroundingVerifier.verifyCitation(corruptCitation, corruptedChunk, supportedAnswer);
  assert(corruptVerification.status === 'corrupted_source', 'Marks citation with corrupted PDF syntax as corrupted_source');
  assert(corruptVerification.evidenceScore === 0, 'Corrupted chunk receives 0% grounding score');
  assert(!corruptVerification.isReadableSource, 'Identifies source as unreadable');
  assert(corruptVerification.statusLabel.includes('Unverified'), 'Status label explicitly contains Unverified');

  // Test 8: Citation verification rejects unsupported claim (insufficient evidence)
  const unrelatedAnswer = 'The Byzantine Empire concluded with the fall of Constantinople in 1453 under Ottoman artillery.';
  const unsupportedVerification = GroundingVerifier.verifyCitation(citationInput, validChunk, unrelatedAnswer);
  assert(unsupportedVerification.status === 'unverified_insufficient', 'Marks claim without chunk overlap as unverified_insufficient');
  assert(unsupportedVerification.evidenceScore < 0.60, 'Unsupported answer receives sub-60% score');
  assert(unsupportedVerification.statusLabel.includes('Unverified — insufficient readable source evidence'), 'Displays honest unverified message');

  // =========================================================================
  // MULTI-PAGE EXAM INGESTION & REGRESSION TESTS FOR SPECIFIC LINUX COMMANDS
  // =========================================================================

  console.log('\nRunning Linux Exam CA1.pdf Ingestion & Passage Chunking Tests...\n');

  const linuxBytes = createLinuxExamPdf();
  const linuxPages = await PdfParser.extractPages(linuxBytes, 'CA1.pdf');
  assert(linuxPages.length === 2, '2-Page Linux Exam extracts exactly 2 pages');
  assert(linuxPages[0].pageNumber === 1 && linuxPages[1].pageNumber === 2, 'Preserves actual page numbers 1 and 2');

  const linuxDoc = PdfParser.createDocumentFromPages('CA1.pdf', linuxPages, 'course-linux', 'Linux', linuxBytes.length);
  assert(linuxDoc.chunks.length === 4, `Question passage chunker splits into 4 distinct question chunks (got ${linuxDoc.chunks.length})`);

  // Verify page number assignments
  const q1Chunk = linuxDoc.chunks.find(c => c.text.includes('hidden files'));
  const q2Chunk = linuxDoc.chunks.find(c => c.text.includes('last 10 lines'));
  const q3Chunk = linuxDoc.chunks.find(c => c.text.includes('first 10 lines'));
  const q4Chunk = linuxDoc.chunks.find(c => c.text.includes('cp and mv'));

  assert(Boolean(q1Chunk && q1Chunk.pageOrSlide === 1), 'Question 1 chunk accurately references Page 1');
  assert(Boolean(q2Chunk && q2Chunk.pageOrSlide === 1), 'Question 2 chunk accurately references Page 1');
  assert(Boolean(q3Chunk && q3Chunk.pageOrSlide === 2), 'Question 3 chunk accurately references Page 2');
  assert(Boolean(q4Chunk && q4Chunk.pageOrSlide === 2), 'Question 4 chunk accurately references Page 2');

  // Verify passage isolation: Q1 chunk must NOT contain Q2, Q3, or Q4 content
  assert(Boolean(q1Chunk && !q1Chunk.text.includes('last 10 lines') && !q1Chunk.text.includes('tail')), 'Question 1 chunk does NOT contain Question 2 (tail)');
  assert(Boolean(q1Chunk && !q1Chunk.text.includes('head') && !q1Chunk.text.includes('cp and mv')), 'Question 1 chunk does NOT contain Question 3 or 4');

  // Verify header and footer stripping
  assert(Boolean(q4Chunk && !q4Chunk.text.includes('Page 2 of 2')), 'Page footer "Page 2 of 2" stripped from Question 4 chunk');

  console.log('\nRunning Regression Question Tests on Indexed Passages...\n');
  const rag = new RagEngine(linuxDoc.chunks);

  // Regression Question 1: "Which command displays hidden files?"
  const res1 = rag.evaluateQuerySupport('Which command displays hidden files?');
  assert(res1.isSupported === true, 'Q1: Query is supported');
  assert(res1.support_status === 'supported', 'Q1: Structured support_status is "supported"');
  assert(res1.answer.includes('ls -la') || res1.answer.includes('ls -a'), `Q1: Answer provides expected command "ls -la" or "ls -a" (got "${res1.answer}")`);
  assert(!res1.answer.includes('tail') && !res1.answer.includes('head') && !res1.answer.includes('mv'), 'Q1: Answer does NOT reproduce unrelated questions/commands');
  assert(res1.citations.length === 1 && res1.citations[0].pageOrSlide === 1, 'Q1: Citation points to correct Page 1');
  assert(res1.relevant_excerpt.includes('ls -la') || res1.relevant_excerpt.includes('hidden files'), `Q1: relevant_excerpt contains exact evidence excerpt (got "${res1.relevant_excerpt}")`);

  // Regression Question 2: "Which command displays the last 10 lines of a file?"
  const res2 = rag.evaluateQuerySupport('Which command displays the last 10 lines of a file?');
  assert(res2.isSupported === true, 'Q2: Query is supported');
  assert(res2.support_status === 'supported', 'Q2: Structured support_status is "supported"');
  assert(res2.answer.includes('tail -n 10') || res2.answer.includes('tail'), `Q2: Answer provides expected command "tail -n 10" (got "${res2.answer}")`);
  assert(!res2.answer.includes('hidden') && !res2.answer.includes('ls') && !res2.answer.includes('cp'), 'Q2: Answer does NOT reproduce unrelated questions/commands');
  assert(res2.citations.length === 1 && res2.citations[0].pageOrSlide === 1, 'Q2: Citation points to correct Page 1');

  // Regression Question 3: "Which command displays the first 10 lines of a file?"
  const res3 = rag.evaluateQuerySupport('Which command displays the first 10 lines of a file?');
  assert(res3.isSupported === true, 'Q3: Query is supported');
  assert(res3.support_status === 'supported', 'Q3: Structured support_status is "supported"');
  assert(res3.answer.includes('head -n 10') || res3.answer.includes('head'), `Q3: Answer provides expected command "head -n 10" (got "${res3.answer}")`);
  assert(!res3.answer.includes('tail') && !res3.answer.includes('hidden'), 'Q3: Answer does NOT reproduce unrelated questions/commands');
  assert(res3.citations.length === 1 && res3.citations[0].pageOrSlide === 2, 'Q3: Citation points to correct Page 2');

  // Regression Question 4: "What is the difference between cp and mv?"
  const res4 = rag.evaluateQuerySupport('What is the difference between cp and mv?');
  assert(res4.isSupported === true, 'Q4: Query is supported');
  assert(res4.support_status === 'supported', 'Q4: Structured support_status is "supported"');
  assert(res4.answer.includes('cp') && res4.answer.includes('mv'), `Q4: Answer distinguishes cp and mv (got "${res4.answer}")`);
  assert(res4.answer.toLowerCase().includes('cop') && (res4.answer.toLowerCase().includes('move') || res4.answer.toLowerCase().includes('rename')), 'Q4: Explains copy vs move/rename functions');
  assert(res4.citations.length === 1 && res4.citations[0].pageOrSlide === 2, 'Q4: Citation points to correct Page 2');

  // Out-of-Domain Refusal Test: "How do you configure BGP routing on Cisco IOS?"
  console.log('\nRunning Unsupported Query Refusal Test...\n');
  const unsupportedRes = rag.evaluateQuerySupport('How do you configure BGP routing on Cisco IOS?');
  assert(unsupportedRes.isSupported === false, 'Unsupported query is marked isSupported = false');
  assert(unsupportedRes.support_status === 'unsupported', 'Structured support_status is "unsupported"');
  assert(unsupportedRes.citations.length === 0, 'Unsupported query produces zero citations');
  assert(unsupportedRes.answer.includes('not provide enough evidence'), 'Answer explicitly states insufficient evidence without inventing content');
  assert(unsupportedRes.confidence < 0.20, 'Unsupported confidence is < 20%');

  // =========================================================================
  // Problem Statements.pdf Topic Classification & Citation Regression Tests
  // =========================================================================
  console.log('\nRunning Problem Statements.pdf Topic Classification & Citation Tests...\n');

  const psBytes = createProblemStatementsPdf();
  const psPages = await PdfParser.extractPages(psBytes, 'Problem Statements.pdf');
  assert(psPages.length === 2, 'Problem Statements.pdf extracts exactly 2 pages');
  assert(psPages[0].pageNumber === 1 && psPages[1].pageNumber === 2, 'Preserves actual page numbers 1 and 2');

  // Test 1: Upload while active course has topic "Optimization & Loss Functions"
  // Must NEVER classify this document or chunks under "Optimization & Loss Functions"
  const psDoc = PdfParser.createDocumentFromPages(
    'Problem Statements.pdf',
    psPages,
    'course-ml-101',
    'Optimization & Loss Functions', // Active course's default topic
    psBytes.length
  );

  assert(psDoc.topic === 'Hackathon Problem Statements', `Document classified as "Hackathon Problem Statements" from content (got "${psDoc.topic}")`);
  assert(psDoc.topic !== 'Optimization & Loss Functions', 'Document is NEVER classified as "Optimization & Loss Functions"');

  const hasOptimizationChunk = psDoc.chunks.some(c => c.topic.includes('Optimization') || c.subtopic.includes('Optimization'));
  assert(!hasOptimizationChunk, 'Zero chunks classified under "Optimization & Loss Functions"');

  // Test 2: Verify page numbers: Track A & B on Page 1, Track C & D on Page 2
  const trackAChunk = psDoc.chunks.find(c => c.text.includes('Track A'));
  const trackBChunk = psDoc.chunks.find(c => c.text.includes('Track B'));
  const trackCChunk = psDoc.chunks.find(c => c.text.includes('Track C'));
  const trackDChunk = psDoc.chunks.find(c => c.text.includes('Track D'));

  assert(Boolean(trackAChunk && trackAChunk.pageOrSlide === 1), 'Track A correctly maps to Page 1');
  assert(Boolean(trackBChunk && trackBChunk.pageOrSlide === 1), 'Track B correctly maps to Page 1');
  assert(Boolean(trackCChunk && trackCChunk.pageOrSlide === 2), 'Track C correctly maps to Page 2');
  assert(Boolean(trackDChunk && trackDChunk.pageOrSlide === 2), 'Track D correctly maps to Page 2');

  // Test 3: Each chunk retains genuine document ID, source title, and specific track topic
  assert(psDoc.chunks.every(c => c.documentId === psDoc.id), 'All chunks retain correct document ID');
  assert(psDoc.chunks.every(c => c.documentTitle === 'Problem Statements.pdf'), 'All chunks retain correct source title');
  assert(Boolean(trackAChunk && trackAChunk.topic.includes('Track A')), 'Track A chunk has Track A topic');
  assert(Boolean(trackBChunk && trackBChunk.topic.includes('Track B')), 'Track B chunk has Track B topic');
  assert(Boolean(trackCChunk && trackCChunk.topic.includes('Track C')), 'Track C chunk has Track C topic');
  assert(Boolean(trackDChunk && trackDChunk.topic.includes('Track D')), 'Track D chunk has Track D topic');

  // Test 4: Ask "What is Track D about?" - Grounded in actual Track D text
  const psRag = new RagEngine(psDoc.chunks);
  const trackDRes = psRag.evaluateQuerySupport('What is Track D about?');

  assert(trackDRes.isSupported === true, 'Track D query is supported');
  assert(trackDRes.support_status === 'supported', 'Track D support_status is "supported"');
  assert(
    trackDRes.answer.includes('Personalized Tutoring & Adaptive Learning') ||
    trackDRes.answer.toLowerCase().includes('adaptive'),
    `Answer is grounded in Track D content (got: "${trackDRes.answer}")`
  );
  assert(trackDRes.citations.length === 1, 'Produces exactly 1 verifiable citation');
  assert(trackDRes.citations[0].pageOrSlide === 2, `Citation points to actual Page 2 (got Page ${trackDRes.citations[0].pageOrSlide})`);
  assert(
    trackDRes.relevant_excerpt.length > 50 && !trackDRes.relevant_excerpt.startsWith('Optimization'),
    `Relevant excerpt contains substantive Track D text (got "${trackDRes.relevant_excerpt}")`
  );

  // Test 5: Verify bare heading does NOT receive inflated 92% Evidence Match
  const bareHeadingCitation: ChunkCitation = {
    chunkId: trackDChunk!.id,
    documentTitle: 'Problem Statements.pdf',
    pageOrSlide: 2,
    excerpt: 'Track D: Personalized Tutoring & Adaptive Learning',
    relevanceScore: 0.88
  };
  const headingCheck = GroundingVerifier.verifyCitation(bareHeadingCitation, trackDChunk, trackDRes.answer);
  assert(headingCheck.status === 'unverified_insufficient', 'Bare section heading without body evidence is unverified');
  assert(headingCheck.evidenceScore <= 0.35, `Bare heading evidence score is capped realistically (got ${(headingCheck.evidenceScore * 100).toFixed(0)}%, NOT 92%)`);
  assert(headingCheck.statusLabel.includes('heading only'), 'Status label explicitly warns that excerpt is a section heading only');

  // Test 6: Unrelated Machine Learning questions do not retrieve Problem Statements.pdf as supporting evidence
  const mlRes = psRag.evaluateQuerySupport('Explain gradient descent optimization and learning rate decay');
  assert(mlRes.isSupported === false, 'ML question on Problem Statements chunks is unsupported');
  assert(mlRes.support_status === 'unsupported', 'ML question returns support_status "unsupported"');
  assert(mlRes.citations.length === 0, 'Zero citations retrieved for unrelated ML question');
  assert(mlRes.answer.includes('not provide enough evidence'), 'Answer refuses without inventing cross-topic claims');

  // Test 7: Reprocessing replaces stale metadata and duplicate chunks cleanly
  const reprocessedDoc = PdfParser.createDocumentFromPages(
    'Problem Statements.pdf',
    psPages,
    'course-ml-101',
    undefined,
    psBytes.length,
    psDoc.id // Preserve document ID across re-index
  );
  assert(reprocessedDoc.id === psDoc.id, 'Reprocessing preserves original document ID');
  assert(reprocessedDoc.chunks.length === 4, `Reprocessing produces exactly 4 clean chunks without duplicates (got ${reprocessedDoc.chunks.length})`);
  assert(reprocessedDoc.subtopics.length === 4, 'Reprocessed document has exactly 4 track subtopics');

  return { passed, failed, errors };
}

// Self-run when executed via tsx
runPdfCitationRegressionTests().then((res) => {
  console.log(`\nRegression Suite Complete: ${res.passed} passed, ${res.failed} failed.`);
  if (res.errors.length > 0) {
    console.error('Errors:', res.errors);
    process.exit(1);
  }
});
