import React, { useState, useEffect } from 'react';
import {
  Settings,
  Download,
  Upload,
  RotateCcw,
  Cpu,
  Database,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Gauge,
  Check,
  Globe,
  Radio
} from 'lucide-react';
import { appDb, AppStateExport } from '../../services/db';
import { apiClient, ServerHealth } from '../../services/api';
import { VoiceLanguage, VoicePersona, VoiceSettings } from '../../types';
import {
  PERSONA_PROFILES,
  SPEED_PRESETS,
  loadVoiceSettings,
  saveVoiceSettings,
  personaAudioPreview
} from '../../services/voiceSettingsService';

interface SettingsViewProps {
  onRefreshAllData: () => void;
  voiceSettings?: VoiceSettings;
  onUpdateVoiceSettings?: (newSettings: VoiceSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onRefreshAllData,
  voiceSettings: propVoiceSettings,
  onUpdateVoiceSettings
}) => {
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voice Preferences state
  const [currentVoiceSettings, setCurrentVoiceSettings] = useState<VoiceSettings>(() => {
    return propVoiceSettings || loadVoiceSettings();
  });
  const [playingPersona, setPlayingPersona] = useState<VoicePersona | null>(null);
  const [voiceSavedFeedback, setVoiceSavedFeedback] = useState(false);

  useEffect(() => {
    apiClient.getHealth().then(setServerHealth);
  }, []);

  useEffect(() => {
    if (propVoiceSettings) {
      setCurrentVoiceSettings(propVoiceSettings);
    }
  }, [propVoiceSettings]);

  // Hook into audio preview status
  useEffect(() => {
    personaAudioPreview.setStatusCallback((isPlaying, persona) => {
      setPlayingPersona(isPlaying ? persona : null);
    });
    return () => {
      personaAudioPreview.stop();
    };
  }, []);

  const handleUpdatePreferences = (updated: Partial<VoiceSettings>) => {
    const nextSettings: VoiceSettings = {
      ...currentVoiceSettings,
      ...updated
    };
    setCurrentVoiceSettings(nextSettings);
    saveVoiceSettings(nextSettings);
    onUpdateVoiceSettings?.(nextSettings);

    setVoiceSavedFeedback(true);
    setTimeout(() => setVoiceSavedFeedback(false), 2000);
  };

  const handleTogglePreview = (personaId: VoicePersona) => {
    if (playingPersona === personaId) {
      personaAudioPreview.stop();
    } else {
      personaAudioPreview.playPersona(personaId, currentVoiceSettings.speakingRate);
    }
  };

  const handleExportJson = async () => {
    try {
      const data = await appDb.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studypilot-ai-backup-${Date.now()}.json`;
      a.click();
      setStatusMessage('Application state successfully exported to JSON.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to export database.');
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed: AppStateExport = JSON.parse(String(event.target?.result || '{}'));
        await appDb.importAll(parsed);
        setStatusMessage('Application state successfully imported and restored.');
        onRefreshAllData();
      } catch (err: any) {
        setErrorMessage('Invalid JSON format or corrupted backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetSample = async () => {
    if (confirm('Reset application to original Machine Learning sample course and clean records?')) {
      await appDb.resetToSampleCourse();
      setStatusMessage('Reset to pristine Machine Learning sample course completed.');
      onRefreshAllData();
    }
  };

  const getSpeedLabel = (rate: number) => {
    if (rate <= 0.8) return 'Relaxed Pace';
    if (rate <= 1.05) return 'Normal Speed';
    if (rate <= 1.3) return 'Fast Pace';
    return 'Speedy Cadence';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <span>Settings & Configuration</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          AI Voice Persona customization, audio speaking rate, IndexedDB backup/export, and server security status.
        </p>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800 text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Voice Selection & Audio Configuration Panel */}
      <div className="p-6 rounded-xl bg-slate-900 border border-indigo-900/40 shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Radio className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-100">
                AI Voice Tutor Persona & Speaking Configuration
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Select your AI tutor's voice persona, sample audio previews, and tune speech cadence for Gemini Live tutoring.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {voiceSavedFeedback ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-[11px] font-medium text-emerald-300 flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Saved to Browser</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">
                Persisted in local storage
              </span>
            )}
          </div>
        </div>

        {/* Persona Selection Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Choose AI Voice Persona</span>
            </label>
            <span className="text-xs text-slate-400">
              Active: <strong className="text-indigo-300 font-medium">{currentVoiceSettings.persona}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PERSONA_PROFILES.map((profile) => {
              const isSelected = currentVoiceSettings.persona === profile.id;
              const isPlaying = playingPersona === profile.id;

              return (
                <div
                  key={profile.id}
                  onClick={() => handleUpdatePreferences({ persona: profile.id })}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-100">{profile.name}</span>
                        {isSelected && (
                          <span className="p-0.5 rounded-full bg-indigo-500 text-white">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                        {profile.tagline}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {profile.description}
                    </p>

                    <div className="pt-1">
                      <p className="text-[10px] italic text-slate-400 line-clamp-2 bg-slate-900/60 p-2 rounded border border-slate-800/80">
                        "{profile.sampleQuote}"
                      </p>
                    </div>
                  </div>

                  {/* Audio Sample Player Button */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePreview(profile.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                        isPlaying
                          ? 'bg-rose-900/40 text-rose-300 border border-rose-700/60 shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                      title={isPlaying ? 'Stop audio sample preview' : `Play audio sample for ${profile.name}`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-3 h-3 text-rose-400 fill-rose-400" />
                          <span>Stop</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping ml-0.5" />
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 text-indigo-400 fill-indigo-400" />
                          <span>Play Sample</span>
                        </>
                      )}
                    </button>

                    <span className="text-[10px] text-slate-400">
                      {profile.tone}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Speaking Rate Controls */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <label htmlFor="speaking-rate-slider" className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                <span>Tutor Speaking Rate (0.75x — 1.5x)</span>
              </label>
              <p className="text-[11px] text-slate-400">
                Adjust the speed of spoken explanations to match your listening preference.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-300 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800">
                {currentVoiceSettings.speakingRate.toFixed(2)}x
              </span>
              <span className="text-xs text-slate-400">
                ({getSpeedLabel(currentVoiceSettings.speakingRate)})
              </span>
            </div>
          </div>

          {/* Continuous Slider */}
          <div className="space-y-2">
            <input
              id="speaking-rate-slider"
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              value={currentVoiceSettings.speakingRate}
              onChange={(e) => handleUpdatePreferences({ speakingRate: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.75x (Relaxed)</span>
              <span>1.0x (Standard)</span>
              <span>1.25x (Fast)</span>
              <span>1.5x (Speedy)</span>
            </div>
          </div>

          {/* Speed Preset Buttons */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs text-slate-400 font-medium mr-1">Quick Presets:</span>
            {SPEED_PRESETS.map((preset) => {
              const isActive = Math.abs(currentVoiceSettings.speakingRate - preset.value) < 0.02;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleUpdatePreferences({ speakingRate: preset.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {preset.label} ({preset.description})
                </button>
              );
            })}

            {/* Test Voice Button */}
            <button
              type="button"
              onClick={() => handleTogglePreview(currentVoiceSettings.persona)}
              className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/80 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {playingPersona === currentVoiceSettings.persona ? (
                <>
                  <Square className="w-3 h-3 text-indigo-400 fill-indigo-400" />
                  <span>Stop Test</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3 h-3 text-indigo-400" />
                  <span>Test Current Voice</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Primary Language */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>Default Spoken Language</span>
            </label>
            <p className="text-[11px] text-slate-400">
              Language spoken during Gemini Live voice tutoring sessions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[
              { code: 'en' as VoiceLanguage, label: 'English (en)' },
              { code: 'bn' as VoiceLanguage, label: 'বাংলা (bn)' },
              { code: 'hi' as VoiceLanguage, label: 'हिन्दी (hi)' }
            ].map((lang) => {
              const isSelected = currentVoiceSettings.language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleUpdatePreferences({ language: lang.code })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Server & Model Status */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-100">AI Gateway Runtime Status</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Text Tutor Model:</span>
              <span className="font-mono text-indigo-300 font-semibold">gemini-3.8-flash</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Voice Tutor Model:</span>
              <span className="font-mono text-indigo-300 font-semibold">gemini-3.8-live</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Server GEMINI_API_KEY:</span>
              <span className="flex items-center gap-1.5 font-medium">
                {serverHealth?.hasGeminiKey ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-emerald-400">Configured in Secrets</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    <span className="text-amber-400">Local Fallback Mode Active</span>
                  </>
                )}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Execution Runtime:</span>
              <span className="font-mono text-slate-300">Node.js Express / Vite Middleware</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            API keys are strictly managed on the server side via environment secrets. Client code never receives or stores API tokens.
          </p>
        </div>

        {/* Persistence & Data Backup */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-100">Data Persistence & Backups</h3>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            All course documents, student quiz attempts, BKT learner state, and evaluation results persist locally in your browser via IndexedDB.
          </p>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={handleExportJson}
              className="w-full py-2.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export Complete State to JSON</span>
            </button>

            <label className="w-full py-2.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Restore State from JSON Backup</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Security & Privacy Disclosures */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-100">Security, Reliability & Privacy Architecture</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <h4 className="font-semibold text-slate-200">Zero Public Exposure</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Uploaded study materials remain confined to your local session and isolated server proxy. No documents are published to public storage buckets.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <h4 className="font-semibold text-slate-200">Local-First Resilience</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Full offline functionality: BM25 keyword retrieval and deterministic quiz grading ensure zero downtime during evaluation or intermittent network connectivity.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <h4 className="font-semibold text-slate-200">Strict Source Grounding</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              AI Tutor enforces verifiable source chunk citations. If evidence is lacking, queries are transparently refused to prevent factual hallucination.
            </p>
          </div>
        </div>
      </div>

      {/* Diagnostic Reset */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-red-950/40 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-semibold text-slate-100">Diagnostic Reset</h3>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Restore initial hackathon conditions: wipes custom quiz history and resets to the pristine Machine Learning & Neural Networks sample course.
        </p>

        <button
          onClick={handleResetSample}
          className="px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 rounded-lg transition-colors border border-red-900/50 flex items-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All Data to Sample Course</span>
        </button>
      </div>
    </div>
  );
};
