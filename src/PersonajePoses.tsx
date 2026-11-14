import React from 'react';
import { AbsoluteFill } from 'remotion';
import { PersonajeSvg } from './components/PersonajeAnimado';
import { FONDO } from './temaCodigo';

/** Hoja de pruebas del personaje animado: recorre sus poses en grande, para revisarlo en Studio. */
export const PersonajePoses: React.FC = () => (
  <AbsoluteFill style={{ background: FONDO, alignItems: 'center', justifyContent: 'center' }}>
    <PersonajeSvg
      tam={520}
      acento="#B79CFF"
      volumen={0}
      semilla="poses"
      gestos={[
        { t: 0.3, pose: 'saluda' },
        { t: 3, pose: 'senala' },
        { t: 5.5, pose: 'celebra' },
        { t: 8.5, pose: 'sorpresa' },
      ]}
    />
  </AbsoluteFill>
);
