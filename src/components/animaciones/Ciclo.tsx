import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TiemposCiclo, anguloMarcador, valorVisible } from '../../animaciones/ciclo';
import { EDITOR, FONDO, MONO, SIN_LIGADURAS, TENUE, TINTA, segAFrames } from '../../temaCodigo';
import { CicloCalculado } from '../../types';
import { LineaCodigo, SINTAXIS } from '../Resaltado';
import { Estela, Particulas } from '../Movimiento';

const ALARMA = '#FF5A6E';
const VERDE = SINTAXIS.cadena;
const RAD = Math.PI / 180;

const fijar01 = (x: number) => Math.min(1, Math.max(0, x));
/** Rebote de entrada que arranca en `desde` (segundos); 0 antes. */
const rebote = (frame: number, fps: number, desde: number, rigido = 200, amortigua = 10) =>
  frame < segAFrames(desde, fps) ? 0 : spring({ frame: frame - segAFrames(desde, fps), fps, config: { damping: amortigua, stiffness: rigido } });

/** Quita let, const o var: en la pista basta con "i = 1". */
const sinDeclaracion = (s: string) => s.replace(/^(let|const|var)\s+/, '');

/** Tamaño de letra que hace caber `texto` en `ancho` px, entre un mínimo y un máximo. */
const ajustar = (texto: string, ancho: number, max: number, min = 18) => Math.max(min, Math.min(max, ancho / Math.max(1, texto.length * 0.6)));

const Chip: React.FC<{ codigo: string; s: number; destello: number; color: string; fs: number; style?: React.CSSProperties }> = ({
  codigo,
  s,
  destello,
  color,
  fs,
  style,
}) => (
  <div
    style={{
      position: 'absolute',
      fontFamily: MONO,
      fontWeight: 500,
      fontSize: fs,
      ...SIN_LIGADURAS,
      whiteSpace: 'pre',
      background: FONDO,
      border: `2px solid ${color}`,
      borderRadius: 14,
      padding: '6px 12px',
      boxShadow: destello > 0 ? `0 0 ${28 * destello}px ${color}` : `4px 4px 0 ${color}`,
      opacity: Math.min(1, s * 1.6),
      transform: `scale(${(0.4 + 0.6 * s) * (1 + 0.12 * destello)}) rotate(${(1 - s) * -10}deg)`,
      ...style,
    }}
  >
    <LineaCodigo linea={codigo} />
  </div>
);

/**
 * Pista circular de un ciclo: arriba se revisa la condición, a la derecha corre el cuerpo,
 * abajo a la izquierda cambia la variable. El marcador da una vuelta por iteración y el
 * contador del centro cambia cuando cambia la variable de verdad.
 */
