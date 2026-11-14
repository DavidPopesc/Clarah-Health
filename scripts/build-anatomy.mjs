// Builds public/anatomy/body.glb from BodyParts3D, a real human anatomy dataset.
//
// BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0
// International. https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
//
// Usage:
//   1. Download isa_BP3D_4.0_obj_99.zip and isa_inclusion_relation_list.txt from
//      https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html and unzip into one folder.
//   2. node scripts/build-anatomy.mjs <that folder>
//
// Each part is sorted into a body system, tagged with the regions it belongs to (using real
// vertex distances to anatomical landmarks), simplified, and merged into a compressed GLB.

import fs from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const SRC = process.argv[2];
if (!SRC) {
  console.error("Usage: node scripts/build-anatomy.mjs <BodyParts3D folder>");
  process.exit(1);
}
const OBJ_DIR = path.join(SRC, "isa_BP3D_4.0_obj_99");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_GLB = path.join(ROOT, "public/anatomy/body.glb");
const OUT_ANCHORS = path.join(ROOT, "src/components/anatomy/anchors.generated.ts");

// ---------- Read the is-a tree so parts can be classified by what they are ----------

const parents = new Map();
const conceptNames = new Map();
for (const line of fs.readFileSync(path.join(SRC, "isa_inclusion_relation_list.txt"), "utf8").split("\n").slice(1)) {
  const [p, pn, c, cn] = line.split("\t");
  if (!c) continue;
  conceptNames.set(p, pn);
  conceptNames.set(c, cn?.trim());
  if (!parents.has(c)) parents.set(c, new Set());
  parents.get(c).add(p);
}
function ancestors(id, seen = new Set()) {
  for (const p of parents.get(id) ?? []) {
    if (!seen.has(p)) {
      seen.add(p);
      ancestors(p, seen);
    }
  }
  return seen;
}

// ---------- Parse OBJ files ----------

