/**
 * Detalles de movimiento compartidos: squash and stretch al aterrizar y explosiones de
 * partículas en los momentos de éxito. Todo sale del frame actual y de random() con semilla.
 */
import { Trail } from '@remotion/motion-blur';
import React from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * Deformación al impactar en `t0`: se aplasta (más ancho, menos alto) y rebota amortiguado.
 * Devuelve las escalas para un transform; 1 y 1 fuera del medio segundo del impacto.
 */
export const squash = (t: number, t0: number | null | undefined, fuerza = 1) => {
  if (t0 === null || t0 === undefined) return { sx: 1, sy: 1 };
  const d = t - t0;
  if (d < 0 || d > 0.6) return { sx: 1, sy: 1 };
  const s = Math.exp(-d * 8) * Math.sin(d * 28 + 0.4) * 0.2 * fuerza;
  return { sx: 1 + s, sy: 1 - s };
};

/** Estiramiento en la dirección del movimiento mientras algo viaja rápido (v en px por segundo). */
export const estiramiento = (v: number, max = 0.35) => 1 + Math.min(max, Math.abs(v) / 4000);

const DURA = 0.95;

/**
 * Explosión de partículas en el segundo `desde` (del bloque), centrada en x, y:
 * confeti que gira y cae, chispas en forma de estrella, un destello y un anillo que se expande.
 */
export const Particulas: React.FC<{ desde: number; x: number; y: number; colores: string[]; semilla: string; cantidad?: number; fuerza?: number }> = ({
  desde,
  x,
  y,
  colores,
  semilla,
  cantidad = 26,
  fuerza = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = frame / fps - desde;
  if (d < 0 || d > DURA) return null;
  const p = d / DURA;
  const avance = 1 - (1 - p) ** 3;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none', zIndex: 5 }}>
      {/* Destello y anillo */}
      <div
        style={{
          position: 'absolute',
          left: x - 70 * fuerza,
          top: y - 70 * fuerza,
          width: 140 * fuerza,
          height: 140 * fuerza,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colores[0]}AA 0%, transparent 65%)`,
          opacity: Math.max(0, 1 - p * 3),
          transform: `scale(${0.4 + p * 1.6})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - 60 * fuerza,
          top: y - 60 * fuerza,
          width: 120 * fuerza,
          height: 120 * fuerza,
          borderRadius: '50%',
          border: `${Math.max(0.5, 6 * (1 - p))}px solid ${colores[1 % colores.length]}`,
          opacity: 1 - p,
          transform: `scale(${0.3 + avance * 2.2})`,
        }}
      />
      {Array.from({ length: cantidad }, (_, i) => {
        const r = (k: string) => random(`${semilla}-${i}-${k}`);
        const ang = r('a') * Math.PI * 2;
        const dist = (90 + r('d') * 240) * fuerza * avance;
        const tam = (9 + r('t') * 13) * Math.sqrt(fuerza);
        const tipo = r('k');
        const color = colores[i % colores.length];
        const px = x + Math.cos(ang) * dist;
        // Gravedad: cae más mientras más tiempo pasa
        const py = y + Math.sin(ang) * dist * 0.85 + 260 * p * p * fuerza;
        const giro = r('g') * 360 + d * (r('v') - 0.5) * 1400;
        const opacidad = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        if (tipo < 0.25) {
          // Chispa en estrella de cuatro puntas
          return (
            <svg key={i} width={tam * 2} height={tam * 2} viewBox="-10 -10 20 20" style={{ position: 'absolute', left: px - tam, top: py - tam, opacity: opacidad, transform: `rotate(${giro}deg) scale(${1 - p * 0.5})` }}>
              <path d="M0 -10 Q1.6 -1.6 10 0 Q1.6 1.6 0 10 Q-1.6 1.6 -10 0 Q-1.6 -1.6 0 -10 Z" fill={color} />
            </svg>
          );
        }
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px - tam / 2,
              top: py - tam / 2,
              width: tam,
              height: tipo < 0.6 ? tam * 0.45 : tam,
              borderRadius: tipo < 0.6 ? 3 : '50%',
              background: color,
              opacity: opacidad,
              // El confeti "voltea" al girar: se aplana y se ensancha
              transform: `rotate(${giro}deg) scaleX(${tipo < 0.6 ? Math.cos(d * 14 + i) : 1})`,
            }}
          />
        );
      })}
    </div>
  );
};

/** Dibuja según el frame que le toque (el de ahora o uno anterior, si es una capa de la estela). */
const Dibujo: React.FC<{ dibujar: (frame: number) => React.ReactNode }> = ({ dibujar }) => {
  const frame = useCurrentFrame();
  return <>{dibujar(frame)}</>;
};

/**
 * Estela de movimiento (motion blur) con @remotion/motion-blur: repite lo que se mueve unos
 * frames atrás, cada vez más tenue. `dibujar` recibe el frame y calcula la posición con él.
 * Solo para cosas pequeñas y rápidas: cada capa vuelve a dibujar el contenido.
 */
export const Estela: React.FC<{ dibujar: (frame: number) => React.ReactNode; capas?: number; retraso?: number; opacidad?: number }> = ({
  dibujar,
  capas = 4,
  retraso = 0.6,
  opacidad = 0.55,
}) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <Trail layers={capas} lagInFrames={retraso} trailOpacity={opacidad}>
      <AbsoluteFill>
        <Dibujo dibujar={dibujar} />
      </AbsoluteFill>
    </Trail>
  </AbsoluteFill>
);
