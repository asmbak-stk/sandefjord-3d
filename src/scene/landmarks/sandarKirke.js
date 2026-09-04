import * as THREE from "three";
import { extrudeFootprint } from "../../utils/geometry.js";

const STONE = 0xe9e2d0;
const ROOF = 0x3c3d44;

// Sandar kirke: the OSM footprint gives the nave, we add a tower + pyramidal
// spire at one corner to make the church tower recognisable from a distance.
export function buildSandarKirke(building) {
  const group = new THREE.Group();
  group.name = "sandarKirke";

  const naveHeight = Math.max(building.height, 12);
  const naveGeom = extrudeFootprint(building.footprint, building.holes, naveHeight);
  const nave = new THREE.Mesh(
    naveGeom,
    new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.85 })
  );
  nave.castShadow = true;
  nave.receiveShadow = true;
  group.add(nave);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of building.footprint) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const towerX = minX + (maxX - minX) * 0.18;
  const towerZ = minZ + (maxZ - minZ) * 0.18;

  const towerSize = 8;
  const towerHeight = 34;
  const towerGeom = new THREE.BoxGeometry(towerSize, towerHeight, towerSize);
  const tower = new THREE.Mesh(
    towerGeom,
    new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.85 })
  );
  tower.position.set(towerX, towerHeight / 2, towerZ);
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const spireHeight = 12;
  const spireGeom = new THREE.ConeGeometry(towerSize * 0.78, spireHeight, 4);
  spireGeom.rotateY(Math.PI / 4);
  const spire = new THREE.Mesh(
    spireGeom,
    new THREE.MeshStandardMaterial({ color: ROOF, roughness: 0.5, metalness: 0.15 })
  );
  spire.position.set(towerX, towerHeight + spireHeight / 2, towerZ);
  spire.castShadow = true;
  group.add(spire);

  const cross = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: 0xcfae5a, metalness: 0.6, roughness: 0.3 })
  );
  cross.position.set(towerX, towerHeight + spireHeight + 1.1, towerZ);
  cross.castShadow = true;
  group.add(cross);
  const crossBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 1.1, 6),
    cross.material
  );
  crossBar.rotation.z = Math.PI / 2;
  crossBar.position.set(towerX, towerHeight + spireHeight + 1.6, towerZ);
  group.add(crossBar);

  return group;
}