// BodyParts3D is in millimeters, z up, front at -y. Convert to meters, y up, front at +z.
function parseObj(file) {
  const text = fs.readFileSync(file, "utf8");
  let name = "";
  let concept = "";
  const pos = [];
  const idx = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/).map(Number);
      pos.push(x / 1000, z / 1000, -y / 1000);
    } else if (line.startsWith("f ")) {
      const vs = line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1);
      for (let i = 1; i + 1 < vs.length; i++) idx.push(vs[0], vs[i], vs[i + 1]);
    } else if (line.startsWith("# English name")) name = line.split(":").slice(1).join(":").trim();
    else if (line.startsWith("# Concept ID")) concept = line.split(":")[1].trim();
  }
  return { name, concept, pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

// ---------- Classification ----------

const has = (re, s) => re.test(s);

function classify(name, anc) {
  const n = name.toLowerCase();
  const a = [...anc].map((id) => conceptNames.get(id) ?? "");
  const isA = (label) => a.includes(label);
  const vessel = isA("artery") || isA("vein") || isA("region of vascular tree organ") || has(/\b(aorta|vena cava|arter(y|ies)|veins?|venous)\b/, n);

  if (n === "skin") return { systems: ["skin"], kind: "skin" };
  if (has(/(hair|eyebrow|eyeball|cornea|iris|lens|retina|sclera|choroid|vitreous|lacrimal|ear\b|gingiva|lip\b|tongue|testis|epididymis|penis|prostate|seminal|deferent|urethra|mesocolon|mesoappendix|tarsal plate|corona ciliaris|raphe|tendinous ring|trochlea of|interosseous membrane)/, n)) return null;
  const heart = has(/(atrium|papillary muscle|coronary|cardiac vein|valve|cusp|chordae|interventricular|interatrial|coronary sinus|ascending aorta|pulmonary trunk)/, n) || (has(/ventricle/, n) && has(/(left|right) ventricle/, n) && !has(/lateral ventricle/, n));
  if (heart) return { systems: ["circulatory", "organs"], kind: has(/coronary|cardiac vein|artery|vein/, n) ? (has(/vein/, n) ? "vein" : "artery") : "heart" };
  if (vessel) return { systems: ["circulatory"], kind: isA("vein") || has(/vein|venous|vena/, n) ? "vein" : "artery" };
  if (isA("bone organ") || has(/\b(bone|vertebra|sacrum|coccyx|rib|sternum|manubrium|xiphoid|mandible|maxilla|cartilage|meniscus|intervertebral disk|patella|talus|calcaneus|tibia|fibula|femur|humerus|radius|ulna|scapula|clavicle|phalanx|metatarsal|metacarpal|cuboid|navicular|cuneiform|tooth|atlas|axis)\b/, n)) return { systems: ["skeletal"], kind: "bone" };
  if (isA("muscle organ") || isA("head of muscle organ") || a.some((x) => x.includes("muscle")) || has(/\b(muscle|tendon|aponeurosis|iliotibial tract|retinaculum|ligament|trapezius|interossei|lumbricals|intertransversarii|levatores|interspinales|linea alba)\b/, n)) {
    return { systems: ["muscular"], kind: has(/tendon|aponeurosis|tract|retinaculum|ligament|linea alba/, n) ? "tendon" : "muscle" };
  }
  if (has(/(bronch|trachea|lingular)/, n)) return { systems: ["organs"], kind: "lung" };
  if (has(/(hepatovenous segment|lobe of liver)/, n)) return { systems: ["organs"], kind: "liver" };
  if (has(/stomach/, n)) return { systems: ["organs"], kind: "stomach" };
  if (has(/pancrea/, n)) return { systems: ["organs"], kind: "pancreas" };
  if (has(/kidney|ureter/, n)) return { systems: ["organs"], kind: "kidney" };
  if (has(/spleen/, n)) return { systems: ["organs"], kind: "spleen" };
  if (has(/(colon|cecum|caecum|rectum|appendix|ileocecal)/, n)) return { systems: ["organs"], kind: "colon" };
  if (has(/(jejunum|ileum|duodenum|intestine)/, n)) return { systems: ["organs"], kind: "gut" };
  if (has(/(esophagus|bladder|gallbladder|gall bladder|cystic duct|bile|biliary|hepatic duct|thyroid|adrenal|suprarenal|larynx|pharynx|thymus|epiglottis)/, n)) return { systems: ["organs"], kind: "organ" };
  if (isA("segment of neuraxis") || isA("cell part cluster of neuraxis") || has(/(brain|cerebr|cerebell|gyrus|lobule|nucleus|thalamus|hippocamp|pons|medulla|midbrain|spinal|nerve|ganglion|fornix|corpus|ventricle|plexus|cortex|amygdala|putamen|caudate|insula|chiasm|cord|lemniscus|peduncle|aqueduct|colliculus|hypothal|pituitary|pineal|tentorium|commissure|interpeduncular|mammillary|tuber cinereum|geniculate|white matter)/, n)) {
    return { systems: ["nervous"], kind: has(/nerve|ganglion|branch|plexus of (left|right)/, n) ? "nerve" : "brain" };
  }
  return null;
}

const COLORS = {
  skin: "#9fc9c1",
  bone: "#e9dfc9",
  muscle: "#b84a3e",
  tendon: "#ecdcb8",
  artery: "#c8342e",
  vein: "#3f5fbf",
  heart: "#a8282a",
  brain: "#e3b2a8",
  nerve: "#e6b631",
  lung: "#e7a3a0",
  liver: "#7f3528",
  stomach: "#d98f78",
  pancreas: "#e3ad55",
  kidney: "#99393a",
  spleen: "#6e2a3a",
  colon: "#cf8f78",
  gut: "#e0a990",
  organ: "#d9a08c",
};

// Fraction of triangles kept per kind: enough detail to read clearly on a phone.
const KEEP = { skin: 0.04, bone: 0.14, muscle: 0.06, tendon: 0.08, artery: 0.04, vein: 0.03, heart: 0.2, brain: 0.05, nerve: 0.1 };
const KEEP_ORGAN = 0.18;

// ---------- Load everything ----------

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const files = fs.readdirSync(OBJ_DIR).filter((f) => f.endsWith(".obj"));
const parts = [];
let minY = Infinity;
for (const f of files) {
  const obj = parseObj(path.join(OBJ_DIR, f));
  const cls = classify(obj.name, ancestors(obj.concept));
  if (!cls || obj.idx.length === 0) continue;
  for (let i = 1; i < obj.pos.length; i += 3) minY = Math.min(minY, obj.pos[i]);
  const lower = obj.name.toLowerCase();
  const side = /\bleft\b/.test(lower) ? "l" : /\bright\b/.test(lower) ? "r" : null;
  parts.push({ ...obj, ...cls, side, color: COLORS[cls.kind] });
}
// Stand the body on y = 0.
for (const p of parts) for (let i = 1; i < p.pos.length; i += 3) p.pos[i] -= minY;
console.log(`Loaded ${parts.length} parts`);

// ---------- Geometry helpers ----------

function bbox(pos) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      b[k] = Math.min(b[k], pos[i + k]);
      b[k + 3] = Math.max(b[k + 3], pos[i + k]);
    }
  }
  return b;
}
const center = (b) => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
function centroid(pos, keep = () => true) {
  const c = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < pos.length; i += 3) {
    if (!keep(pos[i], pos[i + 1], pos[i + 2])) continue;
    c[0] += pos[i];
    c[1] += pos[i + 1];
    c[2] += pos[i + 2];
    n++;
  }
  return c.map((v) => v / n);
}
function minDistance(pos, p) {
  let best = Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const d = (pos[i] - p[0]) ** 2 + (pos[i + 1] - p[1]) ** 2 + (pos[i + 2] - p[2]) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
for (const p of parts) p.box = bbox(p.pos);

const byName = (name) => {
  const p = parts.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!p) throw new Error(`Missing landmark: ${name}`);
  return p;
};
const avg = (pts) => pts.reduce((a, p) => a.map((v, k) => v + p[k] / pts.length), [0, 0, 0]);

