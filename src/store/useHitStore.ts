import { create } from 'zustand';
import { simulate, classify, visibleTrajectory } from '../physics/physics';
import type { Params, Result, TrajPoint } from '../physics/physics';
import { YANKEE_WALL } from '../physics/stadiums/yankee';
export type CameraMode = 'batter' | 'free';
export const LIMITS = { exitVeloMph: [60, 120], launchDeg: [-10, 80], sprayDeg: [-45, 45], backspinRpm: [0, 4000] };
const defaults: Params = { exitVeloMph: 100, launchDeg: 28, sprayDeg: 0, backspinRpm: 2200 };
function calculate(params: Params) {
  const full = simulate(params); const result = classify(full, YANKEE_WALL);
  return { trajectory: visibleTrajectory(full, result), result };
}
interface HitState extends Params {
  trajectory: TrajPoint[]; result: Result; elapsed: number; isPlaying: boolean; isFinished: boolean;
  playbackSpeed: number; cameraMode: CameraMode; followBall: boolean; cameraReset: number; showBoundary: boolean;
  setParam: (key: keyof Params, value: number) => void;
  setPreset: (params: Params) => void; replay: () => void; togglePlay: () => void;
  advance: (delta: number) => void; seek: (time: number) => void;
  setCamera: (mode: CameraMode) => void; resetCamera: () => void;
  setFollow: (follow: boolean) => void; setSpeed: (speed: number) => void; toggleBoundary: () => void;
}
export const useHitStore = create<HitState>((set, get) => ({
  ...defaults, ...calculate(defaults), elapsed: 0, isPlaying: false, isFinished: false,
  playbackSpeed: 1, cameraMode: 'batter', followBall: true, cameraReset: 0, showBoundary: false,
  setParam: (key, value) => {
    if (!Number.isFinite(value)) return;
    const [min, max] = LIMITS[key]; const params = { ...get(), [key]: Math.max(min, Math.min(max, value)) };
    set({ [key]: params[key], ...calculate(params), elapsed: 0, isPlaying: true, isFinished: false });
  },
  setPreset: params => set({ ...params, ...calculate(params), elapsed: 0, isPlaying: true, isFinished: false }),
  replay: () => set({ elapsed: 0, isPlaying: true, isFinished: false }),
  togglePlay: () => get().isFinished ? get().replay() : set({ isPlaying: !get().isPlaying }),
  advance: delta => {
    const s = get(); if (!s.isPlaying) return;
    const end = s.trajectory[s.trajectory.length - 1].t;
    const elapsed = Math.min(end, s.elapsed + Math.min(delta, .1) * s.playbackSpeed);
    set({ elapsed, isFinished: elapsed >= end, isPlaying: elapsed < end });
  },
  seek: t => { const end = get().trajectory.at(-1)!.t; const elapsed = Math.max(0, Math.min(end, t));
    set({ elapsed, isPlaying: false, isFinished: elapsed >= end }); },
  setCamera: cameraMode => set({ cameraMode }),
  resetCamera: () => set({ cameraReset: get().cameraReset + 1 }),
  setFollow: followBall => set({ followBall }),
  setSpeed: playbackSpeed => set({ playbackSpeed }),
  toggleBoundary: () => set({ showBoundary: !get().showBoundary }),
}));
