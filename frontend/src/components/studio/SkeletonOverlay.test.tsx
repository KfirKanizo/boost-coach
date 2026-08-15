import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LandmarkPoint } from '../../workers/visionProtocol';
import { SkeletonOverlay } from './SkeletonOverlay';

const NEON = '#00E676';
const CRIMSON = '#FF1744';

const lm = (
  x: number,
  y: number,
  z = 0,
  visibility = 1,
): LandmarkPoint => ({ x, y, z, visibility });

function pose33(): LandmarkPoint[] {
  const points: LandmarkPoint[] = [];
  for (let i = 0; i < 33; i += 1) points.push(lm(0.5, 0.5));
  return points;
}

interface FakeCtx {
  clearRect: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  lineWidth: number;
  lineCap: string;
  strokeStyle: string;
}

let ctx: FakeCtx;

beforeEach(() => {
  ctx = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    lineWidth: 0,
    lineCap: '',
    strokeStyle: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SkeletonOverlay', () => {
  it('clears the canvas and draws nothing without landmarks', () => {
    render(<SkeletonOverlay landmarks={null} warning={null} />);

    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('draws the pose bones in neon when landmarks are present', () => {
    render(<SkeletonOverlay landmarks={pose33()} warning={null} />);

    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe(NEON);
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
  });

  it('highlights warned joints in crimson for knee valgus', () => {
    render(<SkeletonOverlay landmarks={pose33()} warning="knee_valgus" />);

    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe(CRIMSON);
  });
});
