import data from './model-boundary.json';
import type { WallSegment } from '../physics';
import { createOutfieldCalibration } from './outfield-calibration';

// Original measurements are retained so calibration is reproducible. The same
// correction is applied to rendered model vertices and classification boundaries.
const calibration = createOutfieldCalibration(data.segments as WallSegment[]);
export const YANKEE_WALL = calibration.segments;
export const warpStadiumPoint = calibration.warp;
export const MODEL_TRANSFORM = data.transform;
