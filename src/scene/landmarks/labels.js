import * as THREE from "three";

function makeLabelTexture(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const fontSize = 46;
  ctx.font = `600 ${fontSize}px -apple-system, Segoe UI, Roboto, sans-serif`;
  const padding = 24;
  const width = Math.ceil(ctx.measureText(text).width) + padding * 2;
  const height = fontSize + padding * 1.3;
  canvas.width = width;
  canvas.height = height;

  ctx.font = `600 ${fontSize}px -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.fillStyle = "rgba(12, 18, 22, 0.72)";
  const r = 16;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(width, 0, width, height, r);
  ctx.arcTo(width, height, 0, height, r);
  ctx.arcTo(0, height, 0, 0, r);
  ctx.arcTo(0, 0, width, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f4f7f8";
  ctx.textBaseline = "middle";
  ctx.fillText(text, padding, height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: width / height };
}

export function createLabel(text, worldY) {
  const { texture, aspect } = makeLabelTexture(text);
  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: true,
    depthWrite: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  const height = 6.5;
  sprite.scale.set(height * aspect, height, 1);
  sprite.position.y = worldY;
  sprite.renderOrder = 10;
  return sprite;
}
