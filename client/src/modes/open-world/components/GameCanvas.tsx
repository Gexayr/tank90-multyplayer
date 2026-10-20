import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
// Lets PixiJS run under a CSP without 'unsafe-eval'
import '@pixi/unsafe-eval';
import WebSocketService from '../services/websocket';
import { Camera } from '../game/Camera';
import { TankManager } from '../game/managers/TankManager';
import { BulletManager } from '../game/managers/BulletManager';
import { MapManager } from '../game/managers/MapManager';
import { useInput } from '../hooks/useInput';
import { useGameLoop } from '../hooks/useGameLoop';
import Minimap from './Minimap';
import Joystick from './Joystick';
import FireButton from './FireButton';
import { navigate } from '../../../lib/router';
import './GameCanvas.css';

// Desktop renders at 1280x720 and CSS scales the canvas to the page width
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;
const CELL_SIZE = 40;
// Ground colors as rendered on the Missions board
const GROUND_LIGHT = '#0c2a07';
const GROUND_DARK = '#072906';
// Below 1 shows more of the battlefield around the tank
const CAMERA_ZOOM = 0.8;
// Touch screens play full screen; zoom out so the short side shows at least this many world units
const MIN_VISIBLE_WORLD = 640;

/** Renderer size and zoom: full window on touch screens, fixed 16:9 on desktop */
function viewportFor(fullscreen: boolean) {
  if (!fullscreen) return { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, zoom: CAMERA_ZOOM };
  const width = window.innerWidth;
  const height = window.innerHeight;
  return { width, height, zoom: Math.min(CAMERA_ZOOM, Math.min(width, height) / MIN_VISIBLE_WORLD) };
}
const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 160;

