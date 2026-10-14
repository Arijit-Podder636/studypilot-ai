import React, { useState } from 'react';
import { Network, CheckCircle2, AlertCircle, BookOpen, ArrowRight, ShieldCheck } from 'lucide-react';
import { Course, DocumentSource, TopicMastery } from '../../types';

interface KnowledgeMapViewProps {
  course: Course;
  documents: DocumentSource[];
  masteryRecords: Record<string, TopicMastery>;
  onStartQuizForTopic: (topicId: string) => void;
  onNavigateToLibrary: () => void;
}

export const KnowledgeMapView: React.FC<KnowledgeMapViewProps> = ({
  course,
  documents,
  masteryRecords,
  onStartQuizForTopic,
  onNavigateToLibrary
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(course.topics[0]?.id || '');

  const activeTopic = course.topics.find(t => t.id === selectedTopicId) || course.topics[0];
  const activeMastery = masteryRecords[activeTopic?.id]?.mastery || 0.3;
  const masteryPct = Math.round(activeMastery * 100);

  // Find documents relevant to this topic
  const relevantDocs = documents.filter(d =>
    d.topic.toLowerCase().includes(activeTopic.title.toLowerCase()) ||
    activeTopic.title.toLowerCase().includes(d.topic.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-slate-100">Course Concept & Knowledge Map</h2>
        <p className="text-xs text-slate-400 mt-1">
          Dependency graph modeling prerequisite concepts, mathematical foundations, and supporting source chunk mappings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conceptual Dependency Flow Nodes (Left/Middle) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">Learning Pathway & Prerequisites</h3>
            <span className="text-xs text-slate-400">Sequential Mastery Flow</span>
          </div>

          <div className="space-y-4">
            {course.topics.map((t, idx) => {
              const record = masteryRecords[t.id];
              const mVal = record ? Math.round(record.mastery * 100) : 30;
              const isSelected = selectedTopicId === t.id;
              const isMastered = mVal >= 80;

              return (
                <div key={t.id} className="relative">
                  {/* Vertical connector line */}
                  {idx < course.topics.length - 1 && (
                    <div className="absolute left-6 top-14 bottom-[-16px] w-0.5 bg-slate-800 z-0" />
                  )}

                  <div
                    onClick={() => setSelectedTopicId(t.id)}
                    className={`relative z-10 p-5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500 ring-1 ring-indigo-500/40 shadow-md'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                          isMastered
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                            : isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          0{idx + 1}
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-slate-100">{t.title}</h4>
                          <p className="text-xs text-slate-400 leading-relaxed max-w-xl">{t.description}</p>

                          {/* Subtopics pill row */}
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {t.subtopics.map((st, sIdx) => (
                              <span
                                key={sIdx}
                                className="text-[11px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800/80"
                              >
                                {st}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-bold text-slate-100 tabular-nums">
                          {mVal}%
                        </span>
                        <span className="block text-[10px] text-slate-500 uppercase mt-0.5 font-semibold">
                          {record?.status ? record.status.replace('_', ' ') : 'developing'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Topic Inspector (Right Column) */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-5 h-fit shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-indigo-400 font-semibold">
              Selected Topic Details
            </span>
            <h3 className="text-base font-bold text-slate-100">{activeTopic.title}</h3>
          </div>

          {/* Mastery Bar */}
          <div className="space-y-2 p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Current Knowledge State</span>
              <span className="font-mono font-bold text-slate-200">{masteryPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${masteryPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              Prerequisite dependencies: {activeTopic.prerequisites.join(', ')}
            </p>
          </div>

          {/* Supporting Documents */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-slate-300 block">
              Supporting Course Documents ({relevantDocs.length})
            </span>
            {relevantDocs.length > 0 ? (
              <div className="space-y-2">
                {relevantDocs.map(d => (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate text-slate-300">{d.title}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">
                      {d.totalChunks} chunks
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                General documents indexed across all modules.
              </p>
            )}
          </div>

          {/* Action CTAs */}
          <div className="pt-2 space-y-2">
            <button
              onClick={() => onStartQuizForTopic(activeTopic.id)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Test Mastery in this Topic</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onNavigateToLibrary}
              className="w-full py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              View Topic Chunks in Library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
