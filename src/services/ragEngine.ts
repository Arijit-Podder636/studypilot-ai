import { Chunk, ChunkCitation, DocumentSource, SupportStatus } from '../types';
import { TextValidator } from './textValidator';
import { excerptIsFromChunk, isBareHeadingText, selectSupportingExcerpt } from './groundingVerifier';

// Standard English stop words for academic TF-IDF retrieval
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have',
  'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into',
  'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
  'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
  'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where',
  'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would',
  'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

export function tokenize(text: string): string[] {
  if (!text) return [];
  // Tokenize preserving alphanumeric terms, hyphens for flags (e.g. -la, -a), and underscores
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter(token => {
      if (STOP_WORDS.has(token)) return false;
      // Keep single-letter or 2-letter tokens if they are CLI commands/flags (e.g. ls, cp, mv, -a, -n)
      if (token.length === 1) return /^[a-z0-9]$/.test(token);
      return token.length > 1;
    });
}

export interface RetrievalResult {
  chunk: Chunk;
  score: number;
  matchedTokens: string[];
}

export interface GroundedQueryResult {
  query: string;
  isSupported: boolean;
  support_status: SupportStatus;
  /**
   * Local (non-AI) engine: the passage text copied verbatim from the best-matching chunk.
   * Nothing is generated or paraphrased. When unsupported, an honest insufficient-evidence message.
   */
  answer: string;
  /** Verbatim text from the retrieved chunk; empty when unsupported. */
  relevant_excerpt: string;
  refusalReason?: string;
  topChunks: RetrievalResult[];
  citations: ChunkCitation[];
  /** Fraction (0-1) of the question's content terms found in the best chunk. 0 when unsupported. */
  retrievalRelevance: number;
  /** @deprecated Alias of retrievalRelevance. It is NOT a confidence or correctness measure. */
  confidence: number;
  synthesizedAnswer: string;
}

export class RagEngine {
  private chunks: Chunk[] = [];
  private idfMap: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private readonly k1 = 1.2;
  private readonly b = 0.75;
  private readonly relevanceThreshold = 0.80;

  constructor(chunks: Chunk[] = []) {
    this.indexChunks(chunks);
  }

  public indexChunks(chunks: Chunk[]): void {
    this.chunks = chunks;
    if (chunks.length === 0) return;

    const totalDocs = chunks.length;
    let totalLength = 0;
    const docFreq = new Map<string, number>();

    chunks.forEach(chunk => {
      const keywordsStr = (chunk.keywords || []).join(' ');
      const fullText = `${chunk.topic || ''} ${chunk.subtopic || ''} ${chunk.text || ''} ${keywordsStr}`;
      const tokens = new Set(tokenize(fullText));
      totalLength += tokens.size;

      tokens.forEach(token => {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      });
    });

    this.avgDocLength = totalLength / totalDocs;
    this.idfMap.clear();

    docFreq.forEach((df, term) => {
      const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
      this.idfMap.set(term, Math.max(idf, 0.1));
    });
  }

