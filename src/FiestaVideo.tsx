import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Confeti } from './components/Confeti';
import { IconoFiesta } from './components/Iconos';
import { Icono, VideoProps } from './types';

export const FPS = 30;
export const PAD_SEG = 0.4;

const INK = '#2B2140';
const CREMA = '#FFF6E9';
const TITULO = '"Baloo 2", system-ui, sans-serif';
const TEXTO = 'Nunito, system-ui, sans-serif';

/** Frames de cada bloque (gancho, escenas…, cierre) a partir de las duraciones de audio. */
export const framesPorBloque = (duraciones: number[]) => duraciones.map((d) => Math.round((d + PAD_SEG) * FPS));

type Bloque = {
  tipo: 'gancho' | 'tip' | 'cierre';
  titulo: string;
  narracion: string;
  icono: Icono;
  numero?: number;
};

const bloquesDe = (g: VideoProps['guion']): Bloque[] => [
  { tipo: 'gancho', titulo: g.gancho.titulo, narracion: g.gancho.narracion, icono: 'gorro' },
  ...g.escenas.map((e, i) => ({ tipo: 'tip' as const, ...e, numero: i + 1 })),
  { tipo: 'cierre', titulo: g.cierre.titulo, narracion: g.cierre.narracion, icono: 'regalo' },
];

/** Divide la narración en frases cortas para subtítulos, ~5 palabras. */
export const trozos = (texto: string, max = 6) => {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur: string[] = [];
  for (const p of palabras) {
    cur.push(p);
    const corta = /[.,;:!?]$/.test(p) && cur.length >= 2;
    if (cur.length >= max || corta) {
      out.push(cur.join(' '));
      cur = [];
    }
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
};

const Subtitulos: React.FC<{ texto: string; duracionSeg: number; color: string }> = ({ texto, duracionSeg, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const partes = trozos(texto);
  const total = partes.reduce((a, p) => a + p.length, 0);
  const t = frame / fps;
  // Tiempo proporcional a los caracteres de cada trozo
  let acc = 0;
  let idx = partes.length - 1;
  let inicio = 0;
  for (let i = 0; i < partes.length; i++) {
    const dur = (partes[i].length / total) * duracionSeg;
    if (t < acc + dur) {
      idx = i;
      inicio = acc;
      break;
    }
    acc += dur;
  }
  const local = (t - inicio) * fps;
  const pop = spring({ frame: local, fps, config: { damping: 14, stiffness: 220 } });

  return (
    <div
      style={{
        position: 'absolute',
        top: 1160,
        left: 90,
        right: 170,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontFamily: TEXTO,
          fontWeight: 800,
          fontSize: 62,
          lineHeight: 1.15,
          color: INK,
          background: '#fff',
          border: `6px solid ${INK}`,
          boxShadow: `10px 10px 0 ${color}`,
          borderRadius: 28,
          padding: '22px 34px',
          textAlign: 'center',
          transform: `scale(${0.9 + pop * 0.1})`,
        }}
      >
        {partes[idx]}
      </div>
    </div>
  );
};

const BloqueVista: React.FC<{
  b: Bloque;
  color: string;
  colores: string[];
  totalTips: number;
  duracionSeg: number;
  handle: string;
  ctaSecundario: string;
}> = ({ b, color, colores, totalTips, duracionSeg, handle, ctaSecundario }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame, fps, config: { damping: 12, stiffness: 160 } });
  const entraTarde = spring({ frame: frame - 6, fps, config: { damping: 13, stiffness: 150 } });
  const flota = Math.sin(frame / 14) * 14;
  const giro = Math.sin(frame / 22) * 5;

  const esGancho = b.tipo === 'gancho';
  const esCierre = b.tipo === 'cierre';

  return (
    <AbsoluteFill>
      {/* Mancha de color detrás del icono */}
      <div
        style={{
          position: 'absolute',
          left: 540 - 330,
          top: 300,
          width: 660,
          height: 660,
          borderRadius: '46% 54% 58% 42% / 44% 46% 54% 56%',
          background: color,
          opacity: 0.22,
          transform: `scale(${entra}) rotate(${frame / 3}deg)`,
        }}
      />

      {/* Número de tip */}
      {b.numero && (
        <div
          style={{
            position: 'absolute',
            top: 250,
            left: 110,
            fontFamily: TITULO,
            fontWeight: 800,
            fontSize: 64,
            color: CREMA,
            background: INK,
            borderRadius: 999,
            padding: '6px 34px',
            transform: `scale(${entra}) rotate(-6deg)`,
          }}
        >
          {b.numero}/{totalTips}
        </div>
      )}

      {/* Icono */}
      <div
        style={{
          position: 'absolute',
          top: 340 + flota,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          transform: `scale(${entra}) rotate(${giro}deg)`,
        }}
      >
        <IconoFiesta tipo={b.icono} color={color} size={esGancho ? 380 : 340} />
      </div>

      {/* Título grande */}
      <div
        style={{
          position: 'absolute',
          top: 780,
          left: 80,
          right: 150,
          textAlign: 'center',
          fontFamily: TITULO,
          fontWeight: 800,
          fontSize: esGancho ? 112 : 96,
          lineHeight: 1.0,
          color: INK,
          opacity: entraTarde,
          transform: `translateY(${(1 - entraTarde) * 60}px)`,
          textWrap: 'balance',
        }}
      >
        {b.titulo}
      </div>

      {esCierre && (
        <div
          style={{
            position: 'absolute',
            top: 1380,
            left: 0,
            right: 80,
            textAlign: 'center',
            fontFamily: TEXTO,
            fontWeight: 800,
            fontSize: 48,
            color: INK,
            opacity: entraTarde,
          }}
        >
          <div>Sígueme: {handle}</div>
          {ctaSecundario && <div style={{ fontSize: 40, marginTop: 10, opacity: 0.75 }}>{ctaSecundario}</div>}
        </div>
      )}

      <Subtitulos texto={b.narracion} duracionSeg={duracionSeg} color={colores[(colores.indexOf(color) + 1) % colores.length]} />
    </AbsoluteFill>
  );
};

const BarraProgreso: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames - 1], [0, 1]);
  return (
    <div style={{ position: 'absolute', top: 120, left: 90, right: 90, height: 14, borderRadius: 99, background: 'rgba(43,33,64,0.12)' }}>
      <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 99, background: color }} />
    </div>
  );
};

export const FiestaVideo: React.FC<VideoProps> = ({ guion, timing, marca }) => {
  const bloques = bloquesDe(guion);
  const frames = framesPorBloque(timing.duraciones);
  const colores = marca.colores;
  let inicio = 0;

  return (
    <AbsoluteFill style={{ background: CREMA }}>
      <Confeti colores={colores} />
      {bloques.map((b, i) => {
        const desde = inicio;
        inicio += frames[i];
        const color = colores[i % colores.length];
        return (
          <Sequence key={i} from={desde} durationInFrames={frames[i]} name={`${i}-${b.tipo}`}>
            <BloqueVista
              b={b}
              color={color}
              colores={colores}
              totalTips={guion.escenas.length}
              duracionSeg={timing.duraciones[i]}
              handle={marca.handle}
              ctaSecundario={marca.ctaSecundario}
            />
            {timing.conAudio && <Audio src={staticFile(`audio/${guion.slug}/bloque-${i}.mp3`)} />}
          </Sequence>
        );
      })}
      <BarraProgreso color={colores[0]} />
    </AbsoluteFill>
  );
};
