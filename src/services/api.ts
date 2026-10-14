import { Chunk, ExplanationLevel, SupportStatus, TutorMessage } from '../types';
import { RagEngine } from './ragEngine';
import { GroundingVerifier, checkClaims } from './groundingVerifier';

export interface ServerHealth {
  status: string;
  hasGeminiKey: boolean;
  model: string;
  version: string;
}

export class ApiClient {
  private healthCache: ServerHealth | null = null;
  private lastHealthCheck: number = 0;

  public async getHealth(): Promise<ServerHealth> {
    const now = Date.now();
    if (this.healthCache && (now - this.lastHealthCheck < 30000)) {
      return this.healthCache;
    }

    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        this.healthCache = data;
        this.lastHealthCheck = now;
        return data;
      }
    } catch (_) {
      // Offline or network error
    }

    return {
      status: 'offline',
      hasGeminiKey: false,
      model: 'deterministic-bm25-local',
      version: '1.0.0'
    };
  }

  public async askTutor(
    query: string,
    courseId: string,
    allCourseChunks: Chunk[],
    level: ExplanationLevel = 'intermediate',
    history: TutorMessage[] = [],
    selectedDocId?: string | string[]
  ): Promise<TutorMessage> {
    // 1. Retrieve top chunks with strict course- and document-level scoping
    const rag = new RagEngine(allCourseChunks);
    const localResult = rag.evaluateQuerySupport(query, 3, selectedDocId, courseId);
    const topChunks = localResult.topChunks.map(r => r.chunk);

    // If local evaluation determined query is completely unsupported, refuse immediately
    if (!localResult.isSupported) {
      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: localResult.answer,
        timestamp: new Date().toISOString(),
        level,
        citations: [],
        isRefusal: true,
        support_status: 'unsupported',
        relevant_excerpt: '',
        refusalReason: localResult.refusalReason,
        suggestedFollowUps: [
          'What are the core topics covered in this document?',
          'What are the key concepts and formulas presented?',
          'Can you explain the main principles with a direct excerpt?'
        ],
        courseId,
        retrievalMode: 'deterministic-bm25'
      };
    }

    // 2. Try Server-Side Gemini API if key is present
    try {
      const health = await this.getHealth();
      if (health.hasGeminiKey) {
        const historyPayload = history.slice(-4).map(m => ({ role: m.role, content: m.content }));
        const response = await fetch('/api/tutor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            level,
            chunks: topChunks,
            history: historyPayload,
            courseId,
            documentId: selectedDocId
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success') {
            const rawStatus: SupportStatus = data.support_status || (data.isRefusal ? 'unsupported' : 'supported');
            const isUnsupported = rawStatus === 'unsupported' || Boolean(data.isRefusal);

            if (isUnsupported) {
              return {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: data.answer || 'The uploaded material does not provide enough evidence to answer this question.',
                timestamp: new Date().toISOString(),
                level,
                citations: [],
                isRefusal: true,
                support_status: 'unsupported',
                relevant_excerpt: '',
                refusalReason: data.refusalReason || 'Insufficient source evidence in uploaded course materials.',
                suggestedFollowUps: data.suggestedFollowUps || [],
                courseId,
                retrievalMode: 'gemini-grounded'
              };
            }

            // Never trust the server's (or the model's) citations blindly: re-check every one against the
            // real retrieved chunk. A citation only survives if its chunk exists among the passages we
            // sent and the answer's terms actually overlap with the cited text.
            const retrievedIds = new Set(topChunks.map(c => c.id));
            const rawCitations: any[] = Array.isArray(data.citations) ? data.citations : [];
            const checked = rawCitations
              .filter((cit: any) => retrievedIds.has(cit.chunkId))
              .map((cit: any) => {
                const matchedChunk = topChunks.find(c => c.id === cit.chunkId);
                return { matchedChunk, verification: GroundingVerifier.verifyCitation(cit, matchedChunk, data.answer) };
              });

            const kept = checked.filter(
              c => c.verification.status === 'strong_overlap' || c.verification.status === 'partial_overlap'
            );
            const keptCitations = kept.map(c => c.verification.citation);
            const keptChunks = kept.map(c => c.matchedChunk!).filter(Boolean);

            const claimChecks = keptChunks.length > 0 ? checkClaims(data.answer || '', keptChunks) : [];
            const unsupportedClaims = claimChecks.filter(c => !c.supported).map(c => c.claim);
            const anyClaimSupported = claimChecks.some(c => c.supported);

            const finalSupportStatus: SupportStatus =
              keptCitations.length === 0 || !anyClaimSupported
                ? 'unsupported'
                : unsupportedClaims.length > 0 || rawStatus === 'partially_supported'
                ? 'partially_supported'
                : 'supported';
            const finalRefusal = finalSupportStatus === 'unsupported';

            return {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: finalRefusal
                ? 'The uploaded material does not provide enough evidence to answer this question.'
                : data.answer,
              timestamp: new Date().toISOString(),
              level,
              citations: finalRefusal ? [] : keptCitations,
              isRefusal: finalRefusal,
              support_status: finalSupportStatus,
              relevant_excerpt: finalRefusal ? '' : (keptCitations[0]?.excerpt || ''),
              refusalReason: finalRefusal
                ? 'The cited passages did not contain enough of the answer\'s terms to show source support.'
                : undefined,
              suggestedFollowUps: data.suggestedFollowUps || [],
              unsupportedClaims: finalRefusal ? undefined : unsupportedClaims,
              courseId,
              retrievalMode: 'gemini-grounded'
            };
          }
        }
      }
    } catch (err) {
      console.warn('Server Gemini call failed, falling back to local engine:', err);
    }

    // 3. Fallback to local deterministic structured engine
    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: localResult.answer,
      timestamp: new Date().toISOString(),
      level,
      citations: localResult.citations,
      isRefusal: false,
      support_status: 'supported',
      relevant_excerpt: localResult.relevant_excerpt,
      suggestedFollowUps: [
        'How does this command operate with flags and options?',
        'What file permissions affect this command?',
        'Can this command be piped to grep or tail?'
      ],
      courseId,
      retrievalMode: 'deterministic-bm25'
    };
  }
}

export const apiClient = new ApiClient();
