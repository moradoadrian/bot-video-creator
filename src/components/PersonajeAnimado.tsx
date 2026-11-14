/**
 * Personaje 2D del canal de código, dibujado en SVG a partir del avatar de la marca: cabello
 * oscuro peinado hacia arriba, piel morena con pecas, sudadera negra con cordones morados y el
 * logo </>, audífonos morados al cuello. Sale de un círculo de color: la cabeza y el brazo se
 * salen del marco. Tiene poses (señala, pulgar arriba, saluda, sorpresa) con anticipación y
 * rebote, parpadea solo y la boca sigue el volumen real de la voz.
 */
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ANTICIPACION, Gesto, Pose, parpadeo, poseEn } from '../personaje';

const PIEL = '#B57452';
const PIEL_SOMBRA = '#94573A';
const PIEL_LUZ = '#C98B66';
const CABELLO = '#2A1A14';
const CABELLO_LUZ = '#4A2F24';
const SUDADERA = '#1F1B27';
const SUDADERA_SOMBRA = '#15121B';
const MORADO = '#8B5CF6';
const MORADO_CLARO = '#B79CFF';
const BOCA = '#3A0F14';
const OJO = '#5A3A22';

type Brazo = { a1: number; a2: number; mano: 'oculta' | 'indice' | 'pulgar' | 'abierta' };

/** Ángulos del brazo (grados; 0 = a la derecha, negativo = hacia arriba) para cada pose. */
const BRAZO: Record<Pose, Brazo> = {
  neutral: { a1: 100, a2: 95, mano: 'oculta' },
  senala: { a1: -32, a2: -62, mano: 'indice' },
  celebra: { a1: 22, a2: -92, mano: 'pulgar' },
  saluda: { a1: -12, a2: -100, mano: 'abierta' },
  sorpresa: { a1: 58, a2: -70, mano: 'abierta' },
};

const RAD = Math.PI / 180;
const fijar01 = (x: number) => Math.min(1, Math.max(0, x));

const Mano: React.FC<{ tipo: Brazo['mano']; angulo: number }> = ({ tipo, angulo }) => {
  if (tipo === 'oculta') return null;
  return (
    <g transform={`rotate(${angulo})`}>
      <circle r={10} fill={PIEL} stroke={PIEL_SOMBRA} strokeWidth={1.5} />
      {tipo === 'indice' && <rect x={6} y={-3.5} width={16} height={7} rx={3.5} fill={PIEL} stroke={PIEL_SOMBRA} strokeWidth={1.2} />}
      {tipo === 'pulgar' && (
        // El pulgar apunta hacia arriba sin importar el giro del antebrazo
        <g transform={`rotate(${-angulo - 90})`}>
          <rect x={4} y={-3.5} width={14} height={7} rx={3.5} fill={PIEL} stroke={PIEL_SOMBRA} strokeWidth={1.2} />
        </g>
      )}
      {tipo === 'abierta' &&
        [-30, -10, 10, 30].map((d) => (
          <rect key={d} x={7} y={-2.2} width={11} height={4.4} rx={2.2} fill={PIEL} stroke={PIEL_SOMBRA} strokeWidth={1} transform={`rotate(${d})`} />
        ))}
    </g>
  );
};

