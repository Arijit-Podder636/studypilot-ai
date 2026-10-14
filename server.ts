import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { askGroundedTutor } from './src/server/geminiService';
import { reconstructPdfPageText } from './src/services/pdfParser';
import { TextValidator } from './src/services/textValidator';
import { SAMPLE_DOCUMENTS, LINUX_CA1_DOCUMENT, PROBLEM_STATEMENTS_DOCUMENT } from './src/data/sampleCourse';
import { setupLiveTutorWebSocket, GEMINI_LIVE_MODEL } from './src/server/geminiLiveService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Set request payload limit to 35MB (supports 25MB raw file base64 data)
  app.use(express.json({ limit: '35mb' }));

  // --- API Routes ---
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      model: 'gemini-3.8-flash',
      liveModel: GEMINI_LIVE_MODEL,
      version: '1.0.0'
    });
  });

  app.post('/api/pdf/extract', async (req, res) => {
    try {
      const { fileName = 'document.pdf', base64Data } = req.body || {};
      if (!base64Data || typeof base64Data !== 'string') {
        return res.status(400).json({ status: 'error', error: 'Missing or invalid base64Data' });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length < 32) {
        return res.status(400).json({ status: 'error', error: 'Uploaded file is empty or too small to be a valid PDF.' });
      }

      // Validate %PDF magic number header
      const headerString = buffer.subarray(0, 16).toString('utf-8');
      if (!headerString.includes('%PDF')) {
        return res.status(400).json({ status: 'error', error: 'File is missing standard PDF header (%PDF-).' });
      }

      const uint8 = new Uint8Array(buffer);

      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjs.getDocument({
        data: uint8,
        useWorkerFetch: false,
        useSystemFonts: true
      });

      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;
      const pages: Array<{ pageNumber: number; text: string; isOcr: boolean; requiresOcr: boolean }> = [];

      let anyPageNeedsOcr = false;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = reconstructPdfPageText(textContent);

        if (pageText.length > 25) {
          pages.push({
            pageNumber: i,
            text: pageText,
            isOcr: false,
            requiresOcr: false
          });
        } else {
          anyPageNeedsOcr = true;
          pages.push({
            pageNumber: i,
            text: '',
            isOcr: false,
            requiresOcr: true
          });
        }
      }

      // If scanned pages exist and Gemini API key is configured, perform multimodal OCR
      if (anyPageNeedsOcr && process.env.GEMINI_API_KEY) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });

          const ocrResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Data
                }
              },
              {
                text: 'Transcribe the text of this PDF page by page. For each page, format strictly as: "=== PAGE X ===" on its own line followed by the verbatim text of that page.'
              }
            ]
          });

          const ocrText = ocrResponse.text || '';
          pages.forEach((p) => {
            if (p.requiresOcr) {
              const regex = new RegExp(`===\\s*PAGE\\s*${p.pageNumber}\\s*===([\\s\\S]*?)(?====\\s*PAGE|$)`, 'i');
              const match = ocrText.match(regex);
              if (match && match[1].trim().length > 30) {
                p.text = match[1].trim();
                p.isOcr = true;
                p.requiresOcr = false;
              } else {
                p.text = `[Page ${p.pageNumber}: Scanned document page with no embedded text layer. Requires OCR processing.]`;
              }
            }
          });
        } catch (ocrErr) {
          console.warn('Gemini multimodal OCR fallback error:', ocrErr);
          pages.forEach(p => {
            if (p.requiresOcr && !p.text) {
              p.text = `[Page ${p.pageNumber}: Scanned document page with no embedded text layer. Requires OCR processing.]`;
            }
          });
        }
      } else {
        pages.forEach(p => {
          if (p.requiresOcr && !p.text) {
            p.text = `[Page ${p.pageNumber}: Scanned document page with no embedded text layer. Requires OCR processing.]`;
          }
        });
      }

      const allScanned = pages.every(p => p.requiresOcr);
      res.json({
        status: 'success',
        fileName,
        numPages,
        allScanned,
        pages
      });
    } catch (err: any) {
      console.error('Error in /api/pdf/extract:', err);
      const isEncrypted = err?.name === 'PasswordException' || /password|encrypted/i.test(err?.message || '');
      const statusCode = isEncrypted ? 400 : 500;
      res.status(statusCode).json({
        status: 'error',
        code: isEncrypted ? 'ENCRYPTED_PDF' : 'EXTRACTION_FAILED',
        message: isEncrypted
          ? 'The PDF document is password-protected or encrypted. Please remove encryption before uploading.'
          : err.message || 'Failed to extract PDF text'
      });
    }
  });

  app.post('/api/tutor/chat', async (req, res) => {
    const {
      query = '',
      level = 'intermediate',
      chunks = [],
      history = [],
      courseId,
      documentId
    } = req.body || {};

    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({
          status: 'fallback',
          message: 'Server GEMINI_API_KEY is not configured. Switching to local deterministic RAG engine.'
        });
      }

      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: 'Missing or empty query parameter' });
      }

      if (!Array.isArray(chunks)) {
        return res.status(400).json({ error: 'Chunks must be an array' });
      }

      // Build trusted chunk registry from known course materials to detect forged chunks
      const trustedChunks = [...SAMPLE_DOCUMENTS, LINUX_CA1_DOCUMENT, PROBLEM_STATEMENTS_DOCUMENT].flatMap(d => d.chunks);
      const trustedChunkMap = new Map(trustedChunks.map(c => [c.id, c]));

      // Server-side validation of chunks:
      // 1. Must be valid structure with text
      // 2. Must pass text readability and have no PDF syntax
      // 3. Must match requested courseId and documentId if specified
      // 4. If chunk ID matches a known trusted chunk, text must not be forged
      const validatedChunks = chunks.filter((c: any) => {
        if (!c || typeof c !== 'object' || !c.id || !c.text || typeof c.text !== 'string') return false;
        if (!TextValidator.validateReadability(c.text).isReadable || TextValidator.containsPdfSyntax(c.text)) return false;

        // Scope validation: courseId
        if (courseId && courseId !== 'all') {
          if (!c.courseId || c.courseId !== courseId) {
            console.warn(`[Server Security] Rejected chunk ${c.id}: course mismatch (expected ${courseId}, got ${c.courseId})`);
            return false;
          }
        }

        // Scope validation: documentId (can be string or string[])
        if (documentId && documentId !== 'all') {
          const allowedDocIds = Array.isArray(documentId) ? documentId : [documentId];
          if (allowedDocIds.length > 0) {
            const matchDoc = allowedDocIds.some(
              (id: string) => (c.documentId && c.documentId === id) || (c.documentTitle && c.documentTitle === id)
            );
            if (!matchDoc) {
              console.warn(`[Server Security] Rejected chunk ${c.id}: document mismatch (expected one of ${allowedDocIds.join(',')}, got ${c.documentId})`);
              return false;
            }
          }
        }

        // Anti-forgery check against server trusted corpus
        const trusted = trustedChunkMap.get(c.id);
        if (trusted) {
          // If known chunk ID, compare normalized text
          const normIncoming = c.text.replace(/\s+/g, ' ').trim();
          const normTrusted = trusted.text.replace(/\s+/g, ' ').trim();
          if (normIncoming !== normTrusted) {
            console.warn(`[Server Security] Rejected chunk ${c.id}: text does not match trusted server corpus (tampering detected)`);
            return false;
          }
        }

        return true;
      });

      if (validatedChunks.length === 0) {
        return res.json({
          status: 'success',
          answer: 'The selected course material does not provide enough evidence to answer this question.',
          support_status: 'unsupported',
          citations: [],
          relevant_excerpt: '',
          isRefusal: true,
          refusalReason: 'Source chunks failed server verification or did not match the requested course scope.',
          suggestedFollowUps: []
        });
      }

      const result = await askGroundedTutor(query, validatedChunks, level, history);
      res.json({
        status: 'success',
        ...result
      });
    } catch (err: any) {
      // The client answers locally (extractive, scoped to the selected document) when told to fall back.
      // We never fabricate an answer or confidence here.
      console.warn('Gemini tutor generation failed; instructing client to use the local extractive engine:', err?.message || err);
      res.json({
        status: 'fallback',
        message: 'The AI service could not produce an answer. Showing text extracted directly from your document instead.'
      });
    }
  });

  // --- Vite Dev Server Middleware or Static Production Serving ---
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);
  setupLiveTutorWebSocket(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`StudyPilot AI Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
