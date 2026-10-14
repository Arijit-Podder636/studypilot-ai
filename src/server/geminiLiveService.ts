import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Chunk, ChunkCitation, ExplanationLevel, SupportStatus, VoiceLanguage, VoicePersona } from '../types';
import { TextValidator } from '../services/textValidator';
import { SAMPLE_DOCUMENTS, LINUX_CA1_DOCUMENT, PROBLEM_STATEMENTS_DOCUMENT } from '../data/sampleCourse';
import { GroundingVerifier, selectSupportingExcerpt } from '../services/groundingVerifier';
import { tokenize } from '../services/ragEngine';

export const GEMINI_LIVE_MODEL = 'gemini-3.8-live';

interface InitPayload {
  type: 'init';
  courseId: string;
  documentId?: string;
  level?: ExplanationLevel;
  language?: VoiceLanguage;
  voiceName?: VoicePersona;
  chunks?: Chunk[];
}

export function buildVoiceSystemInstruction(
  verifiedChunks: Chunk[],
  level: ExplanationLevel = 'intermediate',
  language: VoiceLanguage = 'en'
): string {
  const languageNames: Record<VoiceLanguage, string> = {
    en: 'English',
    bn: 'Bengali (বাংলা)',
    hi: 'Hindi (हिन्दी)'
  };

  const levelInstructions: Record<ExplanationLevel, string> = {
    beginner: 'Explain with intuitive analogies, plain words, and concise clarity.',
    intermediate: 'Explain with balanced conceptual clarity and precise technical accuracy.',
    advanced: 'Explain with strict technical precision, exact syntax/formulas, and architectural depth.'
  };

  const contextText = verifiedChunks.length > 0
    ? verifiedChunks.map((c, idx) => `
[SOURCE PASSAGE ${idx + 1}]
DOCUMENT: ${c.documentTitle}
LOCATION: ${c.pageOrSlide ? `Page ${c.pageOrSlide}` : c.timestampStart ? `Time ${c.timestampStart}-${c.timestampEnd}` : 'N/A'}
TOPIC: ${c.topic} · ${c.subtopic}
CONTENT:
${c.text}
--------------------
`).join('\n')
    : '(No readable course passages provided for this session)';

  return `
You are StudyPilot AI, a friendly, patient, encouraging, and strictly document-grounded voice tutor.
You communicate via spoken audio in real time with students.

PRIMARY LANGUAGE:
The student has selected ${languageNames[language] || 'English'}.
- Converse naturally, politely, and fluently in this language.
- If the student speaks in English, Bengali, or Hindi, respond naturally in the language they speak.
- Maintain standard technical terms and syntax (like Unix commands, neural network layers, or variable names) accurately.

TEACHING STYLE:
- Be friendly, warm, patient, and educational.
- If a student asks for a simpler explanation, break it down using an intuitive real-world analogy.
- If a student asks for an example, provide a practical, illustrative example strictly consistent with the material.
- If a student asks for a hint, provide a thoughtful guiding hint without giving away the full answer immediately.
- Allow and encourage student follow-up questions.
- NEVER claim you know the student's mastery level or learning history unless explicit learner progress data is provided.

RIGOROUS SOURCE GROUNDING (NON-NEGOTIABLE):
1. You must answer ONLY using the verified course passages provided below.
2. If the student's question is NOT answered by these course passages, you MUST say clearly and politely:
   "I am sorry, but your selected course material does not provide enough information to answer that question."
3. NEVER invent facts, outside knowledge, page numbers, book titles, or fabricated document citations.
4. Do NOT attempt to read aloud page numbers or citation metadata in spoken speech; verified citations and exact page references will appear in the student's companion text transcript.
5. Target depth: ${levelInstructions[level] || levelInstructions.intermediate}.

VERIFIED COURSE PASSAGES AVAILABLE FOR THIS SESSION:
${contextText}
`.trim();
}

/**
 * Validates chunks passed from the client against server-side trusted documents,
 * enforcing course/document isolation, readability, and anti-forgery.
 */
