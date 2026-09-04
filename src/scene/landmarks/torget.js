import * as THREE from "three";

// Torget has no OSM building footprint — it's an open square — so we hand
// place a paved plaza with a small fountain/flagpole accent to mark it.
export function buildTorget(x, z) {
  const group = new THREE.Group();
  group.name = "torget";
  group.position.set(x, 0, z);

  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(26, 40),
    new THREE.MeshStandardMaterial({ color: 0xb7ac97, roughness: 0.95 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  group.add(plaza);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(6.5, 7.3, 32),
    new THREE.MeshStandardMaterial({ color: 0x8f8367, roughness: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 11, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.4, roughness: 0.4 })
  );
  pole.position.y = 5.5;
  pole.castShadow = true;
  group.add(pole);

  return group;
}
