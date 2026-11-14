import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/nunito/800.css';
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { framesPorBloque, trozos } from './FiestaVideo';
import { EditorDepurador } from './components/EditorDepurador';
import { Confeti } from './components/Confeti';
import { Personaje } from './components/Personaje';
import { LineaCodigo, SINTAXIS } from './components/Resaltado';
import { ALTO_ANIMACION, ANCHO_ANIMACION, MAX_SALIDA_VISIBLE, SEPARACION_FILA, medidasEditor } from './medidas';
import { RitmoSalida, tiemposEditor } from './editor';
import { planAnimacion, ritmoConAnimacion, tieneAnimacion } from './animaciones/plan';
import { AnimacionVista } from './components/animaciones';
import { pasoEn } from './animaciones/pasos';
import { agruparPalabras, esClave, indiceActual, palabrasClave } from './subtitulos';
import { VisualVista } from './components/Visual';
import { golpesDeCamara, zoomCamara } from './camara';
import { duracionTecleo, iniciosDeLinea, lineaDelCursor, momentosDeTecla, visiblesPorLinea } from './tecleo';
import { clavesDe, momentosClave } from './momentos';
import { EDITOR, FONDO, MONO, SIN_LIGADURAS, TENUE, TEXTO, TINTA, TITULO, segAFrames } from './temaCodigo';
import { CodigoProps, ConfigPersonaje, EscenaCodigo, Palabra, Visual } from './types';

type Bloque =
  | { tipo: 'gancho'; titulo: string; narracion: string; codigo?: string; visual?: Visual; etiqueta?: string }
  | { tipo: 'cierre'; titulo: string; narracion: string }
  | ({ tipo: 'escena'; numero: number } & EscenaCodigo);

const SIMBOLOS = ['{ }', ';', '=>', '( )', '[ ]', '</>', '++', '===', '//', '&&', '$', '#'];

/**
 * Fondo vivo pero discreto: la cuadrícula de puntos se desliza, tres manchas de color
 * flotan despacio y suben símbolos de código casi transparentes.
 */
