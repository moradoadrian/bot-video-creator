import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { pasoEn } from '../../animaciones/pasos';
import { FONDO, MONO, TENUE, TINTA } from '../../temaCodigo';
import { ArregloCalculado, CeldaArreglo } from '../../types';
import { SINTAXIS } from '../Resaltado';
import { ALARMA, MARGEN, Panel, Rotulo, ajustar, destello, easeInOut, easeOut, rebote, recortarValor } from './comun';

const MOVER = 0.45;

/**
 * Fila de casillas con su índice. push entra por la derecha, pop sale volando, shift y unshift
 * recorren toda la fila, y una flecha marca la casilla que el código está leyendo.
 */
export const Arreglo: React.FC<{ c: ArregloCalculado; tiempos: number[]; acento: string; ancho: number; alto: number; aparece: number }> = ({
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
  const avance = estado ? easeInOut((t - tEstado) / MOVER) : 0;

  const maxCeldas = Math.max(4, ...c.estados.map((s) => s.celdas.length));
  const hueco = 10;
  const lado = Math.min(110, (ancho - 2 * MARGEN - hueco * (maxCeldas - 1)) / maxCeldas);
  const filaY = alto * 0.5 - lado / 2;
  const xDe = (i: number, n: number) => (ancho - (n * lado + (n - 1) * hueco)) / 2 + i * (lado + hueco);

  const celdas = estado?.celdas ?? [];
  const n = celdas.length;
  const nPrevio = previo?.celdas.length ?? n;
  const posPrevia = (cel: CeldaArreglo) => previo?.celdas.findIndex((p) => p.id === cel.id) ?? -1;
  // Casillas que acaban de salir (pop o shift): se van volando
  const salientes = previo && avance < 1 ? previo.celdas.filter((p) => !celdas.some((x) => x.id === p.id)) : [];

  // Flecha de lectura: la última casilla leída, que se apaga si el código deja de leer
  let foco: number | null = null;
  let tFoco = 0;
  for (let i = actual; i >= 0; i--) {
    if (c.foco[i] !== null && c.foco[i] !== undefined) {
      foco = c.foco[i];
      tFoco = tiempos[i];
      break;
    }
    if (i < actual - 2) break;
  }
  const leyendo = foco !== null && foco < n && c.foco[actual] !== null;
  const sFlecha = foco !== null && foco < n ? rebote(frame, fps, tFoco, 230, 12) : 0;

  const fs = (v: string) => ajustar(recortarValor(v, 8), lado - 14, 40, 16);
  const etiquetaAccion: Record<string, string> = { push: '.push()', pop: '.pop()', shift: '.shift()', unshift: '.unshift()', cambia: 'nuevo valor', crea: 'arreglo nuevo' };
  const sAccion = estado && e > 0 ? destello(t, tEstado, 1.1) : 0;

  return (
    <Panel ancho={ancho} alto={alto} s={sPanel}>
      <Rotulo texto={`arreglo ${c.nombre}`} s={sPanel} />
      <div
        style={{
          position: 'absolute',
          right: MARGEN + 4,
          top: MARGEN,
          fontFamily: MONO,
          fontWeight: 500,
          fontSize: 22,
          color: TENUE,
          opacity: sPanel,
          whiteSpace: 'pre',
        }}
      >
        length: <span style={{ color: SINTAXIS.numero, display: 'inline-block', transform: `scale(${1 + 0.4 * destello(t, tEstado, 0.4)})` }}>{n}</span>
      </div>
      {celdas.map((cel, i) => {
        const antes = posPrevia(cel);
        const nueva = antes < 0;
        const x0 = nueva ? xDe(i, n) + (estado!.accion === 'unshift' ? -lado : lado * 0.6) : xDe(antes, nPrevio);
        const x = x0 + (xDe(i, n) - x0) * avance;
        // Una casilla nueva cae desde arriba con rebote; las que ya estaban solo se recorren
        const sNueva = nueva ? rebote(frame, fps, tEstado + (estado!.accion === 'crea' ? i * 0.08 : 0), 220, 9) : 1;
        const cambio = !nueva && previo && previo.celdas[antes]?.valor !== cel.valor ? destello(t, tEstado, 0.5) : 0;
        const enFoco = leyendo && foco === i;
        const valorAnterior = !nueva && previo ? previo.celdas[antes]?.valor : undefined;
        const volteo = cambio > 0 ? Math.max(0, 1 - (t - tEstado) / 0.3) : 0;
        return (
          <React.Fragment key={cel.id}>
            <div
              style={{
                position: 'absolute',
                left: x,
                top: filaY - (1 - sNueva) * 120,
                width: lado,
                height: lado,
                borderRadius: 14,
                border: `3px solid ${enFoco ? acento : 'rgba(244,241,255,0.35)'}`,
                background: enFoco ? `${acento}33` : FONDO,
                boxShadow: enFoco ? `0 0 26px ${acento}` : cambio ? `0 0 ${30 * cambio}px ${acento}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: fs(cel.valor),
                color: cel.valor.startsWith('"') ? SINTAXIS.cadena : SINTAXIS.numero,
                opacity: Math.min(1, sNueva * 1.5),
                transform: `scale(${(0.6 + 0.4 * sNueva) * (enFoco ? 1.08 : 1)}) rotateX(${volteo * 90}deg)`,
                whiteSpace: 'pre',
              }}
            >
              {recortarValor(volteo > 0.5 && valorAnterior ? valorAnterior : cel.valor, 8)}
            </div>
            <div
              style={{
                position: 'absolute',
                left: x,
                width: lado,
                top: filaY + lado + 10,
                textAlign: 'center',
                fontFamily: MONO,
                fontWeight: 500,
                fontSize: 22,
                color: enFoco ? acento : TENUE,
                opacity: sNueva,
              }}
            >
              {i}
            </div>
          </React.Fragment>
        );
      })}
      {salientes.map((cel) => {
        const i = previo!.celdas.findIndex((p) => p.id === cel.id);
        const p = easeOut((t - tEstado) / 0.6);
        return (
          <div
            key={`sale-${cel.id}`}
            style={{
              position: 'absolute',
              left: xDe(i, nPrevio) + (estado!.accion === 'shift' ? -60 : 60) * p,
              top: filaY - 150 * p,
              width: lado,
              height: lado,
              borderRadius: 14,
              border: `3px solid ${ALARMA}`,
              background: FONDO,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: fs(cel.valor),
              color: TINTA,
              opacity: 1 - p,
              transform: `rotate(${(estado!.accion === 'shift' ? -25 : 25) * p}deg) scale(${1 - 0.3 * p})`,
              whiteSpace: 'pre',
            }}
          >
            {recortarValor(cel.valor, 8)}
          </div>
        );
      })}
      {/* Flecha que señala la casilla que se lee */}
      {foco !== null && foco < n && (
        <div
          style={{
            position: 'absolute',
            left: xDe(foco, n) + lado / 2 - 16,
            top: filaY - 52,
            opacity: leyendo ? sFlecha : 0.25,
            transform: `translateY(${(1 - sFlecha) * -24}px)`,
          }}
        >
          <svg width={32} height={30} viewBox="0 0 32 30">
            <path d="M4 4 H28 L16 26 Z" fill={acento} stroke={FONDO} strokeWidth={3} strokeLinejoin="round" />
          </svg>
        </div>
      )}
      {sAccion > 0 && estado && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: MARGEN + 10,
            textAlign: 'center',
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 30,
            color: estado.accion === 'pop' || estado.accion === 'shift' ? ALARMA : acento,
            opacity: Math.min(1, sAccion * 2),
            transform: `scale(${0.9 + 0.2 * (1 - sAccion)})`,
          }}
        >
          {etiquetaAccion[estado.accion]}
        </div>
      )}
    </Panel>
  );
};
