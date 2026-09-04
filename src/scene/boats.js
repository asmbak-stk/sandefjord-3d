import * as THREE from "three";
import {
  extrudeFootprint,
  mergeAndDispose,
  pointInPolygon,
  polygonBBox,
  distanceToPolygonEdge,
} from "../utils/geometry.js";
import { mulberry32 } from "../utils/random.js";

const WATER_Y = 0.24; // just above the water mesh (y = 0.2)
const MIN_HARBOR_AREA = 3000; // skip small decorative ponds
const SHORE_BAND = 55; // boats cluster within this distance of shore/piers
const MIN_SPACING = 11;
const HULL_COLORS = [0xf2efe6, 0xd6cfbd, 0x8a3b30, 0x2c4a63, 0xcbcbc7];
const CABIN_COLOR = 0xe9e6dc;

function boatFootprint(length, beam) {
  const hl = length / 2;
  const hb = beam / 2;
  return [
    [0, hl],
    [hb, hl * 0.3],
    [hb, -hl * 0.6],
    [hb * 0.7, -hl],
    [-hb * 0.7, -hl],
    [-hb, -hl * 0.6],
    [-hb, hl * 0.3],
  ];
}

export function buildBoats(waterPolys, seed = 705920) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = "boats";

  const harbors = waterPolys.filter((w) => w.area > MIN_HARBOR_AREA);
  if (harbors.length === 0) return group;

  const placed = [];
  const hullBuckets = HULL_COLORS.map(() => []);
  const cabinGeoms = [];

  for (const harbor of harbors) {
    const rings = [harbor.exterior, ...(harbor.holes ?? [])];
    const [minX, minZ, maxX, maxZ] = polygonBBox(harbor.exterior);
    const targetCount = THREE.MathUtils.clamp(Math.round(harbor.area / 12000), 6, 40);

    let attempts = 0;
    let count = 0;
    while (count < targetCount && attempts < targetCount * 40 + 60) {
      attempts++;
      const x = minX + rng() * (maxX - minX);
      const z = minZ + rng() * (maxZ - minZ);
      if (!pointInPolygon(x, z, harbor.exterior, harbor.holes)) continue;
      if (distanceToPolygonEdge(x, z, rings) > SHORE_BAND) continue;
      if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < MIN_SPACING)) continue;

      const length = 4 + rng() * 5.5;
      const beam = length * (0.3 + rng() * 0.08);
      const freeboard = 0.75 + rng() * 0.65;
      const theta = rng() * Math.PI * 2;

      const hull = extrudeFootprint(boatFootprint(length, beam), [], freeboard);
      hull.rotateY(theta);
      hull.translate(x, WATER_Y, z);
      hullBuckets[Math.floor(rng() * HULL_COLORS.length)].push(hull);

      if (rng() < 0.45) {
        const cabinLength = length * 0.32;
        const cabinHeight = freeboard * 0.9;
        const cabin = new THREE.BoxGeometry(beam * 0.85, cabinHeight, cabinLength);
        cabin.translate(0, freeboard / 2 + cabinHeight / 2, -length * 0.1);
        cabin.rotateY(theta);
        cabin.translate(x, WATER_Y, z);
        cabinGeoms.push(cabin);
      }

      placed.push([x, z]);
      count++;
    }
  }

  hullBuckets.forEach((geoms, i) => {
    const merged = mergeAndDispose(geoms);
    if (!merged) return;
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ color: HULL_COLORS[i], roughness: 0.55, metalness: 0.05 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  const cabinMerged = mergeAndDispose(cabinGeoms);
  if (cabinMerged) {
    const mesh = new THREE.Mesh(
      cabinMerged,
      new THREE.MeshStandardMaterial({ color: CABIN_COLOR, roughness: 0.7 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}
