"""Add Gemini embeddings to the Typesense passages so Clarah's search matches meaning, not just words.

Typesense Cloud's small tier can't run a built-in embedding model, so we compute vectors with
Gemini Embedding on Vertex AI (256 dimensions) and store them in a `vec` field. At question time
Clarah embeds the question the same way and runs a hybrid (keyword + vector) search.

Usage (from clara/, with gcloud signed in to the Vertex project):
  TYPESENSE_HOST=... TYPESENSE_ADMIN_KEY=... python3 -I scripts/knowledge/embed_passages.py
Run it again after re-indexing (index_typesense.mjs --reset drops the vectors).
"""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

HOST = os.environ["TYPESENSE_HOST"]
KEY = os.environ["TYPESENSE_ADMIN_KEY"]
PROJECT = os.environ.get("VERTEX_PROJECT", "project-bdf7b2a3-72f9-47d2-964")
MODEL = os.environ.get("EMBED_MODEL", "gemini-embedding-001")
DIMS = 256
BATCH = 50
BASE = f"https://{HOST}:443"


def ts(method, path, body=None, raw=False):
    data = body if isinstance(body, bytes) else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"X-TYPESENSE-API-KEY": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        out = resp.read()
    return out if raw else json.loads(out or b"null")


_token = {"v": None, "at": 0.0}


def token():
    if not _token["v"] or time.time() - _token["at"] > 1800:
        _token["v"] = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
        _token["at"] = time.time()
    return _token["v"]


def embed(texts):
    url = (f"https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/"
           f"publishers/google/models/{MODEL}:predict")
    body = {"instances": [{"content": t, "task_type": "RETRIEVAL_DOCUMENT"} for t in texts],
            "parameters": {"outputDimensionality": DIMS}}
    for attempt in range(6):
        req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return [p["embeddings"]["values"] for p in json.load(resp)["predictions"]]
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 5:
                time.sleep(2 ** attempt * 2)
                continue
            raise RuntimeError(f"{e.code}: {e.read().decode()[:300]}") from e
    raise RuntimeError("retries exhausted")


def main():
    schema = ts("GET", "/collections/clarah_passages")
    if not any(f["name"] == "vec" for f in schema["fields"]):
        ts("PATCH", "/collections/clarah_passages",
           {"fields": [{"name": "vec", "type": "float[]", "num_dim": DIMS, "optional": True}]})
        print("added vec field")
    docs = [json.loads(line) for line in ts("GET", "/collections/clarah_passages/documents/export"
                                                   "?exclude_fields=vec", raw=True).decode().splitlines() if line]
    print(f"{len(docs)} passages; embedding with {MODEL} ({DIMS} dims)")
    batches = [docs[i:i + BATCH] for i in range(0, len(docs), BATCH)]

    def work(batch):
        texts = [f"{d['title']}. {d['section']}\n{d['text']}"[:2000] for d in batch]
        vecs = embed(texts)
        lines = "\n".join(json.dumps({"id": d["id"], "vec": v}) for d, v in zip(batch, vecs))
        result = ts("POST", "/collections/clarah_passages/documents/import?action=update", lines.encode(), raw=True)
        return sum(1 for r in result.decode().splitlines() if '"success":true' in r)

    done = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        for i, n in enumerate(pool.map(work, batches), 1):
            done += n
            if i % 20 == 0 or i == len(batches):
                print(f"  {done}/{len(docs)}", flush=True)
    print(f"done: {done} passages embedded")
    return 0 if done == len(docs) else 1


if __name__ == "__main__":
    sys.exit(main())
