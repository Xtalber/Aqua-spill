# DARTIS_2019 — website-ready SAR oil-slick dataset

Sentinel-1 SAR image patches of oil slicks and look-alikes in the Eastern
Mediterranean Sea (2019), packaged so that a website can take an uploaded image
filename and return every piece of metadata the dataset holds about it.

**3,655 image patches · 1,365 XML annotations · 3,225 annotated oil objects ·
1,063 Sentinel-1 source products · full year 2019**

## Layout

```
DARTIS_2019_dataset/
├── README.md
├── manifest.json                     dataset-level summary, counts, coverage, citation
├── images/
│   ├── oil/coast/     oc-0001.jpg …    375 patches
│   ├── oil/water/     ow-0001.jpg …    990 patches
│   ├── no_oil/coast/  nc-0001-00-000001.jpg …    351 patches
│   └── no_oil/water/  nw-0001-00-000001.jpg …  1,939 patches
├── annotations/
│   ├── oil/coast/     oc-0001.xml …    375 PASCAL-VOC files
│   └── oil/water/     ow-0001.xml …    990 PASCAL-VOC files
├── metadata/
│   ├── index.json              filename → summary record, plus the alias table
│   ├── filename_lookup.json    compact alias → record_id map (load this at boot)
│   ├── records/<patch_id>.json one complete record per image (3,655 files)
│   ├── images.csv              one row per image (34 columns)
│   ├── objects.csv             one row per oil object (32 columns)
│   ├── patches.geojson         3,655 patch footprints
│   ├── oil_objects.geojson     3,225 oil-object footprints
│   └── schema.json             JSON Schema for a record
├── docs/
│   ├── DATA_DICTIONARY.md      every field explained
│   ├── INTEGRATION.md          backend integration guide
│   └── examples/lookup.js, lookup.py   reference implementations (Express, FastAPI)
└── source/
    ├── DARTIS_2019.tab         original PANGAEA table, unmodified
    └── DARTIS_2019.events.kml  original PANGAEA event KML, unmodified
```

Patch size is 640 × 640 for 3,581 images; 74 slicks too large for that window are stored as larger
square patches (up to 4964 × 4964). Read `image_width` / `image_height` from the record rather than
assuming 640 — pixel coordinates are always in the patch's own space.

Images and annotations keep their published filenames, so `oc-0001.jpg` pairs
with `oc-0001.xml` and with `metadata/records/oc-0001.json` by name alone.

## Lookup in three lines

```python
aliases = json.load(open("metadata/filename_lookup.json"))
record_id = aliases[os.path.basename(uploaded_name).lower()]
record = json.load(open(f"metadata/records/{record_id}.json"))
```

The alias table accepts the package filename (`oc-0001.jpg`), the stem
(`oc-0001`), the original Sentinel-1 patch name
(`S1_20190101_034235_034350_VV_0`, with or without an extension), the XML name,
and any object tag (`ow-0004-02-000005`) — all case-insensitive. Working
Express and FastAPI implementations are in `docs/examples/`.

## What a record contains

| Requested field | Where it lives in the record |
|---|---|
| SAR image filename | `sar_image_filename` |
| XML annotation filename | `xml_annotation_filename` |
| Patch ID | `patch_id`, plus `patch_name` for the original Sentinel-1 patch name |
| Sentinel product ID | `sentinel_product_id`, `sentinel_product_ids[]` |
| Start / end time | `start_time`, `end_time` (UTC, ISO-8601) |
| Image width / height | `image_width`, `image_height` — 640 × 640 for 3,581 patches, larger (square, up to 4964) for 74 |
| Patch latitude / longitude | `patch_latitude`, `patch_longitude`, and four corners in `patch_geolocation` |
| Oil object latitude / longitude | `objects[].latitude`, `objects[].longitude`, four corners in `objects[].geolocation` |
| Oil object pixel coordinates | `objects[].pixel_coordinates` (`xmin, ymin, xmax, ymax`) |
| Oil object pixel size | `objects[].pixel_size` (bbox `width`/`height`/`area`, plus published `label_size_pixels`) |
| Sentinel-1 platform and product information | `sentinel1` — platform, sensor, mode, product type, resolution class, processing level, polarisation, sensing window, absolute orbit, data-take id, product unique id, SAFE format, Copernicus Browser link |

Full field reference: `docs/DATA_DICTIONARY.md` · machine-readable:
`metadata/schema.json`.

## Image sets

| Prefix | Meaning | Patches | Annotations |
|---|---|---|---|
| `oc` | oil / coast | 375 | yes |
| `ow` | oil / water | 990 | yes |
| `nc` | no oil (look-alike) / coast | 351 | none |
| `nw` | no oil (look-alike) / water | 1,939 | none |

The no-oil sets are genuine SAR phenomena that resemble slicks — a detector
should find oil in the `o*` sets and reject the `n*` sets. Their records carry
`oil_present: false` and an empty `objects` array.

## How this package was built

`source/DARTIS_2019.tab` (the published PANGAEA table, 5,515 rows) was joined to
the 1,365 PASCAL-VOC XML files and the 3,655 image files on disk. Every image
matched a table row, every annotation matched its image, and all 3,225 object
bounding boxes agree between the XML and the table — no orphans, no conflicts.
Sentinel-1 platform details are decoded from each SAFE product identifier;
patch centres, bounding boxes, GeoJSON polygons, pixel extents and SHA-256
image digests are computed. Nothing published was altered — the originals are
in `source/`.

## Citation and licence

Yang, Yi-Jie; Singha, Suman (2025): *Oil slicks, look-alikes and other
remarkable SAR signatures in Sentinel-1 imagery in the Eastern Mediterranean Sea
in 2019* [dataset]. PANGAEA, https://doi.org/10.1594/PANGAEA.980773

Licence: **CC-BY-4.0** — display the citation wherever you display the data.

Companion paper: Yang, Y.-J.; Singha, S.; Goldman, R.; Schütte, F. (2025),
*Earth System Science Data* 17(12), 6807–6837,
https://doi.org/10.5194/essd-17-6807-2025

Contains modified Copernicus Sentinel data (2019).
