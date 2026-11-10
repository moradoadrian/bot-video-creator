import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { clavesDe, momentosClave } from '../momentos';
import { BORDE, EDITOR, FONDO, MONO, TENUE, TEXTO, TINTA, TITULO } from '../temaCodigo';
import { ItemVisual, Palabra, Visual } from '../types';
import { IconoCirculo } from './IconosCodigo';

type Props = {
  visual: Visual;
  narracion: string;
  duracionSeg: number;
  palabras?: Palabra[];
  paleta: string[];
  acento: string;
  ancho: number;
  alto: number;
};

type Ctx = { frame: number; fps: number; t: number };

/** 0 antes del segundo `desde`; luego un resorte hacia 1. */
const entrada = ({ frame, fps }: Ctx, desde: number, rigido = 170) => {
  const f0 = Math.round(desde * fps);
  return frame < f0 ? 0 : spring({ frame: frame - f0, fps, config: { damping: 14, stiffness: rigido } });
};

const pop = (s: number, dy = 30): React.CSSProperties => ({
  opacity: Math.min(1, s * 1.4),
  transform: `translateY(${(1 - s) * dy}px) scale(${0.82 + 0.18 * s})`,
});

const fijar = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const Textos: React.FC<{ item: ItemVisual; tam: number; centro?: boolean; color?: string; tenue?: string }> = ({
  item,
  tam,
  centro,
  color = TINTA,
  tenue = TENUE,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: centro ? 'center' : 'left', minWidth: 0 }}>
    <div style={{ fontFamily: TITULO, fontWeight: 800, fontSize: tam, lineHeight: 1.0, color, textWrap: 'balance' }}>{item.texto}</div>
    {item.detalle && (
      <div style={{ fontFamily: TEXTO, fontWeight: 800, fontSize: tam * 0.62, lineHeight: 1.15, color: tenue }}>{item.detalle}</div>
    )}
  </div>
);

const tarjeta = (color: string, activa: boolean): React.CSSProperties => ({
  background: EDITOR,
  borderRadius: 30,
  border: `3px solid ${activa ? color : BORDE}`,
  boxShadow: activa ? `10px 10px 0 ${color}` : `6px 6px 0 ${color}55`,
});

/** Índice del último elemento que ya apareció; -1 si ninguno. */
const ultimo = (ms: number[], t: number) => ms.reduce((acc, m, i) => (m <= t ? i : acc), -1);

