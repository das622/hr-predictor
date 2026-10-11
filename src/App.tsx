import { Component, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { Ball } from './scene/Ball';
import { Trail } from './scene/Trail';
import { Stadium } from './scene/Stadium';
import { CameraController } from './scene/CameraController';
import { GraphicsMonitor } from './scene/GraphicsMonitor';
import { Controls, PlaybackUI } from './ui/Controls';
import { MobileControls } from './ui/MobileControls';
import { useMobileLayout } from './hooks/useMobileLayout';
import { Model } from './Yankee-stadium';
function Loading() { const { progress, active } = useProgress(); return active ? <div className="loading-overlay"><div className="loading">Loading stadium<span>{Math.round(progress)}%</span></div></div> : null; }
class SceneError extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message || 'Unexpected rendering error' }; }
  render() { return this.state.error ? <div className="scene-error" role="alert"><h2>The simulator stopped rendering.</h2><p>Reload to restart. If this repeats, share the error below.</p><details><summary>Error details</summary>{this.state.error}</details><button onClick={() => window.location.reload()}>Reload simulator</button></div> : this.props.children; }
}
function RuntimeNotice() {
  const [error, setError] = useState<string | null>(null);
  const [graphics, setGraphics] = useState<string | null>(null);
  useEffect(() => {
    const onError = (e: ErrorEvent) => { if (e.message) setError(e.message); };
    const onRejection = (e: PromiseRejectionEvent) => setError(e.reason instanceof Error ? e.reason.message : String(e.reason));
    const onGraphics = (e: Event) => setGraphics((e as CustomEvent<string | null>).detail);
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejection); window.addEventListener('simulator-graphics-status', onGraphics);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); window.removeEventListener('simulator-graphics-status', onGraphics); };
  }, []);
  if (!graphics && !error) return null;
  return <div className="runtime-notice" role="alert"><h2>{graphics ? '3D graphics interrupted' : 'A runtime error occurred'}</h2><p>{graphics || 'If the view is blank or frozen, reload the simulator. Share the details below if this happens again.'}</p>{error && <details open><summary>Error details</summary>{error}</details>}<button onClick={() => window.location.reload()}>Reload simulator</button>{!graphics && <button onClick={() => setError(null)}>Dismiss</button>}</div>;
}
function Simulator() {
  const mobile = useMobileLayout();
  return <main className="app"><Canvas dpr={[1, 1.5]} camera={{ position: [.45, 1.75, -.9], near: .05, far: 1800, fov: 67 }} gl={{ antialias: true }} fallback={<div className="scene-error">This simulator needs a browser with WebGL enabled.</div>}>
    <color attach="background" args={['#b6cde0']} /><hemisphereLight args={['#e0f2ff', '#6e7954', 2]} />
    <directionalLight position={[-60, 100, 20]} intensity={2.2} />
    <GraphicsMonitor />
    <Suspense fallback={null}><Model /><CameraController /><Ball /><Trail /><Stadium /></Suspense>
  </Canvas><Loading /><div className="vignette" />{mobile ? <MobileControls /> : <><Controls /><PlaybackUI /></>}<RuntimeNotice /></main>;
}
export default function App() { return <SceneError><Simulator /></SceneError>; }
