import { BODY_REGIONS, type BodyFocus, type BodyRegion, type BodySystem } from "@/lib/body";

// A stylized, procedural human built from primitives (no external model files).
// Units are meters, feet at y=0, facing +z. The patient's left side is +x.

export type V = [number, number, number];

export type Shape =
  | { kind: "limb"; a: V; b: V; r: number } // capsule between two points
  | { kind: "blob"; a: V; b: V; r: number; depth?: number } // ellipsoid spanning two points
  | { kind: "ball"; p: V; s: V | number; rot?: V } // scaled sphere
  | { kind: "tube"; points: V[]; r: number } // smooth curve
  | { kind: "ring"; p: V; radius: number; tube: number; arc: number; rot?: V; s?: V };

export type Layer = BodySystem | "skin";

export interface Part {
  layer: Layer;
  color: string;
  shape: Shape;
  regions: string[];
}

const C = {
  bone: "#ece3cf",
  socket: "#4a4038",
  muscle: "#c4574b",
  tendon: "#f1e4c8",
  artery: "#d43f3a",
  vein: "#4a66c9",
  heart: "#c8322f",
  nerve: "#e8b931",
  brain: "#e9a8a2",
  lung: "#eaa9a4",
  liver: "#8c3b2f",
  stomach: "#e2a086",
  pancreas: "#e9b45b",
  kidney: "#a2403f",
  gut: "#e7b39a",
  colon: "#d99a83",
  bladder: "#e6c07b",
  skin: "#8fc3b9",
};

type Side = { sx: 1 | -1; s: "l" | "r" };
const SIDES: Side[] = [
  { sx: 1, s: "l" },
  { sx: -1, s: "r" },
];

function mirrored(build: (side: Side) => Part[]): Part[] {
  return SIDES.flatMap(build);
}

const part = (layer: Layer, color: string, shape: Shape, regions: string[] = []): Part => ({
  layer,
  color,
  shape,
  regions,
});

