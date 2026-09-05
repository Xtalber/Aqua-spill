/**
 * DARTIS_2019 — filename -> metadata lookup (Node.js / Express reference).
 *
 * Unzip the package, point DATASET_ROOT at it, and call lookupByFilename()
 * with the name of the file a user uploaded.
 */
const fs = require("fs");
const path = require("path");

const DATASET_ROOT = process.env.DATASET_ROOT || "./DARTIS_2019_dataset";

// Load once at boot: ~1 MB, gives O(1) lookup for every accepted name.
const aliases = JSON.parse(
  fs.readFileSync(path.join(DATASET_ROOT, "metadata", "filename_lookup.json"), "utf8")
);

/** Normalise any uploaded name: strip directories, lowercase, trim. */
function normalise(name) {
  return String(name).split(/[\\/]/).pop().trim().toLowerCase();
}

/** Resolve an uploaded filename to a record id, tolerating a missing/other extension. */
function resolveId(filename) {
  const n = normalise(filename);
  if (aliases[n]) return aliases[n];
  const stem = n.replace(/\.[^.]+$/, "");
  if (aliases[stem]) return aliases[stem];
  for (const ext of [".jpg", ".jpeg", ".png", ".tif", ".tiff"]) {
    if (aliases[stem + ext]) return aliases[stem + ext];
  }
  return null;
}

/** Full record for an uploaded filename, or null when the dataset has no match. */
function lookupByFilename(filename) {
  const id = resolveId(filename);
  if (!id) return null;
  const record = JSON.parse(
    fs.readFileSync(path.join(DATASET_ROOT, "metadata", "records", `${id}.json`), "utf8")
  );
  return {
    ...record,
    absolute_image_path: path.join(DATASET_ROOT, record.files.image),
    absolute_annotation_path: record.files.annotation
      ? path.join(DATASET_ROOT, record.files.annotation)
      : null,
  };
}

// ---- Express endpoint -------------------------------------------------------
// const express = require("express");
// const multer = require("multer");
// const app = express();
// const upload = multer({ storage: multer.memoryStorage() });
//
// app.post("/api/lookup", upload.single("image"), (req, res) => {
//   const name = req.file ? req.file.originalname : req.body.filename;
//   const record = lookupByFilename(name);
//   if (!record) return res.status(404).json({ found: false, query: name });
//   res.json({ found: true, query: name, record });
// });
//
// app.listen(3000);

module.exports = { lookupByFilename, resolveId, normalise };
