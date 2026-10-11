import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useHitStore } from '../store/useHitStore';
import { sampleTrajectory } from '../physics/physics';
export function Ball() {
  const mesh = useRef<Mesh>(null);
  useFrame(({ camera }, delta) => {
    if (!document.hidden) useHitStore.getState().advance(delta);
    const { trajectory, elapsed } = useHitStore.getState();
    const p = sampleTrajectory(trajectory, elapsed);
    if (mesh.current) {
      mesh.current.position.set(p.x, p.y, p.z);
      // Keep the display marker readable at distance; collision uses the real radius.
      mesh.current.scale.setScalar(Math.max(1, camera.position.distanceTo(mesh.current.position) * .025));
    }
  }, -2);
  return <mesh ref={mesh} position={[0, .9, 0]}>
    <sphereGeometry args={[.10, 16, 12]} />
    <meshStandardMaterial color="#fff9db" emissive="#fff2ba" emissiveIntensity={.45} />
  </mesh>;
}
