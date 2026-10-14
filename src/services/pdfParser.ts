/**
 * PDF Parser with Layout Reconstruction, Header/Footer Cleaning, Question-Aware Chunking, and OCR Fallback
 */

import { Chunk, DocumentSource } from '../types';
import { TextValidator } from './textValidator';
import { tokenize } from './ragEngine';
import { DocumentClassifier } from './documentClassifier';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  isOcr: boolean;
  requiresOcr: boolean;
  ocrStatus?: 'ocr_not_supported' | 'requires_ocr' | 'transcribed' | 'not_needed';
}

/**
 * Reconstructs lines and paragraph spacing from pdfjs textContent items using coordinate transforms.
 */
export function reconstructPdfPageText(textContent: any): string {
  if (!textContent || !Array.isArray(textContent.items) || textContent.items.length === 0) {
    return '';
  }

  const items = textContent.items.filter((item: any) => typeof item.str === 'string');
  if (items.length === 0) return '';

  interface LineGroup {
    y: number;
    items: Array<{ str: string; x: number; width: number; height: number }>;
  }

  const lines: LineGroup[] = [];
  const yTolerance = 3.5;

  for (const item of items) {
    const x = item.transform ? item.transform[4] : 0;
    const y = item.transform ? item.transform[5] : 0;
    const width = item.width || 0;
    const height = item.height || 10;

    let foundLine = lines.find(l => Math.abs(l.y - y) <= yTolerance);
    if (!foundLine) {
      foundLine = { y, items: [] };
      lines.push(foundLine);
    }
    foundLine.items.push({ str: item.str, x, width, height });
  }

  // Sort lines from top of page to bottom (descending Y in PDF coordinate space)
  lines.sort((a, b) => b.y - a.y);

  const lineStrings: string[] = [];
  let prevY: number | null = null;
  const paragraphGapThreshold = 18;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    line.items.sort((a, b) => a.x - b.x);

    let lineStr = '';
    let lastRight = -1;

    for (const it of line.items) {
      if (!it.str) continue;
      if (lastRight >= 0 && (it.x - lastRight > 2.5) && !lineStr.endsWith(' ') && !it.str.startsWith(' ')) {
        lineStr += ' ';
      }
      lineStr += it.str;
      lastRight = it.x + it.width;
    }

    const trimmedLine = lineStr.trim();
    if (!trimmedLine) continue;

    if (prevY !== null) {
      const gap = prevY - line.y;
      if (gap > paragraphGapThreshold) {
        lineStrings.push('');
      }
    }

    lineStrings.push(trimmedLine);
    prevY = line.y;
  }

  const rawReconstructed = lineStrings.join('\n');
  return TextValidator.stripHeadersAndFooters(TextValidator.sanitize(rawReconstructed));
}

/**
 * Splits extracted page text into coherent passages, isolating question/answer units and track descriptions.
 */
export function splitTextIntoPassages(pageText: string): string[] {
  const trimmed = pageText.trim();
  if (!trimmed) return [];

  // 1. Detect multiple Track boundaries (e.g. "Track A:", "Track B -", "Track C:")
  const trackMatches = trimmed.match(/(?:^|\n)(?:Track\s+[A-D]\s*[:\-–]\s*[^\n]+)/gi);
  if (trackMatches && trackMatches.length >= 2) {
    const rawBlocks = trimmed.split(/(?=(?:^|\n)(?:Track\s+[A-D]\s*[:\-–]))/i);
    const passages = rawBlocks.map(b => b.trim()).filter(b => {
      if (/^Track\s+[A-D]\s*[:\-–]/i.test(b)) return true;
      // Filter out short header/preamble (< 100 chars)
      if (b.length < 100) return false;
      return b.length > 30;
    });
    if (passages.length > 0) {
      return passages;
    }
  }

  // 2. Detect question boundaries (e.g. "1. ", "1) ", "Q1: ", "Question 1:", "Exercise 1:")
  const questionMatches = trimmed.match(/(?:^|\n)(?:Q(?:uestion)?\s*\d+[\.:\)]?|\b\d+[\.\)]\s+|(?:Exercise|Problem|Task)\s*\d+[\.:]?)/gi);
  if (questionMatches && questionMatches.length >= 2) {
    // Split by question markers while keeping the marker with the passage
    const rawBlocks = trimmed.split(/(?=(?:^|\n)(?:Q(?:uestion)?\s*\d+[\.:\)]?|\b\d+[\.\)]\s+|(?:Exercise|Problem|Task)\s*\d+[\.:]?))/i);
    const passages = rawBlocks.map(b => b.trim()).filter(b => {
      // If block starts with a question marker, keep it
      if (/^(?:Q(?:uestion)?\s*\d+|\b\d+[\.\)]|(?:Exercise|Problem|Task)\s*\d+)/i.test(b)) return true;
      // If block is a short header/title at top (< 80 chars), skip it so it doesn't pollute retrieval
      if (b.length < 80) return false;
      return b.length > 25;
    });
    if (passages.length > 0) {
      return passages;
    }
  }

  // 3. Standard paragraph splitting by double newline
  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 25);

  if (paragraphs.length <= 1) {
    return [trimmed];
  }

  return paragraphs;
}

