/**
 * @module sounds
 *
 * Retro 8-/16-bit style sound effects for Octopus Cannon, synthesized at
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
 * @param frequencyEnd - If set, the frequency ramps to this value over the tone.
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

/** Cannon-fire blip — a short square-wave sweep. */
export function playShoot() {
  playTone(660, 0.1, "square", 0.15, 0.01, 330);
}

/** Enemy-destroyed splat — a low sawtooth rumble plus a delayed thud. */
export function playExplosion() {
  playTone(150, 0.28, "sawtooth", 0.3, 0.01, 30);
  setTimeout(() => playTone(80, 0.2, "square", 0.2, 0.01, 20), 50);
}

/** Player-hit damage sound — a descending two-part tone. */
export function playHit() {
  playTone(200, 0.2, "square", 0.25, 0.01, 80);
  setTimeout(() => playTone(100, 0.15, "sawtooth", 0.2, 0.01, 40), 100);
}

/** Descending three-part "game over" dirge. */
export function playGameOver() {
  playTone(400, 0.3, "square", 0.25, 0.1, 300);
  setTimeout(() => playTone(300, 0.3, "square", 0.2, 0.1, 200), 300);
  setTimeout(() => playTone(200, 0.5, "sawtooth", 0.2, 0.01, 80), 600);
}

/**
 * Initializes (or resumes) the shared {@link AudioContext}.
 *
 * Browsers require an `AudioContext` to be created / resumed inside a
 * user-gesture handler, so call this from the first input event.
 */
export function initAudio() {
  if (_ctx && _ctx.state === "suspended") {
    _ctx.resume();
  }
  if (!_ctx) {
    _ctx = new AudioContext();
  }
}
