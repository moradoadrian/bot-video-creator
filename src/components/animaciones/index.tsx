import React from 'react';
import { TiemposCiclo } from '../../animaciones/ciclo';
import { Animacion } from '../../types';
import { Ciclo } from './Ciclo';

/** Elige el componente de la animación de una escena. Cada tipo recibe sus tiempos ya calculados. */
export const AnimacionVista: React.FC<{
  animacion: Animacion;
  tiempos: TiemposCiclo | null;
  salida: string[];
  acento: string;
  ancho: number;
  alto: number;
}> = ({ animacion, tiempos, salida, acento, ancho, alto }) => {
  if (!animacion.calculado || !tiempos) return null;
  switch (animacion.tipo) {
    case 'ciclo':
      return <Ciclo c={animacion.calculado} tiempos={tiempos} salida={salida} acento={acento} ancho={ancho} alto={alto} />;
  }
};