export class PdfParser {
  /**
   * Detection mechanism: identifies whether pages constitute a scanned or image-only document.
   */
  public static isScannedOrImageOnly(pages: ExtractedPage[]): boolean {
    if (!pages || pages.length === 0) return false;
    return pages.every(p => p.requiresOcr || !p.text || p.text.trim().length === 0 || p.ocrStatus === 'ocr_not_supported');
  }

  /**
   * Extracts readable text page-by-page from binary ArrayBuffer or Uint8Array.
   * Leverages server-side PDF extraction with Gemini multimodal OCR fallback for scanned pages.
   */
  public static async extractPages(
    binaryData: ArrayBuffer | Uint8Array,
    fileName: string
  ): Promise<ExtractedPage[]> {
    const uint8 = binaryData instanceof Uint8Array ? binaryData : new Uint8Array(binaryData);

    if (uint8.length === 0) {
      throw new Error('The PDF file is empty, i.e. its size is zero bytes.');
    }

    const headerStr = Array.from(uint8.subarray(0, 16)).map(b => String.fromCharCode(b)).join('');
    if (!headerStr.includes('%PDF')) {
      throw new Error(`File "${fileName}" is missing standard PDF header (%PDF-). Invalid or corrupted PDF binary.`);
    }

    // 1. In browser environments, attempt server-side extraction (supports Gemini multimodal OCR)
    if (typeof window !== 'undefined') {
      try {
        const base64 = btoa(Array.from(uint8).map(b => String.fromCharCode(b)).join(''));
        const response = await fetch('/api/pdf/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName,
            base64Data: base64
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && Array.isArray(data.pages) && data.pages.length > 0) {
            return data.pages;
          }
        }
      } catch (err) {
        console.warn('Server PDF extraction unavailable, falling back to local client parser:', err);
      }
    }

    // 2. Client-side pdfjs-dist fallback
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjs.getDocument({
        data: uint8,
        useWorkerFetch: false,
        useSystemFonts: true
      });

      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;
      const pages: ExtractedPage[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const reconstructed = reconstructPdfPageText(textContent);

        const check = TextValidator.validateReadability(reconstructed);

        if (check.isReadable) {
          pages.push({
            pageNumber: i,
            text: reconstructed,
            isOcr: false,
            requiresOcr: false,
            ocrStatus: 'not_needed'
          });
        } else if (reconstructed.trim().length === 0) {
          // Detected scanned or image-only page with zero text layer
          pages.push({
            pageNumber: i,
            text: `[Page ${i}: Scanned document page with no embedded text layer. Requires OCR processing (OCR Not Supported).]`,
            isOcr: false,
            requiresOcr: true,
            ocrStatus: 'ocr_not_supported'
          });
        } else {
          // Reject corrupted/unreadable text
          pages.push({
            pageNumber: i,
            text: `[Page ${i}: Unreadable or corrupted page data rejected: ${check.reason}]`,
            isOcr: false,
            requiresOcr: true,
            ocrStatus: 'ocr_not_supported'
          });
        }
      }