function skeleton(): Part[] {
  const parts: Part[] = [
    part("skeletal", C.bone, { kind: "ball", p: [0, 1.69, -0.005], s: [0.088, 0.1, 0.1] }, ["head"]),
    part("skeletal", C.bone, { kind: "ball", p: [0, 1.6, 0.025], s: [0.058, 0.038, 0.06] }, ["head"]),
    part("skeletal", C.bone, { kind: "limb", a: [0, 1.43, 0.085], b: [0, 1.2, 0.095], r: 0.012 }, ["chest"]),
    part("skeletal", C.bone, { kind: "ball", p: [0, 0.95, -0.05], s: [0.04, 0.05, 0.025] }, ["back", "hip_l", "hip_r"]),
    part(
      "skeletal",
      C.bone,
      { kind: "ring", p: [0, 0.98, 0], radius: 0.092, tube: 0.02, arc: Math.PI * 2, rot: [Math.PI / 2 - 0.25, 0, 0], s: [1, 1, 0.7] },
      ["hip_l", "hip_r"],
    ),
  ];

  // Spine: a gentle S-curve of vertebrae.
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const y = 1.0 + t * 0.55;
    const z = -0.055 + 0.018 * Math.sin(t * Math.PI * 2);
    const regions = y < 1.2 ? ["back"] : y > 1.48 ? ["neck"] : ["chest"];
    parts.push(part("skeletal", C.bone, { kind: "ball", p: [0, y, z], s: [0.022, 0.01, 0.02] }, regions));
  }

  // Ribs: open at the front where the sternum sits.
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const arc = Math.PI * 2 * 0.84;
    parts.push(
      part(
        "skeletal",
        C.bone,
        {
          kind: "ring",
          p: [0, 1.42 - t * 0.27, -0.01],
          radius: 0.09 + 0.045 * Math.sin(Math.PI * (0.25 + 0.6 * t)),
          tube: 0.0065,
          arc,
          rot: [Math.PI / 2, 0, -Math.PI / 2 - arc / 2],
          s: [1, 1, 0.72],
        },
        ["chest"],
      ),
    );
  }

  return parts.concat(
    mirrored(({ sx, s }) => {
      const p: Part[] = [
        // Eye sockets
        part("skeletal", C.socket, { kind: "ball", p: [sx * 0.032, 1.685, 0.083], s: [0.02, 0.017, 0.012] }, ["head"]),
        // Shoulder girdle
        part("skeletal", C.bone, { kind: "limb", a: [sx * 0.02, 1.46, 0.07], b: [sx * 0.17, 1.47, 0], r: 0.009 }, [`shoulder_${s}`, "chest"]),
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.1, 1.36, -0.085], s: [0.055, 0.07, 0.012], rot: [0, sx * 0.35, 0] }, [`shoulder_${s}`]),
        // Pelvis wing
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.095, 1.0, -0.005], s: [0.055, 0.06, 0.022], rot: [0, sx * 0.5, sx * 0.3] }, [`hip_${s}`, "back"]),
        // Arm
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.185, 1.425, -0.005], s: 0.03 }, [`shoulder_${s}`]),
        part("skeletal", C.bone, { kind: "limb", a: [sx * 0.19, 1.43, -0.005], b: [sx * 0.245, 1.155, -0.015], r: 0.017 }, [`shoulder_${s}`, `elbow_${s}`]),
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.248, 1.15, -0.012], s: 0.024 }, [`elbow_${s}`]),
        part("skeletal", C.bone, { kind: "limb", a: [sx * 0.255, 1.14, 0], b: [sx * 0.3, 0.885, 0.025], r: 0.011 }, [`elbow_${s}`, `wrist_${s}`]),
        part("skeletal", C.bone, { kind: "limb", a: [sx * 0.24, 1.14, -0.02], b: [sx * 0.28, 0.885, 0.005], r: 0.01 }, [`elbow_${s}`, `wrist_${s}`]),
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.293, 0.87, 0.015], s: [0.022, 0.018, 0.026] }, [`wrist_${s}`, `hand_${s}`]),
        // Leg
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.075, 0.935, 0], s: 0.028 }, [`hip_${s}`]),
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.115, 0.92, -0.005], s: 0.022 }, [`hip_${s}`]),
        part("skeletal", C.bone, { kind: "limb", a: [sx * 0.085, 0.93, 0], b: [sx * 0.1, 0.53, 0.01], r: 0.021 }, [`hip_${s}`, `knee_${s}`]),
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.1, 0.515, 0.005], s: [0.035, 0.025, 0.03] }, [`knee_${s}`]),
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.1, 0.5, 0.045], s: [0.018, 0.022, 0.01] }, [`knee_${s}`]),
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.1, 0.485, 0.005], s: [0.035, 0.018, 0.03] }, [`knee_${s}`]),
        part("skeletal", C.bone, { kind: "limb", a: [sx * 0.098, 0.49, 0.008], b: [sx * 0.1, 0.1, 0.005], r: 0.017 }, [`knee_${s}`, `ankle_${s}`]),
        part("skeletal", C.bone, { kind: "limb", a: [sx * 0.13, 0.475, -0.008], b: [sx * 0.128, 0.095, -0.006], r: 0.008 }, [`knee_${s}`, `ankle_${s}`]),
        // Ankle and foot
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.085, 0.085, 0.005], s: 0.014 }, [`ankle_${s}`]),
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.13, 0.075, -0.005], s: 0.013 }, [`ankle_${s}`]),
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.105, 0.06, 0.005], s: [0.022, 0.016, 0.026] }, [`ankle_${s}`, `foot_${s}`]),
        part("skeletal", C.bone, { kind: "ball", p: [sx * 0.105, 0.035, -0.035], s: [0.02, 0.022, 0.035] }, [`ankle_${s}`, `foot_${s}`]),
      ];

      for (let f = 0; f < 5; f++) {
        // Fingers hang with the palm facing the thigh; the thumb points forward.
        const z = -0.012 + f * 0.009;
        if (f === 0) {
          p.push(part("skeletal", C.bone, { kind: "limb", a: [sx * 0.297, 0.86, 0.03], b: [sx * 0.303, 0.8, 0.055], r: 0.006 }, [`hand_${s}`]));
        } else {
          const len = [0, 0.1, 0.11, 0.1, 0.085][f];
          p.push(part("skeletal", C.bone, { kind: "limb", a: [sx * 0.3, 0.855, z], b: [sx * 0.306, 0.855 - len, z + 0.004], r: 0.0055 }, [`hand_${s}`]));
        }

        const base: V = [sx * (0.09 + 0.009 * f), 0.045, 0.03];
        const tip: V = [sx * (0.075 + 0.018 * f), 0.018, 0.13 - 0.008 * f];
        p.push(part("skeletal", C.bone, { kind: "limb", a: base, b: tip, r: 0.0065 }, [`foot_${s}`]));
        p.push(part("skeletal", C.bone, { kind: "limb", a: tip, b: [tip[0], 0.012, tip[2] + 0.035 - 0.004 * f], r: 0.005 }, [`foot_${s}`]));
      }
      return p;
    }),
  );
}

