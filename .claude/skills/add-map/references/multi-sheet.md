# Multi-sheet / 拼幅 maps (方案 B)

Use this variant when **one logical map was scanned as several separate images**
(different pixel sizes, slight scale/orientation differences) — e.g. `chengdu-1915`
scanned as a left (城西) and a right (城东) half. The canonical write-up is
[`docs/adding-a-map.md`](../../../../docs/adding-a-map.md) 附二; this is the agent
checklist.

## Why not just stitch the pixels

Separately-scanned sheets have proportion/orientation drift, so a pixel-level
`+append` misaligns and bakes the error permanently into the tiles. Instead merge
**at the geographic layer**: each sheet is georeferenced independently and pinned to
real lat/lng, so they meet correctly on the basemap and the seam is _geographically
correct_ rather than pixel-glued.

The repo's annotation is an `AnnotationPage` with an `items[]` array; the renderer
adds the whole page as one georeference annotation and sets opacity on the whole
layer. So **N sheets in one annotation's `items[]` = one layer = one timeline
station = one shared opacity slider.**

## What changes vs the single-image flow

Run the mechanical half (SKILL.md Steps 2–5) **once per sheet**:

1. **Per-sheet ASCII id**: `<mapId>-left`, `<mapId>-right`, … (or `-1`, `-2`, …).
   Each sheet is preprocessed, tiled, uploaded to `.../iiif/<sheetId>`, and
   verified public+CORS on its own. Pick which sheet is **primary** (`items[0]`) —
   that's the one whose `info.json` URL goes into `maps.ts` `iiifInfoUrl`.

2. **Georeferencing (Step 6) runs once per sheet**, each against its own
   `info.json`. Extra guidance to hand the user:
   - Place **extra control points along the seam side** of each sheet.
   - If the sheets **overlap**, pick the _same_ features in the overlap band on both
     sheets and pin each to the **same lat/lng** → the seam necessarily coincides.
     Each sheet's independent warp absorbs its own scan drift.

3. **Merge the exported annotations into ONE file**
   `src/data/annotations/<mapId>.json`: collect each sheet's exported Annotation
   into a single `items` array. **Primary sheet must be `items[0]`** — the validate
   gate uses it as the dead-link anchor (`items[0].target.source.id` must equal the
   `iiifInfoUrl` base).

4. **Registration (Step 7) is normal**: one `maps.ts` entry + one `epochs.ts`
   station, renderer untouched. `iiifInfoUrl` points at the **primary** sheet's
   `info.json`.

## Validation notes (Step 7 / Step 8)

The gates already support multiple items:

- [`scripts/validate-data.ts`](../../../../scripts/validate-data.ts) checks
  `items[0].source.id == iiifInfoUrl` base **and** that _every_ other item's
  `source.id` starts with the shared `.../iiif/` prefix — so a single mis-pointed
  sheet can't slip through CI.
- [`tests/georef.test.ts`](../../../../tests/georef.test.ts) iterates every item,
  asserting control-point count, Chengdu bbox, and pixel bounds per sheet.

So when pre-checking in Step 7, verify **all** items: `items[0].source.id` equals
the primary base, and each remaining item shares the `.../iiif/` prefix.

Worked example in the tree: `mapId=chengdu-1915`, sheets `chengdu-1915-left` /
`chengdu-1915-right`, `iiifInfoUrl` → `chengdu-1915-left/info.json`.
