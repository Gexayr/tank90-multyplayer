import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PowerUp } from '@shared/missions-types';
import { POWERUP_INFO, powerUpTexture } from './powerUpIcons';

interface PowerUpMeshProps {
  powerUp: PowerUp;
}

/** Bonus icon that always faces the camera, bobs and pulses over a glowing ring */
export function PowerUpMesh({ powerUp }: PowerUpMeshProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const ringRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 3 + powerUp.position.x;
    if (spriteRef.current) {
      spriteRef.current.position.y = 0.7 + Math.sin(t) * 0.08;
      const scale = 0.95 + Math.sin(t * 1.3) * 0.06;
      spriteRef.current.scale.set(scale, scale, 1);
    }
    if (ringRef.current) ringRef.current.opacity = 0.35 + Math.sin(t * 1.3) * 0.2;
  });

  const { color } = POWERUP_INFO[powerUp.type];

  return (
    <group position={[powerUp.position.x, 0, powerUp.position.z]}>
      <sprite ref={spriteRef} position={[0, 0.7, 0]}>
        <spriteMaterial map={powerUpTexture(powerUp.type)} transparent depthWrite={false} />
      </sprite>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.35, 0.5, 24]} />
        <meshBasicMaterial ref={ringRef} color={color} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}
