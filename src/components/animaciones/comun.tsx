/** Piezas que comparten las animaciones por concepto. */
import React from 'react';
import { spring } from 'remotion';
import { EDITOR, FONDO, MONO, SIN_LIGADURAS, TENUE, segAFrames } from '../../temaCodigo';
import { LineaCodigo, SINTAXIS } from '../Resaltado';

export const ALARMA = '#FF5A6E';
export const VERDE = SINTAXIS.cadena;
export const MARGEN = 16;

export const fijar01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (x: number) => 1 - (1 - fijar01(x)) ** 3;
export const easeInOut = (x: number) => {
  const p = fijar01(x);
  return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
};

/** Rebote con overshoot que arranca en `desde` (segundos); 0 antes. */
export const rebote = (frame: number, fps: number, desde: number, rigido = 200, amortigua = 10) =>
  frame < segAFrames(desde, fps) ? 0 : spring({ frame: frame - segAFrames(desde, fps), fps, config: { damping: amortigua, stiffness: rigido } });

/** Destello que decae en `dura` segundos desde `desde`. */
export const destello = (t: number, desde: number | null | undefined, dura = 0.45) =>
  desde === null || desde === undefined || t < desde ? 0 : Math.max(0, 1 - (t - desde) / dura);

/** Tamaño de letra que hace caber `texto` en `ancho` px (monoespaciada, 0.6 em por carácter). */
export const ajustar = (texto: string, ancho: number, max: number, min = 16) => Math.max(min, Math.min(max, ancho / Math.max(1, texto.length * 0.6)));

export const recortarValor = (v: string, max = 14) => (v.length > max ? `${v.slice(0, max - 1)}…` : v);

/** Qué tipo de dato es un valor tal como lo escribe la traza. */
export const tipoDe = (v: string) =>
  v.startsWith('"') ? 'texto' : v === 'true' || v === 'false' ? 'booleano' : v.startsWith('[') ? 'arreglo' : v.startsWith('{') ? 'objeto' : v === 'undefined' || v === 'null' ? v : /^-?[\d.]+(e[+-]?\d+)?$/.test(v) || v === 'NaN' || v === 'Infinity' ? 'número' : 'otro';

/** Fondo del panel de la animación (va encima de la consola para que lo que vuela no quede detrás). */
export const Panel: React.FC<{ ancho: number; alto: number; s: number; borde?: string; brillo?: string; children: React.ReactNode }> = ({
  ancho,
  alto,
  s,
  borde,
  brillo,
  children,
}) => (
  <div style={{ position: 'relative', width: ancho, height: alto, zIndex: 2 }}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: EDITOR,
        borderRadius: 26,
        border: `2px solid ${borde ?? 'rgba(244,241,255,0.12)'}`,
        boxShadow: brillo ?? 'none',
        opacity: Math.min(1, s * 1.4),
        transform: `scale(${0.94 + 0.06 * s})`,
      }}
    />
    {children}
  </div>
);

/** Etiqueta pequeña arriba a la izquierda del panel: qué se está viendo. */
export const Rotulo: React.FC<{ texto: string; s: number }> = ({ texto, s }) => (
  <div
    style={{
      position: 'absolute',
      left: MARGEN + 4,
      top: MARGEN,
      fontFamily: MONO,
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: 2,
      color: TENUE,
      opacity: s,
      whiteSpace: 'pre',
    }}
  >
    {texto.toUpperCase()}
  </div>
);

/** Ficha con un valor o un trozo de código, coloreado como en el editor. */
export const Ficha: React.FC<{ codigo: string; fs: number; color: string; style?: React.CSSProperties; relleno?: string }> = ({
  codigo,
  fs,
  color,
  style,
  relleno,
}) => (
  <div
    style={{
      fontFamily: MONO,
      fontWeight: 500,
      fontSize: fs,
      ...SIN_LIGADURAS,
      whiteSpace: 'pre',
      background: relleno ?? FONDO,
      border: `2px solid ${color}`,
      borderRadius: 12,
      padding: '4px 12px',
      boxShadow: `4px 4px 0 ${color}`,
      ...style,
    }}
  >
    <LineaCodigo linea={codigo} />
  </div>
);
