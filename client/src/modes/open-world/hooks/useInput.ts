import { useRef, useMemo, useEffect } from 'react';
import type { MoveDirection } from '../game/CommandBuffer';

const KEY_DIRECTIONS: Record<string, MoveDirection> = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};

export const useInput = () => {
  const keysRef = useRef<{ [key: string]: boolean }>({});
  // Held direction keys, most recent last: between opposite keys the newest press wins
  const heldDirectionsRef = useRef<MoveDirection[]>([]);
  // Joystick heading in radians (0 = up, clockwise), null when released
  const joystickHeadingRef = useRef<number | null>(null);
  // Fire button held down on touch screens
  const fireHeldRef = useRef(false);
  const isTouchDevice = useMemo(() => typeof window !== 'undefined' && ('ontouchstart' in window || (navigator as any).maxTouchPoints > 0), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '.' || e.key === 'Period') {
        e.preventDefault();
        return;
      }
      keysRef.current[e.key] = true;
      const dir = KEY_DIRECTIONS[e.key];
      if (dir) {
        e.preventDefault();
        const held = heldDirectionsRef.current.filter((d) => d !== dir);
        held.push(dir);
        heldDirectionsRef.current = held;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === '.' || e.key === 'Period') return;
      keysRef.current[e.key] = false;
      const dir = KEY_DIRECTIONS[e.key];
      if (dir) {
        // Both WASD and arrows may hold the same direction
        const stillHeld = Object.entries(KEY_DIRECTIONS).some(([key, d]) => d === dir && keysRef.current[key]);
        if (!stillHeld) heldDirectionsRef.current = heldDirectionsRef.current.filter((d) => d !== dir);
      }
    };

    // Keys released while the tab is unfocused never fire keyup
    const handleBlur = () => {
      keysRef.current = {};
      heldDirectionsRef.current = [];
      joystickHeadingRef.current = null;
      fireHeldRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return {
    keysRef,
    heldDirectionsRef,
    joystickHeadingRef,
    fireHeldRef,
    isTouchDevice,
  };
};

/** Heading for the held keys (8 directions), or undefined when no direction key is held */
export function keyboardHeading(held: MoveDirection[]): number | undefined {
  let vertical = 0;
  let horizontal = 0;
  for (const d of held) {
    if (d === 'up') vertical = -1;
    else if (d === 'down') vertical = 1;
    else if (d === 'left') horizontal = -1;
    else horizontal = 1;
  }
  if (vertical === 0 && horizontal === 0) return undefined;
  return (Math.atan2(horizontal, -vertical) + Math.PI * 2) % (Math.PI * 2);
}
