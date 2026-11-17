#!/usr/bin/env python3
"""
Paperless-ngx AI metadata agent (Claude)

Flow
  1. Paperless workflow adds tag `ai-pending` to every newly consumed document.
  2. This agent polls for that tag, reads OCR text (or the PDF itself when OCR
     is poor), and asks Claude to fill metadata via a forced tool call whose
     enums are built from YOUR Paperless catalogs (no invented types/paths/tags).
  3. High confidence -> PATCH the document, tag `ai-done`.
     Low confidence  -> change nothing, add a note with the suggestion, tag `ai-review`.

Setup
  pip install anthropic requests
  export PAPERLESS_URL=http://localhost:8000
  export PAPERLESS_TOKEN=xxxxxxxx
  export ANTHROPIC_API_KEY=sk-ant-...
  export GEMINI_API_KEY=...                      # optional fallback when Claude fails (credits/key/outage)
  export GEMINI_MODEL=gemini-3.8-flash           # optional
  export LLM_PROVIDER=auto                       # auto (Claude, then Gemini) | claude | gemini
  export CLAUDE_MODEL=claude-sonnet-5-5          # optional
  # Create in Paperless (Settings > Custom fields): `approved_date` (Date),
  # `document_author` (Text). Optional; skipped if missing.
  # Create a Workflow: trigger "Document Added" -> assign tag `ai-pending`.

Run
  python paperless_ai_agent.py --once              # process queue and exit
  python paperless_ai_agent.py --interval 60       # daemon
  python paperless_ai_agent.py --id 12345 --dry-run
"""
import argparse
import base64
import datetime as dt
import json
import logging
import os
import time

import requests
import anthropic
from anthropic import Anthropic

PL_URL = os.environ["PAPERLESS_URL"].rstrip("/")
PL_TOKEN = os.environ["PAPERLESS_TOKEN"]
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
TAG_PENDING = os.environ.get("TAG_PENDING", "ai-pending")
TAG_DONE = os.environ.get("TAG_DONE", "ai-done")
TAG_REVIEW = os.environ.get("TAG_REVIEW", "ai-review")
CF_APPROVED = os.environ.get("CF_APPROVED", "approved_date")
CF_AUTHOR = os.environ.get("CF_AUTHOR", "document_author")
MIN_CONFIDENCE = float(os.environ.get("MIN_CONFIDENCE", "0.80"))
MAX_PDF_BYTES = 25 * 1024 * 1024
HEAD_CHARS, TAIL_CHARS = 12000, 4000  # signatures/approval dates sit at the end

log = logging.getLogger("paperless-ai")
http = requests.Session()
http.headers.update({"Authorization": f"Token {PL_TOKEN}", "Accept": "application/json; version=5"})
claude = Anthropic() if os.environ.get("ANTHROPIC_API_KEY") else None
GEMINI_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")  # gemini-2.5-* is being shut down 2026-12-01
GEMINI_MAX_PDF = 18 * 1024 * 1024  # inline request limit is ~20 MB
PROVIDER = os.environ.get("LLM_PROVIDER", "auto").lower()  # auto = Claude first, Gemini fallback | claude | gemini
_claude_dead = False  # set after a credit/auth failure so we stop retrying Claude for every document

