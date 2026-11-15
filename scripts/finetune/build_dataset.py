"""Build Clarah's supervised fine-tuning dataset for Gemini on Vertex AI.

The fine-tune teaches behavior, not facts: answer only from retrieved sources, plain
language, no medication changes, respect for cultural practices, emergencies first.
Facts stay in retrieval (Typesense), so every example contains real passages from the
NIH/FDA library in data/knowledge/upload/ plus a synthetic patient profile.

A teacher model (Gemini 3.1 Pro on Vertex) writes a question and the ideal answer for
each example; automatic checks drop answers that break the rules.

Usage (from clara/, after `gcloud auth` with access to the Vertex project):
  python3 -I scripts/finetune/build_dataset.py            # full run
  python3 -I scripts/finetune/build_dataset.py --limit 12 # quick smoke test
Output: data/finetune/{train,validation,eval,rejected}.jsonl
"""

import argparse
import json
import os
import random
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIBRARY = ROOT / "data" / "knowledge" / "upload"
OUT = ROOT / "data" / "finetune"
PROJECT = os.environ.get("VERTEX_PROJECT", "project-bdf7b2a3-72f9-47d2-964")
TEACHER = os.environ.get("TEACHER_MODEL", "gemini-3.1-pro-preview")
SEED = 7

# How many examples of each kind to request. Roughly 10-15% fail the checks.
MIX = {
    "lab": 110,
    "drug": 100,
    "herb": 60,
    "condition": 50,
    "no_source": 45,
    "med_change": 40,
    "cultural": 25,
    "emergency": 15,
}
EVAL_COUNT = 50

# The system instruction the tuned model is trained with. The app sends the same rules.
SYSTEM_INSTRUCTION = """You are Clarah, a health companion that helps one patient understand their own health information in plain language. You explain and inform; you do not diagnose or replace their care team.

Rules:
- Base health facts only on the trusted sources provided (from search_medical_library) and the patient's record. If the sources don't answer the question, say you couldn't find a trusted source for that and suggest asking their pharmacist or doctor. Never invent drug or herb interactions, numbers, or dates.
- Never tell the patient to start, stop, skip, or change a medication, its dose, or its timing. Turn those decisions into specific questions for their care team.
- Respect religious and cultural practices. Help the patient do the practice as safely as possible instead of discouraging it.
- If anything sounds like an emergency, start by telling them to call 911 now.

How to answer:
- Write at about a 6th to 8th grade reading level, warm and direct.
- Start with a one or two sentence direct answer that mentions the specific data you used.
- Then, only if useful, add short sections with bold labels and bullet points, such as **What this means for you**, **Get help right away if**, and **Ask your doctor**.
- Keep it under about 200 words. Do not add a sources list or links; the app shows sources separately."""

PROFILES = [
    {"age": 54, "sex": "female", "conditions": ["Type 2 diabetes", "High blood pressure"],
     "medications": ["metformin 1000 mg twice daily", "glipizide 5 mg once daily", "atorvastatin 20 mg once daily"]},
    {"age": 67, "sex": "male", "conditions": ["Atrial fibrillation", "High cholesterol"],
     "medications": ["apixaban 5 mg twice daily", "metoprolol 25 mg twice daily", "rosuvastatin 10 mg once daily"]},
    {"age": 38, "sex": "female", "conditions": ["Hypothyroidism", "Anxiety"],
     "medications": ["levothyroxine 75 mcg once daily", "sertraline 50 mg once daily"]},
    {"age": 45, "sex": "male", "conditions": ["High blood pressure", "Gout"],
     "medications": ["lisinopril 20 mg once daily", "allopurinol 300 mg once daily"]},
    {"age": 29, "sex": "female", "conditions": ["Asthma"],
     "medications": ["albuterol inhaler as needed", "fluticasone inhaler twice daily"]},
    {"age": 72, "sex": "female", "conditions": ["Heart failure", "Chronic kidney disease"],
     "medications": ["furosemide 40 mg once daily", "carvedilol 12.5 mg twice daily", "spironolactone 25 mg once daily"]},
    {"age": 60, "sex": "male", "conditions": ["Type 2 diabetes", "Depression"],
     "medications": ["insulin glargine 20 units at bedtime", "empagliflozin 10 mg once daily", "bupropion 150 mg once daily"]},
    {"age": 33, "sex": "male", "conditions": [], "medications": []},
]

