import { FT, wallAt } from '../physics';
import type { Vec, WallSegment } from '../physics';

// Published distances: https://www.mlb.com/news/featured/yankee-stadium-guide-capacity-seating-chart-parking-and-more
// Geometry angles: +X is left field. Gap angles ±22.5 are modeling assumptions,
// NOT surveyed marker bearings. Straight spans between anchors approximate the wall.
export const FIELD_ANCHORS = [
  { angle: -45, feet: 314 },
  { angle: -22.5, feet: 385 },
  { angle: 0, feet: 408 },
  { angle: 22.5, feet: 399 },
  { angle: 45, feet: 318 },
];
const points: Vec[] = FIELD_ANCHORS.map(({ angle, feet }) => [
  Math.sin(angle * Math.PI / 180) * feet * FT, 0,
  Math.cos(angle * Math.PI / 180) * feet * FT,
]);
const target = points.slice(1).map((b, i) => ({ a: points[i], b }));
const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

export function createOutfieldCalibration(source: WallSegment[]) {
  function warp(x: number, y: number, z: number): Vec {
    const radius = Math.hypot(x, z);
    // Preserve the entire infield (including second base), home and the mound.
    if (radius <= 45) return [x, y, z];
    const angle = Math.atan2(x, z) * 180 / Math.PI;
    const sideBlend = 1 - smooth((Math.abs(angle) - 45) / 30);
    if (!sideBlend) return [x, y, z];
    const fairAngle = Math.max(-45, Math.min(45, angle));
    const oldWall = wallAt(source, fairAngle);
    const newWall = wallAt(target, fairAngle);
    if (!oldWall || !newWall) throw new Error(`Missing calibration boundary at ${fairAngle}`);
    // Constant displacement beyond 85m keeps depth of stands intact. Heights stay
    // unchanged; this asset's wall heights remain approximate, not surveyed data.
    const shift = (newWall.distM - oldWall.distM) * smooth((radius - 45) / 40) * sideBlend;
    const scale = (radius + shift) / radius;
    return [x * scale, y, z * scale];
  }
  // Include source corners (height changes), target corners and dense samples.
  const angles = new Set(FIELD_ANCHORS.map(p => p.angle));
  for (let a = -45; a <= 45; a += .25) angles.add(a);
  for (const s of source) for (const p of [s.a, s.b]) {
    const a = Math.atan2(p[0], p[2]) * 180 / Math.PI;
    if (a > -45 && a < 45) angles.add(a);
  }
  const boundary = [...angles].sort((a, b) => a - b).map(angle => {
    const w = wallAt(source, angle);
    if (!w) throw new Error(`Missing source wall at ${angle}`);
    const theta = angle * Math.PI / 180;
    return warp(Math.sin(theta) * w.distM, w.heightM, Math.cos(theta) * w.distM);
  });
  const segments = boundary.slice(1).map((b, i) => ({ a: boundary[i], b }));
  return { warp, segments };
}
