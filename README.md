# Clarah Health

**Answers about your health, from your own data.** EmoryHacks 2026 · Healthcare track

Clarah is an AI health companion. It reads a patient's MyChart (Epic) record and Fitbit data, explains their numbers in plain language, and answers "is it safe for me to…?" questions, like fasting for Ramadan on diabetes medicine or taking an herbal supplement, using the patient's own medications and trusted, cited sources.

## Demo flow

1. **Home:** upload a PDF, link MyChart (Epic sandbox, read-only) or link Fitbit from the top of the page; linked accounts show as connected. Without them, Clarah uses a built-in demo patient.
2. **What needs your attention:** instead of a wall of numbers, the home page lists the few things worth acting on (rising blood pressure, A1c above goal, low-blood-sugar risk from glipizide, short sleep), each with why it matters, what to do, an "Ask Clarah" shortcut and a 3D view. Normal results collapse into "Looking good".
3. **Upload a document:** tap "Try a sample lab report" (or upload any lab or visit PDF). Clarah compares it with your history and explains it in plain English: urine protein is new and high, A1c improved from 7.4 to 7.1, LDL rose from 96 to 108, and the doctor may start lisinopril. Every finding quotes the original line with its page number, and tapping it opens the PDF at that page.
4. **Ask:** try *"Ramadan starts in February. Is it okay for me to fast with my diabetes meds?"* Clarah looks up the medications (glipizide raises the risk of low blood sugar), cites the IDF-DAR guidelines, says when to break the fast, and lists questions for the doctor.
5. **3D body:** try *"I sprained my left ankle. Can I take ibuprofen for the pain?"* A 3D body built from real anatomy data slides up and zooms to the left ankle, with the bones, tendons and muscles around it lit. The Today page also shows the organs behind your numbers in 3D.
6. **Red flag:** try *"My BP is 184/122 and I have a bad headache."* Clarah skips the AI and shows a full-screen "Call 911".
7. **Visit recap:** on **Overview** (the page Clarah opens on), tap "Hear a sample visit" (or, as the care team, "Record a visit"). Clarah turns the doctor–patient conversation into plain English, ties it to the record (A1c 7.4 → 7.1, blood pressure trend), and reads it aloud. Tap "Show transcript" to read along, copy or download it.

## Health library (Typesense)

The library indexes the Markdown references in `data/knowledge/upload/` as searchable documents and short passages. Search supports spelling tolerance, live prefixes, medical and everyday synonyms, category counts, highlighting, and keyword plus vector ranking. Typesense generates embeddings locally with `ts/all-MiniLM-L12-v2`.

Start a Typesense server, then set `TYPESENSE_HOST`, `TYPESENSE_PORT` (default `443`), `TYPESENSE_PROTOCOL` (default `https`), and `TYPESENSE_ADMIN_KEY` for indexing. Set `TYPESENSE_SEARCH_KEY` to a key allowed to search and retrieve documents for the app; it falls back to the admin key for local development. Both keys stay server side. For a local server on port 8108, use `TYPESENSE_HOST=localhost`, `TYPESENSE_PORT=8108`, and `TYPESENSE_PROTOCOL=http`.

```bash
node scripts/knowledge/index_typesense.mjs --reset
# If the server cannot load the embedding model:
node scripts/knowledge/index_typesense.mjs --reset --no-embed
# An alternate data folder can be passed as the positional argument.
```

Then open `/library`. Without Typesense configuration, the page shows a setup message.

## Demo and live mode

Clarah opens in **demo mode** with made-up patients (none are real people), each with a full record, a week of wearable data, a sample visit and their own suggested questions. Switch from the **Demo/Live bar** at the top of every page, or from **Sources → Whose data is shown**, which tells each patient's story. Saved visits and documents are kept apart per patient on the device.

| Patient | Main issue | Also in the record |
|---|---|---|
| Amira Haddad, 52 | Type 2 diabetes | High cholesterol, ADHD, rising blood pressure, low-blood-sugar risk; asking about Ramadan fasting |
| Grace Okafor, 47 | Breast cancer in chemotherapy | Low neutrophils, anemia, nausea, neuropathy, anxiety |
| Marcus Bell, 34 | PTSD (Army veteran) | Depression, nightmares and short sleep, back pain, at-risk drinking; symptom scores improving |
| Sofia Ramirez, 31 | Pregnancy, 28 weeks | Gestational diabetes, iron-deficiency anemia, rising blood pressure |

