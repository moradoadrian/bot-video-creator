import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { pasoEn } from '../../animaciones/pasos';
import { FONDO, MONO, SIN_LIGADURAS, TENUE, TINTA } from '../../temaCodigo';
import { CondicionCalculada } from '../../types';
import { LineaCodigo } from '../Resaltado';
import { ALARMA, MARGEN, Panel, Rotulo, VERDE, ajustar, destello, easeInOut, rebote } from './comun';
import { Estela, squash } from '../Movimiento';

type P = { x: number; y: number };
const bezier = (a: P, b: P, c: P, d: P, t: number): P => {
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y,
  };
};

/**
 * Un camino que llega a la condición y se bifurca. En cada evaluación real la ficha baja,
 * la condición se llena con los valores de ese momento y la ficha toma la rama verdadera o la falsa.
 */
export const Condicion: React.FC<{ c: CondicionCalculada; tiempos: number[]; acento: string; ancho: number; alto: number; aparece: number }> = ({
  c,
  tiempos,
  acento,
  ancho,
  alto,
  aparece,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const sPanel = rebote(frame, fps, aparece, 140, 16);
  const actual = pasoEn(tiempos, t);

  const cx = ancho / 2;
  const dw = Math.min(ancho * 0.42, 230);
  const dh = 58;
  const cy = alto * 0.34;
  const arriba: P = { x: cx, y: 46 };
  const anchoRama = ancho * 0.44;
  const yRama = alto - MARGEN - 78;
  const ramas = {
    si: { inicio: { x: cx - dw, y: cy }, fin: { x: cx - ancho * 0.24, y: yRama }, color: VERDE },
    no: { inicio: { x: cx + dw, y: cy }, fin: { x: cx + ancho * 0.24, y: yRama }, color: ALARMA },
  };
  const curva = (r: (typeof ramas)['si']) => [r.inicio, { x: r.inicio.x, y: (r.inicio.y + r.fin.y) / 2 + 20 }, { x: r.fin.x, y: r.inicio.y + 20 }, r.fin] as const;
  const d = (r: (typeof ramas)['si']) => {
    const [a, b, k, f] = curva(r);
    return `M ${a.x} ${a.y} C ${b.x} ${b.y}, ${k.x} ${k.y}, ${f.x} ${f.y}`;
  };

  /** Evaluación en curso en el segundo tt (la última que ya empezó a bajar) y dónde va la ficha. */
  const momento = (tt: number) => {
    let k = -1;
    c.evaluaciones.forEach((ev, i) => {
      if (tiempos[ev.paso] - 0.45 <= tt) k = i;
    });
    const ev = k >= 0 ? c.evaluaciones[k] : null;
    const tEv = ev ? tiempos[ev.paso] : Infinity;
    const siguiente = c.evaluaciones[k + 1] ? tiempos[c.evaluaciones[k + 1].paso] : Infinity;
    const escala = Math.min(1, (siguiente - tEv) / 1.3);
    const bajar = ev ? easeInOut((tt - (tEv - 0.45 * escala)) / (0.45 * escala)) : 0;
    const tomar = ev ? easeInOut((tt - (tEv + 0.25 * escala)) / (0.5 * escala)) : 0;
    const rama = ev ? ramas[ev.rama] : null;
    let ficha: P | null = null;
    if (ev) {
      // Baja hasta la punta del rombo (sin tapar la condición), recorre su borde hasta la rama y sigue la curva
      const punta = cy - dh - 6;
      if (tomar <= 0) ficha = { x: cx, y: arriba.y + (punta - arriba.y) * bajar };
      else {
        const [a, b, kk, f] = curva(rama!);
        ficha = tomar < 0.3 ? { x: cx + (a.x - cx) * (tomar / 0.3), y: punta + (a.y - punta) * (tomar / 0.3) } : bezier(a, b, kk, f, (tomar - 0.3) / 0.7);
      }
    }
    return { k, ev, tEv, escala, tomar, rama, ficha };
  };
  const { k, ev, tEv, escala, tomar, rama } = momento(t);
  const evaluada = ev !== null && t >= tEv;
  const golpe = destello(t, ev ? tEv : null, 0.4);
  const llego = ev !== null && tomar >= 1;
  const sLlego = llego ? destello(t, tEv + 0.75 * escala, 0.6) : 0;
  const aplasta = squash(t, ev ? tEv + 0.75 * escala : null, 0.8);

  const texto = evaluada && ev ? ev.sustituida : c.condicion;
  const fsCond = ajustar(texto, dw * 1.25, 30, 16);
  const resultado = ev ? (ev.rama === 'si' ? 'true' : 'false') : '';
  const fsRama = (s: string) => ajustar(s.replace(/^imprime /, ''), anchoRama - 24, 24, 14);
  const pasoActual = c.evaluaciones.filter((x) => x.paso <= actual).length;

  return (
    <Panel ancho={ancho} alto={alto} s={sPanel}>
      <Rotulo texto="if" s={sPanel} />
      {c.evaluaciones.length > 1 && (
        <div style={{ position: 'absolute', right: MARGEN + 4, top: MARGEN, fontFamily: MONO, fontSize: 22, color: TENUE, opacity: sPanel }}>
          vez {Math.max(1, pasoActual)} de {c.evaluaciones.length}
        </div>
      )}
      <svg width={ancho} height={alto} style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: sPanel }}>
        <line x1={cx} y1={arriba.y - 10} x2={cx} y2={cy - dh} stroke="rgba(244,241,255,0.25)" strokeWidth={6} strokeLinecap="round" />
        {(['si', 'no'] as const).map((r) => {
          const elegida = ev?.rama === r && tomar > 0;
          return (
            <path
              key={r}
              d={d(ramas[r])}
              fill="none"
              stroke={elegida ? ramas[r].color : 'rgba(244,241,255,0.2)'}
              strokeWidth={elegida ? 8 : 6}
              strokeLinecap="round"
              strokeDasharray={elegida ? undefined : '2 12'}
            />
          );
        })}
        {/* Rombo de la condición */}
        <path
          d={`M ${cx} ${cy - dh} L ${cx + dw} ${cy} L ${cx} ${cy + dh} L ${cx - dw} ${cy} Z`}
          fill={FONDO}
          stroke={evaluada && rama ? rama.color : acento}
          strokeWidth={4}
          strokeLinejoin="round"
          style={{ filter: golpe > 0 && rama ? `drop-shadow(0 0 ${18 * golpe}px ${rama.color})` : undefined }}
        />
      </svg>
      {/* La ficha viaja con estela (motion blur) */}
      <Estela
        dibujar={(f) => {
          const m = momento(f / fps);
          if (!m.ficha) return null;
          return (
            <svg width={ancho} height={alto} style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: sPanel }}>
              <g transform={`translate(${m.ficha.x} ${m.ficha.y})`}>
                <circle r={18} fill={TINTA} />
                <circle r={11} fill={m.rama && m.tomar > 0 ? m.rama.color : acento} />
              </g>
            </svg>
          );
        }}
      />
      {/* Texto de la condición: se llena con los valores al evaluarse */}
      <div
        style={{
          position: 'absolute',
          left: cx - dw * 0.7,
          width: dw * 1.4,
          top: cy - 22,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: MONO,
          fontWeight: 500,
          fontSize: fsCond,
          ...SIN_LIGADURAS,
          whiteSpace: 'pre',
          opacity: sPanel,
          transform: `scale(${1 + 0.12 * golpe})`,
        }}
      >
        <LineaCodigo linea={texto} />
      </div>
      {evaluada && rama && (
        <div
          style={{
            position: 'absolute',
            left: cx - 50,
            width: 100,
            top: cy + dh + 8,
            textAlign: 'center',
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 26,
            color: FONDO,
            background: rama.color,
            borderRadius: 10,
            transform: `scale(${0.6 + 0.4 * rebote(frame, fps, tEv, 260, 9)})`,
          }}
        >
          {resultado}
        </div>
      )}
      {/* Las dos ramas: lo que pasa si es verdadera y si es falsa */}
      {(['si', 'no'] as const).map((r) => {
        const texto = r === 'si' ? c.si : (c.no ?? 'sigue de largo');
        const activa = ev?.rama === r && llego;
        const apagada = ev !== null && llego && ev.rama !== r;
        return (
          <div
            key={r}
            style={{
              position: 'absolute',
              left: ramas[r].fin.x - anchoRama / 2,
              width: anchoRama,
              top: yRama + 6,
              opacity: sPanel * (apagada ? 0.4 : 1),
              // La caja de la rama elegida se aplasta al recibir la ficha
              transform: `scale(${(1 + (activa ? 0.08 * sLlego : 0)) * (activa ? aplasta.sx : 1)}, ${(1 + (activa ? 0.08 * sLlego : 0)) * (activa ? aplasta.sy : 1)})`,
            }}
          >
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20, color: ramas[r].color, textAlign: 'center', marginBottom: 4 }}>
              {r === 'si' ? 'true' : c.no ? 'false' : 'false: sin else'}
              {texto.startsWith('imprime ') ? ' · imprime' : ''}
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontWeight: 500,
                fontSize: fsRama(texto),
                ...SIN_LIGADURAS,
                whiteSpace: 'pre',
                textAlign: 'center',
                background: FONDO,
                border: `2px solid ${activa ? ramas[r].color : 'rgba(244,241,255,0.2)'}`,
                borderRadius: 12,
                padding: '6px 8px',
                boxShadow: activa ? `0 0 ${10 + 26 * sLlego}px ${ramas[r].color}` : 'none',
                color: TENUE,
              }}
            >
              {r === 'no' && !c.no ? (
                texto
              ) : texto.startsWith('imprime ') ? (
                <LineaCodigo linea={texto.slice(8)} />
              ) : (
                <LineaCodigo linea={texto} />
              )}
            </div>
          </div>
        );
      })}
    </Panel>
  );
};
