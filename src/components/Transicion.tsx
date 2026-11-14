/**
 * Transición con sentido entre dos bloques: la pieza de la escena que termina despega, se
 * transforma (morph de su contorno con @remotion/paths) en una estrella al centro, cambia de
 * número justo en el corte y aterriza transformada en la pieza de la escena siguiente.
 * Deja una estela al moverse rápido y un anillo en el momento del corte.
 */
import { interpolatePath, translatePath } from '@remotion/paths';
import { makeRect, makeStar } from '@remotion/shapes';
import React from 'react';
import { AbsoluteFill, interpolateColors, useCurrentFrame } from 'remotion';
import { FONDO, MONO, SIN_LIGADURAS } from '../temaCodigo';
import { CENTRO, Pieza } from '../transiciones';

const fijar01 = (x: number) => Math.min(1, Math.max(0, x));
const easeIn = (x: number) => fijar01(x) ** 3;
/** Llega con un poco de exceso y se asienta (overshoot). */
const easeOutBack = (x: number) => {
  const p = fijar01(x) - 1;
  return 1 + 2.2 * p ** 3 + 1.2 * p ** 2;
};

const contorno = (p: Pieza) => {
  const r = Math.min(p.radio, p.alto / 2, p.ancho / 2);
  return translatePath(makeRect({ width: p.ancho, height: p.alto, cornerRadius: r }).path, p.x, p.y);
};

const ESTRELLA = translatePath(
  makeStar({ points: 9, innerRadius: CENTRO.ancho * 0.4, outerRadius: CENTRO.ancho / 2, cornerRadius: 14 }).path,
  CENTRO.x,
  CENTRO.y,
);

const mezcla = (a: Pieza, b: Pieza, p: number): Pieza => ({
  x: a.x + (b.x - a.x) * p,
  y: a.y + (b.y - a.y) * p,
  ancho: a.ancho + (b.ancho - a.ancho) * p,
  alto: a.alto + (b.alto - a.alto) * p,
  radio: a.radio + (b.radio - a.radio) * p,
});

export const Transicion: React.FC<{
  desde: Pieza;
  hacia: Pieza;
  colorDesde: string;
  colorHacia: string;
  textoDesde: string;
  textoHacia: string;
  antes: number;
  despues: number;
}> = ({ desde, hacia, colorDesde, colorHacia, textoDesde, textoHacia, antes, despues }) => {
  const frame = useCurrentFrame();

  /** Forma, caja y color en el frame f (puede ser fraccionario, para la estela). */
  const estado = (f: number) => {
    if (f < antes) {
      const p = easeIn(f / antes);
      return { d: interpolatePath(p, contorno(desde), ESTRELLA), caja: mezcla(desde, CENTRO, p), color: colorDesde, p: p * 0.5 };
    }
    const p = easeOutBack((f - antes) / despues);
    return {
      d: interpolatePath(fijar01(p), ESTRELLA, contorno(hacia)),
      caja: mezcla(CENTRO, hacia, p),
      color: interpolateColors(fijar01((f - antes) / (despues * 0.6)), [0, 1], [colorDesde, colorHacia]),
      p: 0.5 + 0.5 * fijar01(p),
    };
  };

  const ahora = estado(frame);
  // Al aterrizar le cede el lugar a la pieza real de inmediato, para que no se vea doble
  const desvanece = 1 - fijar01((frame - antes - despues + 1) / 2);
  // El número cambia justo en el corte, volteándose
  const giro = Math.abs(frame - antes) < 3 ? Math.abs(frame - antes) / 3 : 1;
  const texto = frame < antes ? textoDesde : textoHacia;
  const fs = Math.min(ahora.caja.alto * 0.55, ahora.caja.ancho / Math.max(1, texto.length * 0.6 + 0.6));
  const anillo = frame >= antes ? fijar01((frame - antes) / 10) : 0;
  const estela = [1.5, 3, 4.5].map((k, i) => ({ ...estado(Math.max(0, frame - k)), o: [0.22, 0.12, 0.05][i] }));

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: desvanece }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {frame >= antes && anillo < 1 && (
          <circle
            cx={CENTRO.x + CENTRO.ancho / 2}
            cy={CENTRO.y + CENTRO.alto / 2}
            r={100 + 200 * anillo}
            fill="none"
            stroke={colorHacia}
            strokeWidth={10 * (1 - anillo)}
            opacity={1 - anillo}
          />
        )}
        {estela.map((e, i) => (
          <path key={i} d={e.d} fill={e.color} opacity={e.o} />
        ))}
        <path d={ahora.d} fill={ahora.color} stroke={FONDO} strokeWidth={3} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: ahora.caja.x,
          top: ahora.caja.y,
          width: ahora.caja.ancho,
          height: ahora.caja.alto,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: fs,
          color: FONDO,
          whiteSpace: 'pre',
          ...SIN_LIGADURAS,
          transform: `scaleY(${giro})`,
        }}
      >
        {texto}
      </div>
    </AbsoluteFill>
  );
};
