/**
 * Lightweight audio cue service using the Web Audio API (OscillatorNode).
 *
 * All sounds are synthesized at runtime — no static audio assets needed.
 * The AudioContext is created lazily on first use and resumed automatically
 * (browsers require a user gesture before audio can play).
 */

// Exported for testing — allows tests to inspect / reset the shared context.
export let ctx: AudioContext | null = null;

/** Replace the shared context (for testing only). */
export function _setContext(c: AudioContext | null) {
  ctx = c;
}

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  // Resume if suspended (autoplay policy). Fire-and-forget.
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.3,
  delay = 0,
) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const g = ac.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  g.gain.setValueAtTime(gain, ac.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);

  osc.connect(g);
  g.connect(ac.destination);

  osc.start(ac.currentTime + delay);
  osc.stop(ac.currentTime + delay + duration);
}

// ── Public API ────────────────────────────────────────────────────────────

/** Short, crisp high-pitched "pop" — fired on each verified rep. */
export function playRepSound() {
  tone(880, 0.06, 'sine', 0.25);
}

/** Pleasant major chord chime — fired when a set completes. */
export function playSetCompleteSound() {
  // C5 – E5 – G5  (major triad)
  tone(523, 0.35, 'sine', 0.2);
  tone(659, 0.35, 'sine', 0.2, 0.02);
  tone(784, 0.35, 'sine', 0.2, 0.04);
}

/** Short low beep — fired on the last 5 countdown seconds. */
export function playTimerTick() {
  tone(440, 0.1, 'square', 0.15);
}

/** Longer higher beep — fired when rest timer hits zero. */
export function playTimerGo() {
  tone(880, 0.25, 'square', 0.2);
}

/** Celebratory upward arpeggio — fired on level-up. */
export function playLevelUpSound() {
  // C5 → E5 → G5 → C6 arpeggio
  tone(523, 0.25, 'sine', 0.2, 0);
  tone(659, 0.25, 'sine', 0.2, 0.12);
  tone(784, 0.25, 'sine', 0.2, 0.24);
  tone(1047, 0.4, 'sine', 0.25, 0.36);
}
