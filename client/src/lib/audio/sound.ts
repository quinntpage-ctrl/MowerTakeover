const SOUND_MUTED_STORAGE_KEY = 'mower_takeover_sounds_muted';
const INVINCIBILITY_AUDIO_VOLUME = 0.6;
const INVINCIBILITY_FADE_SECONDS = 1.25;

type ToneOptions = {
  freq: number;
  endFreq?: number;
  duration: number;
  gain: number;
  offset?: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
};

type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

class SoundEffects {
  private audioContext: AudioContext | null = null;
  private invincibilityAudio: HTMLAudioElement | null = null;
  private muted = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.muted = window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY) === '1';
    }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, muted ? '1' : '0');
    }
    if (muted && this.invincibilityAudio) {
      this.invincibilityAudio.pause();
      this.invincibilityAudio.currentTime = 0;
    }
  }

  unlock() {
    const ctx = this.getContext();
    if (ctx && !this.muted && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    this.getInvincibilityAudio();
  }

  playClick() {
    this.unlock();
    this.runWithContext(ctx => {
      this.scheduleTone(ctx, { freq: 760, endFreq: 440, duration: 0.05, gain: 0.03, type: 'triangle', attack: 0.004, release: 0.04 });
      this.scheduleTone(ctx, { freq: 240, endFreq: 190, duration: 0.045, gain: 0.012, offset: 0.01, type: 'sine', attack: 0.002, release: 0.03 });
    }, true);
  }

  playFireballPickup() {
    this.unlock();
    this.runWithContext(ctx => {
      const notes = [520, 740, 1040];
      notes.forEach((note, index) => {
        this.scheduleTone(ctx, {
          freq: note,
          endFreq: note * 1.06,
          duration: 0.08,
          gain: index === notes.length - 1 ? 0.028 : 0.022,
          offset: index * 0.05,
          type: 'triangle',
          attack: 0.004,
          release: 0.05,
        });
      });
    });
  }

  playFireballShoot() {
    this.unlock();
    this.runWithContext(ctx => {
      this.scheduleTone(ctx, { freq: 240, endFreq: 480, duration: 0.06, gain: 0.03, type: 'square', attack: 0.003, release: 0.045 });
      this.scheduleTone(ctx, { freq: 680, endFreq: 980, duration: 0.05, gain: 0.018, offset: 0.01, type: 'triangle', attack: 0.003, release: 0.04 });
    }, true);
  }

  playFireballImpact() {
    this.unlock();
    this.runWithContext(ctx => {
      this.scheduleTone(ctx, { freq: 180, endFreq: 110, duration: 0.1, gain: 0.028, type: 'square', attack: 0.002, release: 0.07 });
      this.scheduleTone(ctx, { freq: 520, endFreq: 200, duration: 0.08, gain: 0.016, offset: 0.008, type: 'triangle', attack: 0.002, release: 0.06 });
    }, true);
  }

  playFireballKill() {
    this.unlock();
    this.runWithContext(ctx => {
      this.scheduleTone(ctx, { freq: 760, endFreq: 380, duration: 0.12, gain: 0.032, type: 'sawtooth', attack: 0.002, release: 0.08 });
      this.scheduleTone(ctx, { freq: 300, endFreq: 150, duration: 0.16, gain: 0.024, offset: 0.015, type: 'square', attack: 0.003, release: 0.1 });
      this.scheduleTone(ctx, { freq: 980, endFreq: 540, duration: 0.1, gain: 0.015, offset: 0.025, type: 'triangle', attack: 0.002, release: 0.07 });
    }, true);
  }

  playKillConfirm() {
    this.unlock();
    this.runWithContext(ctx => {
      this.scheduleTone(ctx, { freq: 420, endFreq: 620, duration: 0.08, gain: 0.024, type: 'triangle', attack: 0.003, release: 0.05 });
      this.scheduleTone(ctx, { freq: 620, endFreq: 920, duration: 0.1, gain: 0.028, offset: 0.045, type: 'square', attack: 0.003, release: 0.06 });
      this.scheduleTone(ctx, { freq: 980, endFreq: 1280, duration: 0.09, gain: 0.016, offset: 0.09, type: 'triangle', attack: 0.002, release: 0.05 });
    }, true);
  }

  playDeath() {
    this.unlock();
    this.runWithContext(ctx => {
      this.scheduleTone(ctx, { freq: 360, endFreq: 160, duration: 0.18, gain: 0.03, type: 'sawtooth', attack: 0.002, release: 0.11 });
      this.scheduleTone(ctx, { freq: 220, endFreq: 90, duration: 0.24, gain: 0.022, offset: 0.035, type: 'square', attack: 0.003, release: 0.14 });
      this.scheduleTone(ctx, { freq: 520, endFreq: 180, duration: 0.16, gain: 0.012, offset: 0.055, type: 'triangle', attack: 0.002, release: 0.1 });
    }, true);
  }

  playInvincibilityPickup() {
    if (this.muted) return;

    const audio = this.getInvincibilityAudio();
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    audio.volume = INVINCIBILITY_AUDIO_VOLUME;
    void audio.play().catch(() => {});
  }

  syncInvincibilityTime(secondsRemaining: number) {
    const audio = this.invincibilityAudio;
    if (!audio) return;

    if (this.muted || secondsRemaining <= 0) {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = INVINCIBILITY_AUDIO_VOLUME;
      return;
    }

    const volumeScale = secondsRemaining >= INVINCIBILITY_FADE_SECONDS
      ? 1
      : Math.max(0, secondsRemaining / INVINCIBILITY_FADE_SECONDS);
    audio.volume = INVINCIBILITY_AUDIO_VOLUME * volumeScale;
  }

  playSpeedBoostPickup() {
    this.unlock();
    this.runWithContext(ctx => {
      this.scheduleTone(ctx, { freq: 380, endFreq: 620, duration: 0.07, gain: 0.02, type: 'triangle', attack: 0.003, release: 0.045 });
      this.scheduleTone(ctx, { freq: 640, endFreq: 1100, duration: 0.09, gain: 0.026, offset: 0.04, type: 'sawtooth', attack: 0.002, release: 0.055 });
      this.scheduleTone(ctx, { freq: 1120, endFreq: 920, duration: 0.06, gain: 0.014, offset: 0.095, type: 'triangle', attack: 0.002, release: 0.04 });
    }, true);
  }

  private getContext() {
    if (typeof window === 'undefined') return null;
    if (this.audioContext) return this.audioContext;

    const AudioContextCtor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextCtor) return null;

    this.audioContext = new AudioContextCtor();
    return this.audioContext;
  }

  private getInvincibilityAudio() {
    if (typeof window === 'undefined') return null;
    if (this.invincibilityAudio) return this.invincibilityAudio;

    const audio = new Audio('/audio/invincible.mp3');
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = INVINCIBILITY_AUDIO_VOLUME;
    this.invincibilityAudio = audio;
    return audio;
  }

  private runWithContext(fn: (ctx: AudioContext) => void, allowResume = false) {
    const ctx = this.getContext();
    if (!ctx || this.muted) return;

    if (ctx.state === 'running') {
      fn(ctx);
      return;
    }

    if (allowResume && ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        if (!this.muted) fn(ctx);
      }).catch(() => {});
    }
  }

  private scheduleTone(ctx: AudioContext, options: ToneOptions) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const start = ctx.currentTime + (options.offset ?? 0);
    const attack = options.attack ?? 0.004;
    const release = options.release ?? 0.05;
    const stop = start + options.duration;
    const fadeOutStart = Math.max(start + attack, stop - release);

    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(options.freq, start);
    if (options.endFreq) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFreq), stop);
    }

    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(options.gain, start + attack);
    gainNode.gain.setValueAtTime(options.gain, fadeOutStart);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stop);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(start);
    oscillator.stop(stop + 0.01);
  }
}

export const soundEffects = new SoundEffects();
