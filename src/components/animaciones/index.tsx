import React from 'react';
import { PlanAnimacion } from '../../animaciones/plan';
import { Animacion } from '../../types';
import { Arreglo } from './Arreglo';
import { Ciclo } from './Ciclo';
import { Condicion } from './Condicion';
import { Funcion } from './Funcion';
import { Objeto } from './Objeto';
import { Variable } from './Variable';

/** Elige el componente de la animación de una escena. Cada tipo recibe sus tiempos ya calculados. */
export const AnimacionVista: React.FC<{
  animacion: Animacion;
  plan: PlanAnimacion | null;
  salida: string[];
  acento: string;
  ancho: number;
  alto: number;
}> = ({ animacion: a, plan, salida, acento, ancho, alto }) => {
  if (!plan) return null;
  const comun = { acento, ancho, alto, aparece: plan.aparece };
  if (a.tipo === 'ciclo') return a.calculado && plan.ciclo ? <Ciclo c={a.calculado} tiempos={plan.ciclo} salida={salida} acento={acento} ancho={ancho} alto={alto} /> : null;
  const tiempos = plan.tiempos;
  if (!tiempos) return null;
  switch (a.tipo) {
    case 'variable':
      return a.calculado ? <Variable c={a.calculado} tiempos={tiempos} {...comun} /> : null;
    case 'arreglo':
      return a.calculado ? <Arreglo c={a.calculado} tiempos={tiempos} {...comun} /> : null;
    case 'condicion':
      return a.calculado ? <Condicion c={a.calculado} tiempos={tiempos} {...comun} /> : null;
    case 'funcion':
      return a.calculado ? <Funcion c={a.calculado} tiempos={tiempos} {...comun} /> : null;
    case 'objeto':
      return a.calculado ? <Objeto c={a.calculado} tiempos={tiempos} {...comun} /> : null;
  }
};
