import React from 'react';
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { clavesDe, momentosClave } from '../momentos';
import { BORDE, EDITOR, FONDO, MONO, TENUE, TEXTO, TINTA, TITULO } from '../temaCodigo';
import { ItemVisual, Palabra, Veredicto, Visual } from '../types';
import { IconoCirculo } from './IconosCodigo';
import {
  Curva,
  DUR_REGRESO,
  NODO_H,
  NODO_W,
  Punto,
  avanceRegreso,
  avanceTramo,
  camaraEn,
  geometria,
  llavesCamara,
  muestras,
  paqueteEn,
  puntoEnCurva,
  tiemposRecorrido,
} from '../recorrido';

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
  // Sin regreso, tRegreso es Infinity e interpolate no acepta rangos infinitos.
  const pRegreso = v.regreso ? interpolate(c.t, [tRegreso, tRegreso + DUR_REGRESO], [0, 1], fijar) : 0;
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

const trazo = (pts: Punto[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
const curvaD = ([a, b, c, d]: Curva) => `M${a.x} ${a.y} C${b.x} ${b.y} ${c.x} ${c.y} ${d.x} ${d.y}`;

/** Anillo que se expande y chispas que salen disparadas cuando el paquete llega a un paso. */
const Impacto: React.FC<{ centro: Punto; t: number; desde: number; color: string; w: number; h: number }> = ({ centro, t, desde, color, w, h }) => {
  const k = (t - desde) / 0.9;
  if (k < 0 || k > 1) return null;
  const sal = 1 - (1 - k) ** 3;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: centro.x - w / 2,
          top: centro.y - h / 2,
          width: w,
          height: h,
          borderRadius: 36,
          border: `5px solid ${color}`,
          opacity: 1 - k,
          transform: `scale(${1 + 0.28 * sal})`,
        }}
      />
      {Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2 + 0.3;
        const r = 120 + 200 * sal;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: centro.x + Math.cos(ang) * r * 1.4 - 7,
              top: centro.y + Math.sin(ang) * r * 0.7 - 7,
              width: 14,
              height: 14,
              borderRadius: 7,
              background: i % 3 === 0 ? TINTA : color,
              boxShadow: `0 0 14px ${color}`,
              opacity: 1 - k,
              transform: `scale(${1 - 0.6 * k})`,
            }}
          />
        );
      })}
    </>
  );
};

/**
 * Recorrido: los pasos viven en un mundo más grande que la pantalla y la cámara viaja por él
 * siguiendo a un paquete de luz. Antes de nombrarse, cada paso es una silueta del mapa.
 */
