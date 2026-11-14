import React from 'react';
import { Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  ALTO_FILA,
  ANCHO_PANEL_VARIABLES,
  ANONIMA,
  INICIO_CODIGO,
  PASO_CODIGO,
  inicioDePasos,
  MAX_CONSOLA_DEPURADOR,
  medidasDepurador,
  pasoActual,
  recortar,
  tiemposDePasos,
} from '../depurador';
import { EDITOR, FONDO, MONO, SIN_LIGADURAS, TENUE, TINTA, segAFrames } from '../temaCodigo';
import { EscenaCodigo, Palabra, PasoTraza, Traza } from '../types';
import { ANCHO_ANIMACION } from '../medidas';
import { LineaCodigo, SINTAXIS } from './Resaltado';

const valorPrevio = (paso: PasoTraza | undefined, etiqueta: string, nombre: string) =>
  paso?.grupos.find((g) => g.etiqueta === etiqueta)?.variables.find((v) => v.nombre === nombre)?.valor;

const estiloPanel: React.CSSProperties = {
  background: EDITOR,
  borderRadius: 22,
  border: '2px solid rgba(244,241,255,0.12)',
  padding: '16px 22px 20px',
  boxSizing: 'border-box',
  overflow: 'hidden',
};

const tituloPanel: React.CSSProperties = {
  fontFamily: MONO,
  fontWeight: 700,
  fontSize: 25,
  color: TENUE,
  height: 44,
  whiteSpace: 'nowrap',
};