// ---------- Regions ----------

const regions = new Map(); // part -> Set of region keys
const tag = (p, key) => {
  if (!regions.has(p)) regions.set(p, new Set());
  regions.get(p).add(key);
};
const anchors = {};

// Paired joints: anchor at a landmark, then tag every part on that side within a radius.
const SIDE_WORD = { l: "Left", r: "Right" };
for (const s of ["l", "r"]) {
  const W = SIDE_WORD[s];
  const femur = byName(`${W} femur`);
  const humerus = byName(`${W} humerus`);
  const radius = byName(`${W} radius`);
  const femurInner = Math.min(Math.abs(femur.box[0]), Math.abs(femur.box[3]));
  const joints = {
    ankle: { p: center(byName(`${W} talus`).box), r: 0.06 },
    knee: { p: center(byName(`${W} patella`).box).map((v, k) => (k === 2 ? v - 0.03 : v)), r: 0.075 },
    hip: { p: centroid(femur.pos, (x, y) => y > femur.box[4] - 0.05 && Math.abs(x) < femurInner + 0.05), r: 0.085 },
    shoulder: { p: centroid(humerus.pos, (x, y) => y > humerus.box[4] - 0.04), r: 0.08 },
    elbow: { p: centroid(humerus.pos, (x, y) => y < humerus.box[1] + 0.03), r: 0.06 },
    wrist: { p: centroid(radius.pos, (x, y) => y < radius.box[1] + 0.025), r: 0.045 },
    hand: { p: avg(parts.filter((x) => x.side === s && /metacarpal bone/i.test(x.name)).map((x) => center(x.box))), r: 0.09 },
    foot: { p: avg(parts.filter((x) => x.side === s && /metatarsal bone/i.test(x.name)).map((x) => center(x.box))), r: 0.09 },
  };
  for (const [region, { p, r }] of Object.entries(joints)) {
    const key = `${region}_${s}`;
    anchors[key] = p;
    for (const part of parts) {
      if (part.kind === "skin" || part.side !== s) continue;
      const b = part.box;
      // Quick reject by bounding box before checking vertices.
      if (p[0] < b[0] - r || p[0] > b[3] + r || p[1] < b[1] - r || p[1] > b[4] + r || p[2] < b[2] - r || p[2] > b[5] + r) continue;
      if (minDistance(part.pos, p) <= r) tag(part, key);
    }
  }
}

