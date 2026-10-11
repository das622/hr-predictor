import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useHitStore, LIMITS } from '../store/useHitStore';
import type { Params } from '../physics/physics';
import { flightInput } from '../scene/CameraController';
export const fields: { key: keyof Params; label: string; unit: string; step: number }[] = [
  { key: 'exitVeloMph', label: 'Exit velocity', unit: 'mph', step: 1 },
  { key: 'launchDeg', label: 'Launch angle', unit: '°', step: 1 },
  { key: 'sprayDeg', label: 'Spray angle', unit: '°', step: 1 },
  { key: 'backspinRpm', label: 'Backspin', unit: 'rpm', step: 100 },
];
export function HitSlider({ field }: { field: typeof fields[number] }) {
  const value = useHitStore(s => s[field.key]); const set = useHitStore(s => s.setParam);
  return <label className="slider-field" htmlFor={field.key}>
    <span>{field.label}<strong>{field.key === 'sprayDeg' ? (value === 0 ? 'Center' : `${Math.abs(value)}° ${value < 0 ? 'Left' : 'Right'}`) : value.toLocaleString()}<small>{field.key === 'sprayDeg' ? '' : field.unit}</small></strong></span>
    <input id={field.key} type="range" min={LIMITS[field.key][0]} max={LIMITS[field.key][1]} step={field.step} value={value} onChange={e => set(field.key, +e.target.value)} />
    {field.key === 'sprayDeg' && <span className="range-hint"><span>← Left field</span><span>Center</span><span>Right field →</span></span>}
  </label>;
}
export function Controls() {
  const [hitOpen, setHitOpen] = useState(true);
  const [resultOpen, setResultOpen] = useState(true);
  const result = useHitStore(s => s.result);
  const showBoundary = useHitStore(s => s.showBoundary); const toggleBoundary = useHitStore(s => s.toggleBoundary);
  const outcome = { home_run: 'Home run', off_wall: 'Off the wall', in_play: 'In play', foul: 'Foul ball' }[result.outcome];
  return <>
    <aside className={'control-panel ' + (!hitOpen ? 'collapsed' : '')} aria-label="Hit parameters">
      <div className="panel-header"><span>Hit controls</span><button aria-label={hitOpen ? 'Hide hit controls' : 'Show hit controls'} aria-expanded={hitOpen} onClick={() => setHitOpen(!hitOpen)}>{hitOpen ? '−' : '+'}</button></div>
      <div className="panel-body" hidden={!hitOpen}>
        {fields.slice(0, 3).map(field => <HitSlider key={field.key} field={field} />)}
        <details className="advanced"><summary>Spin & display options</summary><HitSlider field={fields[3]} />
        <label className="check-row"><input type="checkbox" checked={showBoundary} onChange={toggleBoundary} />Show wall boundary</label>
        </details>
      </div>
    </aside>
    <section className={'result-card ' + result.outcome + (!resultOpen ? ' collapsed' : '')} aria-label="Predicted hit result" aria-live="polite">
      <div className="panel-header"><span>Predicted result</span><button aria-label={resultOpen ? 'Hide predicted result' : 'Show predicted result'} aria-expanded={resultOpen} onClick={() => setResultOpen(!resultOpen)}>{resultOpen ? '−' : '+'}</button></div>
      <div className="result-body" hidden={!resultOpen}>
      <h2>{outcome}<span>↗</span></h2>
      <div className="carry"><strong>{Math.round(result.distanceFt)}</strong><span>FT<small>CARRY WITHOUT WALLS</small></span></div>
      <p className="wall-distance">Model wall in this direction <strong>{Math.round(result.wallDistanceFt ?? 0)} ft</strong></p>
      <div className="stat-row"><div><span>APEX</span><strong>{Math.round(result.peakHeightFt)}<small> ft</small></strong></div><div><span>FLIGHT TIME*</span><strong>{result.hangTimeSec.toFixed(1)}<small> s</small></strong></div></div>
      {result.clearanceFt !== undefined && <p className="clearance">{result.clearanceFt > 0 ? '+' : ''}{result.clearanceFt.toFixed(1)} ft wall clearance </p>}
      <p className="stat-note">{result.outcome === 'off_wall' ? 'Hits the wall below its top. Carry is where it would land without the wall.' : 'Carry and flight time ignore walls and stands.'}</p>
      </div>
    </section>
  </>;
}
export function PlaybackUI() {
  const [open, setOpen] = useState(true);
  const isPlaying = useHitStore(s => s.isPlaying); const finished = useHitStore(s => s.isFinished);
  const mode = useHitStore(s => s.cameraMode); const follow = useHitStore(s => s.followBall);
  return <div className="compact-toolbar" aria-label="Playback and camera controls">
    {open && <>
      <button className="play-button" onClick={() => useHitStore.getState().togglePlay()}>{finished ? '↻ Replay' : isPlaying ? 'Ⅱ Pause' : '▶ Play'}</button>
      <button className="small-replay" aria-label="Replay hit" title="Replay hit" onClick={() => useHitStore.getState().replay()}>↻</button>
      <select aria-label="Camera view" value={mode} onChange={e => useHitStore.getState().setCamera(e.target.value as 'batter' | 'free')}><option value="batter">Batter view</option><option value="free">Explore stadium</option></select>
      {mode === 'batter' ? <button className={follow ? 'tracking on' : 'tracking'} aria-pressed={follow} onClick={() => useHitStore.getState().setFollow(!follow)}>{follow ? 'Following' : 'Follow ball'}</button> : <button className="tracking" title="WASD move · drag to look · Q/E height · Shift faster" onClick={() => useHitStore.getState().resetCamera()}>Reset view</button>}
    </>}
    <button className="toolbar-toggle" aria-label={open ? 'Hide playback controls' : 'Show playback controls'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '−' : '+ Controls'}</button>
  </div>;
}
export function TouchFlightControls() {
  const mode = useHitStore(s => s.cameraMode); const pointer = useRef<number | null>(null);
  const [thumb, setThumb] = useState([0, 0]);
  function move(e: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== e.pointerId) return;
    const b = e.currentTarget.getBoundingClientRect(); let x = (e.clientX - b.left - b.width / 2) / 35, y = (e.clientY - b.top - b.height / 2) / 35;
    const n = Math.max(1, Math.hypot(x, y)); x /= n; y /= n; flightInput.x = x; flightInput.z = -y; setThumb([x * 28, y * 28]);
  }
  function stop() { pointer.current = null; flightInput.x = flightInput.z = 0; setThumb([0, 0]); }
  if (mode !== 'free') return null;
  return <div className="touch-flight"><div className="joystick" role="group" aria-label="Movement joystick" onPointerDown={e => { pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}><span style={{ transform: `translate(${thumb[0]}px,${thumb[1]}px)` }} /></div><div className="height-buttons">{[1,-1].map(y => <button key={y} aria-label={y > 0 ? 'Move camera up' : 'Move camera down'} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); flightInput.y = y; }} onPointerUp={() => flightInput.y = 0} onPointerCancel={() => flightInput.y = 0} onLostPointerCapture={() => flightInput.y = 0}>{y > 0 ? '↑' : '↓'}</button>)}</div></div>;
}
