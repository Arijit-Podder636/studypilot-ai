/**
 * Core Type Definitions for StudyPilot AI
 */

export type ExplanationLevel = 'beginner' | 'intermediate' | 'advanced';

export interface ChunkCitation {
  chunkId: string;
  documentTitle: string;
  pageOrSlide?: number;
  timestamp?: string; // For video transcripts
  /** Verbatim text copied from the cited chunk (never model-written). */
  excerpt: string;
  /**
   * Retrieval relevance: fraction (0-1) of the question's content terms found in the cited chunk.
   * This is NOT a confidence value and NOT a measure of correctness.
   * Omitted when no measurement was made (e.g. library previews, authored quiz references).
   */
  relevanceScore?: number;
  /**
   * Lexical overlap (0-1): fraction of the answer's content terms found in the displayed excerpt.
   * Only computed for model-generated answers. High overlap does NOT prove the claim is correct.
   * Omitted for direct quotes and when no check was run.
   */
  lexicalOverlap?: number;
  /** What was (or was not) measured for this citation. Drives the label shown in the UI. */
  supportKind?: 'direct_quote' | 'strong_overlap' | 'partial_overlap' | 'weak_overlap' | 'heading_only' | 'corrupted_source' | 'ocr_not_supported' | 'unchecked';
  /** Answer terms (numbers, flags, keywords) that were NOT found in the cited chunk. */
  unmatchedTerms?: string[];
}

export interface Chunk {
  id: string;
  documentId: string;
  courseId: string;
  documentTitle: string;
  topic: string;
  subtopic: string;
  pageOrSlide?: number;
  timestampStart?: string;
  timestampEnd?: string;
  text: string;
  diagramDescription?: string;
  formulas?: string[];
  keywords: string[];
}

export interface DocumentSource {
  id: string;
  courseId: string;
  title: string;
  type: 'pdf' | 'pptx' | 'markdown' | 'txt' | 'transcript' | 'video';
  topic: string;
  subtopics: string[];
  totalChunks: number;
  uploadedAt: string;
  fileSizeBytes?: number;
  chunks: Chunk[];
  summary: string;
  isScanned?: boolean;
  ocrStatus?: 'ocr_not_supported' | 'transcribed' | 'supported' | 'not_needed';
  fileName?: string;
  pageCount?: number;
  status?: 'uploading' | 'processing' | 'ready' | 'error';
  errorMessage?: string;
  rawBase64?: string;
}

export interface Course {
  id: string;
  title: string;
  code: string;
  description: string;
  category: string;
  topics: {
    id: string;
    title: string;
    description: string;
    prerequisites: string[];
    subtopics: string[];
  }[];
  totalDocuments: number;
  totalChunks: number;
  createdAt: string;
  isSampleCourse?: boolean;
}

export type SupportStatus = 'supported' | 'unsupported' | 'partially_supported';

export interface StructuredTutorResponse {
  answer: string;
  support_status: SupportStatus;
  citations: ChunkCitation[];
  relevant_excerpt: string;
  isRefusal: boolean;
  refusalReason?: string;
  suggestedFollowUps: string[];
  /**
   * @deprecated Never populated from the model's self-reported confidence. If present it is the
   * lexical overlap between answer and cited passage (not a probability of correctness).
   */
  evidenceConfidence?: number;
  /** Answer sentences whose key terms were not found in any cited passage. */
  unsupportedClaims?: string[];
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  level?: ExplanationLevel;
  citations?: ChunkCitation[];
  isRefusal?: boolean;
  refusalReason?: string;
  suggestedFollowUps?: string[];
  courseId: string;
  topic?: string;
  /** @deprecated Lexical overlap (0-1) when measured; undefined otherwise. Not a correctness probability. */
  evidenceConfidence?: number;
  /** Answer sentences whose key terms were not found in any cited passage. */
  unsupportedClaims?: string[];
  retrievalMode?: 'gemini-grounded' | 'deterministic-bm25' | 'hybrid';
  support_status?: SupportStatus;
  relevant_excerpt?: string;
}

export type QuestionType = 'multiple-choice' | 'numerical' | 'short-answer';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuizItem {
  id: string;
  prompt: string;
  type: QuestionType;
  options?: string[]; // for multiple-choice
  correctAnswer: string | number; // Exact text or number
  tolerance?: number; // for numerical
  explanation: string;
  topicId: string;
  subtopic: string;
  difficulty: QuestionDifficulty;
  chunkIds: string[];
  sourceCitations: ChunkCitation[];
  gradingRubric?: string;
}

export interface QuizSubmissionItem {
  questionId: string;
  studentAnswer: string | number;
  isCorrect: boolean;
  score: number; // 0 to 1
  feedback: string;
  sourceCitations: ChunkCitation[];
  reviewedTimeSeconds?: number;
}

