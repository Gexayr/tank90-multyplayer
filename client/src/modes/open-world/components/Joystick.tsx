import React, { useEffect, useRef } from 'react';

interface JoystickProps {
  /** Receives the heading in radians (0 = up, clockwise), null when released */
  headingRef: React.MutableRefObject<number | null>;
}

const DEAD_ZONE = 12;
const MAX_DRAG = 48;

/** Free-direction joystick: the tank drives wherever the stick points */
const Joystick: React.FC<JoystickProps> = ({ headingRef }) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;
    // Track one finger so holding the fire button doesn't move the stick
    let touchId: number | null = null;
    let center = { x: 0, y: 0 };

    const setKnob = (x: number, y: number) => {
      if (knobRef.current) knobRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    };

    const update = (cx: number, cy: number) => {
      const dx = cx - center.x;
      const dy = cy - center.y;
      const dist = Math.hypot(dx, dy);
      const k = dist > MAX_DRAG ? MAX_DRAG / dist : 1;
      setKnob(dx * k, dy * k);
      headingRef.current = dist < DEAD_ZONE ? null : (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
    };

    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      if (touchId !== null) return;
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      const rect = base.getBoundingClientRect();
      center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      update(touch.clientX, touch.clientY);
    };

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchId) update(t.clientX, t.clientY);
      }
    };

    const onEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== touchId) continue;
        touchId = null;
        headingRef.current = null;
        setKnob(0, 0);
      }
    };

    base.addEventListener('touchstart', onStart, { passive: false });
    base.addEventListener('touchmove', onMove, { passive: false });
    base.addEventListener('touchend', onEnd, { passive: false });
    base.addEventListener('touchcancel', onEnd, { passive: false });
    return () => {
      base.removeEventListener('touchstart', onStart);
      base.removeEventListener('touchmove', onMove);
      base.removeEventListener('touchend', onEnd);
      base.removeEventListener('touchcancel', onEnd);
      headingRef.current = null;
    };
  }, [headingRef]);

  return (
    <div ref={baseRef} className="mobile-joystick">
      <div ref={knobRef} className="mobile-joystick-knob" />
    </div>
  );
};

export default Joystick;
