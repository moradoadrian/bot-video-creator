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
import { Personaje } from './components/Personaje';
import { LineaCodigo, SINTAXIS } from './components/Resaltado';
import { MAX_SALIDA_VISIBLE, medidasEditor } from './medidas';
import { agruparPalabras, indiceActual } from './subtitulos';
import { VisualVista } from './components/Visual';
import { golpesDeCamara, zoomCamara } from './camara';
import { clavesDe, momentosClave } from './momentos';
import { EDITOR, FONDO, MONO, TENUE, TEXTO, TINTA, TITULO } from './tema';
import { CodigoProps, ConfigPersonaje, EscenaCodigo, Palabra, Visual } from './types';


/** Sin ligaduras: un principiante debe ver <= y ++ tal cual se escriben. */
const SIN_LIGADURAS = { fontVariantLigatures: 'none' as const, fontFeatureSettings: '"liga" 0, "calt" 0' };

type Bloque =
  | { tipo: 'gancho'; titulo: string; narracion: string; codigo?: string; visual?: Visual }
  | { tipo: 'cierre'; titulo: string; narracion: string }
  | ({ tipo: 'escena'; numero: number } & EscenaCodigo);

const segAFrames = (s: number, fps: number) => Math.round(s * fps);

/** Fondo con cuadrícula de puntos, muy tenue. */
const Fondo: React.FC = () => (
  <AbsoluteFill
    style={{
      background: FONDO,
      backgroundImage: 'radial-gradient(rgba(244,241,255,0.07) 2px, transparent 2px)',
      backgroundSize: '44px 44px',
    }}
  />
);

/** Parte de la narración que toca mostrar, repartida por longitud cuando no hay tiempos reales. */
const porLongitud = (texto: string, duracionSeg: number, t: number) => {
  const partes = trozos(texto);
  const total = partes.reduce((a, p) => a + p.length, 0);
  let acc = 0;
  for (let i = 0; i < partes.length; i++) {
    const dur = (partes[i].length / total) * duracionSeg;
    if (t < acc + dur) return { contenido: partes[i], inicio: acc };
    acc += dur;
  }
  return { contenido: partes[partes.length - 1], inicio: 0 };
};

/** Frase actual con la palabra que se está diciendo resaltada. */
const porPalabras = (palabras: Palabra[], t: number) => {
  const grupos = agruparPalabras(palabras);
  const grupo = grupos[indiceActual(grupos, (g) => g[0].inicio, t)];
  const activa = indiceActual(grupo, (p) => p.inicio, t);
  return {
    inicio: grupo[0].inicio,
    contenido: grupo.map((p, i) => (
      <React.Fragment key={i}>
        <span
          style={{
            display: 'inline-block',
            padding: '0 8px',
            borderRadius: 10,
            background: i === activa ? FONDO : 'transparent',
            color: i === activa ? TINTA : FONDO,
          }}
        >
          {p.texto}
        </span>{' '}
      </React.Fragment>
    )),
  };
};

const Subtitulo: React.FC<{
  texto: string;
  duracionSeg: number;
  acento: string;
  audio?: string;
  palabras?: Palabra[];
  personaje?: ConfigPersonaje;
  tamPersonaje: number;
}> = ({ texto, duracionSeg, acento, audio, palabras, personaje, tamPersonaje }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { contenido, inicio } = palabras?.length ? porPalabras(palabras, t) : porLongitud(texto, duracionSeg, t);
  const pop = spring({ frame: Math.max(0, t - inicio) * fps, fps, config: { damping: 14, stiffness: 220 } });
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
          transform: `scale(${0.9 + pop * 0.1})`,
        }}
      >
        {contenido}
      </div>
    </div>
  );
};

