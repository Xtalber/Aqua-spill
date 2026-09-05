"""DARTIS_2019 - filename -> metadata lookup (Python / FastAPI reference).

Unzip the package, set DATASET_ROOT, and call lookup_by_filename() with the
name of the file a user uploaded.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

DATASET_ROOT = Path(os.environ.get("DATASET_ROOT", "./DARTIS_2019_dataset"))

# Load once at boot: ~1 MB, gives O(1) lookup for every accepted name.
with open(DATASET_ROOT / "metadata" / "filename_lookup.json", encoding="utf-8") as fh:
    ALIASES: dict[str, str] = json.load(fh)

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".tif", ".tiff")


def normalise(name: str) -> str:
    """Strip directories, lowercase, trim."""
    return os.path.basename(str(name).replace("\\", "/")).strip().lower()


def resolve_id(filename: str) -> str | None:
    """Resolve an uploaded filename to a record id, tolerating a different extension."""
    n = normalise(filename)
    if n in ALIASES:
        return ALIASES[n]
    stem = os.path.splitext(n)[0]
    if stem in ALIASES:
        return ALIASES[stem]
    for ext in IMAGE_EXTENSIONS:
        if stem + ext in ALIASES:
            return ALIASES[stem + ext]
    return None


def lookup_by_filename(filename: str) -> dict[str, Any] | None:
    """Return the full record for an uploaded filename, or None if unmatched."""
    rid = resolve_id(filename)
    if rid is None:
        return None
    with open(DATASET_ROOT / "metadata" / "records" / f"{rid}.json", encoding="utf-8") as fh:
        record = json.load(fh)
    record["absolute_image_path"] = str(DATASET_ROOT / record["files"]["image"])
    record["absolute_annotation_path"] = (
        str(DATASET_ROOT / record["files"]["annotation"]) if record["files"]["annotation"] else None
    )
    return record


def lookup_by_sha256(digest: str) -> dict[str, Any] | None:
    """Content-based fallback: match an upload by SHA-256 even if it was renamed.

    Build the index once (it is not shipped, to keep the package small):
        BY_HASH = {r["files"]["image_sha256"]: r["record_id"] for r in iter_records()}
    """
    for path in (DATASET_ROOT / "metadata" / "records").glob("*.json"):
        with open(path, encoding="utf-8") as fh:
            record = json.load(fh)
        if record["files"].get("image_sha256") == digest.lower():
            return record
    return None


# ---- FastAPI endpoint -------------------------------------------------------
# from fastapi import FastAPI, File, UploadFile, HTTPException
#
# app = FastAPI()
#
# @app.post("/api/lookup")
# async def lookup(image: UploadFile = File(...)):
#     record = lookup_by_filename(image.filename)
#     if record is None:
#         raise HTTPException(status_code=404, detail=f"No dataset match for {image.filename}")
#     return {"found": True, "query": image.filename, "record": record}


if __name__ == "__main__":
    import sys

    for arg in sys.argv[1:]:
        rec = lookup_by_filename(arg)
        print(json.dumps(rec, indent=2) if rec else f"no match: {arg}")
