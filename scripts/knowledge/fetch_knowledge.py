"""Download Clarah Health's trusted knowledge library and convert it to Markdown for Gemini File Search.

Sources (all U.S. government, public domain):
  - MedlinePlus health topics (NLM), from the official XML download
  - MedlinePlus lab test pages (NLM)
  - NCCIH "Herbs at a Glance" (NIH)
  - FDA drug labels for common medications, via the openFDA API

Polite by design: one request at a time, a delay between requests, a descriptive User-Agent,
and every raw response is cached so re-running only fetches what's missing.

Usage (from the clara/ folder):
  python3 -I scripts/knowledge/fetch_knowledge.py            # everything
  python3 -I scripts/knowledge/fetch_knowledge.py labtests   # one source
Output:
  data/knowledge/raw/      cached downloads (gitignored)
  data/knowledge/upload/   one Markdown file per document, ready for File Search
  data/knowledge/upload/manifest.json
"""

import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "data" / "knowledge"
RAW = ROOT / "raw"
OUT = ROOT / "upload"
USER_AGENT = "ClarahHealth-EmoryHacks-student-project/1.0 (educational health app; low-rate, cached)"
DELAY_SECONDS = 1.0
TODAY = date.today().isoformat()

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I skips the script dir
from drug_list import DRUGS  # noqa: E402

_last_request = 0.0


def fetch(url: str, cache: Path) -> bytes | None:
    """GET url once, caching the body. Waits DELAY_SECONDS between live requests."""
    global _last_request
    if cache.exists():
        return cache.read_bytes()
    wait = DELAY_SECONDS - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)
    _last_request = time.monotonic()
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read()
    except urllib.error.HTTPError as e:
        print(f"  ! {e.code} {url}")
        return None
    except urllib.error.URLError as e:
        print(f"  ! {e.reason} {url}")
        return None
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(body)
    return body


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80] or "untitled"


def write_doc(folder: str, title: str, source: str, url: str, body: str, manifest: list) -> None:
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    if len(body) < 80:
        return
    path = OUT / folder / f"{slug(title)}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"# {title}\n\nSource: {source}\nURL: {url}\nRetrieved: {TODAY}\n\n---\n\n{body}\n")
    manifest.append({"title": title, "source": source, "url": url, "path": str(path.relative_to(OUT))})


class HtmlToMarkdown(HTMLParser):
    """Small HTML → Markdown converter: headings, paragraphs, lists, links as text.

    Collects text inside the first `root` tag (or the whole input if root is None) and
    stops at any h2 whose text matches `stop_headings`.
    """

    SKIP = {"script", "style", "nav", "noscript", "svg", "button", "form", "iframe"}
    BLOCK = {"p", "div", "section", "br", "tr", "table", "ul", "ol"}

    def __init__(self, root: str | None = None, stop_headings: tuple[str, ...] = ()):
        super().__init__(convert_charrefs=True)
        self.root = root
        self.inside = root is None
        self.depth = 0
        self.skip = 0
        self.stop = stop_headings
        self.done = False
        self.parts: list[str] = []
        self.heading: str | None = None
        self.heading_text: list[str] = []

    def handle_starttag(self, tag, attrs):
        if self.done:
            return
        if not self.inside:
            if tag == self.root:
                self.inside, self.depth = True, 1
            return
        if tag == self.root:
            self.depth += 1
        if tag in self.SKIP:
            self.skip += 1
        elif self.skip:
            return
        elif tag in ("h1", "h2", "h3", "h4"):
            self.heading, self.heading_text = tag, []
        elif tag == "li":
            self.parts.append("\n- ")
        elif tag in self.BLOCK:
            self.parts.append("\n\n")

    def handle_endtag(self, tag):
        if self.done or not self.inside:
            return
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        elif tag == self.heading:
            text = " ".join("".join(self.heading_text).split())
            if tag == "h2" and any(text.lower().startswith(s) for s in self.stop):
                self.done = True
                return
            level = {"h1": "#", "h2": "##", "h3": "###", "h4": "####"}[tag]
            if text:
                self.parts.append(f"\n\n{level} {text}\n\n")
            self.heading = None
        elif tag in ("p", "li", "ul", "ol"):
            self.parts.append("\n")
        if tag == self.root:
            self.depth -= 1
            if self.depth == 0 and self.root:
                self.done = True

    def handle_data(self, data):
        if self.done or not self.inside or self.skip:
            return
        if self.heading:
            self.heading_text.append(data)
        else:
            self.parts.append(re.sub(r"\s+", " ", data))

    def markdown(self) -> str:
        text = "".join(self.parts)
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n[ \t]+", "\n", text)
        text = re.sub(r"\n- \s*\n", "\n", text)
        return re.sub(r"\n{3,}", "\n\n", text).strip()


