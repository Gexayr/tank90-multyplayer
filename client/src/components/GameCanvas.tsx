import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import WebSocketService from '../services/websocket';
import { Camera } from '../game/Camera';
import { TankManager } from '../game/managers/TankManager';
import { BulletManager } from '../game/managers/BulletManager';
import { MapManager } from '../game/managers/MapManager';
import { useInput } from '../hooks/useInput';
import { useGameLoop } from '../hooks/useGameLoop';
import Minimap from './Minimap';
import Joystick from './Joystick';
import './GameCanvas.css';

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;
const ASPECT_RATIO = VIEWPORT_WIDTH / VIEWPORT_HEIGHT;
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;
const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;
const SHOOT_BTN_SIZE = 80;

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const [localScore, setLocalScore] = useState(0);

  const [pixiApp, setPixiApp] = useState<PIXI.Application | null>(null);
  const [worldContainer, setWorldContainer] = useState<PIXI.Container | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [tankManager, setTankManager] = useState<TankManager | null>(null);
  const [bulletManager, setBulletManager] = useState<BulletManager | null>(null);
  const [mapManager, setMapManager] = useState<MapManager | null>(null);

  const {
    keysRef,
    isTouchDevice,
    joystickKnob,
    joystickMagnitudeRef,
    joystickVecRef,
    handleJoystickStart,
    handleJoystickMove,
    handleJoystickEnd,
  } = useInput();

  const wsService = WebSocketService.getInstance();

  const drawMinimap = useCallback(() => {
    const canvas = minimapRef.current;
    if (!canvas || !tankManager || !bulletManager || !mapManager) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const MINIMAP_SCALE_X = MINIMAP_WIDTH / WORLD_WIDTH;
    const MINIMAP_SCALE_Y = MINIMAP_HEIGHT / WORLD_HEIGHT;

    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= MINIMAP_WIDTH; x += 40 * MINIMAP_SCALE_X) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, MINIMAP_HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= MINIMAP_HEIGHT; y += 40 * MINIMAP_SCALE_Y) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(MINIMAP_WIDTH, y + 0.5); ctx.stroke();
    }

    // Draw players
    const localId = wsService.getSocketId();
    tankManager.getTanks().forEach((t) => {
      const x = t.sprite.x * MINIMAP_SCALE_X;
      const y = t.sprite.y * MINIMAP_SCALE_Y;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t.rotation);
      ctx.fillStyle = '#4f7f4f';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.fillStyle = localId && t.id === localId ? 'rgba(255,255,0,0.9)' : 'rgba(255,0,0,0.9)';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-2, -2); ctx.lineTo(2, -2); ctx.closePath(); ctx.fill();
      ctx.restore();
    });

    // Draw map objects
    mapManager.getMapObjects().forEach((sprite, objId) => {
      if (!sprite.visible) return;
      const bounds = sprite.getBounds();
      ctx.fillStyle = objId.startsWith('brick') ? 'rgba(139, 69, 19, 0.6)' :
                      objId.startsWith('concrete') ? 'rgba(128, 128, 128, 0.6)' :
                      objId.startsWith('water') ? 'rgba(65, 105, 225, 0.5)' :
                      objId.startsWith('tree') ? 'rgba(34, 139, 34, 0.5)' : 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(bounds.x * MINIMAP_SCALE_X, bounds.y * MINIMAP_SCALE_Y, bounds.width * MINIMAP_SCALE_X, bounds.height * MINIMAP_SCALE_Y);
    });

    // Draw bullets
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    bulletManager.getBullets().forEach((b) => {
      ctx.beginPath(); ctx.arc(b.sprite.x * MINIMAP_SCALE_X, b.sprite.y * MINIMAP_SCALE_Y, 1.5, 0, Math.PI * 2); ctx.fill();
    });

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(0.5, 0.5, MINIMAP_WIDTH - 1, MINIMAP_HEIGHT - 1);
  }, [wsService, tankManager, bulletManager, mapManager]);

  const { handleShoot } = useGameLoop({
    app: pixiApp,
    world: worldContainer,
    camera: camera,
    tankManager: tankManager,
    bulletManager: bulletManager,
    mapManager: mapManager,
    keysRef,
    isTouchDevice,
    joystickMagnitudeRef,
    joystickVecRef,
    onScoreUpdate: setLocalScore,
    drawMinimap,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const isMobile = window.innerWidth <= 768;
    let vWidth = VIEWPORT_WIDTH, vHeight = VIEWPORT_HEIGHT;
    if (isMobile) {
      const sW = window.innerWidth, sH = window.innerHeight;
      vWidth = sW; vHeight = sW / ASPECT_RATIO;
      if (sH / ASPECT_RATIO < vWidth) { vHeight = sH; vWidth = sH * ASPECT_RATIO; }
    }

    const cam = new Camera({ viewportWidth: vWidth, viewportHeight: vHeight, worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT });
    setCamera(cam);

    const app = new PIXI.Application({ width: vWidth, height: vHeight, backgroundColor: 0x2a2a2a, resolution: window.devicePixelRatio || 1, autoDensity: true });
    app.stage.sortableChildren = true;
    canvasRef.current.appendChild(app.view as HTMLCanvasElement);
    setPixiApp(app);

    const world = new PIXI.Container();
    world.sortableChildren = true;
    app.stage.addChild(world);
    setWorldContainer(world);

    const grid = new PIXI.Graphics();
    grid.lineStyle(1, 0x555555, 0.4);
    for (let x = 0; x <= WORLD_WIDTH; x += 40) { grid.moveTo(x + 0.5, 0); grid.lineTo(x + 0.5, WORLD_HEIGHT); }
    for (let y = 0; y <= WORLD_HEIGHT; y += 40) { grid.moveTo(0, y + 0.5); grid.lineTo(WORLD_WIDTH, y + 0.5); }
    grid.zIndex = -10;
    world.addChild(grid);

    setTankManager(new TankManager(world));
    setBulletManager(new BulletManager(world));
    setMapManager(new MapManager(world));

    wsService.connect();

    const handleResize = () => {
      const isMob = window.innerWidth <= 768;
      let newW = VIEWPORT_WIDTH, newH = VIEWPORT_HEIGHT;
      if (isMob) {
        newW = window.innerWidth; newH = window.innerHeight;
        let cW = newW, cH = newW / ASPECT_RATIO;
        if (newH / ASPECT_RATIO < cW) { cH = newH; cW = newH * ASPECT_RATIO; }
        newW = cW; newH = cH;
      }
      app.renderer.resize(newW, newH);
      cam.setViewportSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      wsService.disconnect();
      app.destroy(true, true);
    };
  }, []);

  const joystickContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="game-canvas-wrapper">
      <div ref={canvasRef} className="game-canvas-container" />
      <div className="score-display">Score: {localScore}</div>
      <Minimap canvasRef={minimapRef} width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} />
      {isTouchDevice && (
        <>
          <Joystick
            joystickRef={joystickContainerRef}
            onStart={handleJoystickStart}
            onMove={handleJoystickMove}
            onEnd={handleJoystickEnd}
            knobPos={joystickKnob}
          />
          <div onTouchStart={handleShoot} className="mobile-fire-button" style={{ width: SHOOT_BTN_SIZE, height: SHOOT_BTN_SIZE, borderRadius: SHOOT_BTN_SIZE / 2 }} />
        </>
      )}
    </div>
  );
};

export default GameCanvas;