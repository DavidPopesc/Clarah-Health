"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { BodyFocus, BodySystem } from "@/lib/body";
import { anchorFor, focusKeys, markerPoints, PARTS, TORSO, WHOLE_BODY, type Part, type Shape, type V } from "./body-model";

const UNIT_SPHERE = new THREE.SphereGeometry(1, 24, 16);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const FOCUS_GLOW = new THREE.Color("#ff9a3d");

function between(a: V, b: V) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const length = dir.length();
  return {
    position: va.add(vb).multiplyScalar(0.5),
    quaternion: new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir.normalize()),
    length,
  };
}

type Look = "focus" | "normal" | "dim" | "context" | "skin";

const OPACITY: Record<Look, number> = { focus: 1, normal: 1, dim: 0.32, context: 0.16, skin: 0.07 };

function PartMesh({ part, look, reducedMotion }: { part: Part; look: Look; reducedMotion: boolean }) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const { shape } = part;

  const geometry = useMemo(() => buildGeometry(shape), [shape]);
  const transform = useMemo(() => transformFor(shape), [shape]);

  useFrame(({ clock }) => {
    if (look !== "focus" || !material.current) return;
    const pulse = reducedMotion ? 0.6 : 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2));
    material.current.emissiveIntensity = pulse;
  });

  const opacity = OPACITY[look];
  const transparent = opacity < 1;

  const mesh = (
    <mesh
      geometry={geometry ?? UNIT_SPHERE}
      position={transform.position}
      quaternion={transform.quaternion}
      scale={transform.scale}
      renderOrder={look === "skin" ? 2 : transparent ? 1 : 0}
    >
      <meshStandardMaterial
        ref={material}
        color={part.color}
        roughness={look === "skin" ? 0.2 : 0.55}
        metalness={0.05}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
        emissive={look === "focus" ? FOCUS_GLOW : "#000000"}
        emissiveIntensity={look === "focus" ? 0.6 : 0}
      />
    </mesh>
  );

  if (shape.kind === "ring" && shape.s) {
    return <group scale={shape.s}>{mesh}</group>;
  }
  return mesh;
}

function buildGeometry(shape: Shape): THREE.BufferGeometry | null {
  switch (shape.kind) {
    case "limb": {
      const { length } = between(shape.a, shape.b);
      return new THREE.CapsuleGeometry(shape.r, Math.max(0.001, length), 6, 12);
    }
    case "tube":
      return new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(shape.points.map((p) => new THREE.Vector3(...p))),
        Math.max(24, shape.points.length * 10),
        shape.r,
        8,
      );
    case "ring":
      return new THREE.TorusGeometry(shape.radius, shape.tube, 8, 48, shape.arc);
    default:
      return null; // blob and ball reuse the shared unit sphere
  }
}

function transformFor(shape: Shape) {
  const identity = new THREE.Quaternion();
  switch (shape.kind) {
    case "limb": {
      const { position, quaternion } = between(shape.a, shape.b);
      return { position, quaternion, scale: new THREE.Vector3(1, 1, 1) };
    }
    case "blob": {
      const { position, quaternion, length } = between(shape.a, shape.b);
      return { position, quaternion, scale: new THREE.Vector3(shape.r, length / 2, shape.r * (shape.depth ?? 1)) };
    }
    case "ball": {
      const s = typeof shape.s === "number" ? [shape.s, shape.s, shape.s] : shape.s;
      const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(shape.rot ?? [0, 0, 0])));
      return { position: new THREE.Vector3(...shape.p), quaternion, scale: new THREE.Vector3(...s) };
    }
    case "ring": {
      const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(shape.rot ?? [0, 0, 0])));
      // Ring position is applied inside its scale group, so undo the group scale here.
      const s = shape.s ?? [1, 1, 1];
      const position = new THREE.Vector3(shape.p[0] / s[0], shape.p[1] / s[1], shape.p[2] / s[2]);
      return { position, quaternion, scale: new THREE.Vector3(1, 1, 1) };
    }
    default:
      return { position: new THREE.Vector3(), quaternion: identity, scale: new THREE.Vector3(1, 1, 1) };
  }
}