interface GameCanvasProps {
  playerName: string;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ playerName }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);

  const onScoreUpdate = useCallback((score: number) => {
    if (score !== scoreRef.current) {
      scoreRef.current = score;
      setDisplayScore(score);
    }
  }, []);

  const [serverFull, setServerFull] = useState(false);
  const [death, setDeath] = useState<{ killerName: string | null; respawnAt: number } | null>(null);
  const [respawnSecondsLeft, setRespawnSecondsLeft] = useState(0);

  const onLocalDeath = useCallback((killerName: string | null, respawnIn: number) => {
    setDeath({ killerName, respawnAt: Date.now() + respawnIn });
  }, []);

  const onLocalRespawn = useCallback(() => {
    setDeath(null);
  }, []);

  useEffect(() => {
    if (!death) return;
    const update = () => setRespawnSecondsLeft(Math.max(0, Math.ceil((death.respawnAt - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [death]);

  const [pixiApp, setPixiApp] = useState<PIXI.Application | null>(null);
  const [worldContainer, setWorldContainer] = useState<PIXI.Container | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [tankManager, setTankManager] = useState<TankManager | null>(null);
  const [bulletManager, setBulletManager] = useState<BulletManager | null>(null);
  const [mapManager, setMapManager] = useState<MapManager | null>(null);

  const {
    keysRef,
    heldDirectionsRef,
    joystickHeadingRef,
    fireHeldRef,
    isTouchDevice,
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
      // Tanks hidden in a forest stay hidden on the minimap too
      if (t.id !== localId && mapManager.isUnderTree(t.sprite.x, t.sprite.y)) return;
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
      ctx.fillStyle = objId.startsWith('brick') ? 'rgba(158, 66, 29, 0.8)' :
                      objId.startsWith('concrete') ? 'rgba(128, 128, 128, 0.6)' :
                      objId.startsWith('water') ? 'rgba(65, 105, 225, 0.5)' :
                      objId.startsWith('tree') ? 'rgba(34, 139, 34, 0.5)' : 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(sprite.x * MINIMAP_SCALE_X, sprite.y * MINIMAP_SCALE_Y, sprite.width * MINIMAP_SCALE_X, sprite.height * MINIMAP_SCALE_Y);
    });

    // Draw bullets
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    bulletManager.getBullets().forEach((b) => {
      ctx.beginPath(); ctx.arc(b.sprite.x * MINIMAP_SCALE_X, b.sprite.y * MINIMAP_SCALE_Y, 1.5, 0, Math.PI * 2); ctx.fill();
    });

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(0.5, 0.5, MINIMAP_WIDTH - 1, MINIMAP_HEIGHT - 1);
  }, [wsService, tankManager, bulletManager, mapManager]);

  useGameLoop({
    app: pixiApp,
    world: worldContainer,
    camera: camera,
    tankManager: tankManager,
    bulletManager: bulletManager,
    mapManager: mapManager,
    keysRef,
    heldDirectionsRef,
    joystickHeadingRef,
    fireHeldRef,
    onScoreUpdate: onScoreUpdate,
    onLocalDeath,
    onLocalRespawn,
    drawMinimap,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const view = viewportFor(isTouchDevice);
    const cam = new Camera({ viewportWidth: view.width, viewportHeight: view.height, worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT, zoom: view.zoom });
    setCamera(cam);

    const app = new PIXI.Application({ width: view.width, height: view.height, backgroundColor: 0x0b0d12, resolution: window.devicePixelRatio || 1, autoDensity: true });
    app.stage.sortableChildren = true;
    canvasRef.current.appendChild(app.view as HTMLCanvasElement);
    setPixiApp(app);

    const world = new PIXI.Container();
    world.sortableChildren = true;
    world.scale.set(view.zoom);
    app.stage.addChild(world);
    setWorldContainer(world);

    // Same green checkerboard as the Missions board, one 40-unit cell per tile
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = groundCanvas.height = CELL_SIZE * 2;
    const groundCtx = groundCanvas.getContext('2d')!;
    groundCtx.fillStyle = GROUND_DARK;
    groundCtx.fillRect(0, 0, CELL_SIZE * 2, CELL_SIZE * 2);
    groundCtx.fillStyle = GROUND_LIGHT;
    groundCtx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);
    groundCtx.fillRect(CELL_SIZE, CELL_SIZE, CELL_SIZE, CELL_SIZE);
    const ground = new PIXI.TilingSprite(PIXI.Texture.from(groundCanvas), WORLD_WIDTH, WORLD_HEIGHT);
    ground.zIndex = -10;
    world.addChild(ground);

    setTankManager(new TankManager(world));
    setBulletManager(new BulletManager(world));
    setMapManager(new MapManager(world));

    wsService.connect(playerName);
    const offServerFull = wsService.onServerFull(() => setServerFull(true));

    const handleResize = () => {
      if (!isTouchDevice) return;
      const next = viewportFor(true);
      app.renderer.resize(next.width, next.height);
      cam.setViewportSize(next.width, next.height);
      cam.setZoom(next.zoom);
      world.scale.set(next.zoom);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      offServerFull();
      wsService.disconnect();
      app.destroy(true, true);
    };
  }, []);

  return (
    <div className={`game-canvas-wrapper${isTouchDevice ? ' fullscreen' : ''}`}>
      <div ref={canvasRef} className="game-canvas-container" />
      <div className="game-hud">
        {isTouchDevice && <button className="game-menu-btn" onClick={() => navigate('/')}>← MENU</button>}
        <span>{playerName} · {displayScore}</span>
      </div>
      {serverFull && (
        <div className="death-overlay">
          <div className="death-title">Server is full</div>
          <div className="death-timer">Try again in a minute</div>
        </div>
      )}
      {death && (
        <div className="death-overlay">
          <div className="death-title">Destroyed{death.killerName ? ` by ${death.killerName}` : ''}</div>
          <div className="death-timer">Respawn in {respawnSecondsLeft}s</div>
        </div>
      )}
      {/* On touch screens the bottom corners belong to the joystick and the fire button */}
      <Minimap canvasRef={minimapRef} width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} placement={isTouchDevice ? 'top' : 'bottom'} />
      {isTouchDevice && (
        <>
          <Joystick headingRef={joystickHeadingRef} />
          <FireButton heldRef={fireHeldRef} />
        </>
      )}
    </div>
  );
};

export default GameCanvas;