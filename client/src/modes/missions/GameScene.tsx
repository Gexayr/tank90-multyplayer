import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameState, PlayerInput } from '@shared/missions-types';
import { PlayerTankMesh, EnemyTankMesh } from './TankMesh';
import { WallsMesh } from './WallMesh';
import { BulletMesh } from './BulletMesh';
import { PowerUpMesh } from './PowerUpMesh';
import { BOARD_WIDTH, BOARD_HEIGHT } from './constants';

function Camera() {
  const { camera, size } = useThree();
  const cx = BOARD_WIDTH / 2 - 0.5;
  const cz = BOARD_HEIGHT / 2 - 0.5;

  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.position.set(cx, 30, cz + 5);
      camera.lookAt(cx, 0, cz);
      const zoom = Math.min(size.width, size.height) / Math.max(BOARD_WIDTH, BOARD_HEIGHT);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
  }, [camera, cx, cz, size.width, size.height]);

  return null;
}

// One plane with a repeating 2x2 checker texture instead of one mesh per tile
function Ground({ w, h }: { w: number; h: number }) {
  const texture = useMemo(() => {
    const dark = [0x24, 0x50, 0x16, 255];
    const light = [0x2a, 0x52, 0x18, 255];
    const t = new THREE.DataTexture(new Uint8Array([...light, ...dark, ...dark, ...light]), 2, 2);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 2, h / 2);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [w, h]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2 - 0.5, 0, h / 2 - 0.5]} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

interface InputTrackerProps {
  onInput: (input: PlayerInput) => void;
  mobileInputRef: React.MutableRefObject<PlayerInput>;
}

function InputTracker({ onInput, mobileInputRef }: InputTrackerProps) {
  const keysRef = useRef<Set<string>>(new Set());
  const lastInputRef = useRef<string>('');

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  useFrame(() => {
    const k = keysRef.current;
    const m = mobileInputRef?.current ?? { up: false, down: false, left: false, right: false, fire: false };
    const input: PlayerInput = {
      up:    k.has('ArrowUp')    || k.has('w') || k.has('W') || m.up,
      down:  k.has('ArrowDown')  || k.has('s') || k.has('S') || m.down,
      left:  k.has('ArrowLeft')  || k.has('a') || k.has('A') || m.left,
      right: k.has('ArrowRight') || k.has('d') || k.has('D') || m.right,
      fire:  k.has(' ') || k.has('f') || k.has('F') || m.fire,
    };
    const serialized = `${+input.up}${+input.down}${+input.left}${+input.right}${+input.fire}`;
    if (serialized !== lastInputRef.current) {
      lastInputRef.current = serialized;
      onInput(input);
    }
  });

  return null;
}

interface SceneProps {
  state: GameState;
  mySocketId: string | null;
  onInput: (input: PlayerInput) => void;
  mobileInputRef: React.MutableRefObject<PlayerInput>;
}

function SceneContent({ state, mySocketId, onInput, mobileInputRef }: SceneProps) {
  const cx = BOARD_WIDTH / 2 - 0.5;
  const cz = BOARD_HEIGHT / 2 - 0.5;

  return (
    <>
      <Camera />
      <InputTracker onInput={onInput} mobileInputRef={mobileInputRef} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[cx, 20, cz - 10]} intensity={1.1} castShadow />

      <Ground w={BOARD_WIDTH} h={BOARD_HEIGHT} />

      <WallsMesh walls={state.walls} />

      {state.players.map(p => (
        <PlayerTankMesh key={p.id} tank={p} isMe={p.id === mySocketId} />
      ))}

      {state.enemies.map(e => (
        <EnemyTankMesh key={e.id} tank={e} />
      ))}

      {state.bullets.map(b => (
        <BulletMesh key={b.id} bullet={b} />
      ))}

      {state.powerUps.map(pu => (
        <PowerUpMesh key={pu.id} powerUp={pu} />
      ))}
    </>
  );
}

interface GameCanvasProps {
  state: GameState;
  mySocketId: string | null;
  onInput: (input: PlayerInput) => void;
  mobileInputRef: React.MutableRefObject<PlayerInput>;
}

export function GameCanvas({ state, mySocketId, onInput, mobileInputRef }: GameCanvasProps) {
  return (
    <Canvas
      shadows
      orthographic
      camera={{
        position: [BOARD_WIDTH / 2 - 0.5, 30, BOARD_HEIGHT / 2 + 5],
        zoom: 28,
        near: 0.1,
        far: 500,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContent state={state} mySocketId={mySocketId} onInput={onInput} mobileInputRef={mobileInputRef} />
    </Canvas>
  );
}