export function validateVoiceSessionChunks(
  chunks: Chunk[] = [],
  courseId: string,
  documentId?: string
): Chunk[] {
  if (!Array.isArray(chunks)) return [];

  const trustedChunks = [...SAMPLE_DOCUMENTS, LINUX_CA1_DOCUMENT, PROBLEM_STATEMENTS_DOCUMENT].flatMap(d => d.chunks);
  const trustedMap = new Map(trustedChunks.map(c => [c.id, c]));

  return chunks.filter((c: any) => {
    if (!c || typeof c !== 'object' || !c.id || !c.text || typeof c.text !== 'string') return false;
    if (!TextValidator.validateReadability(c.text).isReadable || TextValidator.containsPdfSyntax(c.text)) return false;

    // Scope check: courseId
    if (courseId && courseId !== 'all') {
      if (!c.courseId || c.courseId !== courseId) {
        return false;
      }
    }

    // Scope check: documentId
    if (documentId && documentId !== 'all') {
      const allowedDocIds = Array.isArray(documentId) ? documentId : [documentId];
      if (allowedDocIds.length > 0) {
        const matchDoc = allowedDocIds.some(
          (id: string) => (c.documentId && c.documentId === id) || (c.documentTitle && c.documentTitle === id)
        );
        if (!matchDoc) {
          return false;
        }
      }
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
}

/**
 * Extracts citations and determines support status from the voice response and query
 * using strictly verified chunk evidence.
 */
export function extractVoiceCitations(
  queryText: string,
  responseText: string,
  verifiedChunks: Chunk[]
): {
  citations: ChunkCitation[];
  relevant_excerpt: string;
  support_status: SupportStatus;
  isRefusal: boolean;
  refusalReason?: string;
} {
  const isRefusal = /does not provide enough (evidence|information)|not answered by (the|these|your) (course|uploaded)|cannot be answered/i.test(responseText);

  if (isRefusal || verifiedChunks.length === 0) {
    return {
      citations: [],
      relevant_excerpt: '',
      support_status: 'unsupported',
      isRefusal: true,
      refusalReason: 'The selected material does not contain sufficient evidence to answer this question.'
    };
  }

  const queryTerms = Array.from(new Set(tokenize(queryText)));
  const answerTerms = new Set(tokenize(responseText));

  // Score each chunk by term overlap with both query and response
  const scoredChunks = verifiedChunks.map(chunk => {
    const chunkTerms = new Set(tokenize(chunk.text));
    const queryOverlap = queryTerms.filter(t => chunkTerms.has(t)).length;
    const answerOverlap = Array.from(answerTerms).filter(t => chunkTerms.has(t)).length;
    const score = (queryOverlap * 2) + answerOverlap;
    return { chunk, score, queryOverlap };
  }).filter(item => item.score > 0);

  scoredChunks.sort((a, b) => b.score - a.score);

  const topMatches = scoredChunks.slice(0, 2);

  if (topMatches.length === 0) {
    return {
      citations: [],
      relevant_excerpt: '',
      support_status: 'partially_supported',
      isRefusal: false
    };
  }

  const citations: ChunkCitation[] = topMatches.map(({ chunk, queryOverlap }) => {
    const excerpt = selectSupportingExcerpt(chunk.text, responseText, { maxSentences: 2, maxChars: 300 });
    const baseCitation: ChunkCitation = {
      chunkId: chunk.id,
      documentTitle: chunk.documentTitle,
      pageOrSlide: chunk.pageOrSlide,
      timestamp: chunk.timestampStart ? `${chunk.timestampStart}-${chunk.timestampEnd}` : undefined,
      excerpt: excerpt || chunk.text.slice(0, 200).trim(),
      relevanceScore: queryTerms.length > 0 ? Number((queryOverlap / queryTerms.length).toFixed(2)) : undefined
    };
    return GroundingVerifier.verifyCitation(baseCitation, chunk, responseText).citation;
  });

  return {
    citations,
    relevant_excerpt: citations[0]?.excerpt || '',
    support_status: 'supported',
    isRefusal: false
  };
}

/**
 * Initializes the WebSocket server for Gemini Live Voice Tutoring.
 */
export function setupLiveTutorWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/api/live-tutor' });

  wss.on('connection', (clientWs: WebSocket) => {
    let geminiLiveSession: any = null;
    let validatedChunks: Chunk[] = [];
    let isInitialized = false;
    let currentTurnUserText = '';
    let currentTurnModelText = '';
    let activeTurnId = `turn-${Date.now()}`;

    const cleanup = () => {
      if (geminiLiveSession) {
        try {
          geminiLiveSession.close();
        } catch (_) {}
        geminiLiveSession = null;
      }
    };

    clientWs.on('message', async (data: any) => {
      try {
        const messageString = data.toString();
        const parsed = JSON.parse(messageString);

        if (parsed.type === 'init') {
          const initPayload = parsed as InitPayload;
          const { courseId, documentId, level = 'intermediate', language = 'en', voiceName = 'Zephyr', chunks = [] } = initPayload;

          // 1. Strict chunk verification
          validatedChunks = validateVoiceSessionChunks(chunks, courseId, documentId);

          // 2. Check server Gemini API key
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            clientWs.send(JSON.stringify({
              type: 'error',
              code: 'NO_API_KEY',
              message: 'GEMINI_API_KEY is not configured in the server environment. Voice tutoring requires a valid Gemini API key. You can continue using document-grounded text chat.',
              fallbackAvailable: true
            }));
            return;
          }

          if (validatedChunks.length === 0) {
            clientWs.send(JSON.stringify({
              type: 'warning',
              code: 'NO_EVIDENCE_CHUNKS',
              message: 'No readable passages were found for the selected course/document scope. The voice tutor will advise if questions exceed available evidence.'
            }));
          }

          // 3. Connect to Gemini Live API
          try {
            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
            });

            const systemInstruction = buildVoiceSystemInstruction(validatedChunks, level, language);

            geminiLiveSession = await ai.live.connect({
              model: GEMINI_LIVE_MODEL,
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName } }
                },
                systemInstruction,
                outputAudioTranscription: {},
                inputAudioTranscription: {}
              },
              callbacks: {
                onmessage: (msg: LiveServerMessage) => {
                  try {
                    const sc = msg.serverContent;

                    // 1. Model Audio Output & Text parts
                    const parts = sc?.modelTurn?.parts || [];
                    for (const part of parts) {
                      if (part.inlineData?.data) {
                        clientWs.send(JSON.stringify({
                          type: 'audio',
                          audio: part.inlineData.data
                        }));
                      }
                      if (part.text && !part.thought) {
                        currentTurnModelText += part.text;
                        clientWs.send(JSON.stringify({
                          type: 'transcript',
                          role: 'assistant',
                          text: currentTurnModelText.trim(),
                          isFinal: false
                        }));
                      }
                    }

                    // Fallback getter data if parts array didn't contain inlineData
                    if (parts.length === 0 && (msg as any).data) {
                      clientWs.send(JSON.stringify({
                        type: 'audio',
                        audio: (msg as any).data
                      }));
                    }

                    // 2. User Input Transcription (streaming ASR from user speech)
                    const inputTx = sc?.inputTranscription?.text || sc?.interimInputTranscription?.text || (sc as any)?.inputAudioTranscription?.text;
                    if (inputTx) {
                      currentTurnUserText += (currentTurnUserText ? ' ' : '') + inputTx.trim();
                      clientWs.send(JSON.stringify({
                        type: 'transcript',
                        role: 'user',
                        text: currentTurnUserText.trim(),
                        isFinal: Boolean(sc?.inputTranscription?.finished)
                      }));
                    }

                    // 3. Model Output Transcription (streaming ASR/TTS for model audio)
                    const modelTx = sc?.outputTranscription?.text || (sc as any)?.outputAudioTranscription?.text;
                    if (modelTx) {
                      currentTurnModelText += modelTx;
                      clientWs.send(JSON.stringify({
                        type: 'transcript',
                        role: 'assistant',
                        text: currentTurnModelText.trim(),
                        isFinal: false
                      }));
                    }

                    // 4. Interruption Signal
                    if (sc?.interrupted) {
                      clientWs.send(JSON.stringify({
                        type: 'interrupted'
                      }));
                      currentTurnModelText = '';
                    }

                    // 5. Turn Complete Signal -> extract citations and finalize transcript turn
                    if (sc?.turnComplete) {
                      const userQuery = currentTurnUserText.trim();
                      const tutorResponse = currentTurnModelText.trim();

                      const citationAnalysis = extractVoiceCitations(userQuery, tutorResponse, validatedChunks);

                      clientWs.send(JSON.stringify({
                        type: 'turn_complete',
                        turnId: activeTurnId,
                        userText: userQuery,
                        tutorText: tutorResponse,
                        ...citationAnalysis
                      }));

                      // Reset turn state
                      currentTurnUserText = '';
                      currentTurnModelText = '';
                      activeTurnId = `turn-${Date.now()}`;
                    }
                  } catch (callbackErr) {
                    console.error('[LiveTutor Gateway] Error in LiveServerMessage callback:', callbackErr);
                  }
                },
                onerror: (err: any) => {
                  console.error('[LiveTutor Gateway] Gemini Live API error:', err);
                  const isQuota = /429|RESOURCE_EXHAUSTED|quota/i.test(err?.message || '');
                  clientWs.send(JSON.stringify({
                    type: 'error',
                    code: isQuota ? 'QUOTA_EXHAUSTED' : 'LIVE_SESSION_ERROR',
                    message: isQuota
                      ? 'Gemini Live API quota exhausted (HTTP 429). The system has preserved your conversation. You can switch to standard text tutoring anytime.'
                      : (err?.message || 'Gemini Live voice session encountered an error.'),
                    fallbackAvailable: true
                  }));
                },
                onclose: () => {
                  clientWs.send(JSON.stringify({ type: 'closed' }));
                }
              }
            });

            // If client disconnected while handshake was in flight, terminate session immediately
            if (clientWs.readyState !== WebSocket.OPEN) {
              if (geminiLiveSession) {
                try {
                  geminiLiveSession.close();
                } catch (_) {}
                geminiLiveSession = null;
              }
              return;
            }

            isInitialized = true;
            clientWs.send(JSON.stringify({
              type: 'ready',
              model: GEMINI_LIVE_MODEL,
              courseId,
              documentId: documentId || 'all',
              language,
              voiceName,
              validatedPassagesCount: validatedChunks.length
            }));
          } catch (connErr: any) {
            console.error('[LiveTutor Gateway] Failed to establish Gemini Live connection:', connErr);
            cleanup();
            const isQuota = /429|RESOURCE_EXHAUSTED|quota/i.test(connErr?.message || '');
            const isModelNotFound = /not found|unsupported|not supported|model/i.test(connErr?.message || '');
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                code: isQuota ? 'QUOTA_EXHAUSTED' : isModelNotFound ? 'MODEL_UNAVAILABLE' : 'CONNECTION_FAILED',
                message: isQuota
                  ? 'Gemini Live API quota exhausted (HTTP 429). Text chat is available without real-time streaming overhead.'
                  : isModelNotFound
                  ? `Gemini Live model (${GEMINI_LIVE_MODEL}) is unavailable or not supported on this project key. Please use standard text chat.`
                  : (connErr?.message || 'Failed to start Gemini Live voice session.'),
                fallbackAvailable: true
              }));
            }
          }
        } else if (parsed.type === 'audio') {
          // Stream real-time input PCM audio to Gemini Live using media (which maps to mediaChunks protobuf field)
          if (geminiLiveSession && parsed.audio) {
            try {
              geminiLiveSession.sendRealtimeInput({
                media: {
                  data: parsed.audio,
                  mimeType: 'audio/pcm;rate=16000'
                },
                audio: {
                  data: parsed.audio,
                  mimeType: 'audio/pcm;rate=16000'
                }
              });
            } catch (forwardErr) {
              console.error('[LiveTutor Gateway] Error forwarding audio to Gemini Live:', forwardErr);
            }
          }
        } else if (parsed.type === 'text') {
          if (geminiLiveSession && parsed.text) {
            try {
              geminiLiveSession.sendRealtimeInput({
                text: parsed.text
              });
            } catch (forwardErr) {
              console.error('[LiveTutor Gateway] Error forwarding text to Gemini Live:', forwardErr);
            }
          }
        } else if (parsed.type === 'end') {
          cleanup();
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'ended' }));
          }
        }
      } catch (msgErr) {
        console.error('WebSocket message parsing error:', msgErr);
      }
    });

    clientWs.on('close', () => {
      cleanup();
    });

    clientWs.on('error', (err) => {
      console.warn('WebSocket client error:', err);
      cleanup();
    });
  });

  return wss;
}
