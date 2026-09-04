import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Footprint points are [x, z] in world meters (x = east, z = south).
// We build the Shape in (x, -z) so that after rotateX(-PI/2) the extrusion
// lands with +Y = up and world Z matching the source footprint (no mirroring).
export function shapeFromFootprint(footprint, holes = []) {
  const shape = new THREE.Shape();
  footprint.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });

  for (const hole of holes) {
    if (hole.length < 3) continue;
    const path = new THREE.Path();
    hole.forEach(([x, z], i) => {
      if (i === 0) path.moveTo(x, -z);
      else path.lineTo(x, -z);
    });
    shape.holes.push(path);
  }

  return shape;
}

export function extrudeFootprint(footprint, holes, height) {
  const shape = shapeFromFootprint(footprint, holes);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function flatShapeGeometry(footprint, holes = [], y = 0) {
  const shape = shapeFromFootprint(footprint, holes);
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

export function mergeAndDispose(geometries) {
  if (geometries.length === 0) return null;
  const merged = mergeGeometries(geometries, false);
  geometries.forEach((g) => g.dispose());
  return merged;
}

export function centroid(points) {
  let x = 0;
  let z = 0;
  for (const [px, pz] of points) {
    x += px;
    z += pz;
  }
  return [x / points.length, z / points.length];
}

export function distance2D(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export function polygonArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[(i + 1) % points.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

export function polygonBBox(points) {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return [minX, minZ, maxX, maxZ];
}

// Ray-casting point-in-polygon test (XZ plane). `holes` is an array of rings;
// a point inside any hole counts as outside the polygon.
export function pointInPolygon(x, z, exterior, holes = []) {
  if (!inRing(x, z, exterior)) return false;
  for (const hole of holes) {
    if (inRing(x, z, hole)) return false;
  }
  return true;
}

function inRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    const intersects =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointToSegmentDist(x, z, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 0 ? ((x - x1) * dx + (z - z1) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz));
}

// Minimum distance from a point to any edge of the given rings (exterior +
// holes), used to bias placement toward shorelines/pier edges.
export function distanceToPolygonEdge(x, z, rings) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x1, z1] = ring[i];
      const [x2, z2] = ring[(i + 1) % ring.length];
      const d = pointToSegmentDist(x, z, x1, z1, x2, z2);
      if (d < best) best = d;
    }
  }
  return best;
}

// Ribbon quad strip for a polyline with the given width, flat on XZ at height y.
export function ribbonGeometry(points, width, y = 0) {
  if (points.length < 2) return null;
  const positions = [];
  const indices = [];
  const half = width / 2;
  const left = [];
  const right = [];

  for (let i = 0; i < points.length; i++) {
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
    left.push([x + nx * half, z + nz * half]);
    right.push([x - nx * half, z - nz * half]);
  }

  for (let i = 0; i < points.length; i++) {
    positions.push(left[i][0], y, left[i][1]);
    positions.push(right[i][0], y, right[i][1]);
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = i * 2 + 2;
    const d = i * 2 + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
