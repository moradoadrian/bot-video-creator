import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import React from 'react';
import { Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const IMAGEN = 'Desarrollador Latino con Estilo Morado.png';
/** Coordenadas en píxeles de la imagen original: círculo de la cara y posición de la boca. */
const IMAGEN_ANCHO = 903;
const IMAGEN_ALTO = 1249;
const CARA = { x: 620, y: 290, radio: 278 };
const BOCA = { x: 625, y: 421, ancho: 62, alto: 34 };

const Avatar: React.FC<{ tam: number; acento: string; volumen: number }> = ({ tam, acento, volumen }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame, fps, config: { damping: 13, stiffness: 160 } });
  const esc = tam / (CARA.radio * 2);
  const respira = Math.sin(frame / 18) * 0.008;
  const altoBoca = BOCA.alto * esc * volumen;

  return (
    <div
      style={{
        width: tam,
        height: tam,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        flex: '0 0 auto',
        boxShadow: `0 0 0 8px ${acento}, 0 0 ${16 + volumen * 44}px ${acento}`,
        transform: `scale(${entra * (1 + respira + volumen * 0.035)}) translateY(${-volumen * 5}px)`,
      }}
    >
      <Img
        src={staticFile(IMAGEN)}
        style={{
          position: 'absolute',
          width: IMAGEN_ANCHO * esc,
          height: IMAGEN_ALTO * esc,
          maxWidth: 'none',
          left: -(CARA.x - CARA.radio) * esc,
          top: -(CARA.y - CARA.radio) * esc,
        }}
      />
      {altoBoca > 0.5 && (
        <div
          style={{
            position: 'absolute',
            width: BOCA.ancho * esc,
            height: altoBoca,
            left: (BOCA.x - CARA.x + CARA.radio - BOCA.ancho / 2) * esc,
            top: (BOCA.y - CARA.y + CARA.radio) * esc - altoBoca / 2,
            borderRadius: '50%',
            background: '#3A0F14',
          }}
        />
      )}
    </div>
  );
};

/** La boca y el brillo siguen el volumen de la voz del bloque actual. */
const ConVoz: React.FC<{ audio: string; tam: number; acento: string }> = ({ audio, tam, acento }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const datos = useAudioData(audio);
  let volumen = 0;
  if (datos) {
    const bandas = visualizeAudio({ fps, frame, audioData: datos, numberOfSamples: 16 });
    const graves = bandas.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
    volumen = Math.min(1, graves * 3);
  }
  return <Avatar tam={tam} acento={acento} volumen={volumen} />;
};

export const Personaje: React.FC<{ audio?: string; tam: number; acento: string }> = ({ audio, tam, acento }) =>
  audio ? <ConVoz audio={audio} tam={tam} acento={acento} /> : <Avatar tam={tam} acento={acento} volumen={0} />;
