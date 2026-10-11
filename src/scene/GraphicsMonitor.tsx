import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
export function GraphicsMonitor() {
  const gl = useThree(s => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); window.dispatchEvent(new CustomEvent('simulator-graphics-status', { detail: 'The browser lost the 3D graphics context. Waiting for it to recover; reload if it stays unavailable.' })); };
    const restored = () => window.dispatchEvent(new CustomEvent('simulator-graphics-status', { detail: null }));
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
    return () => { canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored); };
  }, [gl]);
  return null;
}
