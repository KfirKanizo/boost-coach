import { useEffect, useRef } from 'react';

import type {
  LandmarkPoint,
  ExerciseWarning,
} from '../../workers/visionProtocol';
import { LANDMARKS } from '../../workers/squatKinematics';
import { POSE_CONNECTIONS } from './poseGeometry';

interface SkeletonOverlayProps {
  landmarks: LandmarkPoint[] | null;
  warning: ExerciseWarning | null;
}

/** Design-system tokens (mirror of tailwind.config.js). */
const NEON = '#00E676';
const CRIMSON = '#FF1744';

const MIN_VISIBILITY = 0.5;

/**
 * Lightweight 2D skeleton renderer.
 *
 * Receives normalized landmarks from the vision worker and draws the pose
 * connections on an overlay canvas sized to the camera frame container.
 * Posture-correct bones render neon; warned joints (e.g. knee valgus) render
 * crimson.
 */
export function SkeletonOverlay({ landmarks, warning }: SkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    if (!landmarks || landmarks.length < 33) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const isVisible = (index: number) =>
      (landmarks[index]?.visibility ?? 1) >= MIN_VISIBILITY;
    const point = (index: number) => ({
      x: landmarks[index].x * width,
      y: landmarks[index].y * height,
    });

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = NEON;
    ctx.beginPath();
    for (const [a, b] of POSE_CONNECTIONS) {
      if (!isVisible(a) || !isVisible(b)) continue;
      const from = point(a);
      const to = point(b);
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();

    if (warning === 'knee_valgus') {
      ctx.lineWidth = 5;
      ctx.strokeStyle = CRIMSON;
      ctx.beginPath();
      for (const joint of [LANDMARKS.leftKnee, LANDMARKS.rightKnee]) {
        if (!isVisible(joint)) continue;
        const center = point(joint);
        ctx.moveTo(center.x + 6, center.y);
        ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
  }, [landmarks, warning]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
