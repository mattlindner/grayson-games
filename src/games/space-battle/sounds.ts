/**
 * @module sounds
 *
 * Retro 8-/16-bit style sound effects synthesized at runtime using the
 * Web Audio API.  No external audio files are required — every effect is
 * built from {@link OscillatorNode} tones with frequency sweeps and
 * gain envelopes.
 */

/** Lazily-initialized singleton {@link AudioContext}. */
let _ctx: AudioContext | null = null;

/**
 * Returns the shared {@link AudioContext}, creating it on first call.
 *
 * @returns The singleton `AudioContext` instance.
 */
const audioCtx = (): AudioContext => {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
};

/**
 * Plays a single synthesized tone with optional frequency sweep.
 *
 * This is the low-level primitive used by every public sound function.
 * The oscillator is created, connected to a gain node, ramped, and
 * automatically stopped after {@link duration} seconds.
 *
 * @param frequency    - Starting frequency in Hz.
 * @param duration     - Length of the tone in seconds.
 * @param type         - Waveform type (`"square"`, `"sawtooth"`, etc.).
 *                       Defaults to `"square"` for a classic retro sound.
 * @param volumeStart  - Gain value at the start of the tone (0 – 1).
 * @param volumeEnd    - Gain value at the end of the tone (0 – 1).
 * @param frequencyEnd - If provided, the frequency linearly ramps to this
 *                       value over the tone's duration, producing a sweep.
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
    // Audio not available
  }
}

/**
 * Plays the player's laser-fire sound effect.
 *
 * A short high-pitched square-wave sweep from 880 Hz → 440 Hz.
 */
export function playShoot() {
  playTone(880, 0.1, "square", 0.15, 0.01, 440);
}

/**
 * Plays the enemy missile-fire sound effect.
 *
 * A low sawtooth sweep from 220 Hz → 110 Hz, quieter than the player's
 * shot so it stays in the background.
 */
export function playEnemyShoot() {
  playTone(220, 0.15, "sawtooth", 0.1, 0.01, 110);
}

/**
 * Plays the enemy-destroyed explosion effect.
 *
 * Two overlapping tones — a sawtooth rumble and a delayed square thud —
 * create a satisfying crunch.
 */
export function playExplosion() {
  playTone(150, 0.3, "sawtooth", 0.3, 0.01, 30);
  setTimeout(() => playTone(80, 0.2, "square", 0.2, 0.01, 20), 50);
}

/**
 * Plays the player-hit damage sound.
 *
 * A descending two-part tone that conveys impact without being as final
 * as {@link playGameOver}.
 */
export function playHit() {
  playTone(200, 0.2, "square", 0.25, 0.01, 80);
  setTimeout(() => playTone(100, 0.15, "sawtooth", 0.2, 0.01, 40), 100);
}

/**
 * Plays an ascending 4-note arpeggio for the level-up fanfare.
 *
 * Notes: C5 → E5 → G5 → C6 (a C-major arpeggio), each delayed by 150 ms.
 */
export function playLevelUp() {
  playTone(523, 0.15, "square", 0.2, 0.05);
  setTimeout(() => playTone(659, 0.15, "square", 0.2, 0.05), 150);
  setTimeout(() => playTone(784, 0.15, "square", 0.2, 0.05), 300);
  setTimeout(() => playTone(1047, 0.3, "square", 0.25, 0.01), 450);
}

/**
 * Plays a descending three-part "game over" dirge.
 *
 * Each successive tone is lower and longer, ending with a drawn-out
 * sawtooth fade to emphasize finality.
 */
export function playGameOver() {
  playTone(400, 0.3, "square", 0.25, 0.1, 300);
  setTimeout(() => playTone(300, 0.3, "square", 0.2, 0.1, 200), 300);
  setTimeout(() => playTone(200, 0.5, "sawtooth", 0.2, 0.01, 80), 600);
}

/**
 * Initializes (or resumes) the shared {@link AudioContext}.
 *
 * Browsers require an `AudioContext` to be created or resumed inside a
 * user-gesture handler.  Call this from the first `touchstart` /
 * `mousedown` / `keydown` event to guarantee audio will play.
 */
export function initAudio() {
  if (_ctx && _ctx.state === "suspended") {
    _ctx.resume();
  }
  if (!_ctx) {
    _ctx = new AudioContext();
  }
}
