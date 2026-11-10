import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import React from 'react';
import { Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ConfigPersonaje } from '../types';

type Comunes = { config: ConfigPersonaje; tam: number; acento: string };

const Avatar: React.FC<Comunes & { volumen: number; quieto?: boolean }> = ({ config, tam, acento, volumen, quieto }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Adelantado para que ya se vea en el primer cuadro del bloque
  const entra = quieto ? 1 : spring({ frame: frame + 8, fps, config: { damping: 13, stiffness: 160 } });
  const { cara, boca } = config;
  const esc = tam / (cara.radio * 2);
  const respira = quieto ? 0 : Math.sin(frame / 18) * 0.008;
  // Salta al entrar a cada bloque y se balancea; al hablar, inclina la cabeza al ritmo de la voz
  const salto = quieto ? 1 : spring({ frame, fps, config: { damping: 7, stiffness: 170 } });
  const inclina = quieto ? 0 : Math.sin(frame / 24) * 2 + Math.sin(frame / 7) * volumen * 5;
  const altoBoca = boca.alto * esc * volumen;

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
        transform: `translateY(${(1 - salto) * 50 - volumen * 5}px) rotate(${inclina}deg) scale(${entra * (1 + respira + volumen * 0.035)})`,
      }}
    >
      <Img
        src={staticFile(config.imagen)}
        style={{
          position: 'absolute',
          width: config.ancho * esc,
          height: config.alto * esc,
          maxWidth: 'none',
          left: -(cara.x - cara.radio) * esc,
          top: -(cara.y - cara.radio) * esc,
        }}
      />
      {altoBoca > 0.5 && (
        <div
          style={{
            position: 'absolute',
            width: boca.ancho * esc,
            height: altoBoca,
            left: (boca.x - cara.x + cara.radio - boca.ancho / 2) * esc,
            top: (boca.y - cara.y + cara.radio) * esc - altoBoca / 2,
            borderRadius: '50%',
            background: '#3A0F14',
          }}
        />
      )}
    </div>
  );
};

/** La boca y el brillo siguen el volumen de la voz del bloque actual. */
const ConVoz: React.FC<Comunes & { audio: string }> = ({ audio, ...comunes }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const datos = useAudioData(audio);
  let volumen = 0;
  if (datos) {
    const bandas = visualizeAudio({ fps, frame, audioData: datos, numberOfSamples: 16 });
    const graves = bandas.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
    volumen = Math.min(1, graves * 3);
  }
  return <Avatar {...comunes} volumen={volumen} />;
};

export const Personaje: React.FC<Omit<Comunes, 'config'> & { config?: ConfigPersonaje; audio?: string; quieto?: boolean }> = ({
  config,
  audio,
  quieto,
  ...resto
}) => {
  if (!config) return null;
  return audio ? <ConVoz config={config} audio={audio} {...resto} /> : <Avatar config={config} volumen={0} quieto={quieto} {...resto} />;
};
