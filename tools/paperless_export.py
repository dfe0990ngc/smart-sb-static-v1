#!/usr/bin/env python3
"""
Export documents from Paperless-ngx into content/documents.json (input for the static site + Pagefind index).

Fields extracted
    title, content, document_author (custom field), created (date), file link -> Cloudflare R2 (smart-sb-storage)

The link is generated automatically from the Paperless document id / created date, e.g.
    https://files.example.org/documents/2025/03/1042.pdf
Run tools/paperless_to_r2.py afterwards to upload the files to that exact key if they do not exist yet.

Usage
    python tools/paperless_export.py
    python tools/paperless_export.py --out content/documents.json --types Ordinance,Resolution
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

from common import MONTHS, env, file_extension, r2_key

PAGE_SIZE = 100
FIELDS = ",".join(
    [
        "id", "title", "content", "created", "created_date", "document_type",
        "custom_fields", "original_file_name", "archived_file_name",
    ]
)


class Paperless:
    def __init__(self, base_url: str, token: str):
        self.base = base_url.rstrip("/")
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Token {token}", "Accept": "application/json; version=5"})

    def get(self, path: str, **params):
        r = self.s.get(f"{self.base}{path}", params=params, timeout=120)
        r.raise_for_status()
        return r.json()

    def paged(self, path: str, **params):
        page = 1
        while True:
            data = self.get(path, page=page, page_size=PAGE_SIZE, **params)
            yield from data["results"]
            if not data.get("next"):
                break
            page += 1


def resolve_author_field(fields: list[dict], wanted: str) -> dict:
    if wanted.isdigit():
        match = next((f for f in fields if f["id"] == int(wanted)), None)
    else:
        match = next((f for f in fields if f["name"].strip().lower() == wanted.strip().lower()), None)
    if not match:
        names = ", ".join(f"{f['name']} (id {f['id']})" for f in fields) or "none"
        sys.exit(f"Custom field '{wanted}' not found in Paperless. Available: {names}")
    return match


def field_value_to_text(field_def: dict, value) -> str:
    """Turn a custom-field value into display text (handles select fields)."""
    if value in (None, ""):
        return ""
    if field_def.get("data_type") == "select":
        options = (field_def.get("extra_data") or {}).get("select_options") or []
        for i, opt in enumerate(options):
            if isinstance(opt, dict) and opt.get("id") == value:
                return str(opt.get("label", "")).strip()
            if isinstance(opt, str) and i == value:  # old Paperless versions: index into a list of labels
                return opt.strip()
        return ""
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    return str(value).strip()


def normalize_text(text: str) -> str:
    text = (text or "").replace("\x00", " ")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text)
    return text.strip()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="content/documents.json")
    ap.add_argument("--types", default=env("PUBLIC_DOCUMENT_TYPES"), help="comma separated document type names; empty = all")
    ap.add_argument("--author-field", default=env("PAPERLESS_AUTHOR_FIELD", "document_author"))
    ap.add_argument("--max-content", type=int, default=0, help="truncate OCR text to N characters (0 = no limit)")
    args = ap.parse_args()

    pl = Paperless(env("PAPERLESS_URL", required=True), env("PAPERLESS_TOKEN", required=True))
    public_base = env("R2_PUBLIC_BASE_URL", required=True).rstrip("/")

    custom_fields = list(pl.paged("/api/custom_fields/"))
    author_def = resolve_author_field(custom_fields, args.author_field)

    doc_types = {t["id"]: t["name"] for t in pl.paged("/api/document_types/")}
    params: dict = {"fields": FIELDS, "ordering": "-created"}
    wanted_types = [t.strip() for t in args.types.split(",") if t.strip()]
    if wanted_types:
        lookup = {name.lower(): tid for tid, name in doc_types.items()}
        ids = []
        for name in wanted_types:
            if name.lower() not in lookup:
                print(f"! document type '{name}' does not exist in Paperless (available: {', '.join(doc_types.values())})", file=sys.stderr)
            else:
                ids.append(str(lookup[name.lower()]))
        if not ids:
            sys.exit("None of the requested document types exist - nothing to export.")
        params["document_type__id__in"] = ",".join(ids)

    docs, skipped = [], 0
    for raw in pl.paged("/api/documents/", **params):
        created = (raw.get("created_date") or raw.get("created") or "")[:10]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", created):
            skipped += 1
            continue

        author = ""
        for cf in raw.get("custom_fields") or []:
            if cf.get("field") == author_def["id"]:
                author = field_value_to_text(author_def, cf.get("value"))
                break

        content = normalize_text(raw.get("content", ""))
        if args.max_content and len(content) > args.max_content:
            content = content[: args.max_content]

        month_number = int(created[5:7])
        key = r2_key(raw["id"], created, file_extension(raw))
        docs.append(
            {
                "id": raw["id"],
                "title": (raw.get("title") or f"Document {raw['id']}").strip(),
                "content": content,
                "author": author or None,
                "created": created,
                "year": int(created[:4]),
                "month": MONTHS[month_number - 1],
                "month_number": month_number,
                "document_type": doc_types.get(raw.get("document_type")),
                "file_key": key,
                "url": f"{public_base}/{key}",
            }
        )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": env("PAPERLESS_URL"),
        "count": len(docs),
        "documents": docs,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    with_author = sum(1 for d in docs if d["author"])
    print(f"Exported {len(docs)} documents -> {out}  ({with_author} with author, {skipped} skipped: no valid created date)")
    if not docs:
        print("! No documents exported - check PUBLIC_DOCUMENT_TYPES / token permissions.", file=sys.stderr)


if __name__ == "__main__":
    main()
