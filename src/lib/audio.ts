// Web Audio API harmonic sound synthesizer for focus timers and sensory cues
// Completely self-contained: no external MP3 dependencies or network latency

export type ChimeType = 'bell' | 'bowl' | 'digital' | 'chime' | 'none';

export function playTimerSound(type: ChimeType = 'bell', volume: number = 0.7) {
  if (type === 'none') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0.05, Math.min(volume, 1)), ctx.currentTime);
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'bell') {
      // Gentle Tibetan singing bell with soft harmonics
      const freqs = [528, 1056, 1584]; // 528Hz Solfeggio frequency
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const decay = idx === 0 ? 2.5 : 1.8;
        const initAmp = idx === 0 ? 0.6 : 0.25 / (idx + 1);
        gain.gain.setValueAtTime(initAmp, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + decay);
      });
    } else if (type === 'bowl') {
      // Deep resonant meditative bowl
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(216, now); // Warm low frequency
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 3.2);
    } else if (type === 'digital') {
      // Soft modern dual-tone chime
      const tones = [587.33, 880]; // D5 and A5
      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.4, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.6);
      });
    } else if (type === 'chime') {
      // Sparkling multi-tone arpeggio
      const notes = [440, 554.37, 659.25, 880]; // A major
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.3, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 1.2);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 1.2);
      });
    }
  } catch (err) {
    console.warn("Audio playback not allowed or supported in this context:", err);
  }
}
