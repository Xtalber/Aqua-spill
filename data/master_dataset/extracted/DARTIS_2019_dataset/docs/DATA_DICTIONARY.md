# DARTIS_2019 — data dictionary

Every field a record exposes, where it comes from, and what it means.
Machine-readable version: `metadata/schema.json`.

## Identity

| Field | Source | Meaning |
|---|---|---|
| `record_id` / `patch_id` | image filename | Primary key, e.g. `oc-0001`. Unique across the package. |
| `sar_image_filename` | image file | Name as stored here, e.g. `oc-0001.jpg`. |
| `xml_annotation_filename` | PANGAEA table | `oc-0001.xml`; `null` for no-oil patches (they carry no annotation). |
| `patch_name` | PANGAEA table | Original patch name inside the Sentinel-1 scene: `S1_<date>_<start>_<end>_<pol>_<patch index>`. This is also the `<filename>` written inside the XML. |
| `image_set` | filename prefix | `oc` oil/coast · `ow` oil/water · `nc` no-oil/coast · `nw` no-oil/water. |
| `class`, `scene_type`, `oil_present` | derived from `image_set` | `oil`/`no_oil`, `coast`/`water`, boolean. |

## Acquisition

| Field | Meaning |
|---|---|
| `start_time`, `end_time` | Acquisition window of the source scene, UTC ISO-8601. |
| `sentinel_product_id` | Sentinel-1 SAFE product identifier. A few patches straddle two slices; those carry both ids joined with `;`. |
| `sentinel_product_ids` | The same ids as a list (always use this one in code). |
| `sentinel_product_count` | 1 for most patches, 2 for slice-straddling patches. |

## Image geometry

| Field | Meaning |
|---|---|
| `image_width`, `image_height` | Patch size in pixels. 3,581 patches are 640 × 640; 74 are larger squares (up to 4964 × 4964) holding slicks that do not fit a 640-pixel window. Verified against the JPEG headers for all 3,655 images. |
| `image_depth` | Channels from the XML `<size>` block: 1 (single-channel VV amplitude). |
| `patch_latitude`, `patch_longitude` | Patch centre, WGS84, mean of the four corners. |
| `patch_geolocation.upper_left / upper_right / bottom_right / bottom_left` | Corner coordinates as published. |
| `patch_geolocation.bbox` | Axis-aligned min/max envelope — use it for spatial filtering. |
| `patch_geolocation.geojson_polygon` | RFC 7946 polygon (lon, lat order) ready to hand to Leaflet or Mapbox. |

## Oil objects (`objects[]`, empty for no-oil patches)

| Field | Meaning |
|---|---|
| `object_id` | Dataset tag, e.g. `ow-0004-02-000005` = patch · object index · global counter. |
| `object_index` | 1-based index within the patch. |
| `label` | Class from the annotation — `oil` for all 3,225 objects. |
| `pixel_coordinates` | `xmin, ymin, xmax, ymax` in patch pixel space, origin at the upper-left corner. Identical in the XML and the PANGAEA table (verified for all 3,225 objects). |
| `pixel_size.width/height` | Bounding-box extent in pixels. |
| `pixel_size.bbox_area_pixels` | `width × height`. |
| `pixel_size.label_size_pixels` | Published oil-object area in pixels — the annotated slick area, which is smaller than the bounding box. |
| `pixel_center` | Bounding-box centre in pixels, handy for drawing markers on the patch. |
| `geolocation` | Four corner coordinates of the object footprint, plus `center`, `bbox` and `geojson_polygon`. |
| `latitude`, `longitude` | Oil-object centre, WGS84. |
| `truncated` | `1` when the slick is cut off by the patch border. |
| `difficult` | PASCAL-VOC difficulty flag (`0` throughout). |
| `matched_in_xml` | `true` when the box was found in both the XML and the table. |

## Sentinel-1 platform and product information (`sentinel1`)

Decoded from the SAFE identifier, e.g.
`S1B_IW_GRDH_1SDV_20190101T034300_20190101T034325_014295_01A97E_39B8.SAFE`:

| Field | Example | Meaning |
|---|---|---|
| `platform` | Sentinel-1B | Satellite (1,877 patches from Sentinel-1A, 1,778 from Sentinel-1B). |
| `sensor` | C-band Synthetic Aperture Radar (C-SAR) | Instrument. |
| `acquisition_mode` / `_name` | IW / Interferometric Wide swath | Imaging mode. |
| `product_type` / `_name` | GRD / Ground Range Detected | Product family. |
| `resolution_class` / `_name` | H / High resolution | GRD resolution class. |
| `processing_level` | 1 | Level-1 product. |
| `product_class` / `_name` | S / Standard | Standard (not internal annotation) product. |
| `polarisation_code` / `polarisation` | DV / Dual polarisation VV+VH | Polarisation of the source product. |
| `polarisation_channel_used` | VV | Channel the patches were rendered from. |
| `sensing_start_utc`, `sensing_stop_utc` | 2019-01-01T03:43:00Z | Sensing window encoded in the product id (the slice; `start_time`/`end_time` describe the scene). |
| `absolute_orbit_number` | 14295 | Absolute orbit. |
| `mission_data_take_id` | 01A97E | Data-take id (hex). |
| `product_unique_id` | 39B8 | Product unique identifier (hex). |
| `product_format` | SAFE | Standard Archive Format for Europe. |
| `copernicus_hub_query` | URL | Copernicus Browser search link for the source product. |
| `slice_count`, `all_product_ids` | 1 / [...] | Present when a patch spans two slices. |

## Files and matching

| Field | Meaning |
|---|---|
| `files.image` | Path of the image inside the package. |
| `files.annotation` | Path of the XML, or `null`. |
| `files.record` | Path of this JSON record. |
| `files.image_bytes` | Image size in bytes. |
| `files.image_sha256` | SHA-256 of the image — content-based matching for renamed uploads. |
| `lookup_keys` | Every lowercase name this record answers to: package filename, stem, original patch name (with and without extension), XML name, and object tags. |
| `xml_annotation` | Verbatim parse of the source XML (folder, filename, path, source, size, objects). |
| `source` | Provenance: dataset, DOI, citation, licence, number of source table rows. |
