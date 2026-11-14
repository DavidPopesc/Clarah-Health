# Clara

**Answers about your health, from your own data.** EmoryHacks 2026 · Healthcare track

Clara is an AI health companion. It reads a patient's MyChart (Epic) record and Fitbit data, explains their numbers in plain language, and answers "is it safe for me to…?" questions, like fasting for Ramadan on diabetes medicine or taking an herbal supplement, using the patient's own medications and trusted, cited sources.

## Demo flow

1. **Connect:** link MyChart (Epic sandbox, read-only) and Fitbit, or use the built-in demo patient.
2. **Today:** blood pressure on the AHA scale, resting heart rate, A1c trend, and medications, each explained.
3. **Ask:** try *"Ramadan starts in February. Is it okay for me to fast with my diabetes meds?"* Clara looks up the medications (glipizide raises the risk of low blood sugar), cites the IDF-DAR guidelines, says when to break the fast, and lists questions for the doctor.
4. **3D body:** try *"I sprained my left ankle. Can I take ibuprofen for the pain?"* A 3D body slides up and zooms to the left ankle, with the ligaments lit. The Today page also shows the organs behind your numbers in 3D.
5. **Red flag:** try *"My BP is 184/122 and I have a bad headache."* Clara skips the AI and shows a full-screen "Call 911".

## Safety design

- **Emergency screen comes before the AI.** `src/lib/red-flags.ts` checks every message with fixed rules (severe BP with symptoms, stroke and heart attack signs, low blood sugar, crisis language → 988). A match shows an escalation screen, and the model is never called.
- **Grounded safety answers.** The agent must call `lookup_safety_reference`, which returns curated cards from NIH NCCIH, FDA, AHA, ADA and IDF-DAR (`src/lib/safety-references.ts`). If nothing matches, it says it couldn't verify and points to the pharmacist. Sources are shown under each answer.
- **No medication changes.** Clara turns dose decisions into questions for the care team.
- **De-identified.** The model gets age, not birth date, and never the name or MRN. Those are also redacted from the user's own messages.
- **Read-only, scoped access** to Epic and Fitbit, with one-tap disconnect.

## How Clara uses the model

Clara talks to any OpenAI-compatible Chat Completions endpoint. By default that's [Pulpo](https://pulpo.baby) with `glm-5.3-flash`, a fast, inexpensive model; change `OPENAI_BASE_URL` and `OPENAI_MODEL` to swap providers or models.

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
cp .env.example .env.local   # add OPENAI_API_KEY at minimum
npm run dev                  # http://localhost:3000
npm test                     # red-flag and body-detection tests
```

Only `OPENAI_API_KEY` is required. Without Epic or Fitbit credentials, Clara uses a synthetic demo patient ("Amira", type 2 diabetes on metformin, glipizide and atorvastatin).

**Epic sandbox:** create a non-production app at [fhir.epic.com](https://fhir.epic.com) as a patient-facing app. Select the R4 APIs Patient.Read, MedicationRequest.Search, Condition.Search and Observation.Search, and set the redirect URI to `http://localhost:3000/api/auth/epic/callback`. Sign in with one of Epic's [sandbox test patients](https://fhir.epic.com/Documentation?docId=testpatients). New client IDs can take a while to activate.

**Fitbit:** register a "Personal" app at [dev.fitbit.com](https://dev.fitbit.com/apps) with the callback `http://localhost:3000/api/auth/fitbit/callback`.

## Hackathon caveats

- OAuth tokens are kept in httpOnly cookies. Production would need an encrypted server-side store, token refresh, a BAA with every vendor, and HIPAA-compliant hosting.
- The reference library is small and curated for the demo cases. Expand it before claiming coverage.
- Clara is not a medical device and does not give medical advice.
