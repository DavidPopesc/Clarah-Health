"use client";

import { ContactShadows, Float } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function heartGeometry() {
  // The classic three.js heart path, extruded with a soft bevel.
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 4, bevelEnabled: true, bevelSegments: 8, steps: 1, bevelSize: 2, bevelThickness: 2.4, curveSegments: 32 });
  g.center();
  g.rotateZ(Math.PI);
  g.scale(0.055, 0.055, 0.055);
  return g;
}

function Heart({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => heartGeometry(), []);

  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    const t = clock.elapsedTime;
    // "Lub-dub": two quick pulses, then rest, about 66 beats per minute.
    const phase = (t * 1.1) % 1;
    const beat = Math.exp(-((phase - 0.08) ** 2) / 0.0012) * 0.07 + Math.exp(-((phase - 0.26) ** 2) / 0.0012) * 0.045;
    ref.current.scale.setScalar(1 + beat);
    ref.current.rotation.y = Math.sin(t * 0.6) * 0.5;
  });

  return (
    <mesh ref={ref} geometry={geometry}>
      <meshPhysicalMaterial color="#b44e34" roughness={0.22} metalness={0.1} clearcoat={1} clearcoatRoughness={0.15} sheen={0.4} sheenColor="#e9b9a4" />
    </mesh>
  );
}

export default function HeartScene({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <Canvas camera={{ fov: 30, position: [0, 0.1, 4.2] }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <hemisphereLight args={["#fffaf2", "#d9b9a5", 1.1]} />
      <directionalLight position={[2.5, 3, 3]} intensity={2} />
      <directionalLight position={[-3, -1, 2]} intensity={0.6} color="#f0c8b6" />
      <Float speed={reducedMotion ? 0 : 1.6} rotationIntensity={reducedMotion ? 0 : 0.25} floatIntensity={reducedMotion ? 0 : 0.6}>
        <Heart reducedMotion={reducedMotion} />
      </Float>
      <ContactShadows position={[0, -0.75, 0]} opacity={0.3} scale={3} blur={2.6} far={1.5} />
    </Canvas>
  );
}
