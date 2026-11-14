/**
 * Profundidad del canal de código: paneles con perspectiva que se inclinan cuando no están
 * en foco, una columna que sigue a la cámara del escenario y capas de parallax
 * (fondo cercano y primer plano) que se mueven a distinta velocidad que el contenido.
 */
import React from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { Encuadre, VENTANA } from '../escenario';
import { MONO, TINTA } from '../temaCodigo';

export type VistaEscenario = {
  encuadre: Encuadre;
  /** 1 = de frente; 0 = inclinado y atenuado. */
  pesoEditor: number;
  pesoAbajo: number;
  /** Entrada de cada panel (0 → 1, con rebote). */
  entraEditor: number;
  entraAbajo: number;
  /** Si viaja, el panel fuera de foco casi no se ve: se puede inclinar más. */
  viaja: boolean;
};

/** Inclinación de un panel: de frente cuando está en foco, girado hacia atrás cuando no. lado = -1 izquierda, 1 derecha. */
export const panel3D = (peso: number, lado: number, entra: number, viajando: boolean): React.CSSProperties => {
  const fuera = 1 - peso;
  const fuerza = viajando ? 1.25 : 1;
  return {
    transform: `translateZ(${-fuera * 50 * fuerza - (1 - entra) * 260}px) rotateX(${fuera * 4 * fuerza + (1 - entra) * 32}deg) rotateY(${lado * fuera * 5 * fuerza + (1 - entra) * lado * -14}deg)`,
    opacity: (1 - fuera * (viajando ? 0.3 : 0.14)) * Math.min(1, entra * 1.6),
    transformOrigin: '50% 50%',
  };
};

/** La columna de paneles sigue a la cámara del escenario y da la perspectiva a sus hijos. */
export const columnaEscenario = (v?: VistaEscenario): React.CSSProperties =>
  v
    ? {
        transform: `translateY(${v.encuadre.dy}px) scale(${v.encuadre.escala})`,
        transformOrigin: `50% ${v.encuadre.origen}px`,
        perspective: 1600,
        perspectiveOrigin: `50% ${v.encuadre.origen - v.encuadre.dy}px`,
      }
    : {};

/** Cuando la cámara viaja, lo que sale de la ventana se desvanece en vez de tapar el título o el subtítulo. */
export const Ventana: React.FC<{ activa: boolean; children: React.ReactNode }> = ({ activa, children }) => {
  if (!activa) return <>{children}</>;
  const borde = 28;
  const mascara = `linear-gradient(to bottom, transparent 0px, transparent ${VENTANA.arriba - borde - 10}px, black ${VENTANA.arriba - 10}px, black ${VENTANA.abajo}px, transparent ${VENTANA.abajo + borde}px)`;
  return <AbsoluteFill style={{ maskImage: mascara, WebkitMaskImage: mascara }}>{children}</AbsoluteFill>;
};

export type MovimientoCamara = { x: number; y: number; escala: number; dy: number };

const SIMBOLOS_FONDO = ['{ }', '( )', '=>', '[ ]', ';', '</>'];

/**
 * Capa de fondo cercano: símbolos grandes y tenues que se mueven a un tercio de la cámara.
 * Van detrás del contenido, así que pueden cruzar la pantalla sin estorbar.
 */
export const FondoCercano: React.FC<{ camara: MovimientoCamara; semilla: string; colores: string[] }> = ({ camara, semilla, colores }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const f = 0.35;
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${camara.x * f}px, ${camara.y * f + camara.dy * f}px) scale(${1 + (camara.escala - 1) * f})`,
        pointerEvents: 'none',
      }}
    >
      {SIMBOLOS_FONDO.map((s, i) => {
        const r = (k: string) => random(`${semilla}-fondo-${i}-${k}`);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: r('x') * (width - 260),
              top: 300 + r('y') * (height - 900) + Math.sin(t * 0.4 + i) * 30,
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 150 + r('t') * 110,
              color: colores[i % colores.length],
              opacity: 0.05,
              transform: `rotate(${(r('r') - 0.5) * 30 + t * (r('v') - 0.5) * 6}deg)`,
              whiteSpace: 'pre',
            }}
          >
            {s}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Primer plano: formas que pasan más rápido que la cámara (1.6×), solo por los bordes:
 * la franja de arriba y el margen izquierdo, lejos del código, del subtítulo y de la zona de TikTok.
 */
export const PrimerPlano: React.FC<{ camara: MovimientoCamara; semilla: string; colores: string[] }> = ({ camara, semilla, colores }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const f = 1.6;
  const formas = Array.from({ length: 5 }, (_, i) => {
    const r = (k: string) => random(`${semilla}-frente-${i}-${k}`);
    // Tres en la franja superior y dos en el margen izquierdo
    const arriba = i < 3;
    return {
      // Arriba: entre el borde y la barra de progreso. Izquierda: medio fuera de cuadro, sin tocar los paneles
      x: arriba ? 120 + r('x') * 700 : -52 + r('x') * 24,
      y: arriba ? 18 + r('y') * 50 : 450 + r('y') * 700,
      tam: arriba ? 22 + r('t') * 26 : 40 + r('t') * 30,
      tipo: Math.floor(r('k') * 3),
      color: colores[i % colores.length],
      fase: r('f') * 6,
    };
  });
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${camara.x * f}px, ${camara.y * f + camara.dy * 0.25}px)`,
        pointerEvents: 'none',
      }}
    >
      {formas.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x + Math.sin(t * 0.7 + s.fase) * 18,
            top: s.y + Math.cos(t * 0.5 + s.fase) * 14,
            width: s.tam,
            height: s.tam,
            borderRadius: s.tipo === 0 ? '50%' : s.tipo === 1 ? 8 : 0,
            border: s.tipo === 2 ? 'none' : `4px solid ${s.color}`,
            background: s.tipo === 2 ? `radial-gradient(circle, ${s.color} 0%, transparent 70%)` : 'transparent',
            opacity: 0.16,
            transform: `rotate(${t * 20 * (i % 2 ? 1 : -1) + s.fase * 30}deg) scale(${1 + (camara.escala - 1) * 2})`,
          }}
        />
      ))}
      {/* Destello que cruza la franja superior de vez en cuando */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: ((t * 180) % 2400) - 600,
          width: 260,
          height: 300,
          background: `linear-gradient(100deg, transparent, ${TINTA}0A, transparent)`,
          transform: 'skewX(-18deg)',
        }}
      />
    </AbsoluteFill>
  );
};
