import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { pasoEn } from '../../animaciones/pasos';
import { FONDO, MONO, SIN_LIGADURAS, TENUE, TINTA } from '../../temaCodigo';
import { ObjetoCalculado } from '../../types';
import { LineaCodigo, SINTAXIS } from '../Resaltado';
import { ALARMA, MARGEN, Panel, Rotulo, ajustar, destello, fijar01, rebote, recortarValor } from './comun';

const ALTO_FILA = 48;

/**
 * Ficha de un objeto: al crearse, sus propiedades se despliegan una por una; una propiedad nueva
 * se despliega al final, una que cambia voltea su valor, y la que el código lee se ilumina.
 */
export const Objeto: React.FC<{ c: ObjetoCalculado; tiempos: number[]; acento: string; ancho: number; alto: number; aparece: number }> = ({
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
  const actual = pasoEn(tiempos, t);
  const sPanel = rebote(frame, fps, aparece, 140, 16);

  let e = -1;
  c.estados.forEach((s, i) => {
    if (s.paso <= actual) e = i;
  });
  const estado = e >= 0 ? c.estados[e] : null;
  const previo = e > 0 ? c.estados[e - 1] : null;
  const tEstado = estado ? tiempos[estado.paso] : 0;
  const tCrea = c.estados.length ? tiempos[c.estados[0].paso] : Infinity;
  const sFicha = rebote(frame, fps, tCrea - 0.15, 200, 12);
  // Antes de crearse, solo se ve el nombre esperando
  const sEspera = rebote(frame, fps, aparece + 0.1, 180, 12);

  // Cuándo apareció cada propiedad (para desplegarla en ese momento)
  const desdeProp = new Map<string, number>();
  c.estados.slice(0, e + 1).forEach((s, i) => {
    s.props.forEach((p, k) => {
      if (!desdeProp.has(p.clave)) desdeProp.set(p.clave, tiempos[s.paso] + (i === 0 ? 0.12 * k : 0));
    });
  });
  const props = estado?.props ?? [];
  const quitadas = previo ? previo.props.filter((p) => !props.some((x) => x.clave === p.clave)) : [];
  const filas = [...props.map((p) => ({ ...p, sale: false })), ...quitadas.map((p) => ({ ...p, sale: true }))];
  const lee = c.accesos[actual] ?? null;
  const tLee = lee ? tiempos[actual] : null;

  const anchoFicha = Math.min(ancho - 2 * MARGEN, 420);
  const izq = (ancho - anchoFicha) / 2;
  const altoFicha = 56 + filas.length * ALTO_FILA + 46;
  const arriba = Math.max(MARGEN + 34, (alto - altoFicha) / 2 + 10);
  const fsFila = (s: string) => ajustar(s, anchoFicha - 60, 28, 16);

  return (
    <Panel ancho={ancho} alto={alto} s={sPanel}>
      <Rotulo texto={`objeto ${c.nombre}`} s={sPanel} />
      <div
        style={{
          position: 'absolute',
          left: izq,
          top: arriba,
          width: anchoFicha,
          borderRadius: 20,
          border: `3px solid ${acento}`,
          background: FONDO,
          boxShadow: `8px 8px 0 ${acento}55`,
          // La ficha espera con su nombre; al crearse el objeto da un salto y se despliega
          opacity: Math.min(1, sEspera * 1.5),
          transform: `translateY(${(1 - sEspera) * 50}px) scale(${(0.8 + 0.2 * sEspera) * (t >= tCrea - 0.15 ? 1 + 0.08 * Math.sin(Math.PI * sFicha) : 1)})`,
          transformOrigin: '50% 0%',
          perspective: 600,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
            background: `${acento}26`,
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 28,
            color: TINTA,
            whiteSpace: 'pre',
            borderBottom: `2px solid ${acento}55`,
          }}
        >
          {c.nombre} <span style={{ color: SINTAXIS.signo }}>= {'{'}</span>
        </div>
        {filas.map((p) => {
          const t0 = desdeProp.get(p.clave) ?? tEstado;
          const despliega = p.sale ? 1 - fijar01((t - tEstado) / 0.35) : fijar01((t - t0) / 0.35);
          const previoValor = previo?.props.find((x) => x.clave === p.clave)?.valor;
          const cambio = !p.sale && previoValor !== undefined && previoValor !== p.valor ? destello(t, tEstado, 0.6) : 0;
          const volteo = cambio > 0 ? Math.max(0, 1 - (t - tEstado) / 0.3) : 0;
          const leida = lee === p.clave && !p.sale;
          const sLee = leida ? destello(t, tLee, 0.5) : 0;
          const texto = `${p.clave}: ${recortarValor(volteo > 0.5 && previoValor ? previoValor : p.valor, 16)}`;
          return (
            <div
              key={p.clave}
              style={{
                height: ALTO_FILA * Math.min(1, despliega * 1.4),
                display: 'flex',
                alignItems: 'center',
                padding: '0 18px',
                fontFamily: MONO,
                fontWeight: 500,
                fontSize: fsFila(texto),
                ...SIN_LIGADURAS,
                whiteSpace: 'pre',
                background: leida ? `${acento}30` : cambio ? `${acento}${Math.round(cambio * 60).toString(16).padStart(2, '0')}` : 'transparent',
                boxShadow: leida ? `inset 6px 0 0 ${acento}` : 'none',
                transform: `rotateX(${(1 - despliega) * -90 + volteo * 90}deg) scale(${1 + 0.05 * sLee})`,
                transformOrigin: '50% 0%',
                opacity: despliega,
                color: p.sale ? ALARMA : TINTA,
              }}
            >
              <LineaCodigo linea={texto} />
              {leida && <span style={{ marginLeft: 'auto', fontSize: 20, color: acento, fontWeight: 700 }}>lee</span>}
            </div>
          );
        })}
        <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 18px', fontFamily: MONO, fontSize: 28, color: SINTAXIS.signo }}>{'}'}</div>
      </div>
      {estado && e > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: MARGEN,
            textAlign: 'center',
            fontFamily: MONO,
            fontSize: 22,
            color: TENUE,
            opacity: destello(t, tEstado, 1.2),
          }}
        >
          {quitadas.length ? 'se borró una propiedad' : props.length > (previo?.props.length ?? 0) ? 'propiedad nueva' : 'cambió un valor'}
        </div>
      )}
    </Panel>
  );
};