function muscles(): Part[] {
  return [
    part("muscular", C.muscle, { kind: "ball", p: [0, 1.03, 0.095], s: [0.05, 0.05, 0.02] }, ["abdomen"]),
    ...mirrored(({ sx, s }) => {
      const p: Part[] = [
        part("muscular", C.muscle, { kind: "ball", p: [sx * 0.08, 1.46, -0.045], s: [0.08, 0.04, 0.035], rot: [0, 0, -sx * 0.35] }, ["neck", `shoulder_${s}`]),
        part("muscular", C.muscle, { kind: "limb", a: [sx * 0.03, 1.6, 0], b: [sx * 0.015, 1.47, 0.06], r: 0.012 }, ["neck"]),
        part("muscular", C.muscle, { kind: "ball", p: [sx * 0.2, 1.42, 0], s: [0.045, 0.065, 0.05], rot: [0, 0, sx * 0.2] }, [`shoulder_${s}`]),
        part("muscular", C.muscle, { kind: "ball", p: [sx * 0.075, 1.36, 0.08], s: [0.075, 0.055, 0.03], rot: [0, 0, -sx * 0.2] }, ["chest"]),
        part("muscular", C.muscle, { kind: "ball", p: [sx * 0.11, 1.12, 0.04], s: [0.035, 0.09, 0.06] }, ["abdomen"]),
        part("muscular", C.muscle, { kind: "ball", p: [sx * 0.1, 1.25, -0.07], s: [0.06, 0.13, 0.03], rot: [0, 0, sx * 0.2] }, ["back"]),
        part("muscular", C.muscle, { kind: "limb", a: [sx * 0.03, 1.35, -0.08], b: [sx * 0.03, 0.98, -0.08], r: 0.02 }, ["back"]),
        part("muscular", C.muscle, { kind: "ball", p: [sx * 0.075, 0.92, -0.07], s: [0.075, 0.08, 0.055] }, [`hip_${s}`]),
        // Arm
        part("muscular", C.muscle, { kind: "blob", a: [sx * 0.2, 1.38, 0.02], b: [sx * 0.248, 1.17, 0.015], r: 0.026 }, [`elbow_${s}`]),
        part("muscular", C.muscle, { kind: "blob", a: [sx * 0.2, 1.4, -0.03], b: [sx * 0.24, 1.17, -0.035], r: 0.026 }, [`elbow_${s}`]),
        part("muscular", C.muscle, { kind: "blob", a: [sx * 0.25, 1.14, 0.01], b: [sx * 0.29, 0.9, 0.02], r: 0.025 }, [`elbow_${s}`, `wrist_${s}`]),
        part("muscular", C.muscle, { kind: "blob", a: [sx * 0.265, 1.14, -0.015], b: [sx * 0.295, 0.9, 0], r: 0.022 }, [`elbow_${s}`, `wrist_${s}`]),
        part("muscular", C.muscle, { kind: "ball", p: [sx * 0.3, 0.82, 0.012], s: [0.012, 0.04, 0.035] }, [`hand_${s}`]),
        // Leg
        part("muscular", C.muscle, { kind: "blob", a: [sx * 0.09, 0.88, 0.04], b: [sx * 0.1, 0.56, 0.04], r: 0.05, depth: 0.8 }, [`knee_${s}`]),
        part("muscular", C.muscle, { kind: "blob", a: [sx * 0.125, 0.85, 0.01], b: [sx * 0.12, 0.56, 0.02], r: 0.035 }, [`knee_${s}`]),
        part("muscular", C.muscle, { kind: "blob", a: [sx * 0.04, 0.86, 0], b: [sx * 0.085, 0.6, 0], r: 0.035 }, [`hip_${s}`]),
        part("muscular", C.muscle, { kind: "blob", a: [sx * 0.095, 0.87, -0.04], b: [sx * 0.1, 0.56, -0.035], r: 0.045 }, [`knee_${s}`]),
        part("muscular", C.tendon, { kind: "limb", a: [sx * 0.1, 0.48, 0.045], b: [sx * 0.1, 0.44, 0.035], r: 0.008 }, [`knee_${s}`]),
        part("muscular", C.muscle, { kind: "blob", a: [sx * 0.1, 0.48, -0.035], b: [sx * 0.102, 0.2, -0.03], r: 0.038 }),
        part("muscular", C.muscle, { kind: "blob", a: [sx * 0.11, 0.46, 0.03], b: [sx * 0.105, 0.12, 0.025], r: 0.018 }),
        // Ankle: Achilles tendon plus the ligaments a sprain usually stretches
        part("muscular", C.tendon, { kind: "limb", a: [sx * 0.102, 0.2, -0.035], b: [sx * 0.105, 0.045, -0.055], r: 0.008 }, [`ankle_${s}`]),
        part("muscular", C.tendon, { kind: "limb", a: [sx * 0.132, 0.072, 0], b: [sx * 0.12, 0.055, 0.03], r: 0.0055 }, [`ankle_${s}`]),
        part("muscular", C.tendon, { kind: "limb", a: [sx * 0.13, 0.07, -0.008], b: [sx * 0.115, 0.03, -0.03], r: 0.0055 }, [`ankle_${s}`]),
        part("muscular", C.tendon, { kind: "limb", a: [sx * 0.085, 0.08, 0.005], b: [sx * 0.09, 0.04, 0], r: 0.006 }, [`ankle_${s}`]),
        part("muscular", C.muscle, { kind: "ball", p: [sx * 0.105, 0.025, 0.06], s: [0.03, 0.012, 0.07] }, [`foot_${s}`]),
      ];
      for (let j = 0; j < 3; j++) {
        p.push(part("muscular", C.muscle, { kind: "ball", p: [sx * 0.028, 1.23 - j * 0.065, 0.1], s: [0.025, 0.03, 0.015] }, ["abdomen"]));
      }
      return p;
    }),
  ];
}

