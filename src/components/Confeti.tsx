import React from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';

/** Confeti determinista que cae despacio por toda la pantalla. */
export const Confeti: React.FC<{ colores: string[]; cantidad?: number; seed?: string; intensidad?: number }> = ({
  colores,
  cantidad = 46,
  seed = 'confeti',
  intensidad = 1,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {new Array(cantidad).fill(0).map((_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const speed = (60 + r('s') * 90) * intensidad;
        const x0 = r('x') * width;
        const y = ((r('y') * (height + 200) + t * speed) % (height + 200)) - 100;
        const sway = Math.sin(t * (1 + r('w') * 1.5) + r('p') * 6) * 30;
        const rot = t * (90 + r('r') * 180) * (r('d') > 0.5 ? 1 : -1);
        const w = 14 + r('sz') * 16;
        const tipo = r('t');
        const color = colores[i % colores.length];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x0 + sway,
              top: y,
              width: w,
              height: tipo > 0.66 ? w : w * 0.45,
              borderRadius: tipo > 0.66 ? '50%' : 4,
              background: color,
              opacity: 0.8,
              transform: `rotate(${rot}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
