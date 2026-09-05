# Website / backend integration

## The lookup contract

A user uploads an image. You have its filename. You want every field this
dataset knows about it.

```
uploaded name  ->  normalise  ->  metadata/filename_lookup.json  ->  record_id
record_id      ->  metadata/records/<record_id>.json             ->  full record
```

`filename_lookup.json` is a flat `{ "name": "record_id" }` map of roughly 20,000
accepted names, about 1 MB. Load it once at boot and keep it in memory; every
lookup after that is a dictionary hit. Never scan the images directory.

## Names that resolve

A single record answers to all of these:

| Name | Example |
|---|---|
| Package filename | `oc-0001.jpg` |
| Filename stem | `oc-0001` |
| Original patch name | `s1_20190101_034235_034350_vv_0` |
| Patch name + extension | `s1_20190101_034235_034350_vv_0.jpg` (also `.png`, `.tif`, `.tiff`) |
| XML annotation name | `oc-0001.xml` |
| Object tag | `ow-0004-02-000005` |

Matching is case-insensitive: normalise to the basename in lowercase before the
lookup. The reference implementations also retry after stripping the extension,
so `oc-0001.png` still finds `oc-0001`.

Values in `filename_lookup.json` are always a single record id. `index.json`
keeps the same map under `aliases`, but stores an array there in the rare case
where one alias legitimately belongs to more than one record — read from
`filename_lookup.json` unless you need to handle that.

## Two ways to serve a lookup

**Per-request file read (recommended).** Load only `filename_lookup.json` at
boot, then read `metadata/records/<id>.json` on each request. Memory stays near
1 MB and records are already the exact JSON your API should return.

**Fully in memory.** Load `metadata/index.json` (about 3 MB) for a summary of
every image without touching the record files — enough for search results,
map pins and list views. Fall back to the record file when the user opens one
image and you need objects, pixel boxes and full Sentinel-1 detail.

## If the upload was renamed

Names are not the only handle. Every record carries `files.image_sha256`.
Build a hash index once at boot:

```python
BY_HASH = {r["files"]["image_sha256"]: r["record_id"] for r in iter_records()}
```

and fall back to it when the filename misses. That catches
`download (3).jpg` and any other browser-mangled name.

## Serving the image back

`files.image` is the path inside the package, e.g.
`images/oil/coast/oc-0001.jpg`. Serve it as a static file relative to your
unzipped dataset root — do not read the image through the JSON layer.

## Drawing the annotation

Pixel coordinates are in the patch's own pixel space
(`image_width` × `image_height`, origin at the upper-left corner), so they map
straight onto an `<img>` or `<canvas>` of that size. Most patches are 640 × 640,
but 74 are larger — always scale by `element_width / record.image_width` rather
than hard-coding 640.

```js
const sx = canvas.width / record.image_width;
const sy = canvas.height / record.image_height;
for (const o of record.objects) {
  const b = o.pixel_coordinates;
  ctx.strokeRect(b.xmin * sx, b.ymin * sy,
                 (b.xmax - b.xmin) * sx, (b.ymax - b.ymin) * sy);
}
```

## Putting it on a map

`patch_geolocation.geojson_polygon` and each object's
`geolocation.geojson_polygon` are RFC 7946 polygons in lon/lat order, so they
drop straight into Leaflet or Mapbox:

```js
L.geoJSON(record.patch_geolocation.geojson_polygon).addTo(map);
record.objects.forEach(o => L.geoJSON(o.geolocation.geojson_polygon,
                                      { style: { color: "#e5484d" } }).addTo(map));
```

For a whole-dataset view, `metadata/patches.geojson` (3,655 footprints) and
`metadata/oil_objects.geojson` (3,225 slick footprints) are ready-made layers.

## Search, filter, browse

`metadata/images.csv` and `metadata/objects.csv` are flat tables — load them
into Postgres, SQLite or pandas when you need queries the JSON layer cannot
answer efficiently:

```sql
CREATE TABLE images (sar_image_filename TEXT PRIMARY KEY, patch_id TEXT, ...);
CREATE INDEX images_class_idx ON images(class, scene_type);
CREATE INDEX images_time_idx  ON images(start_time);
```

Useful predicates: `class = 'oil'`, `object_count > 0`, a `start_time` range,
or a bounding box on `patch_latitude` / `patch_longitude`.

## Response shape

The record file is already a sensible API response. A thin envelope is usually
all you need:

```json
{ "found": true, "query": "oc-0001.jpg", "record": { ...metadata/records/oc-0001.json... } }
```

On a miss, return `404` with `{ "found": false, "query": "<name>" }` rather
than an empty record — the site can then say "this image is not part of the
DARTIS_2019 dataset" instead of rendering blank fields.

## What a no-oil record looks like

`nc-*` and `nw-*` patches are look-alikes: real SAR phenomena that resemble oil
but are not. They have `oil_present: false`, `object_count: 0`, an empty
`objects` array, and `xml_annotation_filename: null`. Guard your UI on
`object_count` rather than assuming every record has objects.

## Provenance

`manifest.json` carries the DOI, citation, licence (CC-BY-4.0), counts and
coverage. The dataset is CC-BY: display the citation wherever you display the
data. The original PANGAEA table and KML are kept unmodified in `source/`, so
anything here can be traced back to its published origin.