export const Ciclo: React.FC<{
  c: CicloCalculado;
  tiempos: TiemposCiclo;
  salida: string[];
  acento: string;
  ancho: number;
  alto: number;
}> = ({ c, tiempos, salida, acento, ancho, alto }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const dt = 1 / fps;

  const R = ancho > 600 ? Math.min(140, alto * 0.33) : Math.min(118, alto * 0.28);
  const cx = ancho / 2;
  const cy = alto * 0.57;
  const MARGEN = 16;
  const condicion = c.partes.condicion;
  const inicio = c.partes.inicio ? sinDeclaracion(c.partes.inicio) : null;
  // Fila de arriba: el inicio a la izquierda y la condición sobre la puerta, sin encimarse
  const fsInicio = inicio ? ajustar(inicio, 150, 26) : 0;
  const anchoInicio = inicio ? inicio.length * fsInicio * 0.6 + 28 : 0;
  const ANCHO_SI = 64;
  const libre = ancho - 2 * MARGEN - (inicio ? anchoInicio + 14 : 0) - ANCHO_SI - 8;
  const fsCond = ajustar(`¿${condicion}?`, libre - 28, 30);
  const anchoCond = (condicion.length + 2) * fsCond * 0.6 + 28;
  const izqCond = Math.min(ancho - MARGEN - ANCHO_SI - 8 - anchoCond, Math.max(MARGEN + (inicio ? anchoInicio + 14 : 0), cx - anchoCond / 2));
  const yFila = MARGEN;
  const altoFila = fsCond * 1.3 + 16;
  const xConector = Math.min(Math.max(cx, izqCond + 24), izqCond + anchoCond - 24);
  // El inicio se pega a la condición y el cambio a la pista, para que se lean como parte del ciclo
  const izqInicio = Math.max(MARGEN, izqCond - 14 - anchoInicio);
  const fsCambio = c.partes.cambio ? ajustar(c.partes.cambio, 130, 26) : 0;
  const anchoCambio = c.partes.cambio ? c.partes.cambio.length * fsCambio * 0.6 + 28 : 0;
  const izqCambio = Math.max(MARGEN, cx - R - 36 - anchoCambio);
  const punto = (a: number, r = R) => ({ x: cx + r * Math.sin(a * RAD), y: cy - r * Math.cos(a * RAD) });
  const { vueltas, partes, salida: tSalida, desboque } = tiempos;

  // Entradas de las partes: cuando la voz las nombra
  const sInicio = rebote(frame, fps, partes.inicio);
  const sCondicion = rebote(frame, fps, partes.condicion);
  const sCambio = rebote(frame, fps, partes.cambio);
  const sPista = rebote(frame, fps, Math.min(partes.inicio, vueltas[0]?.revision ?? partes.inicio) - 0.2, 120, 16);

  // Revisión más reciente: el letrero de la condición reacciona con sí o no
  let ultimaRev = -1;
  vueltas.forEach((v, k) => {
    if (v.revision <= t) ultimaRev = k;
  });
  const revActual = ultimaRev >= 0 ? vueltas[ultimaRev] : null;
  const golpeRev = revActual ? Math.max(0, 1 - (t - revActual.revision) / 0.35) : 0;
  const desbocado = desboque !== null && t >= desboque;
  const salio = tSalida !== null && t >= tSalida;
  const dijoSi = revActual ? revActual.cuerpo !== null || desbocado : false;

  // Cambio de la variable: el chip de "cambio" destella y el contador rebota
  let ultimoCambio: number | null = null;
  vueltas.forEach((v) => {
    if (v.cambio !== null && v.cambio <= t) ultimoCambio = v.cambio;
  });
  const destelloCambio = ultimoCambio !== null ? Math.max(0, 1 - (t - ultimoCambio) / 0.4) : 0;

  // Marcador: durante las vueltas sigue la pista; en el desboque gira cada vez más rápido
  const posicion = (tt: number) => {
    const m = anguloMarcador(tiempos, tt);
    const ex = desbocado && tt >= (desboque as number) ? (tt - (desboque as number)) ** 2 * 260 + (tt - (desboque as number)) * 360 : 0;
    return m.angulo + ex;
  };
  const angulo = posicion(t);
  const vel = Math.abs(angulo - posicion(t - dt)) / dt; // grados por segundo
  const estira = 1 + Math.min(0.9, vel / 900);

  // Antes de la primera revisión, el marcador espera junto al inicio y entra a la pista
  const rev0 = vueltas[0]?.revision ?? Infinity;
  const anclaInicio = { x: izqInicio + 26, y: yFila + altoFila - 16 };
  const puerta = punto(0);
  const llegada = fijar01((t - (rev0 - 0.45)) / 0.45);
  const llegadaSuave = 1 - (1 - llegada) ** 3;
  let marcador = t < rev0 ? { x: anclaInicio.x + (puerta.x - anclaInicio.x) * llegadaSuave, y: anclaInicio.y + 40 + (puerta.y - anclaInicio.y - 40) * llegadaSuave } : punto(angulo);
  // Al salir del ciclo, el marcador sale de la pista hacia la derecha por arriba
  const pSalida = salio ? fijar01((t - (tSalida as number)) / 0.6) : 0;
  if (salio) marcador = { x: puerta.x + 150 * pSalida ** 1.5, y: puerta.y - 30 * Math.sin(pSalida * Math.PI) };
  const visibleMarcador = Math.min(1, sInicio * 1.5) * (1 - fijar01((pSalida - 0.7) / 0.3));
  const tangente = salio ? 0 : angulo;

  // Estela: posiciones recientes, cada vez más tenues
  const estela = !salio && t >= rev0 && vel > 200 ? [1, 2, 3, 4, 5].map((j) => ({ ...punto(posicion(t - j * dt * 0.8)), o: 0.35 * (1 - j / 6) })) : [];

  // Valor visible del contador
  const idxValor = valorVisible(tiempos, t);
  const valor = t < partes.inicio ? '' : (c.vueltas[Math.min(idxValor, c.vueltas.length - 1)]?.valor ?? '');
  const tCambioValor = idxValor > 0 ? (vueltas[idxValor - 1]?.cambio ?? 0) : partes.inicio;
  const sValor = rebote(frame, fps, tCambioValor, 260, 7);
  const otras = c.vueltas[Math.max(0, Math.min(idxValor - 1, c.vueltas.length - 1))]?.otras ?? [];
  const nVuelta = Math.min(vueltas.filter((v) => v.cuerpo !== null && v.revision <= t).length, c.vueltas.length);

  // Lo que imprime cada vuelta sale disparado del cuerpo hacia la consola
  const disparos = c.vueltas.flatMap((v, k) => {
    const m = vueltas[k];
    // En el desboque la consola ya no muestra cada línea: no se dispara nada
    if (!m || m.cuerpo === null || !v.salidas.length || (desboque !== null && m.cuerpo >= desboque)) return [];
    const p = (t - m.cuerpo) / 0.5;
    if (p < 0 || p > 1) return [];
    return [{ texto: salida[v.salidas[0]] ?? '', p, tc: m.cuerpo }];
  });

  const colorPista = desbocado ? ALARMA : salio ? VERDE : acento;
  const latidoAlarma = desbocado ? 0.5 + 0.5 * Math.sin(t * 18) : 0;
  const progreso = salio || t < rev0 ? (salio ? 360 : 0) : desbocado ? 360 : anguloMarcador(tiempos, t).angulo;
  const fin = punto(Math.min(359.9, progreso));
  const arco = progreso >= 359.9 ? `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R}` : `M ${cx} ${cy - R} A ${R} ${R} 0 ${progreso > 180 ? 1 : 0} 1 ${fin.x} ${fin.y}`;
  const brilloExito = salio ? Math.max(0, 1 - (t - (tSalida as number)) / 0.9) : 0;

  const cuerpo = punto(90);

  return (
    <div style={{ position: 'relative', width: ancho, height: alto, zIndex: 2 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: EDITOR,
          borderRadius: 26,
          border: `2px solid ${salio ? `${VERDE}88` : desbocado ? `${ALARMA}${Math.round(80 + 120 * latidoAlarma).toString(16)}` : 'rgba(244,241,255,0.12)'}`,
          boxShadow: brilloExito ? `0 0 ${60 * brilloExito}px ${VERDE}` : desbocado ? `0 0 ${30 * latidoAlarma}px ${ALARMA}` : 'none',
          opacity: Math.min(1, sPista * 1.4),
        }}
      />
      <svg width={ancho} height={alto} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {/* Pista */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(244,241,255,0.09)" strokeWidth={22} style={{ opacity: sPista }} />
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="rgba(244,241,255,0.18)"
          strokeWidth={2}
          strokeDasharray="2 14"
          style={{ opacity: sPista, transform: `rotate(${t * 12}deg)`, transformOrigin: `${cx}px ${cy}px` }}
        />
        {progreso > 0.5 && <path d={arco} fill="none" stroke={colorPista} strokeWidth={22} strokeLinecap="round" opacity={desbocado ? 0.5 + 0.4 * latidoAlarma : 0.85} />}
        {/* Puerta de la condición (unida a su letrero) y punto del cuerpo */}
        <path
          d={`M ${xConector} ${yFila + altoFila} C ${xConector} ${yFila + altoFila + 30}, ${cx} ${cy - R - 50}, ${cx} ${cy - R - 20}`}
          fill="none"
          stroke={revActual ? (dijoSi ? VERDE : ALARMA) : 'rgba(244,241,255,0.35)'}
          strokeWidth={3}
          strokeDasharray="6 8"
          opacity={sCondicion}
        />
        <line x1={cx} y1={cy - R - 18} x2={cx} y2={cy - R + 18} stroke={TINTA} strokeWidth={5} strokeLinecap="round" opacity={sCondicion} />
        <circle cx={cuerpo.x} cy={cuerpo.y} r={9} fill={EDITOR} stroke={TENUE} strokeWidth={3} opacity={sPista} />
        {/* Estela y marcador */}
        {estela.map((e, i) => (
          <circle key={i} cx={e.x} cy={e.y} r={14 - i * 1.6} fill={colorPista} opacity={e.o * visibleMarcador} />
        ))}
        <g transform={`translate(${marcador.x} ${marcador.y}) rotate(${tangente})`} opacity={visibleMarcador}>
          <ellipse rx={18 * estira} ry={18 / Math.sqrt(estira)} fill={TINTA} />
          <ellipse rx={11 * estira} ry={11 / Math.sqrt(estira)} fill={colorPista} />
        </g>
      </svg>

      {/* Contador en el centro */}
      <div
        style={{
          position: 'absolute',
          left: cx - R + 20,
          width: 2 * R - 40,
          top: cy - 70,
          height: 140,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: MONO,
          opacity: sInicio,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, color: TENUE }}>{c.variable}</div>
        <div
          style={{
            fontSize: ajustar(valor, 2 * R - 50, 84, 30),
            fontWeight: 700,
            lineHeight: 1,
            color: desbocado ? ALARMA : TINTA,
            transform: `scale(${0.75 + 0.25 * sValor}, ${1.15 - 0.15 * sValor})`,
            whiteSpace: 'pre',
          }}
        >
          {valor}
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: TENUE, marginTop: 6, whiteSpace: 'nowrap' }}>
          {salio ? 'terminó' : desbocado ? '∞ vueltas' : nVuelta ? `vuelta ${nVuelta}` : ' '}
        </div>
      </div>

      {/* Inicio */}
      {inicio && (
        <Chip codigo={inicio} s={sInicio} destello={0} color={acento} fs={fsInicio} style={{ left: izqInicio, top: yFila, transformOrigin: 'left top' }} />
      )}
      {/* Condición: arriba, unida a la puerta */}
      <div
        style={{
          position: 'absolute',
          left: izqCond,
          top: yFila,
          transform: `scale(${(0.4 + 0.6 * sCondicion) * (1 + 0.1 * golpeRev)})`,
          transformOrigin: `${xConector - izqCond}px bottom`,
          opacity: Math.min(1, sCondicion * 1.6),
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 500,
            fontSize: fsCond,
            ...SIN_LIGADURAS,
            whiteSpace: 'pre',
            background: FONDO,
            border: `2px solid ${revActual ? (dijoSi ? VERDE : ALARMA) : TINTA}`,
            borderRadius: 14,
            padding: '6px 12px',
            boxShadow: golpeRev > 0 ? `0 0 ${30 * golpeRev}px ${dijoSi ? VERDE : ALARMA}` : 'none',
          }}
        >
          <span style={{ color: TENUE }}>¿</span>
          <LineaCodigo linea={condicion} />
          <span style={{ color: TENUE }}>?</span>
        </div>
        {revActual && (
          <div
            style={{
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 24,
              color: FONDO,
              background: dijoSi ? VERDE : ALARMA,
              borderRadius: 10,
              padding: '4px 10px',
              transform: `scale(${1 + 0.3 * golpeRev})`,
            }}
          >
            {dijoSi ? 'sí' : 'no'}
          </div>
        )}
      </div>
      {/* Cambio: abajo a la izquierda, donde la variable cambia */}
      {c.partes.cambio && (
        <Chip
          codigo={c.partes.cambio}
          s={sCambio}
          destello={destelloCambio}
          color={desbocado ? ALARMA : acento}
          fs={fsCambio}
          style={{ left: izqCambio, bottom: MARGEN, transformOrigin: 'left bottom' }}
        />
      )}
      {/* Otras variables (con depurar) */}
      {otras.length > 0 && (
        <div style={{ position: 'absolute', right: 16, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, opacity: sInicio }}>
          {otras.map((v) => (
            <div key={v.nombre} style={{ fontFamily: MONO, fontWeight: 500, fontSize: 24, color: TENUE, whiteSpace: 'pre' }}>
              {v.nombre} = <span style={{ color: SINTAXIS.numero }}>{v.valor.length > 10 ? `${v.valor.slice(0, 9)}…` : v.valor}</span>
            </div>
          ))}
        </div>
      )}
      {/* Lo que imprime cada vuelta */}
      {disparos.map((d, i) => (
        <Estela
          key={i}
          dibujar={(f) => {
            const p = (f / fps - d.tc) / 0.5;
            if (p < 0 || p > 1) return null;
            return (
              <div
                style={{
                  position: 'absolute',
                  left: cuerpo.x + 20 + 170 * (1 - (1 - p) ** 2),
                  top: cuerpo.y - 22 - 40 * Math.sin(p * Math.PI),
                  fontFamily: MONO,
                  fontWeight: 700,
                  fontSize: 30,
                  color: FONDO,
                  background: VERDE,
                  borderRadius: 10,
                  padding: '2px 10px',
                  whiteSpace: 'pre',
                  opacity: p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25,
                  // Sale estirado por la velocidad y se encoge al frenar
                  transform: `scale(${(0.6 + 0.4 * Math.min(1, p * 4)) * (1 + 0.3 * (1 - p))}, ${(0.6 + 0.4 * Math.min(1, p * 4)) * (1 - 0.15 * (1 - p))})`,
                }}
              >
                {d.texto}
              </div>
            );
          }}
        />
      ))}
      {/* Al salir del ciclo: explosión de partículas en la puerta */}
      {tSalida !== null && <Particulas desde={tSalida + 0.1} x={puerta.x} y={puerta.y} colores={[VERDE, acento, TINTA]} semilla={`ciclo-${c.linea}`} cantidad={20} fuerza={0.7} />}
    </div>
  );
};
