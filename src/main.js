import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { setupLighting } from "./scene/lights.js";
import { buildGround } from "./scene/ground.js";
import { buildWater } from "./scene/water.js";
import { buildRoads } from "./scene/roads.js";
import { buildRail } from "./scene/rail.js";
import { buildGreen } from "./scene/green.js";
import { buildCityBuildings } from "./scene/buildings.js";
import { buildRoofs } from "./scene/roofs.js";
import { buildTrees } from "./scene/trees.js";
import { buildBoats } from "./scene/boats.js";
import { buildWhalingMonument } from "./scene/landmarks/whalingMonument.js";
import { buildTorget } from "./scene/landmarks/torget.js";
import { createLabel } from "./scene/landmarks/labels.js";

const container = document.getElementById("app");
const loadingEl = document.getElementById("loading");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  48,
  window.innerWidth / window.innerHeight,
  3,
  2500
);
camera.position.set(230, 165, 340);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const { sun } = setupLighting(scene, renderer);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 12, -60);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 25;
controls.maxDistance = 1600;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();

scene.add(buildGround());

const clock = new THREE.Clock();
let waterMeshMaterial = null;
let monumentRotor = null;
let monumentWaterMat = null;

async function init() {
  const res = await fetch("/data/sandefjord.json");
  const data = await res.json();

  const water = buildWater(data.water);
  if (water) {
    waterMeshMaterial = water.material;
    scene.add(water);
  }

  scene.add(buildRoads(data.roads));
  scene.add(buildRail(data.rail));
  scene.add(buildGreen(data.green));
  scene.add(buildTrees(data.green));
  scene.add(buildBoats(data.water));

  const { group: cityGroup, landmarkMeshes } = buildCityBuildings(data);
  scene.add(cityGroup);
  scene.add(buildRoofs(data.buildings));

  for (const lm of landmarkMeshes) {
    const label = createLabel(lm.name, lm.height);
    label.position.x = lm.x;
    label.position.z = lm.z;
    scene.add(label);
  }

  const torget = data.landmarks.torget;
  const torgetGroup = buildTorget(torget.x, torget.z);
  torgetGroup.add(createLabel("Torget", 8));
  scene.add(torgetGroup);

  const monument = buildWhalingMonument();
  monumentRotor = monument.rotatingPart;
  monumentWaterMat = monument.waterMaterial;
  monument.group.add(createLabel("Hvalfangstmonumentet", 16));
  scene.add(monument.group);

  loadingEl.classList.add("hidden");
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  if (waterMeshMaterial) {
    waterMeshMaterial.uniforms.uTime.value = t;
    waterMeshMaterial.uniforms.uCameraPos.value.copy(camera.position);
  }
  if (monumentWaterMat) {
    monumentWaterMat.uniforms.uTime.value = t;
    monumentWaterMat.uniforms.uCameraPos.value.copy(camera.position);
  }
  if (monumentRotor) {
    monumentRotor.rotation.y = t * 0.18;
  }

  controls.update();
  renderer.render(scene, camera);
}

init();
animate();
