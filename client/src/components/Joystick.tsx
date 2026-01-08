import React from 'react';

interface JoystickProps {
  joystickRef: React.RefObject<HTMLDivElement>;
  onStart: (e: React.TouchEvent) => void;
  onMove: (e: React.TouchEvent) => void;
  onEnd: () => void;
  knobPos: { x: number; y: number };
}

const Joystick: React.FC<JoystickProps> = ({ joystickRef, onStart, onMove, onEnd, knobPos }) => {
  return (
    <div
      ref={joystickRef}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      className="mobile-joystick"
      style={{
        position: 'fixed',
        left: 20,
        bottom: 20,
        width: 120,
        height: 120,
        borderRadius: 60,
        background: 'rgba(255,255,255,0.08)',
        border: '2px solid rgba(255,255,255,0.15)',
        zIndex: 1001,
        touchAction: 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 16,
          height: 16,
          marginLeft: -8,
          marginTop: -8,
          background: 'rgba(255,255,255,0.35)',
          borderRadius: 8,
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
        }}
      />
    </div>
  );
};

export default Joystick;
