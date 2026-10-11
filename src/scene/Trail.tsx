import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { useHitStore } from '../store/useHitStore';
import { sampleTrajectory } from '../physics/physics';
import type { TrajPoint } from '../physics/physics';
// One reusable buffer: UI slider changes no longer allocate new GPU geometry/materials.
// The trail is sampled at up to 120 Hz; physics retains its 500 Hz integration.
const CAPACITY = 2402;
export function Trail() {
  const size = useThree(s => s.size);
  const last = useRef<{ points: TrajPoint[] | null; time: number }>({ points: null, time: -1 });
  const line = useMemo(() => {
    const geometry = new LineGeometry();
    geometry.setPositions(new Float32Array((CAPACITY + 1) * 3)); geometry.instanceCount = 0;
    const object = new Line2(geometry, new LineMaterial({ color: '#00c96b', linewidth: 2.5, transparent: true, opacity: .95 }));
    object.frustumCulled = false; return object;
  }, []);
  useEffect(() => { line.material.resolution.set(size.width, size.height); }, [line, size]);
  useEffect(() => () => { line.geometry.dispose(); line.material.dispose(); }, [line]);
  useFrame(() => {
    const { trajectory, elapsed: t, result } = useHitStore.getState();
    if (!trajectory.length || (last.current.points === trajectory && last.current.time === t)) return;
    last.current = { points: trajectory, time: t };
    line.material.color.set(result.outcome === 'home_run' ? '#00c96b' : '#ed4c39');
    const starts = line.geometry.getAttribute('instanceStart'), ends = line.geometry.getAttribute('instanceEnd');
    const count = Math.min(CAPACITY, Math.ceil(t * 120));
    let previous = trajectory[0];
    for (let i = 0; i < count; i++) {
      const p = sampleTrajectory(trajectory, Math.min(t, (i + 1) * t / count));
      starts.setXYZ(i, previous.x, previous.y, previous.z); ends.setXYZ(i, p.x, p.y, p.z); previous = p;
    }
    line.geometry.instanceCount = count; starts.needsUpdate = true; ends.needsUpdate = true;
  }, -1);
  return <primitive object={line} />;
}