SYSTEM_PROMPT = """You are a records clerk for a Philippine Sangguniang Bayan (municipal legislative council).
You receive OCR text (or the scanned PDF) of one legislative document and return metadata via the set_metadata tool.

Rules:
- Choose document_type, storage_path and tags ONLY from the enums provided.
- subject: short plain description of what the document is about (the code builds the final title and enforces
  length). Fix obvious OCR errors; keep names and numbers exact. Do not repeat the document number in it.
- reso_number: the resolution number exactly as printed (e.g. "45" or "2026-045") if the document is a Resolution, else null.
- designation: for ordinances, the document's OWN heading line as printed, e.g. "Municipal Ordinance No. 12" or
  "Appropriation Ordinance No. 3"; else null.
- document_type: decide from the document's own heading lines, not from passing mentions.
  * Many documents start with a RESOLUTION header (e.g. "RESOLUTION NO. 231") and then quote the adopted ordinance
    BELOW it: "RESOLVED FURTHER, to approve and adopt the following ... Ordinance, to wit:" followed by a separate
    centered/underlined heading such as "APPROPRIATION ORDINANCE NO. 24" or "MUNICIPAL ORDINANCE NO. 12", an
    "AN ORDINANCE ..." long title and SECTION I, II, ... clauses.
  * If that standalone ordinance heading is present -> document_type is the matching ORDINANCE type from the enum
    ("Appropriation Ordinance" / "Municipal Ordinance" if they exist, else "Ordinance"). Set designation to the
    heading as printed AND still set reso_number from the Resolution header (the title keeps the SB RES. prefix).
  * If there is NO such standalone ordinance heading -> it is a Resolution, even if its long title or WHEREAS clauses
    mention an ordinance (e.g. "approving Ordinance No. ..."). Such mentions never make it an Ordinance.
  * Same logic for storage_path: it follows the classified document_type.
- created: the date of the document as stated in its CONTENT, i.e. the session/meeting date printed above the
  resolution (e.g. "25th Regular Session, December 5, 1989" or "HELD ON August 8, 1986").
  Content dates beat any filename/scan date.
- approved_date: the date on the "APPROVED:" line next to the Mayor's name/signature. If there is no such line,
  use the same date as created (the "HELD ON ..." / session date). Ignore handwritten receiving stamps/notes
  such as "Rec'd" and their dates.
- document_author: use the document's own wording.
  * "On motion of <Hon. Name>" -> "On motion of Hon. Name"
  * "Authored by <Hon. Name>" -> "Authored by Hon. Name"
  * only "Sponsored by <Hon. Name>" is present -> "Sponsored by Hon. Name"
  * both "On motion of" and "Sponsored by" present -> use "On motion of"
  * 3 or more authors -> "<First Person> et al."
  * not stated -> null
- correspondent: the person/office the document is TALKING TO (addressee) or, if none, the direct beneficiary
  described in the content (e.g. the grantee, the person/office receiving the assistance or approval). Use the
  full proper name as written (fix OCR errors). If an existing correspondent from the provided list is clearly the
  same party, reuse its exact spelling; otherwise give the new name. Null if neither exists. Never use the
  authoring councilor or the Sangguniang Bayan itself.
- Never guess. If a field is not supported by the document, return null and lower confidence.
- confidence: 0.0-1.0 for the whole result. review_notes: short reason if < 0.9 (e.g. illegible date, ambiguous type).
"""


# ---------------------------------------------------------------- paperless
def paged(path, params=None):
    url = f"{PL_URL}{path}"
    params = dict(params or {}, page_size=100)
    while url:
        r = http.get(url, params=params, timeout=60)
        r.raise_for_status()
        data = r.json()
        yield from data["results"]
        url, params = data.get("next"), None


def preflight():
    """Fail early with a readable message if PAPERLESS_URL doesn't point at Paperless-ngx."""
    try:
        r = http.get(f"{PL_URL}/api/documents/", params={"page_size": 1}, timeout=15)
    except requests.RequestException as e:
        raise SystemExit(f"Cannot reach {PL_URL}: {e}")
    if r.status_code == 401 or r.status_code == 403:
        raise SystemExit("Paperless rejected the token (401/403). Check PAPERLESS_TOKEN.")
    if r.status_code == 404:
        raise SystemExit(f"{PL_URL} has no /api/documents/ - this is not Paperless-ngx "
                         "(port 8055 is Directus by default; Paperless is usually 8000). Fix PAPERLESS_URL.")
    r.raise_for_status()


def ensure_tag(name, tags):
    if name in tags:
        return tags[name]
    r = http.post(f"{PL_URL}/api/tags/", json={"name": name}, timeout=30)
    r.raise_for_status()
    tags[name] = r.json()["id"]
    return tags[name]


def load_catalog():
    cat = {
        "document_types": {x["name"]: x["id"] for x in paged("/api/document_types/")},
        "storage_paths": {x["name"]: x["id"] for x in paged("/api/storage_paths/")},
        "tags": {x["name"]: x["id"] for x in paged("/api/tags/")},
        "correspondents": {x["name"]: x["id"] for x in paged("/api/correspondents/")},
        "fields": {x["name"]: x["id"] for x in paged("/api/custom_fields/")},
    }
    cat["sys"] = {n: ensure_tag(n, cat["tags"]) for n in (TAG_PENDING, TAG_DONE, TAG_REVIEW)}
    return cat


