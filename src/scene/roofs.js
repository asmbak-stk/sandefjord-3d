import * as THREE from "three";
import { mergeAndDispose } from "../utils/geometry.js";

// Weathered red roof tile and dark slate/zinc — the two dominant Norwegian
// roof colours — alternated per building purely for visual variety (OSM has
// no roof:material data to draw the real split from).
const ROOF_COLORS = [0x7a3f34, 0x3f4247];

// Builds a simple gabled (ridge) roof prism sized to the building's oriented
// bounding box (roofOBB, precomputed in scripts/build_data.py). The OBB is
// slightly larger than the actual footprint, which conveniently produces a
// small eave overhang for free.
function buildOneRoof(building) {
  const { cx, cz, width, depth, angle } = building.roofOBB;
  const roofHeight = THREE.MathUtils.clamp(Math.min(width, depth) * 0.32, 1.3, 4.2);
  const baseY = building.height;
  const hw = width / 2;
  const hd = depth / 2;

  const local = {
    A: [-hw, 0, -hd],
    B: [hw, 0, -hd],
    C: [hw, 0, hd],
    D: [-hw, 0, hd],
    R1: [0, roofHeight, -hd],
    R2: [0, roofHeight, hd],
  };

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const world = {};
  for (const key in local) {
    const [x, y, z] = local[key];
    world[key] = [cx + x * cos - z * sin, baseY + y, cz + x * sin + z * cos];
  }

  // Outward-facing winding verified analytically per face (gable ends +
  // both roof slopes) — see conversation notes; do not reorder casually.
  const order = [
    "A", "R1", "B",
    "C", "R2", "D",
    "A", "D", "R2",
    "A", "R2", "R1",
    "B", "R1", "R2",
    "B", "R2", "C",
  ];

  const positions = new Float32Array(order.length * 3);
  order.forEach((key, i) => {
    const v = world[key];
    positions[i * 3] = v[0];
    positions[i * 3 + 1] = v[1];
    positions[i * 3 + 2] = v[2];
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildRoofs(buildings) {
  const group = new THREE.Group();
  group.name = "roofs";
  const buckets = [[], []];

  for (const b of buildings) {
    if (b.roofShape !== "gabled" || !b.roofOBB) continue;
    buckets[b.id % 2].push(buildOneRoof(b));
  }

  buckets.forEach((geoms, i) => {
    const merged = mergeAndDispose(geoms);
    if (!merged) return;
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ color: ROOF_COLORS[i], roughness: 0.8 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  return group;
}
