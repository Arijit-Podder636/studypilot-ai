import React from 'react';
import {
  LayoutDashboard,
  FolderArchive,
  GraduationCap,
  FileQuestion,
  BarChart3,
  CalendarCheck2,
  Network,
  FlaskConical,
  Settings,
  BookOpen
} from 'lucide-react';
import { Course } from '../../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeCourse: Course;
  availableCourses: Course[];
  onSelectCourse: (course: Course) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeCourse,
  availableCourses,
  onSelectCourse
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library', label: 'Study Library', icon: FolderArchive },
    { id: 'tutor', label: 'AI Tutor', icon: GraduationCap },
    { id: 'quiz', label: 'Quiz & Mock Exams', icon: FileQuestion },
    { id: 'analytics', label: 'Learning Analytics', icon: BarChart3 },
    { id: 'revision', label: 'Revision Planner', icon: CalendarCheck2 },
    { id: 'knowledge-map', label: 'Course Knowledge Map', icon: Network },
    { id: 'evaluation-lab', label: 'Evaluation Lab', icon: FlaskConical },
    { id: 'settings', label: 'Settings & Data', icon: Settings }
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col shrink-0">
      {/* Active Course Switcher */}
      <div className="p-4 border-b border-slate-800">
        <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
          Active Course
        </label>
        <div className="relative">
          <select
            value={activeCourse.id}
            onChange={(e) => {
              const selected = availableCourses.find(c => c.id === e.target.value);
              if (selected) onSelectCourse(selected);
            }}
            aria-label="Active Course"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 font-medium truncate pr-7"
          >
            {availableCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}: {c.title}
              </option>
            ))}
          </select>
          <BookOpen className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span>Multimodal AI Hackathon 2026</span>
          <span className="font-mono text-indigo-400">Track D</span>
        </div>
        <p className="text-slate-400">Personalized Tutoring & Adaptive Learning</p>
      </div>
    </aside>
  );
};