def pending_docs(cat):
    return list(paged("/api/documents/", {"tags__id__all": cat["sys"][TAG_PENDING], "ordering": "id"}))


def get_doc(doc_id):
    r = http.get(f"{PL_URL}/api/documents/{doc_id}/", timeout=60)
    r.raise_for_status()
    return r.json()


def download_pdf(doc_id):
    r = http.get(f"{PL_URL}/api/documents/{doc_id}/download/", timeout=120)
    r.raise_for_status()
    return r.content if len(r.content) <= MAX_PDF_BYTES else None


# ---------------------------------------------------------------- claude
def tool_schema(cat):
    user_tags = [n for n in cat["tags"] if n not in cat["sys"]]
    date = {"type": ["string", "null"], "description": "YYYY-MM-DD"}
    return {
        "name": "set_metadata",
        "description": "Record extracted metadata for the document.",
        "input_schema": {
            "type": "object",
            "properties": {
                "subject": {"type": "string"},
                "reso_number": {"type": ["string", "null"]},
                "designation": {"type": ["string", "null"]},
                "document_type": {"type": ["string", "null"], "enum": list(cat["document_types"]) + [None]},
                "storage_path": {"type": ["string", "null"], "enum": list(cat["storage_paths"]) + [None]},
                "created": date,
                "approved_date": date,
                "document_author": {"type": ["string", "null"]},
                "correspondent": {"type": ["string", "null"]},
                "tags": {"type": "array", "items": {"type": "string", "enum": user_tags}},
                "confidence": {"type": "number"},
                "review_notes": {"type": ["string", "null"]},
            },
            "required": ["subject", "reso_number", "designation", "document_type", "storage_path",
                         "created", "approved_date", "document_author", "correspondent", "tags", "confidence"],
        },
    }


def poor_ocr(text):
    t = (text or "").strip()
    if len(t) < 200:
        return True
    return sum(c.isalnum() or c.isspace() or c in ".,;:-()/'\"" for c in t) / len(t) < 0.90


def gemini_schema(node):
    """Convert our JSON schema into the OpenAPI subset Gemini's responseSchema accepts."""
    t = node["type"]
    nullable = False
    if isinstance(t, list):
        nullable = "null" in t
        t = next(x for x in t if x != "null")
    out = {"type": t.upper()}
    if "enum" in node:  # large enums make Gemini reject the schema; allowed values go in the prompt instead
        nullable = nullable or None in node["enum"]
    if t == "object":
        out["properties"] = {k: gemini_schema(v) for k, v in node["properties"].items()}
        if node.get("required"):
            out["required"] = node["required"]
    if t == "array":
        out["items"] = gemini_schema(node["items"])
    if nullable:
        out["nullable"] = True
    return out


def call_claude(text, pdf, tool):
    content = []
    if pdf:
        content.append({"type": "document", "source": {
            "type": "base64", "media_type": "application/pdf",
            "data": base64.standard_b64encode(pdf).decode()}})
    content.append({"type": "text", "text": text})
    resp = claude.messages.create(
        model=MODEL, max_tokens=1500, system=SYSTEM_PROMPT,
        tools=[tool], tool_choice={"type": "tool", "name": "set_metadata"},
        messages=[{"role": "user", "content": content}],
    )
    return next(b.input for b in resp.content if b.type == "tool_use")


def call_gemini(text, pdf, tool):
    parts = []
    if pdf and len(pdf) <= GEMINI_MAX_PDF:
        parts.append({"inline_data": {"mime_type": "application/pdf",
                                      "data": base64.standard_b64encode(pdf).decode()}})
    elif pdf:
        log.warning("PDF too large for Gemini inline upload, using OCR text only")
    props = tool["input_schema"]["properties"]
    allowed = {
        "document_type": props["document_type"].get("enum"),
        "storage_path": props["storage_path"].get("enum"),
        "tags": props["tags"]["items"].get("enum"),
    }
    lists = "\n".join(f"- {k} ({'use any that apply from' if k == 'tags' else 'use EXACTLY one of'}): "
                      + " | ".join(v for v in vals if v)
                      for k, vals in allowed.items() if vals)
    parts.append({"text": f"ALLOWED VALUES (copy spelling exactly):\n{lists}\n\n{text}"})
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseMimeType": "application/json",
                             "responseSchema": gemini_schema(tool["input_schema"])},
    }
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": GEMINI_KEY}, json=body, timeout=180)
    if not r.ok:
        raise RuntimeError(f"Gemini {r.status_code}: {r.text[:400]}")
    cand = r.json()["candidates"][0]
    return json.loads("".join(p.get("text", "") for p in cand["content"]["parts"]))


