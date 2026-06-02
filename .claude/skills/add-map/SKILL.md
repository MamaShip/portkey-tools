---
name: add-map
description: >-
  Add a new historical map to the 成都老地图 (chengdu-historical-map) tool in this
  repo — the end-to-end pipeline that gets a scan onto the timeline: interview for
  inputs → IIIF-tile → upload to Wasabi → verify CORS → hand off the manual Allmaps
  georeferencing step and WAIT for the annotation JSON → register in maps.ts +
  epochs.ts → run the quality gates + preview. Trigger whenever the user wants to
  add / 新增 / 加一张 a 历史地图 or 老地图, has a deskewed Chengdu map scan to put on
  the site, names a `chengdu-<year>` mapId, asks to follow docs/adding-a-map.md, or
  mentions any single stage of the pipeline — slicing / IIIF tiles, uploading tiles
  to Wasabi/the bucket, 配准 / 标定 / Allmaps georeferencing, or registering an
  already-exported annotation. It's all one workflow, so trigger even on a partial
  request like "tile chengdu-1939.jpg, push it to the bucket, then tell me how to
  georeference it", and on multi-sheet / 拼幅 maps. Do NOT use for: re-baking the
  OpenFreeMap basemap; scaffolding a brand-new tool/route; re-georeferencing or
  editing an existing on-site map's alignment or metadata; changing timeline labels
  or site copy; or debugging pnpm validate errors.
---

# 新增一张历史地图（add-map）

This skill is the **agent playbook** for the SOP in
[`docs/adding-a-map.md`](../../../docs/adding-a-map.md). That doc is the canonical
source of truth for _why_ each command is shaped the way it is and for the full
pitfalls table; **read it if anything here is ambiguous or a command errors.**
This skill adds what the doc doesn't: _what to ask, when to pause, and how to
verify_ as an agent driving the process.

## The one thing that makes this workflow special

There is a **hard human-only step in the middle**: geo-referencing in the Allmaps
Editor (pairing control points by eye). You cannot do it. So the workflow splits
in two:

1. **Mechanical half (you run, with confirmation):** preprocess → tile → upload →
   verify. Pure machinery, no geography.
2. **⏸ Handoff:** you give the user exact georeferencing instructions and **STOP**.
3. **Registration half (you run after they return):** validate the annotation,
   register in `maps.ts` + `epochs.ts`, run gates, preview, summarize. Stop before
   committing (the user commits).

Run-with-confirmation means: **show each `java`/`rclone`/`curl` command before
running it**, run it, and check its output before moving on. Never skip the
verification sub-steps — a wrong `-identifier` slash or an un-public bucket silently
breaks the map and is annoying to debug later.

> **Multi-sheet / 拼幅 maps** (one map scanned as several images, like
> `chengdu-1915` left+right): the mechanical half runs N times and the sheets merge
> into one annotation. Read [`references/multi-sheet.md`](references/multi-sheet.md)
> and follow that variant instead. Ask the user up front whether the source is one
> image or several.

---

## Step 0 — Preflight

Confirm you're at the repo root (the dir with `package.json` and `src/data/maps.ts`).
Then check the tools the mechanical half needs and report what's missing — don't
assume they're installed:

```bash
node -v && pnpm -v          # project is on Node 22 / pnpm 10
java -version               # needed for iiif-tiler.jar (tiling)
rclone listremotes          # must list "wasabi:" (the S3 remote)
ls -la iiif-tiler.jar       # the slicer, gitignored, lives at repo root
```

- Missing `wasabi:` remote or `iiif-tiler.jar` → point the user at
  [`docs/adding-a-map.md`](../../../docs/adding-a-map.md) §0 (one-time setup:
  `rclone config` for Wasabi, and the `curl` to fetch `iiif-tiler.jar` v1.0.2).
  Don't try to invent credentials.
- If only the registration half is needed (the user already has tiles uploaded and
  an annotation file), you can skip to Step 6.

---

## Step 1 — Interview (gather every input before touching anything)

Collect these up front so the later steps run unattended. Read the existing
[`src/data/maps.ts`](../../../src/data/maps.ts) and
[`src/data/epochs.ts`](../../../src/data/epochs.ts) first — you need the current ids
and `order` values, and you must not collide with an existing `id`.

