import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/physics/physics.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
const { simulate, classify, visibleTrajectory, wallAt, sampleTrajectory, BALL_RADIUS, FT } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const { segments: sourceSegments } = JSON.parse(fs.readFileSync(new URL('../src/physics/stadiums/model-boundary.json', import.meta.url)));
const calibrationSource = fs.readFileSync(new URL('../src/physics/stadiums/outfield-calibration.ts', import.meta.url), 'utf8');
const physicsUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const calibrationCode = ts.transpileModule(calibrationSource, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText.replace("'../physics'", JSON.stringify(physicsUrl));
const { createOutfieldCalibration, FIELD_ANCHORS } = await import('data:text/javascript;base64,' + Buffer.from(calibrationCode).toString('base64'));
const { segments, warp } = createOutfieldCalibration(sourceSegments);
test('corrected wall matches all five distance anchors', () => {
  for (const { angle, feet } of FIELD_ANCHORS) assert.ok(Math.abs(wallAt(segments, angle).distM / FT - feet) < 1e-6);
});
test('visual point mapping and collision boundary agree through the fair sector', () => {
  for (let angle = -45; angle <= 45; angle += .1) {
    const old = wallAt(sourceSegments, angle), theta = angle * Math.PI / 180;
    const p = warp(Math.sin(theta) * old.distM, old.heightM, Math.cos(theta) * old.distM);
    assert.ok(Math.abs(Math.hypot(p[0], p[2]) - wallAt(segments, angle).distM) < 1e-6);
    assert.ok(wallAt(segments, angle).distM / FT <= 408 + 1e-6);
    assert.equal(p[1], old.heightM);
  }
});
test('infield, batter origin and mound are untouched', () => {
  for (const p of [[0,0,0], [0,0,60.5*FT], [0,0,127.28*FT], [27,1,27], [0,10,-100]]) assert.deepEqual(warp(...p), p);
});
test('outfield mapping has no folds along any tested radial ray', () => {
  for (let a = -75; a <= 75; a += 1) {
    let previous = 0;
    for (let r = 1; r < 250; r += 1) {
      const theta = a * Math.PI / 180, p = warp(r*Math.sin(theta), 0, r*Math.cos(theta));
      const radius = Math.hypot(p[0],p[2]); assert.ok(radius > previous); previous = radius;
    }
  }
});
const wall = [{ a: [-100, 3, 100], b: [100, 3, 100] }];
const shot = y => [{ t: 0, x: 0, y: 1, z: 0 }, { t: 1, x: 0, y, z: 110 }, { t: 2, x: 0, y: 0, z: 150 }];
test('every fair spray direction has a positive model boundary', () => {
  for (let angle = -45; angle <= 45; angle += .05) {
    const w = wallAt(segments, angle); assert.ok(w && w.distM > 80 && w.distM < 150 && w.heightM > 1 && w.heightM < 8, `Missing or invalid wall at ${angle}`);
  }
});
test('wall intersection uses the physical segment, not polar radius interpolation', () => {
  assert.ok(Math.abs(wallAt(wall, 30).distM - 100 / Math.cos(Math.PI / 6)) < 1e-9);
});
test('crossing is interpolated between physics samples', () => {
  const r = classify(shot(5), wall); assert.equal(r.outcome, 'home_run');
  assert.ok(Math.abs(r.crossing.z - 100) < 1e-8); assert.ok(Math.abs(r.crossing.t - 100/110) < 1e-8);
  assert.ok(Math.abs(r.distanceFt - 150 / FT) < 1e-8);
});
test('a ball must clear with its bottom, not only its center', () => {
  const pts = [{t:0,x:0,y:1,z:0}, {t:1,x:0,y:3+BALL_RADIUS,z:100}, {t:2,x:0,y:0,z:150}];
  assert.equal(classify(pts, wall).outcome, 'off_wall'); pts[1].y += .001; assert.equal(classify(pts, wall).outcome, 'home_run');
});
test('off-wall animation ends exactly at contact; carry remains projected', () => {
  const pts = shot(2); const result = classify(pts, wall); const visible = visibleTrajectory(pts, result);
  assert.equal(result.outcome, 'off_wall'); assert.deepEqual(visible.at(-1), result.crossing); assert.ok(visible.at(-1).t < pts.at(-1).t);
  assert.equal(result.distanceFt, 150 / FT);
});
test('short hits remain in play and fouls never become home runs', () => {
  assert.equal(classify([{t:0,x:0,y:1,z:0},{t:1,x:0,y:0,z:50}],wall).outcome,'in_play');
  assert.equal(classify([{t:0,x:0,y:1,z:0},{t:2,x:200,y:0,z:100}],wall).outcome,'foul');
});
test('trajectory sampling supports rewind and clamps both ends', () => {
  const pts=shot(5); assert.deepEqual(sampleTrajectory(pts,-10),pts[0]);assert.deepEqual(sampleTrajectory(pts,100),pts.at(-1));
  assert.equal(sampleTrajectory(pts,.5).z,55); sampleTrajectory(pts,1.5);assert.equal(sampleTrajectory(pts,.25).z,27.5);
});
test('zero drag and zero spin match the analytic projectile solution', () => {
  const mph=90,deg=30,v=mph*.44704,vy=v*Math.sin(deg*Math.PI/180),vx=v*Math.cos(deg*Math.PI/180),g=9.80665;
  const t=(vy+Math.sqrt(vy*vy+2*g*.9))/g;const pts=simulate({exitVeloMph:mph,launchDeg:deg,sprayDeg:0,backspinRpm:0},{rho:0,cd:0});
  assert.ok(Math.abs(pts.at(-1).t-t)<1e-5);assert.ok(Math.abs(pts.at(-1).z-vx*t)<.001);
});
test('parameter sweep produces finite positions, a ground endpoint, and consistent contact', () => {
  for (const exitVeloMph of [60,90,120]) for (const launchDeg of [-10,0,15,30,55,80]) for (const sprayDeg of [-45,-30,0,30,45]) for (const backspinRpm of [0,2200,4000]) {
    const pts=simulate({exitVeloMph,launchDeg,sprayDeg,backspinRpm}); const result=classify(pts,segments);
    assert.equal(pts.at(-1).y,0); assert.ok(pts.every(p=>Object.values(p).every(Number.isFinite)));
    if(result.crossing){const w=wallAt(segments,-sprayDeg);assert.ok(Math.abs(Math.hypot(result.crossing.x,result.crossing.z)-w.distM)<1e-6);}
    const visible=visibleTrajectory(pts,result);assert.equal(visible.at(-1).t,result.outcome==='off_wall'?result.crossing.t:pts.at(-1).t);
  }
});

test('spray direction matches the batter view: negative left, positive right', () => {
  const base={exitVeloMph:100,launchDeg:28,backspinRpm:2200};
  assert.ok(simulate({...base,sprayDeg:-30}).at(-1).x>0);
  assert.ok(simulate({...base,sprayDeg:30}).at(-1).x<0);
  assert.equal(simulate({...base,sprayDeg:0}).at(-1).x,0);
});
