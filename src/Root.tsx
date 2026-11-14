import React from 'react';
import { CalculateMetadataFunction, Composition } from 'remotion';
import { CodigoVideo } from './CodigoVideo';
import { FiestaVideo, FPS, framesPorBloque } from './FiestaVideo';
import { Portada } from './Portada';
import { PersonajePoses } from './PersonajePoses';
import { CodigoProps, GuionCodigo, GuionFiestas, Timing, VideoProps } from './types';
import guionCodigo from '../content/el-ciclo-for-en-javascript-explicado-facil/guion.json';
import marca from '../config/marca.json';
import marcaCodigo from '../config/marca-codigo.json';

// Solo para abrir la plantilla en Studio; render.ts siempre pasa el guion real.
const guionFiestas: GuionFiestas = {
  slug: 'plantilla-fiestas',
  tema: 'Plantilla de fiestas',
  gancho: { titulo: 'Plantilla de fiestas', narracion: 'Vista previa de la plantilla.' },
  escenas: [],
  cierre: { titulo: 'Fin de la vista previa', narracion: 'Vista previa de la plantilla.' },
  descripcion: '',
  hashtags: [],
};

// Sin audio: duraciones estimadas (~15 caracteres por segundo)
const estimado = (g: { gancho: { narracion: string }; escenas: { narracion: string }[]; cierre: { narracion: string } }): Timing => ({
  conAudio: false,
  duraciones: [g.gancho.narracion, ...g.escenas.map((e) => e.narracion), g.cierre.narracion].map((t) =>
    Math.max(2.5, t.length / 15),
  ),
});

const calcular = <P extends { timing: Timing }>(): CalculateMetadataFunction<P> => ({ props }) => ({
  durationInFrames: framesPorBloque(props.timing.duraciones).reduce((a, b) => a + b, 0),
});

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="FiestaVideo"
      component={FiestaVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS * 60}
      defaultProps={{ guion: guionFiestas as GuionFiestas, timing: estimado(guionFiestas), marca }}
      calculateMetadata={calcular<VideoProps>()}
    />
    <Composition
      id="CodigoVideo"
      component={CodigoVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS * 60}
      defaultProps={{ guion: guionCodigo as GuionCodigo, timing: estimado(guionCodigo), marca: marcaCodigo }}
      calculateMetadata={calcular<CodigoProps>()}
    />
    <Composition id="PersonajePoses" component={PersonajePoses} width={720} height={720} fps={FPS} durationInFrames={FPS * 11} />
    <Composition
      id="Portada"
      component={Portada}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{ guion: guionCodigo as GuionCodigo, marca: marcaCodigo }}
    />
  </>
);