function Marker({ p, reducedMotion }: { p: V; reducedMotion: boolean }) {
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!halo.current || reducedMotion) return;
    const t = (clock.elapsedTime * 0.8) % 1;
    halo.current.scale.setScalar(0.015 + t * 0.045);
    (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - t);
  });
  return (
    <group position={p}>
      <mesh ref={halo} scale={0.03} renderOrder={3}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function Platform() {
  return (
    <group position={[0, -0.012, 0]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[0.42, 0.45, 0.02, 64]} />
        <meshStandardMaterial color="#e6f1ef" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.415, 64]} />
        <meshBasicMaterial color="#0f6e66" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function CameraRig({ target, dist, dir, reducedMotion }: { target: V; dist: number; dir: V; reducedMotion: boolean }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const goal = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3; active: boolean } | null>(null);

  useEffect(() => {
    const tgt = new THREE.Vector3(...target);
    const pos = tgt.clone().add(new THREE.Vector3(...dir).normalize().multiplyScalar(dist));
    if (reducedMotion || !controls) {
      camera.position.copy(pos);
      controls?.target.copy(tgt);
      controls?.update();
      camera.lookAt(tgt);
      goal.current = null;
      return;
    }
    goal.current = { pos, tgt, active: true };
    const stop = () => goal.current && (goal.current.active = false);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [camera, controls, target, dist, dir, reducedMotion]);

  useFrame((_, delta) => {
    const g = goal.current;
    if (!g?.active || !controls) return;
    const k = 1 - Math.exp(-delta * 3.5);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.tgt, k);
    controls.update();
    if (camera.position.distanceTo(g.pos) < 0.002 && controls.target.distanceTo(g.tgt) < 0.002) g.active = false;
  });

  return null;
}

export interface AnatomySceneProps {
  system: BodySystem;
  focus?: BodyFocus | null;
  highlights?: BodyFocus[];
  frame?: "body" | "torso";
  interactive?: boolean;
  reducedMotion?: boolean;
}

export default function AnatomyScene({
  system,
  focus,
  highlights = [],
  frame = "body",
  interactive = true,
  reducedMotion = false,
}: AnatomySceneProps) {
  const lit = useMemo(() => {
    const all = [...(focus ? [focus] : []), ...highlights];
    return new Set(all.flatMap(focusKeys));
  }, [focus, highlights]);

  const view = useMemo(() => {
    if (focus) {
      const a = anchorFor(focus);
      // Anchors are tuned tight; give a bit more room on phone screens.
      return { target: a.p, dist: a.dist * 1.45, dir: a.dir ?? ([0.35, 0.15, 1] as V) };
    }
    const a = frame === "torso" ? TORSO : WHOLE_BODY;
    return { target: a.p, dist: a.dist, dir: [0.25, 0.1, 1] as V };
  }, [focus, frame]);

  const markers = useMemo(
    () => [...(focus ? [focus] : []), ...highlights].flatMap(markerPoints),
    [focus, highlights],
  );

  const lookFor = (part: Part): Look | null => {
    if (part.layer === "skin") return "skin";
    if (part.layer === system) {
      if (lit.size === 0) return "normal";
      return part.regions.some((r) => lit.has(r)) ? "focus" : "dim";
    }
    // Faint bones under the other systems keep you oriented.
    if (part.layer === "skeletal") return "context";
    return null;
  };


  return (
    <Canvas camera={{ fov: 35, near: 0.01, far: 50, position: [0.8, 1.2, 3] }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <hemisphereLight args={["#ffffff", "#b9c9c4", 1.15]} />
      <directionalLight position={[2, 3, 2.5]} intensity={1.5} />
      <directionalLight position={[-2, 1.5, -1.5]} intensity={0.6} color="#cfe8e3" />

      <group>
        {PARTS.map((part, i) => {
          const look = lookFor(part);
          return look ? <PartMesh key={i} part={part} look={look} reducedMotion={reducedMotion} /> : null;
        })}
      </group>

      {markers.map((p, i) => (
        <Marker key={i} p={p} reducedMotion={reducedMotion} />
      ))}


      <Platform />
      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={1.6} blur={2.4} far={1} />

      <OrbitControls
        makeDefault
        enabled={interactive}
        enablePan={false}
        minDistance={0.3}
        maxDistance={4}
        autoRotate={!interactive && !reducedMotion}
        autoRotateSpeed={1.2}
      />
      <CameraRig target={view.target} dist={view.dist} dir={view.dir} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
