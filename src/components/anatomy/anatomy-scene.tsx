"use client";

import { ContactShadows, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { BodyFocus, BodySystem } from "@/lib/body";
import { ANCHORS } from "./anchors.generated";
import { focusKeys, markerPoints, MODEL_URL, TORSO, viewFor, WHOLE_BODY, type V } from "./body-model";

const FOCUS_GLOW = new THREE.Color("#ff9a3d");
const FOCUS_TINT = new THREE.Color("#ff8a2a");

type Look = "focus" | "normal" | "dim" | "context" | "skin";

const OPACITY: Record<Look, number> = { focus: 1, normal: 1, dim: 0.28, context: 0.14, skin: 0.06 };

interface ModelPart {
  mesh: THREE.Mesh;
  color: THREE.Color;
  systems: string[];
  regions: string[];
  kind: string;
}

function PartMesh({ part, look, reducedMotion }: { part: ModelPart; look: Look; reducedMotion: boolean }) {
  const material = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (look !== "focus" || !material.current) return;
    material.current.emissiveIntensity = reducedMotion ? 0.55 : 0.15 + 0.3 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2));
  });

  const opacity = OPACITY[look];
  const transparent = opacity < 1;
  const { mesh } = part;
  // Tint highlighted parts toward orange so pale tissue like bone still stands out.
  const color = useMemo(() => (look === "focus" ? part.color.clone().lerp(FOCUS_TINT, 0.55) : part.color), [look, part.color]);

  return (
    <mesh
      geometry={mesh.geometry}
      position={mesh.position}
      quaternion={mesh.quaternion}
      scale={mesh.scale}
      renderOrder={look === "skin" ? 2 : transparent ? 1 : 0}
    >
      <meshStandardMaterial
        ref={material}
        color={color}
        roughness={look === "skin" ? 0.25 : 0.6}
        metalness={0.02}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
        emissive={look === "focus" ? FOCUS_GLOW : "#000000"}
        emissiveIntensity={look === "focus" ? 0.3 : 0}
      />
    </mesh>
  );
}

// Real anatomy from BodyParts3D. Each mesh carries the systems and regions it belongs to.
function Body({ system, lit, reducedMotion }: { system: BodySystem; lit: Set<string>; reducedMotion: boolean }) {
  const { scene } = useGLTF(MODEL_URL, false, true);
  const parts = useMemo(() => {
    const out: ModelPart[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const { systems = [], regions = [], kind = "" } = mesh.userData as Partial<ModelPart>;
      out.push({ mesh, color: (mesh.material as THREE.MeshStandardMaterial).color.clone(), systems, regions, kind });
    });
    return out;
  }, [scene]);

  const lookFor = (part: ModelPart): Look | null => {
    if (part.kind === "skin") return "skin";
    if (part.systems.includes(system)) {
      if (lit.size === 0) return "normal";
      return part.regions.some((r) => lit.has(r)) ? "focus" : "dim";
    }
    // Faint bones under the other systems keep you oriented.
    if (part.systems[0] === "skeletal") return "context";
    return null;
  };

  return (
    <group>
      {parts.map((part, i) => {
        const look = lookFor(part);
        return look ? <PartMesh key={i} part={part} look={look} reducedMotion={reducedMotion} /> : null;
      })}
    </group>
  );
}

function LoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-subtle">
      <span className="mr-2 size-2 animate-pulse rounded-full bg-teal" />
      Loading anatomy… {Math.round(progress)}%
    </div>
  );
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
  const [x, , z] = ANCHORS.body;
  return (
    <group position={[x, -0.012, z]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[0.42, 0.45, 0.02, 64]} />
        <meshStandardMaterial color="#f3f0e6" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.415, 64]} />
        <meshBasicMaterial color="#2a4fa8" transparent opacity={0.55} />
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

/** Reports where 3D points land on the canvas, in CSS pixels, whenever that changes. */
function Projector({ points, onProject }: { points: V[]; onProject: (pts: { x: number; y: number }[]) => void }) {
  const { camera, size } = useThree();
  const last = useRef("");
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const out = points.map((p) => {
      v.set(p[0], p[1], p[2]).project(camera);
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
    });
    const key = out.map((o) => `${Math.round(o.x)},${Math.round(o.y)}`).join(";");
    if (key !== last.current) {
      last.current = key;
      onProject(out);
    }
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
  /** Hold the body still instead of slowly turning it when it isn't interactive. */
  still?: boolean;
  /** Screen positions of the focus and highlight markers, in that order. */
  onProject?: (pts: { x: number; y: number }[]) => void;
}

export default function AnatomyScene({
  system,
  focus,
  highlights = [],
  frame = "body",
  interactive = true,
  reducedMotion = false,
  still = false,
  onProject,
}: AnatomySceneProps) {
  const lit = useMemo(() => {
    const all = [...(focus ? [focus] : []), ...highlights];
    return new Set(all.flatMap(focusKeys));
  }, [focus, highlights]);

  const view = useMemo(() => {
    if (focus) {
      const v = viewFor(focus);
      // Give a bit more room on phone screens.
      return { target: v.p, dist: v.dist * 1.45, dir: v.dir };
    }
    const v = frame === "torso" ? TORSO : WHOLE_BODY;
    return { target: v.p, dist: v.dist, dir: v.dir };
  }, [focus, frame]);

  const markers = useMemo(
    () => [...(focus ? [focus] : []), ...highlights].flatMap(markerPoints),
    [focus, highlights],
  );

  return (
    <>
      <Canvas camera={{ fov: 35, near: 0.01, far: 50, position: [0.8, 1.2, 3] }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <hemisphereLight args={["#fffdf7", "#c9d3bd", 1.15]} />
        <directionalLight position={[2, 3, 2.5]} intensity={1.5} />
        <directionalLight position={[-2, 1.5, -1.5]} intensity={0.6} color="#dfe6f5" />

        <Suspense fallback={null}>
          <Body system={system} lit={lit} reducedMotion={reducedMotion} />
        </Suspense>

        {markers.map((p, i) => (
          <Marker key={i} p={p} reducedMotion={reducedMotion} />
        ))}
        {onProject && <Projector points={markers} onProject={onProject} />}


        <Platform />
        <ContactShadows position={[ANCHORS.body[0], 0, ANCHORS.body[2]]} opacity={0.35} scale={1.6} blur={2.4} far={1} />

        <OrbitControls
          makeDefault
          enabled={interactive}
          enablePan={false}
          minDistance={0.3}
          maxDistance={4}
          autoRotate={!interactive && !reducedMotion && !still}
          autoRotateSpeed={1.2}
        />
        <CameraRig target={view.target} dist={view.dist} dir={view.dir} reducedMotion={reducedMotion} />
      </Canvas>
      <LoadingOverlay />
    </>
  );
}

useGLTF.preload(MODEL_URL, false, true);
