import { describe, it, expect } from 'vitest'
import { PARKING_RULES, citiesWithoutParkingRule, type ParkingRule } from './parkingRules'
import { CITIES } from './cities'
import METHODOLOGY_SRC from '../routes/Methodology.tsx?raw'

describe('PARKING_RULES', () => {
  // ⚠️ REFORMULATED 2026-08-08. This used to assert that EVERY city slug has a
  // rule. That invariant held only because every city so far had had its
  // ordinance read, and Milwaukee/Columbus/Charlotte/Atlanta went live without
  // anyone reading theirs. Making it pass again by inventing four statuses is
  // CLAUDE.md rule 1; making it pass by narrowing the check to the covered
  // cities would let a real gap vanish. So the invariant is now the same shape
  // as `redTapeIndex`'s ranked-or-disclosed one: every live city is either
  // RULED or DISCLOSED, never both and never neither.
  it('every live city is either ruled or disclosed as unread — never both, never neither', () => {
    const ruled = new Set(Object.keys(PARKING_RULES))
    const disclosed = new Set(citiesWithoutParkingRule())
    for (const c of CITIES) {
      const inRules = ruled.has(c.slug)
      const inDisclosed = disclosed.has(c.slug)
      expect(inRules || inDisclosed, `${c.slug} is neither ruled nor disclosed`).toBe(true)
      expect(inRules && inDisclosed, `${c.slug} is both ruled and disclosed`).toBe(false)
    }
  })

  it('no orphan slugs — every rule names a real registry city', () => {
    const known = new Set(CITIES.map((c) => c.slug))
    for (const slug of Object.keys(PARKING_RULES)) {
      expect(known.has(slug), `parking rule for unknown slug ${slug}`).toBe(true)
    }
  })

  // The companion to the reformulation, and the reason it cannot be gamed: the
  // disclosed list must be DERIVED from the rules table, not typed. Hand it an
  // empty table and every registry city must come back disclosed; hand it a
  // complete one and none may. A hard-coded list passes the test above while
  // silently going stale the next time a city is added.
  it('the disclosed list is derived from the rules table, not hand-written', () => {
    expect(citiesWithoutParkingRule({}).sort()).toEqual(CITIES.map((c) => c.slug).sort())
    const complete = Object.fromEntries(
      CITIES.map((c) => [c.slug, PARKING_RULES.boston]),
    ) as Record<string, ParkingRule>
    expect(citiesWithoutParkingRule(complete)).toEqual([])
  })

  // Pins the state of coverage, so that adding a city without reading its
  // ordinance is a visible, deliberate edit rather than a silent one.
  //
  // ⚠️ UPDATED 2026-08-08 (second edit of the day). This asserted that exactly
  // atlanta/charlotte/columbus/milwaukee were disclosed as unread. All four
  // ordinances have now been read — Milwaukee Ch. 295 s. 295-403, Columbus C.C.
  // 3312 + Title 34 E.20.030, the Charlotte UDO Art. 19 Table 19-1, Atlanta
  // §§ 16-28.014 / 16-36.020 — so the disclosed list is empty and the
  // expectation moves with it.
  //
  // Note what did NOT change: the RULED-or-DISCLOSED invariant above, and the
  // derived-not-hand-written test below. Emptying this list is only safe
  // because those two still hold — an empty disclosed list is a claim that
  // EVERY live city is ruled, and it is the first test in this file, not this
  // one, that actually enforces it. If a sixteenth city ships unread, that test
  // stays green (it is disclosed) and THIS one goes red, which is the correct
  // direction: a new gap must be an explicit edit here.
  it('no live city is left with its parking ordinance unread', () => {
    expect(citiesWithoutParkingRule().sort()).toEqual([])
  })

  it('every rule is well-formed', () => {
    for (const [slug, rule] of Object.entries(PARKING_RULES)) {
      const r = rule as ParkingRule
      expect(['abolished', 'partial']).toContain(r.status)
      expect(r.headline.length, `${slug} headline`).toBeGreaterThan(0)
      expect(r.cellLabel.length, `${slug} cellLabel`).toBeGreaterThan(0)
      expect(r.detail.length, `${slug} detail`).toBeGreaterThan(0)
      expect(r.asOf.length, `${slug} asOf`).toBeGreaterThan(0)
    }
  })

  /**
   * ⚠️ THE CONSTRAINT THAT MAKES `cellLabel` TRACEABLE. The Red Tape Index's
   * parking column used to be computed from `status`: everything that was not
   * 'abolished' rendered the literal string 'Near transit only'. Transit is not
   * the mechanism in Nashville, Philadelphia, New York, Boston, DC, Milwaukee,
   * Columbus, Charlotte or Atlanta, so roughly half the column asserted a rule
   * its own city does not have.
   *
   * The label is now per-city data, and this is what keeps it honest: every word
   * a cell prints must also appear in the headline verified for that city. The
   * cell may SHORTEN the headline (dropping a citation like "(AB 2097)"); it may
   * not add to it. A category invented for a group of cities — the old string,
   * or the next enum value someone reaches for — cannot survive this check,
   * because it will contain words the headline of at least one member does not.
   *
   * `redTapeIndex.test.ts` runs the same check through the rendered cell for the
   * ranked cities; this one covers ALL rules, including the ones the index does
   * not yet rank — which is where the original defect sat latent.
   */
  it('every cellLabel is drawn from its own headline — no invented mechanisms', () => {
    const words = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9½]+/g, ' ').trim().split(/\s+/).filter(Boolean)
    for (const [slug, rule] of Object.entries(PARKING_RULES)) {
      const fromHeadline = new Set(words(rule.headline))
      const invented = words(rule.cellLabel).filter((w) => !fromHeadline.has(w))
      expect(
        invented,
        `${slug}: cellLabel "${rule.cellLabel}" adds ${JSON.stringify(invented)} to headline "${rule.headline}"`,
      ).toEqual([])
    }
  })

  // A cell that has to be truncated by the browser is a cell that can lose its
  // qualifying clause silently, so keep the labels short enough to wrap into the
  // column instead. The bound is generous; it exists to catch a headline being
  // pasted in wholesale rather than shortened.
  it('keeps every cellLabel short enough for the table column', () => {
    for (const [slug, rule] of Object.entries(PARKING_RULES)) {
      expect(rule.cellLabel.length, `${slug} cellLabel is too long for the cell`).toBeLessThanOrEqual(80)
    }
  })

  it('marks the four abolished cities as abolished', () => {
    for (const slug of ['minneapolis', 'sf', 'austin', 'denver']) {
      expect(PARKING_RULES[slug].status, slug).toBe('abolished')
    }
  })

  it('marks the partial cities as partial', () => {
    for (const slug of [
      'chicago', 'nyc', 'seattle', 'la', 'boston', 'dc',
      'milwaukee', 'columbus', 'charlotte', 'atlanta',
    ]) {
      expect(PARKING_RULES[slug].status, slug).toBe('partial')
    }
  })

  // The 2026-08-08 cohort. Each assertion below is a QUOTE CHECK, not a spot
  // check: the distinctive string is one that only appears if the ordinance
  // itself was the source. A rewrite that paraphrases the rule into something
  // plausible loses the citation and fails here.
  it('each of the four 2026-08-08 rules carries its ordinance citation', () => {
    expect(PARKING_RULES.milwaukee.detail).toMatch(/295-403-2-a/)
    expect(PARKING_RULES.milwaukee.detail).toMatch(/no min\.; max\. of 4 spaces/)
    expect(PARKING_RULES.columbus.detail).toMatch(/E\.20\.030\.E\.1/)
    expect(PARKING_RULES.columbus.detail).toMatch(/3359\.27/)
    expect(PARKING_RULES.charlotte.detail).toMatch(/19\.2\.A\.1/)
    expect(PARKING_RULES.charlotte.detail).toMatch(/400' walking distance/)
    expect(PARKING_RULES.atlanta.detail).toMatch(/16-28\.014/)
    expect(PARKING_RULES.atlanta.detail).toMatch(/2,640 feet/)
  })

  // Rule 6, in the place it would actually bite. Milwaukee's downtown carve-out
  // has a named exception (C9A) and Columbus's has a named counter-code; both
  // are the kind of clause that gets lost when copy is shortened, and losing
  // either turns a partial rule into a false "downtown is exempt".
  it('does not flatten the downtown carve-outs into blanket exemptions', () => {
    expect(PARKING_RULES.milwaukee.headline).toMatch(/C9A/)
    expect(PARKING_RULES.milwaukee.detail).toMatch(/C9A/)
    expect(PARKING_RULES.columbus.detail).toMatch(/Title 33/)
    // Columbus's cross-code trap: 3304.03(F) reads as though minimums reach the
    // 2024 code. The detail must carry the correction, not just the trap.
    expect(PARKING_RULES.columbus.detail).toMatch(/3312\.55\.B/)
  })

  // ⚠️ INVERTED 2026-08-08 (same day it was written). This test used to assert
  // that Charlotte asserts NO statewide preemption, which was correct while the
  // session-law number, effective date and operative text were missing — a
  // mechanism with no citation earns no direction (rule 1). All three have now
  // been read from ncleg.gov's own Session Laws index, so the gap is closed and
  // the test flips from "must not claim it" to "must claim it, with the quote".
  //
  // Note this is rule 15's warning surviving contact: the previous assertion was
  // green, well-commented and RIGHT ON ITS OWN TERMS. What changed is not the
  // code but the evidence. A green test defending an absence is only ever
  // evidence that the copy matches what we knew, never that the absence is real.
  it('Charlotte cites the statute that voids its minimums', () => {
    const text = `${PARKING_RULES.charlotte.headline} ${PARKING_RULES.charlotte.detail}`
    // The citation itself — the enacted vehicle, not the bill that died.
    expect(text).toMatch(/Session Law 2026-39/)
    expect(text).toMatch(/House Bill 162/)
    expect(text).toMatch(/160D-702\(c\)/)
    // The operative words, verbatim. A paraphrase loses these.
    expect(text).toMatch(/minimum number of parking spaces per development or structure/)
    expect(text).toMatch(/regardless of occupancy or use/)
    // The effective date, which is the whole point of the entry.
    expect(text).toMatch(/January 1, 2027/)
    // H369 died in Senate Rules and must never be cited as the vehicle.
    expect(text).not.toMatch(/369/)
  })

  // The task's own warning, pinned: "this is exactly the kind of conjunctive
  // condition that gets encoded as its first clause." Subdivision (2a) is a
  // sentence PLUS a geographic carve-out, and quoting only the first sentence
  // would state a flat statewide ban that the statute does not enact. The copy
  // must carry the coastal limb and say why it misses Charlotte.
  it('does not flatten the preemption into its first clause', () => {
    const text = PARKING_RULES.charlotte.detail
    expect(text).toMatch(/coastal area/)
    expect(text).toMatch(/113A-103/)
    expect(text).toMatch(/Mecklenburg/)
    // Rule 6: the statute preempts MINIMUMS only. Reporting it as killing all
    // parking regulation would invent a program the code does not grant.
    expect(text).toMatch(/maximums are untouched|maximums.{0,40}survive/i)
  })

  // Rule 5, at the level that actually bites a user: a rule that is dead in five
  // months and a rule that is dead today must not render the same. Charlotte's
  // minimums BIND right now — G.S. 160D-702(c) as published still lists only
  // four prohibitions — so the status stays 'partial' and the copy must say the
  // tiers are live, while still carrying the expiry date.
  it('Charlotte still binds today and says so', () => {
    expect(PARKING_RULES.charlotte.status).toBe('partial')
    expect(PARKING_RULES.charlotte.detail).toMatch(/bind today/)
    expect(PARKING_RULES.charlotte.headline).not.toMatch(/abolished|no parking minimums/i)
  })

  // Rule 14 — convert a known future defect into an impossible state, not a
  // comment. This entry has a SCHEDULED expiry: on 2027-01-01 the statute takes
  // effect and 'partial' becomes wrong by operation of state law, for every NC
  // city in the registry. A header comment saying so would be read by nobody on
  // the day it mattered, so the deadline is mechanical instead — this test goes
  // red on its own the moment the law is in force and the copy has not moved.
  it('trips when the NC preemption takes effect and the entry has not been revised', () => {
    const EFFECTIVE = Date.parse('2027-01-01T00:00:00Z')
    if (Date.now() < EFFECTIVE) return
    expect(
      PARKING_RULES.charlotte.status,
      'SL 2026-39 is now in force: NC parking minimums are preempted. Re-read ' +
        'G.S. 160D-702(c), then update charlotte (and every other NC city) — ' +
        'the tiered minimums in this entry are no longer enforceable.',
    ).toBe('abolished')
  })

  // ═══ THE SECOND AND THIRD INSTRUMENTS ON THE CHARLOTTE ENTRY ══════════════
  //
  // The test above is a DATE tripwire. It fires when the flip falls due. It
  // cannot see the one thing that would make the flip WRONG: SL 2026-39 being
  // amended or repealed between now and 2027-01-01. In that world the date test
  // still goes red exactly on schedule and still instructs the reader to flip
  // Charlotte to 'abolished' on the authority of a statute that no longer says
  // what this entry says it says — a wrong-direction instruction delivered by
  // our own guard. That is rule 7's failure mode with the guard, rather than a
  // disclaimer, as the vehicle: a reader who is TOLD which way to correct will
  // correct that way.
  //
  // WHAT THE TWO TESTS BELOW BUY:
  //   (a) the failures are DISTINGUISHABLE. Pin red alone → the legal basis
  //       under this copy moved. Tripwire red alone → the clock ran out. They
  //       are separate `it` blocks with separate messages precisely so that one
  //       going red never has to be interpreted through the other.
  //   (b) nobody can quietly RE-BASE the claim. Swapping the authority under
  //       this copy — to H369, to some other session law, to a different
  //       subdivision — turns a red test on, naming what changed.
  //
  // WHAT THEY CANNOT DO, said plainly rather than left to be inferred:
  //
  //   ⚠️ NEITHER TEST CAN SEE ncleg.gov. NO test in this repo can detect the
  //   General Assembly amending G.S. 160D-702(c). This is rule 9 in its exact
  //   form — every check that has ever found a real defect here compared the
  //   system to something OUTSIDE it, and both of these are entirely inside it.
  //   A green pin means the copy still says what it said on the day a human
  //   read the session law. It is NOT evidence that the session law still says
  //   it, and treating a green pin as verification of the law would be a
  //   stronger claim than any assertion below supports.
  //
  // The overlap with 'Charlotte cites the statute that voids its minimums' is
  // deliberate, not an oversight. That test asks whether the preemption claim is
  // stated at all; this one fixes WHICH authority it rests on, and has to stand
  // on its own — if the other test is ever rewritten or dropped, the basis must
  // still be nailed down, and its failure message must be self-explaining.

  /**
   * The date a human read SL 2026-39 and G.S. 113A-103 at ncleg.gov. A fact
   * about our reading, never a fact about the statute.
   */
  const CHARLOTTE_BASIS_VERIFIED_ON = '2026-08-08'

  /**
   * G.S. 160D-702(c)(2a), first sentence, verbatim as read on 2026-08-08 from
   * ncleg.gov/EnactedLegislation/SessionLaws/HTML/2025-2026/SL2026-39.html.
   *
   * Pinned as ONE string rather than as fragments on purpose. The two `toMatch`
   * fragments in the older test ("minimum number of parking spaces per
   * development or structure" and "regardless of occupancy or use") both stay
   * green against a sentence that has been re-ordered, re-scoped, or spliced
   * with words the statute does not contain — they are satisfied by presence,
   * not by the sentence. A single `toContain` of the whole sentence is not.
   */
  const SL_2026_39_OPERATIVE_SENTENCE =
    'Require an off-street parking lot to meet a minimum number of parking ' +
    'spaces per development or structure, regardless of occupancy or use.'

  it('citation pin: the Charlotte entry still rests on the basis verified 2026-08-08', () => {
    const text = `${PARKING_RULES.charlotte.headline} ${PARKING_RULES.charlotte.detail}`
    const pin = (what: string) =>
      `CITATION PIN (this is NOT the date tripwire — the clock has not run out, ` +
      `the CITED BASIS moved): ${what}. Charlotte's parking entry was pinned to ` +
      `NC Session Law 2026-39 (H162) § 1(a), adding G.S. 160D-702(c)(2a), read at ` +
      `ncleg.gov on ${CHARLOTTE_BASIS_VERIFIED_ON}. Re-read the primary source ` +
      `before making this green again; do not restore the string from memory.`

    // ── The enacted vehicle ────────────────────────────────────────────────
    expect(text, pin('Session Law 2026-39 is no longer named')).toContain('Session Law 2026-39')
    expect(text, pin('House Bill 162 is no longer named as the vehicle')).toContain('House Bill 162')
    // …and NO OTHER vehicle. This is what a quiet re-basing looks like: the
    // claim survives, the authority under it is swapped.
    expect(text, pin('a session law other than 2026-39 is cited here')).not.toMatch(
      /Session Law (?!2026-39\b)\d{4}-\d+/,
    )
    expect(text, pin('a House Bill other than 162 is cited as the vehicle')).not.toMatch(
      /House Bill (?!162\b)\d+/,
    )
    // H369 ("Parking Lot Reform/Stormwater Control") DIED — "Re-ref Com On Rules
    // and Operations of the Senate on 6/10/2026". It carries the identical
    // subject pairing to H162, which is exactly why it is the number someone
    // reaches for by mistake. It must never appear as the vehicle.
    expect(text, pin('H369 appears; it died in Senate Rules on 2026-06-10')).not.toMatch(/369/)

    // ── The subdivision ADDED — (2a), not the section at large ─────────────
    // "G.S. 160D-702(c)" alone is satisfied by any of subdivisions (1)–(4),
    // which are about other things entirely; the parking prohibition is (2a).
    expect(
      text,
      pin('the copy no longer says that subdivision (2a) is what SL 2026-39 adds to G.S. 160D-702(c)'),
    ).toMatch(/subdivision \(2a\) to G\.S\. 160D-702\(c\)/)

    // ── The operative sentence, verbatim ───────────────────────────────────
    expect(
      text,
      pin('the operative sentence of (2a) is no longer quoted verbatim'),
    ).toContain(SL_2026_39_OPERATIVE_SENTENCE)

    // ── The coastal exception AND its historic-property counter-exception ──
    // (2a) is a prohibition, MINUS coastal local governments, PLUS three
    // classes of historic property back inside the coastal area. Assert both
    // limbs and their order: an "except…" that no longer follows the carve-out
    // it excepts is a different rule, and a coastal carve-out quoted without
    // its counter-exception under-states the ban for coastal historic property.
    const CARVE_OUT = 'shall not, however, apply to local governments located in the coastal area'
    const COUNTER = 'except with respect to the following properties located in the coastal area'
    const carveOutAt = text.indexOf(CARVE_OUT)
    const counterAt = text.indexOf(COUNTER)
    expect(carveOutAt, pin('the coastal-area carve-out is gone from the quote')).toBeGreaterThan(-1)
    expect(
      counterAt,
      pin('the historic-property counter-exception is gone — the conjunctive condition has been flattened to its carve-out'),
    ).toBeGreaterThan(-1)
    expect(
      counterAt,
      pin('the counter-exception no longer follows the carve-out it qualifies'),
    ).toBeGreaterThan(carveOutAt)
    expect(
      text,
      pin('the three classes of historic property carved back in are no longer stated'),
    ).toMatch(/three classes of historic property/)
  })

  /**
   * WHY 2026-11-01, and what it is NOT derived from.
   *
   * Two months before the 2027-01-01 flip, roughly a quarter after the
   * 2026-08-08 read. Three reasons, none of them a claim about Raleigh:
   *
   *  1. LEAD TIME. The flip is not a one-word status change. It touches this
   *     entry's copy, the long provenance block in `parkingRules.ts`, every
   *     other North Carolina city in the registry (Raleigh's note wants the
   *     statute even though its status does not move), and any surface that
   *     currently says the tiers "bind today". Two months is enough to re-read
   *     the statute and revise deliberately rather than against a deadline.
   *  2. ORDERING. It fires strictly BEFORE the date tripwire, so the two never
   *     come up red together on a first run, and the order they arrive in is
   *     itself the instruction: re-verify first, flip second.
   *  3. It is a LEAD-TIME CHOICE, NOT A LEGISLATIVE-CALENDAR DERIVATION. No
   *     adjournment resolution or session calendar was read for this date, so
   *     it is not offered as "after the General Assembly could act" — that
   *     would be rule 1, a mechanism argued aloud wearing a date it did not
   *     earn. It is a chosen interval and nothing more.
   */
  const CHARLOTTE_REVERIFY_BY = Date.parse('2026-11-01T00:00:00Z')

  it('demands a fresh re-verification of SL 2026-39 while there is still time to act', () => {
    expect(
      Date.now(),
      `RE-VERIFY THE NC PREEMPTION (this is NOT the 2027-01-01 tripwire and NOT a ` +
        `citation-pin failure — nothing in this repo has detected any change). The ` +
        `Charlotte entry's legal basis was last verified at ncleg.gov on ` +
        `${CHARLOTTE_BASIS_VERIFIED_ON}, and the 2027-01-01 flip to 'abolished' is ` +
        `now close enough that acting on a stale reading would be acting too late ` +
        `to fix it. Before that flip is relied on, confirm at ncleg.gov that SL ` +
        `2026-39 is still law and unamended: (a) the live text of G.S. ` +
        `160D-702(c) under Statutes → Chapter 160D, which should by then carry ` +
        `subdivision (2a); and (b) the Session Laws index for any later act ` +
        `amending, delaying or repealing SL 2026-39 — read the index, do not guess ` +
        `a bill URL (rule 8). THEN either revise this entry, or bump ` +
        `CHARLOTTE_REVERIFY_BY and CHARLOTTE_BASIS_VERIFIED_ON to the date you ` +
        `actually did that reading. Bumping the date without doing the reading ` +
        `converts this guard into a false provenance claim, which is worse than ` +
        `deleting it.`,
    ).toBeLessThan(CHARLOTTE_REVERIFY_BY)
  })

  it('does NOT claim NYC eliminated minimums citywide', () => {
    const nyc = PARKING_RULES.nyc
    expect(nyc.status).toBe('partial')
    const text = `${nyc.headline} ${nyc.detail}`
    // The old, wrong copy said minimums were "eliminated citywide". Elimination
    // is now scoped to Zone 1 (the Manhattan core); only the exemptions are
    // citywide, so the bare word "citywide" can legitimately still appear.
    expect(text).not.toMatch(/minimums (were )?eliminated citywide/i)
    expect(text).not.toMatch(/eliminated (mandatory )?parking minimums citywide/i)
    expect(text).toMatch(/Zone 1|Manhattan/i)
  })

  it('abolished headlines read as abolished', () => {
    for (const slug of ['minneapolis', 'sf', 'austin', 'denver']) {
      expect(PARKING_RULES[slug].headline).toMatch(/abolished/i)
    }
  })
})

