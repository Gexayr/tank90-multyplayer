import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PowerUp } from '@shared/missions-types';

const POWERUP_COLORS: Record<PowerUp['type'], string> = {
  star: '#FFD700',
  speed: '#00FF7F',
  shield: '#00BFFF',
  life: '#FF69B4',
};

interface PowerUpMeshProps {
  powerUp: PowerUp;
}

export function PowerUpMesh({ powerUp }: PowerUpMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = 0.3 + Math.sin(clock.elapsedTime * 2 + powerUp.position.x) * 0.15;
    groupRef.current.rotation.y += 0.03;
  });

  const color = POWERUP_COLORS[powerUp.type];

  return (
    <group ref={groupRef} position={[powerUp.position.x, 0.3, powerUp.position.z]}>
      <mesh>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}
