/**
 * Text Validation and PDF Syntax Sanitization Gate
 * Prevents raw PDF internals, compressed streams, and binary noise from being indexed.
 */

const PDF_INTERNAL_PATTERNS = [
  /%PDF-\d\.\d/i,
  /\/Type\s*\/(Catalog|Pages|Page|Font|XObject)/i,
  /\/MediaBox\s*\[/i,
  /\bendobj\b/i,
  /\bobj\s*<<\b/i,
  /\bstream[\r\n]/i,
  /\bendstream\b/i,
  /\/Filter\s*\/FlateDecode/i,
  /\/Length\s+\d+/i,
  /\/Root\s+\d+\s+\d+\s+R/i,
  /\bxref\b[\r\n]/i,
  /\btrailer\s*<</i,
  /\/Contents\s+\d+\s+\d+\s+R/i
];

export interface ReadabilityCheckResult {
  isReadable: boolean;
  printableRatio: number;
  wordCount: number;
  hasPdfSyntax: boolean;
  reason?: string;
}

export class TextValidator {
  /**
   * Detects whether text contains raw PDF internal syntax or object streams.
   */
  public static containsPdfSyntax(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    let matchCount = 0;
    for (const pattern of PDF_INTERNAL_PATTERNS) {
      if (pattern.test(text)) {
        matchCount++;
      }
    }
    // If it matches 2 or more signature PDF object tokens, or contains %PDF- header
    return matchCount >= 2 || /%PDF-\d\.\d/.test(text) || /\bendobj\b/.test(text) && /\bstream\b/.test(text);
  }

  /**
   * Assesses if text is valid human-readable educational content.
   */
  public static validateReadability(text: string): ReadabilityCheckResult {
    if (!text || text.trim().length === 0) {
      return {
        isReadable: false,
        printableRatio: 0,
        wordCount: 0,
        hasPdfSyntax: false,
        reason: 'Text is empty'
      };
    }

    const hasPdfSyntax = this.containsPdfSyntax(text);
    if (hasPdfSyntax) {
      return {
        isReadable: false,
        printableRatio: 0,
        wordCount: 0,
        hasPdfSyntax: true,
        reason: 'Text contains raw PDF object syntax (%PDF, stream, endobj, /Type)'
      };
    }

    // Measure printable character ratio (printable ASCII + common Latin/Unicode)
    let printableCount = 0;
    const len = text.length;

    for (let i = 0; i < len; i++) {
      const code = text.charCodeAt(i);
      // Tabs, newlines, carriage returns, standard printable ASCII 32-126, or Latin/Unicode > 160
      if (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code <= 126) ||
        code >= 160
      ) {
        printableCount++;
      }
    }

    const printableRatio = printableCount / len;
    if (printableRatio < 0.85) {
      return {
        isReadable: false,
        printableRatio,
        wordCount: 0,
        hasPdfSyntax: false,
        reason: `Corrupted binary characters detected (${Math.round((1 - printableRatio) * 100)}% non-printable)`
      };
    }

    // Check meaningful word count
    const words = text
      .trim()
      .split(/\s+/)
      .filter(w => /^[a-zA-Z0-9_\-\u00C0-\u017F]{2,}$/.test(w));

    if (words.length < 5) {
      return {
        isReadable: false,
        printableRatio,
        wordCount: words.length,
        hasPdfSyntax: false,
        reason: `Insufficient readable words (${words.length} words found, minimum 5 required)`
      };
    }

    // Check average word length to detect uncompressed binary junk
    const avgWordLength = words.reduce((acc, w) => acc + w.length, 0) / words.length;
    if (avgWordLength > 30) {
      return {
        isReadable: false,
        printableRatio,
        wordCount: words.length,
        hasPdfSyntax: false,
        reason: `Abnormal average word length (${avgWordLength.toFixed(1)} chars/word indicates unspaced binary data)`
      };
    }

    return {
      isReadable: true,
      printableRatio,
      wordCount: words.length,
      hasPdfSyntax: false
    };
  }

  /**
   * Sanitizes extracted text by normalizing whitespace and stripping residual control codes.
   */
  public static sanitize(text: string): string {
    if (!text) return '';
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // Strip non-printable ASCII controls
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Identifies and strips common PDF header/footer artifacts, running titles, and stray page numbers.
   */
  public static stripHeadersAndFooters(text: string): string {
    if (!text) return '';
    const lines = text.split('\n');
    const cleaned = lines.filter((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return true; // keep blank line separators

      // 1. Common page numbering formats
      if (/^(?:page\s+\d+(\s+of\s+\d+)?|\d+\s*\/\s*\d+|[-—–]\s*\d+\s*[-—–]|\d+)$/i.test(trimmed)) {
        // Strip if at top 3 lines or bottom 3 lines of page text
        if (idx <= 2 || idx >= lines.length - 3) return false;
      }

      // 2. Common running header noise (e.g., "Copyright © ...", "All rights reserved", "Confidential")
      if (/^(?:copyright\s+©|all\s+rights\s+reserved|confidential\b)/i.test(trimmed)) {
        if (idx <= 2 || idx >= lines.length - 3) return false;
      }

      return true;
    });

    return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
}
