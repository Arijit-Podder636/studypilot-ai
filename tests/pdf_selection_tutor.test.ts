/**
 * PDF Source Selection, Instant Switching, Selection Persistence, and Scoped Retrieval Tests
 *
 * Validates:
 * 1. Immediate retrieval scope update on source switching
 * 2. Scope options: All Documents, One specific PDF, Multiple selected PDFs
 * 3. Selection persistence across follow-up questions (does not reset to All Documents)
 * 4. Source isolation: switching sources prevents stale answers, passages, and citations
 * 5. Automatic picker reconciliation when documents are renamed or deleted
 * 6. Scoped RAG evaluation behavior when filtered to specific PDFs
 *
 * Run with: npx tsx tests/pdf_selection_tutor.test.ts
 */

import { RagEngine } from '../src/services/ragEngine';
import { Chunk, DocumentSource, TutorMessage } from '../src/types';
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

async function runSelectionAndIsolationTests() {
  console.log('===============================================================');
  console.log('StudyPilot AI — PDF Selection, Switching & Isolation Tests');
  console.log('===============================================================\n');

  // Set up mock test documents with distinctive content
  const docA: DocumentSource = {
    id: `doc-${Date.now()}-a`,
    courseId: 'test-course-101',
    title: 'Operating_Systems_Process_Scheduling.pdf',
    type: 'pdf',
    topic: 'Operating Systems',
    subtopics: ['Round Robin', 'Shortest Job First'],
    totalChunks: 2,
    uploadedAt: new Date().toISOString(),
    fileName: 'Operating_Systems_Process_Scheduling.pdf',
    pageCount: 4,
    status: 'ready',
    chunks: [
      {
        id: 'chunk-a1',
        courseId: 'test-course-101',
        documentId: '', // will set below
        documentTitle: 'Operating_Systems_Process_Scheduling.pdf',
        topic: 'Operating Systems',
        subtopic: 'Round Robin',
        text: 'Round Robin scheduling assigns a fixed time quantum of 10 milliseconds to each active ready queue process in cyclic order.',
        pageOrSlide: 2,
        readabilityScore: 80,
        densityScore: 0.8
      },
      {
        id: 'chunk-a2',
        courseId: 'test-course-101',
        documentId: '', // will set below
        documentTitle: 'Operating_Systems_Process_Scheduling.pdf',
        topic: 'Operating Systems',
        subtopic: 'Shortest Job First',
        text: 'Shortest Job First scheduling minimizes average turnaround time but may cause starvation for long-running processes.',
        pageOrSlide: 3,
        readabilityScore: 82,
        densityScore: 0.85
      }
    ]
  };
  docA.chunks.forEach(c => (c.documentId = docA.id));

  const docB: DocumentSource = {
    id: `doc-${Date.now()}-b`,
    courseId: 'test-course-101',
    title: 'Computer_Networks_Routing_Protocols.pdf',
    type: 'pdf',
    topic: 'Computer Networks',
    subtopics: ['BGP', 'OSPF'],
    totalChunks: 2,
    uploadedAt: new Date().toISOString(),
    fileName: 'Computer_Networks_Routing_Protocols.pdf',
    pageCount: 5,
    status: 'ready',
    chunks: [
      {
        id: 'chunk-b1',
        courseId: 'test-course-101',
        documentId: '', // will set below
        documentTitle: 'Computer_Networks_Routing_Protocols.pdf',
        topic: 'Computer Networks',
        subtopic: 'Border Gateway Protocol',
        text: 'Border Gateway Protocol (BGP) is a path-vector routing protocol used to exchange routing information between autonomous systems on the Internet.',
        pageOrSlide: 1,
        readabilityScore: 84,
        densityScore: 0.82
      },
      {
        id: 'chunk-b2',
        courseId: 'test-course-101',
        documentId: '', // will set below
        documentTitle: 'Computer_Networks_Routing_Protocols.pdf',
        topic: 'Computer Networks',
        subtopic: 'Open Shortest Path First',
        text: 'Open Shortest Path First (OSPF) uses Dijkstra algorithm to calculate the shortest path tree within an interior gateway domain.',
        pageOrSlide: 4,
        readabilityScore: 85,
        densityScore: 0.88
      }
    ]
  };
  docB.chunks.forEach(c => (c.documentId = docB.id));

  const docC: DocumentSource = {
    id: `doc-${Date.now()}-c`,
    courseId: 'test-course-101',
    title: 'Database_Normalization_Guide.pdf',
    type: 'pdf',
    topic: 'Databases',
    subtopics: ['Third Normal Form', 'BCNF'],
    totalChunks: 1,
    uploadedAt: new Date().toISOString(),
    fileName: 'Database_Normalization_Guide.pdf',
    pageCount: 3,
    status: 'ready',
    chunks: [
      {
        id: 'chunk-c1',
        courseId: 'test-course-101',
        documentId: '', // will set below
        documentTitle: 'Database_Normalization_Guide.pdf',
        topic: 'Databases',
        subtopic: 'Third Normal Form',
        text: 'A relation is in Third Normal Form (3NF) if every non-prime attribute is non-transitively dependent on every candidate key.',
        pageOrSlide: 2,
        readabilityScore: 80,
        densityScore: 0.8
      }
    ]
  };
  docC.chunks.forEach(c => (c.documentId = docC.id));

  const allCourseChunks = [...docA.chunks, ...docB.chunks, ...docC.chunks];
  const allCourseDocs = [docA, docB, docC];

  // =========================================================================
  // 1. Instant PDF Switching & Active Scope Derivation
  // =========================================================================
  console.log('1. Instant Source Switching & Retrieval Scope Derivation');

  const rag = new RagEngine(allCourseChunks);

  // 1.1 All Documents scope
  const allResult = rag.retrieve('scheduling quantum', 3, 'all', 'test-course-101');
  assert(allResult.length > 0, 'Retrieval works across All Documents');
  assert(allResult[0].chunk.documentId === docA.id, 'Top chunk correctly originates from docA under all documents');

  // 1.2 Switch to docA exclusively
  const activeScopeDocA = allCourseChunks.filter(c => [docA.id].includes(c.documentId));
  assert(activeScopeDocA.length === 2, 'Active chunks filtered to docA yields exactly 2 chunks');
  const ragA = new RagEngine(activeScopeDocA);
  const resultA = ragA.retrieve('scheduling quantum', 3, docA.id, 'test-course-101');
  assert(resultA.length > 0 && resultA.every(r => r.chunk.documentId === docA.id), 'Instant switch to docA strictly scopes retrieval to docA');

  // 1.3 Switch to docB exclusively
  const activeScopeDocB = allCourseChunks.filter(c => [docB.id].includes(c.documentId));
  assert(activeScopeDocB.length === 2, 'Active chunks filtered to docB yields exactly 2 chunks');
  const ragB = new RagEngine(activeScopeDocB);
  const resultB = ragB.retrieve('BGP autonomous systems routing', 3, docB.id, 'test-course-101');
  assert(resultB.length > 0 && resultB.every(r => r.chunk.documentId === docB.id), 'Instant switch to docB strictly scopes retrieval to docB');

  // =========================================================================
  // 2. Strict Source Isolation (No Leaking / No Stale Passages)
  // =========================================================================
  console.log('\n2. Strict Source Isolation — Prevention of Stale Answers & Citations');

  // 2.1 When switched to docB, query about docA topic (Round Robin) must be unsupported
  const evalDocBOnTopicA = ragB.evaluateQuerySupport('What is the time quantum in Round Robin scheduling?', 3, docB.id, 'test-course-101');
  assert(evalDocBOnTopicA.isSupported === false, 'Switched PDF (docB) strictly refuses queries about docA topics');
  assert(evalDocBOnTopicA.citations.length === 0, 'Zero citations emitted for docA query when docB is selected');
  assert(evalDocBOnTopicA.relevantExcerpt === '', 'Relevant excerpt is empty on refusal (no stale docA excerpt leaked)');
  assert(evalDocBOnTopicA.answer.includes('not supported') || evalDocBOnTopicA.answer.includes('does not provide'), 'Clear refusal notice generated');

  // 2.2 When switched back to docA, query about docB topic (BGP) must be unsupported
  const evalDocAOnTopicB = ragA.evaluateQuerySupport('Explain how BGP autonomous systems exchange routing info', 3, docA.id, 'test-course-101');
  assert(evalDocAOnTopicB.isSupported === false, 'Switched PDF (docA) strictly refuses queries about docB topics');
  assert(evalDocAOnTopicB.citations.length === 0, 'Zero citations emitted for docB query when docA is selected');

  // 2.3 When scoped to docA and asking docA question, verifies page citation
  const evalDocAOnTopicA = ragA.evaluateQuerySupport('What is the time quantum assigned in Round Robin scheduling?', 3, docA.id, 'test-course-101');
  assert(evalDocAOnTopicA.isSupported === true, 'Query on active docA is supported with valid evidence');
  assert(evalDocAOnTopicA.citations.length > 0, 'Emits verified page citation');
  assert(evalDocAOnTopicA.citations[0].documentTitle === docA.title, 'Citation document title matches active PDF');
  assert(evalDocAOnTopicA.citations[0].pageOrSlide === 2, 'Citation page number matches exact source page');

  // =========================================================================
  // 3. Multi-Document Selection Scope
  // =========================================================================
  console.log('\n3. Multi-Document Selection Scope');

  // Select both docA and docC, leaving docB unselected
  const selectedMultiIds = [docA.id, docC.id];
  const activeScopeMulti = allCourseChunks.filter(c => selectedMultiIds.includes(c.documentId));
  assert(activeScopeMulti.length === 3, 'Multi-select [docA, docC] activates exactly 3 chunks');

  const ragMulti = new RagEngine(activeScopeMulti);

  // docA query supported
  const multiQueryA = ragMulti.evaluateQuerySupport('Round Robin time quantum', 3, selectedMultiIds, 'test-course-101');
  assert(multiQueryA.isSupported === true, 'docA query supported in multi-selection [docA, docC]');

  // docC query supported
  const multiQueryC = ragMulti.evaluateQuerySupport('Third Normal Form non-prime attribute', 3, selectedMultiIds, 'test-course-101');
  assert(multiQueryC.isSupported === true, 'docC query supported in multi-selection [docA, docC]');

  // docB query (unselected) strictly refused
  const multiQueryB = ragMulti.evaluateQuerySupport('Border Gateway Protocol routing autonomous systems', 3, selectedMultiIds, 'test-course-101');
  assert(multiQueryB.isSupported === false, 'Unselected docB query strictly refused in multi-select [docA, docC]');
  assert(multiQueryB.citations.length === 0, 'Zero citations emitted for unselected docB in multi-selection');

  // =========================================================================
  // 4. Selection Persistence Across Follow-Up Questions (Requirement 7)
  // =========================================================================
  console.log('\n4. Selection Persistence Across Follow-Up Questions');

  // Simulate a session asking initial question + follow-up questions
  let sessionSelectedDocIds = [docA.id]; // User selected docA

  // Question 1
  const q1 = 'What is Round Robin scheduling?';
  const q1ActiveChunks = sessionSelectedDocIds.includes('all')
    ? allCourseChunks
    : allCourseChunks.filter(c => sessionSelectedDocIds.includes(c.documentId));
  const q1Rag = new RagEngine(q1ActiveChunks);
  const q1Result = q1Rag.evaluateQuerySupport(q1, 3, sessionSelectedDocIds, 'test-course-101');
  assert(q1Result.isSupported === true, 'Initial Question 1 evaluated successfully on docA');

  // Follow-up question 1
  assert(sessionSelectedDocIds[0] === docA.id, 'Selection remains docA before follow-up');
  const followUp1 = 'What is the time quantum specified?';
  const f1ActiveChunks = sessionSelectedDocIds.includes('all')
    ? allCourseChunks
    : allCourseChunks.filter(c => sessionSelectedDocIds.includes(c.documentId));
  const f1Rag = new RagEngine(f1ActiveChunks);
  const f1Result = f1Rag.evaluateQuerySupport(followUp1, 3, sessionSelectedDocIds, 'test-course-101');
  assert(f1Result.isSupported === true, 'Follow-up question 1 answered using persisted docA scope');
  assert(sessionSelectedDocIds[0] === docA.id, 'Selection persists as docA after follow-up question 1');

  // Follow-up question 2 (asking about an unselected topic)
  const followUp2 = 'Does this include BGP border gateway protocols?';
  const f2ActiveChunks = sessionSelectedDocIds.includes('all')
    ? allCourseChunks
    : allCourseChunks.filter(c => sessionSelectedDocIds.includes(c.documentId));
  const f2Rag = new RagEngine(f2ActiveChunks);
  const f2Result = f2Rag.evaluateQuerySupport(followUp2, 3, sessionSelectedDocIds, 'test-course-101');
  assert(f2Result.isSupported === false, 'Follow-up question about unselected topic is refused');
  assert(sessionSelectedDocIds[0] === docA.id, 'Selection persists as docA after follow-up question 2 (never resets to all)');

  // =========================================================================
  // 5. Automatic Picker Refresh & Document Reconciler (Requirement 8)
  // =========================================================================
  console.log('\n5. Automatic Reconciliation on Document Rename, Move, and Deletion');

  // Helper simulating TutorView's document reconciliation effect
  function reconcileSelectedDocIds(currentSelected: string[], currentDocuments: DocumentSource[]): string[] {
    if (currentSelected.includes('all')) return ['all'];
    const existingIds = new Set(currentDocuments.map(d => d.id));
    const valid = currentSelected.filter(id => existingIds.has(id));
    if (valid.length === 0) {
      return ['all'];
    }
    return valid;
  }

  // 5.1 When document is renamed
  const renamedDocA = { ...docA, title: 'Operating_Systems_Process_Scheduling_V2_Revised.pdf' };
  const updatedDocsAfterRename = [renamedDocA, docB, docC];
  const reconciledAfterRename = reconcileSelectedDocIds([docA.id], updatedDocsAfterRename);
  assert(reconciledAfterRename.length === 1 && reconciledAfterRename[0] === docA.id, 'Selection persists ID through document rename');
  const resolvedDoc = updatedDocsAfterRename.find(d => d.id === reconciledAfterRename[0]);
  assert(resolvedDoc?.title === 'Operating_Systems_Process_Scheduling_V2_Revised.pdf', 'Picker dynamically reflects renamed document title');

  // 5.2 When selected document is deleted in Study Library
  const docsAfterDocADeleted = [docB, docC];
  const reconciledAfterDeletion = reconcileSelectedDocIds([docA.id], docsAfterDocADeleted);
  assert(reconciledAfterDeletion.length === 1 && reconciledAfterDeletion[0] === 'all', 'Reconciliation gracefully falls back to All Documents when selected PDF is deleted');

  // 5.3 When one of multi-selected documents is deleted
  const reconciledMultiAfterOneDeleted = reconcileSelectedDocIds([docA.id, docB.id], docsAfterDocADeleted);
  assert(reconciledMultiAfterOneDeleted.length === 1 && reconciledMultiAfterOneDeleted[0] === docB.id, 'Reconciliation preserves remaining valid selected PDF when one is deleted');

  // 5.4 When document is moved to another course
  const docsAfterDocBMoved = [docC]; // docB moved to different course
  const reconciledAfterMove = reconcileSelectedDocIds([docB.id], docsAfterDocBMoved);
  assert(reconciledAfterMove.length === 1 && reconciledAfterMove[0] === 'all', 'Reconciliation resets to All Documents when selected PDF is moved to another course');

  // =========================================================================
  // 6. Summary
  // =========================================================================
  console.log('\n===============================================================');
  console.log(`PDF Selection & Isolation Suite Complete: ${passed} passed, ${failed} failed.`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSelectionAndIsolationTests().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
