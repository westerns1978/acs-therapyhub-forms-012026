# Two recons — 2026-08-07

**Report only. Nothing deleted, nothing changed.** Both need a decision, not a cleanup.

---

# 1. Orphan disposal — 29 objects pointing at charts that no longer exist

## Current state of `therapyhub-patient-files`

| | |
|---|---|
| objects | 37 |
| metadata rows | 6 |
| orphans (object, no `uploaded_files` row) | **31** |
| └ resolving to a **live** chart | 2 |
| └ pointing at a **deleted** chart | **29** |

The 2 live-chart orphans are Marcus Reyes's duplicate `updated_headshot.JPG` pair from
today's call. They are recoverable the same way Bela Lugosi's scan just was, and are
**not** part of this disposal question.

## The 29, by dead chart

Total ≈ **24 MB**. Path shape is `clients/<uuid>/<epoch>_<filename>`, so the intended
chart is legible — the chart row itself is simply gone.

| uploaded | filename | size | dead client uuid |
|---|---|---|---|
| 2026-06-08 | `1776397726486_dw-license.jpg` | 46 kB | `11111111-…-111111111111` |
| 2026-06-18 | `1781785069027_scan_1781784604960.jpg` | 157 kB | `7286f2a2-38c3-4006-a01b-023611f1bdbd` |
| 2026-06-29 | `1782762263443_scan_1782762235358.jpg` | 170 kB | `7286f2a2-…` |
| 2026-07-07 | `1783439503031_scan_1783439485277.jpg` | 184 kB | `7286f2a2-…` |
| 2026-07-14 | `1784045675267_scan_1784045666232.jpg` | 181 kB | `7286f2a2-…` |
| 2026-07-14 | `1784078120451_20260714_161602.jpg` | 2091 kB | `7286f2a2-…` |
| 2026-06-08 | `1778737008119_download_(2).jfif` | 9.6 kB | `aaaaaaaa-…-aaaaaaaaaaaa` |
| 2026-06-08 | `1778736172846_unnamed_(8).png` | 4719 kB | `aaaaaaaa-…` |
| 2026-06-08 | `1778779185334_scan_1778779145657.jpg` | 126 kB | `aaaaaaaa-…` |
| 2026-06-08 | `1778765336725_ACS-TherapyHub.pdf` | 1902 kB | `bbbbbbbb-…-bbbbbbbbbbbb` |
| 2026-06-08 | `1778769932691_Briefing_on_Missouri's_SUD_Treatment_and_Justice_System.pdf` | 135 kB | `bbbbbbbb-…` |
| 2026-06-08 | `1780583580938_Compliance_Status_Pat_Novak.pdf` | 5.5 kB | `bbbbbbbb-…` |
| 2026-06-08 | `1779616021988_Story_Scribe_Service_Overview.png` | 4317 kB | `bbbbbbbb-…` |
| 2026-06-08 | `1780611541171_scan_1780611528960.jpg` | 173 kB | `bbbbbbbb-…` |
| 2026-06-08 | `1780585271506_scan_1780585265383.jpg` | 156 kB | `bbbbbbbb-…` |
| 2026-06-08 | `1764486232287_Client Demographic.pdf` | 343 kB | `cccccccc-…-cccccccccccc` |
| 2026-06-08 | `1764487073253_G67XP4ZXAAAimdp.jfif` | 280 kB | `cccccccc-…` |
| 2026-06-29 | `1782775274323_CIMOR_Placement_Packet_Flower_Tester_Level_III.pdf` | 10 kB | `dd9098b2-b24b-472a-a8ea-a635c510884e` |
| 2026-06-30 | `1782849291194_scan_1782849282700.jpg` | 106 kB | `dd9098b2-…` |
| 2026-07-14 | `1784043529377_Status_Report.pdf` | 51 kB | `dd9098b2-…` |
| 2026-07-14 | `1784070697636_Gemini_Generated_Image_79gsxk79gsxk79gs.png` | 7877 kB | `dd9098b2-…` |
| 2026-06-09 | `1781034799212_AA-Step-1-Worksheet-Ingrained-Recovery.pdf` | 287 kB | `f1c50002-…-000000000002` |
| 2026-07-05 | `1783262103931_scan_1783262086601.jpg` | 172 kB | `f1c50004-…-000000000004` |
| 2026-07-21 | `1784644820454_ft2en.jpg` | 255 kB | `f1c50004-…` |
| 2026-06-14 | `1781472746037_ASSESSMENT_Treatment_Plan.docx` | 19 kB | `f1c50008-…-000000000008` |
| 2026-06-29 | `1782778737646_2license-front.jpg` | 786 kB | `f1c5000b-…-00000000000b` |
| 2026-07-01 | `1782943347254_scan_1782943332306.jpg` | 173 kB | `f1c5000b-…` |
| 2026-06-08 | `1778769682054_download_(2).jfif` | 9.6 kB | `ffffffff-…-ffffffffffff` |
| 2026-06-08 | `1779148465621_scan_1779148449778.jpg` | 179 kB | `ffffffff-…` |

