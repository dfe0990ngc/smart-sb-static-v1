"""Shared helpers for the Paperless-ngx -> JSON / R2 tools."""
from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).with_name(".env"))
    load_dotenv()  # also allow a .env in the current directory
except ImportError:  # python-dotenv is optional
    pass

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def env(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        sys.exit(f"Missing required environment variable: {name}")
    return (value or "").strip()


def file_extension(doc: dict) -> str:
    """Extension of the file Paperless serves from /download/ (archived PDF/A when it exists, else the original)."""
    if doc.get("archived_file_name"):
        return ".pdf"
    name = doc.get("original_file_name") or ""
    ext = os.path.splitext(name)[1].lower()
    return ext or ".pdf"


def r2_key(doc_id: int, created: str, ext: str) -> str:
    """documents/<year>/<month-number>/<paperless-id>.<ext>   e.g. documents/2025/03/1042.pdf"""
    year, month = created[:4], created[5:7]
    return f"documents/{year}/{month}/{doc_id}{ext}"
