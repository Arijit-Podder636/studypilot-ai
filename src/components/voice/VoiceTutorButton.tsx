import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  AlertCircle,
  Radio,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { VoiceIntegrationMode, VoicePersona, VoiceSettings, VoiceTutorState } from '../../types';

export interface VoiceTutorButtonProps {
  /** Current state: 'idle' | 'connecting' | 'listening' | 'speaking' | 'error' */
  state?: VoiceTutorState;
  /** Integration mode: 'gemini-live' (WebSocket streaming) or 'web-speech' (browser SpeechRecognition) */
  mode?: VoiceIntegrationMode;
  /** Visual presentation variant */
  variant?: 'full' | 'compact' | 'pill' | 'minimal';
  /** Custom error message to display in error state */
  errorMessage?: string;
  /** Recognition language code (e.g., 'en-US', 'hi-IN', 'bn-IN') */
  language?: string;
  /** Selected AI voice persona */
  persona?: VoicePersona;
  /** Speaking rate multiplier (0.75 - 1.5) */
  speakingRate?: number;
  /** Complete voice settings object */
  voiceSettings?: VoiceSettings;
  /** Callback fired whenever internal/external state changes */
  onStateChange?: (state: VoiceTutorState) => void;
  /** Callback fired when speech is transcribed (useful for Web Speech mode) */
  onTranscript?: (text: string, isFinal: boolean) => void;
  /** Callback fired on error */
  onError?: (error: string) => void;
  /** Custom click handler (e.g. to open Gemini Live modal or start session) */
  onClick?: () => void;
  /** Additional CSS class names */
  className?: string;
  /** Disable the button */
  disabled?: boolean;
  /** Show badge or indicator for current integration mode */
  showModeBadge?: boolean;
  /** Custom title/tooltip */
  title?: string;
}

