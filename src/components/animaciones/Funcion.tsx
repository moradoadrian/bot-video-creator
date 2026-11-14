import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { FONDO, MONO, SIN_LIGADURAS, TENUE, TINTA } from '../../temaCodigo';
import { FuncionCalculada } from '../../types';
import { LineaCodigo, SINTAXIS } from '../Resaltado';
import { MARGEN, Panel, Rotulo, VERDE, ajustar, destello, easeInOut, easeOut, fijar01, rebote, recortarValor } from './comun';
import { Estela, Particulas, squash } from '../Movimiento';

/** Engrane simple de 8 dientes. */
const Engrane: React.FC<{ r: number; color: string; giro: number }> = ({ r, color, giro }) => {
  const dientes = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <g transform={`rotate(${giro})`}>
      {dientes.map((a) => (
        <rect key={a} x={-r * 0.18} y={-r * 1.18} width={r * 0.36} height={r * 0.4} rx={3} fill={color} transform={`rotate(${a})`} />
      ))}
      <circle r={r * 0.85} fill={color} />
      <circle r={r * 0.35} fill={FONDO} />
    </g>
  );
};

/**
 * Una máquina: los argumentos de cada llamada vuelan a sus parámetros y entran por el embudo,
 * la máquina trabaja mientras la función corre y el resultado sale por abajo cuando regresa.
 */
