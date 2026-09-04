import * as THREE from "three";
import { flatShapeGeometry, mergeAndDispose } from "../utils/geometry.js";

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec3 pos = position;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);

    float wave =
      sin(worldPos.x * 0.045 + uTime * 1.1) * 0.09 +
      sin(worldPos.z * 0.07 - uTime * 0.8) * 0.07 +
      sin((worldPos.x + worldPos.z) * 0.02 + uTime * 0.35) * 0.05;
    pos.y += wave;

    float dx =
      cos(worldPos.x * 0.045 + uTime * 1.1) * 0.045 * 0.09 +
      cos((worldPos.x + worldPos.z) * 0.02 + uTime * 0.35) * 0.02 * 0.05;
    float dz =
      cos(worldPos.z * 0.07 - uTime * 0.8) * 0.07 * 0.07 +
      cos((worldPos.x + worldPos.z) * 0.02 + uTime * 0.35) * 0.02 * 0.05;
    vNormal = normalize(vec3(-dx, 1.0, -dz));

    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSunDirection;
  uniform vec3 uCameraPos;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    vec3 n = normalize(vNormal);

    float fresnel = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 3.0);
    vec3 base = mix(uDeepColor, uShallowColor, fresnel * 0.7);

    vec3 halfDir = normalize(uSunDirection + viewDir);
    float spec = pow(clamp(dot(n, halfDir), 0.0, 1.0), 70.0) * 0.9;

    vec3 color = base + spec * vec3(1.0, 0.98, 0.9);
    gl_FragColor = vec4(color, 0.92);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createWaterMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color(0x0e3c4d) },
      uShallowColor: { value: new THREE.Color(0x5fa8bd) },
      uSunDirection: { value: new THREE.Vector3(-380, 520, 260).normalize() },
      uCameraPos: { value: new THREE.Vector3() },
    },
  });
}

export function buildWater(waterPolys, y = 0.2) {
  const geometries = waterPolys
    .filter((w) => w.area > 3)
    .map((w) => flatShapeGeometry(w.exterior, w.holes, y));
  const merged = mergeAndDispose(geometries);
  if (!merged) return null;

  const material = createWaterMaterial();
  const mesh = new THREE.Mesh(merged, material);
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  return mesh;
}
