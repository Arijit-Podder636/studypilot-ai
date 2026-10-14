import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Brain,
  Sparkles,
  Calendar,
  Clock
} from 'lucide-react';
import { Course, DocumentSource, QuizSession, RevisionTask, TopicMastery } from '../../types';

interface DashboardViewProps {
  course: Course;
  documents: DocumentSource[];
  masteryRecords: Record<string, TopicMastery>;
  quizSessions: QuizSession[];
  revisionTasks: RevisionTask[];
  onNavigate: (tab: string) => void;
  onStartQuiz: (topicId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  course,
  documents,
  masteryRecords,
  quizSessions,
  revisionTasks,
  onNavigate,
  onStartQuiz
}) => {
  const masteryValues = Object.values(masteryRecords);
  const overallMastery = masteryValues.length > 0
    ? Math.round((masteryValues.reduce((acc, m) => acc + m.mastery, 0) / masteryValues.length) * 100)
    : 35;

  const weakTopics = masteryValues
    .filter(m => m.mastery < 0.60)
    .sort((a, b) => a.mastery - b.mastery);

  const recentQuiz = quizSessions.length > 0 ? quizSessions[0] : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Hero Welcome Banner */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Bayesian Knowledge Tracing Active</span>
            <span className="text-slate-600">·</span>
            <span>{course.code}</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-100 tracking-tight">
            Welcome back to {course.title}
          </h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Every AI explanation and quiz is strictly grounded in your {documents.length} ingested source documents. Mastery updates probabilistically after verified recall.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onStartQuiz()}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm flex items-center gap-2"
          >
            <span>Run Adaptive Quiz</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigate('tutor')}
            className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
          >
            Ask AI Tutor
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Overall Course Mastery</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {overallMastery}%
          </div>
          <p className="text-[11px] text-slate-400">
            Estimated via BKT algorithm
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Study Documents</span>
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {documents.length}
          </div>
          <p className="text-[11px] text-slate-400">
            {documents.reduce((acc, d) => acc + d.totalChunks, 0)} structural chunks indexed
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Assessments Completed</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {quizSessions.length}
          </div>
          <p className="text-[11px] text-slate-400">
            {recentQuiz ? `Latest score: ${recentQuiz.percentage}%` : 'No quizzes submitted yet'}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Scheduled Revisions</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {revisionTasks.filter(t => !t.isCompleted).length}
          </div>
          <p className="text-[11px] text-slate-400">
            Spaced repetition intervals active
          </p>
        </div>
      </div>

      {/* Main Grid: Topic Mastery Breakdown + Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topic-Wise Mastery List */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Topic-Wise Conceptual Mastery</h3>
              <p className="text-xs text-slate-400">Bayesian Knowledge Tracing posterior probabilities</p>
            </div>
            <button
              onClick={() => onNavigate('analytics')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <span>Full Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {course.topics.map((t) => {
              const record = masteryRecords[t.id];
              const masteryPct = record ? Math.round(record.mastery * 100) : 30;
              const statusColor = masteryPct >= 80 ? 'bg-emerald-500' : masteryPct >= 60 ? 'bg-indigo-500' : 'bg-amber-500';

              return (
                <div key={t.id} className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">{t.title}</h4>
                      <p className="text-[11px] text-slate-400 truncate max-w-md">{t.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-slate-100 tabular-nums">{masteryPct}%</span>
                      <span className="block text-[10px] text-slate-400">
                        {record?.attemptsCount ?? 0} questions
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${statusColor} transition-all duration-500`}
                      style={{ width: `${masteryPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-slate-400">
                      Prerequisites: {t.prerequisites.join(', ')}
                    </span>
                    <button
                      onClick={() => onStartQuiz(t.id)}
                      className="text-indigo-400 hover:underline font-medium"
                    >
                      Practice Topic →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Weak Topics Alert & Next Action */}
        <div className="space-y-6">
          {/* Weak Topics Alert */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Priority Weak Areas
              </h3>
            </div>

            {weakTopics.length > 0 ? (
              <div className="space-y-2.5">
                {weakTopics.slice(0, 3).map((wt) => (
                  <div key={wt.topicId} className="p-3 rounded-lg bg-slate-950/80 border border-amber-950/40 text-xs flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-200">{wt.topicTitle}</p>
                      <p className="text-[11px] text-amber-400/90 font-mono">Mastery: {Math.round(wt.mastery * 100)}%</p>
                    </div>
                    <button
                      onClick={() => onStartQuiz(wt.topicId)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 rounded transition-colors"
                    >
                      Targeted Quiz
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                All course topics are currently at or above 60% mastery threshold. Keep up regular spaced reviews!
              </p>
            )}
          </div>

          {/* Recommended Next Learning Activity */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Recommended Action
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {weakTopics.length > 0
                ? `Focus on "${weakTopics[0].topicTitle}". Your Bayesian prior indicates this is your highest-yield opportunity for score improvement.`
                : 'Take an advanced mock exam covering multi-chunk synthesis to test higher-order reasoning under time pressure.'}
            </p>

            <button
              onClick={() => onNavigate(weakTopics.length > 0 ? 'tutor' : 'quiz')}
              className="w-full py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 flex items-center justify-center gap-2"
            >
              <span>{weakTopics.length > 0 ? 'Open Socratic Tutor' : 'Launch Mock Exam'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Recent Quiz Summary */}
          {recentQuiz && (
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Latest Assessment
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {recentQuiz.percentage}%
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">{recentQuiz.title}</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {recentQuiz.durationSeconds}s
                </span>
                <span>{recentQuiz.questions.length} questions</span>
              </div>
              <button
                onClick={() => onNavigate('quiz')}
                className="text-xs text-indigo-400 hover:underline font-medium block"
              >
                Review Mistakes & Citations →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