function circulation(): Part[] {
  return [
    part("circulatory", C.heart, { kind: "ball", p: [0.025, 1.3, 0.045], s: [0.045, 0.055, 0.04], rot: [0, 0, -0.5] }, ["heart", "chest"]),
    part("circulatory", C.heart, { kind: "ball", p: [0.005, 1.34, 0.035], s: [0.035, 0.03, 0.03] }, ["heart", "chest"]),
    part("circulatory", C.artery, {
      kind: "tube",
      points: [[0.01, 1.34, 0.04], [0.01, 1.4, 0.03], [-0.005, 1.42, 0], [-0.01, 1.38, -0.04], [0, 1.25, -0.04], [0, 1.05, -0.035], [0, 0.97, -0.02]],
      r: 0.009,
    }, ["heart"]),
    part("circulatory", C.vein, { kind: "tube", points: [[-0.02, 1.36, 0.03], [-0.025, 1.2, -0.02], [-0.02, 0.97, -0.01]], r: 0.009 }, ["heart"]),
    ...mirrored(({ sx, s }) => [
      part("circulatory", C.artery, { kind: "tube", points: [[sx * 0.012, 1.41, 0.02], [sx * 0.025, 1.5, 0.02], [sx * 0.03, 1.6, 0.02], [sx * 0.035, 1.66, 0]], r: 0.005 }, ["neck", "head"]),
      part("circulatory", C.artery, {
        kind: "tube",
        points: [[sx * 0.01, 1.41, 0.02], [sx * 0.1, 1.44, 0.02], [sx * 0.19, 1.41, 0.01], [sx * 0.24, 1.17, 0], [sx * 0.29, 0.9, 0.025], [sx * 0.3, 0.8, 0.02]],
        r: 0.0045,
      }, [`shoulder_${s}`, `elbow_${s}`, `wrist_${s}`]),
      part("circulatory", C.vein, {
        kind: "tube",
        points: [[sx * -0.01, 1.4, 0.0], [sx * 0.1, 1.43, 0], [sx * 0.2, 1.4, -0.01], [sx * 0.255, 1.17, -0.02], [sx * 0.3, 0.9, 0.005], [sx * 0.31, 0.8, 0.005]],
        r: 0.004,
      }, [`shoulder_${s}`, `elbow_${s}`, `wrist_${s}`]),
      part("circulatory", C.artery, {
        kind: "tube",
        points: [[0, 0.97, -0.02], [sx * 0.06, 0.92, 0.02], [sx * 0.09, 0.8, 0.03], [sx * 0.1, 0.53, -0.02], [sx * 0.105, 0.3, -0.01], [sx * 0.1, 0.1, 0], [sx * 0.1, 0.04, 0.08]],
        r: 0.006,
      }, [`hip_${s}`, `knee_${s}`, `ankle_${s}`, `foot_${s}`]),
      part("circulatory", C.vein, {
        kind: "tube",
        points: [[sx * -0.015, 0.97, -0.01], [sx * 0.072, 0.92, 0.015], [sx * 0.102, 0.8, 0.02], [sx * 0.112, 0.53, -0.03], [sx * 0.117, 0.3, -0.02], [sx * 0.112, 0.1, -0.01], [sx * 0.112, 0.04, 0.07]],
        r: 0.005,
      }, [`hip_${s}`, `knee_${s}`, `ankle_${s}`, `foot_${s}`]),
    ]),
  ];
}