def to_markdown(markup: str, root: str | None = None, stop: tuple[str, ...] = ()) -> str:
    parser = HtmlToMarkdown(root, stop)
    parser.feed(markup)
    return parser.markdown()


# ---------------------------------------------------------------- MedlinePlus health topics


def medlineplus_topics(manifest: list) -> None:
    print("MedlinePlus health topics")
    index = fetch("https://medlineplus.gov/xml.html", RAW / "medlineplus" / "xml.html")
    if not index:
        return
    files = re.findall(r"xml/(mplus_topics_\d{4}-\d{2}-\d{2}\.xml)", index.decode("utf-8", "replace"))
    if not files:
        print("  ! no XML link found on medlineplus.gov/xml.html")
        return
    latest = sorted(files)[-1]
    xml_bytes = fetch(f"https://medlineplus.gov/xml/{latest}", RAW / "medlineplus" / latest)
    if not xml_bytes:
        return
    count = 0
    for topic in ET.fromstring(xml_bytes).iter("health-topic"):
        if topic.get("language") != "English":
            continue
        title = topic.get("title", "").strip()
        url = topic.get("url", "")
        lines = []
        also = [a.text.strip() for a in topic.findall("also-called") if a.text]
        if also:
            lines.append(f"Also called: {', '.join(also)}")
        groups = [g.text.strip() for g in topic.findall("group") if g.text]
        if groups:
            lines.append(f"Categories: {', '.join(groups)}")
        summary = topic.findtext("full-summary") or ""
        lines.append(to_markdown(html.unescape(summary)))
        related = [r.text.strip() for r in topic.findall("related-topic") if r.text]
        if related:
            lines.append(f"Related topics: {', '.join(related)}")
        write_doc("topics", title, "MedlinePlus, U.S. National Library of Medicine", url, "\n\n".join(lines), manifest)
        count += 1
    print(f"  {count} topics from {latest}")


# ---------------------------------------------------------------- MedlinePlus lab tests


def medlineplus_labtests(manifest: list) -> None:
    print("MedlinePlus lab tests")
    index = fetch("https://medlineplus.gov/lab-tests/", RAW / "labtests" / "index.html")
    if not index:
        return
    urls = sorted(set(re.findall(r"https://medlineplus\.gov/lab-tests/[a-z0-9-]+/", index.decode("utf-8", "replace"))))
    print(f"  {len(urls)} pages (about {len(urls) * DELAY_SECONDS / 60:.0f} min on first run)")
    for i, url in enumerate(urls, 1):
        name = url.rstrip("/").rsplit("/", 1)[-1]
        page = fetch(url, RAW / "labtests" / f"{name}.html")
        if not page:
            continue
        markup = page.decode("utf-8", "replace")
        title_match = re.search(r"<h1[^>]*>(.*?)</h1>", markup, re.S)
        title = html.unescape(re.sub(r"<[^>]+>", "", title_match.group(1))).strip() if title_match else name
        body = to_markdown(markup, "article", ("references", "related health topics", "related medical tests"))
        body = re.sub(r"^# .*\n+", "", body)  # title goes in the header instead
        write_doc("labtests", title, "MedlinePlus Medical Tests, U.S. National Library of Medicine", url, body, manifest)
        if i % 50 == 0:
            print(f"  {i}/{len(urls)}")


# ---------------------------------------------------------------- NCCIH herbs


def nccih_herbs(manifest: list) -> None:
    print("NCCIH Herbs at a Glance")
    index = fetch("https://www.nccih.nih.gov/health/herbsataglance", RAW / "herbs" / "index.html")
    if not index:
        return
    markup = index.decode("utf-8", "replace")
    # Only the herb list inside the page body, not site navigation.
    body_start = markup.find("<main")
    slugs = sorted(set(re.findall(r'href="/health/([a-z0-9-]+)"', markup[body_start:])))
    slugs = [s for s in slugs if s not in {"herbsataglance", "know-science", "providers", "health-topics-a-z"}]
    print(f"  {len(slugs)} herb pages")
    for name in slugs:
        url = f"https://www.nccih.nih.gov/health/{name}"
        page = fetch(url, RAW / "herbs" / f"{name}.html")
        if not page:
            continue
        markup = page.decode("utf-8", "replace")
        title_match = re.search(r"<h1[^>]*>(.*?)</h1>", markup, re.S)
        title = html.unescape(re.sub(r"<[^>]+>", "", title_match.group(1))).strip() if title_match else name
        body = to_markdown(markup, "main", ("for more information", "key references", "references"))
        body = re.sub(r"^# .*\n+", "", body)
        if "safety" not in body.lower():
            continue  # not an herb fact sheet
        write_doc("herbs", f"{title} (herb/supplement)", "NIH National Center for Complementary and Integrative Health", url, body, manifest)


