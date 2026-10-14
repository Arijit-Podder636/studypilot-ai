import React, { useState, useEffect } from 'react';
import {
  Course,
  DocumentSource,
  EvaluationRunSummary,
  QuizSession,
  RevisionTask,
  TopicMastery,
  TutorMessage,
  ChunkCitation,
  Chunk,
  VoiceSettings
} from './types';
import { appDb } from './services/db';
import { apiClient } from './services/api';
import { loadVoiceSettings, saveVoiceSettings } from './services/voiceSettingsService';
import { SAMPLE_COURSE, SAMPLE_DOCUMENTS } from './data/sampleCourse';

// Layout components
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { CitationDrawer } from './components/common/CitationDrawer';

// Views
import { DashboardView } from './components/views/DashboardView';
import { LibraryView } from './components/views/LibraryView';
import { TutorView } from './components/views/TutorView';
import { QuizView } from './components/views/QuizView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { RevisionPlannerView } from './components/views/RevisionPlannerView';
import { KnowledgeMapView } from './components/views/KnowledgeMapView';
import { EvaluationLabView } from './components/views/EvaluationLabView';
import { SettingsView } from './components/views/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(false);

  // Core Persistent State
  const [availableCourses, setAvailableCourses] = useState<Course[]>([SAMPLE_COURSE]);
  const [activeCourse, setActiveCourse] = useState<Course>(SAMPLE_COURSE);
  const [documents, setDocuments] = useState<DocumentSource[]>(SAMPLE_DOCUMENTS);
  const [masteryRecords, setMasteryRecords] = useState<Record<string, TopicMastery>>({});
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([]);
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [revisionTasks, setRevisionTasks] = useState<RevisionTask[]>([]);
  const [evaluationRuns, setEvaluationRuns] = useState<EvaluationRunSummary[]>([]);

  // Citation inspection drawer
  const [activeCitation, setActiveCitation] = useState<ChunkCitation | null>(null);
  const [preselectedQuizTopicId, setPreselectedQuizTopicId] = useState<string | undefined>();

  // Initial Load from IndexedDB
  const refreshAllData = async () => {
    try {
      const [
        loadedCourses,
        loadedDocs,
        loadedMastery,
        loadedQuizzes,
        loadedTutor,
        loadedRevision,
        loadedEvals
      ] = await Promise.all([
        appDb.getCourses(),
        appDb.getDocuments(),
        appDb.getMasteryRecords(),
        appDb.getQuizSessions(),
        appDb.getTutorMessages(),
        appDb.getRevisionTasks(),
        appDb.getEvaluationRuns()
      ]);

      setAvailableCourses(loadedCourses);
      setActiveCourse(loadedCourses[0] || SAMPLE_COURSE);
      setDocuments(loadedDocs);
      setMasteryRecords(loadedMastery);
      setQuizSessions(loadedQuizzes);
      setTutorMessages(loadedTutor);
      setRevisionTasks(loadedRevision);
      setEvaluationRuns(loadedEvals);
    } catch (err) {
      console.error('Failed to load initial storage:', err);
    }
  };

  // Voice Tutoring & Audio preferences
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => loadVoiceSettings());

  const handleUpdateVoiceSettings = (newSettings: VoiceSettings) => {
    setVoiceSettings(newSettings);
    saveVoiceSettings(newSettings);
  };

  useEffect(() => {
    refreshAllData();
    apiClient.getHealth().then((h) => setHasGeminiKey(h.hasGeminiKey));

    const handleVoiceChanged = (e: any) => {
      if (e.detail) {
        setVoiceSettings(e.detail);
      }
    };
    window.addEventListener('studypilot_voice_settings_changed', handleVoiceChanged);
    return () => {
      window.removeEventListener('studypilot_voice_settings_changed', handleVoiceChanged);
    };
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Isolate documents and knowledge chunks strictly by the active course with deduplication
  const docMap = new Map<string, DocumentSource>();
  documents.forEach((d) => {
    docMap.set(d.id, d);
  });
  const uniqueDocuments = Array.from(docMap.values());
  const activeCourseDocuments = uniqueDocuments.filter((d) => d.courseId === activeCourse.id);

  // Strictly deduplicate chunks by chunk ID
  const chunkMap = new Map<string, Chunk>();
  activeCourseDocuments.forEach((d) => {
    d.chunks.forEach((c) => {
      if (!chunkMap.has(c.id)) {
        chunkMap.set(c.id, c);
      }
    });
  });
  const activeCourseChunks: Chunk[] = Array.from(chunkMap.values());

  // Event handlers
  const handleAddCourse = async (newCourse: Course) => {
    await appDb.saveCourse(newCourse);
    setAvailableCourses((prev) => {
      const filtered = prev.filter((c) => c.id !== newCourse.id);
      return [...filtered, newCourse];
    });
    setActiveCourse(newCourse);
  };

  const handleAddDocument = async (doc: DocumentSource) => {
    await appDb.saveDocument(doc);
    setDocuments((prev) => {
      const filtered = prev.filter(
        (d) => d.id !== doc.id && !(d.courseId === doc.courseId && d.title.toLowerCase() === doc.title.toLowerCase())
      );
      return [...filtered, doc];
    });
  };

  const handleUpdateDocument = async (doc: DocumentSource) => {
    await appDb.saveDocument(doc);
    setDocuments((prev) => {
      const filtered = prev.filter((d) => d.id !== doc.id);
      return [...filtered, doc];
    });
  };

  const handleDeleteDocument = async (docId: string) => {
    await appDb.deleteDocument(docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleSendMessage = async (msg: TutorMessage) => {
    await appDb.saveTutorMessage(msg);
    setTutorMessages((prev) => [...prev, msg]);
  };

  const handleClearTutor = async () => {
    await appDb.clearTutorMessages();
    setTutorMessages([]);
  };

  const handleCompleteQuiz = async (
    session: QuizSession,
    updatedMastery: Record<string, TopicMastery>
  ) => {
    await appDb.saveQuizSession(session);
    setQuizSessions((prev) => [session, ...prev]);

    for (const record of Object.values(updatedMastery)) {
      await appDb.saveMasteryRecord(record);
    }
    setMasteryRecords(updatedMastery);
  };

  const handleToggleCompleteTask = async (taskId: string) => {
    const task = revisionTasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = { ...task, isCompleted: !task.isCompleted };
    await appDb.saveRevisionTask(updated);
    setRevisionTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
  };

  const handleAddTask = async (task: RevisionTask) => {
    await appDb.saveRevisionTask(task);
    setRevisionTasks((prev) => [...prev, task]);
  };

  const handleDeleteTask = async (taskId: string) => {
    await appDb.deleteRevisionTask(taskId);
    setRevisionTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleSaveEvaluationRun = async (summary: EvaluationRunSummary) => {
    await appDb.saveEvaluationRun(summary);
    setEvaluationRuns((prev) => [summary, ...prev]);
  };

  const handleQuickQuizLaunch = (topicId?: string) => {
    setPreselectedQuizTopicId(topicId);
    setActiveTab('quiz');
  };

  const handleExportData = async () => {
    const data = await appDb.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studypilot-analytics-export-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* 3-Zone Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDark={isDark}
        toggleTheme={() => setIsDark(!isDark)}
        onQuickAction={() => handleQuickQuizLaunch()}
        hasGeminiKey={hasGeminiKey}
      />

      {/* Main Workspace: Sidebar + Viewport */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeCourse={activeCourse}
          availableCourses={availableCourses}
          onSelectCourse={setActiveCourse}
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && (
            <DashboardView
              course={activeCourse}
              documents={activeCourseDocuments}
              masteryRecords={masteryRecords}
              quizSessions={quizSessions}
              revisionTasks={revisionTasks}
              onNavigate={setActiveTab}
              onStartQuiz={handleQuickQuizLaunch}
            />
          )}

          {activeTab === 'library' && (
            <LibraryView
              course={activeCourse}
              documents={activeCourseDocuments}
              allCourses={availableCourses}
              onAddDocument={handleAddDocument}
              onUpdateDocument={handleUpdateDocument}
              onDeleteDocument={handleDeleteDocument}
              onAddCourse={handleAddCourse}
              onSelectCourse={setActiveCourse}
              onSelectChunkForPreview={(chunk) => {
                const isOcrNotSupported = chunk.subtopic.includes('OCR Not Supported') || chunk.text.includes('OCR Not Supported');
                setActiveCitation({
                  chunkId: chunk.id,
                  documentTitle: chunk.documentTitle,
                  pageOrSlide: chunk.pageOrSlide,
                  timestamp: chunk.timestampStart ? `${chunk.timestampStart}-${chunk.timestampEnd}` : undefined,
                  excerpt: chunk.text,
                  // Library preview of a stored passage: no claim is being checked, so no score is shown.
                  supportKind: isOcrNotSupported ? 'ocr_not_supported' : 'unchecked'
                });
              }}
            />
          )}

          {activeTab === 'tutor' && (
            <TutorView
              course={activeCourse}
              documents={activeCourseDocuments}
              allChunks={activeCourseChunks}
              messages={tutorMessages.filter((m) => !m.courseId || m.courseId === activeCourse.id)}
              voiceSettings={voiceSettings}
              onSendMessage={handleSendMessage}
              onClearHistory={handleClearTutor}
              onSelectCitation={setActiveCitation}
              onNavigateToLibrary={() => setActiveTab('library')}
            />
          )}

          {activeTab === 'quiz' && (
            <QuizView
              course={activeCourse}
              masteryRecords={masteryRecords}
              onCompleteQuiz={handleCompleteQuiz}
              onSelectCitation={setActiveCitation}
              preselectedTopicId={preselectedQuizTopicId}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              course={activeCourse}
              masteryRecords={masteryRecords}
              quizSessions={quizSessions}
              onExportData={handleExportData}
            />
          )}

          {activeTab === 'revision' && (
            <RevisionPlannerView
              course={activeCourse}
              allChunks={activeCourseChunks}
              masteryRecords={masteryRecords}
              revisionTasks={revisionTasks}
              onToggleCompleteTask={handleToggleCompleteTask}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
              onSelectCitation={setActiveCitation}
            />
          )}

          {activeTab === 'knowledge-map' && (
            <KnowledgeMapView
              course={activeCourse}
              documents={activeCourseDocuments}
              masteryRecords={masteryRecords}
              onStartQuizForTopic={handleQuickQuizLaunch}
              onNavigateToLibrary={() => setActiveTab('library')}
            />
          )}

          {activeTab === 'evaluation-lab' && (
            <EvaluationLabView
              evaluationRuns={evaluationRuns}
              onSaveRun={handleSaveEvaluationRun}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              onRefreshAllData={refreshAllData}
              voiceSettings={voiceSettings}
              onUpdateVoiceSettings={handleUpdateVoiceSettings}
            />
          )}
        </main>
      </div>

      {/* Verified Citation Drawer */}
      <CitationDrawer
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}
