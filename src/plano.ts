/**
 * Plano de una escena con código: el mundo (alto del editor y de lo que va debajo) y las tomas
 * de la cámara (a qué panel mira y desde cuándo). Sin React, para usarlo en la plantilla y las pruebas.
 */
import { PlanAnimacion } from './animaciones/plan';
import { inicioDePasos, medidasDepurador } from './depurador';
import { RitmoSalida, tiemposEditor } from './editor';
import { Mundo, Toma, limpiarTomas, mundoDe, viaja } from './escenario';
import { ALTO_ANIMACION, SEPARACION_FILA, altoConsola, altoEditor, medidasEditor } from './medidas';
import { EscenaCodigo } from './types';

export type Plano = {
  mundo: Mundo;
  tomas: Toma[];
  viaja: boolean;
  /** Cuando entra el panel de abajo (consola, animación o variables). */
  entraAbajo: number;
};

export const planoDeEscena = (e: EscenaCodigo, dur: number, plan: PlanAnimacion | null, ritmo?: RitmoSalida): Plano | null => {
  if (!e.codigo) return null;
  const lineas = e.codigo.split('\n');
  const conAnimacion = !!plan;

  if (e.traza) {
    const m = medidasDepurador(lineas, e.traza, conAnimacion);
    const mundo = mundoDe(altoEditor(lineas.length, m.lh), m.altoPanel, SEPARACION_FILA, m.viaja);
    const inicio = inicioDePasos(lineas.length);
    // Con el depurador hay que ver la línea activa y las variables a la vez: si cabe, ambos de frente
    const tomas = limpiarTomas(
      [
        { t: 0, foco: 'editor' },
        { t: Math.max(0.3, (plan?.aparece ?? inicio) - 0.1), foco: viaja(mundo) ? 'abajo' : 'todo' },
      ],
      dur,
    );
    return { mundo, tomas, viaja: viaja(mundo), entraAbajo: Math.max(0, inicio - 0.6) };
  }

  const te = tiemposEditor(e, dur, ritmo);
  const m = medidasEditor(lineas, te.salida.length, conAnimacion);
  const altoAbajo = conAnimacion ? ALTO_ANIMACION : altoConsola(te.salida.length);
  const mundo = mundoDe(altoEditor(lineas.length, m.lh), altoAbajo, SEPARACION_FILA, m.viaja);
  if (plan) {
    const primero = plan.momentos.length ? Math.min(...plan.momentos) : plan.aparece;
    const verAbajo = Math.max(te.finCodigo + 0.2, Math.min(plan.aparece + 0.3, primero - 0.5));
    const tomas = limpiarTomas(
      [
        { t: 0, foco: 'editor' },
        { t: verAbajo, foco: 'abajo' },
        // Al final, plano general para cerrar la idea (si no cabe, se queda abajo)
        { t: dur - 0.9, foco: viaja(mundo) ? 'abajo' : 'todo' },
      ],
      dur,
    );
    return { mundo, tomas, viaja: viaja(mundo), entraAbajo: Math.max(0, plan.aparece - 0.25) };
  }
  if (!te.salida.length) return { mundo, tomas: [{ t: 0, foco: 'editor' }], viaja: false, entraAbajo: dur };
  const tomas = limpiarTomas(
    [
      { t: 0, foco: 'editor' },
      { t: te.tSalida - 0.35, foco: 'abajo' },
      { t: te.tUltima + 0.9, foco: 'todo' },
    ],
    dur,
  );
  return { mundo, tomas, viaja: viaja(mundo), entraAbajo: Math.max(0, te.tSalida - 0.25) };
};
