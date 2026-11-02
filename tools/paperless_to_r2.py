#!/usr/bin/env python3
"""
Upload documents from Paperless-ngx to the Cloudflare R2 bucket (default: smart-sb-storage) - only if the key
does not exist yet.

Keys come from content/documents.json (written by paperless_export.py), so the links on the website always match.
    documents/<year>/<month>/<paperless-id>.<ext>

Usage
    python tools/paperless_to_r2.py                 # upload missing files
    python tools/paperless_to_r2.py --dry-run       # list what would be uploaded
    python tools/paperless_to_r2.py --force         # re-upload everything (overwrite)
    python tools/paperless_to_r2.py --workers 6
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote

import boto3
import requests
from botocore.config import Config

from common import env


def make_s3():
    # R2_ENDPOINT_URL is optional (needed for EU/FedRAMP jurisdictions: https://<account>.eu.r2.cloudflarestorage.com)
    endpoint = env("R2_ENDPOINT_URL") or f"https://{env('R2_ACCOUNT_ID', required=True)}.r2.cloudflarestorage.com"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=env("R2_ACCESS_KEY_ID", required=True),
        aws_secret_access_key=env("R2_SECRET_ACCESS_KEY", required=True),
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"}),
    )


def existing_keys(s3, bucket: str, prefix: str = "documents/") -> set[str]:
    keys: set[str] = set()
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        keys.update(obj["Key"] for obj in page.get("Contents", []))
    return keys


def content_disposition(title: str, ext: str) -> str:
    filename = f"{title[:120].strip()}{ext}"
    ascii_name = "".join(c if 32 <= ord(c) < 127 and c not in '"\\;' else "_" for c in filename)
    return f"inline; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


def upload_one(doc: dict, s3, bucket: str, paperless_url: str, headers: dict) -> str:
    key = doc["file_key"]
    ext = "." + key.rsplit(".", 1)[-1]
    with requests.get(f"{paperless_url}/api/documents/{doc['id']}/download/", headers=headers, stream=True, timeout=300) as r:
        r.raise_for_status()
        content_type = (r.headers.get("Content-Type") or "").split(";")[0] or mimetypes.guess_type(key)[0] or "application/octet-stream"
        with tempfile.TemporaryFile() as tmp:
            for chunk in r.iter_content(chunk_size=1024 * 256):
                tmp.write(chunk)
            tmp.seek(0)
            s3.upload_fileobj(
                tmp,
                bucket,
                key,
                ExtraArgs={
                    "ContentType": content_type,
                    "ContentDisposition": content_disposition(doc["title"], ext),
                    "CacheControl": "public, max-age=86400",
                },
            )
    return key


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--docs", default="content/documents.json")
    ap.add_argument("--bucket", default=env("R2_BUCKET", "smart-sb-storage"))
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true", help="overwrite files that already exist in the bucket")
    args = ap.parse_args()

    with open(args.docs, encoding="utf-8") as f:
        docs = json.load(f)["documents"]

    s3 = make_s3()
    present = set() if args.force else existing_keys(s3, args.bucket)
    todo = [d for d in docs if d["file_key"] not in present]
    print(f"{len(docs)} documents in export | {len(docs) - len(todo)} already in '{args.bucket}' | {len(todo)} to upload")

    if args.dry_run or not todo:
        for d in todo[:50]:
            print(f"  would upload {d['file_key']}   ({d['title'][:70]})")
        if len(todo) > 50:
            print(f"  ... and {len(todo) - 50} more")
        return

    paperless_url = env("PAPERLESS_URL", required=True).rstrip("/")
    headers = {"Authorization": f"Token {env('PAPERLESS_TOKEN', required=True)}"}

    ok, failed = 0, []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(upload_one, d, s3, args.bucket, paperless_url, headers): d for d in todo}
        for i, fut in enumerate(as_completed(futures), 1):
            d = futures[fut]
            try:
                fut.result()
                ok += 1
                print(f"[{i}/{len(todo)}] uploaded {d['file_key']}")
            except Exception as exc:  # keep going, report at the end
                failed.append(d["id"])
                print(f"[{i}/{len(todo)}] FAILED  id={d['id']} {d['file_key']}: {exc}", file=sys.stderr)

    print(f"Done. uploaded={ok} failed={len(failed)}")
    if failed:
        print("Failed Paperless ids:", ", ".join(map(str, failed)), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