const PanelVariables: React.FC<{ paso?: PasoTraza; previo?: PasoTraza; desde: number; acento: string; alto: number }> = ({
  paso,
  previo,
  desde,
  acento,
  alto,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cambio = spring({ frame: frame - desde, fps, config: { damping: 11, stiffness: 190 } });
  const lugar = paso?.en === 'programa' ? 'PROGRAMA' : paso?.en === ANONIMA ? ANONIMA : `${paso?.en}()`;
  const titulo = !paso ? 'VARIABLES' : paso.linea === 0 ? 'PROGRAMA TERMINADO' : `AHORA EN ${lugar}`;

  return (
    <div style={{ ...estiloPanel, width: ANCHO_PANEL_VARIABLES, height: alto, flex: '0 0 auto' }}>
      <div style={tituloPanel}>{titulo}</div>
      {paso?.grupos.map((g) => (
        <div key={`${g.etiqueta}-${g.recordada}`}>
          <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontWeight: 500, fontSize: 25, color: TENUE, whiteSpace: 'nowrap' }}>
            {g.etiqueta}
            {g.recordada && (
              <span style={{ background: acento, color: FONDO, fontWeight: 700, borderRadius: 8, padding: '0 10px', lineHeight: '30px' }}>recordada</span>
            )}
          </div>
          {g.variables.map((v) => {
            const cambiada = valorPrevio(previo, g.etiqueta, v.nombre) !== v.valor;
            return (
              <div
                key={v.nombre}
                style={{
                  height: ALTO_FILA,
                  display: 'flex',
                  alignItems: 'center',
                  fontFamily: MONO,
                  fontWeight: 500,
                  fontSize: 30,
                  ...SIN_LIGADURAS,
                  whiteSpace: 'pre',
                }}
              >
                <span
                  style={{
                    padding: '0 8px',
                    borderRadius: 8,
                    background: cambiada ? `${acento}55` : 'transparent',
                    transform: `scale(${cambiada ? 0.9 + cambio * 0.1 : 1})`,
                    transformOrigin: 'left center',
                  }}
                >
                  <span style={{ color: TINTA }}>{v.nombre}</span>
                  <span style={{ color: SINTAXIS.signo }}> = </span>
                  <span style={{ color: SINTAXIS.numero }}>{recortar(v.nombre, v.valor)}</span>
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const PanelConsola: React.FC<{ traza: Traza; paso?: PasoTraza; alto: number }> = ({ traza, paso, alto }) => {
  // Caben las líneas que permita el alto del panel (más alto cuando comparte fila con una animación)
  const caben = Math.max(MAX_CONSOLA_DEPURADOR, Math.floor((alto - 36 - 44) / ALTO_FILA));
  const lineas = traza.salida.slice(0, paso?.nSalida ?? 0).slice(-caben);
  return (
    <div style={{ ...estiloPanel, flex: 1, height: alto, border: `2px dashed ${SINTAXIS.cadena}55`, background: 'rgba(14,12,30,0.75)' }}>
      <div style={tituloPanel}>CONSOLA</div>
      {lineas.map((l, i) => (
        <div
          key={`${l}-${i}`}
          style={{ height: ALTO_FILA, display: 'flex', alignItems: 'center', fontFamily: MONO, fontWeight: 500, fontSize: 30, color: SINTAXIS.cadena, ...SIN_LIGADURAS, whiteSpace: 'pre' }}
        >
          <span style={{ color: TENUE }}>›</span>&nbsp;{l}
        </div>
      ))}
    </div>
  );
};

/** Editor que muestra el código corriendo: línea activa, variables y consola salen de la ejecución real. */
export const EditorDepurador: React.FC<{
  e: EscenaCodigo;
  duracionSeg: number;
  acento: string;
  archivo: string;
  sonidos?: boolean;
  palabras?: Palabra[];
  /** Con animación, ocupa el lugar del panel de variables (el contador ya muestra la variable del ciclo). */
  animacion?: React.ReactNode;
}> = ({ e, duracionSeg, acento, archivo, sonidos, palabras, animacion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const traza = e.traza as Traza;
  const lineas = (e.codigo ?? '').split('\n');
  const { fs, lh, altoPanel } = medidasDepurador(lineas, traza, !!animacion);
  const { tiempos } = tiemposDePasos(traza, e.depurar?.marcas ?? [], e.narracion, duracionSeg, inicioDePasos(lineas.length), palabras);

  const idx = pasoActual(tiempos, frame / fps);
  const paso = traza.pasos[idx];
  const previo = traza.pasos[idx - 1];
  const desde = idx >= 0 ? segAFrames(tiempos[idx], fps) : 0;

  // La franja viaja de la línea anterior a la nueva, para que se vea el salto de la ejecución.
  const viaje = spring({ frame: frame - desde, fps, config: { damping: 18, stiffness: 240 } });
  const lineaAnterior = previo && previo.linea > 0 ? previo.linea : (paso?.linea ?? 1);
  const yFranja = ((lineaAnterior + ((paso?.linea ?? 1) - lineaAnterior) * viaje) - 1) * lh;
  const pulso = 0.4 + 0.12 * Math.sin(frame / 7);

  return (
    <div style={{ position: 'absolute', top: 400, left: 50, width: 885, display: 'flex', flexDirection: 'column', gap: 26 }}>
      {sonidos &&
        lineas.map((_, i) => (
          <Sequence key={`tecla-${i}`} from={segAFrames(INICIO_CODIGO + i * PASO_CODIGO, fps)} durationInFrames={6} layout="none">
            <Audio src={staticFile('sfx/tecla.wav')} volume={0.12} />
          </Sequence>
        ))}
      {sonidos &&
        traza.pasos.map((p, i) =>
          i > 0 && p.nSalida > traza.pasos[i - 1].nSalida ? (
            <Sequence key={`resultado-${i}`} from={segAFrames(tiempos[i], fps)} durationInFrames={9} layout="none">
              <Audio src={staticFile('sfx/resultado.wav')} volume={0.1} />
            </Sequence>
          ) : null,
        )}
      <div style={{ background: EDITOR, borderRadius: 26, border: '2px solid rgba(244,241,255,0.12)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 26px', borderBottom: '2px solid rgba(244,241,255,0.08)' }}>
          {['#FF7A8A', '#FFB454', '#7FD1B9'].map((c) => (
            <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
          ))}
          <div style={{ marginLeft: 14, fontFamily: MONO, fontWeight: 500, fontSize: 26, color: TENUE }}>{archivo}</div>
        </div>
        <div style={{ padding: '22px 0 26px' }}>
          <div style={{ position: 'relative' }}>
            {paso && paso.linea > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: yFranja,
                  height: lh,
                  background: `${acento}${Math.round(pulso * 255).toString(16).padStart(2, '0')}`,
                  boxShadow: `inset 8px 0 0 ${acento}`,
                }}
              />
            )}
            {lineas.map((l, i) => {
              const t0 = segAFrames(INICIO_CODIGO + i * PASO_CODIGO, fps);
              const s = spring({ frame: frame - t0, fps, config: { damping: 16, stiffness: 180 } });
              return (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    height: lh,
                    alignItems: 'center',
                    fontFamily: MONO,
                    fontWeight: 500,
                    fontSize: fs,
                    ...SIN_LIGADURAS,
                    whiteSpace: 'pre',
                    opacity: frame < t0 ? 0 : s,
                    transform: `translateX(${(1 - s) * 24}px)`,
                  }}
                >
                  <span style={{ width: 60, textAlign: 'right', paddingRight: 20, color: 'rgba(244,241,255,0.28)', flex: '0 0 60px' }}>{i + 1}</span>
                  <span>
                    <LineaCodigo linea={l} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {animacion ? (
          <div style={{ width: ANCHO_ANIMACION, height: altoPanel, flex: '0 0 auto' }}>{animacion}</div>
        ) : (
          <PanelVariables paso={paso} previo={previo} desde={desde} acento={acento} alto={altoPanel} />
        )}
        <PanelConsola traza={traza} paso={paso} alto={altoPanel} />
      </div>
    </div>
  );
};
