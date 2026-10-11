# Baseball Trajectory Simulator

React + TypeScript + React Three Fiber baseball trajectory simulator using the supplied Yankee Stadium GLB.

## Run locally

Use Node.js 22.12+ (Node 24 recommended).

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. To try it on a phone on the same Wi-Fi:

```bash
npm run dev -- --host 0.0.0.0
```

Open the printed Network URL on your phone. `localhost` on the phone points to the phone, not your computer.

## Controls

- **Play / Pause / Replay:** run the trajectory. Changing a parameter starts a new hit.
- **Compact toolbar:** Play/Pause, Replay, camera selection, and Follow/Reset. The timeline and speed selector were removed from the visible UI.
- **Batter view:** camera stays above home plate and follows the ball. Drag to look manually; Follow ball turns tracking back on.
- **Explore stadium:** WASD or arrows to move, drag to look, Q/E to descend/ascend, Shift for faster movement, scroll to move along the viewing direction. Reset view restores the overview. Movement is unrestricted through stadium structures, with a minimum height above the field plane.
- **Phone/tablet:** tap Hit controls to open the slider drawer. Close it with −, swipe its header downward, or tap Replay & watch. Tap the compact result summary for full metrics. In Explore stadium, one finger rotates, pinch moves closer/farther, and two fingers pan sideways/up/down. Reset view restores the overview. Batter view supports drag-to-look and Follow ball. The Gestures button shows a reminder.
- **Show wall boundary:** overlays the exact segments used by the classifier.

## What changed

- A shared coordinate system puts the field at y=0, home at the origin, and center field toward +Z. Removed the ball/trail's independent 1 m offset.
- Replaced the old five-point polar boundary with 40 segments extracted from the model's field outline and nearby wall geometry. Intersection and displayed debug boundary use the same data.
- Interpolated wall crossing between trajectory samples and accounted for the physical ball radius when checking clearance.
- Off-wall playback ends at contact. There is no bounce/roll simulation.
- Projected carry and flight time describe the unobstructed trajectory; wall distance and wall clearance are separate measurements.
- Shared playback clock drives ball, trail, scrubbing, pause, replay, and tracking. The trail uses reusable GPU buffers rather than React state every frame.
- Added a fixed-position tracking camera, free-flight controls, and mobile controls.
- Rebuilt the UI with responsive panels and local bundled fonts.
- Merged the static model by material/attribute layout, retaining its geometry and textures. The tested scene used 157 draw calls rather than thousands of separate mesh submissions. Pixel ratio is capped at 1.5.

## Calibration and limits

See **CALIBRATION.md**. This GLB is a stylized/historical stadium asset, not a verified model of current Yankee Stadium. Revision 4 reshapes the outfield and its collision boundary together to match five published distance anchors. Intermediate wall geometry, gap-marker bearings, and wall heights remain approximate; this is not a surveyed replica.

The flight model retains the original RK4 integration, gravity, quadratic drag, and pure backspin lift. It is a fun simulator, not a validated ball-tracking system: no wind, sidespin, spin decay, players, bounces, or stadium-structure collisions after a home run. A home-run trail continues along projected flight even beyond the field. The display ball is enlarged with distance for visibility; physics uses a 0.0366 m radius.

## Validate

```bash
npm test
npm run lint
npm run build
npm run preview
```

Fourteen automated tests cover the corrected distance anchors, shared deformation, preservation of the infield, radial continuity, and all fair boundary directions, segment intersection, crossing interpolation, full-ball clearance, off-wall stopping, in-play/foul classification, seeking, an analytic gravity-only comparison, a 270-case parameter sweep, and left/right spray orientation.

Desktop and mobile viewport checks in Chromium exercised the camera and playback controls and responsive layouts. Revision 3 adds panel hide/show checks, slider stress testing, and graphics-context recovery checks. A physical iPhone/Safari test remains necessary before claiming iOS compatibility or a device-specific frame rate.

## Files to start with

