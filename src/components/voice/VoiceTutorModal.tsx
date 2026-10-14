import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Volume2,
  AlertCircle,
  BookOpen,
  Quote,
  ShieldAlert,
  Globe,
  Radio,
  RefreshCw,
  MessageSquare,
  HelpCircle,
  Gauge,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import {
  Chunk,
  ChunkCitation,
  Course,
  ExplanationLevel,
  VoiceAudioState,
  VoiceConnectionStatus,
  VoiceLanguage,
  VoicePersona,
  VoiceTranscriptItem
} from '../../types';
import { VoiceTutorClient, getStandaloneAppUrl } from '../../services/voiceTutorClient';

interface VoiceTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  selectedDocId?: string;
  selectedDocTitle?: string;
  activeChunks: Chunk[];
  level: ExplanationLevel;
  onSelectCitation: (cit: ChunkCitation) => void;
  onFallbackToTextChat: (lastQuery?: string) => void;
  initialVoiceName?: VoicePersona;
  initialSpeakingRate?: number;
  initialLanguage?: VoiceLanguage;
}

export const VoiceTutorModal: React.FC<VoiceTutorModalProps> = ({
  isOpen,
  onClose,
  course,
  selectedDocId = 'all',
  selectedDocTitle,
  activeChunks,
  level: initialLevel,
  onSelectCitation,
  onFallbackToTextChat,
  initialVoiceName = 'Zephyr',
  initialSpeakingRate = 1.0,
  initialLanguage = 'en'
}) => {
  const [connectionStatus, setConnectionStatus] = useState<VoiceConnectionStatus>('disconnected');
  const [audioState, setAudioState] = useState<VoiceAudioState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [language, setLanguage] = useState<VoiceLanguage>(initialLanguage);
  const [voiceName, setVoiceName] = useState<VoicePersona>(initialVoiceName);
  const [speakingRate, setSpeakingRate] = useState<number>(initialSpeakingRate);
  const [level, setLevel] = useState<ExplanationLevel>(initialLevel);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fallbackAvailable, setFallbackAvailable] = useState(false);

  const [userVolume, setUserVolume] = useState(0);
  const [modelVolume, setModelVolume] = useState(0);

  const [transcriptItems, setTranscriptItems] = useState<VoiceTranscriptItem[]>([]);
  const transcriptBottomRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<VoiceTutorClient | null>(null);

  useEffect(() => {
    setLevel(initialLevel);
  }, [initialLevel]);

  useEffect(() => {
    if (initialVoiceName) setVoiceName(initialVoiceName);
  }, [initialVoiceName]);

  useEffect(() => {
    if (initialSpeakingRate) setSpeakingRate(initialSpeakingRate);
  }, [initialSpeakingRate]);

  useEffect(() => {
    if (initialLanguage) setLanguage(initialLanguage);
  }, [initialLanguage]);

  // Scroll transcript to bottom on new updates
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptItems, audioState]);

  // Initialize and clean up Voice Tutor client
  useEffect(() => {
    if (!isOpen) {
      if (clientRef.current) {
        clientRef.current.endSession();
        clientRef.current = null;
      }
      setConnectionStatus('disconnected');
      setAudioState('idle');
      setErrorMessage(null);
      setErrorCode(null);
      return;
    }

    const client = new VoiceTutorClient({
      onConnectionChange: (status) => {
        setConnectionStatus(status);
        if (status === 'connected') {
          setErrorMessage(null);
          setErrorCode(null);
        }
      },
      onAudioStateChange: (state) => {
        setAudioState(state);
      },
      onVolumeChange: (uVol, mVol) => {
        setUserVolume(uVol);
        setModelVolume(mVol);
      },
      onTranscriptUpdate: (item) => {
        setTranscriptItems((prev) => {
          const index = prev.findIndex((i) => i.role === item.role && !i.isFinal);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = item;
            return updated;
          }
          return [...prev, item];
        });
      },
      onTurnComplete: (turn) => {
        setTranscriptItems((prev) => {
          // Replace non-final assistant message or append final turn
          const filtered = prev.filter((i) => !(i.role === 'assistant' && !i.isFinal));
          return [...filtered, turn];
        });
      },
      onError: (msg, fallback, code) => {
        setErrorMessage(msg);
        setFallbackAvailable(fallback);
        if (code) setErrorCode(code);
      }
    });

    clientRef.current = client;

    // Start session explicitly on mount
    client.startSession({
      courseId: course.id,
      documentId: selectedDocId === 'all' ? undefined : selectedDocId,
      level,
      language,
      voiceName,
      speakingRate,
      chunks: activeChunks
    });

    return () => {
      client.endSession();
      clientRef.current = null;
    };
  }, [isOpen, course.id, selectedDocId, language, voiceName]);

  // Adjust playback speed dynamically in real-time without restarting session
  useEffect(() => {
    if (clientRef.current) {
      clientRef.current.setPlaybackRate(speakingRate);
    }
  }, [speakingRate]);

  const handleToggleMute = () => {
    if (!clientRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    clientRef.current.setMuted(newMuted);
  };

  const handleEndSession = () => {
    if (clientRef.current) {
      clientRef.current.endSession();
    }
    setConnectionStatus('disconnected');
    setAudioState('idle');
    setErrorMessage(null);
    setErrorCode(null);
    onClose();
  };

  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
  const standaloneUrl = getStandaloneAppUrl();

  const handleRetry = () => {
    if (connectionStatus === 'connecting' || clientRef.current?.isSessionStarting()) {
      return;
    }
    setErrorMessage(null);
    setErrorCode(null);
    setConnectionStatus('connecting');
    if (clientRef.current) {
      clientRef.current.startSession({
        courseId: course.id,
        documentId: selectedDocId === 'all' ? undefined : selectedDocId,
        level,
        language,
        voiceName,
        speakingRate,
        chunks: activeChunks
      });
    }
  };

  const handleFallback = () => {
    const lastUserItem = [...transcriptItems].reverse().find((t) => t.role === 'user');
    handleEndSession();
    onFallbackToTextChat(lastUserItem?.text);
  };

  if (!isOpen) return null;

  const currentScopeLabel = selectedDocId === 'all'
    ? `${course.title} (All ${activeChunks.length} passages)`
    : `${selectedDocTitle || 'Selected Document'} (${activeChunks.length} passages)`;

  const isMicDenied = errorCode === 'MIC_DENIED';
  const isIframeRestricted = errorCode === 'IFRAME_RESTRICTED';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => clientRef.current?.resumeAudioContext()}
      onTouchStart={() => clientRef.current?.resumeAudioContext()}
    >
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col h-[90vh] max-h-[840px] overflow-hidden text-slate-100">
        
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100 tracking-tight">
                  Gemini Live Voice Tutor
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  gemini-3.8-live
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 truncate max-w-[280px] sm:max-w-md">
                <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="truncate">{currentScopeLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-950 border-slate-800">
              {connectionStatus === 'connected' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400">Live</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-amber-400">Connecting...</span>
                </>
              ) : connectionStatus === 'error' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-rose-400">Error</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className="text-slate-400">Disconnected</span>
                </>
              )}
            </div>

            {/* End Session Button */}
            <button
              onClick={handleEndSession}
              className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              title="End Voice Session"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">End Session</span>
            </button>
          </div>
        </div>

        {/* Live Service Notice Banner */}
        <div className="px-4 py-2 bg-indigo-950/30 border-b border-indigo-900/30 text-[11px] text-indigo-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>
              Real-time bidirectional audio is powered by Gemini Live (<strong>gemini-3.8-live</strong>). Verified source citations appear below in the companion transcript.
            </span>
          </div>
          <button
            onClick={handleFallback}
            className="text-xs text-indigo-400 hover:text-indigo-200 underline shrink-0 hidden md:inline cursor-pointer"
          >
            Switch to Text Chat
          </button>
        </div>

        {/* Main Voice Center: Visualizer & Active State */}
        <div className="p-4 sm:p-6 bg-slate-950 flex flex-col items-center justify-center border-b border-slate-800 text-center relative overflow-hidden">
          {/* Subtle Background Glow */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20 transition-all duration-300"
            style={{
              background: audioState === 'speaking'
                ? 'radial-gradient(circle at center, rgba(99, 102, 241, 0.45) 0%, transparent 70%)'
                : audioState === 'listening'
                ? 'radial-gradient(circle at center, rgba(16, 185, 129, 0.45) 0%, transparent 70%)'
                : 'none'
            }}
          />

          {/* Animated Audio Orb */}
          <div className="relative mb-3">
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-200 border shadow-inner ${
                connectionStatus === 'error'
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-400'
                  : audioState === 'speaking'
                  ? 'bg-gradient-to-tr from-indigo-600 to-violet-500 border-indigo-400/80 scale-105 shadow-indigo-500/50'
                  : audioState === 'listening'
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 border-emerald-400/80 scale-105 shadow-emerald-500/50'
                  : isMuted
                  ? 'bg-slate-800 border-slate-700 text-slate-500'
                  : 'bg-slate-900 border-slate-800 text-indigo-400'
              }`}
              style={{
                transform: `scale(${
                  1 +
                  (audioState === 'listening'
                    ? userVolume * 0.35
                    : audioState === 'speaking'
                    ? modelVolume * 0.35
                    : 0)
                })`
              }}
            >
              {connectionStatus === 'error' ? (
                <AlertCircle className="w-8 h-8 text-rose-400" />
              ) : audioState === 'speaking' ? (
                <Volume2 className="w-8 h-8 text-white animate-pulse" />
              ) : isMuted ? (
                <MicOff className="w-8 h-8 text-slate-400" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </div>

            {/* Pulsing Concentric Ripple Rings */}
            {connectionStatus !== 'error' && (audioState === 'listening' || audioState === 'speaking') && (
              <div
                className={`absolute inset-0 rounded-full border-2 animate-ping pointer-events-none ${
                  audioState === 'listening' ? 'border-emerald-500/40' : 'border-indigo-500/40'
                }`}
              />
            )}
          </div>

          {/* Active Audio State Label */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {audioState === 'speaking' ? (
                <span className="text-indigo-400 flex items-center justify-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" /> Tutor is speaking...
                </span>
              ) : audioState === 'listening' ? (
                <span className="text-emerald-400 flex items-center justify-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" /> Listening to your question...
                </span>
              ) : isMuted ? (
                <span className="text-slate-400 flex items-center justify-center gap-1.5">
                  <MicOff className="w-3.5 h-3.5" /> Microphone Muted
                </span>
              ) : connectionStatus === 'connected' ? (
                <span className="text-slate-300">
                  Ready · Speak naturally in {language === 'bn' ? 'Bengali' : language === 'hi' ? 'Hindi' : 'English'}
                </span>
              ) : connectionStatus === 'error' ? (
                <span className="text-rose-400 flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Connection Failed · See Instructions Below
                </span>
              ) : (
                <span className="text-slate-400 flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> Connecting to tutor...
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Ask for explanations, real-world examples, or hints. Answers are strictly verified against your course notes.
            </p>
          </div>

          {/* Quick Voice Prompt Suggestions */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-3 border-t border-slate-900 w-full max-w-lg">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Try saying:</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 italic">
              "Can you explain this simpler?"
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 italic">
              "Give me a real-world example"
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 italic">
              "Give me a hint"
            </span>
          </div>
        </div>

        {/* Configuration Controls Bar */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Language Selector */}
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="voice-lang-select" className="text-[11px] text-slate-400 font-medium">Lang:</label>
              <select
                id="voice-lang-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value as VoiceLanguage)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="en" className="bg-slate-900">English</option>
                <option value="bn" className="bg-slate-900">বাংলা (Bengali)</option>
                <option value="hi" className="bg-slate-900">हिन्दी (Hindi)</option>
              </select>
            </div>

            {/* Voice Persona Selector */}
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="voice-persona-select" className="text-[11px] text-slate-400 font-medium">Voice:</label>
              <select
                id="voice-persona-select"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value as VoicePersona)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="Zephyr" className="bg-slate-900">Zephyr (Balanced)</option>
                <option value="Puck" className="bg-slate-900">Puck (Expressive)</option>
                <option value="Kore" className="bg-slate-900">Kore (Calm)</option>
                <option value="Fenrir" className="bg-slate-900">Fenrir (Authoritative)</option>
                <option value="Charon" className="bg-slate-900">Charon (Deep)</option>
              </select>
            </div>

            {/* Speaking Rate Selector */}
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="voice-rate-select" className="text-[11px] text-slate-400 font-medium">Speed:</label>
              <select
                id="voice-rate-select"
                value={speakingRate}
                onChange={(e) => {
                  const newRate = parseFloat(e.target.value);
                  setSpeakingRate(newRate);
                  if (clientRef.current) {
                    clientRef.current.setPlaybackRate(newRate);
                  }
                }}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="0.75" className="bg-slate-900">0.75x</option>
                <option value="1.0" className="bg-slate-900">1.0x</option>
                <option value="1.25" className="bg-slate-900">1.25x</option>
                <option value="1.5" className="bg-slate-900">1.5x</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mute Button */}
            <button
              onClick={handleToggleMute}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>
          </div>
        </div>

        {/* Error / Disconnection Alert & Step-by-Step Recovery Instructions */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-950/40 border-b border-rose-900/60 text-rose-200 text-xs animate-in slide-in-from-top-2 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-100 flex items-center gap-2">
                    <span>Voice Session Alert</span>
                    {errorCode && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-900/50 text-rose-300 border border-rose-800/60">
                        {errorCode}
                      </span>
                    )}
                  </p>
                  <p className="text-rose-300 mt-1 leading-relaxed">{errorMessage}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleRetry}
                  disabled={connectionStatus === 'connecting'}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                    connectionStatus === 'connecting'
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
                  <span>{connectionStatus === 'connecting' ? 'Connecting...' : 'Retry'}</span>
                </button>
                {fallbackAvailable && (
                  <button
                    onClick={handleFallback}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium text-white flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                  >
                    <MessageSquare className="w-3 h-3" /> Use Text Chat
                  </button>
                )}
              </div>
            </div>

            {/* Iframe Restriction Notice & Standalone Tab Option */}
            {isIframeRestricted && (
              <div className="p-3 bg-slate-950/90 rounded-xl border border-rose-900/50 text-slate-300 space-y-2.5">
                <p className="font-semibold text-[11px] text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Preview Frame Microphone Limitation:
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Web browsers restrict microphone hardware access inside embedded preview iframes unless permission delegation is active.
                </p>
                {standaloneUrl ? (
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <a
                      href={standaloneUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Full Browser Tab</span>
                    </a>
                    <span className="text-[11px] text-slate-400">
                      (Runs outside the iframe where your browser can prompt for microphone access)
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    You can switch to the document-grounded text tutor below, which operates completely without microphone permissions.
                  </p>
                )}
              </div>
            )}

            {/* Step-by-Step Android Browser Permission Instructions */}
            {isMicDenied && (
              <div className="p-3 bg-slate-950/80 rounded-xl border border-rose-900/40 text-slate-300 space-y-2">
                <p className="font-semibold text-[11px] text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  How to enable microphone on Android & mobile browsers:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 leading-normal pl-1">
                  <li>
                    Look at your browser's address bar and tap the <strong className="text-slate-200">lock / tune icon</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-slate-200">Permissions</strong> (or <strong className="text-slate-200">Site settings</strong>) and set <strong className="text-slate-200">Microphone</strong> to <strong className="text-emerald-400">Allow</strong>.
                  </li>
                  <li>
                    Once permissions are granted, tap the <strong className="text-slate-200">Retry</strong> button above.
                  </li>
                </ol>
                {isInsideIframe && standaloneUrl && (
                  <div className="pt-1.5 border-t border-slate-900 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Alternatively:</span>
                    <a
                      href={standaloneUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium"
                    >
                      <ExternalLink className="w-3 h-3" /> Open in Full Browser Tab
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Insecure Context Warning */}
            {errorCode === 'INSECURE_CONTEXT' && (
              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-amber-900/40 text-[11px] text-amber-300 flex items-center gap-2">
                <span>Microphone access requires an HTTPS connection. WebRTC capture is restricted on insecure origins.</span>
              </div>
            )}

            {/* Connection Timeout Guidance */}
            {errorCode === 'CONNECTION_TIMEOUT' && (
              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-amber-900/40 text-[11px] text-amber-300 flex items-center justify-between gap-2">
                <span>Connection setup timed out (10s). You can retry or continue studying in text chat.</span>
                <button
                  onClick={handleFallback}
                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0 cursor-pointer text-xs"
                >
                  Use Text Chat
                </button>
              </div>
            )}

            {/* Network / WebSocket Gateway Failure */}
            {(errorCode === 'WS_CONNECTION_FAILED' || errorCode === 'NETWORK_ERROR') && (
              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-rose-900/40 text-[11px] text-rose-300 flex items-center justify-between gap-2">
                <span>Could not connect to the voice gateway server (/api/live-tutor). Check network connection or use text chat.</span>
                <button
                  onClick={handleFallback}
                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0 cursor-pointer text-xs"
                >
                  Use Text Chat
                </button>
              </div>
            )}

            {/* Server API Key Advice */}
            {errorCode === 'NO_API_KEY' && (
              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-indigo-900/40 text-[11px] text-indigo-300 flex items-center justify-between gap-2">
                <span>Server GEMINI_API_KEY is not configured for voice streaming. Text tutoring works locally without keys.</span>
                <button
                  onClick={handleFallback}
                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0 cursor-pointer text-xs"
                >
                  Switch Now
                </button>
              </div>
            )}

            {/* Quota Exhausted Advice */}
            {errorCode === 'QUOTA_EXHAUSTED' && (
              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-amber-900/40 text-[11px] text-amber-300 flex items-center justify-between gap-2">
                <span>Gemini Live quota limit reached (HTTP 429). You can immediately continue studying with the text tutor.</span>
                <button
                  onClick={handleFallback}
                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0 cursor-pointer text-xs"
                >
                  Use Text Chat
                </button>
              </div>
            )}

            {/* Model Unavailable Advice */}
            {errorCode === 'MODEL_UNAVAILABLE' && (
              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-amber-900/40 text-[11px] text-amber-300 flex items-center justify-between gap-2">
                <span>The Gemini Live model is not available for this project. Please continue with the grounded text tutor.</span>
                <button
                  onClick={handleFallback}
                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0 cursor-pointer text-xs"
                >
                  Use Text Chat
                </button>
              </div>
            )}
          </div>
        )}

        {/* Conversation Transcript Scroll View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/40">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold text-center py-1">
            Companion Voice Transcript & Verified Citations
          </div>

          {transcriptItems.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
              <Mic className="w-8 h-8 text-slate-700" />
              <p className="text-xs">Your spoken questions and verified citations will appear here in real time.</p>
            </div>
          ) : (
            transcriptItems.map((item) => {
              const isUser = item.role === 'user';
              const isRefusal = item.isRefusal || item.support_status === 'unsupported';

              return (
                <div
                  key={item.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 text-xs font-bold">
                      SP
                    </div>
                  )}

                  <div
                    className={`max-w-xl rounded-xl p-3.5 space-y-2.5 text-xs ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {/* Header with timestamp and grounding label */}
                    <div className="flex items-center justify-between text-[10px] pb-1.5 border-b border-slate-800/80 text-slate-400">
                      <span className="font-semibold uppercase tracking-wider">
                        {isUser ? 'You' : 'StudyPilot Voice Tutor'}
                      </span>
                      <div className="flex items-center gap-2">
                        {!isUser && (
                          isRefusal ? (
                            <span className="text-rose-400 font-medium flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Unsupported
                            </span>
                          ) : (
                            <span className="text-indigo-400 font-medium flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Grounded Voice
                            </span>
                          )
                        )}
                        <span>{item.timestamp}</span>
                      </div>
                    </div>

                    {/* Speech Text */}
                    <div className="leading-relaxed whitespace-pre-line font-sans">
                      {item.text || (isUser ? 'Listening...' : 'Thinking...')}
                    </div>

                    {/* Verbatim Supporting Excerpt Box */}
                    {!isUser && item.relevant_excerpt && !isRefusal && (
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <div className="text-[10px] uppercase font-semibold text-indigo-400 flex items-center gap-1 tracking-wider">
                          <Quote className="w-3 h-3 text-indigo-400" /> Source Evidence Excerpt:
                        </div>
                        <div className="italic text-slate-300 pl-2 border-l-2 border-indigo-500/50">
                          "{item.relevant_excerpt}"
                        </div>
                      </div>
                    )}

                    {/* Refusal Reason Notice */}
                    {!isUser && isRefusal && item.refusalReason && (
                      <div className="p-2 rounded bg-rose-950/30 border border-rose-900/50 text-[11px] text-rose-300">
                        <strong>Evidence Policy:</strong> {item.refusalReason}
                      </div>
                    )}

                    {/* Verified Citations List */}
                    {!isUser && item.citations && item.citations.length > 0 && !isRefusal && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Verified Citations (Click to inspect exact passage):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {item.citations.map((cit, idx) => (
                            <button
                              key={idx}
                              onClick={() => onSelectCitation(cit)}
                              className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-indigo-500 text-[11px] text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                              title="Inspect citation in Citation Drawer"
                            >
                              <BookOpen className="w-3 h-3 text-indigo-400" />
                              <span className="truncate max-w-[170px]">{cit.documentTitle}</span>
                              {cit.pageOrSlide && (
                                <span className="text-indigo-400 font-mono">p.{cit.pageOrSlide}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={transcriptBottomRef} />
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 text-[11px] flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Voice stream runs through server-side Gemini Live Gateway</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFallback}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Continue in Text Chat
            </button>
            <button
              onClick={handleEndSession}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End Session</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