const Fondo: React.FC<{ colores: string[] }> = ({ colores }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const manchas = [0, 1, 2].map((i) => ({
    color: colores[i % colores.length],
    x: width * (0.2 + 0.6 * ((i * 0.37) % 1)) + Math.sin(t * 0.35 + i * 2.1) * 220,
    y: height * (0.15 + 0.35 * i) + Math.cos(t * 0.28 + i * 1.3) * 180,
  }));
  return (
    <AbsoluteFill style={{ background: FONDO, overflow: 'hidden' }}>
      {manchas.map((m, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: m.x - 500,
            top: m.y - 500,
            width: 1000,
            height: 1000,
            background: `radial-gradient(circle, ${m.color}26 0%, ${m.color}0D 40%, transparent 68%)`,
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(244,241,255,0.07) 2px, transparent 2px)',
          backgroundSize: '44px 44px',
          backgroundPosition: `${(t * 12) % 44}px ${(t * -18) % 44}px`,
        }}
      />
      {SIMBOLOS.map((s, i) => {
        const r = (k: string) => random(`simbolo-${i}-${k}`);
        const vel = 25 + r('v') * 35;
        const y = height + 150 - ((r('y') * (height + 300) + t * vel) % (height + 300));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: r('x') * (width - 160) + Math.sin(t * 0.6 + i) * 25,
              top: y,
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 44 + r('t') * 56,
              color: TINTA,
              opacity: 0.045 + r('o') * 0.04,
              transform: `rotate(${(r('r') - 0.5) * 30 + Math.sin(t * 0.5 + i) * 6}deg)`,
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

type Dicha = { texto: string; inicio: number };

/**
 * Frase que toca mostrar sin tiempos reales: se reparte por longitud, y cada palabra
 * recibe un inicio estimado para poder resaltarla igual que con la voz real.
 */
const porLongitud = (texto: string, duracionSeg: number, t: number) => {
  const partes = trozos(texto);
  const total = partes.reduce((a, p) => a + p.length, 0);
  let acc = 0;
  const frases = partes.map((p) => {
    const dur = (p.length / total) * duracionSeg;
    const inicio = acc;
    acc += dur;
    let dentro = 0;
    const palabras = p.split(' ').map((w) => {
      const d = { texto: w, inicio: inicio + (dentro / p.length) * dur };
      dentro += w.length + 1;
      return d;
    });
    return { inicio, palabras };
  });
  return frases[indiceActual(frases, (f) => f.inicio, t)];
};

/** Frase actual según los tiempos reales de la voz. */
const porPalabras = (palabras: Palabra[], t: number) => {
  const grupos = agruparPalabras(palabras);
  const grupo = grupos[indiceActual(grupos, (g) => g[0].inicio, t)];
  return { inicio: grupo[0].inicio, palabras: grupo.map((p): Dicha => ({ texto: p.texto, inicio: p.inicio })) };
};

const Subtitulo: React.FC<{
  texto: string;
  duracionSeg: number;
  acento: string;
  claves: Set<string>;
  audio?: string;
  palabras?: Palabra[];
  personaje?: ConfigPersonaje;
  tamPersonaje: number;
}> = ({ texto, duracionSeg, acento, claves, audio, palabras, personaje, tamPersonaje }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const frase = palabras?.length ? porPalabras(palabras, t) : porLongitud(texto, duracionSeg, t);
  const activa = indiceActual(frase.palabras, (p) => p.inicio, t);
  // Cada frase nueva entra con un rebote y una ligera inclinación, alternando el lado
  const pop = spring({ frame: Math.max(0, t - frase.inicio) * fps, fps, config: { damping: 11, stiffness: 230 } });
  const lado = Math.round(frase.inicio * 10) % 2 ? 1 : -1;
  return (
    <div style={{ position: 'absolute', top: 1310, left: 60, right: 160, height: 220, display: 'flex', alignItems: 'center', gap: 34 }}>
      <Personaje config={personaje} audio={audio} tam={tamPersonaje} acento={acento} />
      <div
        style={{
          fontFamily: TEXTO,
          fontWeight: 800,
          fontSize: 50,
          lineHeight: 1.15,
          color: FONDO,
          background: TINTA,
          borderRadius: 24,
          padding: '18px 26px',
          textAlign: 'center',
          boxShadow: `8px 8px 0 ${acento}`,
          transform: `translateY(${(1 - pop) * 24}px) scale(${0.82 + pop * 0.18}) rotate(${(1 - pop) * 4 * lado}deg)`,
        }}
      >
        {frase.palabras.map((p, i) => {
          const esActiva = i === activa && t >= p.inicio;
          const s = esActiva ? spring({ frame: Math.max(0, (t - p.inicio) * fps), fps, config: { damping: 9, stiffness: 260 } }) : 1;
          const clave = esClave(p.texto, claves);
          return (
            <React.Fragment key={i}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0 8px',
                  borderRadius: 10,
                  // La palabra que se dice se invierte y salta; las palabras clave llevan un trazo de marcador
                  background: esActiva
                    ? clave
                      ? acento
                      : FONDO
                    : clave
                      ? `linear-gradient(transparent 58%, ${acento} 58%, ${acento} 92%, transparent 92%)`
                      : 'transparent',
                  color: esActiva ? (clave ? FONDO : TINTA) : FONDO,
                  transform: esActiva ? `scale(${0.92 + 0.16 * s}) rotate(${(1 - s) * -5}deg)` : 'none',
                }}
              >
                {p.texto}
              </span>{' '}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/** Momentos en que aparece cada elemento de un diagrama (igual que en VisualVista). */
const tiemposVisual = (v: Visual, narracion: string, duracionSeg: number, palabras?: Palabra[]) =>
  momentosClave(clavesDe(v), narracion, duracionSeg, palabras).map((m) => Math.max(0.05, m.t - 0.15));

/** Zoom lento, golpes en los momentos clave y una deriva suave para que la toma nunca esté quieta. */
const Camara: React.FC<{ duracionSeg: number; golpes: number[]; children: React.ReactNode }> = ({ duracionSeg, golpes, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const escala = zoomCamara(frame / fps, duracionSeg, golpes);
  const x = Math.sin(frame / 40) * 5;
  const y = Math.cos(frame / 55) * 4;
  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${escala})`, transformOrigin: '50% 42%' }}>{children}</AbsoluteFill>
  );
};

/** Frames que dura cada mitad del barrido; el corte entre bloques queda justo en medio, tapado. */
export const MEDIO_BARRIDO = 7;

/** Franja diagonal que cruza la pantalla y tapa el corte entre dos bloques. */
const Barrido: React.FC<{ color: string; franja: string }> = ({ color, franja }) => {
  const frame = useCurrentFrame();
  const M = MEDIO_BARRIDO;
  const ANCHO = 1700;
  // Llega frenando, cubre la pantalla durante el corte y sale acelerando
  const centro =
    frame < M
      ? interpolate(frame, [0, M], [-1250, 540], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' })
      : interpolate(frame, [M, 2 * M], [540, 2330], { easing: Easing.in(Easing.quad), extrapolateRight: 'clamp' });
  const panel = (desfase: number, ancho: number, fondo: string): React.CSSProperties => ({
    position: 'absolute',
    top: -100,
    height: 2120,
    width: ancho,
    left: centro + desfase - ancho / 2,
    background: fondo,
    transform: 'skewX(-12deg)',
  });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={panel(ANCHO / 2 + 60, 90, franja)} />
      <div style={panel(0, ANCHO, color)} />
    </AbsoluteFill>
  );
};

/** Título que entra palabra por palabra, con rebote, y un subrayado que se dibuja al final. */
const TituloPorPalabras: React.FC<{ texto: string; acento: string; style: React.CSSProperties }> = ({ texto, acento, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palabras = texto.split(/\s+/).filter(Boolean);
  // Adelantado: la primera palabra ya se ve en el primer cuadro
  const ADELANTO = 6;
  const RETRASO = 3;
  const tFin = palabras.length * RETRASO;
  const raya = spring({ frame: Math.max(0, frame - tFin), fps, config: { damping: 18, stiffness: 140 } });
  return (
    <div style={style}>
      {palabras.map((p, i) => {
        const f = frame + ADELANTO - i * RETRASO;
        const s = f < 0 ? 0 : spring({ frame: f, fps, config: { damping: 10, stiffness: 210 } });
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: 'inline-block',
                opacity: Math.min(1, s * 2),
                transform: `translateY(${(1 - s) * 70}px) scale(${0.6 + 0.4 * s}) rotate(${(1 - s) * (i % 2 ? 9 : -9)}deg)`,
              }}
            >
              {p}
            </span>{' '}
          </React.Fragment>
        );
      })}
      <div style={{ height: 14, width: 320 * raya, borderRadius: 7, background: acento, marginTop: 22 }} />
    </div>
  );
};

/** Etiqueta que se escribe sola, con un glitch de color al inicio y cada dos segundos. */
const EtiquetaGlitch: React.FC<{ texto: string; color: string }> = ({ texto, color }) => {
  const frame = useCurrentFrame();
  const visibles = Math.min(texto.length, Math.floor((frame + 4) * 1.4));
  const enGlitch = frame < 12 || frame % 60 < 3;
  const dx = enGlitch ? (random(`glitch-${frame}`) - 0.5) * 16 : 0;
  return (
    <div
      style={{
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: 38,
        color,
        whiteSpace: 'pre',
        textShadow: dx ? `${dx}px 0 #FF7A8A, ${-dx}px 0 #6CC4FF` : 'none',
        transform: dx ? `translateX(${dx * 0.4}px)` : 'none',
      }}
    >
      {texto.slice(0, visibles)}
    </div>
  );
};

/** Reproduce un efecto de sonido en cada uno de los segundos dados. */
const Efectos: React.FC<{ en: number[]; archivo: string; volumen: number; frames?: number }> = ({ en, archivo, volumen, frames = 10 }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {en.map((t, k) => (
        <Sequence key={`${archivo}-${k}`} from={segAFrames(t, fps)} durationInFrames={frames} layout="none">
          <Audio src={staticFile(`sfx/${archivo}`)} volume={volumen} />
        </Sequence>
      ))}
    </>
  );
};

/** Una línea de código con solo sus primeros n caracteres. Monoespaciada: recortar en "ch" no rompe el resaltado. */
const LineaParcial: React.FC<{ linea: string; n: number; cursor: boolean; acento: string; alto: number }> = ({ linea, n, cursor, acento, alto }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
    <span style={{ display: 'inline-block', width: `${n}ch`, overflow: 'hidden', whiteSpace: 'pre' }}>
      <LineaCodigo linea={linea} />
    </span>
    {cursor && <span style={{ display: 'inline-block', width: 4, height: alto, background: acento, marginLeft: 3 }} />}
  </span>
);

/** Lo que dura el tecleo del código del gancho. */
const tiemposTecleo = (codigo: string, duracionSeg: number) => {
  const lineas = codigo.split('\n').slice(0, 4);
  const inicio = 0.45;
  const dur = duracionTecleo(lineas.reduce((a, l) => a + l.length, 0), Math.min(1.8, duracionSeg * 0.45));
  return { lineas, inicio, fin: inicio + dur, dur };
};

/** Código del gancho escrito carácter por carácter. Cada línea ocupa su lugar desde el inicio: nada salta. */
const CodigoTecleado: React.FC<{ codigo: string; duracionSeg: number; acento: string; sonidos?: boolean }> = ({
  codigo,
  duracionSeg,
  acento,
  sonidos,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { lineas, inicio, fin, dur } = tiemposTecleo(codigo, duracionSeg);
  const visibles = visiblesPorLinea(lineas, t, inicio, dur);
  const cursor = lineaDelCursor(lineas, visibles);
  const entra = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 12, stiffness: 170 } });
  const listo = t >= fin;
  const parpadeo = !listo || Math.floor(frame / 15) % 2 === 0;
  return (
    <div
      style={{
        background: EDITOR,
        borderRadius: 26,
        border: `2px solid ${listo ? acento : 'rgba(244,241,255,0.12)'}`,
        boxShadow: listo ? `8px 8px 0 ${acento}` : 'none',
        padding: '26px 28px',
        fontFamily: MONO,
        fontWeight: 500,
        fontSize: 38,
        lineHeight: '60px',
        whiteSpace: 'pre',
        opacity: Math.min(1, entra * 1.5),
        transform: `scale(${0.85 + 0.15 * entra}) rotate(${(1 - entra) * -3}deg)`,
        transformOrigin: 'left top',
        ...SIN_LIGADURAS,
      }}
    >
      {sonidos && <Efectos en={momentosDeTecla(lineas, inicio, dur)} archivo="tecla.wav" volumen={0.1} frames={6} />}
      {lineas.map((l, i) => (
        <div key={i} style={{ height: 60 }}>
          <LineaParcial linea={l} n={visibles[i]} cursor={i === cursor && parpadeo} acento={acento} alto={44} />
        </div>
      ))}
    </div>
  );
};

/** Chispas que salen disparadas desde un punto y caen. Duran medio segundo. */
const Estallido: React.FC<{ desde: number; colores: string[]; x: number; y: number }> = ({ desde, colores, x, y }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const DURA = 20;
  const f = frame - segAFrames(desde, fps);
  if (f < 0 || f > DURA) return null;
  const p = f / DURA;
  const avance = 1 - (1 - p) ** 3;
  return (
    <>
      {Array.from({ length: 22 }, (_, i) => {
        const r = (k: string) => random(`chispa-${i}-${k}`);
        const ang = r('a') * Math.PI * 2;
        const dist = (110 + r('d') * 230) * avance;
        const tam = 10 + r('t') * 12;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.cos(ang) * dist - tam / 2,
              top: y + Math.sin(ang) * dist + 160 * p * p - tam / 2,
              width: tam,
              height: r('f') > 0.5 ? tam : tam * 0.45,
              borderRadius: r('f') > 0.5 ? '50%' : 3,
              background: colores[i % colores.length],
              opacity: 1 - p * p,
              transform: `rotate(${r('r') * 360 + f * 18}deg)`,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
};

const Palomita: React.FC<{ color: string; tinta: string; tam: number }> = ({ color, tinta, tam }) => (
  <svg width={tam} height={tam} viewBox="0 0 52 52">
    <circle cx="26" cy="26" r="26" fill={color} />
    <path d="M15 27 l8 8 l15 -17" fill="none" stroke={tinta} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Editor: React.FC<{
  e: EscenaCodigo;
  duracionSeg: number;
  acento: string;
  paleta: string[];
  archivo: string;
  sonidos?: boolean;
  /** Con animación, la consola comparte una fila con ella y va al ritmo de las vueltas. */
  animacion?: React.ReactNode;
  ritmo?: RitmoSalida;
  /** Línea que la ejecución está corriendo (la marca la animación); 0 o undefined: ninguna. */
  activa?: number;
}> = ({ e, duracionSeg, acento, paleta, archivo, sonidos, animacion, ritmo, activa }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { lineas, salida, inicio, durTecleo, finCodigo, tResaltar, tSalida, tUltima, tLinea } = tiemposEditor(e, duracionSeg, ritmo);
  const { fs: FS, lh: LH } = medidasEditor(lineas, salida.length, !!animacion);
  const enFila = !!animacion && salida.length > 0;
  const anchoConsola = enFila ? 885 - ANCHO_ANIMACION - 20 : 885;
  const pulso = 0.55 + 0.25 * Math.sin(frame / 7);
  const visibles = visiblesPorLinea(lineas, t, inicio, durTecleo);
  const inicios = iniciosDeLinea(lineas, inicio, durTecleo);
  const cursorLinea = lineaDelCursor(lineas, visibles);
  const parpadeo = t < inicio + durTecleo || Math.floor(frame / 15) % 2 === 0;
  const visiblesSalida = salida.filter((_, i) => t >= tLinea(i));
  const primera = Math.max(0, visiblesSalida.length - MAX_SALIDA_VISIBLE);
  const ultimas = visiblesSalida.slice(primera);
  // La consola celebra cuando termina: palomita, borde verde que brilla y chispas
  // Un bucle infinito no se celebra: su consola termina en "... nunca termina"
  const nuncaTermina = salida.length > 0 && salida[salida.length - 1].startsWith('...');
  const exito = t >= tUltima && !nuncaTermina;
  const sExito = exito ? spring({ frame: frame - segAFrames(tUltima, fps), fps, config: { damping: 8, stiffness: 200 } }) : 0;
  const brillo = exito ? Math.max(0, 1 - (t - tUltima) / 0.8) : 0;
  const VERDE = SINTAXIS.cadena;

  return (
    <div style={{ position: 'absolute', top: 400, left: 50, width: 885, display: 'flex', flexDirection: 'column', gap: SEPARACION_FILA }}>
      {sonidos && (
        <>
          <Efectos en={momentosDeTecla(lineas, inicio, durTecleo)} archivo="tecla.wav" volumen={0.1} frames={6} />
          <Efectos en={salida.slice(0, -1).map((_, i) => tLinea(i))} archivo="resultado.wav" volumen={0.1} frames={9} />
          {salida.length > 0 && !nuncaTermina && <Efectos en={[tUltima]} archivo="exito.wav" volumen={0.3} frames={18} />}
        </>
      )}
      <div style={{ background: EDITOR, borderRadius: 26, border: `2px solid rgba(244,241,255,0.12)`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 26px', borderBottom: '2px solid rgba(244,241,255,0.08)' }}>
          {['#FF7A8A', '#FFB454', '#7FD1B9'].map((c) => (
            <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
          ))}
          <div style={{ marginLeft: 14, fontFamily: MONO, fontWeight: 500, fontSize: 26, color: TENUE }}>{archivo}</div>
        </div>
        <div style={{ padding: '22px 0 26px' }}>
          {lineas.map((l, i) => {
            const empezo = t >= inicios[i];
            const resaltada = e.resaltar?.includes(i + 1) && t >= tResaltar;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  height: LH,
                  alignItems: 'center',
                  fontFamily: MONO,
                  fontWeight: 500,
                  fontSize: FS,
                  ...SIN_LIGADURAS,
                  whiteSpace: 'pre',
                  background: resaltada
                    ? `${acento}${Math.round(pulso * 0.35 * 255).toString(16).padStart(2, '0')}`
                    : activa === i + 1
                      ? `${acento}1F`
                      : 'transparent',
                  boxShadow: resaltada ? `inset 8px 0 0 ${acento}` : activa === i + 1 ? `inset 8px 0 0 ${acento}99` : 'none',
                }}
              >
                <span
                  style={{
                    width: 60,
                    textAlign: 'right',
                    paddingRight: 20,
                    color: 'rgba(244,241,255,0.28)',
                    flex: '0 0 60px',
                    opacity: empezo ? 1 : 0,
                  }}
                >
                  {i + 1}
                </span>
                <LineaParcial
                  linea={l}
                  n={visibles[i]}
                  cursor={empezo && i === cursorLinea && t < tResaltar + 0.6 && parpadeo}
                  acento={acento}
                  alto={FS + 4}
                />
              </div>
            );
          })}
        </div>
      </div>

      {animacion && !enFila && <div style={{ height: ALTO_ANIMACION }}>{animacion}</div>}
      {salida.length > 0 && (enFila || t >= tSalida - 0.2) && (
        <div style={enFila ? { display: 'flex', gap: 20, height: ALTO_ANIMACION } : {}}>
        {enFila && <div style={{ width: ANCHO_ANIMACION, flex: '0 0 auto' }}>{animacion}</div>}
        <div
          style={{
            position: 'relative',
            background: 'rgba(14,12,30,0.75)',
            borderRadius: 22,
            border: `2px ${exito ? 'solid' : 'dashed'} ${exito ? VERDE : `${VERDE}55`}`,
            boxShadow: brillo ? `0 0 ${50 * brillo}px ${VERDE}` : 'none',
            padding: '18px 26px 20px',
            boxSizing: 'border-box',
            ...(enFila ? { flex: 1, height: ALTO_ANIMACION } : {}),
            opacity: enFila
              ? interpolate(t, [finCodigo, finCodigo + 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
              : interpolate(t, [tSalida - 0.2, tSalida], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: TENUE, marginBottom: 8 }}>
            CONSOLA
          </div>
          {exito && (
            <div
              style={{
                position: 'absolute',
                top: -26,
                right: 26,
                transform: `scale(${sExito}) rotate(${(1 - sExito) * -90}deg)`,
              }}
            >
              <Palomita color={VERDE} tinta={FONDO} tam={60} />
            </div>
          )}
          {!nuncaTermina && <Estallido desde={tUltima} colores={[VERDE, ...paleta]} x={anchoConsola - 26 - 30 - 26} y={4} />}
          {ultimas.map((l, i) => {
            const s = spring({ frame: frame - segAFrames(tLinea(primera + i), fps), fps, config: { damping: 13, stiffness: 220 } });
            return (
              <div
                key={`${l}-${primera + i}`}
                style={{
                  fontFamily: MONO,
                  fontWeight: 500,
                  fontSize: 32,
                  lineHeight: '46px',
                  color: l.startsWith('...') ? SINTAXIS.palabra : VERDE,
                  ...SIN_LIGADURAS,
                  whiteSpace: 'pre',
                  opacity: Math.min(1, s * 1.5),
                  transform: `translateX(${(1 - s) * -40}px)`,
                }}
              >
                <span style={{ color: TENUE }}>›</span> {l}
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
};

const BloqueVista: React.FC<{
  b: Bloque;
  acento: string;
  paleta: string[];
  total: number;
  duracionSeg: number;
  handle: string;
  ctaSecundario: string;
  archivo: string;
  audio?: string;
  palabras?: Palabra[];
  personaje?: ConfigPersonaje;
  sonidos?: boolean;
}> = ({ b, acento, paleta, total, duracionSeg, handle, ctaSecundario, archivo, audio, palabras, personaje, sonidos }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Adelantado para que el primer cuadro nunca salga vacío
  const entra = spring({ frame: frame + 8, fps, config: { damping: 13, stiffness: 160 } });
  const voz = { audio, palabras, personaje };
  const visual = (v: Visual, top: number, alto: number) => {
    // El recorrido ocupa todo el ancho: es un mundo por el que viaja su propia cámara
    const ancho = v.tipo === 'recorrido' ? 1080 : 885;
    return (
    <div style={{ position: 'absolute', top, left: v.tipo === 'recorrido' ? 0 : 50, width: ancho, height: alto }}>
      <VisualVista visual={v} narracion={b.narracion} duracionSeg={duracionSeg} palabras={palabras} paleta={paleta} acento={acento} ancho={ancho} alto={alto} />
      {sonidos && <Efectos en={tiemposVisual(v, b.narracion, duracionSeg, palabras)} archivo="pop.wav" volumen={0.3} frames={4} />}
    </div>
    );
  };
  /** Lo que se mueve con la cámara; el subtítulo y el personaje quedan fijos para que se lean bien. */
  const conCamara = (momentos: number[], escenario: React.ReactNode, tamPersonaje: number) => (
    <AbsoluteFill>
      <Camara duracionSeg={duracionSeg} golpes={golpesDeCamara(momentos, duracionSeg)}>
        {escenario}
      </Camara>
      <Subtitulo texto={b.narracion} duracionSeg={duracionSeg} acento={acento} claves={palabrasClave(b)} tamPersonaje={tamPersonaje} {...voz} />
    </AbsoluteFill>
  );

  if (b.tipo === 'escena') {
    const conAnimacion = tieneAnimacion(b);
    const ritmo = ritmoConAnimacion(b, duracionSeg, palabras);
    const plan = conAnimacion ? planAnimacion(b, duracionSeg, palabras) : null;
    const momentosAnimacion = plan?.momentos ?? [];
    // Línea que corre en este cuadro, según los pasos reales de la animación
    const pasosAnimacion = b.animacion && b.animacion.tipo !== 'ciclo' ? b.animacion.calculado?.pasos : undefined;
    const lineaActiva = plan?.tiempos && pasosAnimacion ? pasosAnimacion[pasoEn(plan.tiempos, frame / fps)]?.l : undefined;
    const momentos = b.traza
      ? momentosAnimacion
      : b.codigo
      ? (() => {
          const te = tiemposEditor(b, duracionSeg, ritmo);
          return [
            ...(b.resaltar?.length ? [te.tResaltar] : []),
            ...momentosAnimacion,
            ...(te.salida.length ? [te.tSalida, te.tUltima] : []),
          ];
        })()
      : b.visual && b.visual.tipo !== 'recorrido'
        ? tiemposVisual(b.visual, b.narracion, duracionSeg, palabras)
        : [];
    const salidaAnimacion = b.traza ? b.traza.salida : (b.salida ?? '').split('\n').filter((l) => l.length);
    const enFila = conAnimacion && (b.traza ? true : salidaAnimacion.length > 0);
    const animacion = conAnimacion && b.animacion ? (
      <>
        <AnimacionVista
          animacion={b.animacion}
          plan={plan}
          salida={salidaAnimacion}
          acento={acento}
          ancho={enFila ? ANCHO_ANIMACION : 885}
          alto={ALTO_ANIMACION}
        />
        {sonidos && plan && <Efectos en={plan.ciclo ? momentosAnimacion.slice(0, 3) : momentosAnimacion} archivo="pop.wav" volumen={0.25} frames={4} />}
        {sonidos && plan?.ciclo && plan.ciclo.salida !== null && <Efectos en={[plan.ciclo.salida]} archivo="exito.wav" volumen={0.25} frames={18} />}
      </>
    ) : undefined;
    return conCamara(
      momentos,
      <>
        <div style={{ position: 'absolute', top: 205, left: 70, right: 160, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 34,
              color: FONDO,
              background: acento,
              borderRadius: 14,
              padding: '8px 18px',
              transform: `scale(${entra})`,
              flex: '0 0 auto',
            }}
          >
            {b.numero}/{total}
          </div>
          <div
            style={{
              fontFamily: TITULO,
              fontWeight: 800,
              fontSize: 70,
              lineHeight: 1.0,
              color: TINTA,
              opacity: entra,
              transform: `translateY(${(1 - entra) * 30}px)`,
            }}
          >
            {b.titulo}
          </div>
        </div>
        {b.codigo && b.traza ? (
          <EditorDepurador e={b} duracionSeg={duracionSeg} acento={acento} archivo={b.archivo ?? archivo} sonidos={sonidos} palabras={palabras} animacion={animacion} />
        ) : b.codigo ? (
          <Editor e={b} duracionSeg={duracionSeg} acento={acento} paleta={paleta} archivo={b.archivo ?? archivo} sonidos={sonidos} animacion={animacion} ritmo={ritmo} activa={lineaActiva} />
        ) : b.visual ? (
          b.visual.tipo === 'recorrido' ? visual(b.visual, 350, 940) : visual(b.visual, 390, 900)
        ) : null}
      </>,
      200,
    );
  }

  if (b.tipo === 'gancho') {
    const conCodigo = b.codigo && !b.visual ? b.codigo : undefined;
    const momentos = conCodigo
      ? [tiemposTecleo(conCodigo, duracionSeg).fin]
      : b.visual && b.visual.tipo !== 'recorrido'
        ? tiemposVisual(b.visual, b.narracion, duracionSeg, palabras)
        : [];
    return conCamara(
      momentos,
      <>
        <div style={{ position: 'absolute', top: 210, left: 70, right: 160, display: 'flex', flexDirection: 'column', gap: 34 }}>
          <EtiquetaGlitch texto={`// ${b.etiqueta ?? 'JavaScript desde cero'}`} color={acento} />
          <TituloPorPalabras
            texto={b.titulo}
            acento={acento}
            style={{ fontFamily: TITULO, fontWeight: 800, fontSize: 112, lineHeight: 0.98, color: TINTA, textWrap: 'balance' }}
          />
          {conCodigo && <CodigoTecleado codigo={conCodigo} duracionSeg={duracionSeg} acento={acento} sonidos={sonidos} />}
        </div>
        {b.visual && visual(b.visual, 790, 480)}
      </>,
      240,
    );
  }

  const parpadeo = Math.floor(frame / 15) % 2 === 0;
  const T_BOTON = 0.5;
  const fBoton = frame - segAFrames(T_BOTON, fps);
  const sBoton = fBoton < 0 ? 0 : spring({ frame: fBoton, fps, config: { damping: 9, stiffness: 190 } });
  // Late como corazón: dos golpes cortos por segundo, luego reposo
  const latido = fBoton < 0 ? 0 : Math.max(0, Math.sin((fBoton / fps) * Math.PI * 2 * 0.9)) ** 6 * 0.08;
  const vaiven = Math.sin(frame / 5) * 14;
  return conCamara(
    [T_BOTON],
    <>
      <Confeti colores={paleta} cantidad={34} seed={`cierre-${b.titulo}`} intensidad={1.4} />
      {sonidos && <Efectos en={[T_BOTON]} archivo="pop.wav" volumen={0.4} frames={4} />}
      <div
        style={{
          position: 'absolute',
          top: 420,
          left: 70,
          right: 160,
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 120,
          color: acento,
          opacity: entra,
          transform: `scale(${0.85 + entra * 0.15})`,
          transformOrigin: 'left center',
        }}
      >
        // sígueme
        <span style={{ display: 'inline-block', width: 10, height: 110, background: parpadeo ? acento : 'transparent', marginLeft: 12, verticalAlign: 'middle' }} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 640,
          left: 70,
          right: 160,
          fontFamily: TITULO,
          fontWeight: 800,
          fontSize: 96,
          lineHeight: 0.98,
          color: TINTA,
          opacity: entra,
          transform: `translateY(${(1 - entra) * 50}px)`,
          textWrap: 'balance',
        }}
      >
        {b.titulo}
      </div>
      <div style={{ position: 'absolute', top: 990, left: 70, right: 160, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 46,
              color: FONDO,
              background: acento,
              borderRadius: 999,
              padding: '18px 42px',
              boxShadow: `8px 8px 0 ${TINTA}`,
              opacity: Math.min(1, sBoton * 2),
              transform: `scale(${sBoton * (1 + latido)}) rotate(${(1 - sBoton) * -12}deg)`,
              transformOrigin: 'left center',
            }}
          >
            + Seguir
          </div>
          <svg width={110} height={60} viewBox="0 0 110 60" style={{ opacity: sBoton, transform: `translateX(${vaiven}px)` }}>
            <path d="M104 30 H16 M38 8 L14 30 L38 52" fill="none" stroke={acento} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 40, color: TENUE, opacity: entra }}>
          <div style={{ color: TINTA }}>{handle}</div>
          {ctaSecundario && <div style={{ fontSize: 32, marginTop: 10 }}>{ctaSecundario}</div>}
        </div>
      </div>
    </>,
    220,
  );
};

const Progreso: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames - 1], [0, 1]);
  return (
    <div style={{ position: 'absolute', top: 120, left: 70, right: 70, height: 12, borderRadius: 6, background: 'rgba(244,241,255,0.12)' }}>
      <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 6, background: color }} />
    </div>
  );
};

export const CodigoVideo: React.FC<CodigoProps> = ({ guion, timing, marca }) => {
  const bloques: Bloque[] = [
    { tipo: 'gancho', ...guion.gancho, codigo: guion.escenas.find((e) => e.codigo)?.codigo, etiqueta: guion.etiqueta },
    ...guion.escenas.map((e, i) => ({ tipo: 'escena' as const, numero: i + 1, ...e })),
    { tipo: 'cierre', ...guion.cierre },
  ];
  const frames = framesPorBloque(timing.duraciones);
  const archivo = `${guion.slug.split('-').slice(0, 3).join('-')}.js`;
  let inicio = 0;

  return (
    <AbsoluteFill>
      <Fondo colores={marca.colores} />
      {bloques.map((b, i) => {
        const desde = inicio;
        inicio += frames[i];
        const audio = timing.conAudio ? staticFile(`audio/${guion.slug}/bloque-${i}.mp3`) : undefined;
        return (
          <Sequence key={i} from={desde} durationInFrames={frames[i]} name={`${i}-${b.tipo}`}>
            <BloqueVista
              b={b}
              acento={marca.colores[i % marca.colores.length]}
              paleta={marca.colores.map((_, k) => marca.colores[(i + 1 + k) % marca.colores.length])}
              total={guion.escenas.length}
              duracionSeg={timing.duraciones[i]}
              handle={marca.handle}
              ctaSecundario={marca.ctaSecundario}
              archivo={archivo}
              audio={audio}
              palabras={timing.palabras?.[i]}
              personaje={marca.personaje}
              sonidos={marca.sonidos}
            />
            {audio && <Audio src={audio} />}
          </Sequence>
        );
      })}
      <Progreso color={marca.colores[0]} />
      {/* Un barrido tapa cada corte; va al final para quedar encima de todo */}
      {bloques.slice(1).map((_, k) => {
        const i = k + 1;
        const corte = frames.slice(0, i).reduce((a, f) => a + f, 0);
        return (
          <Sequence key={`barrido-${i}`} from={corte - MEDIO_BARRIDO} durationInFrames={2 * MEDIO_BARRIDO} name={`barrido-${i}`}>
            <Barrido color={marca.colores[i % marca.colores.length]} franja={TINTA} />
            {marca.sonidos && <Audio src={staticFile('sfx/whoosh.wav')} volume={0.35} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
