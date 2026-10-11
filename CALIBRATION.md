# Model calibration

## Source and method

The source is the original `public/yankee-stadium.glb`. Its bytes are unchanged.

1. Load each GLB mesh and apply its stored node matrix.
2. Recover the planar UV-to-world mapping of the field mesh `empty_1182`.
3. Use approximate centers of the home-plate tarp `(102, 524)` and pitcher's-mound tarp `(208, 494)` in the 844 × 811 field texture. The home point defines the origin; home-to-mound defines +Z. Its length is scaled to the 60.5 ft pitching distance.
4. Translate the field plane to y=0. Under the old application transform, that plane was y=2.348267 m, above the old batter camera.
5. Extract the field mesh's exterior triangle edges in the outfield (both endpoints beyond z=60 m). These form 40 segments.
6. Estimate top heights at those endpoints from nearby fence/base/ad mesh edges, within 0.4 m in plan view. Selected mesh names are retained in the generator. Heights are linearly interpolated along each segment. This tolerance handles offset wall surfaces but makes heights approximate near seams or abrupt height changes.
7. Store this geometry and the model transform together in `model-boundary.json`. Runtime uses them for both classification and the optional visible overlay. Remove the independently constructed old wall panels.

## Reproduce

```bash
python -m pip install numpy
python scripts/calibrate_model.py
npm test
```

The generator accepts the specific supplied asset structure (matrix transforms, field mesh, material names, UV layout). A different GLB requires selecting and validating its landmarks and meshes again.

## Corrected distances (revision 4)

The raw boundary still measures roughly 419 ft to center. It remains in
`model-boundary.json` as reproducible source data, not the runtime wall.
`outfield-calibration.ts` builds the corrected boundary and exports the same
point mapping used by `Yankee-stadium.tsx` for the visible model.

Published anchor distances: LF 318 ft, left-center 399 ft, center 408 ft,
right-center 385 ft, RF 314 ft.
Source: https://www.mlb.com/news/featured/yankee-stadium-guide-capacity-seating-chart-parking-and-more

Home is the origin; geometry +X is left field. The foul lines are ±45° and
center is 0°. The gap anchors use ±22.5° as an explicit modeling assumption;
the source does NOT provide surveyed marker bearings. Straight wall spans
between these five anchors are an approximation, not an exact current-stadium
survey. Wall heights retain the source asset's approximate measured heights.
The historical architecture and signs are also retained.

The correction changes horizontal radius only. It is zero inside 45 m of home
(preserving the mound and entire infield), smoothly reaches its full displacement
at 85 m, and stays constant beyond that to preserve the depth of the stands.
Outside the foul lines it smoothly fades to zero at ±75°. Heights and ball
physics are unchanged. Fair-direction wall radii follow the five-anchor polygon,
so the corrected model has a maximum wall radius of 408 ft.

At load time model transforms are baked into cloned geometry. Long triangles
are subdivided before deformation so large field and wall faces follow the
correction, then bounds and normals are rebuilt and meshes merged by material.
The GLB file itself is unchanged. Finite triangles approximate the continuous
mapping; small offsets at seams and nearby wall surfaces can remain, especially
where the original asset's wall does not exactly follow its field outline.

The collision boundary includes the target corners, original height corners,
and samples every quarter degree. Tests verify the published anchor distances,
agreement of corrected field-boundary points with collision radii throughout
the fair sector, unchanged infield landmarks, and no radial folds.
Enable **Spin & display options → Show wall boundary** to inspect the overlay.

The physics classifier intersects the sampled ball path with the boundary at the geometry angle (the negative of the UI spray angle, so positive UI spray travels screen-right from the batter view) and interpolates crossing time/height. Pure backspin without lateral forces keeps the horizontal heading constant, so this is appropriate for the current model. If wind or sidespin is added, classification must instead intersect each path segment with the wall segments.

A hit clears only when the bottom of the physical ball is above the wall. Off-wall playback ends with the center at the boundary; rebound dynamics and a full swept-sphere wall contact calculation are not modeled.
