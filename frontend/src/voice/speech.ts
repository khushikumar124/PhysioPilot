/**
 * Voice output.
 *
 * The MVP uses the browser's built-in speech synthesis, which needs no network
 * and no key. The `Speaker` interface is the seam: an Indian-language TTS
 * service can be dropped in later without touching the session screen, and the
 * `language` argument is already threaded through from the patient's profile.
 */

export interface Speaker {
  supported: boolean;
  speak: (text: string, options?: { interrupt?: boolean }) => void;
  cancel: () => void;
}

const LANGUAGE_TAGS: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  ta: "ta-IN",
};

class BrowserSpeaker implements Speaker {
  readonly supported: boolean;
  private readonly languageTag: string;
  private voice: SpeechSynthesisVoice | null = null;
  private lastSpoken = "";
  private lastSpokenAt = 0;

  constructor(language: string) {
    this.supported = typeof window !== "undefined" && "speechSynthesis" in window;
    this.languageTag = LANGUAGE_TAGS[language] ?? "en-IN";
    if (this.supported) this.pickVoice();
  }

  private pickVoice(): void {
    const choose = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      this.voice =
        voices.find((v) => v.lang === this.languageTag) ??
        voices.find((v) => v.lang.startsWith(this.languageTag.split("-")[0])) ??
        null;
    };
    choose();
    // Voices load asynchronously in most browsers.
    window.speechSynthesis.addEventListener?.("voiceschanged", choose, { once: true });
  }

  speak(text: string, options: { interrupt?: boolean } = {}): void {
    if (!this.supported || !text) return;
    const now = Date.now();
    // Repeating the same cue within a few seconds is nagging, not guidance.
    if (text === this.lastSpoken && now - this.lastSpokenAt < 4000) return;
    this.lastSpoken = text;
    this.lastSpokenAt = now;

    try {
      if (options.interrupt) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.languageTag;
      if (this.voice) utterance.voice = this.voice;
      // Slightly slow and calm: the audience includes older patients.
      utterance.rate = 0.92;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      /* speech is an enhancement; never break the session over it */
    }
  }

  cancel(): void {
    if (!this.supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

const silentSpeaker: Speaker = {
  supported: false,
  speak: () => {},
  cancel: () => {},
};

export function createSpeaker(language = "en", enabled = true): Speaker {
  if (!enabled) return silentSpeaker;
  const speaker = new BrowserSpeaker(language);
  return speaker.supported ? speaker : silentSpeaker;
}

const VOICE_PREFERENCE_KEY = "physiopilot.voice";

export function isVoiceEnabled(): boolean {
  try {
    return localStorage.getItem(VOICE_PREFERENCE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setVoiceEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(VOICE_PREFERENCE_KEY, enabled ? "on" : "off");
  } catch {
    /* preference simply does not persist */
  }
}
