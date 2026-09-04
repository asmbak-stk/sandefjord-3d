import * as THREE from "three";
import { ribbonGeometry, mergeAndDispose } from "../utils/geometry.js";

const BALLAST_Y = 0.11;
const RAIL_Y = 0.18;
const GAUGE = 0.72; // offset of each rail from the track centreline

export function buildRail(rail) {
  const group = new THREE.Group();
  group.name = "rail";
  if (!rail || rail.length === 0) return group;

  const ballastGeoms = [];
  const railGeoms = [];

  for (const track of rail) {
    const pts = track.points;
    if (pts.length < 2) continue;

    const ballast = ribbonGeometry(pts, 4.2, BALLAST_Y);
    if (ballast) ballastGeoms.push(ballast);

    const leftRail = pts.map(([x, z], i) => offsetPoint(pts, i, GAUGE));
    const rightRail = pts.map(([x, z], i) => offsetPoint(pts, i, -GAUGE));
    const rl = ribbonGeometry(leftRail, 0.12, RAIL_Y);
    const rr = ribbonGeometry(rightRail, 0.12, RAIL_Y);
    if (rl) railGeoms.push(rl);
    if (rr) railGeoms.push(rr);
  }

  const ballastMerged = mergeAndDispose(ballastGeoms);
  if (ballastMerged) {
    const mesh = new THREE.Mesh(
      ballastMerged,
      new THREE.MeshStandardMaterial({
        color: 0x6b6357,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const railMerged = mergeAndDispose(railGeoms);
  if (railMerged) {
    const mesh = new THREE.Mesh(
      railMerged,
      new THREE.MeshStandardMaterial({ color: 0x8b8d90, roughness: 0.4, metalness: 0.7 })
    );
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}

function offsetPoint(points, i, offset) {
  const [x, z] = points[i];
  let dx, dz;
  if (i === 0) {
    dx = points[i + 1][0] - x;
    dz = points[i + 1][1] - z;
  } else if (i === points.length - 1) {
    dx = x - points[i - 1][0];
    dz = z - points[i - 1][1];
  } else {
    dx = points[i + 1][0] - points[i - 1][0];
    dz = points[i + 1][1] - points[i - 1][1];
  }
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  return [x + nx * offset, z + nz * offset];
}