def classify_claude_error(e):
    """-> (reason, permanent) if we should fall back to Gemini, else None."""
    if isinstance(e, anthropic.BadRequestError) and "credit balance" in str(e):
        return "credit balance too low", True
    if isinstance(e, (anthropic.AuthenticationError, anthropic.PermissionDeniedError)):
        return "API key rejected", True
    if isinstance(e, (anthropic.RateLimitError, anthropic.APIConnectionError, anthropic.InternalServerError)):
        return "temporary API error", False
    return None


def run_llm(text, pdf, cat):
    global _claude_dead
    tool = tool_schema(cat)
    if PROVIDER != "gemini" and claude and not _claude_dead:
        try:
            return call_claude(text, pdf, tool)
        except Exception as e:
            info = classify_claude_error(e)
            if not info:
                raise
            reason, permanent = info
            _claude_dead = _claude_dead or permanent
            if PROVIDER == "claude" or not GEMINI_KEY:
                if permanent:
                    raise SystemExit(f"Claude unavailable ({reason}) and no Gemini fallback configured. "
                                     "Add credits/fix the key, or set GEMINI_API_KEY.")
                raise
            log.warning("Claude unavailable (%s) -> falling back to Gemini %s", reason, GEMINI_MODEL)
    if _claude_dead or PROVIDER == "gemini":
        log.info("using Gemini %s", GEMINI_MODEL)
    return call_gemini(text, pdf, tool)


def snap_to_catalog(meta, cat):
    """Case/whitespace-insensitive match of type, path and tags to real Paperless names; drop unknowns."""
    def snap(val, names):
        key = " ".join((val or "").split()).casefold()
        return next((n for n in names if n.casefold() == key), None)
    meta["document_type"] = snap(meta.get("document_type"), cat["document_types"])
    meta["storage_path"] = snap(meta.get("storage_path"), cat["storage_paths"])
    user_tags = [n for n in cat["tags"] if n not in cat["sys"]]
    meta["tags"] = [t for t in (snap(x, user_tags) for x in meta.get("tags") or []) if t]
    return meta


def extract(doc, cat):
    text = doc.get("content") or ""
    if len(text) > HEAD_CHARS + TAIL_CHARS:
        text = text[:HEAD_CHARS] + "\n[... middle omitted ...]\n" + text[-TAIL_CHARS:]
    pdf = None
    if poor_ocr(doc.get("content")):
        pdf = download_pdf(doc["id"])
        if pdf:
            log.info("doc %s: poor OCR, sending PDF to the model", doc["id"])
    known = "; ".join(list(cat["correspondents"])[:500])
    prompt = (f"Current filename/title: {doc.get('title')}\n\n"
              f"EXISTING CORRESPONDENTS (reuse exact spelling when the same party): {known or '(none)'}\n\n"
              f"OCR TEXT:\n{text}")
    return snap_to_catalog(run_llm(prompt, pdf, cat), cat)


def check_providers():
    if PROVIDER == "claude" and not claude:
        raise SystemExit("LLM_PROVIDER=claude but ANTHROPIC_API_KEY is not set.")
    if PROVIDER == "gemini" and not GEMINI_KEY:
        raise SystemExit("LLM_PROVIDER=gemini but GEMINI_API_KEY is not set.")
    if not claude and not GEMINI_KEY:
        raise SystemExit("Set ANTHROPIC_API_KEY and/or GEMINI_API_KEY.")


# ---------------------------------------------------------------- apply
def valid_date(s):
    try:
        return dt.date.fromisoformat(s).isoformat() if s else None
    except ValueError:
        return None


TITLE_MAX = 128  # Paperless-ngx title limit


def build_title(meta):
    subject = " ".join((meta.get("subject") or "").split())
    reso = (meta.get("reso_number") or "").strip()
    desig = " ".join((meta.get("designation") or "").split())
    if reso:
        prefix = f"SB RES. NO. {reso}"
    elif desig:
        prefix = desig
    else:
        prefix = ""
    title = f"{prefix} - {subject}" if prefix and subject else (prefix or subject)
    if len(title) > TITLE_MAX:
        cut = title[: TITLE_MAX - 3]
        if " " in cut[len(prefix) + 3:]:
            cut = cut.rsplit(" ", 1)[0]  # cut on a word boundary, never inside the prefix
        title = cut.rstrip(" -,;:") + "..."
    return title


