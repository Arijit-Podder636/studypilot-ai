import { GoogleGenAI, Type } from '@google/genai';
import { Chunk, ExplanationLevel, StructuredTutorResponse } from '../types';
import { buildTutorResponse } from './tutorResponseBuilder';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiInstance;
}

export async function askGroundedTutor(
  query: string,
  retrievedChunks: Chunk[],
  level: ExplanationLevel = 'intermediate',
  history: { role: string; content: string }[] = []
): Promise<StructuredTutorResponse> {
  const ai = getAiClient();
  if (!ai || retrievedChunks.length === 0) {
    return {
      answer: !ai
        ? 'GEMINI_API_KEY is not configured in server environment.'
        : 'The uploaded material does not provide enough evidence to answer this question.',
      support_status: 'unsupported',
      citations: [],
      relevant_excerpt: '',
      isRefusal: true,
      refusalReason: !ai ? 'GEMINI_API_KEY is not configured in server environment.' : 'No relevant course chunks retrieved.',
      suggestedFollowUps: []
    };
  }

  // Format evidence chunks
  const contextText = retrievedChunks.map((c, idx) => `
[SOURCE CHUNK ${idx + 1}]
ID: ${c.id}
DOCUMENT: ${c.documentTitle}
LOCATION: ${c.pageOrSlide ? `Page/Slide ${c.pageOrSlide}` : c.timestampStart ? `Time ${c.timestampStart}-${c.timestampEnd}` : 'N/A'}
TOPIC: ${c.topic} · ${c.subtopic}
CONTENT:
${c.text}
--------------------
`).join('\n');

  const levelInstructions = {
    beginner: 'Explain with intuitive analogies and concise direct clarity.',
    intermediate: 'Explain with balanced conceptual clarity and precise technical accuracy.',
    advanced: 'Explain with strict technical precision, exact syntax/formulas, and architectural context.'
  }[level];

  const systemInstruction = `
You are StudyPilot AI, a strictly grounded educational tutor.
Your duty is RIGOROUS SOURCE-GROUNDING. You must answer the student's question ONLY using the provided retrieved course evidence.

CRITICAL RULES:
1. TARGETED, DIRECT ANSWERS:
   - For simple factual, syntax, or command questions (e.g. "Which command displays hidden files?", "Which command displays the last 10 lines of a file?"), provide the EXACT direct command/answer immediately (e.g. "ls -la" or "ls -a", "tail -n 10") followed by a brief 1-2 sentence explanation.
   - NEVER dump or reproduce unrelated questions or answers that happen to exist on the same page or document. Answer ONLY what the student asked.
2. STRICT EVIDENCE GROUNDING:
   - If the provided source chunks DO NOT contain sufficient readable evidence to answer the question, you MUST set support_status to "unsupported", isRefusal to true, and answer: "The uploaded material does not provide enough evidence to answer this question."
   - DO NOT hallucinate external knowledge or claim the course material supports something when it does not.
3. STRUCTURED RESPONSE SCHEMA:
   - "answer": Direct, concise answer strictly supported by the evidence.
   - "support_status": "supported" | "unsupported" | "partially_supported".
   - "relevant_excerpt": The exact concise sentence or statement from the retrieved source chunk that directly supports this answer.
   - "citedChunkIds": Array of IDs of chunks directly providing this evidence.
   - "supportingQuotes": For each cited chunk, one object {chunkId, quote} where "quote" is copied VERBATIM (character for character) from that chunk. Never paraphrase inside a quote. Quotes that are not found in the chunk are discarded.
   - "suggestedFollowUps": 2-3 short relevant follow-up questions.
4. Target explanation depth: ${levelInstructions}.
`;

  try {
    const prompt = `
STUDENT QUESTION: "${query}"

RETRIEVED COURSE EVIDENCE:
${contextText}

Generate a structured JSON response matching the required schema.
`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API call timed out after 5000ms')), 5000)
    );

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            support_status: {
              type: Type.STRING,
              enum: ['supported', 'unsupported', 'partially_supported'],
              description: 'Whether the retrieved evidence directly supports the answer.'
            },
            answer: {
              type: Type.STRING,
              description: 'Concise grounded answer. For command/factual questions, provide the exact command/answer directly.'
            },
            relevant_excerpt: {
              type: Type.STRING,
              description: 'The exact concise sentence or statement from the source chunk that contains the supporting evidence.'
            },
            citedChunkIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of chunk IDs directly supporting the claims.'
            },
            isRefusal: {
              type: Type.BOOLEAN,
              description: 'True if course chunks lack sufficient evidence to answer this question.'
            },
            refusalReason: {
              type: Type.STRING,
              description: 'Reason why the question cannot be answered from the provided documents.'
            },
            suggestedFollowUps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2-3 thoughtful follow-up questions.'
            },
            supportingQuotes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  chunkId: { type: Type.STRING },
                  quote: { type: Type.STRING, description: 'Text copied verbatim from that chunk.' }
                },
                required: ['chunkId', 'quote']
              },
              description: 'Verbatim supporting quote for each cited chunk.'
            }
          },
          required: ['support_status', 'answer', 'relevant_excerpt', 'citedChunkIds']
        }
      }
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const parsed = JSON.parse(response.text || '{}');
    return buildTutorResponse(parsed, query, retrievedChunks);
  } catch (error) {
    console.error('Gemini grounded tutor error:', error);
    throw error;
  }
}
