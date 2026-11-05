import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
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
import { framesPorBloque, trozos } from './FiestaVideo';
import { Personaje } from './components/Personaje';
import { LineaCodigo, SINTAXIS } from './components/Resaltado';
import { MAX_SALIDA_VISIBLE, medidasEditor } from './medidas';
import { agruparPalabras, indiceActual } from './subtitulos';
import { CodigoProps, ConfigPersonaje, EscenaCodigo, Palabra } from './types';

const FONDO = '#15122A';
const EDITOR = '#0E0C1E';
const TINTA = '#F4F1FF';
const TENUE = '#9C95BF';
const TITULO = '"Bricolage Grotesque", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const TEXTO = 'Nunito, system-ui, sans-serif';

/** Sin ligaduras: un principiante debe ver <= y ++ tal cual se escriben. */
const SIN_LIGADURAS = { fontVariantLigatures: 'none' as const, fontFeatureSettings: '"liga" 0, "calt" 0' };

type Bloque =
  | { tipo: 'gancho'; titulo: string; narracion: string; codigo?: string }
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

const Editor: React.FC<{ e: EscenaCodigo; duracionSeg: number; acento: string; archivo: string; sonidos?: boolean }> = ({
  e,
  duracionSeg,
  acento,
  archivo,
  sonidos,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lineas = (e.codigo ?? '').split('\n');
  // El código entra casi de inmediato; el resultado se guarda para cuando la voz lo explique.
  const paso = Math.min(0.16, (duracionSeg * 0.4) / Math.max(1, lineas.length));
  const inicio = 0.1;
  const finCodigo = inicio + paso * lineas.length;
  const tResaltar = finCodigo + 0.3;
  const salida = (e.salida ?? '').split('\n').filter((l) => l.length);
  const { fs: FS, lh: LH } = medidasEditor(lineas, salida.length);
  const tSalida = Math.max(finCodigo + 0.6, duracionSeg * 0.3);
  const pasoSalida = Math.min(0.45, (duracionSeg * 0.35) / Math.max(1, salida.length));
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
  total: number;
  duracionSeg: number;
  handle: string;
  ctaSecundario: string;
  archivo: string;
  audio?: string;
  palabras?: Palabra[];
  personaje?: ConfigPersonaje;
  sonidos?: boolean;
}> = ({ b, acento, total, duracionSeg, handle, ctaSecundario, archivo, audio, palabras, personaje, sonidos }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Adelantado para que el primer cuadro nunca salga vacío
  const entra = spring({ frame: frame + 8, fps, config: { damping: 13, stiffness: 160 } });
  const voz = { audio, palabras, personaje };

  if (b.tipo === 'escena') {
    return (
      <AbsoluteFill>
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
          <Editor e={b} duracionSeg={duracionSeg} acento={acento} archivo={archivo} sonidos={sonidos} />
        ) : null}
        <Subtitulo texto={b.narracion} duracionSeg={duracionSeg} acento={acento} tamPersonaje={200} {...voz} />
      </AbsoluteFill>
    );
  }

  if (b.tipo === 'gancho') {
    return (
      <AbsoluteFill>
        <div style={{ position: 'absolute', top: 210, left: 70, right: 160, display: 'flex', flexDirection: 'column', gap: 34 }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 38, color: acento, opacity: entra }}>// JavaScript desde cero</div>
          <div
            style={{
              fontFamily: TITULO,
              fontWeight: 800,
              fontSize: 112,
              lineHeight: 0.98,
              color: TINTA,
              opacity: entra,
              transform: `translateY(${(1 - entra) * 30}px)`,
              textWrap: 'balance',
            }}
          >
            {b.titulo}
          </div>
          {b.codigo && (
            <div
              style={{
                background: EDITOR,
                borderRadius: 26,
                border: '2px solid rgba(244,241,255,0.12)',
                padding: '26px 28px',
                fontFamily: MONO,
                fontWeight: 500,
                fontSize: 38,
                lineHeight: '60px',
                whiteSpace: 'pre',
                opacity: entra,
                ...SIN_LIGADURAS,
              }}
            >
              {b.codigo.split('\n').slice(0, 4).map((l, i) => (
                <div key={i}>
                  <LineaCodigo linea={l} />
                </div>
              ))}
            </div>
          )}
        </div>
        <Subtitulo texto={b.narracion} duracionSeg={duracionSeg} acento={acento} tamPersonaje={240} {...voz} />
      </AbsoluteFill>
    );
  }

  const parpadeo = Math.floor(frame / 15) % 2 === 0;
  return (
    <AbsoluteFill>
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
      <Subtitulo texto={b.narracion} duracionSeg={duracionSeg} acento={acento} tamPersonaje={220} {...voz} />
    </AbsoluteFill>
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
    </AbsoluteFill>
  );
};
