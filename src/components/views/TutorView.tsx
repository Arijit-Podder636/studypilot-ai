import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  BookOpen,
  Sparkles,
  ShieldAlert,
  RotateCcw,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  FileText,
  Quote,
  Mic,
  Radio,
  ChevronDown,
  Check,
  CheckSquare,
  Square,
  Filter,
  Layers,
  X,
  Search,
  Upload,
  ArrowRight
} from 'lucide-react';
import { Chunk, ChunkCitation, Course, DocumentSource, ExplanationLevel, TutorMessage, VoiceSettings } from '../../types';
import { apiClient } from '../../services/api';
import { VoiceTutorModal } from '../voice/VoiceTutorModal';
import { VoiceTutorButton } from '../voice/VoiceTutorButton';
import { DocumentPickerModal } from './DocumentPickerModal';

interface TutorViewProps {
  course: Course;
  documents?: DocumentSource[];
  allChunks: Chunk[];
  messages: TutorMessage[];
  voiceSettings?: VoiceSettings;
  onSendMessage: (msg: TutorMessage) => void;
  onClearHistory: () => void;
  onSelectCitation: (cit: ChunkCitation) => void;
  onNavigateToLibrary?: () => void;
}

export const TutorView: React.FC<TutorViewProps> = ({
  course,
  documents = [],
  allChunks,
  messages,
  voiceSettings,
  onSendMessage,
  onClearHistory,
  onSelectCitation,
  onNavigateToLibrary
}) => {
  const [inputText, setInputText] = useState('');
  const [level, setLevel] = useState<ExplanationLevel>('intermediate');
  // selectedDocIds: ['all'] or array of document IDs
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(['all']);
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const sourceMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(e.target as Node)) {
        setIsSourceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Course change: reset selection to 'all'
  const prevCourseIdRef = useRef(course.id);
  useEffect(() => {
    if (prevCourseIdRef.current !== course.id) {
      prevCourseIdRef.current = course.id;
      setSelectedDocIds(['all']);
    }
  }, [course.id]);

  // Requirement 8: Automatic refresh when documents are added, renamed, moved, or deleted
  // Reconcile selectedDocIds against currently available documents without page reload
  useEffect(() => {
    if (selectedDocIds.includes('all')) return;
    const existingIds = new Set(documents.map((d) => d.id));
    const valid = selectedDocIds.filter((id) => existingIds.has(id));
    if (valid.length === 0) {
      setSelectedDocIds(['all']);
    } else if (valid.length !== selectedDocIds.length) {
      setSelectedDocIds(valid);
    }
  }, [documents]);

  const isAllSelected = selectedDocIds.includes('all') || selectedDocIds.length === 0;

  // Strict retrieval chunk filtering based on current document selection
  const activeChunks = useMemo(() => {
    if (isAllSelected) return allChunks;
    return allChunks.filter((c) => selectedDocIds.includes(c.documentId));
  }, [allChunks, isAllSelected, selectedDocIds]);

  // Selected documents objects
  const selectedDocs = useMemo(() => {
    if (isAllSelected) return [];
    return documents.filter((d) => selectedDocIds.includes(d.id));
  }, [documents, isAllSelected, selectedDocIds]);

  // Dropdown button summary label
  const sourceSummaryLabel = useMemo(() => {
    if (isAllSelected) {
      return `All Documents (${allChunks.length} passages)`;
    }
    if (selectedDocIds.length === 1) {
      const doc = documents.find((d) => d.id === selectedDocIds[0]);
      return `${doc?.title || 'Selected PDF'} (${activeChunks.length} passages)`;
    }
    return `${selectedDocIds.length} PDFs (${activeChunks.length} passages)`;
  }, [isAllSelected, selectedDocIds, documents, allChunks.length, activeChunks.length]);

  // Dropdown search filtered documents
  const filteredDropdownDocs = useMemo(() => {
    const q = dropdownSearch.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.topic && d.topic.toLowerCase().includes(q))
    );
  }, [documents, dropdownSearch]);

  // Single-click select a single PDF
  const handleSelectSingleDoc = (docId: string) => {
    setSelectedDocIds([docId]);
  };

  // Toggle PDF in multi-selection
  const handleToggleDoc = (docId: string) => {
    if (isAllSelected) {
      setSelectedDocIds([docId]);
    } else {
      if (selectedDocIds.includes(docId)) {
        const remaining = selectedDocIds.filter((id) => id !== docId);
        if (remaining.length === 0) {
          setSelectedDocIds(['all']);
        } else {
          setSelectedDocIds(remaining);
        }
      } else {
        const updated = [...selectedDocIds, docId];
        if (updated.length === documents.length) {
          setSelectedDocIds(['all']);
        } else {
          setSelectedDocIds(updated);
        }
      }
    }
  };

  const handleSelectAll = () => {
    setSelectedDocIds(['all']);
  };

  const samplePrompts = [
    'Which command displays hidden files?',
    'Which command displays the last 10 lines of a file?',
    'Which command displays the first 10 lines of a file?',
    'What is the difference between cp and mv?',
    'Why does dividing by sqrt(d_k) prevent vanishing gradients in Self-Attention?',
    'Compare L1 and L2 weight decay: why does L1 yield parameter sparsity?'
  ];

  // Submit query — Requirement 7: keeps current selection across questions and follow-ups
  const handleSubmit = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isSubmitting) return;

    setInputText('');
    setIsSubmitting(true);

    const userMessage: TutorMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      courseId: course.id,
      level
    };
    onSendMessage(userMessage);

    // Document scope parameter for RAG retrieval
    const docScope = isAllSelected
      ? undefined
      : selectedDocIds.length === 1
      ? selectedDocIds[0]
      : selectedDocIds;

    try {
      const assistantMessage = await apiClient.askTutor(
        query,
        course.id,
        activeChunks,
        level,
        messages,
        docScope
      );
      onSendMessage(assistantMessage);
    } catch (err) {
      console.error('Tutor query error:', err);
      const errorMessage: TutorMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'An unexpected error occurred while querying the knowledge base. Please try asking again.',
        timestamp: new Date().toISOString(),
        courseId: course.id,
        isRefusal: true,
        support_status: 'unsupported',
        refusalReason: 'Network or server error'
      };
      onSendMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-200">
      {/* Top Controls Bar */}
      <div className="p-3 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-200">{course.title}</span>
          </div>

          <span className="text-slate-600 hidden sm:inline">·</span>

          {/* Source Dropdown with inline search & instant selection */}
          <div className="relative" ref={sourceMenuRef}>
            <button
              type="button"
              onClick={() => setIsSourceMenuOpen(!isSourceMenuOpen)}
              className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-200 hover:border-slate-700 transition-colors cursor-pointer max-w-[280px]"
              title="Filter AI Tutor retrieval sources"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-[11px] text-slate-400 font-medium shrink-0">Source:</span>
              <span className="font-medium truncate text-left">{sourceSummaryLabel}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${
                  isSourceMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isSourceMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                {/* Header & Quick toggles */}
                <div className="px-2 py-1 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                  <span className="font-semibold text-slate-300">Document Sources</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectAll();
                        setIsSourceMenuOpen(false);
                      }}
                      className="text-indigo-400 hover:underline cursor-pointer font-medium"
                    >
                      All
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDocIds([])}
                      className="text-slate-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Inline search within dropdown */}
                {documents.length > 3 && (
                  <div className="px-1">
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        placeholder="Search PDFs..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-6 pr-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {/* Option: All Documents */}
                <button
                  type="button"
                  onClick={() => {
                    handleSelectAll();
                    setIsSourceMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    isAllSelected
                      ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layers className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    <span className="truncate">All Documents</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {allChunks.length} passages
                  </span>
                </button>

                <div className="border-t border-slate-800/80 my-1" />

                {/* Individual Documents List with Checkboxes & Single-Click switch */}
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {documents.length === 0 ? (
                    <div className="p-3 text-center space-y-2">
                      <p className="text-[11px] text-slate-400">No PDFs available in this course</p>
                      {onNavigateToLibrary && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSourceMenuOpen(false);
                            onNavigateToLibrary();
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium inline-flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          Upload PDF in Study Library
                        </button>
                      )}
                    </div>
                  ) : filteredDropdownDocs.length === 0 ? (
                    <div className="p-2 text-center text-[11px] text-slate-500">
                      No documents match search
                    </div>
                  ) : (
                    filteredDropdownDocs.map((doc) => {
                      const isChecked = !isAllSelected && selectedDocIds.includes(doc.id);
                      const docPageCount =
                        doc.pageCount ||
                        (doc.chunks.length > 0
                          ? Math.max(...doc.chunks.map((c) => c.pageOrSlide || 1))
                          : 1);

                      return (
                        <div
                          key={doc.id}
                          onClick={() => {
                            // Single click on row immediately switches to this single PDF
                            handleSelectSingleDoc(doc.id);
                            setIsSourceMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-indigo-950/60 text-indigo-200 border border-indigo-800/60'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleDoc(doc.id);
                              }}
                              className="p-0.5 text-slate-500 hover:text-indigo-400"
                              title="Toggle in multi-select"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              )}
                            </button>
                            <div className="truncate text-left">
                              <div className="truncate font-medium">{doc.title}</div>
                              <div className="text-[10px] text-slate-500">
                                {docPageCount} {docPageCount === 1 ? 'page' : 'pages'} · {doc.chunks.length} passages
                              </div>
                            </div>
                          </div>

                          {doc.ocrStatus === 'ocr_not_supported' && (
                            <span className="text-[9px] font-mono px-1 py-0.2 bg-amber-950/80 text-amber-300 border border-amber-800 rounded shrink-0">
                              Scanned
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dropdown Footer: Shortcut to full Searchable Document Picker */}
                <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span>Scope: {activeChunks.length} passages</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSourceMenuOpen(false);
                      setIsPickerModalOpen(true);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
                  >
                    Advanced Picker...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Change PDF Action Button (Requirement 6) */}
          <button
            type="button"
            onClick={() => setIsPickerModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            title="Open searchable document picker to switch PDFs"
          >
            <Search className="w-3.5 h-3.5 text-indigo-400" />
            <span>Change PDF</span>
          </button>
        </div>

        {/* Depth, Voice Tutor & History */}
        <div className="flex items-center gap-2">
          {/* Start Voice Tutor Button */}
          <VoiceTutorButton
            mode="gemini-live"
            variant="full"
            voiceSettings={voiceSettings}
            onClick={() => setIsVoiceModalOpen(true)}
            title="Start real-time voice tutoring session with Gemini Live"
          />

          <span className="text-slate-600 hidden sm:inline">·</span>

          <span className="text-xs text-slate-400 hidden sm:inline">Depth:</span>
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(['beginner', 'intermediate', 'advanced'] as ExplanationLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevel(lvl)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                  level === lvl
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {messages.length > 0 && (
            <button
              onClick={onClearHistory}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors ml-1"
              title="Clear Conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Requirement 5: Clear "Currently studying from" label showing selected PDF name(s) */}
      <div className="mb-3 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 text-slate-400 font-medium shrink-0">
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Currently studying from:</span>
          </div>

          {documents.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 italic">No PDF documents in this course</span>
              {onNavigateToLibrary && (
                <button
                  type="button"
                  onClick={onNavigateToLibrary}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  Upload PDF in Study Library
                </button>
              )}
            </div>
          ) : isAllSelected ? (
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800 text-indigo-300 font-medium">
                All Documents
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                ({allChunks.length} passages across {documents.length} {documents.length === 1 ? 'file' : 'files'})
              </span>
            </div>
          ) : selectedDocs.length === 1 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="px-2.5 py-0.5 rounded-full bg-indigo-950/90 border border-indigo-700/80 text-indigo-200 font-semibold max-w-[260px] sm:max-w-md truncate"
                title={selectedDocs[0].title}
              >
                {selectedDocs[0].title}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                ({activeChunks.length} passages)
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
              >
                (Switch to All)
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedDocs.map((doc) => (
                <span
                  key={doc.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800 text-indigo-200 text-[11px] font-medium"
                >
                  <span className="truncate max-w-[140px]">{doc.title}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleDoc(doc.id)}
                    className="text-slate-400 hover:text-rose-300 cursor-pointer"
                    title={`Remove ${doc.title} from scope`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <span className="text-[11px] text-slate-400 font-mono">
                ({activeChunks.length} total passages)
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer ml-1"
              >
                Reset to All
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPickerModalOpen(true)}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-medium cursor-pointer"
          >
            <Search className="w-3 h-3" />
            <span>Change PDF</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1.5 max-w-md">
              <h3 className="text-base font-semibold text-slate-100">
                Source-Grounded Socratic Tutor
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ask targeted factual or conceptual questions. Answers are strictly synthesized from your active PDF passages with verified page citations.
              </p>
              {documents.length === 0 && onNavigateToLibrary && (
                <div className="pt-2">
                  <button
                    onClick={onNavigateToLibrary}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload PDF in Study Library
                  </button>
                </div>
              )}
            </div>

            {/* Voice Tutoring Feature Card */}
            <div className="w-full max-w-2xl p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
              <div className="text-left space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                  <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  <span>Real-Time Voice Tutoring with Gemini Live</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Prefer speaking aloud? Have a fluid voice conversation in English, Bengali, or Hindi with live source citations.
                </p>
              </div>
              <VoiceTutorButton
                mode="gemini-live"
                variant="pill"
                voiceSettings={voiceSettings}
                onClick={() => setIsVoiceModalOpen(true)}
                title="Start Voice Session with Gemini Live"
              />
            </div>

            {/* Prompt Starters */}
            <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(p)}
                  className="p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/40 text-xs text-slate-300 transition-all flex items-start gap-2 group cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5 group-hover:text-indigo-300" />
                  <span className="line-clamp-2">{p}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isRefusal = msg.isRefusal || msg.support_status === 'unsupported';
            const isPartiallyGrounded = msg.support_status === 'partially_supported';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 text-xs font-bold">
                    SP
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-xl p-4 space-y-3 ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  {/* Assistant Header Tag */}
                  {!isUser && (
                    <div className="flex items-center justify-between text-[11px] pb-2 border-b border-slate-800 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        {isRefusal ? (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-rose-400 font-medium">Unsupported by Source Evidence</span>
                          </>
                        ) : isPartiallyGrounded ? (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-amber-400 font-medium">Partly matched to source text</span>
                          </>
                        ) : msg.retrievalMode === 'gemini-grounded' ? (
                          <>
                            <Quote className="w-3.5 h-3.5 text-sky-400" />
                            <span className="text-sky-400 font-medium">AI answer · terms matched to source</span>
                          </>
                        ) : (
                          <>
                            <Quote className="w-3.5 h-3.5 text-sky-400" />
                            <span className="text-sky-400 font-medium">Quoted from your document</span>
                          </>
                        )}
                        <span className="text-slate-600">·</span>
                        <span className="capitalize">{msg.level || 'Intermediate'}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">
                        {msg.retrievalMode === 'gemini-grounded' ? 'Gemini · AI-grounded' : 'Extractive · no AI'}
                      </span>
                    </div>
                  )}

                  {/* Body Text */}
                  <div className="text-xs leading-relaxed whitespace-pre-line font-sans font-normal">
                    {msg.content}
                  </div>

                  {/* Statements the cited text does not cover */}
                  {!isUser && msg.unsupportedClaims && msg.unsupportedClaims.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/50 text-[11px] text-amber-200 space-y-1">
                      <div className="text-[10px] uppercase font-semibold tracking-wider text-amber-400">
                        Not confirmed by the cited text:
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {msg.unsupportedClaims.map((claim, i) => (
                          <li key={i}>{claim}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Verbatim Supporting Excerpt Box */}
                  {!isUser && msg.relevant_excerpt && (
                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
                      <div className="text-[10px] uppercase font-semibold text-indigo-400 flex items-center gap-1 tracking-wider">
                        <Quote className="w-3 h-3 text-indigo-400" /> Source Evidence Excerpt:
                      </div>
                      <div className="italic text-slate-300 pl-2 border-l-2 border-indigo-500/50">
                        &ldquo;{msg.relevant_excerpt}&rdquo;
                      </div>
                    </div>
                  )}

                  {/* Refusal Notice */}
                  {!isUser && isRefusal && msg.refusalReason && (
                    <div className="p-2.5 rounded bg-rose-950/30 border border-rose-900/50 text-[11px] text-rose-300">
                      <strong>Policy Check:</strong> {msg.refusalReason}
                    </div>
                  )}

                  {/* Clickable Citations */}
                  {!isUser && msg.citations && msg.citations.length > 0 && !isRefusal && (
                    <div className="pt-2 border-t border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Source Citations (Click to inspect exact page passage):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((cit, idx) => (
                          <button
                            key={idx}
                            onClick={() => onSelectCitation(cit)}
                            className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-slate-800 text-[11px] text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <BookOpen className="w-3 h-3 text-indigo-400" />
                            <span className="truncate max-w-[180px]">{cit.documentTitle}</span>
                            {cit.pageOrSlide && <span className="text-indigo-400 font-mono">p.{cit.pageOrSlide}</span>}
                            {cit.timestamp && <span className="text-slate-500">@{cit.timestamp}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Socratic Follow-Up Questions (Requirement 7: Keep current selection on follow-up) */}
                  {!isUser && msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                        Suggested Follow-Up Inquiry:
                      </span>
                      <div className="space-y-1">
                        {msg.suggestedFollowUps.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSubmit(q)}
                            className="w-full text-left p-1.5 rounded hover:bg-slate-800 text-[11px] text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <HelpCircle className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>{q}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Ask a question grounded in ${
              isAllSelected
                ? course.title
                : selectedDocs.length === 1
                ? selectedDocs[0].title
                : `${selectedDocs.length} selected PDFs`
            }...`}
            disabled={isSubmitting}
            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
          />

          {/* Web Speech Direct Speech-to-Text Dictation Button */}
          <VoiceTutorButton
            mode="web-speech"
            variant="compact"
            speakingRate={voiceSettings?.speakingRate}
            language={
              voiceSettings?.language === 'bn'
                ? 'bn-IN'
                : voiceSettings?.language === 'hi'
                ? 'hi-IN'
                : 'en-US'
            }
            title="Speech to Text (Web Speech API)"
            onTranscript={(transcribed, isFinal) => {
              setInputText((prev) => {
                if (isFinal) {
                  return prev ? `${prev} ${transcribed}` : transcribed;
                }
                return prev ? `${prev} ${transcribed}` : transcribed;
              });
            }}
          />

          {/* Gemini Live Voice Tutor Modal Launcher */}
          <VoiceTutorButton
            mode="gemini-live"
            variant="compact"
            voiceSettings={voiceSettings}
            title="Start Gemini Live Voice Tutor"
            onClick={() => setIsVoiceModalOpen(true)}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSubmitting}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            title="Send Message"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Searchable Document Picker Modal */}
      <DocumentPickerModal
        isOpen={isPickerModalOpen}
        onClose={() => setIsPickerModalOpen(false)}
        documents={documents}
        allChunks={allChunks}
        selectedDocIds={selectedDocIds}
        onSelectAll={handleSelectAll}
        onSelectSingleDoc={handleSelectSingleDoc}
        onToggleDoc={handleToggleDoc}
        onClearSelection={() => setSelectedDocIds([])}
        onNavigateToLibrary={onNavigateToLibrary}
      />

      {/* Gemini Live Voice Tutor Modal */}
      <VoiceTutorModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        course={course}
        selectedDocId={
          isAllSelected
            ? 'all'
            : selectedDocIds.length === 1
            ? selectedDocIds[0]
            : selectedDocIds.join(',')
        }
        selectedDocTitle={
          isAllSelected
            ? undefined
            : selectedDocIds.length === 1
            ? documents.find((d) => d.id === selectedDocIds[0])?.title
            : `${selectedDocIds.length} Selected Documents`
        }
        activeChunks={activeChunks}
        level={level}
        initialVoiceName={voiceSettings?.persona}
        initialSpeakingRate={voiceSettings?.speakingRate}
        initialLanguage={voiceSettings?.language}
        onSelectCitation={onSelectCitation}
        onFallbackToTextChat={(lastQuery) => {
          setIsVoiceModalOpen(false);
          if (lastQuery) {
            setInputText(lastQuery);
          }
        }}
      />
    </div>
  );
};
