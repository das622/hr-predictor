import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { YANKEE_WALL } from '../physics/stadiums/yankee';
import { useHitStore } from '../store/useHitStore';
export function Stadium() {
  const visible = useHitStore(s => s.showBoundary);
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    for (const { a, b } of YANKEE_WALL) vertices.push(...a, ...b, a[0], 0, a[2], ...a);
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(vertices, 3)); return g;
  }, []);
  return <lineSegments geometry={geometry} visible={visible} renderOrder={10}>
    <lineBasicMaterial color="#ffda82" depthTest={false} transparent opacity={.9} />
  </lineSegments>;
}
