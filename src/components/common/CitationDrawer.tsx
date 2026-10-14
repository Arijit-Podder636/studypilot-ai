import React from 'react';
import { ChunkCitation } from '../../types';
import { X, Clock, FileText, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { TextValidator } from '../../services/textValidator';

interface CitationDrawerProps {
  citation: ChunkCitation | null;
  onClose: () => void;
}

const pct = (v?: number) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : null);

/**
 * Shows exactly what was (and was not) measured for a citation.
 * Nothing on this panel claims that a statement has been proven correct: the only checks are
 * retrieval relevance (question terms found in the passage) and lexical overlap (answer terms found
 * in the excerpt).
 */
export const CitationDrawer: React.FC<CitationDrawerProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  const isOcrNotSupported =
    citation.supportKind === 'ocr_not_supported' ||
    Boolean(citation.excerpt && citation.excerpt.includes('OCR Not Supported'));

  const check = TextValidator.validateReadability(citation.excerpt);
  const isCorrupted =
    !isOcrNotSupported && (citation.supportKind === 'corrupted_source' || !check.isReadable || TextValidator.containsPdfSyntax(citation.excerpt));

  const kind = isOcrNotSupported
    ? 'ocr_not_supported'
    : isCorrupted
    ? 'corrupted_source'
    : citation.supportKind ?? 'unchecked';
  const relevance = pct(citation.relevanceScore);
  const overlap = pct(citation.lexicalOverlap);

  let heading: string;
  let message: string;
  let tone: 'info' | 'warn' | 'error';

  switch (kind) {
    case 'ocr_not_supported':
      heading = 'OCR Not Supported';
      message = 'This document consists of scanned images or photographs with no machine-readable text layer. Optical Character Recognition (OCR) is not supported for this file, so text could not be extracted.';
      tone = 'warn';
      break;
    case 'corrupted_source':
      heading = 'Corrupted Source Chunk Detected';
      message = 'This text could not be read. Raw PDF internal syntax (%PDF/stream/endobj) or unreadable binary characters were detected, so no claim can be checked against it.';
      tone = 'error';
      break;
    case 'heading_only':
      heading = 'Unverified — Section Heading Only';
      message = 'The cited text is only a section title. It does not contain explanatory text that could support the answer.';
      tone = 'warn';
      break;
    case 'direct_quote':
      heading = 'Direct Quote From Your Document';
      message = 'The answer is the passage below, copied from your uploaded document. No AI wrote or rephrased it. The percentage shows how many of your question\u2019s terms appear in this passage; it does not measure correctness.';
      tone = 'info';
      break;
    case 'strong_overlap':
      heading = 'Strong Term Overlap';
      message = 'Most of the answer\u2019s terms (words, numbers and command flags) appear in this excerpt. This is a word-matching check only; it does not prove the answer is correct.';
      tone = 'info';
      break;
    case 'partial_overlap':
      heading = 'Partial Term Overlap';
      message = 'Some of the answer\u2019s terms appear in this excerpt, but part of the answer is not covered by it. Treat the uncovered parts as unconfirmed.';
      tone = 'warn';
      break;
    case 'weak_overlap':
      heading = 'Unverified \u2014 Little Overlap';
      message = 'Few of the answer\u2019s terms appear in this excerpt, so the source does not clearly support the answer.';
      tone = 'warn';
      break;
    default:
      heading = 'Source Passage';
      message = 'This is the passage text stored for this document. No claim was checked against it, and no support score was calculated.';
      tone = 'info';
  }

  const bannerClass =
    tone === 'error'
      ? 'bg-red-950/30 border-red-800 text-red-300'
      : tone === 'warn'
      ? 'bg-amber-950/20 border-amber-800/60 text-amber-300'
      : 'bg-sky-950/20 border-sky-800/60 text-sky-300';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {tone === 'error' ? (
              <ShieldAlert className="w-5 h-5 text-red-400" />
            ) : tone === 'warn' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <Info className="w-5 h-5 text-sky-400" />
            )}
            <h3 className="font-semibold text-slate-100 text-sm">{heading}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* What was measured */}
          <div className={`p-4 rounded-xl border space-y-3 ${bannerClass}`}>
            <p className="text-xs leading-relaxed">{message}</p>
            {!isCorrupted && (relevance || overlap) && (
              <dl className="grid grid-cols-2 gap-3 text-xs font-mono">
                {relevance && (
                  <div>
                    <dt className="opacity-70">Retrieval relevance</dt>
                    <dd className="text-sm font-semibold">{relevance} of question terms found</dd>
                  </div>
                )}
                {overlap && (
                  <div>
                    <dt className="opacity-70">Lexical overlap</dt>
                    <dd className="text-sm font-semibold">{overlap} of answer terms found</dd>
                  </div>
                )}
              </dl>
            )}
            {!isCorrupted && citation.unmatchedTerms && citation.unmatchedTerms.length > 0 && (
              <p className="text-xs">
                <span className="opacity-70">Not found in this excerpt: </span>
                <span className="font-mono">{citation.unmatchedTerms.join(', ')}</span>
              </p>
            )}
          </div>

          {/* Document metadata card */}
          <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs text-indigo-400 font-mono">ID: {citation.chunkId}</span>
                <h4 className="text-sm font-semibold text-slate-100 mt-0.5">{citation.documentTitle}</h4>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
              {citation.pageOrSlide && (
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Page {citation.pageOrSlide}</span>
                </div>
              )}
              {citation.timestamp && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Timestamp: {citation.timestamp}</span>
                </div>
              )}
              <div className="text-xs font-mono text-slate-400">
                Text quality:{' '}
                <strong className={isCorrupted ? 'text-red-400' : isOcrNotSupported ? 'text-amber-400' : 'text-slate-200'}>
                  {isCorrupted ? 'Corrupted / non-text' : isOcrNotSupported ? 'Scanned image (OCR Not Supported)' : 'Readable text'}
                </strong>
              </div>
            </div>
          </div>

          {/* Verbatim Excerpt */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isOcrNotSupported ? 'Document Status' : isCorrupted ? 'Rejected Source Fragment' : 'Excerpt From Your Document'}
            </label>
            <div
              className={`p-4 rounded-lg bg-slate-950 border font-sans text-xs leading-relaxed whitespace-pre-line ${
                isCorrupted
                  ? 'border-red-900 text-red-200 font-mono text-[11px]'
                  : isOcrNotSupported || kind === 'heading_only'
                  ? 'border-amber-800 text-amber-200 border-l-2 border-l-amber-500 font-mono text-[11px]'
                  : 'border-slate-800 text-slate-200 border-l-2 border-l-indigo-500'
              }`}
            >
              {citation.excerpt}
            </div>
          </div>

          {/* Policy Note */}
          <div className="p-3 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-400 leading-relaxed">
            <p className="font-semibold text-slate-300 mb-1">How to read these numbers</p>
            Retrieval relevance and lexical overlap are simple word-matching ratios. They are not confidence
            levels or probabilities, and a high value never means the statement is true. Check important
            answers against the page shown above.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