CATEGORY_BRIEFS = {
    "lab": "The patient asks about a lab test: what it is for, what a result means, or why their doctor ordered it. They may quote a plausible result value in their question.",
    "drug": "The patient asks about one of their medications or a medication their doctor mentioned: what it is for, common side effects, how to take it, or what to watch for.",
    "herb": "The patient asks whether an herb or supplement is safe or useful, often alongside their current medications.",
    "condition": "The patient asks what a condition or diagnosis means for them in everyday terms.",
    "no_source": "The patient asks about the topic named below, but NONE of the sources provided answer it. The ideal answer says plainly that Clarah couldn't find a trusted source for that, does not guess, and suggests asking their pharmacist or doctor. It may mention what the record shows if relevant.",
    "med_change": "The patient wants to stop, skip, double, or change the timing of one of their medications (for example because of a side effect, cost, or feeling better). The ideal answer does not approve or suggest any change, explains what the sources say about why it matters, and turns it into specific questions for their care team. Mention not to stop on their own.",
    "cultural": "The patient asks how to keep a religious or cultural practice (such as fasting for Ramadan, Yom Kippur or Lent, a traditional diet, or a family remedy) while managing their health. The ideal answer is respectful, helps them do it as safely as possible using only the sources, and lists questions for their care team.",
    "emergency": "The patient describes symptoms that could be an emergency (for example chest pain with sweating, sudden weakness on one side, very low blood sugar with confusion, or trouble breathing). The ideal answer starts by telling them to call 911 now, briefly says why, and keeps the rest short.",
}

KIND_FOLDERS = {"lab": "labtests", "drug": "drugs", "herb": "herbs", "condition": "topics",
                "med_change": "drugs", "cultural": "topics", "emergency": "topics", "no_source": None}

# ------------------------------------------------------------------ library


def load_library() -> dict[str, list[dict]]:
    docs: dict[str, list[dict]] = {}
    for folder in ("labtests", "drugs", "herbs", "topics"):
        for path in sorted((LIBRARY / folder).glob("*.md")):
            text = path.read_text()
            head, _, body = text.partition("\n---\n")
            title = head.splitlines()[0].lstrip("# ").strip()
            source = re.search(r"^Source: (.*)$", head, re.M)
            passages = split_passages(body)
            if passages:
                docs.setdefault(folder, []).append({
                    "id": f"{folder}/{path.stem}", "title": title,
                    "source": source.group(1) if source else "", "passages": passages,
                })
    return docs


def split_passages(body: str, limit: int = 900) -> list[str]:
    sections = re.split(r"\n(?=#{2,3} )", body.strip())
    out = []
    for section in sections:
        section = re.sub(r"\n{2,}", "\n", section).strip()
        if len(section) < 120:
            continue
        if len(section) > limit:
            section = section[:limit].rsplit(" ", 1)[0] + " …"
        out.append(section)
    return out


def pick_passages(doc: dict, rng: random.Random, n: int = 2) -> list[str]:
    preferred = [p for p in doc["passages"] if re.search(
        r"results mean|used for|warning|interaction|safety|side effects|who should not|what is", p[:80], re.I)]
    pool = preferred or doc["passages"]
    chosen = rng.sample(pool, min(n, len(pool)))
    return chosen


# ------------------------------------------------------------------ teacher calls

_token = {"value": None, "at": 0.0}
_token_lock = threading.Lock()


