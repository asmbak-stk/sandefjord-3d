import * as THREE from "three";
import { flatShapeGeometry, mergeAndDispose } from "../utils/geometry.js";

const COLORS = {
  cemetery: 0x5f7a5b,
  forest: 0x3f5c3e,
  wood: 0x3f5c3e,
  park: 0x6f9364,
  grass: 0x77965f,
  recreation_ground: 0x77965f,
  parking: 0x4a4a4d,
};

export function buildGreen(green) {
  const group = new THREE.Group();
  group.name = "green";
  const buckets = new Map();

  for (const area of green) {
    const color = COLORS[area.kind] ?? 0x77965f;
    if (!buckets.has(color)) buckets.set(color, []);
    try {
      buckets.get(color).push(flatShapeGeometry(area.footprint, [], 0.05));
    } catch {
      // skip malformed footprint
    }
  }

  for (const [color, geoms] of buckets) {
    const merged = mergeAndDispose(geoms);
    if (!merged) continue;
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}
