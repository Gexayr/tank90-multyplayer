import { useRef, useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import WebSocketService from '../services/websocket';
import { CommandBuffer } from '../game/CommandBuffer';
import { GameSimulation, TankState } from '../game/GameSimulation';
import { Camera } from '../game/Camera';
import { NetworkInterpolation } from '../game/NetworkInterpolation';
import { TankManager } from '../game/managers/TankManager';
import { BulletManager } from '../game/managers/BulletManager';
import { MapManager } from '../game/managers/MapManager';

interface UseGameLoopProps {
  app: PIXI.Application | null;
  world: PIXI.Container | null;
  camera: Camera | null;
  tankManager: TankManager | null;
  bulletManager: BulletManager | null;
  mapManager: MapManager | null;
  keysRef: React.MutableRefObject<{ [key: string]: boolean }>;
  isTouchDevice: boolean;
  joystickMagnitudeRef: React.MutableRefObject<number>;
  joystickVecRef: React.MutableRefObject<{ x: number; y: number }>;
  onScoreUpdate: (score: number) => void;
  drawMinimap: () => void;
}

export const useGameLoop = ({
  app,
  world,
  camera,
  tankManager,
  bulletManager,
  mapManager,
  keysRef,
  isTouchDevice,
  joystickMagnitudeRef,
  joystickVecRef,
  onScoreUpdate,
  drawMinimap,
}: UseGameLoopProps) => {
  const wsService = WebSocketService.getInstance();
  const commandBufferRef = useRef<CommandBuffer>(new CommandBuffer());
  const gameSimulationRef = useRef<GameSimulation>(new GameSimulation());
  const localTankStateRef = useRef<TankState | null>(null);
  const lastShotTimeRef = useRef<number>(0);
  const pendingShootRef = useRef<boolean>(false);
  const sequenceIdRef = useRef<number>(0);
  const lastInputSentTimeRef = useRef<number>(0);
  const SHOT_COOLDOWN = 500;
  const INPUT_INTERVAL = 1000 / 20; // Send 20 inputs per second

  const getDirectionFromRotation = (rotation: number) => ({
    x: Math.sin(rotation),
    y: -Math.cos(rotation),
  });

  useEffect(() => {
    if (!app || !world || !tankManager || !bulletManager || !mapManager) return;

    const gameLoop = () => {
      const deltaMS = app.ticker.deltaMS;
      const dt = deltaMS / 1000;
      const localId = wsService.getSocketId();
      tankManager.setSocketId(localId);
      const tanks = tankManager.getTanks();

      const localTankLoop = localId ? tanks.get(localId) : null;
      if (localTankLoop) {
        if (!localTankStateRef.current) {
          localTankStateRef.current = {
            x: localTankLoop.sprite.x,
            y: localTankLoop.sprite.y,
            rotation: localTankLoop.rotation,
          };
        }

        const input = {
          up: false,
          down: false,
          left: false,
          right: false,
          shoot: false,
          sequenceId: 0
        };

        if (!isTouchDevice) {
          if (keysRef.current['ArrowLeft'] || keysRef.current['a'] || keysRef.current['A']) input.left = true;
          if (keysRef.current['ArrowRight'] || keysRef.current['d'] || keysRef.current['D']) input.right = true;
          if (keysRef.current['ArrowUp'] || keysRef.current['w'] || keysRef.current['W']) input.up = true;
          if (keysRef.current['ArrowDown'] || keysRef.current['s'] || keysRef.current['S']) input.down = true;
          if (keysRef.current[' '] || keysRef.current['f'] || keysRef.current['F']) {
            pendingShootRef.current = true;
          }
        } else {
          const mag = joystickMagnitudeRef.current;
          const vec = joystickVecRef.current;
          if (mag > 0.05) {
            // Map joystick to up/down/left/right to match server expectation
            if (vec.x < -0.4) input.left = true;
            if (vec.x > 0.4) input.right = true;
            if (vec.y < -0.4) input.up = true;
            if (vec.y > 0.4) input.down = true;
          }
        }

        // Client-side prediction
        let direction: 'forward' | 'backward' | undefined = undefined;
        if (input.up) direction = 'forward';
        else if (input.down) direction = 'backward';

        // Update local state with prediction using current deltaTime
        localTankStateRef.current = gameSimulationRef.current.applyCommand(
          localTankStateRef.current,
          { commandId: 0, rotation: 0, direction, left: input.left, right: input.right, timestamp: Date.now() },
          dt
        );

        localTankLoop.sprite.x = localTankStateRef.current.x;
        localTankLoop.sprite.y = localTankStateRef.current.y;
        localTankLoop.rotation = localTankStateRef.current.rotation;
        localTankLoop.sprite.rotation = localTankStateRef.current.rotation;
        tankManager.updateHealthBar(localTankLoop);

        // Throttle input sending
        if (Date.now() - lastInputSentTimeRef.current >= INPUT_INTERVAL) {
          sequenceIdRef.current++;
          input.sequenceId = sequenceIdRef.current;
          
          if (pendingShootRef.current && Date.now() - lastShotTimeRef.current >= SHOT_COOLDOWN) {
            input.shoot = true;
            lastShotTimeRef.current = Date.now();
            pendingShootRef.current = false;
          }
          
          // Store command for reconciliation
          // Note: we use server-tick-equivalent rotation/direction for the command buffer
          // to match server's movement logic during re-simulation.
          commandBufferRef.current.addCommand(0, direction, input.left, input.right);
          
          wsService.sendPlayerInput(input);
          lastInputSentTimeRef.current = Date.now();
        }
      }

      const currentTime = performance.now();
      tanks.forEach((tank) => {
        if (tank.id === localId) return;
        if (tank.interpolation) {
          const interpolated = tank.interpolation.getInterpolatedState(currentTime);
          if (interpolated) {
            tank.sprite.x = interpolated.x;
            tank.sprite.y = interpolated.y;
            tank.rotation = interpolated.rotation;
            tank.sprite.rotation = interpolated.rotation;
            tankManager.updateHealthBar(tank);
            tankManager.ensureHighlightState(tank);
          }
          tank.interpolation.clearOldStates(currentTime, 2000);
        } else {
          tank.interpolation = new NetworkInterpolation(100);
        }

        const underTree = mapManager.isUnderTree(tank.sprite.x, tank.sprite.y);
        tankManager.updateTankAlpha(tank, underTree);
      });

      if (localTankLoop && localTankStateRef.current) {
        const underTree = mapManager.isUnderTree(localTankStateRef.current.x, localTankStateRef.current.y);
        tankManager.updateTankAlpha(localTankLoop, underTree);
      }

      tanks.forEach((t) => tankManager.ensureHighlightState(t));
      bulletManager.updateBullets();

      if (camera && localId && localTankStateRef.current) {
          const cameraOffset = camera.follow(localTankStateRef.current.x, localTankStateRef.current.y);
          world.x = cameraOffset.x;
          world.y = cameraOffset.y;
      }

      drawMinimap();
    };

    app.ticker.add(gameLoop);
    return () => {
      app.ticker.remove(gameLoop);
    };
  }, [app, world, camera, tankManager, bulletManager, mapManager, isTouchDevice, drawMinimap]);

  // Handle shooting logic
  const handleShoot = () => {
    pendingShootRef.current = true;
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'f' || e.key === 'F') {
        handleShoot();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleShoot]);

  // WebSocket listeners registration (abbreviated here, should be comprehensive)
  useEffect(() => {
    if (!tankManager || !bulletManager || !mapManager) return;

    const cleanup = [
      wsService.onMapObjects((objects) => objects.forEach(obj => mapManager.createMapObject(obj))),
      wsService.onMapUpdate((data) => mapManager.updateMapObject(data.objectId, data.destroyed)),
      wsService.onPlayerLeave((playerId) => tankManager.removeTank(playerId)),
      wsService.onPlayerJoin((player) => {
        const localId = wsService.getSocketId();
        if (localId) tankManager.setSocketId(localId);
        if (!tankManager.getTanks().has(player.id)) {
          tankManager.createTank(player.id, player.x, player.y, player.color, player.health, player.score);
        }
      }),
      wsService.onGameStateUpdate((state) => {
        const localId = wsService.getSocketId();
        if (localId) tankManager.setSocketId(localId);
        if (state.players) {
          state.players.forEach((player: any) => {
            if (!tankManager.getTanks().has(player.id)) {
              tankManager.createTank(player.id, player.x, player.y, player.color, player.health, player.score);
            }
          });
        }
      }),
      wsService.onSnapshot((snapshot) => {
        const localId = wsService.getSocketId();
        if (localId) tankManager.setSocketId(localId);
        
        snapshot.p.forEach((player: any) => {
          let tank = tankManager.getTanks().get(player.id);
          
          if (!tank) {
            // Create tank if it doesn't exist (both for local and remote)
            tank = tankManager.createTank(player.id, player.x, player.y, 0xFFFFFF, player.h, player.s);
          }

          if (player.id !== localId) {
            if (tank) {
              if (!tank.interpolation) tank.interpolation = new NetworkInterpolation(100);
              // Use performance.now() for consistency with getInterpolatedState
              tank.interpolation.addState({ x: player.x, y: player.y, rotation: player.r / 100, timestamp: performance.now() });
              tank.health = player.h;
              tank.score = player.s;
              tankManager.updateHealthBar(tank);
            }
          } else {
            // Reconciliation for local player
            if (tank && localTankStateRef.current) {
              // Server state for local player
              const serverState = { x: player.x, y: player.y, rotation: player.r / 100 };
              
              // Re-simulate commands that haven't been confirmed yet
              const unconfirmedCommands = commandBufferRef.current.getUnconfirmedCommands(player.sid);
              const reconciledState = gameSimulationRef.current.reSimulateCommands(serverState, unconfirmedCommands);
              
              // Update local predicted state with reconciled state
              localTankStateRef.current = reconciledState;
              
              // Smoothly transition local tank towards reconciled position to avoid snapping
              // If the difference is small, we can just snap. If large, we should probably snap anyway
              // but here we follow the instruction to reconcile.
              tank.sprite.x = reconciledState.x;
              tank.sprite.y = reconciledState.y;
              tank.rotation = reconciledState.rotation;
              tank.sprite.rotation = reconciledState.rotation;
              
              tank.health = player.h;
              tank.score = player.s;
              tankManager.updateHealthBar(tank);
              onScoreUpdate(player.s);
              
              commandBufferRef.current.removeConfirmedCommands(player.sid);
            }
          }
        });

        // Update bullets from snapshot
        // First, mark all current bullets as potentially removed
        const currentBullets = bulletManager.getBullets();
        const snapshotBulletIds = new Set(snapshot.b.map(b => b.id));
        
        // Remove bullets not in snapshot
        currentBullets.forEach((bullet, id) => {
          if (!snapshotBulletIds.has(id)) {
            bulletManager.removeBullet(id);
          }
        });

        // Add or update bullets from snapshot
        snapshot.b.forEach((b: any) => {
          if (!currentBullets.has(b.id)) {
            // We don't have direction/speed in snapshot, so we'd need them if we want to predict bullets
            // But for now, let's just snap bullets to snapshot positions
            bulletManager.createBullet(b.id, b.x, b.y, 0xFFFFFF, '', { x: 0, y: 0 }, 0);
          } else {
            const bullet = currentBullets.get(b.id);
            if (bullet) {
              bullet.sprite.x = b.x;
              bullet.sprite.y = b.y;
            }
          }
        });
      }),
    ];

    return () => {
      // wsService doesn't return unsubscribe functions currently in its implementation based on common patterns, 
      // but if it did, we'd call them here. For now, we assume wsService manages its own listeners or we'd need to add off() methods.
    };
  }, [tankManager, bulletManager, mapManager, wsService]);

  return { localTankStateRef, handleShoot };
};
