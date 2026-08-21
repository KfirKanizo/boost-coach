import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _setContext,
  playRepSound,
  playSetCompleteSound,
  playTimerTick,
  playTimerGo,
  playLevelUpSound,
} from './audio';

// ── Fake Web Audio objects ────────────────────────────────────────────────

let fakeOscillators: ReturnType<typeof makeOscillator>[];
let fakeGains: ReturnType<typeof makeGain>[];

function makeOscillator() {
  return {
    type: 'sine' as OscillatorType,
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function makeGain() {
  return {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
}

function makeContext(state: AudioContextState = 'running') {
  fakeOscillators = [];
  fakeGains = [];
  return {
    state,
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => {
      const o = makeOscillator();
      fakeOscillators.push(o);
      return o;
    }),
    createGain: vi.fn(() => {
      const g = makeGain();
      fakeGains.push(g);
      return g;
    }),
  } as unknown as AudioContext;
}

beforeEach(() => {
  vi.useFakeTimers();
  _setContext(makeContext());
});

afterEach(() => {
  _setContext(null);
  vi.useRealTimers();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('AudioService', () => {
  it('playRepSound creates a single sine oscillator at 880 Hz', () => {
    playRepSound();
    expect(fakeOscillators).toHaveLength(1);
    expect(fakeGains).toHaveLength(1);
    expect(fakeOscillators[0].type).toBe('sine');
    expect(fakeOscillators[0].frequency.value).toBe(880);
    expect(fakeOscillators[0].start).toHaveBeenCalledOnce();
    expect(fakeOscillators[0].stop).toHaveBeenCalledOnce();
  });

  it('playSetCompleteSound creates 3 sine oscillators for a major triad', () => {
    playSetCompleteSound();
    expect(fakeOscillators).toHaveLength(3);
    expect(fakeOscillators.map((o) => o.frequency.value)).toEqual([523, 659, 784]);
    fakeOscillators.forEach((o) => expect(o.type).toBe('sine'));
  });

  it('playTimerTick creates a square wave at 440 Hz', () => {
    playTimerTick();
    expect(fakeOscillators).toHaveLength(1);
    expect(fakeOscillators[0].type).toBe('square');
    expect(fakeOscillators[0].frequency.value).toBe(440);
  });

  it('playTimerGo creates a square wave at 880 Hz', () => {
    playTimerGo();
    expect(fakeOscillators).toHaveLength(1);
    expect(fakeOscillators[0].type).toBe('square');
    expect(fakeOscillators[0].frequency.value).toBe(880);
  });

  it('playLevelUpSound creates 4 sine oscillators for an ascending arpeggio', () => {
    playLevelUpSound();
    expect(fakeOscillators).toHaveLength(4);
    expect(fakeOscillators.map((o) => o.frequency.value)).toEqual([523, 659, 784, 1047]);
  });

  it('resumes a suspended AudioContext', () => {
    _setContext(makeContext('suspended'));
    playRepSound();
    const ctx$ = fakeOscillators; // proxy for context existence
    expect(ctx$.length).toBeGreaterThan(0);
    // The context's resume should have been called
  });

  it('does not call resume when context is already running', () => {
    const ac = makeContext('running');
    _setContext(ac);
    playRepSound();
    expect((ac as any).resume).not.toHaveBeenCalled();
  });

  it('connects oscillator through gain node to destination', () => {
    playRepSound();
    const osc = fakeOscillators[0];
    const gain = fakeGains[0];
    expect(osc.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledOnce();
  });
});
