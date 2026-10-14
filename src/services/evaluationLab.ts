import {
  EvaluationItemResult,
  EvaluationRunSummary,
  EvaluationTestCase
} from '../types';
import {
  SAMPLE_DOCUMENTS,
  LINUX_CA1_DOCUMENT,
  SAMPLE_EVALUATION_CASES
} from '../data/sampleCourse';
import { RagEngine, tokenize } from './ragEngine';

export class EvaluationLabRunner {
  private ragEngine: RagEngine;

  constructor() {
    const allChunks = [...SAMPLE_DOCUMENTS, LINUX_CA1_DOCUMENT].flatMap(d => d.chunks);
    this.ragEngine = new RagEngine(allChunks);
  }

  public async runBenchmarkSuite(
    testCases: EvaluationTestCase[] = SAMPLE_EVALUATION_CASES
  ): Promise<EvaluationRunSummary> {
    const results: EvaluationItemResult[] = [];

    for (const testCase of testCases) {
      const evalResult = this.evaluateSingleCase(testCase);
      results.push(evalResult);
    }

    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    // Metrics that do not apply to a case are null and are excluded from the averages.
    const avg = (values: Array<number | null>): number | null => {
      const present = values.filter((v): v is number => typeof v === 'number');
      return present.length > 0 ? Number((present.reduce((a, b) => a + b, 0) / present.length).toFixed(3)) : null;
    };
    const avgPrecision = avg(results.map(r => r.contextPrecision));
    const avgRecall = avg(results.map(r => r.contextRecall));
    const avgFaithfulness = avg(results.map(r => r.faithfulness));
    const avgRelevancy = avg(results.map(r => r.answerRelevancy));
    const avgCitation = avg(results.map(r => r.citationAccuracy));

    const refusalCases = results.filter(r => r.expectedRefusal);
    const correctRefusals = refusalCases.filter(r => r.isRefusal).length;
    const refusalPrecision = refusalCases.length > 0 ? correctRefusals / refusalCases.length : null;

    return {
      id: `eval-run-${Date.now()}`,
      timestamp: new Date().toISOString(),
      totalCases: total,
      passedCases: passed,
      averageContextPrecision: avgPrecision,
      averageContextRecall: avgRecall,
      averageFaithfulness: avgFaithfulness,
      averageAnswerRelevancy: avgRelevancy,
      citationAccuracy: avgCitation,
      refusalPrecision: refusalPrecision === null ? null : Number(refusalPrecision.toFixed(3)),
      results,
      modelUsed: 'StudyPilot local retrieval engine (BM25 keyword matching, extractive answers; no LLM is called)'
    };
  }

  public evaluateSingleCase(testCase: EvaluationTestCase): EvaluationItemResult {
    const queryResult = this.ragEngine.evaluateQuerySupport(testCase.question, 4);
    const retrievedIds = queryResult.topChunks.map(c => c.chunk.id);

    // Unsupported queries check
    if (testCase.expectedRefusal) {
      const correctlyRefused = !queryResult.isSupported;
      return {
        testCaseId: testCase.id,
        question: testCase.question,
        category: testCase.category,
        retrievedChunkIds: retrievedIds,
        generatedAnswer: queryResult.synthesizedAnswer,
        isRefusal: !queryResult.isSupported,
        expectedRefusal: true,
        // Retrieval / answer-quality metrics are not defined when the correct behaviour is to refuse,
        // so they are reported as null instead of a made-up 1.0.
        contextPrecision: null,
        contextRecall: null,
        faithfulness: null,
        answerRelevancy: null,
        citationAccuracy: null,
        passed: correctlyRefused,
        notes: correctlyRefused
          ? 'Passed: the engine reported insufficient evidence and returned no citation. (Retrieval metrics do not apply to refusal cases.)'
          : 'Failed: the engine produced an answer for a question the material is not expected to answer.'
      };
    }

    // Supported queries check
    const targetSet = new Set(testCase.targetChunkIds);
    const truePositives = retrievedIds.filter(id => targetSet.has(id)).length;

    // Context Precision = |Retrieved & Relevant| / |Retrieved|
    const contextPrecision = retrievedIds.length > 0
      ? Number((truePositives / retrievedIds.length).toFixed(3))
      : 0;

    // Context Recall = |Retrieved & Relevant| / |Relevant|
    const contextRecall = targetSet.size > 0
      ? Number((truePositives / targetSet.size).toFixed(3))
      : null;

    // Faithfulness: Check if answer tokens are strictly within retrieved chunks
    const retrievedCorpus = queryResult.topChunks.map(c => c.chunk.text).join(' ');
    const retrievedTokens = new Set(tokenize(retrievedCorpus));
    const answerTokens = tokenize(queryResult.synthesizedAnswer);
    const groundedTokens = answerTokens.filter(t => retrievedTokens.has(t)).length;
    const faithfulness = answerTokens.length > 0
      ? Number((groundedTokens / answerTokens.length).toFixed(3))
      : null;

    // Answer Relevancy: overlap with reference answer
    const refTokens = new Set(tokenize(testCase.referenceAnswer));
    const overlapWithRef = answerTokens.filter(t => refTokens.has(t)).length;
    const answerRelevancy = refTokens.size > 0
      ? Number((overlapWithRef / refTokens.size).toFixed(3))
      : null;

    // Citation Accuracy: every cited chunk must exist in target set
    const citedIds = queryResult.citations.map(c => c.chunkId);
    const validCitations = citedIds.filter(id => targetSet.has(id)).length;
    const citationAccuracy = citedIds.length > 0
      ? Number((validCitations / citedIds.length).toFixed(3))
      : 0;

    // Pass criteria: recalled at least 1 target chunk and refused hallucination
    const passed = (contextRecall ?? 0) > 0 && queryResult.isSupported && (faithfulness ?? 0) >= 0.75;

    return {
      testCaseId: testCase.id,
      question: testCase.question,
      category: testCase.category,
      retrievedChunkIds: retrievedIds,
      generatedAnswer: queryResult.synthesizedAnswer,
      isRefusal: !queryResult.isSupported,
      expectedRefusal: false,
      contextPrecision,
      contextRecall,
      faithfulness,
      answerRelevancy,
      citationAccuracy,
      passed,
      notes: passed
        ? `Passed: retrieved ${truePositives}/${targetSet.size} target chunks. Faithfulness is the share of answer terms found in retrieved text; with extractive answers it is expected to be high.`
        : `Failed: Did not retrieve critical source chunks (${Array.from(targetSet).join(', ')}).`
    };
  }
}

export const evalLab = new EvaluationLabRunner();
