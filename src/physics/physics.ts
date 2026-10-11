// physics.ts — pure TypeScript, no Three.js imports.
// Coordinates (meters): origin = home plate. +x = toward left field from the batter’s view, +y = up, +z = toward center field.
// Spray angle 0 = dead center, negative = left field, positive = right field.

export const MPH = 0.44704;      // mph -> m/s
export const FT = 0.3048;        // ft -> m
const G = 9.80665;

export interface Params {
  exitVeloMph: number;
  launchDeg: number;
  sprayDeg: number;
  backspinRpm: number; // typical batted ball: ~1500-2500
}

export interface Env {
  rho: number; // air density, kg/m^3 (~1.2 at sea level, 20C)
  cd: number;  // drag coefficient (~0.3-0.4, tune against real data)
}

export const DEFAULT_ENV: Env = { rho: 1.2, cd: 0.35 };

const BALL = { mass: 0.145, radius: 0.0366 };
const AREA = Math.PI * BALL.radius ** 2;

export type Vec = [number, number, number];
interface State { r: Vec; v: Vec }
export interface TrajPoint { t: number; x: number; y: number; z: number }

// ---------- small vector helpers ----------
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const rad = (d: number) => (d * Math.PI) / 180;

// ---------- forces ----------
function accel(v: Vec, axis: Vec, omega: number, env: Env): Vec {
  const speed = norm(v);
  if (speed < 1e-6) return [0, -G, 0];

  // Drag: a = -(rho * Cd * A / (2m)) * |v| * v
  const kd = (env.rho * env.cd * AREA) / (2 * BALL.mass);
  const drag = scale(v, -kd * speed);

  // Magnus lift: a = (rho * A * CL * |v|^2 / (2m)) * unit(axis x v)
  // Spin parameter S = r*omega/|v|; CL ~ 1 / (2.32 + 0.4/S)  (approximation from Nathan's batted-ball work)
  const S = (BALL.radius * omega) / speed;
  const CL = S > 1e-6 ? 1 / (2.32 + 0.4 / S) : 0;
  const dir = cross(axis, v);
  const dirN = norm(dir);
  const lift: Vec =
    dirN > 1e-9
      ? scale(dir, ((env.rho * AREA * CL * speed * speed) / (2 * BALL.mass)) / dirN)
      : [0, 0, 0];

  return add(add(drag, lift), [0, -G, 0]);
}

// ---------- RK4 step ----------
function rk4(s: State, dt: number, axis: Vec, omega: number, env: Env): State {
  const f = (st: State): State => ({ r: st.v, v: accel(st.v, axis, omega, env) });
  const k1 = f(s);
  const k2 = f({ r: add(s.r, scale(k1.r, dt / 2)), v: add(s.v, scale(k1.v, dt / 2)) });
  const k3 = f({ r: add(s.r, scale(k2.r, dt / 2)), v: add(s.v, scale(k2.v, dt / 2)) });
  const k4 = f({ r: add(s.r, scale(k3.r, dt)), v: add(s.v, scale(k3.v, dt)) });
  const dr = add(add(k1.r, scale(k2.r, 2)), add(scale(k3.r, 2), k4.r));
  const dv = add(add(k1.v, scale(k2.v, 2)), add(scale(k3.v, 2), k4.v));
  return { r: add(s.r, scale(dr, dt / 6)), v: add(s.v, scale(dv, dt / 6)) };
}

// ---------- main simulation ----------
export function simulate(p: Params, env: Env = DEFAULT_ENV, dt = 0.002): TrajPoint[] {
  const v0 = p.exitVeloMph * MPH;
  const phi = rad(p.launchDeg);
  const th = rad(-p.sprayDeg); // Positive spray goes right in the batter’s view (+Z forward).

  let s: State = {
    r: [0, 0.9, 0], // contact point ~3 ft above the ground
    v: [v0 * Math.cos(phi) * Math.sin(th), v0 * Math.sin(phi), v0 * Math.cos(phi) * Math.cos(th)],
  };

  // Pure backspin: axis = horizontal heading x up = (-cos(th), 0, sin(th))
  const axis: Vec = [-Math.cos(th), 0, Math.sin(th)];
  const omega = (p.backspinRpm * 2 * Math.PI) / 60;

  const pts: TrajPoint[] = [{ t: 0, x: s.r[0], y: s.r[1], z: s.r[2] }];
  let t = 0;
  while (t < 20) {
    const next = rk4(s, dt, axis, omega, env);
    t += dt;
    if (next.r[1] <= 0) {
      // interpolate the exact landing point
      const k = s.r[1] / (s.r[1] - next.r[1]);
      pts.push({
        t: t - dt + dt * k,
        x: s.r[0] + (next.r[0] - s.r[0]) * k,
        y: 0,
        z: s.r[2] + (next.r[2] - s.r[2]) * k,
      });
      break;
    }
    s = next;
    pts.push({ t, x: s.r[0], y: s.r[1], z: s.r[2] });
  }
  return pts;
}

