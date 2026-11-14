# Clara

**Answers about your health, from your own data.** EmoryHacks 2026 · Healthcare track

Clara is an AI health companion. It reads a patient's MyChart (Epic) record and Fitbit data, explains their numbers in plain language, and answers "is it safe for me to…?" questions, like fasting for Ramadan on diabetes medicine or taking an herbal supplement, using the patient's own medications and trusted, cited sources.

## Demo flow

1. **Home:** upload a PDF, link MyChart (Epic sandbox, read-only) or link Fitbit from the top of the page; linked accounts show as connected. Without them, Clara uses a built-in demo patient.
2. **What needs your attention:** instead of a wall of numbers, the home page lists the few things worth acting on (rising blood pressure, A1c above goal, low-blood-sugar risk from glipizide, short sleep), each with why it matters, what to do, an "Ask Clara" shortcut and a 3D view. Normal results collapse into "Looking good".
3. **Upload a document:** tap "Try a sample lab report" (or upload any lab or visit PDF). Clara compares it with your history and explains it in plain English: urine protein is new and high, A1c improved from 7.4 to 7.1, LDL rose from 96 to 108, and the doctor may start lisinopril. Every finding quotes the original line with its page number, and tapping it opens the PDF at that page.
4. **Ask:** try *"Ramadan starts in February. Is it okay for me to fast with my diabetes meds?"* Clara looks up the medications (glipizide raises the risk of low blood sugar), cites the IDF-DAR guidelines, says when to break the fast, and lists questions for the doctor.
5. **3D body:** try *"I sprained my left ankle. Can I take ibuprofen for the pain?"* A 3D body built from real anatomy data slides up and zooms to the left ankle, with the bones, tendons and muscles around it lit. The Today page also shows the organs behind your numbers in 3D.
6. **Red flag:** try *"My BP is 184/122 and I have a bad headache."* Clara skips the AI and shows a full-screen "Call 911".
7. **Visit recap:** open **Visits** and tap "Hear a sample visit" (or, as the care team, "Record a visit"). Clara turns the doctor–patient conversation into plain English, ties it to the record (A1c 7.4 → 7.1, blood pressure trend), and reads it aloud. Tap "Show transcript" to read along, copy or download it.

## Visit recaps

- **Care team records, patient listens.** On `/visits/new` the doctor or nurse confirms the patient's consent and records the conversation (up to 30 minutes), or types or pastes it. They can correct the transcript before Clara explains it.
- **Transcription.** The browser converts the recording to 16 kHz mono WAV in 4-minute chunks (`src/lib/wav.ts`); `/api/visits/transcribe` sends each to Gemini (`gemini-3.5-flash`) for a word-for-word transcript labelled Clinician / Patient. The audio isn't stored.
- **Explanation.** `/api/visits` removes the patient's name and ID numbers, pairs the transcript with their record, and asks the model for a spoken script plus medicine changes, next steps, warning signs, and a glossary (`src/lib/visits.ts`). It may only relay what the clinician said; a medicine change is dropped unless that medicine was actually named in the conversation (`src/lib/visit-verify.ts`).
- **Clara's voice.** The player reads the script one paragraph at a time with Gemini text-to-speech (`gemini-3.8-flash-tts`, voice "Sulafat") through `/api/visits/speech`, fetching the next paragraph while one plays and caching the audio on the device. It's one-way speech, not a conversation. If the AI voice is unavailable, the device's own voice reads instead.
- **Device only.** Recaps, transcripts and voice audio are kept in the browser's IndexedDB, like uploaded documents.
- Recording and the AI voice need `GEMINI_API_KEY`; the backup provider has no audio. `GEMINI_TRANSCRIBE_MODEL`, `GEMINI_TTS_MODEL` and `GEMINI_TTS_VOICE` are optional overrides.

## Safety design

- **Emergency screen comes before the AI.** `src/lib/red-flags.ts` checks every message with fixed rules (severe BP with symptoms, stroke and heart attack signs, low blood sugar, crisis language → 988). A match shows an escalation screen, and the model is never called.
- **Grounded safety answers.** The agent must call `lookup_safety_reference`, which returns curated cards from NIH NCCIH, FDA, AHA, ADA and IDF-DAR (`src/lib/safety-references.ts`). If nothing matches, it says it couldn't verify and points to the pharmacist. Sources are shown under each answer.
- **No medication changes.** Clara turns dose decisions into questions for the care team.
- **De-identified.** The model gets age, not birth date, and never the name or MRN. Those are also redacted from the user's own messages.
- **Read-only, scoped access** to Epic and Fitbit, with one-tap disconnect.

## Document summaries