- `src/physics/physics.ts`: flight, sampling, segment intersection, classification.
- `src/physics/stadiums/model-boundary.json`: model transform and measured wall segments.
- `src/store/useHitStore.ts`: hit parameters and shared playback state.
- `src/scene/CameraController.tsx`: desktop/mobile movement and tracking.
- `src/ui/Controls.tsx` / `src/index.css`: UI and responsive layout.
- `src/Yankee-stadium.tsx`: GLB loading and static geometry merging.

The production build reports a large JavaScript chunk because Three.js and the rendering stack are bundled together. The 21 MB GLB remains the largest initial download; it has not been compressed or replaced.

## Revision 2: visible sliders and clearer distances

Exit velocity, launch angle, and spray angle are always visible, including on phones. Negative spray sends the ball to the left from the batter’s viewpoint; positive sends it to the right. Backspin and boundary visibility are in Spin & display options.

The results distinguish **carry without walls**, **model wall in this direction**, and **wall clearance**. A ball with 419 ft of projected carry can hit a shorter wall if it is below the top at the crossing point. Before revision 4, this asset measured approximately 419 ft to center. The new shared correction puts center field at 408 ft.

If your local `src/physics/stadiums/yankee.ts` is empty, stop the old dev server, extract this full archive into a fresh folder, and run `npm ci` and `npm run dev` there. The archive includes both the named exports in that file and `model-boundary.json`; copying only part of `src` can leave incompatible files.

## Revision 3: compact UI and rendering diagnostics

- Removed the branding header, marketing copy, and hit presets.
- Compact left panel with the three main sliders; spin/display settings stay optional.
- Retained every predicted-result metric. Both panels have −/+ hide/show buttons.
- Replaced the large playback timeline with a small toolbar; it can also be collapsed.
- Trail geometry and material are allocated once and reused. The visible trail is sampled at up to 120 Hz; the underlying flight simulation remains at 500 Hz.
- Added an app error boundary, a runtime-error notice with details, and WebGL context-loss/recovery messages with a reload option.

The reported `changed tsconfig file detected ... Clearing cache and forcing full-reload` line is a Vite development-server notice, not a crash diagnostic. It means the config changed on disk and Vite reloaded the app. The original blank-screen cause has not been established. If it happens again, capture the on-screen error details or the browser console's red error and the input values.

## Revision 4: corrected outfield distances

- Center field is now 408 ft; left/right foul lines are 318/314 ft.
- Left/right-center anchors are 399/385 ft at assumed ±22.5° bearings.
- The visible outfield and collision boundaries use the same radial correction.
- Home, mound, infield, ball physics, and UI controls are unchanged.
- Original GLB and raw measurements remain intact; runtime applies the correction.
- See CALIBRATION.md for the interpolation assumptions and retained height limitations.

To update, stop Vite, extract this complete ZIP into a fresh folder, then run
`npm ci` and `npm run dev`. Do not extract over a running development server.

## Revision 5: mobile layout and touch camera

Mobile/narrow screens use a separate UI; desktop panels and toolbar retain their
existing layout. The mobile interface opens with a compact result summary and
bottom toolbar. Tap the summary for full results, or Hit controls for the slider
drawer. The drawer header supports swipe-down dismissal; Replay & watch closes
the drawer and restarts the hit. Advanced spin/boundary controls remain inside.

Explore stadium uses one-finger orbit, pinch dolly, and two-finger screen-space
pan. Pan moves the inspection target along with the camera, including vertically.
The camera has a floor at 0.5 m and a 3–600 m orbit-distance range. This is an
inspection camera, not collision-aware walking. Desktop WASD/mouse controls and
batter follow behavior remain available. Reset view returns to the overview.

Validated mobile portrait, small-screen and landscape layouts and touch events
in Chromium, including rotate, pan, pinch, reset, sliders, drawer dismissal and
batter follow. This emulation does not replace testing gestures on a physical
iPhone/Safari. Retest using `npm run dev -- --host 0.0.0.0` and the Network URL.