// Unpaired regions by anatomical name.
const atlasY = center(byName("Atlas").box)[1];
const NAMED = {
  heart: (p) => p.systems.includes("circulatory") && p.systems.includes("organs"),
  lungs: (p) => p.kind === "lung",
  liver: (p) => p.kind === "liver",
  stomach: (p) => p.kind === "stomach",
  pancreas: (p) => p.kind === "pancreas",
  kidneys: (p) => p.kind === "kidney" && /kidney/i.test(p.name),
  abdomen: (p) =>
    ["stomach", "gut", "colon", "liver", "spleen", "pancreas", "kidney"].includes(p.kind) ||
    /(rectus abdominis|external oblique|internal oblique|transversus abdominis|linea alba)/i.test(p.name),
  chest: (p) => /(\brib\b|costal cartilage|sternum|manubrium|xiphoid|thoracic vertebra|pectoralis|intercostal muscle|serratus anterior)/i.test(p.name),
  back: (p) => /(lumbar|sacrum|coccyx|iliocostalis lumborum|longissimus thoracis|multifidus|quadratus lumborum|spinalis thoracis)/i.test(p.name),
  neck: (p) => /(cervical|^atlas$|^axis$|sternocleidomastoid|scalen|platysma|splenius|longus colli|longus capitis|thyroid|larynx|carotid|jugular|hyoid|levator scapulae|descending part of (left|right) trapezius)/i.test(p.name),
  head: (p) => p.kind !== "skin" && ["skeletal", "muscular"].includes(p.systems[0]) && center(p.box)[1] > atlasY - 0.01 && !/cervical|atlas|axis/i.test(p.name),
  brain: (p) => p.kind === "brain" && center(p.box)[1] > atlasY,
};
for (const [region, match] of Object.entries(NAMED)) {
  const members = parts.filter(match);
  if (!members.length) throw new Error(`No parts for region ${region}`);
  members.forEach((p) => tag(p, region));
  // Camera target: centroid of the members' vertices.
  let sum = [0, 0, 0];
  let n = 0;
  for (const m of members) {
    for (let i = 0; i < m.pos.length; i += 3) {
      sum = [sum[0] + m.pos[i], sum[1] + m.pos[i + 1], sum[2] + m.pos[i + 2]];
      n++;
    }
  }
  anchors[region] = sum.map((v) => v / n);
}

// Framing for the whole body and for the torso organs.
anchors.body = center(parts.find((p) => p.kind === "skin").box);
anchors.torso = avg([anchors.heart, anchors.abdomen]);

// ---------- Simplify ----------