| Input                   | How to get it          | Default / notes                                                                                                                                                                                                               |
| ----------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **source image path**   | Ask.                   | A high-res, deskewed, cropped scan. **View the image** (Read tool) to sanity-check it's a Chengdu map and to help fill title/year if the user is unsure.                                                                      |
| **`mapId`**             | Ask or derive.         | `chengdu-<year>` or `chengdu-<year>-<qualifier>`, **ASCII kebab-case**. Must be unique vs existing ids. **Stable forever once published** (it's the storage path, info.json id, annotation key, and registry id all at once). |
| **`title`**             | Ask.                   | The Chinese map name, e.g. 《1933年成都街市图》.                                                                                                                                                                              |
| **`year`**              | Ask.                   | Integer (start year if a range).                                                                                                                                                                                              |
| **`provenance.source`** | Ask — **required**.    | Holding institution / origin. Goes on the 来源与版权 page; don't leave a placeholder.                                                                                                                                         |
| `provenance.author`     | Ask if known.          | Optional. Usually the period's surveying bureau.                                                                                                                                                                              |
| `provenance.license`    | —                      | Default `"Public Domain"` for old maps.                                                                                                                                                                                       |
| `provenance.notes`      | Ask if known.          | Optional one-liner on dating/printing.                                                                                                                                                                                        |
| **`attribution`**       | Compose with the user. | The on-map credit line, e.g. `《…》· …制（公共领域）`.                                                                                                                                                                        |
| `defaultOpacity`        | —                      | Default `0.7` (matches every existing map).                                                                                                                                                                                   |
| `toolId`                | —                      | Default `chengdu-historical-map`. Only changes if this is for a different tool.                                                                                                                                               |
| **timeline `order`**    | Compute.               | Slot the map chronologically among existing epochs. Existing: 1911→40, 1915→45, 1933→50, 1944→55, present→100. Pick a value between the year's neighbors (e.g. a 1950 map → ~60). Bigger = newer.                             |
| epoch `default`         | Ask only if relevant.  | Set `default: true` **only** if this should be the first-screen map — and then remove `default` from whatever currently has it (at most one allowed; the gate enforces this). Usually leave unset.                            |

Echo the collected inputs back as a short summary and get a thumbs-up before
running anything.

---

## Step 2 — Preprocess (ASCII filename)

The slicer bakes the **filename (sans extension)** into the IIIF `info.json` `id`,
so the working file **must** be ASCII `<mapId>.<ext>`. If the source has a Chinese
name or differs from `mapId`, copy it (don't rename the original):

```bash
cp "<source path>" <mapId>.jpg     # e.g. cp 1950成都图.jpg chengdu-1950.jpg
```

The source `*.jpg` is gitignored — it never enters git.

---

## Step 3 — Tile to static IIIF (the mechanical core, no geography)

```bash
java -jar iiif-tiler.jar <mapId>.jpg \
  -version 3 -tile_size 512 -output tiles \
  -identifier https://s3.ap-southeast-1.wasabisys.com/portkey/tools/<toolId>/iiif/
```

**Three things that must be exactly right** (see the doc's pitfalls table):

1. `-identifier` **must end in a trailing `/`**. The tool appends the filename, so
   `.../iiif/` + `chengdu-1950` → `.../iiif/chengdu-1950` ✅; a missing slash glues
   them into `.../iiifchengdu-1950` ❌ (broken link).
2. The identifier **must equal the public Wasabi URL base** the tiles will live at
   (the Step 4 prefix). That's why `toolId`/`mapId` are fixed before slicing.
3. `-version 3` (Allmaps uses IIIF v3) and `-tile_size 512` are deliberate —
   defaults are v2.1.1 / 1024, which are wrong here.

**Verify `info.json` immediately:**

```bash
grep -oE '"(id|type)" : "[^"]*"|"width" : [0-9]+|"height" : [0-9]+' tiles/<mapId>/info.json | tail -3
```

Expect `id = .../iiif/<mapId>` (no missing/doubled slash), `type = ImageService3`,
and width/height equal to the real source pixels. If the id is wrong, fix the
`-identifier` and re-tile.

---

## Step 4 — Upload to Wasabi

```bash
rclone copy ./tiles/<mapId> \
  wasabi:portkey/tools/<toolId>/iiif/<mapId> --transfers 16 --progress
```

⚠ Upload to the **namespaced prefix**, not the bucket root (directory convention in
[`docs/object-storage.md`](../../../docs/object-storage.md)). rclone sets
Content-Type by extension automatically. The bucket/prefix must be **public**
(set in the Wasabi console) — CORS needs no config (Wasabi returns permissive
headers).

---

## Step 5 — Verify public + CORS + Content-Type

Reproduce the browser request with an `Origin` header:

```bash
BASE=https://s3.ap-southeast-1.wasabisys.com/portkey/tools/<toolId>/iiif/<mapId>
curl -s -I -H "Origin: https://tools.portkey.click" "$BASE/info.json" \
  | grep -iE 'HTTP/|content-type|access-control-allow-origin'
```

Expect `200 OK` · `Content-Type: application/json` · `Access-Control-Allow-Origin: *`.
A 403 or missing CORS header means the bucket/prefix isn't public → fix in the
Wasabi console (Step 4), don't proceed. The `info.json` URL you just verified is
the one that goes into `maps.ts` (`iiifInfoUrl`) and that the user pastes into the
Allmaps Editor next.

The mechanical half is done. The tiles live in the bucket; local `tiles/<mapId>/`
and the `.jpg` are gitignored scratch you can leave or clean up later.

---

## Step 6 — ⏸ Georeferencing handoff (STOP and wait)

**This is the human-only step. Hand the user precise instructions and then stop —
do not continue until they confirm the annotation file is saved.** Give them, with
the real values filled in:

> 1. Open **https://editor.allmaps.org**, paste this info.json URL and press Enter:
>    `<BASE>/info.json`
> 2. Enter control-point mode and place **8–15 well-distributed pairs** (all four
>    corners **and** the center — don't cluster downtown). For each pair: click a
>    recognizable feature on the old map, then click where it is on the modern
>    basemap. Good anchors: city-gate/wall corners, river confluences (府河+南河 /
>    合江亭), 文庙 / 武侯祠 / 青羊宫, major crossroads, bridges.
> 3. Transform: default **polynomial order 1** (affine) is fine for Republican-era
>    survey maps. For older / more distorted scans switch to **TPS** (thin-plate
>    spline) and add extra corner points.
> 4. Export the **Georeference Annotation** and save it to:
>    `src/data/annotations/<mapId>.json`
>    ⚠ Its `target.source.id` **must equal** the info.json `id`
>    (`<BASE>`, no `/info.json`) or the viewer can't fetch tiles.
>
> Re-georeferencing later just means re-exporting over that JSON — no re-tiling.

Then tell them: _"When you've saved `src/data/annotations/<mapId>.json`, let me know
and I'll validate it and finish the registration."_ **Wait.** Don't poll
aggressively or fabricate the annotation — the control points are the user's
judgment, not something you can produce.

---

## Step 7 — Resume: validate the annotation, then register

When the user returns, first confirm the file exists and pre-check the link
alignment **before** editing the registries — this mirrors the
[`scripts/validate-data.ts`](../../../scripts/validate-data.ts) gate, so catching it
here saves a red gate later:

- `src/data/annotations/<mapId>.json` exists and parses as JSON.
- `items[0].target.source.id` **equals** `<BASE>` (the info.json id, i.e.
  `iiifInfoUrl` with `/info.json` stripped). If not, the user exported against the
  wrong info.json URL — send them back to Step 6 to re-export. (Multi-sheet: also
  check every other item's `source.id` shares the `.../iiif/` prefix — see the
  references doc.)

Then register the map. **Don't touch `MapViewer.tsx` or any rendering code** — the
renderer is registry-driven; three entries make the map appear automatically.

**7a — [`src/data/maps.ts`](../../../src/data/maps.ts):** insert an entry
(chronological position), matching the existing style:

```ts
{
  id: "<mapId>",
  title: "<title>",
  year: <year>,
  iiifInfoUrl:
    "<BASE>/info.json",
  annotationPath: "src/data/annotations/<mapId>.json",
  defaultOpacity: 0.7,
  provenance: {
    source: "<provenance.source>",
    author: "<author, if known>",
    license: "Public Domain",
    notes: "<notes, if known>",
  },
  attribution: "<attribution>",
},
```

**7b — [`src/data/epochs.ts`](../../../src/data/epochs.ts):** insert one station at
the computed `order`:

```ts
{
  id: "<year>",
  label: "<year>",
  order: <computed order>,
  kind: "historical",
  mapId: "<mapId>",
},
```

If the user wants this as the first-screen default, add `default: true` here and
remove `default` from the epoch that currently has it.

The annotation auto-loads by convention (`import.meta.glob` keyed on filename =
`mapId`) — no import to add.

---

## Step 8 — Gates + preview, then summarize and stop

Per the repo's 铁律, run the **whole-repo aggregate**, not just changed files
(CLAUDE.md). After your edits:

```bash
pnpm fix      # prettier --write the whole repo, then run all five gates
```

`pnpm fix` auto-formats then runs `check + lint + format:check + validate + test`.
If anything is non-green — **even in a file you didn't touch** — fix it to green;
don't dismiss it as unrelated. The two gates most likely to react to this change:
`validate` (schema + the source.id link check from Step 7) and `test`
(`tests/georef.test.ts` auto-covers the new map: ≥6 control points, geo inside the
Chengdu bbox lng 103.6–104.4 / lat 30.3–30.9, pixels within source size). A
`georef` failure usually means too few control points or a wrong-city/way-off
georeference → back to Step 6.

Then preview:

```bash
pnpm dev      # http://localhost:4321/cd-old-map
```

Tell the user what to eyeball: the new map sits on the timeline; switching to it
overlays the scan in roughly the right place (streets/gates/rivers approximately
matching — it's an approximate fit, not pixel-perfect); the opacity slider fades
现今 ↔ 历史 smoothly; no console errors from our code.

**Finally, summarize and stop** (don't commit — the user does that):

- The three git-tracked changes: `src/data/annotations/<mapId>.json`,
  `src/data/maps.ts`, `src/data/epochs.ts`.
- Gate result (which command, green or not).
- Reminder that tiles and the source scan stay out of git (gitignored) and now live
  in Wasabi; the PR's Cloudflare preview URL is the place to re-check alignment.

---

## Quick reference

- Full SOP + pitfalls table: [`docs/adding-a-map.md`](../../../docs/adding-a-map.md)
- Storage key convention: [`docs/object-storage.md`](../../../docs/object-storage.md)
- Multi-sheet / 拼幅 variant: [`references/multi-sheet.md`](references/multi-sheet.md)
- Data gate logic mirrored in Step 7:
  [`scripts/validate-data.ts`](../../../scripts/validate-data.ts)
