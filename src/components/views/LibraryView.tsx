import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Video,
  Presentation,
  Trash2,
  Search,
  Eye,
  CheckCircle2,
  FileCode,
  Tag,
  Clock,
  RefreshCw,
  Edit2,
  Plus,
  AlertTriangle,
  X,
  FileUp,
  BookOpen,
  Info,
  Check,
  Layers,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { Chunk, Course, DocumentSource } from '../../types';
import { RagEngine } from '../../services/ragEngine';
import { PdfParser, ExtractedPage, splitTextIntoPassages } from '../../services/pdfParser';
import { TextValidator } from '../../services/textValidator';
import { DocumentClassifier } from '../../services/documentClassifier';

export interface LibraryViewProps {
  course: Course;
  documents: DocumentSource[];
  allCourses?: Course[];
  onAddDocument: (doc: DocumentSource) => void;
  onUpdateDocument?: (doc: DocumentSource) => void;
  onDeleteDocument: (docId: string) => void;
  onAddCourse?: (newCourse: Course) => void;
  onSelectCourse?: (course: Course) => void;
  onSelectChunkForPreview: (chunk: Chunk) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  course,
  documents,
  allCourses = [],
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
  onAddCourse,
  onSelectCourse,
  onSelectChunkForPreview
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | 'all'>('all');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Upload PDF Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [targetCourseMode, setTargetCourseMode] = useState<'current' | 'existing' | 'new'>('current');
  const [chosenCourseId, setChosenCourseId] = useState<string>(course.id);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseCategory, setNewCourseCategory] = useState('Computer Science');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Management Action Modals
  const [detailsDoc, setDetailsDoc] = useState<DocumentSource | null>(null);
  const [renameDoc, setRenameDoc] = useState<DocumentSource | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteDoc, setDeleteDoc] = useState<DocumentSource | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  // Manual transcript / text modal state
  const [showTextModal, setShowTextModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<DocumentSource['type']>('pdf');
  const [docTopic, setDocTopic] = useState(course.topics[0]?.title || 'Course Material');
  const [docContent, setDocContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deduplicate documents by ID
  const docMap = new Map<string, DocumentSource>();
  documents.forEach((d) => docMap.set(d.id, d));
  const uniqueDocs = Array.from(docMap.values());

  // Filtering documents & chunks
  const filteredDocs = selectedDocId === 'all'
    ? uniqueDocs
    : uniqueDocs.filter(d => d.id === selectedDocId);

  // Strictly deduplicate chunks by ID so no duplicate chunk keys ever exist
  const chunkMap = new Map<string, Chunk>();
  filteredDocs.forEach(d => {
    d.chunks.forEach(c => {
      if (!chunkMap.has(c.id)) {
        chunkMap.set(c.id, c);
      }
    });
  });
  const allChunks = Array.from(chunkMap.values());
  const displayedChunks = searchQuery.trim() === ''
    ? allChunks
    : allChunks.filter(c =>
        c.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.subtopic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
      );

  // File selection validation
  const validateAndSetFile = (file: File) => {
    setFileError(null);
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setFileError('Invalid file format. Please upload a standard PDF (.pdf) file.');
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setFileError('The selected PDF file is empty (0 bytes).');
      setSelectedFile(null);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setFileError(`File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25MB maximum upload limit.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // Determine effective target course for upload
  const effectiveTargetCourseId =
    targetCourseMode === 'current'
      ? course.id
      : targetCourseMode === 'existing'
      ? chosenCourseId
      : 'new';

  // Check duplicate filename in target course
  const targetCourseDocs = documents.filter(d =>
    targetCourseMode === 'current'
      ? d.courseId === course.id
      : targetCourseMode === 'existing'
      ? d.courseId === chosenCourseId
      : false
  );
  const isDuplicate = Boolean(
    selectedFile && targetCourseDocs.some(d => d.title.toLowerCase() === selectedFile.name.toLowerCase())
  );

  // Process PDF Upload
  const handleProcessPdfUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setFileError(null);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      setProcessingStage('Reading file binary data...');
      const arrayBuffer = await selectedFile.arrayBuffer();

      if (arrayBuffer.byteLength === 0) {
        throw new Error('The selected PDF file is empty (0 bytes).');
      }

      // Preflight magic header validation
      const headerBytes = new Uint8Array(arrayBuffer.slice(0, 16));
      const headerString = Array.from(headerBytes).map(b => String.fromCharCode(b)).join('');
      if (!headerString.includes('%PDF')) {
        throw new Error(`File "${selectedFile.name}" is missing standard PDF header (%PDF-). Invalid or corrupted PDF file.`);
      }

      // Convert to base64 for persistent storage and server OCR fallback
      const bytes = new Uint8Array(arrayBuffer);
      let binaryStr = '';
      for (let i = 0; i < bytes.length; i++) {
        binaryStr += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binaryStr);

      setProcessingStage('Extracting PDF pages and text layout...');
      const pages = await PdfParser.extractPages(arrayBuffer, selectedFile.name);

      if (!pages || pages.length === 0) {
        throw new Error(`No extractable pages found in "${selectedFile.name}".`);
      }

      // Handle Course Assignment
      let finalCourseId = course.id;
      let finalCourseObj = course;

      if (targetCourseMode === 'new') {
        if (!newCourseTitle.trim()) {
          throw new Error('Please enter a course title for the new course.');
        }
        const assignedCode = (newCourseCode.trim() || newCourseTitle.trim().substring(0, 6)).toUpperCase();
        const createdCourse: Course = {
          id: `course-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: newCourseTitle.trim(),
          code: assignedCode,
          description: newCourseDescription.trim() || `Course materials for ${newCourseTitle.trim()}`,
          category: newCourseCategory.trim() || 'General Studies',
          topics: [
            {
              id: `topic-${Date.now()}-1`,
              title: 'General Course Material',
              description: 'Extracted topics and concepts from uploaded PDF documents',
              prerequisites: [],
              subtopics: []
            }
          ],
          totalDocuments: 1,
          totalChunks: 0,
          createdAt: new Date().toISOString(),
          isSampleCourse: false
        };

        if (onAddCourse) {
          onAddCourse(createdCourse);
        }
        finalCourseId = createdCourse.id;
        finalCourseObj = createdCourse;
      } else if (targetCourseMode === 'existing') {
        finalCourseId = chosenCourseId;
        const matched = allCourses.find(c => c.id === chosenCourseId);
        if (matched) finalCourseObj = matched;
      }

      setProcessingStage('Analyzing content and chunking passages...');
      const sampleTexts = pages.map(p => p.text);
      const classification = DocumentClassifier.classify(selectedFile.name, sampleTexts);
      const targetTopic = classification.isReliable ? classification.subject : (finalCourseObj.topics[0]?.title || 'Course Material');

      // If replacing duplicate document, delete previous version
      const existingDoc = documents.find(
        d => d.courseId === finalCourseId && d.title.toLowerCase() === selectedFile.name.toLowerCase()
      );
      if (existingDoc) {
        onDeleteDocument(existingDoc.id);
      }

      const newDoc = PdfParser.createDocumentFromPages(
        selectedFile.name,
        pages,
        finalCourseId,
        targetTopic,
        selectedFile.size,
        undefined,
        base64Data
      );

      newDoc.fileName = selectedFile.name;
      newDoc.pageCount = pages.length;
      newDoc.status = newDoc.isScanned ? 'ready' : 'ready';

      if (newDoc.chunks.length === 0) {
        throw new Error(`No readable text passages could be extracted from "${selectedFile.name}".`);
      }

      onAddDocument(newDoc);

      if (targetCourseMode === 'new' && onSelectCourse) {
        onSelectCourse(finalCourseObj);
      }

      if (newDoc.ocrStatus === 'ocr_not_supported') {
        setUploadSuccess(
          `Uploaded "${selectedFile.name}" (${pages.length} pages) to ${finalCourseObj.code}. Detected as Scanned / Image-Only document. OCR Not Supported status triggered in preview.`
        );
      } else {
        setUploadSuccess(
          `Successfully uploaded "${selectedFile.name}" to ${finalCourseObj.code}: extracted ${pages.length} pages and generated ${newDoc.totalChunks} searchable passages with verifiable page citations.`
        );
      }

      // Reset modal state
      setShowUploadModal(false);
      setSelectedFile(null);
      setNewCourseTitle('');
      setNewCourseCode('');
      setNewCourseDescription('');
    } catch (err: any) {
      console.error('PDF Upload Error:', err);
      setFileError(err.message || 'Failed to process and upload PDF document.');
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  // Reprocess Document
  const handleReprocessDocument = async (doc: DocumentSource) => {
    setReprocessingId(doc.id);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      let updatedPages: ExtractedPage[] = [];

      if (doc.rawBase64) {
        // Re-extract using stored base64
        const binaryStr = atob(doc.rawBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        updatedPages = await PdfParser.extractPages(bytes.buffer, doc.title);
      } else {
        // Reconstruct from existing chunk texts
        const pagesMap = new Map<number, string[]>();
        doc.chunks.forEach(c => {
          const p = c.pageOrSlide || 1;
          const current = pagesMap.get(p) || [];
          current.push(c.text);
          pagesMap.set(p, current);
        });

        const sortedPages = Array.from(pagesMap.keys()).sort((a, b) => a - b);
        updatedPages = sortedPages.map(pageNum => ({
          pageNumber: pageNum,
          text: (pagesMap.get(pageNum) || []).join('\n\n'),
          isOcr: false,
          requiresOcr: false,
          ocrStatus: 'not_needed' as const
        }));
      }

      if (updatedPages.length === 0) {
        throw new Error('Unable to reconstruct document pages for reprocessing.');
      }

      const sampleTexts = updatedPages.map(p => p.text);
      const classification = DocumentClassifier.classify(doc.title, sampleTexts);
      const targetTopic = classification.isReliable ? classification.subject : doc.topic;

      const reprocessedDoc = PdfParser.createDocumentFromPages(
        doc.title,
        updatedPages,
        doc.courseId,
        targetTopic,
        doc.fileSizeBytes || 0,
        doc.id,
        doc.rawBase64
      );

      reprocessedDoc.fileName = doc.fileName || doc.title;
      reprocessedDoc.pageCount = updatedPages.length;
      reprocessedDoc.status = 'ready';

      if (onUpdateDocument) {
        onUpdateDocument(reprocessedDoc);
      } else {
        onAddDocument(reprocessedDoc);
      }

      setUploadSuccess(`Reprocessed "${doc.title}": generated ${reprocessedDoc.totalChunks} fresh passages and updated keyword index.`);
    } catch (err: any) {
      console.error('Reprocess Error:', err);
      setUploadError(`Failed to reprocess "${doc.title}": ${err.message}`);
    } finally {
      setReprocessingId(null);
    }
  };

  // Rename Document
  const handleSaveRename = () => {
    if (!renameDoc || !renameValue.trim()) return;

    const newTitle = renameValue.trim();
    const updatedDoc: DocumentSource = {
      ...renameDoc,
      title: newTitle,
      fileName: newTitle,
      chunks: renameDoc.chunks.map(c => ({
        ...c,
        documentTitle: newTitle
      }))
    };

    if (onUpdateDocument) {
      onUpdateDocument(updatedDoc);
    } else {
      onAddDocument(updatedDoc);
    }

    setUploadSuccess(`Renamed document to "${newTitle}".`);
    setRenameDoc(null);
    setRenameValue('');
  };

  // Confirm Delete Document
  const handleConfirmDelete = () => {
    if (!deleteDoc) return;
    onDeleteDocument(deleteDoc.id);
    setUploadSuccess(`Deleted document "${deleteDoc.title}" and purged all its passages from retrieval.`);
    setDeleteDoc(null);
    if (selectedDocId === deleteDoc.id) {
      setSelectedDocId('all');
    }
  };

  // Manual Transcript Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) {
      setUploadError('Title and text content are required.');
      return;
    }

    const newDoc = RagEngine.parseRawDocument(
      docTitle,
      docContent,
      docType,
      course.id,
      docTopic
    );

    newDoc.fileName = docTitle;
    newDoc.pageCount = 1;
    newDoc.status = 'ready';

    onAddDocument(newDoc);
    setUploadSuccess(`Successfully indexed "${docTitle}" (${newDoc.totalChunks} chunks).`);
    setShowTextModal(false);
    setDocTitle('');
    setDocContent('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header & Ingestion Zone */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100">Study Library & PDF Management</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-indigo-950 text-indigo-300 border border-indigo-800 rounded">
              {course.code}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Upload PDFs, assign courses, view details, rename, reprocess, and manage grounded knowledge passages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Prominent Upload PDF Button (Requirement 1) */}
          <button
            onClick={() => {
              setFileError(null);
              setSelectedFile(null);
              setShowUploadModal(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload PDF</span>
          </button>

          <button
            onClick={() => setShowTextModal(true)}
            className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 flex items-center gap-2 cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Paste Transcript</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {uploadError && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800 text-xs text-red-300 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-slate-400 hover:text-slate-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {uploadSuccess && (
        <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
          <button onClick={() => setUploadSuccess(null)} className="text-slate-400 hover:text-slate-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Document Overview Cards with Management Actions (Requirement 3, 5, 6) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-200">
              Documents in {course.code} ({documents.length})
            </h3>
            <span className="text-xs text-slate-500">
              · {allChunks.length} searchable passages
            </span>
          </div>
          {selectedDocId !== 'all' && (
            <button
              onClick={() => setSelectedDocId('all')}
              className="text-xs text-indigo-400 hover:underline"
            >
              Show All Course Documents
            </button>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center space-y-3 bg-slate-900/30">
            <FileUp className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-medium text-slate-300">No documents in this course yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Upload your textbook chapters, lecture slides, or exam problem sheets to ground the AI Tutor.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => {
              const Icon = doc.type === 'pdf' ? FileText : doc.type === 'pptx' ? Presentation : doc.type === 'transcript' ? Video : FileCode;
              const isSelected = selectedDocId === doc.id;
              const isReprocessing = reprocessingId === doc.id;

              // Calculate page count
              const pageCount = doc.pageCount || (
                doc.chunks.length > 0 ? Math.max(...doc.chunks.map(c => c.pageOrSlide || 1)) : 1
              );

              // Processing / status badge
              let statusBadge = (
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Ready
                </span>
              );

              if (doc.ocrStatus === 'ocr_not_supported' || doc.isScanned) {
                statusBadge = (
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800 text-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Scanned
                  </span>
                );
              } else if (doc.status === 'processing' || isReprocessing) {
                statusBadge = (
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-950/70 border border-blue-800 text-blue-300 flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Processing
                  </span>
                );
              }

              const formattedSize = doc.fileSizeBytes
                ? doc.fileSizeBytes > 1024 * 1024
                  ? `${(doc.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
                  : `${(doc.fileSizeBytes / 1024).toFixed(0)} KB`
                : 'Indexed';

              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(isSelected ? 'all' : doc.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900 border-indigo-500 ring-1 ring-indigo-500/50'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header: Icon, Status badge & Document Type */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-lg bg-slate-800 text-indigo-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {statusBadge}
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {doc.type}
                        </span>
                      </div>
                    </div>

                    {/* Document Title / Filename & Topic */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-100 line-clamp-1" title={doc.title}>
                        {doc.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {doc.topic}
                      </p>
                    </div>

                    {/* Metadata: Pages, Chunks, File Size */}
                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-[11px] text-slate-400 font-mono text-center bg-slate-950/40 p-1.5 rounded-lg">
                      <div>
                        <div className="text-slate-500 text-[9px] uppercase">Pages</div>
                        <div className="font-semibold text-slate-300">{pageCount}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[9px] uppercase">Passages</div>
                        <div className="font-semibold text-indigo-300">{doc.totalChunks}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[9px] uppercase">Size</div>
                        <div className="font-semibold text-slate-300">{formattedSize}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row (Requirement 6: View Details, Rename, Reprocess, Delete) */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1 text-slate-400">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailsDoc(doc);
                      }}
                      className="p-1.5 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors text-xs flex items-center gap-1"
                      title="View Document Details & Passages"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-[11px] hidden sm:inline">Details</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameDoc(doc);
                        setRenameValue(doc.title);
                      }}
                      className="p-1.5 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors text-xs flex items-center gap-1"
                      title="Rename Document"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="text-[11px] hidden sm:inline">Rename</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReprocessDocument(doc);
                      }}
                      disabled={isReprocessing}
                      className="p-1.5 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors text-xs flex items-center gap-1 disabled:opacity-50"
                      title="Reprocess Document & Passage Index"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isReprocessing ? 'animate-spin text-indigo-400' : ''}`} />
                      <span className="text-[11px] hidden sm:inline">Reprocess</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDoc(doc);
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors text-xs flex items-center gap-1"
                      title="Delete Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[11px] hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chunk Explorer with Search & Filter */}
      <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Indexed Knowledge Chunks ({displayedChunks.length})
            </h3>
            <p className="text-xs text-slate-400">
              Passages mapped to exact pages, formulas, and verified lexical citations
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search passages, formulas, terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            {selectedDocId !== 'all' && (
              <button
                onClick={() => setSelectedDocId('all')}
                className="text-xs text-indigo-400 hover:underline shrink-0"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Chunks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedChunks.map((chunk) => (
            <div
              key={chunk.id}
              className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-indigo-400 font-medium">{chunk.id}</span>
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    {(chunk.subtopic.includes('OCR Not Supported') || chunk.text.includes('OCR Not Supported')) && (
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800 text-amber-300">
                        OCR Not Supported
                      </span>
                    )}
                    {chunk.pageOrSlide && <span>Page {chunk.pageOrSlide}</span>}
                    {chunk.timestampStart && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {chunk.timestampStart}-{chunk.timestampEnd}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[11px] font-semibold text-slate-300">
                  {chunk.topic} · <span className="text-slate-400 font-normal">{chunk.subtopic}</span>
                </div>

                <p className="text-xs text-slate-300 line-clamp-4 leading-relaxed font-sans">
                  {chunk.text}
                </p>
              </div>

              {/* Keywords and Preview action */}
              <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-hidden">
                  <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-[10px] text-slate-400 truncate">
                    {chunk.keywords.slice(0, 4).join(', ')}
                  </span>
                </div>

                <button
                  onClick={() => onSelectChunkForPreview(chunk)}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>Inspect</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Upload PDF Modal with Course Assignment & New Course Creation (Req 1, 2, 4, 5, 10) */}
      {/* ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-100">Upload PDF Document</h3>
              </div>
              <button
                onClick={() => {
                  if (!isProcessing) {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                  }
                }}
                disabled={isProcessing}
                className="text-slate-400 hover:text-slate-200 p-1 disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drag & Drop File Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-950/20'
                  : selectedFile
                  ? 'border-emerald-500/60 bg-emerald-950/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-950/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    validateAndSetFile(e.target.files[0]);
                  }
                }}
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-950/70 border border-emerald-800 text-emerald-400 mx-auto flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold text-slate-100">{selectedFile.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {(selectedFile.size / 1024).toFixed(0)} KB · Ready to process
                  </div>
                  <div className="text-[11px] text-indigo-400 hover:underline">Click or drop to select a different PDF</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-xs font-semibold text-slate-200">
                    Drag and drop your PDF here, or <span className="text-indigo-400 underline">browse files</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Supports textbook chapters, lecture notes, and exam sheets (up to 25MB).
                  </p>
                </div>
              )}
            </div>

            {/* Duplicate File Alert */}
            {isDuplicate && (
              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Duplicate filename detected:</strong> A document named &ldquo;{selectedFile?.name}&rdquo; is already present in this course. Uploading will replace the existing version and re-index all passages.
                </div>
              </div>
            )}

            {/* File Error Alert */}
            {fileError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>{fileError}</div>
              </div>
            )}

            {/* Course Assignment Section (Requirement 5) */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <label className="text-xs font-semibold text-slate-200 block">
                Assign Document to Course
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetCourseMode('current')}
                  className={`p-2 rounded-lg text-xs font-medium border text-center transition-all ${
                    targetCourseMode === 'current'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Current Course ({course.code})
                </button>

                <button
                  type="button"
                  onClick={() => setTargetCourseMode('existing')}
                  className={`p-2 rounded-lg text-xs font-medium border text-center transition-all ${
                    targetCourseMode === 'existing'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Existing Course
                </button>

                <button
                  type="button"
                  onClick={() => setTargetCourseMode('new')}
                  className={`p-2 rounded-lg text-xs font-medium border text-center transition-all ${
                    targetCourseMode === 'new'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  + Create New Course
                </button>
              </div>

              {/* Existing course selector */}
              {targetCourseMode === 'existing' && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-[11px] text-slate-400">Select Existing Course:</label>
                  <select
                    value={chosenCourseId}
                    onChange={(e) => setChosenCourseId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    {allCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}: {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Create new course form */}
              {targetCourseMode === 'new' && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Course Code *</label>
                      <input
                        type="text"
                        placeholder="e.g. BIO-101"
                        value={newCourseCode}
                        onChange={(e) => setNewCourseCode(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Category</label>
                      <input
                        type="text"
                        placeholder="e.g. Life Sciences"
                        value={newCourseCategory}
                        onChange={(e) => setNewCourseCategory(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Course Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Cellular Biology & Genetics"
                      value={newCourseTitle}
                      onChange={(e) => setNewCourseTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Progress indicator during extraction */}
            {isProcessing && (
              <div className="p-3.5 rounded-lg bg-indigo-950/40 border border-indigo-800 text-xs text-indigo-200 flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-100">{processingStage || 'Processing document...'}</div>
                  <div className="text-[11px] text-indigo-300">Preserving exact page numbers, headers, and passage boundaries.</div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleProcessPdfUpload}
                disabled={!selectedFile || isProcessing}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload & Process PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* View Document Details Modal (Requirement 6) */}
      {/* ========================================================================= */}
      {detailsDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-semibold text-slate-100">{detailsDoc.title}</h3>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {detailsDoc.id}</div>
              </div>
              <button
                onClick={() => setDetailsDoc(null)}
                className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 text-xs">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-mono">Pages</div>
                <div className="font-semibold text-slate-200 mt-0.5">
                  {detailsDoc.pageCount || (detailsDoc.chunks.length > 0 ? Math.max(...detailsDoc.chunks.map(c => c.pageOrSlide || 1)) : 1)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-mono">Passages</div>
                <div className="font-semibold text-indigo-300 mt-0.5">{detailsDoc.totalChunks}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-mono">Topic</div>
                <div className="font-semibold text-slate-200 mt-0.5 truncate">{detailsDoc.topic}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-mono">Status</div>
                <div className="font-semibold text-emerald-400 mt-0.5">
                  {detailsDoc.ocrStatus === 'ocr_not_supported' ? 'OCR Not Supported' : 'Ready / Indexed'}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-xs text-slate-300">
              <span className="font-semibold text-slate-200">Summary: </span>
              {detailsDoc.summary || 'Document extracted and indexed into grounded searchable passages.'}
            </div>

            {/* Extracted Passages Explorer */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="text-xs font-semibold text-slate-200 sticky top-0 bg-slate-900 py-1">
                Extracted Passages ({detailsDoc.chunks.length})
              </div>
              {detailsDoc.chunks.map((chk, idx) => (
                <div
                  key={chk.id}
                  className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="text-indigo-400 font-semibold">{chk.id}</span>
                    <span>Page {chk.pageOrSlide || 1}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <strong className="text-slate-300">{chk.topic}</strong> · {chk.subtopic}
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">{chk.text}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {chk.keywords.map((k, i) => (
                      <span key={i} className="text-[10px] font-mono bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setDetailsDoc(null)}
                className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Rename Document Modal (Requirement 6) */}
      {/* ========================================================================= */}
      {renameDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-400" />
              <span>Rename Document</span>
            </h3>
            <p className="text-xs text-slate-400">
              Change the display title and filename for this document across citations and retrieval.
            </p>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
              placeholder="Document title / filename"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameDoc(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                disabled={!renameValue.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Delete Confirmation Modal (Requirement 6: confirmation before deletion) */}
      {/* ========================================================================= */}
      {deleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-slate-900 border border-red-900/60 rounded-xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-100">Confirm Document Deletion</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete &ldquo;<strong>{deleteDoc.title}</strong>&rdquo;?
            </p>
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/50 text-[11px] text-red-300">
              This will remove all <strong>{deleteDoc.totalChunks}</strong> extracted passages from the RAG knowledge base. The AI Tutor and Voice Tutor will no longer reference this document.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteDoc(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Manual Ingestion Modal (Transcript/Notes) */}
      {/* ========================================================================= */}
      {showTextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">
              Paste Lecture Transcript or Course Notes
            </h3>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Lecture 04: Process Synchronization"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Source Format</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="transcript">Video / Audio Transcript</option>
                    <option value="markdown">Markdown Notes</option>
                    <option value="txt">Plain Text / Syllabus</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Topic Anchor</label>
                  <input
                    type="text"
                    value={docTopic}
                    onChange={(e) => setDocTopic(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Content / Transcript Text</label>
                <textarea
                  rows={8}
                  placeholder="Paste verbatim lecture audio transcript, article excerpts, or notes here..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTextModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer"
                >
                  Index Passages
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