**9 dead uuids**, in three recognisable families:
- `aaaaaaaa…`/`bbbbbbbb…`/`cccccccc…`/`ffffffff…`/`11111111…` — the earliest hand-made demo namespace.
- `f1c5xxxx…` — a later demo namespace.
- `7286f2a2…`, `dd9098b2…` — real-looking random uuids. **These two are the ones that matter**; `dd9098b2` carries a `CIMOR_Placement_Packet_Flower_Tester_Level_III.pdf`, i.e. a name ("Flower Tester") that reads as a test persona rather than a person. `7286f2a2` holds five phone scans and nothing name-bearing.

Not all 29 are clinical: `ACS-TherapyHub.pdf` (a sell sheet), `Story_Scribe_Service_Overview.png` (a different product), a Gemini-generated image, and a Missouri policy briefing are plainly not client records at all. Roughly **19 MB of the 24 MB is those four non-record files.**

## Is there a policy in this repo? No.

Searched every `.md`, `.ts`, `.tsx`, `.sql` for retention / destruction / disposal /
purge / records-schedule language. **There is no retention policy, no destruction
procedure, and no records schedule anywhere in this repository.** `9 CSR 10-7.030` is
cited 8 times but only ever for record *content* and *cadence* (treatment-plan review
at 180 days, consent ≤365 days, progress notes within 5 business days, discharge
summary) — never for how long a record is kept or how it is destroyed.

So a "documented disposal" cannot cite an internal policy today, because none exists.
**Writing that policy is the prerequisite, not the cleanup.**

## What the regulations actually impose — and what I could not verify

Stated precisely, because this is the part worth getting right:

- **42 CFR Part 2 does not set a general retention period.** It governs *confidentiality
  and disclosure* of SUD records, not how long to keep them. Its operative hook here is
  **§2.19 (disposition of records when a program closes/discontinues)**, which is about
  a program ceasing operation — not this situation. Part 2's relevance to these 29 files
  is that *while they exist* they are protected, and any destruction should be logged as
  a records action rather than done silently.
- **HIPAA's 6-year rule (§164.316(b)(2)) is about documentation** — policies, procedures,
  and required records of the compliance program — **not** patient medical records.
  It is routinely misquoted as a medical-record retention period. It is not one.
- **Retention of the clinical record itself is set by state law**, and for a Missouri
  DMH-certified SUD program that lives in the 9 CSR chapters this app already cites.
  **I could not verify the specific rule number or number of years from anything in this
  repo, and I am not going to state a figure I cannot cite.** That specific number is the
  one fact you need before writing the decision down, and it should come from the actual
  9 CSR text or ACS's compliance counsel — not from me.

## What a documented disposal would require

1. **The retention number, sourced.** The controlling 9 CSR citation and its period, in
   writing. Everything below is blocked on this.
2. **A record-vs-not determination per file.** At least 4 of the 29 are plainly not
   client records (sell sheet, Story Scribe overview, Gemini image, policy briefing) and
   can be disposed of as ordinary files. The rest must be treated as records until shown
   otherwise.
3. **Whether a deleted chart resets the clock.** It does not, in general — destroying the
   chart row does not discharge a retention obligation on the underlying record. If these
   correspond to real people, the retention clock still runs. If they correspond to demo
   personas that were never real clients, there is no obligation at all. **Establishing
   which is which is the real work**, and `7286f2a2…` / `dd9098b2…` are the two that need
   a human answer.
4. **A destruction log.** Whatever is destroyed should leave a record of what, when, by
   whom, and under what authority. `audit_logs` already exists and is append-only, so it
   is the natural home; no new table needed.