// Boundary segments and trajectory use the same meter-based coordinates.
export interface WallPoint { angleDeg: number; distM: number; heightM: number }
export interface WallSegment { a: Vec; b: Vec }
export type Outcome = 'home_run' | 'off_wall' | 'in_play' | 'foul';
export interface Result {
  outcome: Outcome;
  distanceFt: number; // Unobstructed projected carry, even for off-wall hits.
  peakHeightFt: number;
  hangTimeSec: number;
  wallDistanceFt?: number;
  clearanceFt?: number;
  crossing?: TrajPoint;
}
export const BALL_RADIUS = BALL.radius;
const cross2 = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx;
export function wallAt(segments: WallSegment[], angleDeg: number) {
  const theta = rad(angleDeg), dx = Math.sin(theta), dz = Math.cos(theta);
  let nearest: { distM: number; heightM: number } | null = null;
  for (const { a, b } of segments) {
    const ex = b[0] - a[0], ez = b[2] - a[2];
    const den = cross2(dx, dz, ex, ez);
    if (Math.abs(den) < 1e-10) continue;
    const d = cross2(a[0], a[2], ex, ez) / den;
    const u = cross2(a[0], a[2], dx, dz) / den;
    if (d > 0 && u >= -1e-7 && u <= 1 + 1e-7 && (!nearest || d < nearest.distM)) {
      nearest = { distM: d, heightM: a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, u)) };
    }
  }
  return nearest;
}
export function sampleTrajectory(points: TrajPoint[], t: number): TrajPoint {
  if (!points.length) return { t: 0, x: 0, y: .9, z: 0 };
  if (t <= points[0].t) return points[0];
  const last = points[points.length - 1];
  if (t >= last.t) return last;
  let lo = 0, hi = points.length - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (points[mid].t <= t) lo = mid; else hi = mid; }
  const a = points[lo], b = points[hi], u = (t - a.t) / (b.t - a.t);
  return { t, x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y), z: a.z + u * (b.z - a.z) };
}
export function classify(pts: TrajPoint[], wall: WallSegment[]): Result {
  if (!pts.length) throw new Error('Cannot classify an empty trajectory');
  const last = pts[pts.length - 1];
  const angle = Math.atan2(last.x, last.z) * 180 / Math.PI;
  const base = { distanceFt: Math.hypot(last.x, last.z) / FT,
    peakHeightFt: pts.reduce((peak, p) => Math.max(peak, p.y), 0) / FT, hangTimeSec: last.t };
  if (Math.abs(angle) > 45 + 1e-7) return { ...base, outcome: 'foul' };
  const boundary = wallAt(wall, angle);
  if (!boundary) throw new Error(`Missing fair-field boundary at ${angle} degrees`);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const da = Math.hypot(a.x, a.z), db = Math.hypot(b.x, b.z);
    if (db < boundary.distM) continue;
    const u = (boundary.distM - da) / (db - da);
    const crossing = sampleTrajectory([a, b], a.t + u * (b.t - a.t));
    const clearanceFt = (crossing.y - BALL_RADIUS - boundary.heightM) / FT;
    return { ...base, outcome: clearanceFt > 0 ? 'home_run' : 'off_wall', crossing,
      clearanceFt, wallDistanceFt: boundary.distM / FT };
  }
  return { ...base, outcome: 'in_play', wallDistanceFt: boundary.distM / FT };
}
export function visibleTrajectory(points: TrajPoint[], result: Result): TrajPoint[] {
  if (result.outcome !== 'off_wall' || !result.crossing) return points;
  return [...points.filter(p => p.t < result.crossing!.t), result.crossing];
}
