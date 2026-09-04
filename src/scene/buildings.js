import * as THREE from "three";
import { extrudeFootprint, mergeAndDispose, centroid, distance2D } from "../utils/geometry.js";
import { buildSandarKirke } from "./landmarks/sandarKirke.js";

const CATEGORY_COLORS = {
  house: 0xd9c9a6,
  semidetached_house: 0xd9c9a6,
  terrace: 0xd2c3a0,
  bungalow: 0xd9c9a6,
  residential: 0xc9c2b6,
  apartments: 0xbfc4c9,
  civic: 0xb7bec2,
  hospital: 0xb7bec2,
  school: 0xc7c0af,
  kindergarten: 0xc9be9f,
  sports_centre: 0xafb6ad,
  fire_station: 0xafb6ad,
  train_station: 0xafb6ad,
  transportation: 0xafb6ad,
  office: 0xc4b696,
  retail: 0xcdbd9c,
  commercial: 0xcdbd9c,
  kiosk: 0xcdbd9c,
  industrial: 0x8d8c85,
  warehouse: 0x8d8c85,
  service: 0x8d8c85,
  container: 0x7d7c76,
  roof: 0x9a978c,
  garage: 0x6f6f6a,
  garages: 0x6f6f6a,
  shed: 0x6f6f6a,
  parking: 0x6f6f6a,
  boathouse: 0x6a5f52,
  ship: 0x556066,
  church: 0xe6e0d2,
  chapel: 0xe6e0d2,
  religious: 0xe6e0d2,
  hotel: 0xc79a5f,
  yes: 0xcabfa6,
};

const DEFAULT_COLOR = 0xcabfa6;

function findNearestBuilding(buildings, target, maxDist) {
  let best = null;
  let bestDist = Infinity;
  for (const b of buildings) {
    const [cx, cz] = centroid(b.footprint);
    const d = distance2D(cx, cz, target.x, target.z);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return bestDist <= maxDist ? best : null;
}

function buildCategoryMeshes(buildings) {
  const buckets = new Map();
  for (const b of buildings) {
    const color = CATEGORY_COLORS[b.category] ?? DEFAULT_COLOR;
    if (!buckets.has(color)) buckets.set(color, []);
    try {
      buckets.get(color).push(extrudeFootprint(b.footprint, b.holes, b.height));
    } catch {
      // skip malformed footprint
    }
  }

  const group = new THREE.Group();
  group.name = "buildings";
  for (const [color, geoms] of buckets) {
    const merged = mergeAndDispose(geoms);
    if (!merged) continue;
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function buildHighlightMesh(building, color, options = {}) {
  const height = options.heightOverride ?? building.height + (options.extraHeight ?? 0);
  const geometry = extrudeFootprint(building.footprint, building.holes, height);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.6,
    metalness: options.metalness ?? 0.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Finds & extracts the buildings nearest the church / museum / hotel landmarks
// so they can be rendered with distinct materials (and, for the church, an
// added tower+spire) instead of disappearing into the bulk category meshes.
export function buildCityBuildings(data) {
  const group = new THREE.Group();
  group.name = "city";
  const landmarkMeshes = [];
  const remaining = [...data.buildings];

  const pluck = (key, maxDist) => {
    const target = data.landmarks[key];
    const found = findNearestBuilding(remaining, target, maxDist);
    if (found) {
      const idx = remaining.indexOf(found);
      remaining.splice(idx, 1);
    }
    return found;
  };

  const churchBuilding = pluck("sandarKirke", 70);
  const museumBuilding = pluck("hvalfangstmuseet", 60);
  const hotelBuilding = pluck("scandicPark", 60);

  // Labels are positioned from the building's own footprint centroid (in
  // absolute world XZ) rather than parented to the mesh, since the extruded
  // geometry already bakes in absolute coordinates and the mesh transform
  // itself stays at the origin.
  if (churchBuilding) {
    const churchGroup = buildSandarKirke(churchBuilding);
    group.add(churchGroup);
    const [cx, cz] = centroid(churchBuilding.footprint);
    landmarkMeshes.push({ name: "Sandar kirke", x: cx, z: cz, height: 50 });
  }

  if (museumBuilding) {
    const mesh = buildHighlightMesh(museumBuilding, 0xa85c3b, { extraHeight: 1.5, roughness: 0.75 });
    group.add(mesh);
    const [cx, cz] = centroid(museumBuilding.footprint);
    landmarkMeshes.push({ name: "Hvalfangstmuseet", x: cx, z: cz, height: museumBuilding.height + 1.5 + 6 });
  }

  if (hotelBuilding) {
    // OSM has no height/levels tag for this building, and the generic
    // "hotel" default (20 m) undershoots reality: Scandic Park Sandefjord
    // is an 8-storey 1960 tower (architect Arnstein Arneberg) — roughly 29 m.
    const HOTEL_HEIGHT = 29;
    const mesh = buildHighlightMesh(hotelBuilding, 0x7f97a3, {
      heightOverride: HOTEL_HEIGHT,
      metalness: 0.35,
      roughness: 0.35,
    });
    group.add(mesh);
    const [cx, cz] = centroid(hotelBuilding.footprint);
    landmarkMeshes.push({ name: "Scandic Park Hotel", x: cx, z: cz, height: HOTEL_HEIGHT + 6 });
  }

  group.add(buildCategoryMeshes(remaining));

  return { group, landmarkMeshes };
}
