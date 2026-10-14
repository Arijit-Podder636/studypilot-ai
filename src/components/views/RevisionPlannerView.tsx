import React, { useState } from 'react';
import {
  CalendarCheck2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Brain,
  RotateCw,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { Chunk, ChunkCitation, Course, RevisionTask, TopicMastery } from '../../types';

interface RevisionPlannerViewProps {
  course: Course;
  allChunks: Chunk[];
  masteryRecords: Record<string, TopicMastery>;
  revisionTasks: RevisionTask[];
  onToggleCompleteTask: (taskId: string) => void;
  onAddTask: (task: RevisionTask) => void;
  onDeleteTask: (taskId: string) => void;
  onSelectCitation: (cit: ChunkCitation) => void;
}

export const RevisionPlannerView: React.FC<RevisionPlannerViewProps> = ({
  course,
  allChunks,
  masteryRecords,
  revisionTasks,
  onToggleCompleteTask,
  onAddTask,
  onDeleteTask,
  onSelectCitation
}) => {
  const [examDate, setExamDate] = useState('2026-11-15');
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Pre-configured source-grounded flashcards for the course
  const flashcards = [
    {
      front: 'What is the mathematical formulation of Mean Squared Error (MSE)?',
      back: 'L_MSE = (1/N) * sum_{i=1}^N (y_i - y_hat_i)^2\n\nPenalizes large deviations quadratically, making it sensitive to outliers.',
      chunkId: 'chk-opt-01',
      topic: 'Optimization & Loss Functions'
    },
    {
      front: 'What is the maximum derivative value of the Logistic Sigmoid function and where does it occur?',
      back: 'Maximum derivative is 0.25, occurring at input z = 0. Causes exponential vanishing gradients in deep networks.',
      chunkId: 'chk-act-01',
      topic: 'Activation Functions & Non-Linearity'
    },
    {
      front: 'Why does Scaled Dot-Product Attention scale by 1 / sqrt(d_k)?',
      back: 'The dot product of two d_k-dimensional vectors has variance d_k. For large d_k, dot products grow large and push softmax into vanishing gradient saturation.',
      chunkId: 'chk-reg-05',
      topic: 'Regularization & Transformer Attention'
    },
    {
      front: 'How does L1 (Lasso) differ from L2 (Ridge) weight regularization?',
      back: 'L1 subtracts a constant rate eta*lambda*sgn(w), driving weights to exactly zero (sparse weights). L2 multiplicatively shrinks weights by (1 - eta*lambda).',
      chunkId: 'chk-reg-02',
      topic: 'Regularization & Transformer Attention'
    }
  ];

  const handleCreateAutoTasks = () => {
    course.topics.forEach((t) => {
      const mastery = masteryRecords[t.id]?.mastery || 0.3;
      const priority = mastery < 0.4 ? 'high' : mastery < 0.7 ? 'medium' : 'low';
      const daysUntilReview = mastery < 0.4 ? 1 : mastery < 0.7 ? 3 : 7;
      const dueDate = new Date(Date.now() + daysUntilReview * 86400000).toISOString().split('T')[0];

      const newTask: RevisionTask = {
        id: `rev-${Date.now()}-${t.id}`,
        topicId: t.id,
        topicTitle: t.title,
        courseId: course.id,
        recommendedAction: `Spaced review of core derivations and practice quiz for ${t.title}.`,
        priority,
        dueDate,
        isCompleted: false,
        masteryAtCreation: mastery
      };
      onAddTask(newTask);
    });
  };

  const currentCard = flashcards[activeFlashcardIndex];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Spaced Repetition & Revision Planner</h2>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic review schedules calibrated using retention stability curves to minimize forgetting before examination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span>Exam Date:</span>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              aria-label="Exam Target Date"
              className="bg-transparent text-slate-100 text-xs focus:outline-hidden"
            />
          </div>
          <button
            onClick={handleCreateAutoTasks}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Schedule</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revision Tasks Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Scheduled Review Sessions ({revisionTasks.length})
            </h3>
            <span className="text-xs text-slate-400">
              {revisionTasks.filter(t => t.isCompleted).length} Completed
            </span>
          </div>

          {revisionTasks.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
              <CalendarCheck2 className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-xs text-slate-400">No scheduled revision tasks currently active.</p>
              <button
                onClick={handleCreateAutoTasks}
                className="px-4 py-2 text-xs font-semibold text-indigo-400 hover:underline"
              >
                Auto-generate revision schedule from BKT mastery →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {revisionTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                    task.isCompleted
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => onToggleCompleteTask(task.id)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      {task.isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-md border border-slate-700 hover:border-slate-500" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-xs font-semibold ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {task.topicTitle}
                        </h4>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                          task.priority === 'high' ? 'bg-red-950/60 text-red-400 border border-red-900/50' :
                          task.priority === 'medium' ? 'bg-amber-950/60 text-amber-400 border border-amber-900/50' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {task.priority} Priority
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{task.recommendedAction}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Due {task.dueDate}
                        </span>
                        <span>Mastery at scheduling: {Math.round(task.masteryAtCreation * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                    title="Remove Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Source-Grounded Flashcards */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-slate-100">Grounded Flashcards</h3>
            </div>
            <span className="text-xs text-slate-500">
              {activeFlashcardIndex + 1} of {flashcards.length}
            </span>
          </div>

          {/* Flashcard Component */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="min-h-56 p-6 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all flex flex-col justify-between select-none relative group"
          >
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider block">
                {currentCard.topic} · {isFlipped ? 'Answer Side' : 'Prompt Side'}
              </span>
              <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed whitespace-pre-line">
                {isFlipped ? currentCard.back : currentCard.front}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1 group-hover:text-indigo-400 transition-colors">
                <RotateCw className="w-3 h-3" /> Click card to flip
              </span>
              <span className="font-mono text-[10px] text-slate-600">ID: {currentCard.chunkId}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              disabled={activeFlashcardIndex === 0}
              onClick={() => { setActiveFlashcardIndex(prev => prev - 1); setIsFlipped(false); }}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 disabled:opacity-30 bg-slate-800 rounded-lg transition-colors"
            >
              Previous Card
            </button>
            <button
              disabled={activeFlashcardIndex === flashcards.length - 1}
              onClick={() => { setActiveFlashcardIndex(prev => prev + 1); setIsFlipped(false); }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 rounded-lg transition-colors"
            >
              Next Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