function nerves(): Part[] {
  return [
    part("nervous", C.brain, { kind: "ball", p: [0, 1.705, -0.01], s: [0.078, 0.07, 0.09] }, ["brain", "head"]),
    part("nervous", C.brain, { kind: "ball", p: [0, 1.65, -0.06], s: [0.045, 0.03, 0.035] }, ["brain", "head"]),
    part("nervous", C.nerve, { kind: "tube", points: [[0, 1.63, -0.03], [0, 1.5, -0.05], [0, 1.3, -0.06], [0, 1.1, -0.05], [0, 0.98, -0.05]], r: 0.007 }, ["back", "neck"]),
    ...mirrored(({ sx, s }) => [
      part("nervous", C.nerve, {
        kind: "tube",
        points: [[0, 1.48, -0.045], [sx * 0.08, 1.45, -0.01], [sx * 0.19, 1.4, 0], [sx * 0.245, 1.16, 0.005], [sx * 0.29, 0.9, 0.02], [sx * 0.3, 0.78, 0.02]],
        r: 0.0035,
      }, [`shoulder_${s}`, `elbow_${s}`, `wrist_${s}`, `hand_${s}`]),
      part("nervous", C.nerve, {
        kind: "tube",
        points: [[0, 1.0, -0.05], [sx * 0.06, 0.93, -0.07], [sx * 0.095, 0.75, -0.05], [sx * 0.1, 0.53, -0.03], [sx * 0.11, 0.3, -0.015], [sx * 0.1, 0.08, -0.01], [sx * 0.1, 0.03, 0.07]],
        r: 0.005,
      }, ["back", `hip_${s}`, `knee_${s}`, `ankle_${s}`, `foot_${s}`]),
    ]),
  ];
}