export const PersonajeSvg: React.FC<{
  tam: number;
  acento: string;
  volumen: number;
  gestos: Gesto[];
  semilla: string;
}> = ({ tam, acento, volumen, gestos, semilla }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { pose, previa, desde } = poseEn(gestos, t);

  // Mezcla de la pose anterior a la nueva: primero un amago contrario (anticipación), luego rebote con exceso
  const dt = t - desde;
  const anticipa = dt < ANTICIPACION ? -0.15 * Math.sin((dt / ANTICIPACION) * Math.PI) : 0;
  const m = dt < ANTICIPACION ? anticipa : spring({ frame: (dt - ANTICIPACION) * fps, fps, config: { damping: 9, stiffness: 150 } });
  const a = BRAZO[previa];
  const b = BRAZO[pose];
  const saludo = pose === 'saluda' ? Math.sin(t * 10) * 16 * fijar01(m) : 0;
  const a1 = a.a1 + (b.a1 - a.a1) * m;
  const a2 = a.a2 + (b.a2 - a.a2) * m + saludo;
  const mano = m > 0.35 ? b.mano : a.mano;

  // Cuerpo: entra con salto, respira, se inclina según la pose y rebota al celebrar (squash and stretch)
  const entra = spring({ frame: frame + 6, fps, config: { damping: 9, stiffness: 160 } });
  const respira = Math.sin(t * 2.1) * 0.012;
  const salto = pose === 'celebra' ? Math.max(0, Math.sin(Math.min(dt, 0.9) * Math.PI * 2.2)) * fijar01(m) : 0;
  const estira = pose === 'celebra' ? 1 + 0.05 * Math.sin(Math.min(dt, 0.9) * Math.PI * 4.4) * (1 - fijar01(dt / 0.9)) : 1;
  const inclina = (pose === 'senala' ? 4 : pose === 'sorpresa' ? -7 : 0) * fijar01(m) + Math.sin(t * 1.3) * 1.5;
  const hacia = pose === 'sorpresa' ? -6 * fijar01(m) : 0;

  // Cabeza: sigue el ritmo de la voz
  const cabeceo = Math.sin(t * 7) * volumen * 3;
  const sube = -volumen * 2.5;

  // Ojos y cejas según la expresión
  const cierre = Math.max(parpadeo(t, semilla), pose === 'celebra' ? 0 : 0);
  const feliz = pose === 'celebra' && m > 0.3;
  const sorpresa = pose === 'sorpresa' && m > 0.2;
  const ceja = sorpresa ? -7 : feliz ? -3 : pose === 'senala' ? -2 : 0;
  const mira = pose === 'senala' ? { x: 2.2, y: -2.2 } : { x: Math.sin(t * 0.7) * 0.8, y: 0 };
  const altoOjo = sorpresa ? 7 : 5.2;

  // Boca: abierta según el volumen; con forma según la expresión
  const habla = volumen > 0.06;
  const boca = (() => {
    if (sorpresa && !habla) return <ellipse cx={100} cy={123} rx={5.5} ry={7.5} fill={BOCA} />;
    if (feliz) {
      const alto = 9 + volumen * 6;
      return (
        <g>
          <path d={`M87 117 Q100 ${117 + alto * 1.8} 113 117 Z`} fill={BOCA} />
          <path d="M89 117.5 L111 117.5 L109 121 L91 121 Z" fill="#F4F1FF" />
        </g>
      );
    }
    if (habla) {
      const ry = 1.8 + volumen * 8.5;
      return (
        <g>
          <ellipse cx={100} cy={121} rx={8.5 + volumen * 2} ry={ry} fill={BOCA} />
          {ry > 4 && <ellipse cx={100} cy={121 + ry * 0.45} rx={5} ry={ry * 0.35} fill="#C2505F" />}
        </g>
      );
    }
    return <path d="M90 119 Q100 126 110 119" fill="none" stroke={BOCA} strokeWidth={3} strokeLinecap="round" />;
  })();

  // Brazo derecho (del espectador): hombro → codo → mano
  const hombro = { x: 150, y: 172 };
  const codo = { x: hombro.x + Math.cos(a1 * RAD) * 36, y: hombro.y + Math.sin(a1 * RAD) * 36 };
  const muneca = { x: codo.x + Math.cos(a2 * RAD) * 32, y: codo.y + Math.sin(a2 * RAD) * 32 };
  const id = `pj-${semilla.replace(/[^a-z0-9]/gi, '')}`;

  const ojo = (cx: number) => (
    <g>
      {feliz ? (
        <path d={`M${cx - 7} ${97} Q${cx} ${89} ${cx + 7} ${97}`} fill="none" stroke={CABELLO} strokeWidth={3.2} strokeLinecap="round" />
      ) : (
        <>
          <ellipse cx={cx} cy={96} rx={7.2} ry={altoOjo} fill="#FFF8F2" />
          <circle cx={cx + mira.x} cy={96 + mira.y} r={sorpresa ? 3.2 : 3.8} fill={OJO} />
          <circle cx={cx + mira.x + 1.2} cy={96 + mira.y - 1.3} r={1.1} fill="#FFFFFF" />
          {/* Párpado: baja al parpadear */}
          <rect x={cx - 8.5} y={96 - altoOjo - 1} width={17} height={(altoOjo * 2 + 2) * cierre} fill={PIEL} />
          <path d={`M${cx - 7.5} ${96 - altoOjo * 0.2} Q${cx} ${96 - altoOjo - 1.5} ${cx + 7.5} ${96 - altoOjo * 0.2}`} fill="none" stroke={CABELLO} strokeWidth={1.6} />
        </>
      )}
    </g>
  );

  return (
    <div
      style={{
        width: tam,
        height: tam * 1.1,
        flex: '0 0 auto',
        position: 'relative',
        transform: `translateY(${(1 - entra) * 60 - salto * 14}px) scale(${entra})`,
        transformOrigin: '50% 100%',
      }}
    >
      <svg viewBox="0 0 200 220" width={tam} height={tam * 1.1} style={{ overflow: 'visible' }}>
        <defs>
          <clipPath id={`${id}-marco`}>
            {/* El cuerpo queda dentro del círculo; la cabeza y el brazo pueden salirse por arriba */}
            <circle cx={100} cy={124} r={88} />
            <rect x={0} y={0} width={200} height={124} />
          </clipPath>
          <clipPath id={`${id}-brazo`}>
            {/* El brazo solo puede salir del marco por arriba (para señalar o saludar), nunca por abajo */}
            <circle cx={100} cy={124} r={88} />
            <rect x={-40} y={-40} width={280} height={225} />
          </clipPath>
          <radialGradient id={`${id}-fondo`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={acento} stopOpacity={0.55} />
            <stop offset="100%" stopColor={acento} stopOpacity={0.15} />
          </radialGradient>
        </defs>
        {/* Marco */}
        <circle cx={100} cy={124} r={88} fill={`url(#${id}-fondo)`} />
        <circle cx={100} cy={124} r={88} fill="none" stroke={acento} strokeWidth={7} style={{ filter: volumen > 0.05 ? `drop-shadow(0 0 ${6 + volumen * 14}px ${acento})` : undefined }} />

        <g transform={`translate(0 ${hacia}) rotate(${inclina} 100 210) scale(1 ${estira * (1 + respira)})`} style={{ transformOrigin: '100px 210px' }}>
          <g clipPath={`url(#${id}-marco)`}>
            {/* Sudadera: capucha detrás del cuello y hombros anchos */}
            <path d="M14 224 C18 184 40 160 74 150 L126 150 C160 160 182 184 186 224 Z" fill={SUDADERA} stroke="#3A3346" strokeWidth={2} />
            <path d="M58 156 C66 136 134 136 142 156 C128 170 72 170 58 156 Z" fill={SUDADERA_SOMBRA} stroke="#3A3346" strokeWidth={2} />
            {/* Cordones morados */}
            <path d="M90 170 L87 202" stroke={MORADO} strokeWidth={3.5} strokeLinecap="round" />
            <path d="M110 170 L113 202" stroke={MORADO} strokeWidth={3.5} strokeLinecap="round" />
            <rect x={84.5} y={200} width={5} height={8} rx={1.5} fill={MORADO_CLARO} />
            <rect x={110.5} y={200} width={5} height={8} rx={1.5} fill={MORADO_CLARO} />
            {/* Logo </> en el pecho */}
            <text x={100} y={196} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight={700} fontSize={15} fill="#F4F1FF">
              {'</>'}
            </text>
            {/* Cuello */}
            <path d="M87 128 L113 128 L115 158 C108 164 92 164 85 158 Z" fill={PIEL_SOMBRA} />
            {/* Audífonos al cuello: la diadema pasa por detrás y las copas descansan sobre la sudadera */}
            <path d="M72 158 C78 176 122 176 128 158" fill="none" stroke="#2A2433" strokeWidth={8} strokeLinecap="round" />
            {[
              [72, 156, -18],
              [128, 156, 18],
            ].map(([cx, cy, giro]) => (
              <g key={cx} transform={`rotate(${giro} ${cx} ${cy})`}>
                <ellipse cx={cx} cy={cy} rx={14} ry={17} fill="#2A2433" stroke={MORADO} strokeWidth={4} />
                <ellipse cx={cx} cy={cy} rx={7} ry={9} fill={MORADO} opacity={0.55} />
              </g>
            ))}
          </g>

          {/* Cabeza */}
          <g transform={`translate(0 ${sube}) rotate(${cabeceo + inclina * 0.4} 100 130)`}>
            <ellipse cx={61} cy={99} rx={8} ry={11} fill={PIEL_SOMBRA} />
            <ellipse cx={139} cy={99} rx={8} ry={11} fill={PIEL_SOMBRA} />
            <path d="M60 92 C60 58 140 58 140 92 C140 122 124 140 100 140 C76 140 60 122 60 92 Z" fill={PIEL} />
            <path d="M120 70 C134 80 138 100 132 118" fill="none" stroke={PIEL_LUZ} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
            {/* Cabello: corto a los lados, alto y desordenado arriba */}
            {/* Lados cortos (degradado) */}
            <path d="M58 98 C54 74 64 54 84 46 L118 46 C136 54 146 74 142 98 C138 86 134 80 130 78 L70 78 C66 80 62 86 58 98 Z" fill={CABELLO} opacity={0.85} />
            {/* Copete con volumen, peinado hacia arriba y un poco a la derecha */}
            <path
              d="M64 80 C58 62 66 46 82 40 C84 30 96 24 108 28 C116 20 132 24 134 36 C146 40 148 54 142 64 C146 72 144 80 140 86 C132 74 120 68 104 70 C92 72 78 74 64 80 Z"
              fill={CABELLO}
            />
            <path d="M80 54 C84 44 92 38 100 36 M98 50 C102 40 110 34 120 34 M114 54 C120 46 128 42 136 44" fill="none" stroke={CABELLO_LUZ} strokeWidth={3.5} strokeLinecap="round" />
            {/* Cejas */}
            <path d={`M74 ${84 + ceja} Q84 ${78 + ceja} 93 ${83 + ceja}`} fill="none" stroke={CABELLO} strokeWidth={4.5} strokeLinecap="round" />
            <path d={`M107 ${83 + ceja} Q116 ${78 + ceja} 126 ${84 + ceja}`} fill="none" stroke={CABELLO} strokeWidth={4.5} strokeLinecap="round" />
            {ojo(84)}
            {ojo(116)}
            {/* Nariz y pecas */}
            <path d="M100 100 Q96 109 99 112 Q102 113 104 111" fill="none" stroke={PIEL_SOMBRA} strokeWidth={2.2} strokeLinecap="round" />
            {[
              [76, 108],
              [80, 112],
              [72, 112],
              [124, 108],
              [120, 112],
              [128, 112],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={1.3} fill={PIEL_SOMBRA} opacity={0.75} />
            ))}
            {feliz && (
              <>
                <ellipse cx={74} cy={113} rx={7} ry={4} fill="#E2767F" opacity={0.45} />
                <ellipse cx={126} cy={113} rx={7} ry={4} fill="#E2767F" opacity={0.45} />
              </>
            )}
            {boca}
          </g>

          {/* Brazo: manga de la sudadera y mano */}
          <g clipPath={`url(#${id}-brazo)`}>
          <path d={`M${hombro.x} ${hombro.y} L${codo.x} ${codo.y} L${muneca.x} ${muneca.y}`} fill="none" stroke="#4A4258" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${hombro.x} ${hombro.y} L${codo.x} ${codo.y} L${muneca.x} ${muneca.y}`} fill="none" stroke={SUDADERA} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${hombro.x} ${hombro.y} L${codo.x} ${codo.y} L${muneca.x} ${muneca.y}`} fill="none" stroke={MORADO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} />
          <g transform={`translate(${muneca.x} ${muneca.y})`}>
            <Mano tipo={mano} angulo={a2} />
          </g>
          </g>
        </g>
      </svg>
    </div>
  );
};

/** Lee el volumen de la voz del bloque y se lo pasa al personaje. */
const ConVoz: React.FC<{ audio: string; tam: number; acento: string; gestos: Gesto[]; semilla: string }> = ({ audio, ...resto }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const datos = useAudioData(audio);
  let volumen = 0;
  if (datos) {
    const bandas = visualizeAudio({ fps, frame, audioData: datos, numberOfSamples: 16 });
    volumen = Math.min(1, (bandas.slice(0, 6).reduce((a, b) => a + b, 0) / 6) * 3);
  }
  return <PersonajeSvg {...resto} volumen={volumen} />;
};

export const PersonajeAnimado: React.FC<{ audio?: string; tam: number; acento: string; gestos: Gesto[]; semilla: string }> = ({ audio, ...resto }) =>
  audio ? <ConVoz audio={audio} {...resto} /> : <PersonajeSvg {...resto} volumen={0} />;