      return pages;
    } catch (clientErr: any) {
      console.error('Local pdfjs-dist extraction failed:', clientErr);
      if (clientErr?.name === 'PasswordException' || /password/i.test(clientErr?.message || '')) {
        throw new Error(`PDF document "${fileName}" is password-protected or encrypted. Please remove encryption before uploading.`);
      }
      throw new Error(`Failed to parse PDF document "${fileName}": ${clientErr.message || 'Corrupted or unreadable PDF.'}`);
    }
  }

  /**
   * Converts extracted pages into validated, clean DocumentSource with question-isolated, structural chunks.
   * If a document is detected as scanned or image-only, instead of returning empty text, it triggers
   * an "OCR Not Supported" status with a structured preview chunk.
   */
  public static createDocumentFromPages(
    fileName: string,
    pages: ExtractedPage[],
    courseId: string,
    topicName?: string,
    fileSizeBytes: number = 0,
    existingDocId?: string,
    rawBase64?: string
  ): DocumentSource {
    const docId = existingDocId || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const chunks: Chunk[] = [];

    // Detection mechanism: check if document is scanned or image-only
    const isScanned = this.isScannedOrImageOnly(pages);

    if (isScanned) {
      chunks.push({
        id: `chk-${docId.substring(4, 9)}-p1-ocr`,
        documentId: docId,
        courseId,
        documentTitle: fileName,
        topic: 'Scanned / Image-Only Document',
        subtopic: 'OCR Not Supported',
        pageOrSlide: 1,
        text: '[OCR Not Supported] Scanned or image-only PDF detected with no embedded text layer. Machine-readable text extraction is not available for this document.',
        keywords: ['scanned', 'image-only', 'ocr-not-supported', 'no-text-layer']
      });

      return {
        id: docId,
        courseId,
        title: fileName,
        type: 'pdf',
        topic: 'Scanned Document (OCR Not Supported)',
        subtopics: ['OCR Not Supported'],
        totalChunks: 1,
        uploadedAt: new Date().toISOString(),
        fileSizeBytes,
        chunks,
        isScanned: true,
        ocrStatus: 'ocr_not_supported',
        fileName,
        pageCount: pages.length,
        status: 'ready',
        rawBase64,
        summary: `Scanned or image-only document (${pages.length} pages). OCR is not supported; machine-readable text could not be extracted.`
      };
    }

    // Analyze extracted readable text across pages (ignore placeholder OCR notices for classification)
    const readablePageTexts = pages
      .filter(p => !p.requiresOcr && !p.text.startsWith('[Page'))
      .map(p => p.text);
    const classification = DocumentClassifier.classify(fileName, readablePageTexts);

    // Document subject strictly from content, never default unrelated course topics
    const resolvedDocTopic = classification.isReliable
      ? classification.subject
      : (topicName && topicName !== 'Optimization & Loss Functions' ? topicName : 'Unclassified');

    pages.forEach((page) => {
      // Never index OCR placeholder notices as if they were actual document knowledge
      if (page.requiresOcr || page.text.startsWith('[Page')) {
        return;
      }

      // Split page into coherent passages / question units / track units
      const passages = splitTextIntoPassages(page.text);

      passages.forEach((passage, pIdx) => {
        const check = TextValidator.validateReadability(passage);
        if (!check.isReadable) return;

        // Classify passage for topic, subtopic, and keywords
        const passageInfo = DocumentClassifier.classifyPassage(
          passage,
          classification.category,
          resolvedDocTopic,
          page.pageNumber,
          pIdx
        );

        const tokens = tokenize(passage);
        // Extract command flags and keyword tokens
        const commandTokens = (passage.match(/\b(?:ls|cp|mv|tail|head|cat|grep|chmod|chown|mkdir|rm|find|ps|kill|df|du)\b|-[a-zA-Z0-9]+/g) || [])
          .map(t => t.toLowerCase());

        const mergedKeywords = Array.from(new Set([...passageInfo.keywords, ...commandTokens, ...tokens])).slice(0, 10);

        // If transcribed via AI multimodal OCR, transparently label subtopic
        const subtopicLabel = page.isOcr
          ? `${passageInfo.subtopic} [AI transcription]`
          : passageInfo.subtopic;

        chunks.push({
          id: `chk-${docId.substring(4, 9)}-p${page.pageNumber}-${pIdx + 1}`,
          documentId: docId,
          courseId,
          documentTitle: fileName,
          topic: passageInfo.topic,
          subtopic: subtopicLabel,
          pageOrSlide: page.pageNumber,
          text: passage,
          keywords: mergedKeywords
        });
      });
    });

    const ocrCount = pages.filter(p => p.requiresOcr).length;
    let summary: string;
    if (pages.length > 0 && ocrCount === pages.length) {
      summary = `Scanned document with no embedded text layer (${pages.length} pages flagged for OCR; 0 usable passages indexed).`;
    } else if (ocrCount > 0) {
      summary = `Extracted ${pages.length} pages (${chunks.length} readable passages indexed; ${ocrCount} pages flagged for OCR without usable text).`;
    } else {
      summary = `Extracted ${pages.length} pages (${chunks.length} verified passages with preserved page citations).`;
    }

    return {
      id: docId,
      courseId,
      title: fileName,
      type: 'pdf',
      topic: resolvedDocTopic,
      subtopics: Array.from(new Set(chunks.map(c => c.topic))),
      totalChunks: chunks.length,
      uploadedAt: new Date().toISOString(),
      fileSizeBytes,
      chunks,
      fileName,
      pageCount: pages.length,
      status: 'ready',
      rawBase64,
      summary
    };
  }
}
