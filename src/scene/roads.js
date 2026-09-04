import * as THREE from "three";
import { ribbonGeometry, mergeAndDispose } from "../utils/geometry.js";

const STREET_KINDS = new Set([
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
  "tertiary",
  "residential",
  "living_street",
  "service",
]);

// Layers sit several centimetres apart (not millimetres) and additionally
// use GPU polygon offset, since coplanar-ish decals on top of the ground
// plane are the classic z-fighting/flicker trap at city-block view distances.
const STREET_Y = 0.10;
const PATH_Y = 0.14;

export function buildRoads(roads) {
  const group = new THREE.Group();
  group.name = "roads";

  const streetGeoms = [];
  const pathGeoms = [];

  for (const road of roads) {
    const isStreet = STREET_KINDS.has(road.kind);
    const geom = ribbonGeometry(road.points, road.width, isStreet ? STREET_Y : PATH_Y);
    if (!geom) continue;
    if (isStreet) streetGeoms.push(geom);
    else pathGeoms.push(geom);
  }

  const streetMerged = mergeAndDispose(streetGeoms);
  if (streetMerged) {
    const mesh = new THREE.Mesh(
      streetMerged,
      new THREE.MeshStandardMaterial({
        color: 0x39383c,
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const pathMerged = mergeAndDispose(pathGeoms);
  if (pathMerged) {
    const mesh = new THREE.Mesh(
      pathMerged,
      new THREE.MeshStandardMaterial({
        color: 0xa89f8c,
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      })
    );
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}