def access_token() -> str:
    with _token_lock:
        if not _token["value"] or time.time() - _token["at"] > 1800:
            _token["value"] = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
            _token["at"] = time.time()
        return _token["value"]


def generate(prompt: str, model: str = TEACHER) -> dict:
    url = (f"https://aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/global/"
           f"publishers/google/models/{model}:generateContent")
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.9,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {"question": {"type": "STRING"}, "answer": {"type": "STRING"}},
                "required": ["question", "answer"],
            },
            "thinkingConfig": {"thinkingBudget": 1024},
        },
    }
    for attempt in range(6):
        req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={
            "Authorization": f"Bearer {access_token()}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.load(resp)
            text = data["candidates"][0]["content"]["parts"][-1]["text"]
            return json.loads(text)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 5:
                time.sleep(2 ** attempt * 3)
                continue
            raise RuntimeError(f"{e.code}: {e.read().decode()[:300]}") from e
        except (KeyError, json.JSONDecodeError, TimeoutError) as e:
            if attempt < 5:
                time.sleep(2)
                continue
            raise RuntimeError(f"bad response: {e}") from e
    raise RuntimeError("retries exhausted")


TEACHER_PROMPT = """You are writing training data for Clarah, a patient-facing health assistant.
Write ONE realistic patient question and Clarah's ideal answer.

Scenario: {brief}
{topic_line}
The patient's record:
{profile}

Trusted sources the search returned (the ONLY facts Clarah may use besides the record):
{sources}

Clarah's rules and answer style:
{rules}

Requirements for the question: sound like a real patient typing on a phone (casual, sometimes short, occasionally a small typo). Vary the wording. Do not mention "sources".
Requirements for the answer: follow every rule above exactly. Use only facts from the sources and the record; if the sources don't cover something, say so instead of guessing. No links, no citations list, no medical jargon without a plain explanation. 60 to 200 words.
Format the answer as Markdown with real line breaks: put each bold label (like **Ask your doctor**) on its own line, and each bullet on its own line starting with "- ". Keep sentences short (under 15 words) and prefer everyday words."""


def profile_text(profile: dict) -> str:
    lines = [f"- Age {profile['age']}, {profile['sex']}"]
    lines.append("- Conditions: " + (", ".join(profile["conditions"]) or "none listed"))
    lines.append("- Medications: " + ("; ".join(profile["medications"]) or "none listed"))
    return "\n".join(lines)


def sources_text(sources: list[tuple[str, str, str]]) -> str:
    return "\n\n".join(f"[{i}] {title} ({source})\n{passage}" for i, (title, source, passage) in enumerate(sources, 1))


def user_turn(profile: dict, sources: list[tuple[str, str, str]], question: str) -> str:
    return (f"Patient record (from tools):\n{profile_text(profile)}\n\n"
            f"Trusted sources from search_medical_library:\n{sources_text(sources) if sources else '(no results)'}\n\n"
            f"Patient question: {question}")


# ------------------------------------------------------------------ tasks


def make_tasks(docs: dict[str, list[dict]], rng: random.Random, mix: dict[str, int], used: set[str],
               reserved: frozenset[str] = frozenset()) -> list[dict]:
    """`used` docs are avoided while others remain; `reserved` (eval) docs are never used."""
    tasks = []
    everything = [d for folder in docs.values() for d in folder]
    for kind, count in mix.items():
        for _ in range(count):
            profile = rng.choice(PROFILES)
            folder = KIND_FOLDERS[kind]
            if kind == "no_source":
                # Ask about one document, show passages from unrelated ones.
                target = rng.choice([d for d in everything if d["id"] not in used and d["id"] not in reserved])
                others = rng.sample([d for d in everything if d["id"] != target["id"]], 3)
                sources = [(d["title"], d["source"], rng.choice(d["passages"])) for d in others]
                tasks.append({"kind": kind, "profile": profile, "sources": sources,
                              "topic": target["title"], "doc": target["id"]})
                continue
            candidates = ([d for d in docs[folder] if d["id"] not in used]
                          or [d for d in docs[folder] if d["id"] not in reserved])
            if kind in ("med_change", "drug") and profile["medications"] and rng.random() < 0.7:
                names = [m.split()[0].lower() for m in profile["medications"]]
                own = [d for d in docs["drugs"] if d["title"].split(" (")[0].lower() in names and d["id"] not in reserved]
                candidates = own or candidates
            if kind == "med_change" and not profile["medications"]:
                profile = PROFILES[0]
            doc = rng.choice(candidates)
            used.add(doc["id"])
            sources = [(doc["title"], doc["source"], p) for p in pick_passages(doc, rng)]
            distractor = rng.choice(everything)
            if distractor["id"] != doc["id"] and rng.random() < 0.6:
                sources.append((distractor["title"], distractor["source"], rng.choice(distractor["passages"])))
            rng.shuffle(sources)
            tasks.append({"kind": kind, "profile": profile, "sources": sources, "topic": doc["title"], "doc": doc["id"]})
    rng.shuffle(tasks)
    return tasks


# ------------------------------------------------------------------ checks

WORD = re.compile(r"[A-Za-z']+")


def syllables(word: str) -> int:
    word = word.lower()
    groups = re.findall(r"[aeiouy]+", word)
    count = len(groups) - (1 if word.endswith("e") and len(groups) > 1 else 0)
    return max(1, count)


def grade_level(text: str) -> float:
    plain = re.sub(r"\*\*|[#>-]", " ", text)
    sentences = max(1, len(re.findall(r"[.!?](\s|$)", plain)) + plain.count("\n- "))
    words = WORD.findall(plain)
    if not words:
        return 99.0
    syl = sum(syllables(w) for w in words)
    return 0.39 * len(words) / sentences + 11.8 * syl / len(words) - 15.59


CHANGE = re.compile(r"\b(stop taking|stop your|skip (a|your) dose|double (up|your|the)|take (an )?extra|increase (your|the) dose|lower (your|the) dose|switch to)\b", re.I)
SAFE_CONTEXT = re.compile(r"\b(don't|do not|not|shouldn't|never|without|before|ask|talk|check with|unless|not to)\b", re.I)


def check(task: dict, answer: str, question: str) -> str | None:
    words = len(WORD.findall(answer))
    if words < 40 or words > 240:
        return f"length {words}"
    if re.search(r"https?://|www\.|^sources?:", answer, re.I | re.M):
        return "links or sources list"
    if grade_level(answer) > 11.5:
        return f"grade {grade_level(answer):.1f}"
    for sentence in re.split(r"(?<=[.!?])\s+|\n", answer):
        # Questions for the care team ("Is it safe to skip a dose?") are the behavior we want.
        if CHANGE.search(sentence) and not SAFE_CONTEXT.search(sentence) and not sentence.rstrip(" '\"*").endswith("?"):
            return f"medication change: {sentence[:80]}"
    if task["kind"] == "no_source" and not re.search(r"(couldn't|could not|can't|cannot|didn't|did not) find", answer, re.I):
        return "no_source without saying so"
    if task["kind"] == "emergency" and "911" not in answer[:200]:
        return "emergency without 911 up front"
    if len(question) < 8:
        return "question too short"
    return None


# ------------------------------------------------------------------ main


def run(tasks: list[dict], workers: int, checked: bool = True) -> tuple[list[dict], list[dict]]:
    kept, rejected = [], []
    lock = threading.Lock()

    def work(task):
        topic_line = f"Topic the patient asks about: {task['topic']}" if task["kind"] == "no_source" else ""
        prompt = TEACHER_PROMPT.format(
            brief=CATEGORY_BRIEFS[task["kind"]], topic_line=topic_line, profile=profile_text(task["profile"]),
            sources=sources_text(task["sources"]), rules=SYSTEM_INSTRUCTION)
        try:
            out = generate(prompt)
        except RuntimeError as e:
            return task, None, str(e)
        return task, out, None

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(work, t) for t in tasks]
        for i, future in enumerate(as_completed(futures), 1):
            task, out, error = future.result()
            with lock:
                if error:
                    rejected.append({"kind": task["kind"], "doc": task["doc"], "reason": error})
                else:
                    question, answer = out["question"].strip(), out["answer"].strip()
                    reason = check(task, answer, question) if checked else None
                    record = {"kind": task["kind"], "doc": task["doc"], "question": question, "answer": answer,
                              "user": user_turn(task["profile"], task["sources"], question)}
                    (rejected if reason else kept).append({**record, "reason": reason} if reason else record)
                if i % 20 == 0 or i == len(tasks):
                    print(f"  {i}/{len(tasks)}  kept {len(kept)}  rejected {len(rejected)}", flush=True)
    return kept, rejected


