/**
 * Logo "</>" en 3D para el gancho y el cierre. Todo el movimiento sale de useCurrentFrame():
 * las tres piezas llegan volando desde direcciones distintas, se arman con rebote y luego flotan.
 * En el cierre, cubos pequeños orbitan alrededor.
 */
import { ThreeCanvas } from '@remotion/three';
import React, { useMemo } from 'react';
import { random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';

const extruir = (puntos: [number, number][]) => {
  const forma = new THREE.Shape(puntos.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(forma, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3 });
  g.center();
  return g;
};

// Chevrón "<" con grosor; ">" es el mismo reflejado
const CHEVRON: [number, number][] = [
  [0.55, 1.05],
  [-0.65, 0],
  [0.55, -1.05],
  [0.95, -0.75],
  [0.1, 0],
  [0.95, 0.75],
];
const DIAGONAL: [number, number][] = [
  [-0.55, -1.15],
  [-0.15, -1.15],
  [0.55, 1.15],
  [0.15, 1.15],
];

const Pieza: React.FC<{ geometria: THREE.BufferGeometry; color: string; brillo: string; posicion: [number, number, number]; giro: [number, number, number]; escala?: [number, number, number] }> = ({
  geometria,
  color,
  brillo,
  posicion,
  giro,
  escala = [1, 1, 1],
}) => (
  <mesh geometry={geometria} position={posicion} rotation={giro} scale={escala}>
    <meshStandardMaterial color={color} emissive={brillo} emissiveIntensity={0.25} metalness={0.35} roughness={0.32} />
  </mesh>
);

export const Logo3D: React.FC<{ ancho: number; alto: number; colores: string[]; tinta: string; desde?: number; orbita?: boolean; tamano?: number }> = ({
  ancho,
  alto,
  colores,
  tinta,
  desde = 0,
  orbita = false,
  tamano = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chevron = useMemo(() => extruir(CHEVRON), []);
  const diagonal = useMemo(() => extruir(DIAGONAL), []);
  const cubo = useMemo(() => new THREE.BoxGeometry(0.28, 0.28, 0.28), []);

  const f = frame - desde * fps;
  const t = Math.max(0, f) / fps;
  const llega = (retraso: number) => (f < retraso ? 0 : spring({ frame: f - retraso, fps, config: { damping: 11, stiffness: 120 } }));
  const sIzq = llega(0);
  const sDiag = llega(5);
  const sDer = llega(10);
  // Flota y se balancea; al armarse da medio giro que se asienta
  const giroY = (1 - sDer) * -Math.PI * 1.1 + Math.sin(t * 0.9) * 0.35;
  const giroX = Math.sin(t * 0.7) * 0.15;
  const flota = Math.sin(t * 1.4) * 0.12;
  const acento = colores[0];
  const segundo = colores[1] ?? acento;

  return (
    <ThreeCanvas width={ancho} height={alto} camera={{ position: [0, 0, 8], fov: 32 }} style={{ pointerEvents: 'none' }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <pointLight position={[-4, -2, 3]} intensity={18} color={segundo} />
      <group rotation={[giroX, giroY, 0]} position={[0, flota, 0]} scale={tamano}>
        <Pieza geometria={chevron} color={acento} brillo={acento} posicion={[-1.55 - (1 - sIzq) * 5, (1 - sIzq) * 2, (1 - sIzq) * -4]} giro={[0, 0, (1 - sIzq) * 2]} />
        <Pieza geometria={diagonal} color={tinta} brillo={segundo} posicion={[0, (1 - sDiag) * 5, (1 - sDiag) * 2]} giro={[(1 - sDiag) * 3, 0, 0]} />
        <Pieza
          geometria={chevron}
          color={acento}
          brillo={acento}
          posicion={[1.55 + (1 - sDer) * 5, (1 - sDer) * -2, (1 - sDer) * -4]}
          giro={[0, 0, (1 - sDer) * -2]}
          escala={[-1, 1, 1]}
        />
        {orbita &&
          Array.from({ length: 9 }, (_, i) => {
            const r = (k: string) => random(`orbita-${i}-${k}`);
            const ang = r('a') * Math.PI * 2 + t * (0.6 + r('v') * 0.6);
            const radio = 2.6 + r('r') * 0.9;
            const s = llega(12 + i * 2);
            return (
              <mesh
                key={i}
                geometry={cubo}
                position={[Math.cos(ang) * radio * s, Math.sin(ang * 1.3) * 0.9 * s, Math.sin(ang) * radio * 0.6 * s]}
                rotation={[t * 2 + i, t * 1.5 + i, 0]}
                scale={s}
              >
                <meshStandardMaterial color={colores[i % colores.length]} metalness={0.2} roughness={0.4} />
              </mesh>
            );
          })}
      </group>
    </ThreeCanvas>
  );
};
