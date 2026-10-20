import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Bullet } from '@shared/missions-types';

interface BulletMeshProps {
  bullet: Bullet;
}

export function BulletMesh({ bullet }: BulletMeshProps) {
  const posRef = useRef({ x: bullet.position.x, z: bullet.position.z });
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    posRef.current.x += (bullet.position.x - posRef.current.x) * 0.6;
    posRef.current.z += (bullet.position.z - posRef.current.z) * 0.6;
    meshRef.current.position.set(posRef.current.x, 0.3, posRef.current.z);
    meshRef.current.rotation.y += 0.3;
  });

  const color = bullet.isEnemyBullet ? '#FF4500' : '#FFD700';

  return (
    // No point light per bullet: changing the light count recompiles every shader
    <mesh ref={meshRef} position={[bullet.position.x, 0.3, bullet.position.z]}>
      <sphereGeometry args={[0.13, 6, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} />
    </mesh>
  );
}
