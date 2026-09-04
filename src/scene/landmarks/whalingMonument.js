import * as THREE from "three";
import { createWaterMaterial } from "../water.js";

const BRONZE = 0x4f6a52;
const STONE = 0xb2ab9b;
const GRANITE = 0x53524b;

function buildWhale(scale = 1) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: BRONZE,
    roughness: 0.35,
    metalness: 0.65,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 3.6, 5, 10), bodyMat);
  body.castShadow = true;
  group.add(body);

  const fluke = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 1.0), bodyMat);
  fluke.position.y = -(3.6 / 2 + 0.85) + 0.15;
  fluke.rotation.x = THREE.MathUtils.degToRad(14);
  fluke.castShadow = true;
  group.add(fluke);

  const finGeom = new THREE.ConeGeometry(0.45, 1.3, 3);
  const finL = new THREE.Mesh(finGeom, bodyMat);
  finL.position.set(0.85, 0.2, 0);
  finL.rotation.z = THREE.MathUtils.degToRad(-70);
  finL.castShadow = true;
  group.add(finL);

  group.scale.setScalar(scale);
  return group;
}

// The famous rotating bronze whale fountain by the harbour (Knut Steen, 1960) —
// stylised here as a spiralling cluster of leaping whale forms on a granite
// pedestal set inside a circular fountain basin. Highest-priority landmark.
export function buildWhalingMonument() {
  const root = new THREE.Group();
  root.name = "hvalfangstmonumentet";

  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9.6, 0.7, 48),
    new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.9 })
  );
  basin.position.y = 0.35;
  basin.castShadow = false;
  basin.receiveShadow = true;
  root.add(basin);

  const waterMat = createWaterMaterial();
  waterMat.uniforms.uDeepColor.value = new THREE.Color(0x1c5266);
  waterMat.uniforms.uShallowColor.value = new THREE.Color(0x6fb9cf);
  const water = new THREE.Mesh(new THREE.CircleGeometry(8.3, 48), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.58;
  root.add(water);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.8, 2.2, 24),
    new THREE.MeshStandardMaterial({ color: GRANITE, roughness: 0.8 })
  );
  pedestal.position.y = 1.1 + 0.35;
  pedestal.castShadow = true;
  root.add(pedestal);

  const whalesPivot = new THREE.Group();
  whalesPivot.position.y = 2.6;
  root.add(whalesPivot);

  const whaleCount = 3;
  for (let i = 0; i < whaleCount; i++) {
    const angle = (i / whaleCount) * Math.PI * 2;
    const tilt = THREE.MathUtils.degToRad(38 + i * 14);

    const spin = new THREE.Group();
    spin.rotation.y = angle;
    whalesPivot.add(spin);

    const lean = new THREE.Group();
    lean.rotation.z = tilt;
    lean.position.set(1.1, i * 1.1, 0);
    spin.add(lean);

    const whale = buildWhale(0.85 - i * 0.08);
    whale.position.y = 2.0 + i * 0.3;
    lean.add(whale);
  }

  const accentLight = new THREE.PointLight(0xffe3b0, 30, 40, 2);
  accentLight.position.set(0, 9, 0);
  root.add(accentLight);

  return { group: root, rotatingPart: whalesPivot, waterMaterial: waterMat };
}
