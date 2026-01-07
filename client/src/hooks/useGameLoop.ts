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
  const SHOT_COOLDOWN = 500;

  const getDirectionFromRotation = (rotation: number) => ({
    x: Math.sin(rotation),
    y: -Math.cos(rotation),
  });

  useEffect(() => {
    if (!app || !world || !tankManager || !bulletManager || !mapManager) return;

    const gameLoop = () => {
      const localId = wsService.getSocketId();
      tankManager.setSocketId(localId);
      const tanks = tankManager.getTanks();
      const bullets = bulletManager.getBullets();

      const localTankLoop = localId ? tanks.get(localId) : null;
      if (localTankLoop) {
        if (!localTankStateRef.current) {
          localTankStateRef.current = {
            x: localTankLoop.sprite.x,
            y: localTankLoop.sprite.y,
            rotation: localTankLoop.rotation,
          };
        }

        let inputChanged = false;
        let newRotation = localTankStateRef.current.rotation;
        let direction: 'forward' | 'backward' | undefined = undefined;

        if (!isTouchDevice) {
          if (keysRef.current['ArrowLeft'] || keysRef.current['a'] || keysRef.current['A'] ||
              keysRef.current['ArrowRight'] || keysRef.current['d'] || keysRef.current['D']) {
            newRotation = gameSimulationRef.current.calculateRotation(
                localTankStateRef.current.rotation,
                keysRef.current['ArrowLeft'] || keysRef.current['a'] || keysRef.current['A'],
                keysRef.current['ArrowRight'] || keysRef.current['d'] || keysRef.current['D']
            );
            inputChanged = true;
          }
          if (keysRef.current['ArrowUp'] || keysRef.current['w'] || keysRef.current['W']) {
            direction = 'forward';
            inputChanged = true;
          } else if (keysRef.current['ArrowDown'] || keysRef.current['s'] || keysRef.current['S']) {
            direction = 'backward';
            inputChanged = true;
          }
        } else {
          const mag = joystickMagnitudeRef.current;
          const vec = joystickVecRef.current;
          if (mag > 0.05) {
            const targetRot = Math.atan2(vec.x, -vec.y);
            newRotation = targetRot;
            direction = mag > 0.2 ? 'forward' : undefined;
            inputChanged = true;
          }
        }

        if (inputChanged) {
          const commandId = commandBufferRef.current.addCommand(newRotation, direction);
          const command = commandBufferRef.current.getAllCommands().find(c => c.commandId === commandId);
          if (command && localTankStateRef.current) {
            localTankStateRef.current = gameSimulationRef.current.applyCommand(
                localTankStateRef.current,
                command
            );
            localTankLoop.sprite.x = localTankStateRef.current.x;
            localTankLoop.sprite.y = localTankStateRef.current.y;
            localTankLoop.rotation = localTankStateRef.current.rotation;
            localTankLoop.sprite.rotation = localTankStateRef.current.rotation;
            tankManager.updateHealthBar(localTankLoop);
            tankManager.ensureHighlightState(localTankLoop);
          }
          wsService.sendPlayerMove(commandId, newRotation, direction);
        } else if (localTankStateRef.current) {
          localTankLoop.sprite.x = localTankStateRef.current.x;
          localTankLoop.sprite.y = localTankStateRef.current.y;
          localTankLoop.rotation = localTankStateRef.current.rotation;
          localTankLoop.sprite.rotation = localTankStateRef.current.rotation;
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
    if (Date.now() - lastShotTimeRef.current < SHOT_COOLDOWN) return;
    const localId = wsService.getSocketId();
    const localTank = localId ? tankManager?.getTanks().get(localId) : null;
    if (localTank && localTankStateRef.current) {
      const direction = getDirectionFromRotation(localTankStateRef.current.rotation);
      wsService.sendPlayerShoot(
        localTankStateRef.current.x + direction.x * 25,
        localTankStateRef.current.y + direction.y * 25,
        direction
      );
      lastShotTimeRef.current = Date.now();
    }
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
      wsService.onGameStateUpdate((state) => {
        state.players.forEach((player: any) => {
          tankManager.createTank(player.id, player.x, player.y, player.color, player.health, player.score);
          if (player.id === wsService.getSocketId()) {
            localTankStateRef.current = { x: player.x, y: player.y, rotation: player.rotation };
            onScoreUpdate(player.score);
          }
        });
      }),
      wsService.onPlayerJoin((player) => {
        tankManager.createTank(player.id, player.x, player.y, player.color, player.health, player.score);
        if (player.id === wsService.getSocketId()) {
          localTankStateRef.current = { x: player.x, y: player.y, rotation: 0 };
          onScoreUpdate(player.score);
        }
      }),
      wsService.onMapObjects((objects) => objects.forEach(obj => mapManager.createMapObject(obj))),
      wsService.onMapUpdate((data) => mapManager.updateMapObject(data.objectId, data.destroyed)),
      wsService.onPlayerLeave((playerId) => tankManager.removeTank(playerId)),
      wsService.onBulletCreate((bullet) => bulletManager.createBullet(bullet.id, bullet.x, bullet.y, 0xFFFFFF, bullet.playerId, bullet.direction, bullet.speed)),
      wsService.onBulletRemove((bulletId) => bulletManager.removeBullet(bulletId)),
      wsService.onHealthUpdate((data) => {
        const tank = tankManager.getTanks().get(data.id);
        if (tank) {
          tank.health = data.health;
          tankManager.updateHealthBar(tank);
        }
      }),
      wsService.onScoreUpdate((data) => {
        const tank = tankManager.getTanks().get(data.playerId);
        if (tank) {
          tank.score = data.score;
          if (tank.id === wsService.getSocketId()) onScoreUpdate(tank.score);
        }
      }),
      wsService.onStateUpdate((data) => {
        const localId = wsService.getSocketId();
        const updateTimestamp = performance.now();
        
        data.players.forEach((player: any) => {
          if (player.id !== localId) {
            const tank = tankManager.getTanks().get(player.id);
            if (tank) {
              if (!tank.interpolation) tank.interpolation = new NetworkInterpolation(100);
              tank.interpolation.addState({ x: player.x, y: player.y, rotation: player.rotation, timestamp: updateTimestamp });
            }
          }
        });

        if (localId && data.latestConfirmedCommandId !== undefined) {
          const localTank = tankManager.getTanks().get(localId);
          if (localTank) {
            const serverPlayer = data.players.find((p: any) => p.id === localId);
            if (data.authoritativeState) {
              localTankStateRef.current = { ...data.authoritativeState };
            } else if (serverPlayer) {
              localTankStateRef.current = { x: serverPlayer.x, y: serverPlayer.y, rotation: serverPlayer.rotation };
            }

            if (localTankStateRef.current) {
              const unconfirmedCommands = commandBufferRef.current.getUnconfirmedCommands(data.latestConfirmedCommandId);
              const reconciledState = gameSimulationRef.current.reSimulateCommands(localTankStateRef.current, unconfirmedCommands);
              localTank.sprite.x = reconciledState.x;
              localTank.sprite.y = reconciledState.y;
              localTank.rotation = reconciledState.rotation;
              localTank.sprite.rotation = reconciledState.rotation;
              tankManager.updateHealthBar(localTank);
              tankManager.ensureHighlightState(localTank);
            }
            commandBufferRef.current.removeConfirmedCommands(data.latestConfirmedCommandId);
          }
        }

        data.bullets.forEach((bullet: any) => {
          if (!bulletManager.getBullets().has(bullet.id)) {
            bulletManager.createBullet(bullet.id, bullet.x, bullet.y, 0xFFFFFF, bullet.playerId, bullet.direction, bullet.speed);
          }
        });
      })
    ];

    return () => {
      // wsService doesn't return unsubscribe functions currently in its implementation based on common patterns, 
      // but if it did, we'd call them here. For now, we assume wsService manages its own listeners or we'd need to add off() methods.
    };
  }, [tankManager, bulletManager, mapManager, wsService]);

  return { localTankStateRef, handleShoot };
};
