// Minneapolis provider — Hennepin County parcels (LAND_PROPERTY) + City of
// Minneapolis Primary Zoning + HPC historic districts. Verified live
// 2026-06-01.
//
// GOTCHA: the Hennepin County server does NOT reproject inSR=4326 — it silently
// returns no features for a WGS84 point. We must hand it geometry already in
// UTM zone 15N (EPSG:26915). Zoning + historic are ArcGIS Online layers and
// reproject 4326 normally.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { resolveMinneapolisFar } from '../zoning/minneapolis'
import { fetchFeatures, fetchFeaturesXYSnap, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { lngLatToUtm15 } from '../geo'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { recordAddress } from '../address'

const PARCELS = 'https://gis.hennepin.us/arcgis/rest/services/HennepinData/LAND_PROPERTY/MapServer/1'
const ZONING =
  'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Planning_Primary_Zoning/FeatureServer/0'
const BUILT_FORM =
  'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Planning_Zoning_Built_Form/FeatureServer/0'
const HISTORIC =
  'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/HPC_Districts/FeatureServer/0'
// City of Minneapolis park boundaries (MPRB). The 2040 zoning blankets parks in
// adjacent residential codes (UN1, etc.), so a park reads as a buildable lot
// unless we check this polygon layer explicitly.
const PARKS = 'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Parks/FeatureServer/0'

// Minneapolis separates USE (primary zoning) from FORM. Max height comes from
// the built-form district (Abbrv), per the City's Built Form Districts Handbook
// (Title 20, Tables 540-7 / 540-9). Base (by-right) heights in feet. Core 50 is
// the downtown CBD with no max-feet cap → null.
const MPLS_BUILT_FORM_FT: Record<string, number | null> = {
  BFI1: 28, BFI2: 28, BFI3: 42, BFC3: 42, BFC4: 56, BFC6: 84,
  BFT10: 140, BFT15: 210, BFT20: 280, BFT30A: 420, BFT30B: 420,
  BFPR: 140, BFPA: 35, BFC50: null,
}

// Minneapolis 2024 zoning code (Land_Use_Code) → use vocabulary.
function usesForZone(code: string | null): string[] | null {
  if (!code) return null
  const z = code.trim().toUpperCase()
  if (z.startsWith('UN')) return ['residential']
  if (z.startsWith('RM')) return ['residential', 'mixed', 'institutional']
  if (z.startsWith('CM') || z.startsWith('DT')) return ['commercial', 'mixed', 'residential']
  if (z.startsWith('PR')) return ['commercial', 'institutional']
  // TR = Transportation district (transit / right-of-way), NOT a standard
  // building site — leave uses underivable rather than mislabel it institutional.
  return null
}

export async function getMinneapolisParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const { x, y } = lngLatToUtm15(lng, lat)
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts.
  //
  // ⚠️ THE BUILT-FORM OVERLAY IS ALSO REQUIRED, and that is CLAUDE.md rule 13
  // rather than caution. Minneapolis separates USE from FORM: the primary zoning
  // layer gives the district column and the built-form overlay gives the row, and
  // BOTH the height (MPLS_BUILT_FORM_FT) and the FAR (resolveMinneapolisFar) need
  // the pair. With the overlay in the optional group a transport failure turned
  // BFC4's 56 ft into `maxHeightFt: null`, which feasibility.ts renders as "No
  // district height limit is available in public data" — a statement about the
  // published data that the published data contradicts. Measured by perturbation
  // 2026-08-11: control h=56, overlay-fail h=null, nothing else changed.
  const [parcelR, zoningR, formR, parkR, optional] = await Promise.all([
    readRequired(
      'parcel',
      (t) =>
        fetchFeaturesXYSnap(
          PARCELS,
          x,
          y,
          26915,
          ['HOUSE_NO', 'STREET_NM', 'MUNIC_NM', 'ZIP_CD', 'PARCEL_AREA', 'PID', 'BUILD_YR', 'BLDG_MV1', 'OWNER_NM'],
          30,
          t,
        ),
      // maxAttempts 2: fetchFeaturesXYSnap already retries its exact query.
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired('zoning', (t) => fetchParcelSnap(ZONING, lat, lng, ['Land_Use_Code', 'Land_Use'], false, undefined, 30, t), {
      deadline,
      maxAttempts: 2,
      attemptCapMs: 4000,
    }),
    readRequired('built-form', (t) => fetchFeatures(BUILT_FORM, lat, lng, ['Abbrv', 'Built_Form'], false, undefined, t), {
      deadline,
      maxAttempts: 3,
      attemptCapMs: 3000,
    }),
    // ⚠️ THE PARK LAYER IS REQUIRED, because it is the ONLY thing that blocks a
    // Minneapolis park. Two measurements 2026-08-11, both against the real
    // helpers rather than by reading the regexes:
    //   · `isGovernmentOwner('MINNEAPOLIS PARK & RECREATION BOARD')` is FALSE —
    //     MPRB, not the City, is the owner of record on park parcels, and the
    //     government-owner vocabulary does not name it. So `ownerPublic` does
    //     not cover this and there is no second signal.
    //   · the zoning layer reports an ordinary residential code over parkland,
    //     so `districtCode` does not cover it either.
    // Read as optional, a timeout here published a priced development scenario
    // for a public park. ANY INPUT TO A HARD BLOCK MUST COME FROM A READ THAT
    // CAN REFUSE (../requiredUpstream.ts; inventory in ./hardBlockInputs.test.ts).
    readRequired('parks', (t) => fetchFeatures(PARKS, lat, lng, ['PARK_NAME1'], false, undefined, t), {
      deadline,
      maxAttempts: 2,
      attemptCapMs: 3000,
    }),
    Promise.allSettled([
      fetchFeatures(HISTORIC, lat, lng, ['DISTRICT']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [histR, floodR] = optional

  // THE STATE SPLIT — a failed fetch refuses; an empty answer is still an answer.
  if (!parcelR.ok || !zoningR.ok || !formR.ok || !parkR.ok) {
    return upstreamUnavailable('minneapolis', 'Minneapolis', [parcelR, zoningR, formR, parkR], t0)
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['PID', 'PARCEL_AREA'], 'minneapolis')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when both zoning layers ANSWERED. A null here is "no polygon
  // covers this point", which is a fact and not a failure.
  const zoning = firstAttrs(zoningR.value)
  const form = firstAttrs(formR.value)
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const formAbbrv = form?.Abbrv ? String(form.Abbrv).trim().toUpperCase() : null
  const maxHeightFt = formAbbrv && formAbbrv in MPLS_BUILT_FORM_FT ? MPLS_BUILT_FORM_FT[formAbbrv] : null

  const houseNo = parcel.HOUSE_NO != null ? String(parcel.HOUSE_NO).trim() : ''
  const streetNm = parcel.STREET_NM != null ? String(parcel.STREET_NM).replace(/\s+/g, ' ').trim() : ''
  const rawAddress = [houseNo, streetNm].filter(Boolean).join(' ')
  // Hennepin uses placeholder strings (e.g. "ADDRESS PENDING") on some civic /
  // unaddressed parcels — don't surface those as a real address.
  const addressed = recordAddress(/pending|unknown|^0\b/i.test(rawAddress) ? '' : rawAddress)
  const area = Number(parcel.PARCEL_AREA)
  const code = zoning?.Land_Use_Code ? String(zoning.Land_Use_Code) : null
  const mplsFar = resolveMinneapolisFar(formAbbrv, code)

  // Park boundary → mark as public open space so the developability gate blocks
  // it (the zoning layer reports a normal residential code over parkland).
  // Reached only when the park service ANSWERED; a null is "no park here".
  const park = firstAttrs(parkR.value)
  const parkName = park?.PARK_NAME1 ? String(park.PARK_NAME1).replace(/\s+/g, ' ').trim() : null

  // Existing structure: a building market value (BLDG_MV1 > 0) or a build year
  // means a building stands here. No use label or floor area in this layer.
  const bldgVal = Number(parcel.BLDG_MV1)
  const buildYr = Number(parcel.BUILD_YR)
  // OWNER_NM used only to derive a government-owned boolean (no name stored).
  const ownerPublic = isGovernmentOwner(parcel.OWNER_NM != null ? String(parcel.OWNER_NM) : null)
  // BLDG_MV1 is Hennepin County's BUILDING (improvement) market value — the
  // structure only, NOT land + building — so we label it 'improvement only' and
  // never present it as a total (assessedValueBasis). Coarse land-cost proxy
  // only; never feeds the cost math.
  const hasBldgVal = Number.isFinite(bldgVal) && bldgVal > 0
  const existingBase = parkName
    ? // ⚠️ "(public park)", NOT "(park)". This suffix is not cosmetic — it is the
      // token `assessDevelopability`'s PUBLIC_LANDUSE pattern matches on, and the
      // gate is the whole reason the layer is read at all.
      //
      // The old "(park)" MATCHED NOTHING. Measured 2026-08-11 at the real
      // helper: assessDevelopability({districtCode:'R-1', landUse:'Loring
      // (park)'}) returns developable:TRUE. PUBLIC_LANDUSE has no bare \bpark\b
      // token — deliberately, so "Trailer park" cannot block a private lot — and
      // its park terms are the compounds ('public park', 'city park', 'state
      // park', 'parkland') plus a whole-value ^parks?$. "Loring (park)" is none
      // of them. The block this layer exists to produce had never once fired.
      //
      // A green test defended it: minneapolis.test.ts asserted the exact string
      // 'Loring (park)' under a comment saying the gate catches it (CLAUDE.md
      // rule 15). Nothing here broadens the regex — the label is changed to one
      // of the compounds it already names, which is the narrow fix.
      { landUse: `${parkName} (public park)` }
    : hasBldgVal || (Number.isFinite(buildYr) && buildYr > 1000)
      ? {
          yearBuilt: Number.isFinite(buildYr) && buildYr > 1000 ? buildYr : null,
          numBuildings: 1,
          ...(hasBldgVal ? { assessedValue: Math.round(bldgVal), assessedValueBasis: 'improvement only' } : {}),
        }
      : undefined
  const existing = ownerPublic ? { ...(existingBase ?? {}), ownerPublic: true } : existingBase

  const info: ParcelInfo = {
    ...addressed,
    parcelId: String(parcel.PID ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict: null,
      article: zoning?.Land_Use ? String(zoning.Land_Use) : null,
      maxHeightFt,
      // FAR lives in the BUILT FORM overlay, not the base district — and it
      // depends on BOTH layers (the handbook's "UN, RM" column keys on the
      // primary zoning code). The overlay was already fetched for height and
      // never read for FAR; see lib/zoning/minneapolis.ts.
      maxFAR: mplsFar.maxFAR,
      ...(mplsFar.alternatives.length > 0
        ? { farAlternatives: mplsFar.alternatives.map((a) => ({ ...a, source: 'Minneapolis Built Form Districts Handbook, Oct 2023' })) }
        : {}),
      allowedUses: usesForZone(code),
    },
    lot: {
      sizeSqFt: Number.isFinite(area) && area > 0 ? Math.round(area) : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.DISTRICT ? String(hist.DISTRICT) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      // A failed optional read is NOT "nothing here". Left as a bare null, the
      // hurdle each field triggers silently disappears along with the months it
      // carries — see `lib/unresolvedOverlays.ts` and the "could not be checked"
      // rows in `hurdles.ts`.
      ...unresolvedOverlays({
        historic: !hist?.DISTRICT && readFailed(histR),
        flood: readFailed(floodR),
      }),
    },
    existing,
    sources: { parcels: PARCELS, zoning: ZONING, builtForm: BUILT_FORM, historic: HISTORIC, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'minneapolis', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}

/** THE PARCEL LAYER AND THE COLUMN THIS PROVIDER READS ITS ID FROM.
 *
 *  Exported rather than transcribed into a registry. The layer URLs here are
 *  built from per-file base constants, so any second copy would be a hand-typed
 *  duplicate of a fact this file already holds — and this repo has paid for that
 *  three times. The watchlist checker re-finds a stored parcel BY ID, which is a
 *  different query from the point-in-polygon the report uses, and it needs both
 *  halves from the one place that already knows them. */
export const PARCEL_SOURCE = { layer: PARCELS, idField: 'PID' } as const
