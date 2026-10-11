import { useEffect, useRef, useState } from 'react';
import { useHitStore } from '../store/useHitStore';
import { fields, HitSlider } from './Controls';
import './mobile.css';

export function MobileControls() {
  const [panel, setPanel] = useState<'hit' | 'result' | null>(null);
  const [help, setHelp] = useState(false);
  const swipeStart = useRef<number | null>(null);
  const result = useHitStore(s => s.result);
  const playing = useHitStore(s => s.isPlaying);
  const finished = useHitStore(s => s.isFinished);
  const mode = useHitStore(s => s.cameraMode);
  const follow = useHitStore(s => s.followBall);
  const boundary = useHitStore(s => s.showBoundary);
  const outcome = { home_run: 'Home run', off_wall: 'Off the wall', in_play: 'In play', foul: 'Foul ball' }[result.outcome];
  const clearance = result.clearanceFt === undefined ? 'No wall crossing' : `${result.clearanceFt > 0 ? '+' : ''}${result.clearanceFt.toFixed(1)} ft clearance`;
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPanel(null); setHelp(false); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  return <div className={'mobile-ui' + (panel === 'hit' ? ' editing-hit' : '')}>
    <section className={'mobile-result ' + result.outcome} aria-label="Predicted hit result">
      <button className="mobile-result-summary" aria-expanded={panel === 'result'} aria-controls="mobile-result-details" onClick={() => setPanel(panel === 'result' ? null : 'result')}>
        <span><strong>{outcome}</strong><small>{clearance}</small></span>
        <span className="mobile-carry"><strong>{Math.round(result.distanceFt)} ft</strong><small>Projected carry</small></span>
        <span aria-hidden="true">{panel === 'result' ? '−' : '+'}</span>
      </button>
      <div id="mobile-result-details" className="mobile-result-details" hidden={panel !== 'result'}>
        <dl><div><dt>Wall in this direction</dt><dd>{Math.round(result.wallDistanceFt ?? 0)} ft</dd></div><div><dt>Apex</dt><dd>{Math.round(result.peakHeightFt)} ft</dd></div><div><dt>Flight time without walls</dt><dd>{result.hangTimeSec.toFixed(1)} s</dd></div></dl>
        <p>{result.outcome === 'off_wall' ? 'Hits the wall below its top. Projected carry is where it would land without the wall.' : 'Projected carry and flight time ignore walls and stands.'}</p>
      </div>
    </section>
    <aside id="mobile-hit-drawer" className="mobile-hit-drawer" aria-label="Hit parameters" hidden={panel !== 'hit'}>
      <div className="mobile-drawer-header" onPointerDown={e => { if ((e.target as HTMLElement).closest('button')) return; swipeStart.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => { if (swipeStart.current !== null && e.clientY - swipeStart.current > 35) setPanel(null); swipeStart.current = null; }} onPointerCancel={() => swipeStart.current = null}>
        <span>Hit controls <small>Swipe down to close</small></span><button aria-label="Close hit controls" onClick={() => setPanel(null)}>−</button>
      </div>
      <div className="mobile-drawer-body">
        {fields.slice(0, 3).map(field => <HitSlider key={field.key} field={field} />)}
        <details className="advanced"><summary>Spin & display options</summary><HitSlider field={fields[3]} /><label className="check-row"><input type="checkbox" checked={boundary} onChange={() => useHitStore.getState().toggleBoundary()} />Show wall boundary</label></details>
        <button className="mobile-watch" onClick={() => { setPanel(null); useHitStore.getState().replay(); }}>Replay & watch</button>
      </div>
    </aside>
    <div className="mobile-bottom">
      {help && <div className="mobile-gesture-help"><p>{mode === 'free' ? 'One finger: rotate · Pinch: closer / farther · Two fingers: move sideways or up / down.' : 'Drag to look around. Tap Follow ball to resume tracking.'}</p><button aria-label="Close gesture help" onClick={() => setHelp(false)}>×</button></div>}
      <div className="mobile-toolbar" aria-label="Playback and camera controls">
        <button className="mobile-play" onClick={() => { setPanel(null); useHitStore.getState().togglePlay(); }}>{finished ? '↻ Replay' : playing ? 'Ⅱ Pause' : '▶ Play'}</button>
        <button aria-expanded={panel === 'hit'} aria-controls="mobile-hit-drawer" onClick={() => setPanel(panel === 'hit' ? null : 'hit')}>Hit controls</button>
        <select aria-label="Camera view" value={mode} onChange={e => { useHitStore.getState().setCamera(e.target.value as 'batter' | 'free'); setHelp(false); }}><option value="batter">Batter view</option><option value="free">Explore stadium</option></select>
        <button className="mobile-help-toggle" aria-expanded={help} onClick={() => setHelp(!help)}>Gestures</button>
        {mode === 'free' ? <button className="mobile-camera-action" onClick={() => useHitStore.getState().resetCamera()}>Reset view</button> : <button className="mobile-camera-action" aria-pressed={follow} onClick={() => useHitStore.getState().setFollow(!follow)}>{follow ? 'Following ball' : 'Follow ball'}</button>}
      </div>
    </div>
  </div>;
}
