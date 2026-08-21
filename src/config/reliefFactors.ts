// The overage thresholds that separate "needs an exception" from "needs a
// rezoning" — ONE definition, read by the feasibility pass, by the inverse
// query, and by the Methodology page that describes them to the reader.
//
// ⚠️ THEY LIVE HERE BECAUSE A THIRD READER APPEARED. They were exported from
// netlify/functions/lib/feasibility.ts so the forward pass and the inverse query
// could not disagree. Then the Methodology page described them in prose and got
// it wrong: it said "up to 1.5× over" for BOTH dimensions, which is true of
// height and false of FAR. A claim audit found it, and `WhatWouldItTake` — which
// reads the real constants — was stating both correctly on another page. Two
// user-facing surfaces contradicting each other about the same rule.
//
// The SPA cannot import from netlify/, and the established direction is the
// other way (netlify/functions/lib/timeline.ts already imports from
// src/config/estimates). So the constants move here and every reader imports
// them — the same remedy as the Seattle zone-string parse: one exported
// definition, all callers wired to it (CLAUDE.md rule 14).
//
// A dimensional variance can bridge a modest overage; beyond it, relief isn't
// realistically grantable (it takes a rezoning). Height and FAR differ: a height
// variance is the classic, routinely-granted dimensional relief (~1.5×), but a
// FAR/density increase above ~1.2× crosses into rezoning territory — density is
// generally excluded from area-variance consideration. Source: variance-practice
// doctrine (NY ZR §72-21; area- vs use-variance literature).
export const RELIEF_FACTOR_HEIGHT = 1.5
export const RELIEF_FACTOR_FAR = 1.2
