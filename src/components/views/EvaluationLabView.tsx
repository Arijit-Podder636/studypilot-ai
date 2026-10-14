import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Download,
  Users,
  TrendingUp,
  Brain,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  EvaluationRunSummary,
  EvaluationTestCase,
  SimulationRunResult
} from '../../types';
import { SAMPLE_EVALUATION_CASES } from '../../data/sampleCourse';
import { evalLab } from '../../services/evaluationLab';
import { learnerEngine } from '../../services/learnerModel';

interface EvaluationLabViewProps {
  evaluationRuns: EvaluationRunSummary[];
  onSaveRun: (summary: EvaluationRunSummary) => void;
}

// Metrics that do not apply to a case or run are null; show a dash rather than a fake percentage.
const fmtPct = (value: number | null | undefined, digits = 1): string =>
  typeof value === 'number' ? `${(value * 100).toFixed(digits)}%` : '—';

export const EvaluationLabView: React.FC<EvaluationLabViewProps> = ({
  evaluationRuns,
  onSaveRun
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'benchmarks' | 'simulations'>('benchmarks');
  const [activeRun, setActiveRun] = useState<EvaluationRunSummary | null>(
    evaluationRuns.length > 0 ? evaluationRuns[0] : null
  );
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);

  // Simulated student experiments state
  const [simProfile, setSimProfile] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [simMode, setSimMode] = useState<'adaptive' | 'fixed-difficulty'>('adaptive');
  const [simResult, setSimResult] = useState<SimulationRunResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleRunEvaluation = async () => {
    setIsRunning(true);
    try {
      const summary = await evalLab.runBenchmarkSuite(SAMPLE_EVALUATION_CASES);
      setActiveRun(summary);
      onSaveRun(summary);
    } catch (err) {
      console.error('Evaluation run failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const res = learnerEngine.simulateStudentTrial(simProfile, simMode, 5);
      setSimResult(res);
      setIsSimulating(false);
    }, 400);
  };

  const downloadJsonReport = () => {
    if (!activeRun) return;
    const blob = new Blob([JSON.stringify(activeRun, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studypilot-evaluation-report-${activeRun.id}.json`;
    a.click();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header and Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-400" />
            <span>Evaluation Lab — Hackathon Track D</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Empirical benchmark verification across 15 test cases (Context Precision, Recall, Faithfulness, Refusal) and simulated student trials.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
            <button
              onClick={() => setActiveTab('benchmarks')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'benchmarks' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RAG Benchmarks
            </button>
            <button
              onClick={() => setActiveTab('simulations')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'simulations' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Simulated Students
            </button>
          </div>

          {activeTab === 'benchmarks' && (
            <button
              onClick={handleRunEvaluation}
              disabled={isRunning}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunning ? 'Evaluating...' : 'Run Test Suite'}</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'benchmarks' ? (
        <div className="space-y-8">
          {/* Active Run Metric Scorecards */}
          {activeRun ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Context Precision</span>
                  <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                    {fmtPct(activeRun.averageContextPrecision)}
                  </div>
                  <span className="text-[10px] text-slate-500">Retrieved relevance</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Context Recall</span>
                  <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                    {fmtPct(activeRun.averageContextRecall)}
                  </div>
                  <span className="text-[10px] text-slate-500">Target chunk coverage</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Answer Faithfulness</span>
                  <div className="text-xl font-bold font-mono text-indigo-400 tabular-nums">
                    {fmtPct(activeRun.averageFaithfulness)}
                  </div>
                  <span className="text-[10px] text-slate-500">Answer terms found in retrieved text</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Answer Relevancy</span>
                  <div className="text-xl font-bold font-mono text-indigo-400 tabular-nums">
                    {fmtPct(activeRun.averageAnswerRelevancy)}
                  </div>
                  <span className="text-[10px] text-slate-500">Term overlap with reference answer</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Refusal Accuracy</span>
                  <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums">
                    {fmtPct(activeRun.refusalPrecision)}
                  </div>
                  <span className="text-[10px] text-slate-500">Unsupported query refusal</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Suite Pass Rate</span>
                  <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
                    {activeRun.passedCases} / {activeRun.totalCases}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {Math.round((activeRun.passedCases / activeRun.totalCases) * 100)}% Pass
                  </span>
                </div>
              </div>

              {/* Benchmark Run Details and Export */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Model evaluated: <strong className="text-slate-200">{activeRun.modelUsed}</strong></span>
                <button
                  onClick={downloadJsonReport}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Benchmark Audit (.json)</span>
                </button>
              </div>

              {/* Per-Question Results Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-100">
                  Versioned Test Suite Evaluation Cases (15/15)
                </h3>

                <div className="space-y-2.5">
                  {activeRun.results.map((res, idx) => {
                    const isExpanded = expandedCaseId === res.testCaseId;
                    return (
                      <div
                        key={res.testCaseId}
                        className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden"
                      >
                        <div
                          onClick={() => setExpandedCaseId(isExpanded ? null : res.testCaseId)}
                          className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            {res.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                            )}
                            <span className="font-mono text-xs text-slate-500 shrink-0">
                              #{String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="text-xs font-medium text-slate-200 truncate">
                              {res.question}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 text-xs">
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800">
                              {res.category}
                            </span>
                            <span className={`font-mono text-xs font-bold ${res.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                              {res.passed ? 'PASS' : 'FAIL'}
                            </span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                          </div>
                        </div>

                        {/* Collapsible Details */}
                        {isExpanded && (
                          <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3 text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                              <div>Precision: <span className="text-emerald-400 font-bold">{fmtPct(res.contextPrecision, 0)}</span></div>
                              <div>Recall: <span className="text-emerald-400 font-bold">{fmtPct(res.contextRecall, 0)}</span></div>
                              <div>Faithfulness: <span className="text-indigo-400 font-bold">{fmtPct(res.faithfulness, 0)}</span></div>
                              <div>Refusal: <span className="text-cyan-400 font-bold">{res.isRefusal ? 'YES' : 'NO'}</span></div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-slate-500 font-semibold block text-[11px] uppercase">
                                Synthesized Answer / Refusal
                              </span>
                              <p className="text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800/80 leading-relaxed font-sans">
                                {res.generatedAnswer}
                              </p>
                            </div>

                            <p className="text-[11px] text-slate-400 italic">
                              {res.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-4">
              <FlaskConical className="w-10 h-10 text-indigo-400 mx-auto" />
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-semibold text-slate-100">
                  Execute Versioned Benchmark Suite
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Run all 15 deterministic and multi-chunk queries against the Machine Learning course to calculate Context Precision, Faithfulness, and Unsupported Refusal rates.
                </p>
              </div>
              <button
                onClick={handleRunEvaluation}
                disabled={isRunning}
                className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-md"
              >
                {isRunning ? 'Running Benchmarks...' : 'Start Benchmark Runner'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* SIMULATED STUDENTS VIEW (Section 14) */
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Simulated Learner Persona Experiments
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Run reproducible multi-session learning progressions using synthetic student profiles to compare Adaptive BKT Interventions versus Fixed-Difficulty Practice.
              </p>
            </div>

            {/* Profile and Mode Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-2">
                  Simulated Student Persona
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'beginner', label: 'Beginner', init: '15% Prior' },
                    { id: 'intermediate', label: 'Intermediate', init: '45% Prior' },
                    { id: 'advanced', label: 'Advanced', init: '75% Prior' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSimProfile(p.id as any)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        simProfile === p.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-semibold block">{p.label}</span>
                      <span className="text-[10px] text-slate-500">{p.init}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-2">
                  Pedagogical Practice Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'adaptive', label: 'Adaptive Practice', desc: 'Targets weakest BKT node' },
                    { id: 'fixed-difficulty', label: 'Fixed Baseline', desc: 'Standard round-robin' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSimMode(m.id as any)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        simMode === m.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-semibold block">{m.label}</span>
                      <span className="text-[10px] text-slate-500">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span>{isSimulating ? 'Simulating Epochs...' : 'Simulate 5 Practice Epochs'}</span>
            </button>
          </div>

          {/* Simulation Output Card */}
          {simResult && (
            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100 capitalize">
                    {simResult.profileId} Persona — {simResult.mode} Outcome
                  </h4>
                  <p className="text-xs text-slate-400">
                    5 consecutive sessions evaluated under reproducible BKT parameters
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Mastery Gain:</span>
                  <span className="block font-mono text-base font-bold text-emerald-400">
                    +{((simResult.finalOverallMastery - simResult.initialOverallMastery) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Session by session progression */}
              <div className="grid grid-cols-5 gap-2 text-center">
                {simResult.sessionProgression.map((s) => (
                  <div key={s.sessionIndex} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 block">Session {s.sessionIndex}</span>
                    <span className="text-sm font-bold font-mono text-slate-100">{Math.round(s.mastery * 100)}%</span>
                    <span className="text-[10px] font-mono text-indigo-400 block capitalize">{s.difficultyAssigned}</span>
                  </div>
                ))}
              </div>

              {/* Topic Deltas */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">Topic Mastery Deltas:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  {Object.entries(simResult.topicDeltas).map(([k, d]) => (
                    <div key={k} className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px] truncate">{k}</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-slate-400">{Math.round(d.before * 100)}%</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-emerald-400 font-bold">{Math.round(d.after * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded bg-indigo-950/20 border border-indigo-900/40 text-[11px] text-indigo-300">
                <strong>Experimenter Note:</strong> Clearly labeled as a synthetic simulated trial for hackathon validation, modeling how BKT parameters transition across difficulty regimes.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
