/**
 * StudyPilot AI - Smoke & Unit Tests
 * Validates RAG retrieval, Bayesian Knowledge Tracing updates, deterministic quiz grading, and refusal logic.
 */

import { RagEngine, tokenize } from '../src/services/ragEngine';
import { LearnerModelEngine, DEFAULT_BKT_PARAMS } from '../src/services/learnerModel';
import { QuizEngine, VERIFIED_QUESTION_BANK } from '../src/services/quizEngine';
import { EvaluationLabRunner } from '../src/services/evaluationLab';
import { SAMPLE_DOCUMENTS } from '../src/data/sampleCourse';

export function runAllTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string) {
    if (condition) {
      passed += 1;
    } else {
      failed += 1;
      errors.push(`Assertion failed: ${testName}`);
    }
  }

  // 1. Tokenizer Test
  const tokens = tokenize("Mean Squared Error (MSE) calculates residuals!");
  assert(tokens.includes('mean') && tokens.includes('squared') && tokens.includes('residuals'), 'Tokenizer extracts content words');
  assert(!tokens.includes('the') && !tokens.includes('and'), 'Tokenizer strips stop words');

  // 2. RAG Retrieval & Relevance
  const allChunks = SAMPLE_DOCUMENTS.flatMap(d => d.chunks);
  const rag = new RagEngine(allChunks);
  const optResults = rag.retrieve('Mean Squared Error outlier penalty', 3);
  assert(optResults.length > 0 && optResults[0].chunk.id === 'chk-opt-01', 'RAG retrieves correct MSE chunk for MSE query');

  // 3. Unsupported Query Refusal
  const unsupportedResult = rag.evaluateQuerySupport('Roman military battle of Zama and Hannibal elephants');
  assert(!unsupportedResult.isSupported, 'RAG correctly flags out-of-domain historical query as unsupported');
  assert(unsupportedResult.citations.length === 0, 'Unsupported query yields zero citations');

  // 4. Bayesian Knowledge Tracing Update Formula
  const bkt = new LearnerModelEngine(DEFAULT_BKT_PARAMS);
  const prior = 0.20;
  const correctUpdate = bkt.updateMastery(prior, true);
  assert(correctUpdate.newMastery > prior, 'Correct response increases mastery posterior');
  assert(correctUpdate.delta > 0, 'Positive mastery delta on correct response');

  const incorrectUpdate = bkt.updateMastery(0.70, false);
  assert(incorrectUpdate.newMastery < 0.70, 'Incorrect response decreases mastery posterior');

  // 5. Deterministic Quiz Grading
  const mcQuestion = VERIFIED_QUESTION_BANK.find(q => q.type === 'multiple-choice')!;
  const correctMC = QuizEngine.evaluateAnswer(mcQuestion, mcQuestion.correctAnswer);
  assert(correctMC.isCorrect && correctMC.score === 1.0, 'MC question evaluated correctly on exact match');

  const wrongMC = QuizEngine.evaluateAnswer(mcQuestion, 'Totally wrong choice');
  assert(!wrongMC.isCorrect && wrongMC.score === 0.0, 'MC question marks incorrect response as 0');

  // Numerical Tolerance
  const numQuestion = VERIFIED_QUESTION_BANK.find(q => q.type === 'numerical')!;
  const correctNum = QuizEngine.evaluateAnswer(numQuestion, numQuestion.correctAnswer);
  assert(correctNum.isCorrect, 'Numerical question satisfies exact value');

  // 6. Evaluation Lab Suite Execution
  const evalRunner = new EvaluationLabRunner();
  const singleEval = evalRunner.evaluateSingleCase({
    id: 'test-case-mse',
    category: 'direct-fact',
    question: 'What is the formula for Mean Squared Error?',
    targetChunkIds: ['chk-opt-01'],
    referenceAnswer: 'L_MSE = (1/N) * sum (y_i - y_hat_i)^2',
    expectedRefusal: false,
    difficulty: 'easy'
  });
  assert(singleEval.passed, 'Evaluation runner passes verified MSE test case');

  return { passed, failed, errors };
}

// Self-run when executed directly via tsx
const result = runAllTests();
console.log(`Smoke Tests: ${result.passed} passed, ${result.failed} failed.`);
if (result.errors.length > 0) {
  console.error('Errors:', result.errors);
}
