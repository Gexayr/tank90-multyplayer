import React from 'react';

interface MinimapProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  width: number;
  height: number;
}

const Minimap: React.FC<MinimapProps> = ({ canvasRef, width, height }) => {
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'fixed',
        right: '10px',
        bottom: '10px',
        width: width,
        height: height,
        opacity: 0.8,
        pointerEvents: 'none',
        zIndex: 1000,
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '4px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
      }}
    />
  );
};

export default Minimap;