/** Cuándo pasa cada cosa en el editor. Lo comparten el editor y la cámara. */
const tiemposEditor = (e: EscenaCodigo, duracionSeg: number) => {
  const lineas = (e.codigo ?? '').split('\n');
  // El código entra casi de inmediato; el resultado se guarda para cuando la voz lo explique.
  const paso = Math.min(0.16, (duracionSeg * 0.4) / Math.max(1, lineas.length));
  const inicio = 0.1;
  const finCodigo = inicio + paso * lineas.length;
  const tResaltar = finCodigo + 0.3;
  const salida = (e.salida ?? '').split('\n').filter((l) => l.length);
  const tSalida = Math.max(finCodigo + 0.6, duracionSeg * 0.3);
  const pasoSalida = Math.min(0.45, (duracionSeg * 0.35) / Math.max(1, salida.length));
  return { lineas, salida, paso, inicio, tResaltar, tSalida, pasoSalida };
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

/** Lo que dura el tecleo del código del gancho. */
const tiemposTecleo = (codigo: string, duracionSeg: number) => {
  const lineas = codigo.split('\n').slice(0, 4);
  const total = lineas.reduce((a, l) => a + l.length, 0);
  const inicio = 0.45;
  const fin = inicio + Math.min(1.8, duracionSeg * 0.45, total * 0.035);
  return { lineas, total, inicio, fin };
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
  const { lineas, total, inicio, fin } = tiemposTecleo(codigo, duracionSeg);
  const p = interpolate(frame / fps, [inicio, fin], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  let restantes = Math.floor(p * total);
  let cursorPuesto = false;
  const entra = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 12, stiffness: 170 } });
  const escribiendo = p < 1;
  const parpadeo = escribiendo || Math.floor(frame / 15) % 2 === 0;
  const pasoSonido = 3;
  return (
    <div
      style={{
        background: EDITOR,
        borderRadius: 26,
        border: `2px solid ${p >= 1 ? acento : 'rgba(244,241,255,0.12)'}`,
        boxShadow: p >= 1 ? `8px 8px 0 ${acento}` : 'none',
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
      {sonidos &&
        Array.from({ length: Math.ceil(total / pasoSonido) }, (_, k) => (
          <Sequence
            key={`tecla-${k}`}
            from={segAFrames(inicio + ((k * pasoSonido) / Math.max(1, total)) * (fin - inicio), fps)}
            durationInFrames={6}
            layout="none"
          >
            <Audio src={staticFile('sfx/tecla.wav')} volume={0.1} />
          </Sequence>
        ))}
      {lineas.map((l, i) => {
        const n = Math.max(0, Math.min(l.length, restantes));
        // El cursor va en la primera línea que aún no se termina (o en la última, al acabar)
        const conCursor = !cursorPuesto && (restantes < l.length || i === lineas.length - 1);
        if (conCursor) cursorPuesto = true;
        restantes -= l.length;
        return (
          <div key={i} style={{ height: 60 }}>
            {/* Monoespaciada: recortar en "ch" muestra n caracteres sin romper el resaltado */}
            <span style={{ display: 'inline-block', width: `${n}ch`, overflow: 'hidden', verticalAlign: 'top' }}>
              <LineaCodigo linea={l} />
            </span>
            {conCursor && parpadeo && (
              <span style={{ display: 'inline-block', width: 4, height: 44, background: acento, marginLeft: 3, verticalAlign: 'middle' }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const Editor: React.FC<{ e: EscenaCodigo; duracionSeg: number; acento: string; archivo: string; sonidos?: boolean }> = ({
  e,
  duracionSeg,
  acento,
  archivo,
  sonidos,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { lineas, salida, paso, inicio, tResaltar, tSalida, pasoSalida } = tiemposEditor(e, duracionSeg);
  const { fs: FS, lh: LH } = medidasEditor(lineas, salida.length);
  const pulso = 0.55 + 0.25 * Math.sin(frame / 7);
  const visiblesSalida = salida.filter((_, i) => frame >= segAFrames(tSalida + i * pasoSalida, fps));
  const ultimas = visiblesSalida.slice(-MAX_SALIDA_VISIBLE);
  const cursorLinea = Math.min(lineas.length - 1, Math.floor((frame / fps - inicio) / paso));
  const parpadeo = Math.floor(frame / 15) % 2 === 0;

  return (
    <div style={{ position: 'absolute', top: 400, left: 50, width: 885, display: 'flex', flexDirection: 'column', gap: 26 }}>
      {sonidos &&
        lineas.map((_, i) => (
          <Sequence key={`tecla-${i}`} from={segAFrames(inicio + i * paso, fps)} durationInFrames={6} layout="none">
            <Audio src={staticFile('sfx/tecla.wav')} volume={0.12} />
          </Sequence>
        ))}
      {sonidos &&
        salida.map((_, i) => (
          <Sequence key={`resultado-${i}`} from={segAFrames(tSalida + i * pasoSalida, fps)} durationInFrames={9} layout="none">
            <Audio src={staticFile('sfx/resultado.wav')} volume={0.1} />
          </Sequence>
        ))}
      <div style={{ background: EDITOR, borderRadius: 26, border: `2px solid rgba(244,241,255,0.12)`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 26px', borderBottom: '2px solid rgba(244,241,255,0.08)' }}>
          {['#FF7A8A', '#FFB454', '#7FD1B9'].map((c) => (
            <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
          ))}
          <div style={{ marginLeft: 14, fontFamily: MONO, fontWeight: 500, fontSize: 26, color: TENUE }}>{archivo}</div>
        </div>
        <div style={{ padding: '22px 0 26px' }}>
          {lineas.map((l, i) => {
            const t0 = segAFrames(inicio + i * paso, fps);
            const s = spring({ frame: frame - t0, fps, config: { damping: 16, stiffness: 180 } });
            const resaltada = e.resaltar?.includes(i + 1) && frame >= segAFrames(tResaltar, fps);
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
                  opacity: frame < t0 ? 0 : s,
                  transform: `translateX(${(1 - s) * 24}px)`,
                  background: resaltada ? `${acento}${Math.round(pulso * 0.35 * 255).toString(16).padStart(2, '0')}` : 'transparent',
                  boxShadow: resaltada ? `inset 8px 0 0 ${acento}` : 'none',
                }}
              >
                <span style={{ width: 60, textAlign: 'right', paddingRight: 20, color: 'rgba(244,241,255,0.28)', flex: '0 0 60px' }}>
                  {i + 1}
                </span>
                <span>
                  <LineaCodigo linea={l} />
                  {i === cursorLinea && frame < segAFrames(tResaltar + 0.6, fps) && parpadeo && (
                    <span style={{ display: 'inline-block', width: 3, height: FS + 4, background: acento, marginLeft: 4, verticalAlign: 'middle' }} />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {salida.length > 0 && frame >= segAFrames(tSalida - 0.2, fps) && (
        <div
          style={{
            background: 'rgba(14,12,30,0.75)',
            borderRadius: 22,
            border: `2px dashed ${SINTAXIS.cadena}55`,
            padding: '18px 26px 20px',
            opacity: interpolate(frame, [segAFrames(tSalida - 0.2, fps), segAFrames(tSalida, fps)], [0, 1], {
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: TENUE, marginBottom: 8 }}>
            CONSOLA
          </div>
          {ultimas.map((l, i) => (
            <div
              key={`${l}-${i}`}
              style={{
                fontFamily: MONO,
                fontWeight: 500,
                fontSize: 32,
                lineHeight: '46px',
                color: l.startsWith('...') ? SINTAXIS.palabra : SINTAXIS.cadena,
                ...SIN_LIGADURAS,
                whiteSpace: 'pre',
              }}
            >
              <span style={{ color: TENUE }}>›</span> {l}
            </div>
          ))}
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
  const visual = (v: Visual, top: number, alto: number) => (
    <div style={{ position: 'absolute', top, left: 50, width: 885, height: alto }}>
      <VisualVista visual={v} narracion={b.narracion} duracionSeg={duracionSeg} palabras={palabras} paleta={paleta} acento={acento} ancho={885} alto={alto} />
    </div>
  );
  /** Lo que se mueve con la cámara; el subtítulo y el personaje quedan fijos para que se lean bien. */
  const conCamara = (momentos: number[], escenario: React.ReactNode, tamPersonaje: number) => (
    <AbsoluteFill>
      <Camara duracionSeg={duracionSeg} golpes={golpesDeCamara(momentos, duracionSeg)}>
        {escenario}
      </Camara>
      <Subtitulo texto={b.narracion} duracionSeg={duracionSeg} acento={acento} tamPersonaje={tamPersonaje} {...voz} />
    </AbsoluteFill>
  );

  if (b.tipo === 'escena') {
    const momentos = b.codigo
      ? (() => {
          const te = tiemposEditor(b, duracionSeg);
          return [...(b.resaltar?.length ? [te.tResaltar] : []), ...(te.salida.length ? [te.tSalida] : [])];
        })()
      : b.visual
        ? tiemposVisual(b.visual, b.narracion, duracionSeg, palabras)
        : [];
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
        {b.codigo ? (
          <Editor e={b} duracionSeg={duracionSeg} acento={acento} archivo={b.archivo ?? archivo} sonidos={sonidos} />
        ) : b.visual ? (
          visual(b.visual, 390, 900)
        ) : null}
      </>,
      200,
    );
  }

  if (b.tipo === 'gancho') {
    const conCodigo = b.codigo && !b.visual ? b.codigo : undefined;
    const momentos = conCodigo
      ? [tiemposTecleo(conCodigo, duracionSeg).fin]
      : b.visual
        ? tiemposVisual(b.visual, b.narracion, duracionSeg, palabras)
        : [];
    return conCamara(
      momentos,
      <>
        <div style={{ position: 'absolute', top: 210, left: 70, right: 160, display: 'flex', flexDirection: 'column', gap: 34 }}>
          <EtiquetaGlitch texto="// JavaScript desde cero" color={acento} />
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
  return conCamara(
    [],
    <>
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
      <div style={{ position: 'absolute', top: 1000, left: 70, right: 160, fontFamily: MONO, fontWeight: 500, fontSize: 40, color: TENUE, opacity: entra }}>
        <div style={{ color: TINTA }}>{handle}</div>
        {ctaSecundario && <div style={{ fontSize: 32, marginTop: 10 }}>{ctaSecundario}</div>}
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
    { tipo: 'gancho', ...guion.gancho, codigo: guion.escenas.find((e) => e.codigo)?.codigo },
    ...guion.escenas.map((e, i) => ({ tipo: 'escena' as const, numero: i + 1, ...e })),
    { tipo: 'cierre', ...guion.cierre },
  ];
  const frames = framesPorBloque(timing.duraciones);
  const archivo = `${guion.slug.split('-').slice(0, 3).join('-')}.js`;
  let inicio = 0;

  return (
    <AbsoluteFill>
      <Fondo />
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
