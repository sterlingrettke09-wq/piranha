// The enumeration sweep's LIBRARY half — no side effects, nothing runs on import.
//
// ⚠️ SPLIT OUT 2026-08-19. This lived in scripts/enumerate-zones.ts alongside a
// top-level `main()`, so importing `readEnumeration` ran the CLI: parcel-weight.ts
// printed enumerate-zones' usage banner before doing anything. The old guard was
// `process.env.VITEST == null`, which protects tests and nothing else — and under
// vite-node the entry filename is not in process.argv at all, so "am I the entry"
// cannot be detected. A module that cannot run is the structural answer (rule 14);
// a smarter guard would have been another comment.
//
// The enumeration sweep — the instrument that finds WRONG values.
//
// Coverage answers "did an envelope resolve". This answers "is what it resolved
// the same thing every reader of that code thinks it is". Both Seattle defects
// this session were visible here and nowhere else, and neither moved coverage by
// a point.
//
// ── COMPARATIVE ONLY, DELIBERATELY ───────────────────────────────────────────
//
// The obvious check is "flag a height above the city's tallest zone". That needs
// to KNOW the city's tallest zone, and if that bound is uncited you have built a
// check whose threshold is the thing being checked — Seattle's tier heights were
// exactly such uncited constants, and a bound drawn from them would have
// certified 240 ft for a 440 ft zone.
//
// So: no bounds, no invented constants. The check compares INDEPENDENT READINGS
// of the same live code and reports disagreement. That needs no threshold, it
// caught the MIO overlay bug, and it answers a question ("do these two agree")
// that cannot be answered wrongly by a bad constant.
//
// ── A GREEN THAT WAS NEVER TESTED IS NOT A GREEN ─────────────────────────────
//
// Every city's check is exercised against a PLANTED defect before its result is
// believed. If the planted defect does not turn the city red, the check did not
// run — a broken probe and a clean city produce identical output otherwise, and
// this file exists because that distinction kept being lost. A city that fails
// to detect its own planted defect reports NOT-CHECKED, never GREEN.
//
// ── FIXTURES ARE MEASUREMENTS AND CARRY A DATE ───────────────────────────────
//
// The committed enumeration lets the comparison run offline, but a fixture from
// a live layer is a measurement with a vintage, not a constant. Municode served
// a seven-year-old archive of SMC 23.45.514 from a versioned URL this session
// and it read as current — so every fixture here stamps `capturedOn` and the
// layer it came from, and a stale one is meant to be visible as stale.

import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import type { ZoneSource } from '../zoneRegistry'

const ROOT = resolve(__dirname, '../..')
const FIXTURES = join(ROOT, 'scripts/__fixtures__/zoneEnumerations')

export interface Enumeration {
  city: string
  layer: string
  field: string
  capturedOn: string
  /** Distinct values, sorted. */
  codes: string[]
  /** Whether the service reported it had more to give. A truncated enumeration
   *  that reads as complete is the failure this flag exists to prevent. */
  truncated: boolean
}

/** Minimal shape of the ArcGIS responses this file reads. Narrow on purpose:
 *  `any` would let a renamed key fail silently, which is the class of defect
 *  this whole tool exists to surface. */
interface ArcgisResponse {
  error?: { code: number; message: string }
  fields?: Array<{ name: string }>
  /** Feature Layer / Table / Annotation SubLayer / Group Layer. */
  type?: string
  geometryType?: string
  /** Comma-separated: "Query,Map,Data" on a real layer, "Map" on annotation. */
  capabilities?: string
  features?: Array<{ attributes?: Record<string, unknown> }>
  exceededTransferLimit?: boolean
}