5. **A decision on the 2 live-chart orphans** — recover them onto Marcus's chart (one
   INSERT each, exactly as Bela's was recovered) or dispose of them. They are duplicates
   of each other, so at most one is worth keeping.

## Recommendation

Do **not** delete anything yet. The cheap, safe, correct next step is to **recover rather
than destroy**: back-filling a metadata row makes an orphan visible, reviewable and
disposable *through the app*, with `needs_review=true` putting it in front of a clinician.
That converts an undocumented blob into a tracked record you can then dispose of under a
policy — which is the opposite order from deleting first and documenting later.

---

# 2. `cdn.tailwindcss.com` — what self-hosting costs

## What it is

[index.html:33](index.html)

```html
<script src="https://cdn.tailwindcss.com"></script>
```

That is the **Play CDN runtime compiler**, not a built stylesheet. Tailwind does not
appear in `package.json` at all — no `tailwindcss`, no `postcss`, no `autoprefixer`.
The entire design system is compiled **in the browser, on every page load**, from a
**240-line inline `tailwind.config`** in the same file (`theme.extend` colours, the
`fadeInUp`/`aurora` keyframes, `animation`, `backdropBlur`, `boxShadow` — v3-style config).

Tailwind's own documentation says the Play CDN is for development only and should not be
used in production.

## What it costs today

- **Render-blocking third-party script.** Confirmed via Resource Timing:
  `initiatorType: "script"`, `renderBlockingStatus: "blocking"`. Nothing paints until a
  third party responds.
- **Total visual failure, not degradation, if it is unreachable.** Every style in this app
  is a Tailwind utility. If the CDN is down, blocked by a clinic firewall, or unreachable
  on a client's network, the app renders as unstyled HTML. There is no fallback.
- **Arbitrary code execution from a third party inside a Part 2 app.** Unlike the
  ui-avatars leak removed today, this one *executes* rather than merely leaking — it is
  the larger supply-chain surface even though it receives no identity. It is also why a
  meaningful CSP cannot be written today.
- **Silent version drift.** The CDN is unpinned (`Cache-Control: max-age=14400`); a
  Tailwind release changes the app's rendering with no commit and no review.

## What the fix actually involves

**Low risk, and I measured why.** The thing that usually makes a Play-CDN → build port
dangerous is purge: the CDN generates styles on demand from the live DOM and never
purges, so any class name assembled at runtime silently disappears under a build-time
content scan.

I checked for exactly that, across `components/ pages/ layouts/ contexts/ hooks/`:

```
partial utility tokens built by interpolation  (bg-${…}, text-${…}, border-${…}, …):  0
dynamically constructed className expressions:                                        0
distinct arbitrary-value utilities (bg-[#4C6FA5] etc.):                             100
```

**Zero purge-breaking patterns.** Every utility appears as a complete literal token in a
scannable file, and the 100 arbitrary-value utilities are handled natively by the JIT at
build time. The `${className}` interpolations that do exist pass whole class strings
through from call sites where the literals are present.

Steps:

1. `npm i -D tailwindcss@3 postcss autoprefixer`
2. Move the 240-line inline `tailwind.config` from `index.html` into `tailwind.config.js`
   verbatim, plus `content: ['./index.html','./{components,pages,layouts,contexts,hooks,config,data}/**/*.{ts,tsx}','./App.tsx','./index.tsx']`
3. `postcss.config.js` with the two plugins.
4. Add `@tailwind base/components/utilities` to a CSS entry and import it from `index.tsx`.
5. Delete the `<script src="https://cdn.tailwindcss.com">` tag.

Vite emits a hashed CSS file into `dist/assets/`, and the app becomes fully self-hosted.

**Verification the repo already gives you**, which is what makes this genuinely safe to
attempt: `check:brand --dist` asserts `#C62828` is reachable in the built output, and the
**20 print baselines are byte-identical HTML comparisons** — they compare markup, not
computed styles, so they will not mask a styling regression but will catch any structural
change. The honest visual check is a before/after screenshot pass over the main surfaces.

**Watch items:** `public/index.css` currently carries `var(--brand)` fallbacks and is
asserted by `check:brand` — it must keep being served, so it should be imported or left in
`public/` deliberately, not folded into the Tailwind entry by accident. And `index.html`
carries a `BRAND-STATIC-COPY` documentation block that references the config; moving the
config means updating that note.

**Estimate:** a focused session — the port itself is mechanical, and the time goes into
the before/after visual pass, not the build wiring.
