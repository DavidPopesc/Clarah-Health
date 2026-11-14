# Clara redesign brief (shared by all 10 designers)

Clara is an AI health companion built for EmoryHacks 2026 (Next.js app in the parent folder). Its current UI looks "vibecoded": generic AI-generated aesthetics. Your job is to design a fresh UI/UX from scratch as a standalone, clickable HTML prototype.

## What to read (content and behaviour only)
Read these to learn WHAT the app shows and does, never how it looks:
- `../README.md` (demo flow, features, safety design)
- `../src/lib/demo-data.ts`, `../src/lib/attention.ts`, `../src/lib/types.ts`, `../src/lib/red-flags.ts`, `../src/lib/safety-references.ts`
- Page/component files under `../src/app` and `../src/components` ONLY to see which screens, data and actions exist.

## Hard rules
- **Do not take inspiration from any previous design.** Do NOT open `../src/app/globals.css`, do not copy class names, colours, layouts or visual ideas from the existing components, do not look at other folders inside `designs/`, and do not look at any screenshots/images on disk. Start from a blank page.
- Do NOT modify anything outside your own folder `designs/<your-folder>/`.
- Output: `designs/<your-folder>/index.html`, fully self-contained (inline CSS/JS; Google Fonts or other CDN fonts are OK; no build step; no frameworks required). It must open directly from disk.
- Also write `designs/<your-folder>/NOTES.md`: 5–10 lines on the concept, type/colour choices and the key UX changes.

## What the prototype must cover (use the real demo content: patient "Amira", T2 diabetes, metformin/glipizide/atorvastatin, etc.)
1. **Home**: connect MyChart / Fitbit / upload a PDF (with "try a sample lab report"); "What needs your attention" list (rising BP, A1c above goal, low-blood-sugar risk from glipizide, short sleep) with why it matters / what to do / Ask Clara; "Looking good" collapsed normals.
2. **Document summary**: the sample lab report explained (urine protein new and high, A1c 7.4→7.1, LDL 96→108, possible lisinopril), each finding quoting the source line with page number.
3. **Ask**: a chat showing the Ramadan-fasting answer with cited sources (IDF-DAR etc.), when to break the fast, and questions for the doctor. Include a placeholder spot where the 3D body viewer would appear (e.g. for the sprained-ankle question); a tasteful static illustration or placeholder is fine.
4. **Today**: vitals/labs/wearable summary.
5. **Red-flag escalation**: the "Call 911" screen for "BP 184/122 + bad headache" (and 988 for crisis). Make it reachable in the prototype.
Navigation between screens should work (simple JS tab/route switching is fine). Mobile-first, but should look good on desktop too.

## Avoid the "vibecoded" tells
No purple/indigo-to-pink gradients, no glassmorphism/frosted blur, no glowing orbs or blobs, no sparkle/✨ "AI" icons, no emoji as icons, no default Inter/system-font-everything, no every-element-is-a-rounded-card-with-soft-shadow, no gradient text, no generic hero with "Your health, reimagined". Write copy like a careful human product designer: plain, specific, calm. Make deliberate choices about type scale, spacing, hierarchy and colour, and commit to your assigned direction.

Accessibility matters for a health app: real contrast, readable sizes, visible focus states.