**Live mode** shows only what you link (MyChart, Fitbit), with no filler data. Shortcuts for presenting: `/api/demo?patient=grace` (or `amira`, `marcus`, `sofia`) and `/api/demo?mode=live`. Patients are defined in `src/lib/demo-patients.ts`.

## Visit recaps

- **Care team records, patient listens.** In the **Care team** tab (`/care-team`) the doctor or nurse confirms the patient's consent and records the conversation (up to 30 minutes), or types or pastes it. They can correct the transcript before Clarah explains it.
- **Transcription.** The browser converts the recording to 16 kHz mono WAV in 4-minute chunks (`src/lib/wav.ts`); `/api/visits/transcribe` sends each to Gemini (`gemini-3.5-flash`) for a word-for-word transcript labelled Clinician / Patient. The audio isn't stored.
- **Explanation.** `/api/visits` removes the patient's name and ID numbers, pairs the transcript with their record, and asks the model for a spoken script plus medicine changes, next steps, warning signs, and a glossary (`src/lib/visits.ts`). It may only relay what the clinician said; a medicine change is dropped unless that medicine was actually named in the conversation (`src/lib/visit-verify.ts`).
- **Clarah's voice.** The player reads the script one paragraph at a time with Gemini text-to-speech (`gemini-3.8-flash-tts`, voice "Sulafat") through `/api/visits/speech`, fetching the next paragraph while one plays and caching the audio on the device. It's one-way speech, not a conversation. If the AI voice is unavailable, the device's own voice reads instead.
- **Device only.** Recaps, transcripts and voice audio are kept in the browser's IndexedDB, like uploaded documents.
- Recording and the AI voice need `GEMINI_API_KEY`; the backup provider has no audio. `GEMINI_TRANSCRIBE_MODEL`, `GEMINI_TTS_MODEL` and `GEMINI_TTS_VOICE` are optional overrides.

## Clarah Steady (wearable)

Clarah Steady is a waist- or leg-worn sensor on an Arduino UNO Q ([`hardware/steady/`](hardware/steady/README.md)) that watches how steadily you walk. It runs on its own, and every 30 seconds (and right away when an alarm starts) it sends its reading to Clarah at `POST /api/steady/ingest` with a shared token. The latest reading per device is kept in Typesense; `/steady` shows it, and Clarah's chat reads it through `get_mobility_summary`.

- **Fall prevention mode** (at the waist): a 0–100 steadiness score from trunk sway and jolt, your usual level, a two-week trend and fall risk. As balance slips, the device buzzes and Clarah warns you, always with: *"If you feel your walking is getting worse, call your doctor."*
- **Spot check on every 10-second stretch:** if the last 10 seconds of walking are much less steady than usual (steadiness 80 or lower, 8+ points below your usual, or the trunk swaying 25° or more), the device beeps and a warning pops up on `/steady` right away, at most every 30 seconds.
- **Prosthetic mode** (on a prosthetic leg): hours worn, walking minutes and bouts, stumbles and steadiness per day, summed up as *adapting*, *still adjusting* or *struggling* (the fit may need adjusting), for the patient's prosthetist.
- **Falls, in every mode:** after a fall the device counts down 30 seconds. After a **hard fall** (free fall, then an impact that saturates the sensor on two axes for 3+ samples, then lying still) it counts down only 10 seconds. With no response it alerts the emergency contact. After a hard fall it also shows a **simulated 911 call** on the device dashboard and in Clarah, clearly labelled as a simulation: no real call is placed. Calling 911 is always one tap away for the person.
- **Demo:** Grace's chemotherapy neuropathy, anemia and lorazepam show her steadiness sliding from 84 to 62. Every demo patient can preview prosthetic mode, and "Preview the hard-fall alert" shows the emergency flow without the device.
- **Setup:** set `STEADY_INGEST_TOKEN` (the same value goes in `hardware/steady/.env.steady`, which `deploy.sh` passes to the board), and `TYPESENSE_STEADY_HOST` / `TYPESENSE_STEADY_KEY` (a key scoped to the `steady_devices` collection). Without a store, readings are kept in memory for local development.

## Safety design

