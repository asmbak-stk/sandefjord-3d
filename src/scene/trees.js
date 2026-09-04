import * as THREE from "three";
import { mergeAndDispose, pointInPolygon, polygonArea, polygonBBox } from "../utils/geometry.js";
import { mulberry32 } from "../utils/random.js";

// Trees per square metre, tuned per green-area kind so wood reads as dense
// forest, park/grass as scattered shade trees, and parking lots stay empty.
const DENSITY = { wood: 1 / 90, park: 1 / 220, grass: 1 / 300 };
const FOLIAGE_COLORS = [0x3d6b35, 0x4f7a3f, 0x2f5730];

function makeTemplates() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6);
  trunk.translate(0, 0.8, 0);
  const foliage = new THREE.ConeGeometry(1.5, 3.4, 7);
  foliage.translate(0, 1.6 + 1.5, 0);
  return { trunk, foliage };
}

export function buildTrees(green, seed = 20260816) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = "trees";
  const { trunk: trunkTpl, foliage: foliageTpl } = makeTemplates();

  const trunkGeoms = [];
  const foliageBuckets = FOLIAGE_COLORS.map(() => []);

  for (const area of green) {
    const density = DENSITY[area.kind];
    if (!density) continue;
    const poly = area.footprint;
    if (poly.length < 3) continue;

    const target = polygonArea(poly) * density;
    const count = Math.floor(target) + (rng() < target % 1 ? 1 : 0);
    if (count === 0) continue;

    const [minX, minZ, maxX, maxZ] = polygonBBox(poly);
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 15 + 20) {
      attempts++;
      const x = minX + rng() * (maxX - minX);
      const z = minZ + rng() * (maxZ - minZ);
      if (!pointInPolygon(x, z, poly)) continue;

      const scale = 0.7 + rng() * 0.7;
      const rot = rng() * Math.PI * 2;

      const t = trunkTpl.clone();
      t.scale(scale, scale, scale);
      t.rotateY(rot);
      t.translate(x, 0, z);
      trunkGeoms.push(t);

      const f = foliageTpl.clone();
      f.scale(scale, scale * (0.85 + rng() * 0.3), scale);
      f.rotateY(rot);
      f.translate(x, 0, z);
      foliageBuckets[Math.floor(rng() * FOLIAGE_COLORS.length)].push(f);

      placed++;
    }
  }

  trunkTpl.dispose();
  foliageTpl.dispose();

  const trunkMerged = mergeAndDispose(trunkGeoms);
  if (trunkMerged) {
    const mesh = new THREE.Mesh(
      trunkMerged,
      new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  foliageBuckets.forEach((geoms, i) => {
    const merged = mergeAndDispose(geoms);
    if (!merged) return;
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ color: FOLIAGE_COLORS[i], roughness: 0.9 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  return group;
}
