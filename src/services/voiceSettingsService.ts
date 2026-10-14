import { PersonaProfile, VoicePersona, VoiceSettings } from '../types';

export const VOICE_SETTINGS_STORAGE_KEY = 'studypilot_voice_settings';

export const PERSONA_PROFILES: PersonaProfile[] = [
  {
    id: 'Zephyr',
    name: 'Zephyr',
    tagline: 'Warm & Thoughtful',
    description: 'A gentle, patient tutor with a warm, conversational cadence. Ideal for thorough explanations and building confidence.',
    pitch: 1.0,
    tone: 'Warm, balanced, encouraging',
    accentNote: 'Balanced natural tone',
    sampleQuote: "Hello! I'm Zephyr. Let's break down this concept step-by-step together."
  },
  {
    id: 'Puck',
    name: 'Puck',
    tagline: 'Enthusiastic & Animated',
    description: 'An energetic, highly engaged study partner with dynamic intonation. Great for brainstorming and quick drills.',
    pitch: 1.15,
    tone: 'High energy, vibrant, curious',
    accentNote: 'Upbeat and bright',
    sampleQuote: "Hey there! Ready to master this topic? Let's dive right in and test what you know!"
  },
  {
    id: 'Kore',
    name: 'Kore',
    tagline: 'Calm & Soothing',
    description: 'A serene, peaceful guide who explains complex topics with measured clarity. Perfect for stress-free revision.',
    pitch: 1.05,
    tone: 'Relaxed, empathetic, crystal clear',
    accentNote: 'Soft and articulate',
    sampleQuote: "Welcome. Take a deep breath. We will take all the time you need to explore this material."
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    tagline: 'Confident & Authoritative',
    description: 'A focused, steady tutor with a deep and grounded delivery. Excellent for structured lecture reviews and rigorous problem-solving.',
    pitch: 0.85,
    tone: 'Deep, direct, reassuring',
    accentNote: 'Resonant and decisive',
    sampleQuote: "Greetings. Let's focus on the fundamental principles and verify every piece of evidence."
  },
  {
    id: 'Charon',
    name: 'Charon',
    tagline: 'Reflective & Methodical',
    description: 'A contemplative, academic tutor who emphasizes precision and deep conceptual links across your course documents.',
    pitch: 0.9,
    tone: 'Scholarly, deliberate, observant',
    accentNote: 'Nuanced and measured',
    sampleQuote: "Good day. Notice how the core thesis here ties directly into the primary source material."
  }
];

export const SPEED_PRESETS = [
  { label: '0.75x', value: 0.75, description: 'Relaxed' },
  { label: '1.0x', value: 1.0, description: 'Normal' },
  { label: '1.25x', value: 1.25, description: 'Fast' },
  { label: '1.5x', value: 1.5, description: 'Speedy' }
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  persona: 'Zephyr',
  speakingRate: 1.0,
  language: 'en',
  autoSpeakResponses: true
};

/**
 * Load voice preferences from localStorage with defensive fallbacks and rate clamping
 */
export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS };

    const parsed = JSON.parse(raw);
    const validPersonas: VoicePersona[] = ['Zephyr', 'Puck', 'Kore', 'Fenrir', 'Charon'];
    const persona: VoicePersona = validPersonas.includes(parsed.persona)
      ? parsed.persona
      : DEFAULT_VOICE_SETTINGS.persona;

    const rawRate = typeof parsed.speakingRate === 'number' ? parsed.speakingRate : 1.0;
    const clampedRate = Math.min(1.5, Math.max(0.75, Math.round(rawRate * 100) / 100));

    const validLanguages = ['en', 'bn', 'hi'] as const;
    const language = validLanguages.includes(parsed.language)
      ? parsed.language
      : DEFAULT_VOICE_SETTINGS.language;

    return {
      persona,
      speakingRate: clampedRate,
      language,
      autoSpeakResponses: parsed.autoSpeakResponses !== false
    };
  } catch (err) {
    console.warn('Failed to load voice preferences from localStorage, using defaults:', err);
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

/**
 * Save voice preferences to localStorage and trigger storage synchronization
 */
export function saveVoiceSettings(settings: VoiceSettings): boolean {
  try {
    const clampedRate = Math.min(1.5, Math.max(0.75, Math.round(settings.speakingRate * 100) / 100));
    const toSave: VoiceSettings = {
      ...settings,
      speakingRate: clampedRate
    };
    localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(toSave));

    // Dispatch custom event for immediate same-window subscribers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studypilot_voice_settings_changed', { detail: toSave }));
    }
    return true;
  } catch (err) {
    console.error('Failed to save voice preferences to localStorage:', err);
    return false;
  }
}

