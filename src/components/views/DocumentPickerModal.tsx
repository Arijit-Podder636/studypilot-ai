import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  FileText,
  Layers,
  Check,
  CheckSquare,
  Square,
  Upload,
  BookOpen,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Chunk, DocumentSource } from '../../types';

interface DocumentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentSource[];
  allChunks: Chunk[];
  selectedDocIds: string[];
  onSelectAll: () => void;
  onSelectSingleDoc: (docId: string) => void;
  onToggleDoc: (docId: string) => void;
  onClearSelection: () => void;
  onNavigateToLibrary?: () => void;
}

export const DocumentPickerModal: React.FC<DocumentPickerModalProps> = ({
  isOpen,
  onClose,
  documents,
  allChunks,
  selectedDocIds,
  onSelectAll,
  onSelectSingleDoc,
  onToggleDoc,
  onClearSelection,
  onNavigateToLibrary
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [multiSelectMode, setMultiSelectMode] = useState(false);

  if (!isOpen) return null;

  const isAllSelected = selectedDocIds.includes('all') || selectedDocIds.length === 0;

  // Filter documents by search term
  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        (doc.topic && doc.topic.toLowerCase().includes(q)) ||
        (doc.subtopics && doc.subtopics.some((st) => st.toLowerCase().includes(q)))
    );
  }, [documents, searchQuery]);

  // Active chunks count
  const activeChunksCount = isAllSelected
    ? allChunks.length
    : allChunks.filter((c) => selectedDocIds.includes(c.documentId)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-picker-title"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
                <FileText className="w-4 h-4" />
              </div>
              <h2 id="document-picker-title" className="text-base font-semibold text-slate-100">
                Select Study Material
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Choose the exact document(s) the AI Tutor will use to answer your questions with verified page citations.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Selection Mode Controls */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PDFs by filename or topic..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSelectAll}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isAllSelected
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                All Documents ({allChunks.length} passages)
              </button>

              {!isAllSelected && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="px-2.5 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={() => setMultiSelectMode(!multiSelectMode)}
                className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  multiSelectMode
                    ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300'
                    : 'border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                {multiSelectMode ? '✓ Multi-Select Active' : 'Enable Multi-Select'}
              </button>
              <span>·</span>
              <span>{documents.length} {documents.length === 1 ? 'PDF' : 'PDFs'} in course</span>
            </div>
          </div>
        </div>

        {/* Documents Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {documents.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-200">No PDFs available for this course</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Upload PDF course notes, slide decks, or textbooks in Study Library to begin source-grounded tutoring.
                </p>
              </div>
              {onNavigateToLibrary && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToLibrary();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <Upload className="w-4 h-4" />
                  Upload PDF in Study Library
                </button>
              )}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No documents matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isChecked = !isAllSelected && selectedDocIds.includes(doc.id);
              const docPageCount =
                doc.pageCount ||
                (doc.chunks.length > 0
                  ? Math.max(...doc.chunks.map((c) => c.pageOrSlide || 1))
                  : 1);
              const passageCount = doc.chunks.length;

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (multiSelectMode) {
                      onToggleDoc(doc.id);
                    } else {
                      onSelectSingleDoc(doc.id);
                      onClose();
                    }
                  }}
                  className={`group p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isChecked
                      ? 'bg-indigo-950/50 border-indigo-500/60 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox or Selection Radio */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDoc(doc.id);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
                      title={isChecked ? 'Deselect PDF' : 'Select PDF'}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                      )}
                    </button>

                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                          {doc.title}
                        </span>
                        {isChecked && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40">
                            Active Source
                          </span>
                        )}
                        {doc.ocrStatus === 'ocr_not_supported' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800">
                            Scanned
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span>{docPageCount} {docPageCount === 1 ? 'page' : 'pages'}</span>
                        <span>·</span>
                        <span className="font-mono text-slate-300 font-medium">{passageCount} passages</span>
                        {doc.topic && (
                          <>
                            <span>·</span>
                            <span className="text-indigo-400 truncate max-w-[150px]">{doc.topic}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Single-Click Select Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSingleDoc(doc.id);
                        onClose();
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                    >
                      {isChecked ? 'Selected' : 'Select Only'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4 text-xs">
          <div className="text-slate-400">
            <span className="text-slate-200 font-medium">Scope:</span>{' '}
            {isAllSelected ? (
              <span>All Documents ({allChunks.length} passages)</span>
            ) : (
              <span>
                {selectedDocIds.length} {selectedDocIds.length === 1 ? 'document' : 'documents'} ({activeChunksCount} passages)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors cursor-pointer shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
