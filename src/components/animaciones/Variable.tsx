import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { pasoEn } from '../../animaciones/pasos';
import { MONO, TENUE, TINTA } from '../../temaCodigo';
import { VariableCalculada } from '../../types';
import { SINTAXIS } from '../Resaltado';
import { MARGEN, Panel, Rotulo, ajustar, destello, easeOut, fijar01, rebote, recortarValor, tipoDe } from './comun';

const CAIDA = 0.5;

/**
 * Cajas con etiqueta: el valor cae dentro cuando la variable recibe uno, el viejo sale volando
 * cuando cambia, y la caja se apaga cuando la variable deja de existir.
 */
export const Variable: React.FC<{ c: VariableCalculada; tiempos: number[]; acento: string; ancho: number; alto: number; aparece: number }> = ({
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

  const n = c.cajas.length;
  const hueco = 18;
  const anchoCaja = Math.min(200, (ancho - 2 * MARGEN - hueco * (n - 1)) / n);
  const altoCaja = Math.min(170, alto * 0.42);
  const izq0 = (ancho - (n * anchoCaja + (n - 1) * hueco)) / 2;
  const base = alto * 0.5 + altoCaja / 2;

  return (
    <Panel ancho={ancho} alto={alto} s={sPanel}>
      <Rotulo texto={n > 1 ? 'variables' : 'variable'} s={sPanel} />
      {c.cajas.map((caja, k) => {
        const x = izq0 + k * (anchoCaja + hueco);
        // Cambio vigente y el anterior (que sale volando)
        let vigente = -1;
        caja.cambios.forEach((cb, i) => {
          if (cb.paso <= actual) vigente = i;
        });
        const tCambio = vigente >= 0 ? tiempos[caja.cambios[vigente].paso] : null;
        const tPrimero = caja.cambios.length ? tiempos[caja.cambios[0].paso] : Infinity;
        // La caja (vacía) entra con el panel; el valor espera a su momento
        const sCaja = rebote(frame, fps, Math.min(tPrimero - 0.45, aparece + 0.15 + 0.12 * k), 180, 11);
        const salio = caja.sale !== undefined && caja.sale <= actual;
        const sSale = salio ? fijar01((t - tiempos[caja.sale!]) / 0.5) : 0;
        const cae = tCambio !== null ? fijar01((t - tCambio) / CAIDA) : 0;
        // La tapa se abre justo antes de que caiga el valor y se cierra al aterrizar
        const tapa = tCambio !== null ? Math.sin(Math.PI * fijar01((t - tCambio + 0.12) / (CAIDA + 0.2))) : 0;
        const valor = vigente >= 0 ? caja.cambios[vigente].valor : null;
        const viejo = vigente > 0 ? caja.cambios[vigente - 1].valor : null;
        const aterriza = destello(t, tCambio !== null ? tCambio + CAIDA * 0.7 : null, 0.35);
        const fsValor = valor ? ajustar(recortarValor(valor), anchoCaja - 30, 46, 18) : 40;
        // El valor cae desde arriba con aceleración y aplasta un poco al llegar (squash and stretch)
        const caida = easeOut(cae);
        const yValor = -altoCaja * 0.95 * (1 - caida);
        const estira = cae < 0.7 ? 1 + 0.25 * (1 - cae) : 1 - 0.18 * aterriza;
        const color = salio ? TENUE : acento;

        return (
          <div
            key={caja.nombre}
            style={{
              position: 'absolute',
              left: x,
              top: base - altoCaja,
              width: anchoCaja,
              height: altoCaja,
              opacity: Math.min(1, sCaja * 1.5) * (1 - 0.55 * sSale),
              transform: `translateY(${(1 - sCaja) * 40}px) scale(${(0.7 + 0.3 * sCaja) * (1 - 0.1 * sSale)})`,
              transformOrigin: '50% 100%',
              perspective: 500,
            }}
          >
            {/* Etiqueta */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: -54,
                textAlign: 'center',
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: ajustar(`${caja.declaracion} ${caja.nombre}`, anchoCaja, 26),
                whiteSpace: 'pre',
              }}
            >
              <span style={{ color: SINTAXIS.palabra }}>{caja.declaracion === 'param' ? 'parámetro' : caja.declaracion}</span>{' '}
              <span style={{ color: TINTA }}>{caja.nombre}</span>
            </div>
            {/* Valor: el viejo sale volando, el nuevo cae */}
            {viejo !== null && cae < 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: altoCaja * 0.38,
                  textAlign: 'center',
                  fontFamily: MONO,
                  fontWeight: 700,
                  fontSize: ajustar(recortarValor(viejo), anchoCaja - 30, 46, 18),
                  color: TENUE,
                  opacity: 1 - cae,
                  transform: `translate(${cae * 130}px, ${-cae * 30}px) rotate(${cae * 30}deg)`,
                  whiteSpace: 'pre',
                }}
              >
                {recortarValor(viejo)}
              </div>
            )}
            {valor !== null && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: altoCaja * 0.38,
                  textAlign: 'center',
                  fontFamily: MONO,
                  fontWeight: 700,
                  fontSize: fsValor,
                  color: valor.startsWith('"') ? SINTAXIS.cadena : SINTAXIS.numero,
                  transform: `translateY(${yValor}px) scale(${1 / Math.sqrt(estira)}, ${estira})`,
                  transformOrigin: '50% 100%',
                  whiteSpace: 'pre',
                  zIndex: 1,
                }}
              >
                {recortarValor(valor)}
              </div>
            )}
            {/* Caja: frente y tapa con perspectiva */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: altoCaja * 0.32,
                bottom: 0,
                borderRadius: 16,
                border: `3px solid ${color}`,
                background: `linear-gradient(180deg, ${color}10, ${color}33)`,
                boxShadow: aterriza ? `0 0 ${30 * aterriza}px ${color}` : `6px 6px 0 ${color}55`,
                zIndex: 2,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: -6,
                right: -6,
                top: altoCaja * 0.32 - 10,
                height: 16,
                borderRadius: 8,
                background: color,
                transform: `rotateX(${-70 * tapa}deg) translateY(${-6 * tapa}px)`,
                transformOrigin: '50% 100%',
                zIndex: 3,
              }}
            />
            {/* Tipo de dato */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: -40,
                textAlign: 'center',
                fontFamily: MONO,
                fontWeight: 500,
                fontSize: 22,
                color: TENUE,
                opacity: valor !== null ? 1 : 0,
              }}
            >
              {salio ? 'ya no existe' : valor !== null ? `${tipoDe(valor)}${caja.declaracion === 'const' ? ' · fija' : ''}` : ''}
            </div>
          </div>
        );
      })}
    </Panel>
  );
};