- **The PDF stays on the device.** The browser extracts the text (`unpdf`) and keeps the file and summary in IndexedDB. Only the text goes to `/api/documents`, which stores nothing.
- **Identifiers are removed first** (labelled names, dates of birth, MRNs, phone numbers, emails), on a best-effort basis.
- **References are checked, not trusted.** The model must quote the exact line behind every finding. `src/lib/doc-verify.ts` drops any quote that doesn't appear in the PDF text and corrects wrong page numbers.
- Scanned (image-only) PDFs can't be read yet.
- **Test documents** for the synthetic demo patient are in `public/samples/test/` (regenerate with `node scripts/make-test-pdfs.mjs`): an urgent care visit and X-ray for a sprained ankle, annual labs with low B12 and vitamin D, an echocardiogram, a 3-month follow-up where things improved, a store receipt (should be recognized as not medical), and a scanned page with no text (should show the can't-read message).

## How Clara uses the model

Clara asks **Gemini** first (`gemini-3.5-flash-lite`, small and fast, through Google's OpenAI-compatible endpoint). If Gemini errors, runs out of quota or credit, or doesn't respond within 15 seconds, the same question goes to the **backup**: any OpenAI-compatible endpoint, by default [Pulpo](https://pulpo.baby) with `glm-5.3-flash`. Answers stream either way. Set `GEMINI_API_KEY` and/or `OPENAI_API_KEY`; `GEMINI_MODEL`, `OPENAI_BASE_URL` and `OPENAI_MODEL` are optional overrides.

- **Function calling as an agent loop.** The model decides which parts of the record it needs (medications, labs, vitals, wearable data) and calls typed tools. The server runs them and returns de-identified results, looping until the model has what it needs.
- **Grounded answers.** For any "is it safe" question, the model has to call `lookup_safety_reference`. The sources it actually used are shown under the answer.
- **3D focus.** When a question is about a body part, the model calls `show_body_focus` to pick the region and body system for the 3D viewer. A keyword match is the fallback.

## Architecture

```
Next.js 16 (App Router)
├─ /            Connect (Epic + Fitbit OAuth with PKCE, demo fallback)
├─ /today       Server-rendered summary from the normalized record
├─ /ask         Chat UI → POST /api/chat
└─ /api/chat    red-flag screen → tool-calling agent (OpenAI-compatible) with tools:
                get_profile, get_medications, get_conditions, get_labs,
                get_vitals, get_wearable_summary, lookup_safety_reference,
                show_body_focus
```

Epic FHIR R4 (`MedicationRequest`, `Condition`, `Observation`) and Fitbit responses are normalized in `src/lib/epic.ts` and `src/lib/fitbit.ts`. If a live call fails, the app falls back to demo data so the demo keeps working.

## Run it

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY and/or OPENAI_API_KEY
npm run dev                  # http://localhost:3000
npm test                     # red-flag and body-detection tests
```

Only one AI key is required: `GEMINI_API_KEY`, `OPENAI_API_KEY`, or both for automatic fallback. Without Epic or Fitbit credentials, Clara uses a synthetic demo patient ("Amira", type 2 diabetes on metformin, glipizide and atorvastatin).

**Epic sandbox:** create a non-production app at [fhir.epic.com](https://fhir.epic.com) as a patient-facing app. Select the R4 APIs Patient.Read, MedicationRequest.Search, Condition.Search and Observation.Search, and set the redirect URI to `http://localhost:3000/api/auth/epic/callback`. Sign in with one of Epic's [sandbox test patients](https://fhir.epic.com/Documentation?docId=testpatients). New client IDs can take a while to activate.

**Fitbit:** register a "Personal" app at [dev.fitbit.com](https://dev.fitbit.com/apps) with the callback `http://localhost:3000/api/auth/fitbit/callback`.

## 3D anatomy

The body model is [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/), real human anatomy meshes from the Database Center for Life Science. `scripts/build-anatomy.mjs` sorts about 2,100 parts into bones, muscles, heart and vessels, nerves, and organs; tags each part with the regions it belongs to (by distance to landmarks like the talus or patella, or by name for organs); simplifies the meshes; and writes `public/anatomy/body.glb` (about 3 MB, meshopt-compressed) plus `src/components/anatomy/anchors.generated.ts`. To rebuild it, download `isa_BP3D_4.0_obj_99.zip` and `isa_inclusion_relation_list.txt` from the BodyParts3D download page, unzip them into one folder, and run `npm run build:anatomy -- <folder>`.

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

## Hackathon caveats

- OAuth tokens are kept in httpOnly cookies. Production would need an encrypted server-side store, token refresh, a BAA with every vendor, and HIPAA-compliant hosting.
- The reference library is small and curated for the demo cases. Expand it before claiming coverage.
- Clara is not a medical device and does not give medical advice.