// Merge vertices that share a position so the simplifier can collapse edges across seams.
function weld(p) {
  const map = new Map();
  const remap = new Uint32Array(p.pos.length / 3);
  const pos = [];
  for (let v = 0; v < remap.length; v++) {
    const key = `${Math.round(p.pos[v * 3] * 1e5)},${Math.round(p.pos[v * 3 + 1] * 1e5)},${Math.round(p.pos[v * 3 + 2] * 1e5)}`;
    let n = map.get(key);
    if (n === undefined) {
      n = pos.length / 3;
      map.set(key, n);
      pos.push(p.pos[v * 3], p.pos[v * 3 + 1], p.pos[v * 3 + 2]);
    }
    remap[v] = n;
  }
  const idx = [];
  for (let i = 0; i < p.idx.length; i += 3) {
    const [a, b, c] = [remap[p.idx[i]], remap[p.idx[i + 1]], remap[p.idx[i + 2]]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { ...p, pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

function simplify(raw) {
  const p = weld(raw);
  const keep = KEEP[p.kind] ?? KEEP_ORGAN;
  const target = Math.max(3 * 24, Math.floor((p.idx.length / 3) * keep) * 3);
  if (target >= p.idx.length) return p;
  // An error cap keeps shapes intact; meshes that can't reach the target stay a little denser.
  const [idx] = MeshoptSimplifier.simplify(p.idx, p.pos, 3, target, p.kind === "muscle" ? 0.12 : 0.05);
  // Drop vertices no longer used.
  const remap = new Int32Array(p.pos.length / 3).fill(-1);
  const pos = [];
  const out = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    let v = remap[idx[i]];
    if (v < 0) {
      v = remap[idx[i]] = pos.length / 3;
      pos.push(p.pos[idx[i] * 3], p.pos[idx[i] * 3 + 1], p.pos[idx[i] * 3 + 2]);
    }
    out[i] = v;
  }
  return { ...p, pos: new Float32Array(pos), idx: out };
}

function vertexNormals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) n[v + k] += fn[k];
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}

// ---------- Merge parts that look and highlight the same, then write the GLB ----------

const groups = new Map();
let tris = 0;
const stats = {};
for (const raw of parts) {
  const p = simplify(raw);
  tris += p.idx.length / 3;
  stats[p.kind] ??= [0, 0];
  stats[p.kind][0] += raw.idx.length / 3;
  stats[p.kind][1] += p.idx.length / 3;
  const regs = [...(regions.get(raw) ?? [])].sort();
  const key = `${p.systems.join("+")}|${p.color}|${regs.join(",")}`;
  if (!groups.has(key)) groups.set(key, { systems: p.systems, color: p.color, regions: regs, kind: p.kind, items: [] });
  groups.get(key).items.push(p);
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("body");
const materials = new Map();
for (const [key, g] of groups) {
  const vcount = g.items.reduce((s, p) => s + p.pos.length / 3, 0);
  const icount = g.items.reduce((s, p) => s + p.idx.length, 0);
  const pos = new Float32Array(vcount * 3);
  const idx = new Uint32Array(icount);
  let vo = 0;
  let io = 0;
  for (const p of g.items) {
    pos.set(p.pos, vo * 3);
    for (let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo;
    vo += p.pos.length / 3;
    io += p.idx.length;
  }
  if (!materials.has(g.color)) {
    const [r, gg, b] = [1, 3, 5].map((i) => parseInt(g.color.slice(i, i + 2), 16) / 255);
    materials.set(g.color, doc.createMaterial(g.color).setBaseColorFactor([r ** 2.2, gg ** 2.2, b ** 2.2, 1]).setRoughnessFactor(0.6));
  }
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(vertexNormals(pos, idx)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(idx).setBuffer(buffer))
    .setMaterial(materials.get(g.color));
  const mesh = doc.createMesh(key).addPrimitive(prim);
  scene.addChild(doc.createNode(key).setMesh(mesh).setExtras({ systems: g.systems, regions: g.regions, kind: g.kind }));
}
doc.getRoot().setDefaultScene(scene);
doc.getRoot().getAsset().copyright =
  "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International";

await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
fs.mkdirSync(path.dirname(OUT_GLB), { recursive: true });
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
await io.write(OUT_GLB, doc);

const round = (v) => Math.round(v * 1000) / 1000;
fs.writeFileSync(
  OUT_ANCHORS,
  `// Generated by scripts/build-anatomy.mjs from BodyParts3D. Do not edit.\n` +
    `// Region centers in meters on the body model (y up, front +z, patient's left +x).\n\n` +
    `export const ANCHORS: Record<string, [number, number, number]> = ${JSON.stringify(
      Object.fromEntries(Object.entries(anchors).map(([k, v]) => [k, v.map(round)])),
      null,
      2,
    )};\n`,
);

for (const [k, [a, b]] of Object.entries(stats)) console.log(`  ${k}: ${Math.round(a / 1000)}k -> ${Math.round(b / 1000)}k triangles`);
console.log(`${groups.size} meshes, ${Math.round(tris / 1000)}k triangles, ${(fs.statSync(OUT_GLB).size / 1e6).toFixed(1)} MB`);