// Window interface augmentation for browser SpeechRecognition
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const VoiceTutorButton: React.FC<VoiceTutorButtonProps> = ({
  state: controlledState,
  mode = 'gemini-live',
  variant = 'full',
  errorMessage: controlledErrorMessage,
  language = 'en-US',
  persona,
  speakingRate,
  voiceSettings,
  onStateChange,
  onTranscript,
  onError,
  onClick,
  className = '',
  disabled = false,
  showModeBadge = false,
  title
}) => {
  // Computed effective voice preferences
  const effectivePersona = persona || voiceSettings?.persona || 'Zephyr';
  const effectiveRate = speakingRate || voiceSettings?.speakingRate || 1.0;

  // Internal state when not fully controlled
  const [internalState, setInternalState] = useState<VoiceTutorState>('idle');
  const [internalError, setInternalError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const currentState: VoiceTutorState = controlledState !== undefined ? controlledState : internalState;
  const currentError = controlledErrorMessage || internalError;

  const updateState = (newState: VoiceTutorState) => {
    setInternalState(newState);
    if (onStateChange) {
      onStateChange(newState);
    }
  };

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const startWebSpeechRecognition = () => {
    const win = (typeof window !== 'undefined' ? window : {}) as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const err = 'Speech Recognition is not supported in this browser. Please use text chat or Chrome/Edge.';
      setInternalError(err);
      updateState('error');
      if (onError) onError(err);
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      setInternalError(null);
      updateState('connecting');

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        updateState('listening');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        if (text && onTranscript) {
          onTranscript(text, !!finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        let message = 'Speech recognition error';
        if (event.error === 'not-allowed') {
          message = 'Microphone permission was denied. Please allow microphone access.';
        } else if (event.error === 'no-speech') {
          message = 'No speech detected. Please try speaking again.';
        } else if (event.error === 'network') {
          message = 'Network error during speech recognition.';
        }
        setInternalError(message);
        updateState('error');
        if (onError) onError(message);
      };

      recognition.onend = () => {
        // If we didn't end in an error state, return to idle
        setInternalState((prev) => (prev === 'listening' ? 'idle' : prev));
      };

      recognition.start();
    } catch (err: any) {
      const msg = err?.message || 'Failed to initialize speech recognition';
      setInternalError(msg);
      updateState('error');
      if (onError) onError(msg);
    }
  };

  const stopWebSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      updateState('idle');
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If a custom onClick is provided (e.g. open Gemini Live modal or toggle live session), prefer it
    if (onClick) {
      onClick();
      return;
    }

    // Otherwise, if in Web Speech mode, toggle recording
    if (mode === 'web-speech') {
      if (currentState === 'listening') {
        stopWebSpeechRecognition();
      } else if (currentState === 'error') {
        setInternalError(null);
        startWebSpeechRecognition();
      } else {
        startWebSpeechRecognition();
      }
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInternalError(null);
    updateState('idle');
    if (mode === 'web-speech') {
      startWebSpeechRecognition();
    } else if (onClick) {
      onClick();
    }
  };

  // State-specific styles and contents
  const renderIcon = () => {
    switch (currentState) {
      case 'connecting':
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />;
      case 'listening':
        return <Mic className="w-3.5 h-3.5 text-rose-300 animate-pulse" />;
      case 'speaking':
        return <Volume2 className="w-3.5 h-3.5 text-cyan-300 animate-bounce" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      case 'idle':
      default:
        return mode === 'gemini-live' ? (
          <Radio className="w-3.5 h-3.5 text-indigo-200" />
        ) : (
          <Mic className="w-3.5 h-3.5 text-indigo-200" />
        );
    }
  };

  const getLabel = () => {
    switch (currentState) {
      case 'connecting':
        return 'Connecting...';
      case 'listening':
        return 'Listening...';
      case 'speaking':
        return 'Tutor Speaking...';
      case 'error':
        return 'Voice Error';
      case 'idle':
      default:
        return mode === 'gemini-live' ? 'Start Voice Tutor' : 'Voice Input';
    }
  };

  // Styling maps based on state
  const stateColorStyles: Record<VoiceTutorState, string> = {
    idle: 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-indigo-400/30 shadow-indigo-600/20',
    connecting: 'bg-amber-950/80 hover:bg-amber-900/80 text-amber-200 border-amber-600/40 shadow-amber-600/20',
    listening: 'bg-rose-950/90 hover:bg-rose-900/90 text-rose-200 border-rose-500/50 shadow-rose-600/30 ring-1 ring-rose-500/40',
    speaking: 'bg-cyan-950/90 hover:bg-cyan-900/90 text-cyan-200 border-cyan-500/50 shadow-cyan-600/30 ring-1 ring-cyan-500/40',
    error: 'bg-red-950/80 hover:bg-red-900/80 text-red-200 border-red-500/40 shadow-red-600/20'
  };

  // Pulsing soundwaves for active listening/speaking
  const renderAudioWave = () => {
    if (currentState !== 'listening' && currentState !== 'speaking') return null;
    return (
      <div className="flex items-center gap-0.5 ml-1">
        <span className="w-0.5 h-2.5 bg-current rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
        <span className="w-0.5 h-4 bg-current rounded-full animate-[pulse_0.4s_ease-in-out_infinite_0.1s]" />
        <span className="w-0.5 h-3 bg-current rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.2s]" />
      </div>
    );
  };

  // Compact variant (icon only with state ring & tooltip)
  if (variant === 'compact') {
    return (
      <div className="relative inline-flex items-center group">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          title={title || (currentError ? `${getLabel()}: ${currentError}` : `${getLabel()} (${mode === 'gemini-live' ? 'Gemini Live' : 'Web Speech'})`)}
          aria-label={getLabel()}
          className={`p-2 rounded-lg border transition-all flex items-center justify-center shrink-0 ${stateColorStyles[currentState]} ${
            disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
          } ${className}`}
        >
          {renderIcon()}
        </button>
        {currentState === 'listening' && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>
        )}
        {currentState === 'speaking' && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
          </span>
        )}
      </div>
    );
  }

  // Pill variant
  if (variant === 'pill') {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          aria-label={getLabel()}
          title={title || currentError || `${getLabel()} (${effectivePersona}, ${effectiveRate}x)`}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border flex items-center gap-1.5 transition-all shadow-sm ${stateColorStyles[currentState]} ${
            disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'
          } ${className}`}
        >
          {renderIcon()}
          <span>{getLabel()}</span>
          {renderAudioWave()}
          {mode === 'gemini-live' && currentState === 'idle' && (
            <span className="text-[9px] px-1.5 py-0.2 bg-black/25 rounded text-indigo-100 font-mono">
              {effectiveRate}x
            </span>
          )}
        </button>
        {currentState === 'error' && (
          <button
            type="button"
            onClick={handleRetry}
            title="Retry voice session"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // Minimal variant (no background, simple button)
  if (variant === 'minimal') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={getLabel()}
        title={title || currentError || `${getLabel()} (${effectivePersona}, ${effectiveRate}x)`}
        className={`p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition-colors flex items-center gap-1 text-xs ${className}`}
      >
        {renderIcon()}
        {currentState !== 'idle' && <span>{getLabel()}</span>}
      </button>
    );
  }

  // Default Full Variant
  return (
    <div className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={getLabel()}
        title={title || (currentError ? `${getLabel()}: ${currentError}` : `Start real-time voice tutoring with ${effectivePersona} (${effectiveRate}x speed)`)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md border transition-all ${stateColorStyles[currentState]} ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'
        } ${className}`}
      >
        {renderIcon()}
        <span>{getLabel()}</span>
        {renderAudioWave()}

        {mode === 'gemini-live' && currentState === 'idle' && (
          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-black/25 border border-white/10 text-indigo-100 hidden sm:inline-flex items-center gap-1">
            <span>{effectivePersona}</span>
            <span className="opacity-60">•</span>
            <span>{effectiveRate}x</span>
          </span>
        )}

        {showModeBadge && (
          <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 bg-black/30 rounded text-slate-300 font-mono ml-0.5">
            {mode === 'gemini-live' ? 'Live' : 'Speech'}
          </span>
        )}
      </button>

      {/* Error state retry button */}
      {currentState === 'error' && (
        <button
          type="button"
          onClick={handleRetry}
          title="Retry voice connection"
          className="p-1.5 bg-slate-900 border border-red-500/30 text-red-300 hover:text-white hover:bg-red-950 rounded-lg text-xs transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="text-[10px]">Retry</span>
        </button>
      )}

      {/* Error tooltip / indicator */}
      {currentState === 'error' && currentError && (
        <div
          role="alert"
          className="absolute top-full left-0 mt-1 z-30 p-2 bg-slate-950 border border-red-500/40 text-red-200 text-[11px] rounded-lg shadow-xl max-w-xs animate-in fade-in slide-in-from-top-1"
        >
          <div className="flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-300">Voice Error</p>
              <p className="text-[10px] text-slate-300 mt-0.5">{currentError}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