export const Funcion: React.FC<{ c: FuncionCalculada; tiempos: number[]; acento: string; ancho: number; alto: number; aparece: number }> = ({
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

  // Llamada en curso: la última cuyos argumentos ya empezaron a volar
  let k = -1;
  c.llamadas.forEach((l, i) => {
    if (tiempos[l.entra] - 0.7 <= t) k = i;
  });
  const ll = k >= 0 ? c.llamadas[k] : null;
  const tE = ll ? tiempos[ll.entra] : Infinity;
  const tS = ll ? tiempos[ll.sale] : Infinity;
  const corriendo = t >= tE && t < tS;
  const regreso = t >= tS;

  const cx = ancho / 2;
  const anchoMaq = Math.min(ancho * 0.62, 340);
  // De arriba a abajo: rótulo, parámetros, embudo, máquina y resultado
  const yParams = MARGEN + 42;
  const yMaq = yParams + 46 + 44;
  const altoMaq = Math.min(130, alto - yMaq - 110);
  const temblor = corriendo ? Math.sin(t * 60) * 3 : 0;
  const giro = corriendo ? (t - tE) * 400 : regreso ? (tS - tE) * 400 : 0;
  const golpeSalida = destello(t, ll ? tS : null, 0.5);

  const params = c.parametros.length ? c.parametros : ['( )'];
  const anchoParam = Math.min(160, (ancho - 2 * MARGEN - 12 * (params.length - 1)) / params.length);
  const xParam = (i: number) => (ancho - (params.length * anchoParam + (params.length - 1) * 12)) / 2 + i * (anchoParam + 12);

  const resultado = ll ? ll.resultado : '';
  const sResultado = regreso ? rebote(frame, fps, tS, 220, 9) : 0;
  const aplasta = squash(t, ll ? tS + 0.18 : null);
  const fsResultado = ajustar(`→ ${recortarValor(resultado, 16)}`, ancho - 2 * MARGEN - 20, 40, 18);

  return (
    <Panel ancho={ancho} alto={alto} s={sPanel} brillo={golpeSalida ? `0 0 ${40 * golpeSalida}px ${VERDE}` : undefined}>
      <Rotulo texto="función" s={sPanel} />
      {c.llamadas.length > 1 && (
        <div style={{ position: 'absolute', right: MARGEN + 4, top: MARGEN, fontFamily: MONO, fontSize: 22, color: TENUE, opacity: sPanel }}>
          llamada {Math.max(1, k + 1)} de {c.llamadas.length}
        </div>
      )}
      {/* Parámetros: cada uno recibe el valor de su argumento */}
      {params.map((p, i) => {
        const arg = ll?.argumentos[i];
        const llega = ll ? easeOut((t - (tE - 0.7 + i * 0.12)) / 0.45) : 0;
        // El parámetro conserva su valor hasta que llega la siguiente llamada
        const lleno = arg !== undefined && llega >= 1;
        const sLleno = lleno ? rebote(frame, fps, tE - 0.25 + i * 0.12, 260, 10) : 0;
        const texto = lleno ? `${p} = ${recortarValor(arg, 8)}` : p;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: xParam(i),
                width: anchoParam,
                top: yParams,
                height: 46,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: MONO,
                fontWeight: 500,
                fontSize: ajustar(texto, anchoParam - 16, 26, 14),
                ...SIN_LIGADURAS,
                whiteSpace: 'pre',
                border: `2px ${lleno ? 'solid' : 'dashed'} ${lleno ? acento : 'rgba(244,241,255,0.35)'}`,
                borderRadius: 12,
                background: lleno ? `${acento}22` : 'transparent',
                color: TINTA,
                opacity: sPanel,
                transform: `scale(${1 + 0.1 * (1 - sLleno) * (lleno ? 1 : 0)})`,
              }}
            >
              <LineaCodigo linea={texto} />
            </div>
            {/* El argumento vuela desde la izquierda hasta su parámetro, con estela y estirado por la velocidad */}
            {arg !== undefined && llega > 0 && llega < 1 && (
              <Estela
                dibujar={(f) => {
                  const p = easeOut((f / fps - (tE - 0.7 + i * 0.12)) / 0.45);
                  if (p <= 0 || p >= 1) return null;
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        left: MARGEN + (xParam(i) + anchoParam / 2 - 40 - MARGEN) * p,
                        top: yParams + 4 - Math.sin(p * Math.PI) * 50,
                        fontFamily: MONO,
                        fontWeight: 700,
                        fontSize: 26,
                        color: FONDO,
                        background: acento,
                        borderRadius: 10,
                        padding: '2px 10px',
                        whiteSpace: 'pre',
                        transform: `rotate(${(1 - p) * -20}deg) scaleX(${1 + 0.35 * (1 - p)})`,
                      }}
                    >
                      {recortarValor(arg, 8)}
                    </div>
                  );
                }}
              />
            )}
          </React.Fragment>
        );
      })}
      <svg width={ancho} height={alto} style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: sPanel }}>
        {/* Embudo */}
        <path
          d={`M ${cx - anchoMaq * 0.36} ${yMaq - 36} L ${cx + anchoMaq * 0.36} ${yMaq - 36} L ${cx + anchoMaq * 0.14} ${yMaq} L ${cx - anchoMaq * 0.14} ${yMaq} Z`}
          fill={`${acento}33`}
          stroke={acento}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {/* Cuerpo de la máquina */}
        <g transform={`translate(${temblor} 0)`}>
          <rect x={cx - anchoMaq / 2} y={yMaq} width={anchoMaq} height={altoMaq} rx={24} fill={FONDO} stroke={acento} strokeWidth={4} />
          <g transform={`translate(${cx + anchoMaq / 2 - 40} ${yMaq + 40})`}>
            <Engrane r={22} color={`${acento}AA`} giro={giro} />
          </g>
          <g transform={`translate(${cx + anchoMaq / 2 - 74} ${yMaq + 76})`}>
            <Engrane r={15} color={`${acento}77`} giro={-giro * 1.4 + 20} />
          </g>
          {/* Luz: ámbar mientras trabaja, verde al regresar */}
          <circle cx={cx - anchoMaq / 2 + 28} cy={yMaq + 28} r={9} fill={corriendo ? (Math.floor(t * 8) % 2 ? acento : `${acento}55`) : regreso ? VERDE : 'rgba(244,241,255,0.2)'} />
          {/* Salida */}
          <rect x={cx - 34} y={yMaq + altoMaq - 4} width={68} height={22} rx={6} fill={FONDO} stroke={acento} strokeWidth={3} />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: cx - anchoMaq / 2 + 48,
          width: anchoMaq - 170,
          top: yMaq + altoMaq / 2 - 26,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: ajustar(`${c.nombre}()`, anchoMaq - 170, 34, 16),
          color: SINTAXIS.funcion,
          whiteSpace: 'pre',
          opacity: sPanel,
          transform: `translateX(${temblor}px)`,
        }}
      >
        {c.nombre}()
      </div>
      {/* Resultado: sale disparado por abajo */}
      {regreso && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: yMaq + altoMaq + 8 + 34 * sResultado,
            display: 'flex',
            justifyContent: 'center',
            opacity: Math.min(1, sResultado * 2),
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: fsResultado,
              ...SIN_LIGADURAS,
              whiteSpace: 'pre',
              color: FONDO,
              background: resultado === 'undefined' ? TENUE : VERDE,
              borderRadius: 12,
              padding: '4px 16px',
              // Sale estirado hacia abajo y se aplasta al caer (squash and stretch)
              transform: `scale(${(0.5 + 0.5 * sResultado) * aplasta.sx}, ${(0.5 + 0.5 * sResultado + 0.15 * (1 - fijar01((t - tS) / 0.3))) * aplasta.sy})`,
              boxShadow: `5px 5px 0 ${TINTA}`,
            }}
          >
            → {recortarValor(resultado, 16)}
          </div>
        </div>
      )}
      {/* Chispas cada vez que la máquina entrega un resultado */}
      {c.llamadas.map((l, k) =>
        l.resultado === 'undefined' ? null : (
          <Particulas key={k} desde={tiempos[l.sale] + 0.15} x={ancho / 2} y={yMaq + altoMaq + 50} colores={[VERDE, acento, '#F4F1FF']} semilla={`funcion-${k}`} cantidad={14} fuerza={0.55} />
        ),
      )}
      {ll && !regreso && t >= tE && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: yMaq + altoMaq + 30,
            textAlign: 'center',
            fontFamily: MONO,
            fontSize: 22,
            color: TENUE,
            opacity: easeInOut((t - tE) / 0.3),
          }}
        >
          trabajando…
        </div>
      )}
    </Panel>
  );
};