class PersonaAudioPreviewPlayer {
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private audioCtx: AudioContext | null = null;
  private isPreviewPlaying = false;
  private currentPersona: VoicePersona | null = null;
  private onStatusChange?: (playing: boolean, persona: VoicePersona | null) => void;

  public setStatusCallback(cb: (playing: boolean, persona: VoicePersona | null) => void): void {
    this.onStatusChange = cb;
  }

  public isPlaying(persona?: VoicePersona): boolean {
    if (!persona) return this.isPreviewPlaying;
    return this.isPreviewPlaying && this.currentPersona === persona;
  }

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }
    this.isPreviewPlaying = false;
    this.currentPersona = null;
    this.activeUtterance = null;
    this.onStatusChange?.(false, null);
  }

  public playPersona(personaId: VoicePersona, rate: number = 1.0): void {
    this.stop();

    const profile = PERSONA_PROFILES.find((p) => p.id === personaId) || PERSONA_PROFILES[0];
    const clampedRate = Math.min(1.5, Math.max(0.75, rate));

    this.isPreviewPlaying = true;
    this.currentPersona = personaId;
    this.onStatusChange?.(true, personaId);

    // Prefer Web Speech API if supported in browser
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel(); // Clear any existing queue
        const utterance = new SpeechSynthesisUtterance(profile.sampleQuote);
        utterance.rate = clampedRate;
        utterance.pitch = profile.pitch;

        // Try to pick a voice matching the persona if available
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          if (profile.pitch < 0.95) {
            // Lower pitched / male / authoritative voice candidate
            const maleVoice = voices.find((v) => v.lang.startsWith('en') && (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('george')));
            if (maleVoice) utterance.voice = maleVoice;
          } else if (profile.pitch > 1.05) {
            // Higher pitched / energetic voice candidate
            const femaleVoice = voices.find((v) => v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha')));
            if (femaleVoice) utterance.voice = femaleVoice;
          }
        }

        utterance.onend = () => {
          this.isPreviewPlaying = false;
          this.currentPersona = null;
          this.activeUtterance = null;
          this.onStatusChange?.(false, null);
        };

        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis preview error, falling back to WebAudio chime:', e);
          this.fallbackTonePreview(profile, clampedRate);
        };

        this.activeUtterance = utterance;
        window.speechSynthesis.speak(utterance);
        return;
      } catch (speechErr) {
        console.warn('SpeechSynthesis failed, using WebAudio tone:', speechErr);
      }
    }

    // Fallback: WebAudio harmonic preview chime indicating the persona's characteristic frequency
    this.fallbackTonePreview(profile, clampedRate);
  }

  private fallbackTonePreview(profile: PersonaProfile, rate: number): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        setTimeout(() => {
          this.isPreviewPlaying = false;
          this.currentPersona = null;
          this.onStatusChange?.(false, null);
        }, 800);
        return;
      }

      this.audioCtx = new AudioContextClass();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Base frequency modulated by persona pitch
      const baseFreq = 260 * profile.pitch;
      osc.frequency.setValueAtTime(baseFreq, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, this.audioCtx.currentTime + (0.3 / rate));

      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + (0.7 / rate));

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + (0.75 / rate));

      setTimeout(() => {
        this.stop();
      }, (850 / rate));
    } catch (_) {
      this.stop();
    }
  }
}

export const personaAudioPreview = new PersonaAudioPreviewPlayer();
