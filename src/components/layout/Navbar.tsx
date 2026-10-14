import React from 'react';
import { Sparkles, Moon, Sun, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
  onQuickAction: () => void;
  hasGeminiKey: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isDark,
  toggleTheme,
  onQuickAction,
  hasGeminiKey
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between gap-8 sticky top-0 z-40 shrink-0">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="#dashboard"
          onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}
          className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm font-semibold">
            SP
          </div>
          <span>StudyPilot AI</span>
        </a>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 pl-2 border-l border-slate-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Answers from your documents</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 font-mono text-[11px]">
            {hasGeminiKey ? 'Gemini (AI) available' : 'Local extractive mode'}
          </span>
        </div>
      </div>

      {/* Zone 2: 4–5 Single-Line Nav Links */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-400">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'dashboard' ? 'text-indigo-400 font-semibold' : ''}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('tutor')}
          className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'tutor' ? 'text-indigo-400 font-semibold' : ''}`}
        >
          AI Tutor
        </button>
        <button
          onClick={() => setActiveTab('quiz')}
          className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'quiz' ? 'text-indigo-400 font-semibold' : ''}`}
        >
          Adaptive Quizzes
        </button>
        <button
          onClick={() => setActiveTab('evaluation-lab')}
          className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'evaluation-lab' ? 'text-indigo-400 font-semibold' : ''}`}
        >
          Evaluation Lab
        </button>
      </nav>

      {/* Zone 3: 1 Primary Action + Theme Toggle */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={onQuickAction}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Launch Quiz</span>
        </button>
      </div>
    </header>
  );
};
