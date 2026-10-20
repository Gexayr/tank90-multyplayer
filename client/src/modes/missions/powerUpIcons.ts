import * as THREE from 'three';
import type { PowerUpType } from '@shared/missions-types';

/** What each bonus is called and does - shown in the legend and the pickup toast */
export const POWERUP_INFO: Record<PowerUpType, { label: string; effect: string; color: string }> = {
  star:   { label: 'STAR',   effect: 'Faster bullets',     color: '#FFD23F' },
  shield: { label: 'SHIELD', effect: 'Blocks one hit',     color: '#38BDF8' },
  speed:  { label: 'SPEED',  effect: 'Faster tank',        color: '#4ADE80' },
  life:   { label: 'LIFE',   effect: '+1 life',            color: '#F472B6' },
};

export const POWERUP_TYPES = Object.keys(POWERUP_INFO) as PowerUpType[];

const ICON_SIZE = 128;

function drawStar(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 38 : 16;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(64 + Math.cos(a) * r, 67 + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawShield(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(64, 26);
  ctx.lineTo(96, 38);
  ctx.quadraticCurveTo(96, 86, 64, 104);
  ctx.quadraticCurveTo(32, 86, 32, 38);
  ctx.closePath();
}

function drawBolt(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(72, 22);
  ctx.lineTo(38, 72);
  ctx.lineTo(62, 72);
  ctx.lineTo(54, 106);
  ctx.lineTo(90, 52);
  ctx.lineTo(66, 52);
  ctx.closePath();
}

function drawHeart(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(64, 102);
  ctx.bezierCurveTo(24, 76, 26, 36, 48, 34);
  ctx.bezierCurveTo(58, 33, 64, 42, 64, 48);
  ctx.bezierCurveTo(64, 42, 70, 33, 80, 34);
  ctx.bezierCurveTo(102, 36, 104, 76, 64, 102);
  ctx.closePath();
}

const SHAPES: Record<PowerUpType, (ctx: CanvasRenderingContext2D) => void> = {
  star: drawStar,
  shield: drawShield,
  speed: drawBolt,
  life: drawHeart,
};

/** Drawn with vector paths, not emoji, so it looks the same on every device */
function drawIcon(type: PowerUpType): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  const { color } = POWERUP_INFO[type];

  // Dark tile with a thick colored frame, like a Battle City bonus block
  ctx.fillStyle = '#111827';
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(8, 8, ICON_SIZE - 16, ICON_SIZE - 16, 18);
  ctx.fill();
  ctx.stroke();

  SHAPES[type](ctx);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.lineJoin = 'round';
  ctx.stroke();
  return canvas;
}

const canvases = new Map<PowerUpType, HTMLCanvasElement>();
const textures = new Map<PowerUpType, THREE.CanvasTexture>();
const dataUrls = new Map<PowerUpType, string>();

function iconCanvas(type: PowerUpType) {
  let canvas = canvases.get(type);
  if (!canvas) {
    canvas = drawIcon(type);
    canvases.set(type, canvas);
  }
  return canvas;
}

/** Shared texture per bonus type for the 3D scene */
export function powerUpTexture(type: PowerUpType): THREE.CanvasTexture {
  let texture = textures.get(type);
  if (!texture) {
    texture = new THREE.CanvasTexture(iconCanvas(type));
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(type, texture);
  }
  return texture;
}

/** Same icon as an image URL for the HUD (CSP allows data: images) */
export function powerUpIconUrl(type: PowerUpType): string {
  let url = dataUrls.get(type);
  if (!url) {
    url = iconCanvas(type).toDataURL();
    dataUrls.set(type, url);
  }
  return url;
}
