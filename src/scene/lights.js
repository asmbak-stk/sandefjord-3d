import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";

const SUN_POSITION = new THREE.Vector3(-380, 520, 260);

export function setupLighting(scene, renderer) {
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a4736, 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sun.position.copy(SUN_POSITION);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -750;
  sun.shadow.camera.right = 750;
  sun.shadow.camera.top = 750;
  sun.shadow.camera.bottom = -750;
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 1400;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  scene.fog = new THREE.Fog(0xcfe1ee, 650, 2100);

  const sky = new Sky();
  sky.scale.setScalar(9000);
  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = 3.2;
  uniforms.rayleigh.value = 1.4;
  uniforms.mieCoefficient.value = 0.004;
  uniforms.mieDirectionalG.value = 0.8;
  uniforms.sunPosition.value.copy(SUN_POSITION).normalize();
  scene.add(sky);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return { sun };
}