const Tarjetas: React.FC<{ v: Extract<Visual, { tipo: 'tarjetas' }>; ms: number[]; c: Ctx; paleta: string[]; acento: string; alto: number }> = ({
  v,
  ms,
  c,
  paleta,
  acento,
}) => {
  const n = v.items.length;
  const enCuadricula = n >= 4;
  const tEtiquetas = v.etiquetas ? ms[n] : Infinity;
  const activa = c.t < tEtiquetas ? ultimo(ms.slice(0, n), c.t) : -1;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 44 }}>
      <div style={{ display: 'grid', gridTemplateColumns: enCuadricula ? '1fr 1fr' : '1fr', gap: 26 }}>
        {v.items.map((item, i) => {
          const color = paleta[i % paleta.length];
          const s = entrada(c, ms[i]);
          return (
            <div
              key={i}
              style={{
                ...tarjeta(color, i === activa),
                ...pop(s),
                display: 'flex',
                flexDirection: enCuadricula ? 'column' : 'row',
                alignItems: 'center',
                gap: enCuadricula ? 18 : 28,
                padding: enCuadricula ? '30px 20px 28px' : '24px 30px',
              }}
            >
              <IconoCirculo tipo={item.icono} fondo={color} tinta={FONDO} size={enCuadricula ? 116 : 104} />
              <Textos item={item} tam={enCuadricula ? 46 : 50} centro={enCuadricula} />
            </div>
          );
        })}
      </div>
      {v.etiquetas && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: interpolate(c.t, [tEtiquetas - 0.1, tEtiquetas + 0.2], [0, 1], fijar) }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: TENUE }}>
            {(v.etiquetas.titulo ?? 'Tecnologías').toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {v.etiquetas.lista.map((e, i) => {
              const s = entrada(c, tEtiquetas + i * 0.22, 220);
              return (
                <div
                  key={e}
                  style={{
                    ...pop(s, 20),
                    fontFamily: MONO,
                    fontWeight: 700,
                    fontSize: 36,
                    color: acento,
                    background: `${acento}22`,
                    border: `3px solid ${acento}`,
                    borderRadius: 999,
                    padding: '10px 26px',
                  }}
                >
                  {e}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/** Punto sobre una polilínea según su avance (0–1). */
const sobreLinea = (pts: [number, number][], p: number): [number, number] => {
  const largos = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  let resto = p * largos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < largos.length; i++) {
    if (resto <= largos[i]) {
      const f = largos[i] ? resto / largos[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    }
    resto -= largos[i];
  }
  return pts[pts.length - 1];
};

const Paquete: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <>
    <circle cx={x} cy={y} r={30} fill={color} opacity={0.25} />
    <circle cx={x} cy={y} r={16} fill={color} />
  </>
);

const Flujo: React.FC<{ v: Extract<Visual, { tipo: 'flujo' }>; ms: number[]; c: Ctx; paleta: string[]; acento: string; ancho: number; alto: number }> = ({
  v,
  ms,
  c,
  paleta,
  acento,
  ancho,
  alto,
}) => {
  const n = v.pasos.length;
  const NODO = n >= 5 ? 112 : 128;
  const HUECO = n >= 5 ? 50 : 70;
  const AVISO = 112;
  const colW = v.regreso ? ancho - 180 : ancho;
  const total = n * NODO + (n - 1) * HUECO + (v.final ? 36 + AVISO : 0);
  const y0 = Math.max(0, (alto - total) / 2);
  const arriba = (i: number) => y0 + i * (NODO + HUECO);
  const centro = (i: number) => arriba(i) + NODO / 2;
  const xIcono = 24 + 46;
  const VIAJE = 0.45;

  const tRegreso = v.regreso ? ms[n] : Infinity;
  const DUR_REGRESO = 1.3;
  const tFinal = v.final ? ms[n + (v.regreso ? 1 : 0)] : Infinity;
  const pRegreso = interpolate(c.t, [tRegreso, tRegreso + DUR_REGRESO], [0, 1], fijar);
  const activa = c.t < tRegreso ? ultimo(ms.slice(0, n), c.t) : pRegreso >= 1 ? 0 : -1;

  const xRegreso = colW + 80;
  const ruta: [number, number][] = [
    [colW + 6, centro(n - 1)],
    [xRegreso, centro(n - 1)],
    [xRegreso, centro(0)],
    [colW + 18, centro(0)],
  ];

  // Paquete: baja entre pasos justo antes de que se nombre el siguiente.
  let paquete: [number, number] | null = null;
  for (let i = 0; i < n - 1; i++) {
    const p = interpolate(c.t, [ms[i + 1] - VIAJE, ms[i + 1]], [0, 1], fijar);
    if (p > 0 && p < 1) paquete = [xIcono, arriba(i) + NODO + (arriba(i + 1) - arriba(i) - NODO) * p];
  }
  if (pRegreso > 0 && pRegreso < 1) paquete = sobreLinea(ruta, pRegreso);

  return (
    <div style={{ position: 'relative', width: ancho, height: alto }}>
      {v.pasos.map((item, i) => {
        const color = paleta[i % paleta.length];
        const s = entrada(c, ms[i]);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: arriba(i),
              left: 0,
              width: colW,
              height: NODO,
              ...tarjeta(color, i === activa),
              ...pop(s),
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              padding: '0 26px 0 24px',
              boxSizing: 'border-box',
            }}
          >
            <IconoCirculo tipo={item.icono} fondo={color} tinta={FONDO} size={92} />
            <Textos item={item} tam={NODO >= 128 ? 48 : 44} />
          </div>
        );
      })}

      <svg width={ancho} height={alto} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {v.pasos.slice(1).map((_, k) => {
          const y1 = arriba(k) + NODO + 6;
          const y2 = arriba(k + 1) - 8;
          const p = interpolate(c.t, [ms[k + 1] - VIAJE, ms[k + 1]], [0, 1], fijar);
          if (p <= 0) return null;
          const yp = y1 + (y2 - y1) * p;
          return (
            <g key={k} stroke={TENUE} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d={`M${xIcono} ${y1}V${yp}`} />
              {p >= 1 && <path d={`M${xIcono - 11} ${y2 - 11}L${xIcono} ${y2}L${xIcono + 11} ${y2 - 11}`} />}
            </g>
          );
        })}

        {v.regreso && pRegreso > 0 && (
          <g stroke={acento} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path
              d={`M${ruta.map((q) => q.join(' ')).join('L')}`}
              pathLength={1}
              strokeDasharray="0.03 0.025"
              strokeDashoffset={0}
              opacity={0.35}
            />
            <path d={`M${ruta.map((q) => q.join(' ')).join('L')}`} pathLength={1} strokeDasharray={`${pRegreso} 1`} />
            {pRegreso >= 1 && <path d={`M${colW + 30} ${centro(0) - 12}L${colW + 18} ${centro(0)}L${colW + 30} ${centro(0) + 12}`} />}
          </g>
        )}

        {paquete && <Paquete x={paquete[0]} y={paquete[1]} color={acento} />}
      </svg>

      {v.regreso && pRegreso > 0 && (
        <div
          style={{
            position: 'absolute',
            left: xRegreso + 46,
            top: (centro(0) + centro(n - 1)) / 2,
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            transformOrigin: 'center',
            whiteSpace: 'nowrap',
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 32,
            color: acento,
            opacity: Math.min(1, pRegreso * 3),
          }}
        >
          {v.regreso.texto}
        </div>
      )}

      {v.final && (
        <div
          style={{
            position: 'absolute',
            top: arriba(n - 1) + NODO + 36,
            left: 0,
            width: colW,
            height: AVISO,
            borderRadius: 28,
            background: acento,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            ...pop(entrada(c, tFinal, 240)),
          }}
        >
          <IconoCirculo tipo={v.final.icono ?? 'check'} fondo={FONDO} tinta={acento} size={74} />
          <Textos item={v.final} tam={46} color={FONDO} tenue={`${FONDO}bb`} />
        </div>
      )}
    </div>
  );
};

const Suma: React.FC<{ v: Extract<Visual, { tipo: 'suma' }>; ms: number[]; c: Ctx; paleta: string[]; acento: string; ancho: number }> = ({
  v,
  ms,
  c,
  paleta,
  acento,
  ancho,
}) => {
  const n = v.partes.length;
  const SIGNO = 78;
  const ancho1 = (ancho - (n - 1) * SIGNO) / n;
  const tRes = ms[n];
  const sRes = entrada(c, tRes, 200);
  const brillo = c.t >= tRes ? 30 + 18 * Math.sin(c.frame / 8) : 0;
  const signo = (txt: string, s: number) => (
    <div style={{ fontFamily: TITULO, fontWeight: 800, fontSize: 110, lineHeight: 1, color: TENUE, textAlign: 'center', ...pop(s, 10) }}>{txt}</div>
  );
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {v.partes.map((item, i) => {
          const color = paleta[i % paleta.length];
          return (
            <React.Fragment key={i}>
              {i > 0 && <div style={{ width: SIGNO, flex: `0 0 ${SIGNO}px` }}>{signo('+', entrada(c, ms[i] - 0.15))}</div>}
              <div
                style={{
                  width: ancho1,
                  height: 330,
                  boxSizing: 'border-box',
                  ...tarjeta(color, c.t < tRes && ultimo(ms.slice(0, n), c.t) === i),
                  ...pop(entrada(c, ms[i])),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 22,
                  padding: 20,
                }}
              >
                <IconoCirculo tipo={item.icono} fondo={color} tinta={FONDO} size={136} />
                <Textos item={item} tam={52} centro />
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {signo('=', entrada(c, tRes - 0.25))}
      <div
        style={{
          height: 240,
          borderRadius: 34,
          background: acento,
          boxShadow: `0 0 ${brillo}px ${acento}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 30,
          opacity: Math.min(1, sRes * 1.4),
          transform: `scale(${0.6 + 0.4 * sRes})`,
        }}
      >
        <IconoCirculo tipo={v.resultado.icono} fondo={FONDO} tinta={acento} size={140} />
        <Textos item={v.resultado} tam={78} color={FONDO} tenue={`${FONDO}bb`} />
      </div>
    </div>
  );
};

const Versus: React.FC<{ v: Extract<Visual, { tipo: 'versus' }>; ms: number[]; c: Ctx; paleta: string[]; ancho: number; alto: number }> = ({
  v,
  ms,
  c,
  paleta,
  ancho,
  alto,
}) => {
  const HUECO = 36;
  const w = (ancho - HUECO) / 2;
  const sVs = entrada(c, ms[1] - 0.2, 240);
  return (
    <div style={{ position: 'relative', width: ancho, height: alto, display: 'flex', gap: HUECO, alignItems: 'center' }}>
      {v.lados.map((item, i) => {
        const color = paleta[i % paleta.length];
        const s = entrada(c, ms[i]);
        return (
          <div
            key={i}
            style={{
              width: w,
              height: Math.min(alto, 520),
              boxSizing: 'border-box',
              ...tarjeta(color, ultimo(ms, c.t) === i),
              opacity: Math.min(1, s * 1.4),
              transform: `translateX(${(1 - s) * (i === 0 ? -90 : 90)}px)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 26,
              padding: 24,
            }}
          >
            <IconoCirculo tipo={item.icono} fondo={color} tinta={FONDO} size={Math.min(160, alto * 0.32)} />
            <Textos item={item} tam={56} centro />
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: ancho / 2 - 62,
          top: alto / 2 - 62,
          width: 124,
          height: 124,
          borderRadius: 62,
          background: TINTA,
          color: FONDO,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: TITULO,
          fontWeight: 800,
          fontSize: 54,
          border: `6px solid ${FONDO}`,
          opacity: Math.min(1, sVs * 1.4),
          transform: `scale(${sVs}) rotate(${(1 - sVs) * -30}deg)`,
        }}
      >
        VS
      </div>
    </div>
  );
};

/** Diagrama animado; cada elemento entra cuando la voz lo nombra. */
export const VisualVista: React.FC<Props> = ({ visual, narracion, duracionSeg, palabras, paleta, acento, ancho, alto }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c: Ctx = { frame, fps, t: frame / fps };
  // Se adelanta un poco: el elemento ya está en pantalla cuando se oye su nombre.
  const ms = momentosClave(clavesDe(visual), narracion, duracionSeg, palabras).map((m) => Math.max(0.05, m.t - 0.15));
  const comun = { ms, c, paleta, acento, ancho, alto };
  return (
    <div style={{ width: ancho, height: alto }}>
      {visual.tipo === 'tarjetas' && <Tarjetas v={visual} {...comun} />}
      {visual.tipo === 'flujo' && <Flujo v={visual} {...comun} />}
      {visual.tipo === 'suma' && <Suma v={visual} {...comun} />}
      {visual.tipo === 'versus' && <Versus v={visual} {...comun} />}
    </div>
  );
};