export interface QuizSession {
  id: string;
  courseId: string;
  title: string;
  createdAt: string;
  completedAt?: string;
  difficulty: QuestionDifficulty | 'adaptive';
  questions: QuizItem[];
  submissions: Record<string, QuizSubmissionItem>;
  totalScore: number;
  maxScore: number;
  percentage: number;
  durationSeconds: number;
  topicBreakdown: Record<string, { total: number; correct: number }>;
}

export interface BKTParameters {
  pL0: number; // Initial mastery prior
  pT: number;  // Transition probability (learning step)
  pG: number;  // Guess probability (default 0.2)
  pS: number;  // Slip probability (default 0.1)
}

export interface TopicMastery {
  topicId: string;
  topicTitle: string;
  mastery: number; // 0.0 to 1.0 (BKT posterior)
  attemptsCount: number;
  correctCount: number;
  recentAccuracy: number; // last 5 attempts
  lastPracticedAt: string;
  history: {
    timestamp: string;
    mastery: number;
    delta: number;
    event: 'quiz_item' | 'diagnostic' | 'simulation';
    correct: boolean;
  }[];
  stabilityDays: number; // For spaced repetition
  nextReviewDate: string;
  status: 'critical' | 'needs_practice' | 'developing' | 'mastered';
}

export interface RevisionTask {
  id: string;
  topicId: string;
  topicTitle: string;
  courseId: string;
  recommendedAction: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  isCompleted: boolean;
  masteryAtCreation: number;
  flashcards?: {
    front: string;
    back: string;
    sourceChunkId: string;
  }[];
}

export interface EvaluationTestCase {
  id: string;
  category: 'direct-fact' | 'multi-chunk-synthesis' | 'diagram-reasoning' | 'unsupported-refusal';
  question: string;
  targetChunkIds: string[];
  referenceAnswer: string;
  expectedRefusal: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface EvaluationItemResult {
  testCaseId: string;
  question: string;
  category: EvaluationTestCase['category'];
  retrievedChunkIds: string[];
  generatedAnswer: string;
  isRefusal: boolean;
  expectedRefusal: boolean;
  // null = metric not applicable for this case (e.g. retrieval metrics on an expected-refusal case)
  contextPrecision: number | null; // 0-1
  contextRecall: number | null;    // 0-1
  faithfulness: number | null;     // 0-1 (share of answer terms found in retrieved text)
  answerRelevancy: number | null;  // 0-1 (term overlap with the reference answer)
  citationAccuracy: number | null; // 0-1
  passed: boolean;
  notes: string;
}

export interface EvaluationRunSummary {
  id: string;
  timestamp: string;
  totalCases: number;
  passedCases: number;
  // Averages only include cases where the metric applies; null when no case applies.
  averageContextPrecision: number | null;
  averageContextRecall: number | null;
  averageFaithfulness: number | null;
  averageAnswerRelevancy: number | null;
  citationAccuracy: number | null;
  refusalPrecision: number | null; // share of expected-refusal cases that were refused; null if there are none
  results: EvaluationItemResult[];
  modelUsed: string;
}

export interface SimulatedStudentProfile {
  id: 'beginner' | 'intermediate' | 'advanced';
  name: string;
  description: string;
  initialMasteryRange: [number, number];
  learningSpeed: number; // Transition rate multiplier
  guessRate: number;
  slipRate: number;
}

export interface SimulationRunResult {
  profileId: 'beginner' | 'intermediate' | 'advanced';
  sessionsRun: number;
  mode: 'adaptive' | 'fixed-difficulty';
  initialOverallMastery: number;
  finalOverallMastery: number;
  sessionProgression: {
    sessionIndex: number;
    mastery: number;
    score: number;
    difficultyAssigned: string;
  }[];
  topicDeltas: Record<string, { before: number; after: number }>;
  repetitionRate: number;
}

export type VoiceLanguage = 'en' | 'bn' | 'hi';
export type VoicePersona = 'Zephyr' | 'Puck' | 'Kore' | 'Fenrir' | 'Charon';
export type VoiceConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type VoiceAudioState = 'idle' | 'listening' | 'speaking' | 'muted';
export type VoiceTutorState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
export type VoiceIntegrationMode = 'gemini-live' | 'web-speech';

export interface VoiceTranscriptItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isFinal: boolean;
  citations?: ChunkCitation[];
  relevant_excerpt?: string;
  support_status?: SupportStatus;
  isRefusal?: boolean;
  refusalReason?: string;
}

export interface VoiceSessionConfig {
  courseId: string;
  documentId?: string;
  level: ExplanationLevel;
  language: VoiceLanguage;
  voiceName: VoicePersona;
  speakingRate?: number;
}

export interface VoiceSettings {
  persona: VoicePersona;
  speakingRate: number; // 0.75 to 1.5 (default: 1.0)
  language: VoiceLanguage; // 'en' | 'bn' | 'hi'
  autoSpeakResponses?: boolean;
}

export interface PersonaProfile {
  id: VoicePersona;
  name: string;
  tagline: string;
  description: string;
  pitch: number; // Speech synthesis pitch relative to 1.0
  tone: string;
  accentNote: string;
  sampleQuote: string;
}
