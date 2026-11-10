import React from 'react';
import { IconoCodigo } from '../types';

/** Íconos de trazo para los diagramas del canal código (cuadrícula de 48). */
const trazos = (tipo: IconoCodigo, color: string): React.ReactNode => {
  const relleno = { fill: color, stroke: 'none' };
  switch (tipo) {
    case 'pantalla':
      return (
        <>
          <rect x="5" y="8" width="38" height="25" rx="3" />
          <path d="M24 33v7M16 40h16" />
        </>
      );
    case 'servidor':
      return (
        <>
          <rect x="7" y="6" width="34" height="15" rx="3" />
          <rect x="7" y="27" width="34" height="15" rx="3" />
          <circle cx="14" cy="13.5" r="2" {...relleno} />
          <circle cx="14" cy="34.5" r="2" {...relleno} />
          <path d="M22 13.5h12M22 34.5h12" />
        </>
      );
    case 'base-datos':
      return (
        <>
          <ellipse cx="24" cy="11" rx="15" ry="5.5" />
          <path d="M9 11v26c0 3 6.7 5.5 15 5.5s15-2.5 15-5.5V11" />
          <path d="M9 24c0 3 6.7 5.5 15 5.5s15-2.5 15-5.5" />
        </>
      );
    case 'api':
      return <path d="M8 17h30l-7-7M40 31H10l7 7" />;
    case 'cursor':
      return (
        <>
          <rect x="4" y="9" width="30" height="15" rx="7.5" />
          <path d="M26 20l15 7-6 2.5-2.5 6.5z" />
        </>
      );
    case 'imagen':
      return (
        <>
          <rect x="5" y="8" width="38" height="32" rx="3" />
          <circle cx="17" cy="18" r="3.5" />
          <path d="M5 35l12-11 9 8 6-5 11 9" />
        </>
      );
    case 'formulario':
      return (
        <>
          <rect x="8" y="5" width="32" height="38" rx="3" />
          <path d="M14 13h20" />
          <rect x="14" y="19" width="20" height="7" rx="1.5" />
          <rect x="14" y="31" width="12" height="6" rx="3" />
        </>
      );
    case 'menu':
      return <path d="M9 13h30M9 24h30M9 35h30" />;
    case 'engrane':
      return (
        <>
          <circle cx="24" cy="24" r="6" />
          <circle cx="24" cy="24" r="12.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            const p = (d: number) => `${24 + Math.cos(r) * d} ${24 + Math.sin(r) * d}`;
            return <path key={a} d={`M${p(13)}L${p(19)}`} strokeWidth="5" />;
          })}
        </>
      );
    case 'escudo':
      return (
        <>
          <path d="M24 5l15 6v11c0 10-7 17-15 21-8-4-15-11-15-21V11z" />
          <path d="M17 24l5 5 9-10" />
        </>
      );
    case 'lista':
      return (
        <>
          <rect x="7" y="5" width="34" height="38" rx="3" />
          <path d="M13 16l3 3 5-5M26 16h9M13 30l3 3 5-5M26 30h9" />
        </>
      );
    case 'capas':
      return <path d="M24 6l18 9-18 9-18-9zM6 24l18 9 18-9M6 33l18 9 18-9" />;
    case 'check':
      return (
        <>
          <circle cx="24" cy="24" r="18" />
          <path d="M15 24l6 6 12-12" />
        </>
      );
    case 'carrito':
      return (
        <>
          <path d="M4 8h6l5 22h21l4-15H13" />
          <circle cx="18" cy="38" r="2.5" />
          <circle cx="33" cy="38" r="2.5" />
        </>
      );
    case 'codigo':
      return <path d="M16 14L6 24l10 10M32 14l10 10-10 10M27 9l-6 30" />;
    case 'rayo':
      return <path d="M27 4L10 27h12l-3 17 17-23H24z" />;
    case 'gota':
      return <path d="M24 5c8 10 13 16 13 23a13 13 0 0 1-26 0c0-7 5-13 13-23z" />;
    case 'usuario':
      return (
        <>
          <circle cx="24" cy="16" r="8" />
          <path d="M8 42c2-9 8-13 16-13s14 4 16 13" />
        </>
      );
    case 'nube':
      return <path d="M14 37h21a8 8 0 0 0 1-16 11 11 0 0 0-21-2 9 9 0 0 0-1 18z" />;
    case 'candado':
      return (
        <>
          <rect x="10" y="21" width="28" height="21" rx="3" />
          <path d="M16 21v-6a8 8 0 0 1 16 0v6" />
        </>
      );
  }
};

export const IconoCodigoVista: React.FC<{ tipo: IconoCodigo; color: string; size: number }> = ({ tipo, color, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    stroke={color}
    strokeWidth={3.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {trazos(tipo, color)}
  </svg>
);

/** Ícono dentro de un círculo de color. */
export const IconoCirculo: React.FC<{ tipo?: IconoCodigo; fondo: string; tinta: string; size: number }> = ({
  tipo,
  fondo,
  tinta,
  size,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: fondo,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: `0 0 ${size}px`,
    }}
  >
    {tipo && <IconoCodigoVista tipo={tipo} color={tinta} size={size * 0.6} />}
  </div>
);