# ---------------------------------------------------------------- openFDA drug labels

LABEL_SECTIONS = [
    ("boxed_warning", "Boxed warning"),
    ("indications_and_usage", "What it is used for"),
    ("dosage_and_administration", "How it is taken"),
    ("contraindications", "Who should not take it"),
    ("warnings_and_cautions", "Warnings and precautions"),
    ("warnings", "Warnings"),
    ("drug_interactions", "Drug interactions"),
    ("adverse_reactions", "Side effects"),
    ("use_in_specific_populations", "Pregnancy, breastfeeding, children and older adults"),
    ("pregnancy", "Pregnancy"),
    ("information_for_patients", "Information for patients"),
    ("do_not_use", "Do not use"),
    ("ask_doctor", "Ask a doctor before use if you have"),
    ("ask_doctor_or_pharmacist", "Ask a doctor or pharmacist before use if you are"),
    ("stop_use", "Stop use and ask a doctor if"),
    ("purpose", "Purpose"),
    ("uses", "Uses"),
]
SECTION_LIMIT = 3500  # characters per section; labels can be very long


def pick_label(results: list, drug: str) -> dict | None:
    """Prefer a single-ingredient prescription label whose generic name matches."""

    def score(r):
        names = [n.lower() for n in r.get("openfda", {}).get("generic_name", [])]
        exact = any(n == drug or n.startswith(drug + " ") for n in names)
        combo = any(" and " in n or "," in n for n in names)
        rx = "PRESCRIPTION" in " ".join(r.get("openfda", {}).get("product_type", []))
        return (exact, not combo, rx, len(json.dumps(r)))

    best = max(results, key=score) if results else None
    # The generic name must start with the drug, so an unrelated product that merely
    # contains it (a homeopathic mix, Fosamax Plus D for vitamin D) is skipped.
    return best if best and score(best)[0] else None


def openfda_drugs(manifest: list) -> None:
    print("openFDA drug labels")
    print(f"  {len(DRUGS)} drugs (about {len(DRUGS) * DELAY_SECONDS / 60:.0f} min on first run)")
    missing = []
    for drug in DRUGS:
        query = urllib.parse.quote(f'openfda.generic_name:"{drug}"')
        url = f"https://api.fda.gov/drug/label.json?search={query}&limit=10"
        raw = fetch(url, RAW / "drugs" / f"{slug(drug)}.json")
        if not raw:
            missing.append(drug)
            continue
        label = pick_label(json.loads(raw).get("results", []), drug)
        if not label:
            missing.append(drug)
            continue
        ofda = label.get("openfda", {})
        brands = sorted(set(ofda.get("brand_name", [])))[:6]
        set_id = label.get("set_id", "")
        lines = [f"Generic name: {drug}"]
        if brands:
            lines.append(f"Brand names: {', '.join(brands)}")
        if ofda.get("route"):
            lines.append(f"Route: {', '.join(ofda['route'])}")
        if ofda.get("pharm_class_epc"):
            lines.append(f"Drug class: {', '.join(ofda['pharm_class_epc'])}")
        for key, heading in LABEL_SECTIONS:
            text = " ".join(label.get(key, [])).strip()
            if not text:
                continue
            text = re.sub(r"\s+", " ", text)
            if len(text) > SECTION_LIMIT:
                text = text[:SECTION_LIMIT].rsplit(". ", 1)[0] + ". [Section shortened; see full label.]"
            lines.append(f"## {heading}\n\n{text}")
        source_url = f"https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid={set_id}" if set_id else url
        write_doc("drugs", f"{drug.title()} (drug label)", "U.S. FDA drug label via openFDA / DailyMed", source_url, "\n\n".join(lines), manifest)
    if missing:
        print(f"  no label found for: {', '.join(missing)}")


# ----------------------------------------------------------------

SOURCES = {
    "topics": medlineplus_topics,
    "labtests": medlineplus_labtests,
    "herbs": nccih_herbs,
    "drugs": openfda_drugs,
}


def main() -> None:
    chosen = sys.argv[1:] or list(SOURCES)
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    for name in chosen:
        folder = name
        manifest = [m for m in manifest if not m["path"].startswith(folder + "/")]
        SOURCES[name](manifest)
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(sorted(manifest, key=lambda m: m["path"]), indent=1))
    counts = {}
    for m in manifest:
        counts[m["path"].split("/")[0]] = counts.get(m["path"].split("/")[0], 0) + 1
    print(f"Done: {len(manifest)} documents {counts} → {OUT}")


if __name__ == "__main__":
    main()
