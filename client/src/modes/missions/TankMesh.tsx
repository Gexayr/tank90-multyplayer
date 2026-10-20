import * as THREE from 'three';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PlayerTank, EnemyTank, Direction } from '@shared/missions-types';

import { PLAYER_COLORS } from './constants';

function directionToRotation(dir: Direction): number {
  switch (dir) {
    case 'up':    return 0;
    case 'down':  return Math.PI;
    case 'left':  return Math.PI / 2;
    case 'right': return -Math.PI / 2;
  }
}

interface PlayerTankProps {
  tank: PlayerTank;
  isMe: boolean;
}

export function PlayerTankMesh({ tank, isMe }: PlayerTankProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = groupRef.current;
    t.position.x += (tank.position.x - t.position.x) * 0.5;
    t.position.z += (tank.position.z - t.position.z) * 0.5;
    t.position.y = 0.3;
    t.rotation.y = directionToRotation(tank.direction);
  });

  if (!tank.isAlive) return null;

  const color = PLAYER_COLORS[tank.colorIndex % PLAYER_COLORS.length];

  return (
    <group ref={groupRef} position={[tank.position.x, 0.3, tank.position.z]}>
      <mesh castShadow>
        <boxGeometry args={[0.75, 0.28, 0.75]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.24, -0.08]} castShadow>
        <boxGeometry args={[0.48, 0.24, 0.48]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.28, -0.44]} castShadow>
        <boxGeometry args={[0.1, 0.1, 0.34]} />
        <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.65)} />
      </mesh>
      {isMe && (
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#00FF88" emissive="#00FF88" emissiveIntensity={2} />
        </mesh>
      )}
      {tank.hasShield && (
        <mesh>
          <sphereGeometry args={[0.62, 12, 12]} />
          <meshStandardMaterial color="#00CFFF" transparent opacity={0.28} wireframe />
        </mesh>
      )}
      {tank.hasStar && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.58, 24]} />
          <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={1.5} />
        </mesh>
      )}
    </group>
  );
}

interface EnemyTankProps {
  tank: EnemyTank;
}

export function EnemyTankMesh({ tank }: EnemyTankProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = groupRef.current;
    t.position.x += (tank.position.x - t.position.x) * 0.5;
    t.position.z += (tank.position.z - t.position.z) * 0.5;
    t.position.y = 0.3;
    t.rotation.y = directionToRotation(tank.direction);
  });

  if (!tank.isAlive) return null;

  return (
    <group ref={groupRef} position={[tank.position.x, 0.3, tank.position.z]}>
      <mesh castShadow>
        <boxGeometry args={[0.75, 0.28, 0.75]} />
        <meshStandardMaterial color="#CC1111" />
      </mesh>
      <mesh position={[0, 0.24, -0.08]} castShadow>
        <boxGeometry args={[0.48, 0.24, 0.48]} />
        <meshStandardMaterial color="#AA0000" />
      </mesh>
      <mesh position={[0, 0.28, -0.44]} castShadow>
        <boxGeometry args={[0.1, 0.1, 0.34]} />
        <meshStandardMaterial color="#880000" />
      </mesh>
    </group>
  );
}