function organs(): Part[] {
  const coil: V[] = [];
  for (let i = 0; i <= 70; i++) {
    const a = i * 0.55;
    const r = 0.055 * (0.55 + 0.45 * Math.sin(i * 0.17));
    coil.push([r * Math.cos(a), 1.01 - i * 0.0013, 0.05 + 0.025 * Math.sin(a)]);
  }
  return [
    part("organs", C.heart, { kind: "ball", p: [0.025, 1.3, 0.045], s: [0.045, 0.055, 0.04], rot: [0, 0, -0.5] }, ["heart", "chest"]),
    part("organs", C.heart, { kind: "ball", p: [0.005, 1.34, 0.035], s: [0.035, 0.03, 0.03] }, ["heart", "chest"]),
    part("organs", C.liver, { kind: "ball", p: [-0.05, 1.14, 0.04], s: [0.1, 0.05, 0.07], rot: [0, 0, 0.25] }, ["liver", "abdomen"]),
    part("organs", C.stomach, { kind: "ball", p: [0.06, 1.12, 0.05], s: [0.055, 0.045, 0.04], rot: [0, 0, -0.6] }, ["stomach", "abdomen"]),
    part("organs", C.pancreas, { kind: "blob", a: [-0.03, 1.075, 0.025], b: [0.085, 1.09, 0.015], r: 0.014 }, ["pancreas", "abdomen"]),
    part("organs", C.gut, { kind: "tube", points: coil, r: 0.011 }, ["abdomen"]),
    part("organs", C.colon, { kind: "tube", points: [[-0.03, 0.9, 0.04], [-0.1, 0.92, 0.04], [-0.105, 1.05, 0.04], [0.105, 1.055, 0.04], [0.1, 0.92, 0.04], [0.03, 0.89, 0.03]], r: 0.017 }, ["abdomen"]),
    part("organs", C.bladder, { kind: "ball", p: [0, 0.88, 0.05], s: 0.024 }, ["abdomen"]),
    ...mirrored(({ sx }) => [
      part("organs", C.lung, { kind: "ball", p: [sx * 0.068, 1.3, 0], s: [0.058, 0.11, 0.07] }, ["lungs", "chest"]),
      part("organs", C.kidney, { kind: "ball", p: [sx * 0.065, 1.05, -0.055], s: [0.025, 0.045, 0.02], rot: [0, 0, sx * 0.25] }, ["kidneys", "back"]),
    ]),
  ];
}

function skin(): Part[] {
  return [
    part("skin", C.skin, { kind: "ball", p: [0, 1.67, 0], s: [0.1, 0.125, 0.115] }),
    part("skin", C.skin, { kind: "limb", a: [0, 1.5, 0], b: [0, 1.6, 0], r: 0.05 }),
    part("skin", C.skin, { kind: "ball", p: [0, 1.27, 0], s: [0.17, 0.22, 0.11] }),
    part("skin", C.skin, { kind: "ball", p: [0, 1.05, 0], s: [0.145, 0.13, 0.1] }),
    part("skin", C.skin, { kind: "ball", p: [0, 0.93, 0], s: [0.16, 0.09, 0.11] }),
    ...mirrored(({ sx }) => [
      part("skin", C.skin, { kind: "ball", p: [sx * 0.19, 1.42, 0], s: 0.05 }),
      part("skin", C.skin, { kind: "limb", a: [sx * 0.195, 1.42, 0], b: [sx * 0.25, 1.15, -0.01], r: 0.045 }),
      part("skin", C.skin, { kind: "limb", a: [sx * 0.25, 1.15, -0.01], b: [sx * 0.295, 0.88, 0.015], r: 0.035 }),
      part("skin", C.skin, { kind: "ball", p: [sx * 0.302, 0.81, 0.018], s: [0.02, 0.06, 0.04] }),
      part("skin", C.skin, { kind: "limb", a: [sx * 0.09, 0.92, 0], b: [sx * 0.1, 0.5, 0.01], r: 0.07 }),
      part("skin", C.skin, { kind: "limb", a: [sx * 0.1, 0.5, 0], b: [sx * 0.1, 0.09, 0], r: 0.048 }),
      part("skin", C.skin, { kind: "ball", p: [sx * 0.105, 0.035, 0.04], s: [0.04, 0.03, 0.11] }),
    ]),
  ];
}