describe('⚠️ the Methodology parking sentence is derived, not hand-listed', () => {
  it('names every abolished city, and the count matches the data', () => {
    // The prose named four; `status === 'abolished'` is six. San José and
    // Raleigh were missing — a hand-kept list already a third behind, on a page
    // whose every other table is generated. It had even been updated by hand for
    // Denver's Aug-2025 flip, which is the maintenance that eventually lapses.
    const abolished = Object.keys(PARKING_RULES).filter((s) => PARKING_RULES[s].status === 'abolished')
    expect(abolished.length).toBe(6)
    expect(abolished.sort()).toEqual(['austin', 'denver', 'minneapolis', 'raleigh', 'sanjose', 'sf'])
    // Every city is in exactly one bucket, so the two counts in the sentence
    // always sum to the roster (rule 20 — pin the partition, not the exception).
    const partial = Object.keys(PARKING_RULES).filter((s) => PARKING_RULES[s].status === 'partial')
    expect(abolished.length + partial.length).toBe(Object.keys(PARKING_RULES).length)
    expect(Object.keys(PARKING_RULES).length).toBe(23)
  })

  it('⚠️ the page states no city name or count as a literal', () => {
    const i = METHODOLOGY_SRC.indexOf('off-street parking is still mandated')
    expect(i).toBeGreaterThan(-1)
    const prose = METHODOLOGY_SRC.slice(i, i + 700)
    expect(prose).toMatch(/\{abolishedCount\}/)
    expect(prose).toMatch(/\{abolishedList\}/)
    expect(prose).toMatch(/\{partialCount\}/)
    // The old sentence's hand-typed roster must not survive anywhere in it.
    for (const name of ['San Francisco', 'Minneapolis', 'Austin', 'Denver', 'Chicago', 'Seattle']) {
      expect(prose, `${name} is named as a literal`).not.toMatch(new RegExp(name))
    }
  })
})
