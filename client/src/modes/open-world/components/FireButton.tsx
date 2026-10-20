import React, { useState } from 'react';

interface FireButtonProps {
  /** True while the button is held; the game loop keeps firing at the cooldown rate */
  heldRef: React.MutableRefObject<boolean>;
}

const FireButton: React.FC<FireButtonProps> = ({ heldRef }) => {
  const [pressed, setPressed] = useState(false);

  // React registers touch listeners as passive, so `touch-action: none` in CSS blocks zoom/scroll instead
  const set = (value: boolean) => {
    heldRef.current = value;
    setPressed(value);
  };

  return (
    <div
      className={`mobile-fire-button${pressed ? ' pressed' : ''}`}
      onTouchStart={() => set(true)}
      onTouchEnd={() => set(false)}
      onTouchCancel={() => set(false)}
      aria-label="Fire"
    >
      🔥
    </div>
  );
};

export default FireButton;