- **Emergency screen comes before the AI.** `src/lib/red-flags.ts` checks every message with fixed rules (severe BP with symptoms, stroke and heart attack signs, low blood sugar, crisis language → 988). A match shows an escalation screen, and the model is never called.
- **Grounded safety answers.** The agent must call `lookup_safety_reference`, which returns curated cards from NIH NCCIH, FDA, AHA, ADA and IDF-DAR (`src/lib/safety-references.ts`). If nothing matches, it says it couldn't verify and points to the pharmacist. Sources are shown under each answer.
- **No medication changes.** Clarah turns dose decisions into questions for the care team.
- **De-identified.** The model gets age, not birth date, and never the name or MRN. Those are also redacted from the user's own messages.
- **Read-only, scoped access** to Epic and Fitbit, with one-tap disconnect.

## Document summaries

- **The PDF stays on the device.** The browser extracts the text (`unpdf`) and keeps the file and summary in IndexedDB. Only the text goes to `/api/documents`, which stores nothing.
- **Identifiers are removed first** (labelled names, dates of birth, MRNs, phone numbers, emails), on a best-effort basis.
- **References are checked, not trusted.** The model must quote the exact line behind every finding. `src/lib/doc-verify.ts` drops any quote that doesn't appear in the PDF text and corrects wrong page numbers.
- Scanned (image-only) PDFs can't be read yet.
- **Test documents** for the synthetic demo patient are in `public/samples/test/` (regenerate with `node scripts/make-test-pdfs.mjs`): an urgent care visit and X-ray for a sprained ankle, annual labs with low B12 and vitamin D, an echocardiogram, a 3-month follow-up where things improved, a store receipt (should be recognized as not medical), and a scanned page with no text (should show the can't-read message).

## How Clarah uses the model

Clarah answers with her **fine-tuned Gemini 3.5 Flash on Vertex AI** (see [How Clarah was trained](#how-clarah-was-trained)) when `VERTEX_ENDPOINT` and `GOOGLE_SERVICE_ACCOUNT_KEY` are set (a service account with the Agent Platform User role; the key is minted into short-lived tokens in `src/lib/vertex-auth.ts`). If the tuned model fails, base **Gemini on Vertex** answers (`VERTEX_MODEL`, default `google/gemini-3.5-flash-lite`). Vertex bills to Google Cloud credit. Next comes the **Gemini API** (`gemini-3.5-flash-lite` through Google's OpenAI-compatible endpoint). If Gemini errors, runs out of quota or credit, or doesn't respond within 15 seconds, the same question goes to the **backup**: any OpenAI-compatible endpoint, by default [Pulpo](https://pulpo.baby) with `glm-5.3-flash`. Answers stream either way. Set `GEMINI_API_KEY` and/or `OPENAI_API_KEY`; `GEMINI_MODEL`, `OPENAI_BASE_URL` and `OPENAI_MODEL` are optional overrides.

- **Function calling as an agent loop.** The model decides which parts of the record it needs (medications, labs, vitals, wearable data) and calls typed tools. The server runs them and returns de-identified results, looping until the model has what it needs.
- **Grounded answers.** For any "is it safe" question, the model has to call `lookup_safety_reference`. For what a medicine, test, condition or supplement is, it calls `search_medical_library`, which searches 12,420 NIH and FDA passages in Typesense. The sources it actually used are shown under the answer.
- **3D focus.** When a question is about a body part, the model calls `show_body_focus` to pick the region and body system for the 3D viewer. A keyword match is the fallback.

## How Clarah was trained

We fine-tuned **Gemini 3.5 Flash on Vertex AI** to answer the way a good nurse educator would: only from trusted sources, in plain language, in as few words as it takes. The fine-tune teaches behavior, not facts; the facts come from the Typesense health library at answer time.

<p align="center"><a href="docs/fine-tuning/results-sheet.pdf"><img src="docs/fine-tuning/results-sheet.png" alt="Fine-tuned Clarah results: 100% fully grounded answers, 11x more answers at a patient-friendly reading level, 2.2x faster to read, 100% safe" width="760"></a></p>

**Results on 26 held-out patient questions** (higher is better). Both models got the same instructions and the same retrieved sources; groundedness and safety were graded blind by Gemini 3.1 Pro.

| | Base Gemini 3.5 Flash | **Fine-tuned Clarah** |
|---|---:|---:|
| Answers fully grounded in trusted sources | 85% | **100%** |
| Answers at a patient-friendly reading level (≤ 8th grade) | 8% | **88%** |
| Answers a patient can read in under 30 seconds | 4% | **100%** |
| Reading ease (Flesch, 0–100) | 65 | **73** |
| Grounding score per 100 words | 3.3 | **7.6** |
| Judged safe (no medication changes, 911 first) | 100% | **100%** |

**Shorter is the feature.** Clarah explains the same thing in about 66 words instead of 142, at a 6th–7th grade reading level, so a worried patient gets the answer, the warning signs and the questions for their doctor in about 20 seconds.

```mermaid
flowchart LR
  A["1,579 NIH & FDA documents"] --> B["Typesense index<br/>12,420 passages"]
  B --> C["Gemini 3.1 Pro writes<br/>445 grounded examples"]
  C --> D["Automatic filters<br/>reading level · length<br/>no med changes · 911 first"]
  D --> E["321 examples"]
  E --> F["Vertex AI supervised tuning<br/>Gemini 3.5 Flash · 3 epochs"]
  F --> G["clarah-v1 endpoint<br/>live at clarah.health"]
  B -. "search_medical_library at answer time" .-> G
```

- **Data:** each example pairs real library passages and a synthetic patient record with a question and the ideal answer. Scenarios cover lab results, medications, herbs and supplements, conditions, questions the sources can't answer (say so), requests to stop or change a medicine (turn them into questions for the doctor), religious and cultural practices, and emergencies (911 first). See [`data/finetune/examples.jsonl`](data/finetune/examples.jsonl).
- **Evidence:** every base and tuned answer with its scores is in [`data/finetune/eval_results.json`](data/finetune/eval_results.json); the one-page summary is [`docs/fine-tuning/results-sheet.pdf`](docs/fine-tuning/results-sheet.pdf).
- **Reproduce:** with `gcloud` signed in to a project with Vertex AI,
  ```bash
  python3 -I scripts/finetune/build_dataset.py   # generate and filter the dataset
  python3 -I scripts/finetune/tune.py start       # upload and start the tuning job
  python3 -I scripts/finetune/tune.py status      # prints the tuned endpoint when done
  python3 -I scripts/finetune/evaluate.py         # base vs tuned comparison
  ```
  Then set `VERTEX_ENDPOINT` to the endpoint it prints.

## Architecture

```
Next.js 16 (App Router)
├─ /            Overview: visit recaps Clarah reads aloud
├─ /care-team   Care team: record a visit (with consent) for Clarah to explain
├─ /profile     My profile: health focus areas, documents, results, medications
├─ /connections Sources (Epic + Fitbit OAuth with PKCE, demo fallback)
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

Only one AI key is required: `GEMINI_API_KEY`, `OPENAI_API_KEY`, or both for automatic fallback. Without Epic or Fitbit credentials, Clarah uses a synthetic demo patient ("Amira", type 2 diabetes on metformin, glipizide and atorvastatin).

**Epic sandbox:** create a non-production app at [fhir.epic.com](https://fhir.epic.com) as a patient-facing app. Select the R4 APIs Patient.Read, MedicationRequest.Search, Condition.Search and Observation.Search, and add the redirect URIs `http://localhost:3000/callback` and `https://<your-domain>/callback` (they must match exactly). Put the **Non-Production Client ID** in `EPIC_CLIENT_ID`. Sign in with one of Epic's [sandbox test patients](https://fhir.epic.com/Documentation?docId=testpatients), for example Camila Lopez (`fhircamila` / `epicepic1`). New client IDs can take a while to activate.

**Fitbit:** register a "Personal" app at [dev.fitbit.com](https://dev.fitbit.com/apps) with the callback `http://localhost:3000/api/auth/fitbit/callback`.

## 3D anatomy

The body model is [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/), real human anatomy meshes from the Database Center for Life Science. `scripts/build-anatomy.mjs` sorts about 2,100 parts into bones, muscles, heart and vessels, nerves, and organs; tags each part with the regions it belongs to (by distance to landmarks like the talus or patella, or by name for organs); simplifies the meshes; and writes `public/anatomy/body.glb` (about 3 MB, meshopt-compressed) plus `src/components/anatomy/anchors.generated.ts`. To rebuild it, download `isa_BP3D_4.0_obj_99.zip` and `isa_inclusion_relation_list.txt` from the BodyParts3D download page, unzip them into one folder, and run `npm run build:anatomy -- <folder>`.

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

## Hackathon caveats

- OAuth tokens are kept in httpOnly cookies. Production would need an encrypted server-side store, token refresh, a BAA with every vendor, and HIPAA-compliant hosting.
- The reference library is small and curated for the demo cases. Expand it before claiming coverage.
- Clarah is not a medical device and does not give medical advice.
