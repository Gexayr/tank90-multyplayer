import { useRef, useMemo, useState, useEffect } from 'react';

export const useInput = () => {
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const isTouchDevice = useMemo(() => typeof window !== 'undefined' && ('ontouchstart' in window || (navigator as any).maxTouchPoints > 0), []);
  
  // Joystick state
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickCenter, setJoystickCenter] = useState<{ x: number; y: number } | null>(null);
  const [joystickKnob, setJoystickKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickAngleRef = useRef<number | null>(null);
  const joystickMagnitudeRef = useRef<number>(0);
  const joystickVecRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '.' || e.key === 'Period') {
        e.preventDefault();
        return;
      }
      keysRef.current[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === '.' || e.key === 'Period') return;
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleJoystickStart = (e: React.TouchEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setJoystickCenter(center);
    setJoystickActive(true);
    setJoystickKnob({ x: 0, y: 0 });
    joystickAngleRef.current = null;
    joystickMagnitudeRef.current = 0;
    joystickVecRef.current = { x: 0, y: 0 };
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!joystickCenter) return;
    const dx = touch.clientX - joystickCenter.x;
    const dy = touch.clientY - joystickCenter.y;
    const maxRadius = 50;
    const dist = Math.min(Math.hypot(dx, dy), maxRadius);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * dist;
    const ny = Math.sin(angle) * dist;
    setJoystickKnob({ x: nx, y: ny });
    joystickAngleRef.current = angle;
    joystickMagnitudeRef.current = dist / maxRadius;
    joystickVecRef.current = { x: Math.cos(angle) * (dist / maxRadius), y: Math.sin(angle) * (dist / maxRadius) };
  };

  const handleJoystickEnd = () => {
    setJoystickActive(false);
    setJoystickKnob({ x: 0, y: 0 });
    joystickAngleRef.current = null;
    joystickMagnitudeRef.current = 0;
    joystickVecRef.current = { x: 0, y: 0 };
  };

  return {
    keysRef,
    isTouchDevice,
    joystickActive,
    joystickKnob,
    joystickMagnitudeRef,
    joystickVecRef,
    handleJoystickStart,
    handleJoystickMove,
    handleJoystickEnd
  };
};
