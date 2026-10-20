import { useRef, useEffect } from 'react';
import type { PlayerInput } from '@shared/missions-types';

interface MobileControlsProps {
  inputRef: React.MutableRefObject<PlayerInput>;
}

export function MobileControls({ inputRef }: MobileControlsProps) {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const joystickTouchId = useRef<number | null>(null);
  const joystickCenter = useRef({ x: 0, y: 0 });

  const fireActive = useRef(false);

  const DEAD_ZONE = 12;
  const MAX_DRAG = 48;

  useEffect(() => {
    const base = joystickBaseRef.current;
    if (!base) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (joystickTouchId.current !== null) return;
      const touch = e.changedTouches[0];
      joystickTouchId.current = touch.identifier;
      const rect = base.getBoundingClientRect();
      joystickCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      updateDir(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joystickTouchId.current) {
          updateDir(t.clientX, t.clientY);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId.current) {
          joystickTouchId.current = null;
          inputRef.current = { ...inputRef.current, up: false, down: false, left: false, right: false };
          resetKnob();
        }
      }
    };

    function updateDir(cx: number, cy: number) {
      const dx = cx - joystickCenter.current.x;
      const dy = cy - joystickCenter.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const clampedX = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx));
      const clampedY = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dy));
      if (joystickKnobRef.current) {
        joystickKnobRef.current.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
      }

      if (dist < DEAD_ZONE) {
        inputRef.current = { ...inputRef.current, up: false, down: false, left: false, right: false };
        return;
      }

      const angle = Math.atan2(dy, dx);
      const deg = angle * (180 / Math.PI);

      inputRef.current = {
        ...inputRef.current,
        up: deg > -135 && deg < -45,
        down: deg > 45 && deg < 135,
        left: (deg > 135 || deg < -135),
        right: deg > -45 && deg < 45,
      };
    }

    function resetKnob() {
      if (joystickKnobRef.current) {
        joystickKnobRef.current.style.transform = 'translate(-50%, -50%)';
      }
    }

    base.addEventListener('touchstart', onTouchStart, { passive: false });
    base.addEventListener('touchmove', onTouchMove, { passive: false });
    base.addEventListener('touchend', onTouchEnd, { passive: false });
    base.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      base.removeEventListener('touchstart', onTouchStart);
      base.removeEventListener('touchmove', onTouchMove);
      base.removeEventListener('touchend', onTouchEnd);
      base.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [inputRef]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 20 }}>
      {/* Joystick — bottom left */}
      <div
        ref={joystickBaseRef}
        className="absolute pointer-events-auto"
        style={{
          bottom: 28,
          left: 28,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)',
          border: '2px solid rgba(255,255,255,0.18)',
          touchAction: 'none',
        }}
      >
        {/* Direction arrows */}
        {(['up','down','left','right'] as const).map(dir => {
          const s: React.CSSProperties = {
            position: 'absolute',
            fontSize: 18,
            opacity: 0.4,
            color: '#fff',
            pointerEvents: 'none',
          };
          if (dir === 'up')    { s.top = 6;   s.left = '50%'; s.transform = 'translateX(-50%)'; }
          if (dir === 'down')  { s.bottom = 6; s.left = '50%'; s.transform = 'translateX(-50%)'; }
          if (dir === 'left')  { s.left = 6;   s.top = '50%';  s.transform = 'translateY(-50%)'; }
          if (dir === 'right') { s.right = 6;  s.top = '50%';  s.transform = 'translateY(-50%)'; }
          return <span key={dir} style={s}>{dir === 'up' ? '▲' : dir === 'down' ? '▼' : dir === 'left' ? '◀' : '▶'}</span>;
        })}

        {/* Knob */}
        <div
          ref={joystickKnobRef}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(255,215,0,0.75)',
            border: '2px solid rgba(255,215,0,0.9)',
            pointerEvents: 'none',
            transition: 'transform 0.05s',
          }}
        />
      </div>

      {/* Fire button — bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          right: 28,
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: fireActive.current ? 'rgba(220,38,38,0.9)' : 'rgba(220,38,38,0.6)',
          border: '3px solid rgba(255,80,80,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          touchAction: 'none',
          color: '#fff',
          fontSize: 28,
          fontWeight: 'bold',
          fontFamily: 'monospace',
          userSelect: 'none',
          boxShadow: '0 0 20px rgba(220,38,38,0.4)',
        }}
        onTouchStart={e => {
          e.preventDefault();
          fireActive.current = true;
          inputRef.current = { ...inputRef.current, fire: true };
        }}
        onTouchEnd={e => {
          e.preventDefault();
          fireActive.current = false;
          inputRef.current = { ...inputRef.current, fire: false };
        }}
        onTouchCancel={e => {
          e.preventDefault();
          fireActive.current = false;
          inputRef.current = { ...inputRef.current, fire: false };
        }}
      >
        🔥
      </div>
    </div>
  );
}
