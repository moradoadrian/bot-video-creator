import React from 'react';
import { Icono } from '../types';

type P = { tipo: Icono; color: string; size?: number };

const INK = '#2B2140';

export const IconoFiesta: React.FC<P> = ({ tipo, color, size = 360 }) => {
  const common = { width: size, height: size, viewBox: '0 0 200 200' };
  const stroke = { stroke: INK, strokeWidth: 6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

  switch (tipo) {
    case 'globo':
      return (
        <svg {...common}>
          <path d="M100 150 C 92 165, 112 175, 100 195" fill="none" {...stroke} />
          <ellipse cx="100" cy="78" rx="56" ry="66" fill={color} {...stroke} />
          <path d="M92 146 L108 146 L100 136 Z" fill={color} {...stroke} />
          <ellipse cx="78" cy="56" rx="12" ry="20" fill="#fff" opacity="0.55" />
        </svg>
      );
    case 'pastel':
      return (
        <svg {...common}>
          <rect x="34" y="110" width="132" height="62" rx="10" fill={color} {...stroke} />
          <rect x="52" y="70" width="96" height="44" rx="8" fill="#FFF6E9" {...stroke} />
          <path d="M34 130 q16 14 33 0 q16 14 33 0 q16 14 33 0 q16 14 33 0" fill="none" {...stroke} />
          <rect x="94" y="38" width="12" height="32" rx="3" fill="#FFD23F" {...stroke} />
          <path d="M100 14 C 110 26, 108 34, 100 36 C 92 34, 90 26, 100 14 Z" fill="#FF7A45" {...stroke} />
        </svg>
      );
    case 'regalo':
      return (
        <svg {...common}>
          <rect x="36" y="82" width="128" height="94" rx="8" fill={color} {...stroke} />
          <rect x="28" y="62" width="144" height="30" rx="6" fill={color} {...stroke} />
          <rect x="90" y="62" width="20" height="114" fill="#FFD23F" {...stroke} />
          <path d="M100 62 C 70 30, 50 50, 72 62 Z M100 62 C 130 30, 150 50, 128 62 Z" fill="#FFD23F" {...stroke} />
        </svg>
      );
    case 'estrella':
      return (
        <svg {...common}>
          <path
            d="M100 18 L122 72 L180 76 L135 112 L150 170 L100 138 L50 170 L65 112 L20 76 L78 72 Z"
            fill={color}
            {...stroke}
          />
          <circle cx="84" cy="98" r="6" fill={INK} />
          <circle cx="116" cy="98" r="6" fill={INK} />
          <path d="M88 116 q12 10 24 0" fill="none" {...stroke} />
        </svg>
      );
    case 'gorro':
      return (
        <svg {...common}>
          <path d="M100 20 L156 170 L44 170 Z" fill={color} {...stroke} />
          <path d="M76 106 L124 106 M64 138 L136 138" {...stroke} stroke="#FFF6E9" strokeWidth={10} />
          <path d="M44 170 L156 170" {...stroke} />
          <circle cx="100" cy="20" r="14" fill="#FFD23F" {...stroke} />
        </svg>
      );
    case 'pinata':
      return (
        <svg {...common}>
          <path d="M100 8 L100 40" {...stroke} />
          <circle cx="100" cy="112" r="52" fill={color} {...stroke} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
            const x1 = 100 + Math.cos(a) * 52;
            const y1 = 112 + Math.sin(a) * 52;
            const x2 = 100 + Math.cos(a) * 92;
            const y2 = 112 + Math.sin(a) * 92;
            const palette = ['#FFD23F', '#3BCEAC', '#FF7A45', '#A685E2'];
            return <path key={i} d={`M${x1} ${y1} L${x2} ${y2}`} stroke={palette[i % 4]} strokeWidth={16} strokeLinecap="round" />;
          })}
          <circle cx="100" cy="112" r="52" fill="none" {...stroke} />
          <circle cx="100" cy="112" r="18" fill="#FFF6E9" {...stroke} />
        </svg>
      );
    case 'vela':
      return (
        <svg {...common}>
          <rect x="74" y="70" width="52" height="110" rx="10" fill={color} {...stroke} />
          <path d="M74 100 L126 86 M74 132 L126 118 M74 164 L126 150" {...stroke} stroke="#FFF6E9" />
          <path d="M100 70 L100 56" {...stroke} />
          <path d="M100 10 C 120 32, 116 52, 100 56 C 84 52, 80 32, 100 10 Z" fill="#FFD23F" {...stroke} />
        </svg>
      );
    case 'dulce':
    default:
      return (
        <svg {...common}>
          <path d="M52 100 L18 72 L22 128 Z" fill={color} {...stroke} />
          <path d="M148 100 L182 72 L178 128 Z" fill={color} {...stroke} />
          <circle cx="100" cy="100" r="50" fill={color} {...stroke} />
          <path d="M66 70 C 90 90, 110 110, 134 130 M70 128 C 90 110, 112 88, 132 72" stroke="#FFF6E9" strokeWidth={10} fill="none" strokeLinecap="round" />
          <circle cx="100" cy="100" r="50" fill="none" {...stroke} />
        </svg>
      );
  }
};
