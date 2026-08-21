import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

// ⚠️ THIS GUARD EXISTS BECAUSE A PUSH TO MAIN FAILED THE PRODUCTION BUILD.
//
// netlify.toml sets `functions = "netlify/functions"`, and Netlify turns every
// TOP-LEVEL file in that directory into a deployed function whose name is the
// basename. Netlify rejects a name containing anything but alphanumerics,
// hyphens and underscores — so a colocated `foo.test.ts` sitting at the top
// level produces the function name `foo.test`, and the whole deploy errors with
// "Incorrect function names".
//
// ⚠️ NOTHING LOCAL CAUGHT IT. Typecheck, lint and 4,701 tests all passed; the
// build succeeded locally, because `npm run build` builds the SPA and never
// enumerates the functions directory the way Netlify's deploy step does. The
// first signal was a failed deploy — the worst place to learn it.
//
// The offending file had ALSO been sitting undeployed on main for two days
// (watchlistEndpoint.test.ts), so the next deploy would have failed whoever
// pushed it, for a reason unrelated to their change.
//
// Subdirectories are safe: `lib/` holds 23 colocated *.test.ts files and has
// deployed successfully many times, because a directory only becomes a function
// when it carries an entry file named after itself or `index`. That is why the
// endpoint tests live in `__tests__/` rather than beside their handlers.
const FUNCTIONS_DIR = resolve(__dirname, '..')

/** Netlify's rule, from the deploy error text: "Name should consist of only
 *  alphanumeric characters, hyphen & underscores". */
const LEGAL_FUNCTION_NAME = /^[A-Za-z0-9_-]+$/

function topLevelFunctionFiles(): string[] {
  return readdirSync(FUNCTIONS_DIR).filter((f) => {
    const full = join(FUNCTIONS_DIR, f)
    return statSync(full).isFile() && /\.(ts|js|mjs|mts)$/.test(f)
  })
}

describe('⚠️ every deployable function name is legal for Netlify', () => {
  it('no top-level file in netlify/functions produces an illegal function name', () => {
    const offenders = topLevelFunctionFiles()
      .map((f) => ({ file: f, name: f.replace(/\.(ts|js|mjs|mts)$/, '') }))
      .filter((x) => !LEGAL_FUNCTION_NAME.test(x.name))
    expect(
      offenders,
      'Netlify names each top-level file in netlify/functions as a function and rejects ' +
        'names with dots. Move test files into netlify/functions/__tests__/ (a subdirectory ' +
        'without an entry file is not scanned) rather than renaming them.',
    ).toEqual([])
  })

  it('⚠️ the check runs over a NON-EMPTY set, and the rule really rejects a dot', () => {
    // rule 20: a guard that can pass by finding nothing is not a guard. If the
    // functions directory were ever emptied or this path went stale, the
    // assertion above would go vacuously green.
    const files = topLevelFunctionFiles()
    expect(files.length).toBeGreaterThanOrEqual(8)
    expect(files).toContain('log-search.ts')
    expect(files).toContain('watchlist.ts')

    // ⚠️ And the matcher is exercised against the ACTUAL string that broke the
    // deploy, not a hand-made stand-in — rule 28: a planted defect has to be
    // verified as the defect you meant to plant.
    expect(LEGAL_FUNCTION_NAME.test('logSearchEndpoint.test')).toBe(false)
    expect(LEGAL_FUNCTION_NAME.test('watchlistEndpoint.test')).toBe(false)
    expect(LEGAL_FUNCTION_NAME.test('log-search')).toBe(true)
    expect(LEGAL_FUNCTION_NAME.test('auth_request')).toBe(true)
  })

  it('no top-level file is a test file, whatever it is named', () => {
    // Belt and braces: a test named `logSearchEndpointTest.ts` would pass the
    // name rule and then DEPLOY AS A LIVE ENDPOINT, which is worse than a failed
    // build. The name rule is not the thing that matters — the placement is.
    const tests = topLevelFunctionFiles().filter((f) => /\.test\.|(^|[^a-z])test([^a-z]|$)/i.test(f))
    expect(tests).toEqual([])
  })
})
