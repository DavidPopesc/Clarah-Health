"""Upload Clarah's dataset to Cloud Storage and run a supervised tuning job on Vertex AI.

Usage (from clara/, after `gcloud auth` with Agent Platform User + Storage Admin):
  python3 -I scripts/finetune/tune.py start     # upload data/finetune/*.jsonl and start the job
  python3 -I scripts/finetune/tune.py status    # show the job state and, when done, the tuned endpoint
The job name is saved to data/finetune/job.json so `status` knows what to check.
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "finetune"
PROJECT = os.environ.get("VERTEX_PROJECT", "project-bdf7b2a3-72f9-47d2-964")
REGION = os.environ.get("VERTEX_REGION", "us-central1")
BASE_MODEL = os.environ.get("BASE_MODEL", "gemini-3.5-flash")
BUCKET = os.environ.get("TUNING_BUCKET", f"{PROJECT}-clarah-tuning")
EPOCHS = int(os.environ.get("EPOCHS", "3"))
DISPLAY_NAME = os.environ.get("TUNED_NAME", "clarah-v1")


def token() -> str:
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def call(method: str, url: str, body: dict | bytes | None = None, content_type: str = "application/json") -> dict:
    data = body if isinstance(body, bytes) else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Authorization": f"Bearer {token()}", "Content-Type": content_type})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {url.split('?')[0]} → {e.code}\n{e.read().decode()[:1500]}") from e


def ensure_bucket() -> None:
    try:
        call("GET", f"https://storage.googleapis.com/storage/v1/b/{BUCKET}")
        return
    except SystemExit as e:
        if "→ 404" not in str(e):
            raise
    call("POST", f"https://storage.googleapis.com/storage/v1/b?project={PROJECT}", {
        "name": BUCKET, "location": REGION.upper(),
        "iamConfiguration": {"uniformBucketLevelAccess": {"enabled": True}},
    })
    print(f"created gs://{BUCKET}")


def upload(name: str) -> str:
    path = DATA / name
    object_name = f"clarah/{name}"
    url = (f"https://storage.googleapis.com/upload/storage/v1/b/{BUCKET}/o?uploadType=media&name="
           + urllib.parse.quote(object_name, safe=""))
    call("POST", url, path.read_bytes(), "application/jsonl")
    lines = sum(1 for _ in path.open())
    print(f"uploaded {name} ({lines} examples) → gs://{BUCKET}/{object_name}")
    return f"gs://{BUCKET}/{object_name}"


def start() -> None:
    ensure_bucket()
    train = upload("train.jsonl")
    validation = upload("validation.jsonl")
    job = call("POST", f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}/tuningJobs", {
        "baseModel": BASE_MODEL,
        "tunedModelDisplayName": DISPLAY_NAME,
        "supervisedTuningSpec": {
            "trainingDatasetUri": train,
            "validationDatasetUri": validation,
            "hyperParameters": {"epochCount": EPOCHS},
        },
    })
    (DATA / "job.json").write_text(json.dumps({"name": job["name"], "baseModel": BASE_MODEL}, indent=1))
    print(f"started {job['name']} ({job.get('state')})")


def status() -> None:
    saved = json.loads((DATA / "job.json").read_text())
    job = call("GET", f"https://{REGION}-aiplatform.googleapis.com/v1/{saved['name']}")
    print("state:", job.get("state"))
    if job.get("error"):
        print("error:", json.dumps(job["error"])[:800])
    tuned = job.get("tunedModel") or {}
    if tuned:
        print("tuned model:", tuned.get("model"))
        print("endpoint:", tuned.get("endpoint"))
        saved.update({"model": tuned.get("model"), "endpoint": tuned.get("endpoint"), "state": job.get("state")})
        (DATA / "job.json").write_text(json.dumps(saved, indent=1))
    stats = (job.get("tuningDataStats") or {}).get("supervisedTuningDataStats") or {}
    if stats:
        print("training tokens:", stats.get("totalBillableTokenCount") or stats.get("totalTuningCharacterCount"))


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "status"
    {"start": start, "status": status}[command]()
