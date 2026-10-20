import * as THREE from 'three';
import type { Wall } from '@shared/missions-types';
import { useMemo } from 'react';

// Shared by every wall block instead of one geometry/material per mesh
const wallGeometry = new THREE.BoxGeometry(0.95, 0.5, 0.95);
const brickMaterial = new THREE.MeshStandardMaterial({ color: '#CC6633', roughness: 0.9 });
const metalMaterial = new THREE.MeshStandardMaterial({ color: '#888888', metalness: 0.8, roughness: 0.2 });

interface WallsProps {
  walls: Wall[];
}

export function WallsMesh({ walls }: WallsProps) {
  const brickWalls = useMemo(() => walls.filter(w => w.type === 'brick'), [walls]);
  const metalWalls = useMemo(() => walls.filter(w => w.type === 'metal'), [walls]);
  const baseWall = useMemo(() => walls.find(w => w.type === 'base'), [walls]);

  return (
    <>
      {brickWalls.map(wall => (
        <mesh
          key={wall.id}
          geometry={wallGeometry}
          material={brickMaterial}
          position={[wall.position.x, 0.25, wall.position.z]}
          receiveShadow
          castShadow
        />
      ))}
      {metalWalls.map(wall => (
        <mesh
          key={wall.id}
          geometry={wallGeometry}
          material={metalMaterial}
          position={[wall.position.x, 0.25, wall.position.z]}
          receiveShadow
          castShadow
        />
      ))}
      {baseWall && (
        <group>
          <mesh position={[baseWall.position.x, 0.15, baseWall.position.z]} receiveShadow>
            <boxGeometry args={[0.95, 0.3, 0.95]} />
            <meshStandardMaterial color="#228B22" />
          </mesh>
          <mesh position={[baseWall.position.x, 0.5, baseWall.position.z]}>
            <cylinderGeometry args={[0.1, 0.15, 0.5, 6]} />
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.8} />
          </mesh>
        </group>
      )}
    </>
  );
}