def resolve_correspondent(name, cat, dry):
    """Return correspondent id; create it in Paperless if it doesn't exist yet."""
    name = " ".join((name or "").split())[:128]
    if not name:
        return None
    lookup = {n.casefold(): i for n, i in cat["correspondents"].items()}
    if name.casefold() in lookup:
        return lookup[name.casefold()]
    log.info("creating correspondent: %s", name)
    if dry:
        return None
    r = http.post(f"{PL_URL}/api/correspondents/",
                  json={"name": name, "matching_algorithm": 0}, timeout=30)  # 0 = no auto-matching
    r.raise_for_status()
    cat["correspondents"][name] = r.json()["id"]
    return cat["correspondents"][name]


def apply(doc, meta, cat, dry):
    created = valid_date(meta.get("created"))
    approved = valid_date(meta.get("approved_date")) or created  # fallback: approved = created
    reasons = []
    if meta["confidence"] < MIN_CONFIDENCE:
        reasons.append(f"confidence {meta['confidence']:.2f}")
    if not created:
        reasons.append("no valid created date")
    if meta.get("document_type") not in cat["document_types"]:
        reasons.append("no document_type")
    if meta.get("storage_path") not in cat["storage_paths"]:
        reasons.append("no storage_path")
    if "resolution" in (meta.get("document_type") or "").lower() and not (meta.get("reso_number") or "").strip():
        reasons.append("resolution without a number")
    if "ordinance" in (meta.get("document_type") or "").lower() and not (meta.get("designation") or "").strip():
        reasons.append("ordinance without a heading/number")

    tags = set(doc["tags"]) - {cat["sys"][TAG_PENDING]}
    if reasons:
        tags.add(cat["sys"][TAG_REVIEW])
        note = "AI suggestion (not applied): " + "; ".join(reasons) + "\n" + json.dumps(meta, indent=2, ensure_ascii=False)
        log.warning("doc %s -> review (%s)", doc["id"], "; ".join(reasons))
        if not dry:
            http.post(f"{PL_URL}/api/documents/{doc['id']}/notes/", json={"note": note}, timeout=30).raise_for_status()
            http.patch(f"{PL_URL}/api/documents/{doc['id']}/", json={"tags": sorted(tags)}, timeout=30).raise_for_status()
        return

    tags |= {cat["tags"][n] for n in meta["tags"] if n in cat["tags"]}
    tags.add(cat["sys"][TAG_DONE])

    cf = {c["field"]: c["value"] for c in doc.get("custom_fields", [])}
    for name, val in ((CF_APPROVED, approved), (CF_AUTHOR, meta.get("document_author"))):
        if name in cat["fields"] and val:
            cf[cat["fields"][name]] = val

    patch = {
        "title": build_title(meta),
        "document_type": cat["document_types"][meta["document_type"]],
        "storage_path": cat["storage_paths"][meta["storage_path"]],
        "created": created,
        "tags": sorted(tags),
        "custom_fields": [{"field": k, "value": v} for k, v in cf.items()],
    }
    corr_id = resolve_correspondent(meta.get("correspondent"), cat, dry)
    if corr_id:
        patch["correspondent"] = corr_id
    log.info("doc %s -> %s", doc["id"], json.dumps(patch, ensure_ascii=False))
    if not dry:
        r = http.patch(f"{PL_URL}/api/documents/{doc['id']}/", json=patch, timeout=30)
        r.raise_for_status()


def process(doc_id, cat, dry):
    try:
        doc = get_doc(doc_id)
        apply(doc, extract(doc, cat), cat, dry)
    except Exception:
        log.exception("doc %s failed", doc_id)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--interval", type=int, default=60)
    ap.add_argument("--id", type=int)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    check_providers()
    preflight()

    while True:
        cat = load_catalog()  # refresh each cycle so new types/tags are picked up
        ids = [a.id] if a.id else [d["id"] for d in pending_docs(cat)]
        for i in ids:
            process(i, cat, a.dry_run)
        if a.once or a.id:
            break
        time.sleep(a.interval)


if __name__ == "__main__":
    main()
