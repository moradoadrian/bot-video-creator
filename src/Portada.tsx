import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/nunito/800.css';
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Personaje } from './components/Personaje';
import { LineaCodigo } from './components/Resaltado';
import { GuionCodigo, Marca } from './types';

export type PortadaProps = { guion: GuionCodigo; marca: Marca };

const FONDO = '#15122A';
const EDITOR = '#0E0C1E';
const TINTA = '#F4F1FF';
const TENUE = '#A9A2CC';

/** Todo queda en la zona segura: libre la derecha y la parte baja, y dentro del recorte 3:4 del perfil. */
export const Portada: React.FC<PortadaProps> = ({ guion, marca }) => {
  const acento = marca.colores[0];
  const titulo = guion.portada?.titulo ?? guion.gancho.titulo;
  const frase = guion.portada?.frase;
  const linea = guion.escenas.find((e) => e.codigo)?.codigo?.split('\n')[0];
  const tamTitulo = titulo.length <= 14 ? 170 : titulo.length <= 26 ? 130 : 104;

  return (
    <AbsoluteFill
      style={{
        background: FONDO,
        backgroundImage: 'radial-gradient(rgba(244,241,255,0.07) 2px, transparent 2px)',
        backgroundSize: '44px 44px',
      }}
    >
      <div style={{ position: 'absolute', top: 430, left: 70, width: 850, display: 'flex', flexDirection: 'column', gap: 40 }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 40, color: acento }}>// JavaScript desde cero</div>
        <div
          style={{
            fontFamily: '"Bricolage Grotesque", sans-serif',
            fontWeight: 800,
            fontSize: tamTitulo,
            lineHeight: 0.98,
            letterSpacing: -2,
            color: TINTA,
            textWrap: 'balance',
          }}
        >
          {titulo}
        </div>
        {frase && (
          <div
            style={{
              alignSelf: 'flex-start',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 800,
              fontSize: 62,
              lineHeight: 1.1,
              background: TINTA,
              color: FONDO,
              padding: '18px 30px',
              borderRadius: 24,
              boxShadow: `8px 8px 0 ${acento}`,
            }}
          >
            {frase}
          </div>
        )}
        {linea && (
          <div
            style={{
              background: EDITOR,
              border: '2px solid rgba(244,241,255,0.14)',
              borderRadius: 26,
              padding: '32px 28px',
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 500,
              fontSize: Math.min(46, 790 / (linea.length * 0.6)),
              fontVariantLigatures: 'none',
              fontFeatureSettings: '"liga" 0, "calt" 0',
              whiteSpace: 'pre',
            }}
          >
            <LineaCodigo linea={linea} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <Personaje config={marca.personaje} tam={210} acento={acento} quieto />
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 500, fontSize: 40, color: TENUE }}>{marca.handle}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