const Recorrido: React.FC<{
  v: Extract<Visual, { tipo: 'recorrido' }>;
  ms: number[];
  c: Ctx;
  paleta: string[];
  acento: string;
  ancho: number;
  alto: number;
  duracionSeg: number;
}> = ({ v, ms, c, paleta, acento, ancho, alto, duracionSeg }) => {
  const n = v.pasos.length;
  const g = geometria(n, !!v.regreso, !!v.final);
  const tm = tiemposRecorrido(ms, n, !!v.regreso, !!v.final);
  const cam = camaraEn(llavesCamara(g, tm, duracionSeg, ancho, alto), c.t);
  const paquete = paqueteEn(g, tm, c.t);
  const llegado = ultimo(tm.llegadas, c.t);
  const enRegreso = tm.regreso !== null && c.t >= tm.regreso;
  const { x0, y0, x1, y1 } = g.limites;
  /**
   * Se desvanece lo que se sale del recuadro. Con la cámara de la escena encima,
   * Chrome no recorta las tarjetas transformadas, así que no basta con overflow ni clip-path.
   */
  const enCuadro = (y: number, mitad: number) => {
    const arriba = alto / 2 + (y - mitad - cam.cy) * cam.escala;
    const abajo = alto / 2 + (y + mitad - cam.cy) * cam.escala;
    const fuera = Math.max(0, -arriba) + Math.max(0, abajo - alto);
    return Math.min(1, Math.max(0, 1 - fuera / ((abajo - arriba) * 0.35)));
  };
  const camara = (prof: number): React.CSSProperties => {
    // prof < 1: capa lejana, se mueve y escala menos (paralaje)
    const s = cam.escala ** prof;
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      transformOrigin: '0 0',
      transform: `translate(${ancho / 2}px, ${alto / 2}px) scale(${s}) translate(${-cam.cx * prof - 540 * (1 - prof)}px, ${-cam.cy * prof - ((y0 + y1) / 2) * (1 - prof)}px)`,
    };
  };

  return (
    <div
      style={{
        position: 'relative',
        width: ancho,
        height: alto,
        // clip-path y no overflow: con la máscara, Chrome dejaba asomar las tarjetas por fuera del recuadro
        clipPath: 'inset(0)',
        maskImage: 'linear-gradient(to bottom, transparent 0, #000 16%, #000 92%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 16%, #000 92%, transparent 100%)',
      }}
    >
      {/* Capa lejana: partículas luminosas que flotan */}
      <div style={camara(0.55)}>
        {Array.from({ length: 46 }, (_, i) => {
          const r = (k: string) => random(`recorrido-${i}-${k}`);
          const tam = 3 + r('t') * 7;
          const color = paleta[i % paleta.length];
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x0 - 700 + r('x') * (x1 - x0 + 1400),
                top: y0 - 900 + r('y') * (y1 - y0 + 1800) - c.t * (8 + r('v') * 18),
                width: tam,
                height: tam,
                borderRadius: tam,
                background: color,
                boxShadow: `0 0 ${tam * 3}px ${color}`,
                opacity: 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(c.t * (1 + r('f') * 2) + i)),
              }}
            />
          );
        })}
      </div>

      {/* El mundo */}
      <div style={camara(1)}>
        <svg
          width={x1 - x0 + 3000}
          height={y1 - y0 + 3000}
          style={{ position: 'absolute', left: x0 - 1500, top: y0 - 1500, overflow: 'visible' }}
        >
          <defs>
            <pattern id="rejilla-recorrido" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="2.6" fill="rgba(244,241,255,0.10)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rejilla-recorrido)" />
        </svg>

        {/* SVG con tamaño real: un drop-shadow sobre un SVG de 1×1 deja un rectángulo fantasma */}
        <svg
          width={x1 - x0 + 3000}
          height={y1 - y0 + 3000}
          style={{ position: 'absolute', left: x0 - 1500, top: y0 - 1500, overflow: 'visible' }}
        >
          <g transform={`translate(${1500 - x0} ${1500 - y0})`}>
          {g.tramos.map((cv, k) => (
            <path key={`g${k}`} d={curvaD(cv)} fill="none" stroke="rgba(244,241,255,0.16)" strokeWidth={6} strokeDasharray="4 18" strokeLinecap="round" />
          ))}
          {g.regreso && (
            <path d={curvaD(g.regreso)} fill="none" stroke="rgba(244,241,255,0.10)" strokeWidth={6} strokeDasharray="4 18" strokeLinecap="round" />
          )}
          {g.tramos.map((cv, k) => {
            const p = avanceTramo(tm, k + 1, c.t);
            if (p <= 0) return null;
            const color = paleta[(k + 1) % paleta.length];
            const d = trazo(muestras(cv, p));
            // Brillo sin filtros CSS: trazos anchos y transparentes debajo del trazo principal
            return (
              <g key={`l${k}`}>
                <path d={d} fill="none" stroke={color} strokeWidth={34} strokeLinecap="round" opacity={0.12} />
                <path d={d} fill="none" stroke={color} strokeWidth={20} strokeLinecap="round" opacity={0.25} />
                <path d={d} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
              </g>
            );
          })}
          {g.regreso && avanceRegreso(tm, c.t) > 0 && (
            <g>
              <path d={trazo(muestras(g.regreso, avanceRegreso(tm, c.t)))} fill="none" stroke={acento} strokeWidth={26} strokeLinecap="round" opacity={0.15} />
              <path
                d={trazo(muestras(g.regreso, avanceRegreso(tm, c.t)))}
                fill="none"
                stroke={acento}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray="22 16"
              />
            </g>
          )}
          {paquete && paquete.tam > 0 && (
            <g>
              {(() => {
                const p = puntoEnCurva(paquete.curva, paquete.p);
                return [70, 50, 36].map((r, k) => <circle key={`h${k}`} cx={p.x} cy={p.y} r={r * paquete.tam} fill={acento} opacity={0.08 + k * 0.06} />);
              })()}
              {[6, 5, 4, 3, 2, 1].map((k) => {
                const p = puntoEnCurva(paquete.curva, Math.max(0, paquete.p - k * 0.035));
                return <circle key={k} cx={p.x} cy={p.y} r={(20 - k * 2.4) * paquete.tam} fill={acento} opacity={0.5 - k * 0.07} />;
              })}
              {(() => {
                const p = puntoEnCurva(paquete.curva, paquete.p);
                return (
                  <>
                    <circle cx={p.x} cy={p.y} r={24 * paquete.tam} fill={acento} />
                    <circle cx={p.x} cy={p.y} r={10 * paquete.tam} fill={TINTA} />
                  </>
                );
              })()}
            </g>
          )}
          </g>
        </svg>

        {v.regreso && g.regreso && tm.regreso !== null && (() => {
          const p = puntoEnCurva(g.regreso, 0.5);
          const s = entrada(c, tm.regreso);
          return (
            <div
              style={{
                position: 'absolute',
                left: p.x - 150,
                top: p.y - 40,
                width: 300,
                display: 'flex',
                justifyContent: 'center',
                ...pop(s, 16),
                opacity: Math.min(1, s * 1.4) * enCuadro(p.y, 40),
              }}
            >
              <div style={{ fontFamily: TITULO, fontWeight: 800, fontSize: 40, color: FONDO, background: acento, borderRadius: 999, padding: '12px 30px' }}>
                {v.regreso.texto}
              </div>
            </div>
          );
        })()}

        {v.pasos.map((item, i) => {
          const color = paleta[i % paleta.length];
          const p = g.nodos[i];
          const s = entrada(c, tm.llegadas[i]);
          const activo = i === llegado && !enRegreso;
          const visible = enCuadro(p.y, NODO_H / 2);
          if (visible <= 0) return null;
          return (
            <div key={i} style={{ position: 'absolute', left: 0, top: 0, opacity: visible }}>
              {/* Silueta del mapa: el paso ya existe en el mundo, pero aún no se nombra */}
              <div
                style={{
                  position: 'absolute',
                  left: p.x - NODO_W / 2,
                  top: p.y - NODO_H / 2,
                  width: NODO_W,
                  height: NODO_H,
                  borderRadius: 30,
                  border: `3px dashed rgba(244,241,255,0.22)`,
                  opacity: 1 - s,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: p.x - NODO_W / 2,
                  top: p.y - NODO_H / 2,
                  width: NODO_W,
                  height: NODO_H,
                  boxSizing: 'border-box',
                  ...tarjeta(color, activo),
                  boxShadow: activo ? `10px 10px 0 ${color}, 0 0 60px ${color}66` : `6px 6px 0 ${color}55`,
                  opacity: Math.min(1, s * 1.4),
                  transform: `scale(${0.7 + 0.3 * s})`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 26,
                  padding: '0 28px 0 26px',
                }}
              >
                <IconoCirculo tipo={item.icono} fondo={color} tinta={FONDO} size={110} />
                <Textos item={item} tam={50} />
              </div>
              <Impacto centro={p} t={c.t} desde={tm.llegadas[i]} color={color} w={NODO_W} h={NODO_H} />
              {i === 0 && tm.regreso !== null && (
                <Impacto centro={p} t={c.t} desde={tm.regreso + DUR_REGRESO} color={acento} w={NODO_W} h={NODO_H} />
              )}
            </div>
          );
        })}

        {v.final && g.banner && tm.final !== null && (() => {
          const s = entrada(c, tm.final, 200);
          const brillo = c.t >= tm.final ? 30 + 18 * Math.sin(c.frame / 8) : 0;
          return (
            <div
              style={{
                position: 'absolute',
                left: g.banner.x - 380,
                top: g.banner.y - 70,
                width: 760,
                height: 140,
                borderRadius: 30,
                background: acento,
                boxShadow: `0 0 ${brillo}px ${acento}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
                opacity: Math.min(1, s * 1.4) * enCuadro(g.banner.y, 70),
                transform: `scale(${0.6 + 0.4 * s})`,
              }}
            >
              <IconoCirculo tipo={v.final.icono ?? 'check'} fondo={FONDO} tinta={acento} size={88} />
              <Textos item={v.final} tam={52} color={FONDO} tenue={`${FONDO}bb`} />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

/** Rojo de alarma: fallas, conexiones cortadas, rumores falsos. */
const ALARMA = '#FF5A6E';
const fijar01 = (x: number) => Math.min(1, Math.max(0, x));

/** Sacudida que se apaga sola: 0 fuera de [desde, desde + dur]. */
const sacudida = (t: number, desde: number, dur: number, amplitud: number, rapidez = 70) => {
  const k = (t - desde) / dur;
  return k < 0 || k > 1 ? 0 : Math.sin((t - desde) * rapidez) * amplitud * (1 - k);
};

/**
 * Red: un centro que manda señales a sus nodos. Cada nodo se conecta cuando la voz lo nombra
 * y por su línea viajan pulsos de luz. Con `falla`, el centro se pone en alarma y tiembla,
 * los pulsos se detienen, las líneas se cortan con una X y los nodos se apagan.
 */
const Red: React.FC<{ v: Extract<Visual, { tipo: 'red' }>; ms: number[]; c: Ctx; paleta: string[]; acento: string; ancho: number; alto: number }> = ({
  v,
  ms,
  c,
  paleta,
  acento,
  ancho,
  alto,
}) => {
  const n = v.nodos.length;
  const cx = ancho / 2;
  const cy = alto / 2;
  const NW = 230;
  const CW = 320;
  const rx = ancho / 2 - NW / 2 - 6;
  const ry = alto / 2 - 100;
  const giro = n % 2 === 0 ? Math.PI / n : 0;
  const pos = v.nodos.map((_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + giro;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
  const tCentro = ms[0];
  const tFalla = v.falla ? ms[n + 1] : Infinity;
  const fallo = c.t >= tFalla;
  const parpadeo = fallo && c.t < tFalla + 0.7 && c.frame % 4 < 2;
  const dx = fallo ? sacudida(c.t, tFalla, 0.7, 16) : 0;
  const sCentro = entrada(c, tCentro);
  const colorCentro = fallo ? ALARMA : acento;

  // Ondas de radar desde el centro: tranquilas antes de la falla, rápidas y rojas después
  const periodo = fallo ? 0.8 : 1.8;
  const desdeOndas = fallo ? tFalla : tCentro + 0.3;
  const ondas = c.t < desdeOndas ? [] : [0, 1, 2].map((k) => (((c.t - desdeOndas) / periodo + k / 3) % 1));

  return (
    <div style={{ position: 'relative', width: ancho, height: alto }}>
      <svg width={ancho} height={alto} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {ondas.map((k, i) => (
          <ellipse
            key={`o${i}`}
            cx={cx}
            cy={cy}
            rx={CW / 2 + k * rx * 0.9}
            ry={110 + k * ry * 0.9}
            fill="none"
            stroke={colorCentro}
            strokeWidth={fallo ? 5 : 3}
            opacity={(1 - k) * (fallo ? 0.45 : 0.22) * sCentro}
          />
        ))}
        {pos.map((p, i) => {
          const t0 = ms[i + 1];
          const avance = interpolate(c.t, [t0 - 0.35, t0], [0, 1], fijar);
          if (avance <= 0) return null;
          const color = paleta[(i + 1) % paleta.length];
          // La línea va del borde de la tarjeta central al borde del nodo, y la X queda en el hueco entre ambos
          const ddx = Math.abs(p.x - cx) || 1e-6;
          const ddy = Math.abs(p.y - cy) || 1e-6;
          const sale = Math.min(CW / 2 / ddx, 125 / ddy);
          const entra = 1 - Math.min(NW / 2 / ddx, 90 / ddy);
          const en = (f: number) => [cx + (p.x - cx) * f, cy + (p.y - cy) * f];
          const [ax, ay] = en(sale);
          const [bx, by] = en(Math.max(sale, entra));
          const d = `M${ax} ${ay}L${bx} ${by}`;
          const [mx, my] = en((sale + Math.max(sale, entra)) / 2);
          const sX = fallo ? entrada(c, tFalla + 0.1 + i * 0.09, 260) : 0;
          return (
            <g key={`l${i}`}>
              {fallo ? (
                <path d={d} stroke={ALARMA} strokeWidth={6} strokeDasharray="10 16" strokeLinecap="round" opacity={0.5} />
              ) : (
                <>
                  <path d={d} stroke={color} strokeWidth={22} strokeLinecap="round" opacity={0.1} pathLength={1} strokeDasharray={`${avance} 1`} />
                  <path d={d} stroke={color} strokeWidth={7} strokeLinecap="round" opacity={0.75} pathLength={1} strokeDasharray={`${avance} 1`} />
                </>
              )}
              {!fallo &&
                avance >= 1 &&
                [0, 0.5].map((k) => {
                  const f = ((c.t - t0) / 1.3 + k + i * 0.13) % 1;
                  return (
                    <circle
                      key={k}
                      cx={ax + (bx - ax) * f}
                      cy={ay + (by - ay) * f}
                      r={11}
                      fill={TINTA}
                      stroke={color}
                      strokeWidth={6}
                      opacity={Math.sin(f * Math.PI)}
                    />
                  );
                })}
              {sX > 0 && (
                <g transform={`translate(${mx} ${my}) scale(${sX}) rotate(${(1 - sX) * 90})`}>
                  <circle r={34} fill={FONDO} stroke={ALARMA} strokeWidth={5} />
                  <path d="M-14 -14L14 14M14 -14L-14 14" stroke={ALARMA} strokeWidth={7} strokeLinecap="round" />
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {v.nodos.map((item, i) => {
        const color = paleta[(i + 1) % paleta.length];
        const s = entrada(c, ms[i + 1]);
        const apagado = fallo ? interpolate(c.t, [tFalla + 0.1 + i * 0.09, tFalla + 0.5 + i * 0.09], [1, 0.55], fijar) : 1;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: pos[i].x - NW / 2,
              top: pos[i].y - 90,
              width: NW,
              height: 180,
              boxSizing: 'border-box',
              ...tarjeta(fallo ? BORDE : color, false),
              boxShadow: fallo ? 'none' : `6px 6px 0 ${color}55`,
              ...pop(s),
              opacity: Math.min(1, s * 1.4) * apagado,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: 14,
            }}
          >
            <IconoCirculo tipo={item.icono} fondo={fallo ? TENUE : color} tinta={FONDO} size={78} />
            <Textos item={item} tam={36} centro />
          </div>
        );
      })}

      <div
        style={{
          position: 'absolute',
          left: cx - CW / 2 + dx,
          top: cy - 125,
          width: CW,
          height: 250,
          boxSizing: 'border-box',
          ...tarjeta(colorCentro, true),
          background: fallo ? `linear-gradient(${EDITOR}, ${ALARMA}33)` : EDITOR,
          boxShadow: `10px 10px 0 ${colorCentro}, 0 0 ${fallo ? 70 : 40}px ${colorCentro}66`,
          opacity: Math.min(1, sCentro * 1.4) * (parpadeo ? 0.45 : 1),
          transform: `scale(${0.6 + 0.4 * sCentro})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 18,
        }}
      >
        <IconoCirculo tipo={fallo ? 'alerta' : v.centro.icono} fondo={colorCentro} tinta={FONDO} size={100} />
        <Textos
          item={fallo && v.falla ? { texto: v.centro.texto, detalle: v.falla.texto } : v.centro}
          tam={44}
          centro
          tenue={fallo ? ALARMA : TENUE}
        />
      </div>
    </div>
  );
};

/**
 * Cascada: fichas en escalera. Cada una cae desde arriba cuando la voz la nombra, choca con la
 * anterior (que se sacude y queda ladeada, ya "caída") y suelta un impacto. Al final, el resultado.
 */
const Cascada: React.FC<{ v: Extract<Visual, { tipo: 'cascada' }>; ms: number[]; c: Ctx; paleta: string[]; acento: string; ancho: number; alto: number }> = ({
  v,
  ms,
  c,
  paleta,
  acento,
  ancho,
  alto,
}) => {
  const n = v.fichas.length;
  const STEP = n > 1 ? Math.min(70, (ancho * 0.28) / (n - 1)) : 0;
  const W = ancho - (n - 1) * STEP;
  const G = 20;
  const BANNER = v.final ? 130 : 0;
  const H = Math.min(160, (alto - BANNER - (v.final ? 36 : 0) - (n - 1) * G) / n);
  const total = n * H + (n - 1) * G + (v.final ? 36 + BANNER : 0);
  const y0 = Math.max(0, (alto - total) / 2);
  const tFinal = v.final ? ms[n] : Infinity;
  const activa = c.t < tFinal ? ultimo(ms.slice(0, n), c.t) : -1;
  /** La ficha "aterriza" un poco después de empezar a caer. */
  const ATERRIZA = 0.16;

  return (
    <div style={{ position: 'relative', width: ancho, height: alto }}>
      {v.fichas.map((item, i) => {
        const color = paleta[i % paleta.length];
        const s = entrada(c, ms[i], 210);
        // Golpe de la ficha siguiente al aterrizar sobre esta
        const tGolpe = i < n - 1 ? ms[i + 1] + ATERRIZA : Infinity;
        const golpeada = c.t >= tGolpe;
        const temblor = golpeada ? sacudida(c.t, tGolpe, 0.8, 7, 28) : 0;
        const ladeo = golpeada ? 3.5 * fijar01((c.t - tGolpe) / 0.3) * (i % 2 ? -1 : 1) : 0;
        const left = i * STEP;
        const top = y0 + i * (H + G);
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left,
                top,
                width: W,
                height: H,
                boxSizing: 'border-box',
                ...tarjeta(golpeada ? ALARMA : color, i === activa),
                opacity: Math.min(1, s * 1.6) * (golpeada ? 0.82 : 1),
                transform: `translateY(${(1 - s) * -170}px) rotate(${(1 - s) * -16 + temblor + ladeo}deg)`,
                transformOrigin: i % 2 ? '100% 100%' : '0% 100%',
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                padding: '0 26px 0 22px',
              }}
            >
              <IconoCirculo tipo={item.icono} fondo={golpeada ? ALARMA : color} tinta={FONDO} size={Math.min(92, H - 30)} />
              <Textos item={item} tam={H >= 140 ? 46 : 40} />
            </div>
            {i > 0 && (
              <Impacto
                centro={{ x: (i - 1) * STEP + W / 2, y: y0 + (i - 1) * (H + G) + H / 2 }}
                t={c.t}
                desde={ms[i] + ATERRIZA}
                color={ALARMA}
                w={W}
                h={H}
              />
            )}
          </React.Fragment>
        );
      })}

      {v.final && (() => {
        const s = entrada(c, tFinal, 200);
        const brillo = c.t >= tFinal ? 30 + 18 * Math.sin(c.frame / 8) : 0;
        return (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: y0 + n * (H + G) - G + 36,
              width: ancho,
              height: BANNER,
              borderRadius: 30,
              background: acento,
              boxShadow: `0 0 ${brillo}px ${acento}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 22,
              opacity: Math.min(1, s * 1.4),
              transform: `translateX(${sacudida(c.t, tFinal + 0.1, 0.6, 12)}px) scale(${0.6 + 0.4 * s})`,
            }}
          >
            <IconoCirculo tipo={v.final.icono ?? 'reloj'} fondo={FONDO} tinta={acento} size={84} />
            <Textos item={v.final} tam={48} color={FONDO} tenue={`${FONDO}bb`} />
          </div>
        );
      })()}
    </div>
  );
};

const SELLOS: Record<Veredicto, { texto: string; color: string }> = {
  confirmado: { texto: 'CONFIRMADO', color: '#7FD1B9' },
  'sin-pruebas': { texto: 'SIN PRUEBAS', color: '#FFB454' },
  falso: { texto: 'FALSO', color: ALARMA },
};

/**
 * Verificar: cada afirmación entra cuando la voz la nombra con un "verificando…" parpadeando,
 * y cuando la voz dice su `claveVeredicto` cae un sello de goma que la marca.
 */
const Verificar: React.FC<{ v: Extract<Visual, { tipo: 'verificar' }>; ms: number[]; c: Ctx; ancho: number; alto: number }> = ({ v, ms, c, ancho, alto }) => {
  const n = v.items.length;
  const G = 26;
  const H = Math.min(200, (alto - (n - 1) * G) / n);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: G, width: ancho }}>
      {v.items.map((item, i) => {
        const tAparece = ms[2 * i];
        const tSello = ms[2 * i + 1];
        const sello = SELLOS[item.veredicto];
        const s = entrada(c, tAparece);
        const sS = entrada(c, tSello, 260);
        const sellado = c.t >= tSello;
        const dy = sellado ? sacudida(c.t, tSello + 0.05, 0.3, 7, 60) : 0;
        const puntos = '.'.repeat(1 + (Math.floor(c.t * 3) % 3));
        return (
          <div
            key={i}
            style={{
              position: 'relative',
              height: H,
              boxSizing: 'border-box',
              ...tarjeta(sellado ? sello.color : BORDE, sellado),
              boxShadow: sellado ? `10px 10px 0 ${sello.color}` : `6px 6px 0 ${TENUE}33`,
              ...pop(s),
              transform: `translateY(${(1 - s) * 30 + dy}px) scale(${0.82 + 0.18 * s})`,
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              // Espacio para el sello, que rotado y con borde mide más de lo que ocupa su texto
              padding: '0 315px 0 24px',
            }}
          >
            <IconoCirculo tipo={item.icono} fondo={sellado ? sello.color : TENUE} tinta={FONDO} size={Math.min(96, H - 40)} />
            <div style={{ flex: 1, minWidth: 0, opacity: sellado && item.veredicto !== 'confirmado' ? 0.7 : 1 }}>
              <Textos item={item} tam={44} />
            </div>
            {!sellado && c.t >= tAparece && (
              <div style={{ position: 'absolute', right: 34, fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: 2, color: TENUE, width: 220 }}>
                VERIFICANDO{puntos}
              </div>
            )}
            {sS > 0 && (
              <div
                style={{
                  position: 'absolute',
                  right: 22,
                  top: '50%',
                  fontFamily: MONO,
                  fontWeight: 800,
                  fontSize: 32,
                  letterSpacing: 2,
                  whiteSpace: 'nowrap',
                  color: sello.color,
                  background: `${sello.color}1F`,
                  border: `6px solid ${sello.color}`,
                  borderRadius: 14,
                  padding: '8px 14px',
                  opacity: Math.min(1, sS * 2),
                  transform: `translateY(-50%) rotate(-9deg) scale(${2.3 - 1.3 * sS})`,
                }}
              >
                {sello.texto}
              </div>
            )}
          </div>
        );
      })}
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
      {visual.tipo === 'recorrido' && <Recorrido v={visual} {...comun} duracionSeg={duracionSeg} />}
      {visual.tipo === 'red' && <Red v={visual} {...comun} />}
      {visual.tipo === 'cascada' && <Cascada v={visual} {...comun} />}
      {visual.tipo === 'verificar' && <Verificar v={visual} {...comun} />}
    </div>
  );
};