async function arcgisJson(url: string, params: Record<string, string>): Promise<ArcgisResponse> {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${url}?${qs}`, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = (await res.json()) as ArcgisResponse
  if (j.error) throw new Error(`service error ${j.error.code}: ${j.error.message}`)
  return j
}

/** The declared field, confirmed against the LIVE layer's own metadata. */
export async function verifyField(z: ZoneSource): Promise<{ ok: boolean; detail: string }> {
  try {
    const meta = await arcgisJson(z.layer, { f: 'json' })

    // ⚠️ IS IT A LAYER AT ALL, BEFORE ASKING WHAT FIELDS IT HAS.
    //
    // Added 2026-08-18 after Atlanta. Looking for the geometry behind that city's
    // gross-lot denominator, its service listing offered `Row-Width`, `Parks` and
    // `Water` — three of the four components by name, which reads as availability.
    // Three of the four are ANNOTATION SUBLAYERS: cartographic text drawn on the
    // cadastral map, `type: "Annotation SubLayer"`, `geometryType: None`,
    // `capabilities: "Map"`, and /query answers HTTP 400.
    //
    // A field-existence check never queries anything, so an annotation sublayer
    // sails through it — the layer publishes no fields, or publishes label
    // fields, and nothing in the check notices it can never return a feature.
    // "A LAYER NAME IS NOT A LAYER": `type`, `geometryType` and `capabilities`
    // are what answer, and the /query response is the destination test.
    const caps = String(meta.capabilities ?? '')
    const kind = String(meta.type ?? '')
    if (kind && !/Feature Layer|Table/i.test(kind)) {
      return { ok: false, detail: `not a queryable layer — type "${kind}", capabilities "${caps || 'none'}"` }
    }
    if (caps && !/Query/i.test(caps)) {
      return { ok: false, detail: `layer does not advertise Query — capabilities "${caps}"` }
    }

    const names: string[] = (meta.fields ?? []).map((f) => String(f.name))
    if (names.length === 0) return { ok: false, detail: 'layer published no field list' }
    // CASE-INSENSITIVE, because ArcGIS is. The first version compared exactly
    // and failed DC on `ZONING` vs `Zoning` and Charlotte on `ZONEDES` vs
    // `ZoneDes` — both of which the service answers happily. A verifier stricter
    // than the thing it verifies reports defects that do not exist, which is the
    // fastest way to get a check ignored.
    const lower = new Map(names.map((n) => [n.toLowerCase(), n]))
    const missing = [z.field, ...(z.alsoRead ?? [])].filter((f) => !lower.has(f.toLowerCase()))
    if (missing.length) {
      const near = names.filter((n) => n.toLowerCase().includes(z.field.toLowerCase().slice(0, 4)))
      void lower
      return {
        ok: false,
        detail: `field(s) not on layer: ${missing.join(', ')}${near.length ? ` — layer has ${near.join(', ')}` : ''}`,
      }
    }
    return { ok: true, detail: `${kind || 'layer'}, ${caps || 'caps unstated'}, ${names.length} fields, all declared present` }
  } catch (e) {
    return { ok: false, detail: String((e as Error).message) }
  }
}

export async function enumerate(z: ZoneSource): Promise<Enumeration> {
  const j = await arcgisJson(z.layer + '/query', {
    where: '1=1',
    outFields: z.field,
    returnDistinctValues: 'true',
    returnGeometry: 'false',
    f: 'json',
  })
  const codes = [
    ...new Set(
      (j.features ?? [])
        .map((f) => f.attributes?.[z.field])
        .filter((v: unknown) => v != null && String(v).trim() !== '')
        .map((v: unknown) => String(v).trim()),
    ),
  ].sort() as string[]
  return {
    city: z.city,
    layer: z.layer,
    field: z.field,
    capturedOn: new Date().toISOString().slice(0, 10),
    codes,
    truncated: j.exceededTransferLimit === true,
  }
}

export function fixturePath(city: string): string {
  return join(FIXTURES, `${city}.json`)
}

export function readEnumeration(city: string): Enumeration | null {
  const p = fixturePath(city)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8')) as Enumeration
}