  /**
   * Retrieves relevant chunks with strict document and course scoping.
   * Calculates retrieval statistics (IDF and document lengths) within the scoped candidate set
   * to ensure unrelated courses or documents cannot distort scoring or bleed into results.
   */
  public retrieve(
    query: string,
    topK: number = 3,
    filterDocId?: string | string[],
    filterCourseId?: string
  ): RetrievalResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 || this.chunks.length === 0) return [];

    let candidates = this.chunks;
    if (filterCourseId && filterCourseId !== 'all') {
      candidates = candidates.filter(c => c.courseId === filterCourseId);
    }
    if (filterDocId && filterDocId !== 'all') {
      const allowedDocIds = Array.isArray(filterDocId) ? filterDocId : [filterDocId];
      if (allowedDocIds.length > 0) {
        candidates = candidates.filter(c =>
          allowedDocIds.includes(c.documentId) || allowedDocIds.includes(c.documentTitle)
        );
      }
    }

    if (candidates.length === 0) return [];

    // Calculate scoped retrieval statistics for isolated candidates
    const scopedDocFreq = new Map<string, number>();
    let scopedTotalLength = 0;
    const scopedDocCount = candidates.length;

    candidates.forEach(chunk => {
      const keywordsStr = (chunk.keywords || []).join(' ');
      const fullText = `${chunk.topic || ''} ${chunk.subtopic || ''} ${chunk.text || ''} ${keywordsStr}`;
      const tokens = new Set(tokenize(fullText));
      scopedTotalLength += tokens.size;
      tokens.forEach(t => {
        scopedDocFreq.set(t, (scopedDocFreq.get(t) || 0) + 1);
      });
    });

    const scopedAvgDocLength = scopedTotalLength / (scopedDocCount || 1);

    const scores: { chunk: Chunk; score: number; matchedTokens: string[] }[] = [];

    candidates.forEach(chunk => {
      const keywordsStr = (chunk.keywords || []).join(' ');
      const fullText = `${chunk.topic || ''} ${chunk.subtopic || ''} ${chunk.text || ''} ${keywordsStr}`;
      const docTokens = tokenize(fullText);
      const docLength = docTokens.length;

      const tfMap = new Map<string, number>();
      docTokens.forEach(t => tfMap.set(t, (tfMap.get(t) || 0) + 1));

      let score = 0;
      const matchedTokens: string[] = [];

      queryTokens.forEach(qToken => {
        const tf = tfMap.get(qToken) || 0;
        if (tf > 0) {
          matchedTokens.push(qToken);
          const df = scopedDocFreq.get(qToken) || 1;
          const idf = Math.max(0.1, Math.log(1 + (scopedDocCount - df + 0.5) / (df + 0.5)));
          const numerator = tf * (this.k1 + 1);
          const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / (scopedAvgDocLength || 1)));
          score += idf * (numerator / denominator);
        }
      });

      // Bonus for topic or keyword direct overlap
      const topicTokens = tokenize(`${chunk.topic || ''} ${chunk.subtopic || ''}`);
      const hasTopicWord = queryTokens.some(qt => topicTokens.includes(qt));
      if (hasTopicWord) score *= 1.25;

      // Bonus for exact keyword matches (e.g. 'hidden', 'files', 'ls', 'tail', 'head', 'mv', 'cp')
      const keywordSet = new Set((chunk.keywords || []).map(k => k.toLowerCase()));
      const keywordMatches = queryTokens.filter(qt => keywordSet.has(qt));
      if (keywordMatches.length > 0) {
        score += keywordMatches.length * 0.5;
      }

      // Penalize chunks that don't match critical content words
      const contentTokens = queryTokens.filter(t => t.length >= 3);
      const contentMatches = matchedTokens.filter(t => t.length >= 3);
      if (contentTokens.length >= 2 && contentMatches.length === 0) {
        score = 0;
      }

      if (score > 0) {
        scores.push({ chunk, score, matchedTokens: Array.from(new Set(matchedTokens)) });
      }
    });

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  /**
   * Evaluates whether the indexed material can answer a question within the specified scope.
   * Follows the exact same course and document isolation boundary as retrieval.
   *
   * When it can, the "answer" is the best-matching passage text copied verbatim from the retrieved
   * chunk (extractive). This method never writes answer text of its own: there are no canned or
   * template answers, so everything shown came from the uploaded document.
   */
  public evaluateQuerySupport(
    query: string,
    topK: number = 3,
    filterDocId?: string | string[],
    filterCourseId?: string
  ): GroundedQueryResult {
    let validChunks = this.chunks.filter(c => {
      const check = TextValidator.validateReadability(c.text);
      return check.isReadable && !TextValidator.containsPdfSyntax(c.text);
    });

    if (filterCourseId && filterCourseId !== 'all') {
      validChunks = validChunks.filter(c => c.courseId === filterCourseId);
    }
    if (filterDocId && filterDocId !== 'all') {
      const allowedDocIds = Array.isArray(filterDocId) ? filterDocId : [filterDocId];
      if (allowedDocIds.length > 0) {
        validChunks = validChunks.filter(c =>
          allowedDocIds.includes(c.documentId) || allowedDocIds.includes(c.documentTitle)
        );
      }
    }

    const insufficient = (reason: string): GroundedQueryResult => {
      const answer = 'The uploaded course material does not provide enough evidence to answer this question.';
      return {
        query,
        isSupported: false,
        support_status: 'unsupported',
        answer,
        relevant_excerpt: '',
        refusalReason: reason,
        topChunks: [],
        citations: [],
        retrievalRelevance: 0,
        confidence: 0,
        synthesizedAnswer: answer
      };
    };

    if (validChunks.length === 0) {
      return insufficient('The selected document/course contains no readable passages matching this scope.');
    }

    const scopedEngine = new RagEngine(validChunks);
    const results = scopedEngine.retrieve(query, topK, filterDocId, filterCourseId);
    const topScore = results.length > 0 ? results[0].score : 0;
    const topChunkMatches = results.length > 0 ? results[0].matchedTokens : [];

    // Retrieval gate: the top chunk must match at least 2 question terms and reach the score threshold.
    const retrievalSupported = topScore >= this.relevanceThreshold && topChunkMatches.length >= 2 && results.length > 0;
    if (!retrievalSupported) {
      return {
        ...insufficient('The uploaded course material does not contain readable passages that match this question. No external knowledge was used.'),
        topChunks: results
      };
    }

    const primary = results[0].chunk;

    // Evidence = real text from the chunk. Prefer an explicit "Answer: ..." line when the source has one.
    let answer = '';
    let relevant_excerpt = '';
    const answerMatch = primary.text.match(/Answer:\s*([^\n]+(?:\n[^\n]+)?)/i);
    if (answerMatch) {
      answer = answerMatch[1].trim();
      relevant_excerpt = answerMatch[0].trim();
    } else {
      relevant_excerpt = selectSupportingExcerpt(primary.text, query, { maxSentences: 2, maxChars: 320 });
      answer = relevant_excerpt;
    }

    // A section title alone (or an excerpt that is not really in the chunk) is not evidence.
    if (!relevant_excerpt || isBareHeadingText(relevant_excerpt) || !excerptIsFromChunk(relevant_excerpt, primary.text)) {
      return {
        ...insufficient('The best-matching passage is only a heading and contains no explanatory text to answer from.'),
        topChunks: results
      };
    }

    const queryTerms = Array.from(new Set(tokenize(query)));
    const retrievalRelevance = queryTerms.length > 0
      ? Number((topChunkMatches.length / queryTerms.length).toFixed(2))
      : 0;

    const citation: ChunkCitation = {
      chunkId: primary.id,
      documentTitle: primary.documentTitle,
      pageOrSlide: primary.pageOrSlide,
      timestamp: primary.timestampStart ? `${primary.timestampStart}-${primary.timestampEnd}` : undefined,
      excerpt: relevant_excerpt,
      relevanceScore: retrievalRelevance, // share of question terms found in this chunk (retrieval only)
      supportKind: 'direct_quote' // the answer IS this passage, so no separate claim check applies
    };

    return {
      query,
      isSupported: true,
      support_status: 'supported',
      answer,
      relevant_excerpt,
      topChunks: results,
      citations: [citation],
      retrievalRelevance,
      confidence: retrievalRelevance,
      synthesizedAnswer: answer
    };
  }

  public static parseRawDocument(
    title: string,
    rawText: string,
    fileType: DocumentSource['type'],
    courseId: string,
    detectedTopic?: string
  ): DocumentSource {
    const sanitizedText = TextValidator.stripHeadersAndFooters(TextValidator.sanitize(rawText));
    const readability = TextValidator.validateReadability(sanitizedText);
    if (!readability.isReadable) {
      throw new Error(`Document content rejected: ${readability.reason}`);
    }

    const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const paragraphs = sanitizedText
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 30 && TextValidator.validateReadability(p).isReadable);

    const chunks: Chunk[] = [];

    paragraphs.forEach((para, idx) => {
      const tokens = tokenize(para);
      const topKeywords = Array.from(new Set(tokens)).slice(0, 8);
      const chunkId = `chk-${docId.substring(4, 9)}-${idx + 1}`;
      const pageOrSlide = idx + 1;

      chunks.push({
        id: chunkId,
        documentId: docId,
        courseId,
        documentTitle: title,
        topic: detectedTopic || 'General Study Material',
        subtopic: `Section ${pageOrSlide}`,
        pageOrSlide: fileType === 'pdf' || fileType === 'pptx' ? pageOrSlide : undefined,
        text: para,
        keywords: topKeywords
      });
    });

    return {
      id: docId,
      courseId,
      title,
      type: fileType,
      topic: detectedTopic || 'General Study Material',
      subtopics: chunks.map(c => c.subtopic),
      totalChunks: chunks.length,
      uploadedAt: new Date().toISOString(),
      fileSizeBytes: rawText.length,
      chunks,
      summary: `Parsed ${chunks.length} structural chunks from ${title} (${fileType.toUpperCase()}).`
    };
  }
}
