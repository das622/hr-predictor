import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3, TOUCH } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { sampleTrajectory } from '../physics/physics';
import { useHitStore } from '../store/useHitStore';
// Mutable input lives outside React so pointer movement does not render the UI.
export const flightInput = { x: 0, z: 0, y: 0 };
export function CameraController() {
  const { camera, gl } = useThree();
  const mobile = useMobileLayout();
  const orbit = useRef<OrbitControls | null>(null);
  const orbitTarget = useRef(new Vector3(0, 1, 65));
  const mode = useHitStore(s => s.cameraMode);
  const reset = useHitStore(s => s.cameraReset);
  const keys = useRef(new Set<string>());
  const yaw = useRef(Math.PI), pitch = useRef(0);
  const direction = useRef(new Vector3()); const right = useRef(new Vector3());
  const target = useRef(new Vector3());
  const lastReset = useRef(0);
  const savedFree = useRef<{ position: Vector3; yaw: number; pitch: number } | null>(null);
  useEffect(() => {
    if (mode === 'batter') { camera.position.set(.45, 1.75, -.9); camera.lookAt(0, 2, 65); }
    else if (savedFree.current && reset === lastReset.current) {
      camera.position.copy(savedFree.current.position); camera.rotation.set(savedFree.current.pitch, savedFree.current.yaw, 0, 'YXZ');
    } else { camera.position.set(0, 35, -24); camera.lookAt(0, 1, 65); }
    if (reset !== lastReset.current || !savedFree.current) orbitTarget.current.set(0, 1, 65);
    lastReset.current = reset;
    const e = new Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yaw.current = e.y; pitch.current = e.x;
    flightInput.x = flightInput.y = flightInput.z = 0;
  }, [mode, reset, camera]);
  useEffect(() => {
    if (!mobile || mode !== 'free') return;
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.copy(orbitTarget.current);
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.minDistance = 3; controls.maxDistance = 600;
    controls.minPolarAngle = .03; controls.maxPolarAngle = Math.PI / 2 - .01;
    controls.rotateSpeed = .6; controls.panSpeed = .8;
    controls.touches.ONE = TOUCH.ROTATE; controls.touches.TWO = TOUCH.DOLLY_PAN;
    const rotation = new Euler();
    const save = () => {
      if (camera.position.y < .5) { const rise = .5 - camera.position.y; camera.position.y += rise; controls.target.y += rise; }
      orbitTarget.current.copy(controls.target);
      rotation.setFromQuaternion(camera.quaternion, 'YXZ');
      yaw.current = rotation.y; pitch.current = rotation.x;
    };
    controls.addEventListener('change', save);
    orbit.current = controls; controls.update();
    return () => { controls.removeEventListener('change', save); controls.dispose(); orbit.current = null; };
  }, [mobile, mode, reset, camera, gl]);
  useEffect(() => {
    const canvas = gl.domElement; let pointer: number | null = null, x = 0, y = 0;
    const clear = () => { keys.current.clear(); flightInput.x = flightInput.y = flightInput.z = 0; pointer = null; };
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (!!t.closest('input,select,textarea,button') || t.isContentEditable);
    const down = (e: KeyboardEvent) => { if (typing(e.target)) return;
      if (['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) { e.preventDefault(); keys.current.add(e.code); }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const pointerDown = (e: PointerEvent) => {
      if (mobile && useHitStore.getState().cameraMode === 'free') return;
      if (pointer !== null || e.button > 0) return; pointer = e.pointerId; x = e.clientX; y = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      if (useHitStore.getState().cameraMode === 'batter') useHitStore.getState().setFollow(false);
      const rotation = new Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yaw.current = rotation.y; pitch.current = rotation.x;
    };
    const move = (e: PointerEvent) => { if (e.pointerId !== pointer) return;
      yaw.current -= (e.clientX - x) * .003; pitch.current = Math.max(-1.45, Math.min(1.45, pitch.current - (e.clientY - y) * .003));
      x = e.clientX; y = e.clientY; camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
    };
    const release = (e: PointerEvent) => { if (e.pointerId === pointer) { if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); pointer = null; } };
    const wheel = (e: WheelEvent) => { if (mobile) return; if (useHitStore.getState().cameraMode !== 'free') return; e.preventDefault(); camera.getWorldDirection(direction.current); camera.position.addScaledVector(direction.current, -Math.sign(e.deltaY) * 3); camera.position.y = Math.max(.5, camera.position.y); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('wheel', wheel, { passive: false });
    return () => { clear(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear);
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', release); canvas.removeEventListener('pointercancel', release); canvas.removeEventListener('wheel', wheel); };
  }, [camera, gl, mobile, mode]);
  useFrame((_, delta) => {
    const s = useHitStore.getState();
    if (s.cameraMode === 'batter') {
      if (s.followBall) {
        const p = sampleTrajectory(s.trajectory, s.elapsed);
        if (s.elapsed < .15) target.current.set(0, 2, 65); else target.current.set(p.x, p.y, p.z);
        camera.lookAt(target.current);
      }
      return;
    }
    if (orbit.current) {
      savedFree.current ??= { position: new Vector3(), yaw: 0, pitch: 0 };
      savedFree.current.position.copy(camera.position);
      savedFree.current.yaw = yaw.current; savedFree.current.pitch = pitch.current;
      return;
    }
    const k = keys.current;
    let x = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft')) + flightInput.x;
    let z = Number(k.has('KeyW') || k.has('ArrowUp')) - Number(k.has('KeyS') || k.has('ArrowDown')) + flightInput.z;
    let y = Number(k.has('KeyE')) - Number(k.has('KeyQ')) + flightInput.y;
    const length = Math.max(1, Math.hypot(x, y, z)); x /= length; y /= length; z /= length;
    const step = Math.min(delta, .05) * (k.has('ShiftLeft') || k.has('ShiftRight') ? 45 : 16);
    camera.getWorldDirection(direction.current);
    right.current.crossVectors(direction.current, camera.up).normalize();
    camera.position.addScaledVector(direction.current, z * step).addScaledVector(right.current, x * step);
    camera.position.y = Math.max(.5, camera.position.y + y * step);
    savedFree.current ??= { position: new Vector3(), yaw: 0, pitch: 0 };
    savedFree.current.position.copy(camera.position); savedFree.current.yaw = yaw.current; savedFree.current.pitch = pitch.current;
  });
  return null;
}
