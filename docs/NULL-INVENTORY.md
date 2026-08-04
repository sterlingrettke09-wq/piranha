# Null inventory — what the tool actually knows

**Measured live 2026-08-04** by calling `getParcelInfo` against one real parcel
per city (the published example parcels where they exist, city landmarks for the
five new cities) and reading what the engine emitted.

**This is the artifact that says whether the tool is fit to ship — not the test
count.** 651 tests pass regardless of whether a city resolves a FAR or invents
one. Only this table distinguishes an honest null from a bug.

## How to read it

Every null carries a reason code, because the four have completely different fix
costs and completely different honesty implications — and to a user they all
currently render the same:

| Code | Meaning | Fix cost |
|---|---|---|
| `not-published` | The jurisdiction does not publish it in any machine-readable form | High — needs code-text extraction, or it stays null forever |
| `published-not-fetched` | It exists in the city's code or GIS; we don't retrieve it | Medium — research + a table |
| `fetched-not-mapped` | **We already pull a layer that answers it and don't read it** | Low — wiring |
| `deliberately-conservative` | We could emit a number but choose a safer one | Zero — this is correct behaviour, recorded so it isn't "fixed" by mistake |

`fetched-not-mapped` is the one to hunt: it is a shipped defect where the tool
displays sourced intelligence next to a number that ignores it. Minneapolis is a
confirmed instance.

## Live result

| City | District probed | FAR outcome | Reason code |
|---|---|---|---|
| boston | MFR/LS | **RESOLVED** far=2 | — |
| nyc | R6B | **RESOLVED** far=2 (residential basis) | — |
| austin | MF-4 | **RESOLVED** far=0.75 | — |
| la | C2-1-O | **RESOLVED** far=1.5 | — |
| philadelphia | CMX-5 | **RESOLVED** far=12 | — |
| sf | NCD-24TH-NOE-VALLEY | **UNCONSTRAINED** (an ANSWER — §124(b)) | — |
| denver | G-MU-5 | **UNCONSTRAINED** (an ANSWER — DZC form-based) | — |
| chicago | B3-2 | null | `published-not-fetched` — `chicagoBaseFAR` covers residential only; B/C/D/M districts return null though the Zoning Ordinance sets FAR for them |
| seattle | NR | null | `published-not-fetched` — our module covers NC/C (SMC 23.47A.013). **NR is Seattle's renamed single-family zone** and is not handled at all |
| dc | RF-1 | null (height=35 resolves) | `published-not-fetched` — DC zoning regs publish FAR by district; we carry none |
| miami | T6-80-O | null (height=960 ⚠) | `published-not-fetched` — Miami 21 Article 4 Table 2 is a separate document, not yet read |
| minneapolis | CM2 | null (height=84 resolves) | **`fetched-not-mapped`** — FAR lives in the Built Form overlay, which the provider ALREADY fetches and already reads for height |
| sanjose | PQP | null | `not-published` — "No FAR anywhere in San Jose's public GIS" (provider comment, verified) |
| nashville | DTC | null | `not-published` — "publishes neither height nor FAR in GIS"; Metro Code Title 17 text only |
| sandiego | — | probe returned NO_PARCEL | probe location bad (city landmark, not a parcel). FAR itself is `published-not-fetched` — LDC tables, not in GIS |

**Score: 7 of 15 cities emit a real FAR answer** (5 resolved + 2 correctly
unconstrained). 7 are gaps. 1 probe needs a better coordinate.

## Flags raised by this run

- **⚠️ Miami height 960 ft.** `T6-80-O` × 12 ft/story = 960. Miami 21 does allow
  80 stories in that transect, so it may be literally correct, but it is the
  largest number the tool emits anywhere and it has never been checked against a
  real building. Verify before trusting.
- **Seattle `NR`.** Seattle renamed its single-family zones to Neighborhood
  Residential. Our FAR module and quite possibly our height parser were written
  against the old names. Worth a dedicated check.
- **San Jose `PQP`** at the city landmark is a public/quasi-public parcel — the
  civic hard-block should be catching this location. Verify.
- **Chicago transient failure.** The first batch run returned
  `districtCode: Unknown` for a parcel that resolves to B3-2 on three consecutive
  isolated probes. A concurrent-load fetch failure, not a defect — but it means
  **a single probe is not evidence**, and any future inventory must re-probe
  before recording a gap.

## Method note — the first attempt at this was wrong

The first pass called `resolveZoningLimits` with `maxFAR: null` and reported
"11/65 resolved". That measures only the fallback layer: most cities resolve FAR
**inside the provider** (`resolveSfFar`, `austinSfLimits`, `laLimits`, NYC's
PLUTO `farByUse`, `resolveMiami`, Philadelphia's `parseMaxFAR`), all of which
that probe bypassed. Same failure as the earlier grep count — it measured the
probe, not the pipeline. **An inventory must exercise the real entry point.**
