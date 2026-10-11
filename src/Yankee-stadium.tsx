import { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { Group, Mesh, Matrix4, Quaternion, Vector3, Euler } from 'three';
import type { BufferGeometry, Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODEL_TRANSFORM, warpStadiumPoint } from './physics/stadiums/yankee';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
export function Model() {
  const { scene } = useGLTF('/yankee-stadium.glb');
  const merged = useMemo(() => {
    scene.updateMatrixWorld(true);
    const world = new Matrix4().compose(
      new Vector3(...MODEL_TRANSFORM.position),
      new Quaternion().setFromEuler(new Euler(0, MODEL_TRANSFORM.rotationY, 0)),
      new Vector3().setScalar(MODEL_TRANSFORM.scale),
    );
    // Small triangles let the field and long wall faces follow the nonlinear warp.
    const tessellator = new TessellateModifier(3, 10);
    const buckets = new Map<string, { material: Material; geometries: BufferGeometry[] }>();
    scene.traverse(object => {
      if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
      const original = object.geometry.clone().applyMatrix4(object.matrixWorld).applyMatrix4(world);
      const geometry = tessellator.modify(original);
      original.dispose();
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const p = warpStadiumPoint(positions.getX(i), positions.getY(i), positions.getZ(i));
        positions.setXYZ(i, ...p);
      }
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const key = object.material.uuid + Object.keys(geometry.attributes).sort().join(',');
      let bucket = buckets.get(key);
      if (!bucket) { bucket = { material: object.material, geometries: [] }; buckets.set(key, bucket); }
      bucket.geometries.push(geometry);
    });
    const group = new Group();
    for (const { material, geometries } of buckets.values()) {
      const geometry = mergeGeometries(geometries, false);
      if (geometry) group.add(new Mesh(geometry, material));
      else for (const g of geometries) group.add(new Mesh(g.clone(), material));
      geometries.forEach(g => g.dispose());
    }
    return group;
  }, [scene]);
  useEffect(() => () => merged.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); }), [merged]);
  return <primitive object={merged} dispose={null} />;
}
useGLTF.preload('/yankee-stadium.glb');