export const PARTS: Part[] = [...skin(), ...skeleton(), ...muscles(), ...circulation(), ...nerves(), ...organs()];

// Where the camera looks for each region, how far away it sits, and from which direction.
interface Anchor {
  p: V;
  dist: number;
  dir?: V;
}

const UNPAIRED: Record<string, Anchor> = {
  head: { p: [0, 1.66, 0], dist: 0.85 },
  brain: { p: [0, 1.7, -0.01], dist: 0.8, dir: [0.7, 0.3, 1] },
  neck: { p: [0, 1.52, 0], dist: 0.8 },
  chest: { p: [0, 1.3, 0.02], dist: 1.05 },
  heart: { p: [0.025, 1.31, 0.045], dist: 0.8 },
  lungs: { p: [0, 1.3, 0], dist: 1.0 },
  back: { p: [0, 1.08, -0.06], dist: 1.0, dir: [0.35, 0.15, -1] },
  abdomen: { p: [0, 1.04, 0.05], dist: 0.95 },
  stomach: { p: [0.06, 1.12, 0.05], dist: 0.75 },
  liver: { p: [-0.05, 1.14, 0.04], dist: 0.75 },
  pancreas: { p: [0.025, 1.08, 0.02], dist: 0.7 },
  kidneys: { p: [0, 1.05, -0.055], dist: 0.8, dir: [0.3, 0.15, -1] },
};

const PAIRED: Record<string, (sx: number) => Anchor> = {
  shoulder: (sx) => ({ p: [sx * 0.19, 1.42, 0], dist: 0.75, dir: [sx * 0.7, 0.2, 1] }),
  elbow: (sx) => ({ p: [sx * 0.248, 1.15, -0.01], dist: 0.65, dir: [sx * 0.8, 0.15, 1] }),
  wrist: (sx) => ({ p: [sx * 0.293, 0.88, 0.015], dist: 0.55, dir: [sx * 0.8, 0.15, 1] }),
  hand: (sx) => ({ p: [sx * 0.3, 0.81, 0.02], dist: 0.55, dir: [sx * 1, 0.1, 0.6] }),
  hip: (sx) => ({ p: [sx * 0.09, 0.94, 0], dist: 0.85, dir: [sx * 0.6, 0.15, 1] }),
  knee: (sx) => ({ p: [sx * 0.1, 0.5, 0.01], dist: 0.75, dir: [sx * 0.6, 0.2, 1] }),
  ankle: (sx) => ({ p: [sx * 0.11, 0.07, 0], dist: 0.55, dir: [sx * 1, 0.35, 0.7] }),
  foot: (sx) => ({ p: [sx * 0.105, 0.04, 0.05], dist: 0.6, dir: [sx * 0.8, 0.6, 1] }),
};

export const WHOLE_BODY: Anchor = { p: [0, 0.92, 0], dist: 3.0 };
export const TORSO: Anchor = { p: [0, 1.18, 0], dist: 1.25 };

export function focusKeys(f: Pick<BodyFocus, "region" | "side">): string[] {
  if (!BODY_REGIONS[f.region].paired) return [f.region];
  if (f.side === "left") return [`${f.region}_l`];
  if (f.side === "right") return [`${f.region}_r`];
  return [`${f.region}_l`, `${f.region}_r`];
}

export function anchorFor(f: Pick<BodyFocus, "region" | "side">): Anchor {
  const region: BodyRegion = f.region;
  if (!BODY_REGIONS[region].paired) return UNPAIRED[region];
  if (f.side === "left") return PAIRED[region](1);
  if (f.side === "right") return PAIRED[region](-1);
  // Both sides: center between them and pull back.
  const a = PAIRED[region](1);
  return { p: [0, a.p[1], a.p[2]], dist: a.dist + 0.35 };
}

// Marker points for each highlighted key (one per side).
export function markerPoints(f: Pick<BodyFocus, "region" | "side">): V[] {
  if (!BODY_REGIONS[f.region].paired) return [UNPAIRED[f.region].p];
  return focusKeys(f).map((k) => PAIRED[f.region](k.endsWith("_l") ? 1 : -1).p);
}