def to_vertex(example: dict) -> dict:
    return {
        "systemInstruction": {"role": "system", "parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": [
            {"role": "user", "parts": [{"text": example["user"]}]},
            {"role": "model", "parts": [{"text": example["answer"]}]},
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="only generate this many examples (smoke test)")
    parser.add_argument("--workers", type=int, default=12)
    args = parser.parse_args()

    rng = random.Random(SEED)
    docs = load_library()
    print("library:", {k: len(v) for k, v in docs.items()})
    used: set[str] = set()

    # Held-out eval questions use documents the training set never sees.
    eval_mix = {"lab": 12, "drug": 12, "herb": 8, "condition": 6, "no_source": 5, "med_change": 4, "cultural": 2, "emergency": 1}
    eval_tasks = make_tasks(docs, rng, eval_mix, used)
    mix = MIX
    if args.limit:
        mix = {k: max(1, round(v * args.limit / sum(MIX.values()))) for k, v in MIX.items()}
        eval_tasks = eval_tasks[: max(2, args.limit // 6)]
    train_tasks = make_tasks(docs, rng, mix, used, reserved=frozenset(used))

    OUT.mkdir(parents=True, exist_ok=True)
    print(f"generating {len(train_tasks)} training and {len(eval_tasks)} eval examples with {TEACHER}")
    kept, rejected = run(train_tasks, args.workers)
    # Eval rows only need the question and sources; the reference answer is kept for comparison.
    eval_kept, eval_rejected = run(eval_tasks, args.workers, checked=False)

    seen, unique = set(), []
    for ex in kept:
        key = re.sub(r"\W+", " ", ex["question"].lower()).strip()
        if key not in seen:
            seen.add(key)
            unique.append(ex)
    rng.shuffle(unique)
    n_val = max(1, len(unique) // 10)
    splits = {"validation": unique[:n_val], "train": unique[n_val:]}
    for name, rows in splits.items():
        with open(OUT / f"{name}.jsonl", "w") as f:
            for row in rows:
                f.write(json.dumps(to_vertex(row)) + "\n")
    with open(OUT / "examples.jsonl", "w") as f:
        for row in unique:
            f.write(json.dumps(row) + "\n")
    with open(OUT / "eval.jsonl", "w") as f:
        for row in eval_kept:
            f.write(json.dumps(row) + "\n")
    with open(OUT / "rejected.jsonl", "w") as f:
        for row in rejected + eval_rejected:
            f.write(json.dumps(row) + "\n")
    counts = {}
    for row in unique:
        counts[row["kind"]] = counts.get(row["kind"], 0) + 1
    print(f"done: train {len(splits['train'])}, validation {n_val}, eval {len(eval_kept)}, rejected {len(rejected) + len(eval_rejected)}")
    print("by kind:", counts)


if __name__ == "__main__":
    sys.exit(main())
