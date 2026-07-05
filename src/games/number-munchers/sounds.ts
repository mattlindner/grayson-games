/**
 * @module sounds
 *
 * Retro 8-/16-bit style sound effects for Number Munchers, synthesized at
 * runtime with the Web Audio API. No external audio files are required.
 */

/** Lazily-initialized singleton {@link AudioContext}. */
let _ctx: AudioContext | null = null;

/** Returns the shared {@link AudioContext}, creating it on first call. */
const audioCtx = (): AudioContext => {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
};

/**
 * Plays a single synthesized tone with an optional frequency sweep.
 *
 * @param frequency    - Starting frequency in Hz.
 * @param duration     - Length of the tone in seconds.
 * @param type         - Oscillator waveform. Defaults to `"square"`.
 * @param volumeStart  - Gain at the start of the tone (0–1).
 * @param volumeEnd    - Gain at the end of the tone (0–1).
 * @param frequencyEnd - If set, frequency ramps to this value over the tone.
 */
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  volumeStart = 0.3,
  volumeEnd = 0.01,
  frequencyEnd?: number
) {
  try {
    const ctx = audioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (frequencyEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(frequencyEnd, ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(volumeStart, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volumeEnd, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available.
  }
}

/** Cheerful "chomp" when eating a correct number. */
export function playMunch() {
  playTone(620, 0.08, "square", 0.25, 0.01, 320);
  setTimeout(() => playTone(440, 0.08, "square", 0.2, 0.01, 220), 55);
}

/** Buzzer when eating a wrong number (loses a heart). */
export function playError() {
  playTone(180, 0.28, "sawtooth", 0.3, 0.01, 90);
  setTimeout(() => playTone(120, 0.2, "square", 0.2, 0.01, 60), 90);
}

/** "Bonk" when an enemy touches the player. */
export function playBonk() {
  playTone(220, 0.18, "square", 0.25, 0.01, 80);
}

/** Ascending arpeggio fanfare when a level is cleared. */
export function playLevelUp() {
  playTone(523, 0.15, "square", 0.2, 0.05);
  setTimeout(() => playTone(659, 0.15, "square", 0.2, 0.05), 130);
  setTimeout(() => playTone(784, 0.15, "square", 0.2, 0.05), 260);
  setTimeout(() => playTone(1047, 0.3, "square", 0.25, 0.01), 390);
}

/** Descending dirge for the game-over screen. */
export function playGameOver() {
  playTone(400, 0.3, "square", 0.25, 0.1, 300);
  setTimeout(() => playTone(300, 0.3, "square", 0.2, 0.1, 200), 300);
  setTimeout(() => playTone(200, 0.5, "sawtooth", 0.2, 0.01, 80), 600);
}

/** Longer triumphant fanfare when all 10 levels are beaten. */
export function playWin() {
  const notes = [523, 659, 784, 1047, 784, 1047, 1319];
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.2, "square", 0.22, 0.02), i * 160);
  });
}

/**
 * Initializes (or resumes) the shared {@link AudioContext}.
 *
 * Must be called from a user-gesture handler (touch/click/keydown) so the
 * browser will allow audio playback.
 */
export function initAudio() {
  if (_ctx && _ctx.state === "suspended") {
    _ctx.resume();
  }
  if (!_ctx) {
    _ctx = new AudioContext();
  }
}
