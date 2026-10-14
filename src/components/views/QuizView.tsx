import React, { useState, useEffect } from 'react';
import {
  FileQuestion,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Award,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { ChunkCitation, Course, QuestionDifficulty, QuizItem, QuizSession, QuizSubmissionItem, TopicMastery } from '../../types';
import { QuizEngine } from '../../services/quizEngine';
import { learnerEngine } from '../../services/learnerModel';

interface QuizViewProps {
  course: Course;
  masteryRecords: Record<string, TopicMastery>;
  onCompleteQuiz: (session: QuizSession, updatedMastery: Record<string, TopicMastery>) => void;
  onSelectCitation: (cit: ChunkCitation) => void;
  preselectedTopicId?: string;
}

export const QuizView: React.FC<QuizViewProps> = ({
  course,
  masteryRecords,
  onCompleteQuiz,
  onSelectCitation,
  preselectedTopicId
}) => {
  // Quiz setup state
  const [selectedTopicId, setSelectedTopicId] = useState<string>(preselectedTopicId || 'all');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | 'adaptive'>('adaptive');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [timedMode, setTimedMode] = useState<boolean>(true);

  // Active quiz state
  const [activeQuiz, setActiveQuiz] = useState<QuizItem[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(300);
  const [completedSession, setCompletedSession] = useState<QuizSession | null>(null);
  const [bktUpdatesSummary, setBktUpdatesSummary] = useState<Array<{ topicTitle: string; delta: number; newMastery: number }>>([]);

  // Timer countdown
  useEffect(() => {
    if (!activeQuiz || completedSession) return;
    if (!timedMode) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeQuiz, completedSession, timedMode, answers]);

  const handleStartQuiz = () => {
    const topicMasteryMap: Record<string, number> = {};
    Object.values(masteryRecords).forEach(m => { topicMasteryMap[m.topicId] = m.mastery; });

    const generated = QuizEngine.generateQuiz(
      course.id,
      selectedTopicId === 'all' ? undefined : selectedTopicId,
      difficulty,
      questionCount,
      topicMasteryMap
    );

    setActiveQuiz(generated);
    setCurrentIndex(0);
    setAnswers({});
    setTimeLeftSeconds(generated.length * 60);
    setCompletedSession(null);
    setBktUpdatesSummary([]);
  };

  const handleAnswerChange = (qId: string, val: string | number) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleSubmitQuiz = () => {
    if (!activeQuiz) return;

    const submissions: Record<string, QuizSubmissionItem> = {};
    let totalScore = 0;
    const topicBreakdown: Record<string, { total: number; correct: number }> = {};
    const updatedMastery = { ...masteryRecords };
    const bktSummary: Array<{ topicTitle: string; delta: number; newMastery: number }> = [];

    activeQuiz.forEach((q) => {
      const studentAns = answers[q.id] !== undefined ? answers[q.id] : '';
      const graded = QuizEngine.evaluateAnswer(q, studentAns);
      submissions[q.id] = graded;
      totalScore += graded.score;

      if (!topicBreakdown[q.topicId]) {
        topicBreakdown[q.topicId] = { total: 0, correct: 0 };
      }
      topicBreakdown[q.topicId].total += 1;
      if (graded.isCorrect) topicBreakdown[q.topicId].correct += 1;

      // Update Bayesian Knowledge Tracing model for the topic
      const currentRec = updatedMastery[q.topicId];
      if (currentRec) {
        const update = learnerEngine.updateMastery(currentRec.mastery, graded.isCorrect);
        const stability = learnerEngine.calculateStabilityDays(
          update.newMastery,
          currentRec.attemptsCount + 1,
          currentRec.correctCount + (graded.isCorrect ? 1 : 0)
        );

        updatedMastery[q.topicId] = {
          ...currentRec,
          mastery: update.newMastery,
          attemptsCount: currentRec.attemptsCount + 1,
          correctCount: currentRec.correctCount + (graded.isCorrect ? 1 : 0),
          recentAccuracy: Number((((currentRec.recentAccuracy * currentRec.attemptsCount) + (graded.isCorrect ? 1 : 0)) / (currentRec.attemptsCount + 1)).toFixed(2)),
          lastPracticedAt: new Date().toISOString(),
          stabilityDays: stability,
          nextReviewDate: new Date(Date.now() + stability * 86400000).toISOString(),
          status: learnerEngine.getStatus(update.newMastery),
          history: [
            ...currentRec.history,
            {
              timestamp: new Date().toISOString(),
              mastery: update.newMastery,
              delta: update.delta,
              event: 'quiz_item',
              correct: graded.isCorrect
            }
          ]
        };

        bktSummary.push({
          topicTitle: currentRec.topicTitle,
          delta: update.delta,
          newMastery: update.newMastery
        });
      }
    });

    const maxScore = activeQuiz.length;
    const percentage = Math.round((totalScore / maxScore) * 100);

    const session: QuizSession = {
      id: `quiz-sess-${Date.now()}`,
      courseId: course.id,
      title: `${selectedTopicId === 'all' ? 'Adaptive Comprehensive' : course.topics.find(t => t.id === selectedTopicId)?.title || 'Topic'} Assessment`,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      difficulty,
      questions: activeQuiz,
      submissions,
      totalScore,
      maxScore,
      percentage,
      durationSeconds: Math.max(1, (activeQuiz.length * 60) - timeLeftSeconds),
      topicBreakdown
    };

    setCompletedSession(session);
    setBktUpdatesSummary(bktSummary);
    onCompleteQuiz(session, updatedMastery);
  };

  // 1. SETUP VIEW
  if (!activeQuiz) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-200">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Adaptive Quiz & Mock Exam Engine</h2>
          <p className="text-xs text-slate-400 mt-1">
            Generate verifiable assessments grounded strictly in course documents. Objective items use deterministic evaluation; performance directly calibrates your Bayesian learner profile.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6 shadow-sm">
          {/* Topic Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Assessment Topic Scope
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-medium"
            >
              <option value="all">Comprehensive Adaptive (All Course Modules)</option>
              {course.topics.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title} ({Math.round((masteryRecords[t.id]?.mastery || 0.3) * 100)}% Current Mastery)
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty and Question Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Target Difficulty
              </label>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                {(['adaptive', 'easy', 'medium', 'hard'] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`py-1.5 capitalize rounded font-medium transition-colors ${
                      difficulty === d
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Number of Questions
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                {[3, 5, 8].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setQuestionCount(cnt)}
                    className={`py-1.5 rounded font-medium transition-colors ${
                      questionCount === cnt
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cnt} Items
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Timing toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-200 font-medium">Timed Exam Mode (60s / question)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={timedMode}
                onChange={(e) => setTimedMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <button
            onClick={handleStartQuiz}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate & Begin Assessment</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. RESULTS / REVIEW VIEW
  if (completedSession) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Assessment Complete</h2>
            <p className="text-xs text-slate-400 mt-1">{completedSession.title}</p>
          </div>

          <div className="flex justify-center items-center gap-8 py-2">
            <div>
              <span className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums">
                {completedSession.percentage}%
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">Final Score</span>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div>
              <span className="text-3xl font-extrabold font-mono text-slate-100 tabular-nums">
                {completedSession.totalScore} / {completedSession.maxScore}
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">Points Earned</span>
            </div>
          </div>

          {/* BKT Mastery Impacts */}
          {bktUpdatesSummary.length > 0 && (
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 text-left space-y-2">
              <h4 className="text-xs font-semibold text-indigo-300">
                Bayesian Knowledge Tracing Updates Applied:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {bktUpdatesSummary.map((bkt, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <span className="truncate max-w-[160px] text-slate-300">{bkt.topicTitle}</span>
                    <span className={`font-mono font-semibold ${bkt.delta >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {bkt.delta >= 0 ? `+${(bkt.delta * 100).toFixed(1)}%` : `${(bkt.delta * 100).toFixed(1)}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => { setActiveQuiz(null); setCompletedSession(null); }}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              Take Another Assessment
            </button>
          </div>
        </div>

        {/* Question-by-Question Review */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">Question-by-Question Detailed Review</h3>
          {completedSession.questions.map((q, idx) => {
            const sub = completedSession.submissions[q.id];
            const isCorrect = sub?.isCorrect;

            return (
              <div
                key={q.id}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-200">Question {idx + 1}</span>
                    <span className="text-xs text-slate-500">· {q.subtopic}</span>
                  </div>
                  <span className={`text-[11px] font-mono font-semibold uppercase ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                <p className="text-xs font-medium text-slate-200 leading-relaxed">{q.prompt}</p>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                  <p className="text-slate-400">
                    Your Answer: <span className="font-semibold text-slate-200">{String(sub?.studentAnswer || '(No answer provided)')}</span>
                  </p>
                  {!isCorrect && (
                    <p className="text-emerald-400">
                      Answer Key: <span className="font-semibold">{String(q.correctAnswer)}</span>
                    </p>
                  )}
                  <p className="text-slate-300 pt-1 leading-relaxed border-t border-slate-800/60 mt-1">
                    {q.explanation}
                  </p>
                </div>

                {/* Citation Preview Button */}
                {q.sourceCitations && q.sourceCitations.length > 0 && (
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Grounded in Course Material:</span>
                    <button
                      onClick={() => onSelectCitation(q.sourceCitations[0])}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Inspect Source Excerpt</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. ACTIVE QUIZ RUNNER VIEW
  const currentItem = activeQuiz[currentIndex];
  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Status & Timer Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span className="font-bold text-slate-200">
            Question {currentIndex + 1} of {activeQuiz.length}
          </span>
          <span className="text-slate-500 ml-2">· {currentItem.subtopic}</span>
        </div>

        {timedMode && (
          <div className={`flex items-center gap-1.5 font-mono font-semibold px-2.5 py-1 rounded-md ${
            timeLeftSeconds < 60 ? 'bg-red-950/60 text-red-400 border border-red-800' : 'bg-slate-950 text-indigo-400'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            <span>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>

      {/* Question Card */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-5 shadow-sm">
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-indigo-400 font-semibold">
            {currentItem.type.replace('-', ' ')}
          </span>
          <h3 className="text-sm font-semibold text-slate-100 leading-relaxed">
            {currentItem.prompt}
          </h3>
        </div>

        {/* Answers inputs */}
        {currentItem.type === 'multiple-choice' && currentItem.options && (
          <div className="space-y-2">
            {currentItem.options.map((opt, oIdx) => {
              const isSelected = answers[currentItem.id] === opt;
              return (
                <button
                  key={oIdx}
                  type="button"
                  onClick={() => handleAnswerChange(currentItem.id, opt)}
                  className={`w-full text-left p-3.5 rounded-lg border text-xs transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/40'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center font-mono text-[10px] text-slate-400 shrink-0">
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    <span>{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {currentItem.type === 'numerical' && (
          <div className="space-y-2">
            <input
              type="number"
              step="any"
              placeholder="Enter numerical solution (e.g. 9.0)..."
              value={answers[currentItem.id] !== undefined ? String(answers[currentItem.id]) : ''}
              onChange={(e) => handleAnswerChange(currentItem.id, e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-400">
              Evaluated with tolerance ±{currentItem.tolerance ?? 0.05}.
            </p>
          </div>
        )}

        {currentItem.type === 'short-answer' && (
          <div className="space-y-2">
            <textarea
              rows={4}
              placeholder="Provide concise conceptual reasoning grounded in the course material..."
              value={answers[currentItem.id] !== undefined ? String(answers[currentItem.id]) : ''}
              onChange={(e) => handleAnswerChange(currentItem.id, e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 font-sans leading-relaxed"
            />
          </div>
        )}

        {/* Navigation buttons */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(prev => prev - 1)}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {currentIndex < activeQuiz.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex(prev => prev + 1)}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1"
            >
              <span>Next Question</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitQuiz}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>Submit Assessment</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
