# The 653 gaps, ranked by how much of each city they cover

*Derived from `scripts/__fixtures__/parcelWeights/` — measured 2026-08-19.*
*Regenerate with `npx vite-node scripts/write-parcel-weighted-gaps.ts`. Do not edit by hand.*

## What the number is

Each row is one district code the parser-domain sweep cannot explain, weighted
against that city's principal zoning layer — the same layer and field the
provider reads to answer "what is this parcel zoned".

**The order is LAND AREA.** Polygon count is published beside it and never breaks
a tie, so the two cannot quietly swap roles.

**Shares are within one city and do not compare across cities.** A feature is a
tax lot in New York (856,614 of them) and a zoning polygon in Denver (3,775).
Both are legitimate weights for ordering work inside a city; neither converts
to the other, and no total across cities appears anywhere below.

## Two columns, and they answer different questions

**A polygon count is not a land share, and on a district-grain layer the two
diverge hard in both directions.** Miami's thirteen gap codes are 68.67% of its
polygons and 37.04% of its land — near a factor of two down. San Francisco's 33
are 12.82% of polygons and 41.91% of area — over three times the other way,
because public land arrives in a few enormous parcels. The single largest gap in
the file, SF's `P`, is 30.7% of the city's land and 7.5% of its polygons.

Area orders this document. Count answers a different and still useful question —
"how many records does this code touch" — so it is published in every table and
never used to sort. Neither corrects the other.

Areas are in each layer's own projected units and are **never converted**. Only
the within-city share is used, which is unit-free; a conversion to acres would
need a factor per city that nothing here sources.

## ⚠️ Ten of the 23 layers publish no area column, and those gaps are UNRANKED

Not last, and not zero — both of those assert something. Nine cities are
affected (Philadelphia contributes two targets), and **two of them have gaps:
LA with 440 and Phoenix with 8**, together 448 of the 653. So the ranked list
below covers 204 gaps, and the largest single contributor to the sweep total is
not in it.

This is an established absence rather than a missing lookup: seven area-column
spellings were queried against each service — `SHAPE.STArea()`, `Shape.STArea()`,
`SHAPE.AREA`, `ST_Area(SHAPE)`, `Shape__Area`, `SHAPE_Area`, `Shape.area` — and
all seven were rejected. LA, Phoenix and Seattle publish geometry with no
summable area statistic.

Every count reconciles against its own layer: the per-code counts plus the
measured null/blank bucket equal the layer's own `count(1=1)`, exactly, for all
23 targets. A target that did not reconcile would be excluded rather than shown.

## Cities, by the share sitting under a gap

| city | share by area | share by count | gap codes | features under a gap | layer total |
|---|---:|---:|---:|---:|---:|
| sf | **41.91%** | 12.82% | 33 | 1,361 | 10,617 |
| miami | **37.04%** | 68.67% | 13 | 776 | 1,130 |
| columbus | **21.37%** | 16.31% | 37 | 3,066 | 18,804 |
| lasvegas | **11.07%** | 3.03% | 11 | 6,299 | 207,834 |
| charlotte | **10.62%** | 10.60% | 36 | 602 | 5,680 |
| denver | **7.39%** | 12.05% | 34 | 455 | 3,775 |
| austin | **7.13%** | 5.15% | 8 | 1,128 | 21,915 |
| dallas | **0.92%** | 2.75% | 31 | 105 | 3,819 |
| nashville | **0.04%** | 0.02% | 1 | 1 | 5,992 |
| raleigh | **0.00%** | 0.00% | 0 | 0 | 3,580 |
| sandiego | **0.00%** | 0.00% | 0 | 0 | 3,706 |
| atlanta | **unranked** | 0.00% | 0 | 0 | 2,979 |
| la | **unranked** | 41.08% | 440 | 24,229 | 58,973 |
| milwaukee | **unranked** | 0.00% | 0 | 0 | 148,087 |
| phoenix | **unranked** | 10.51% | 8 | 1,014 | 9,650 |
| seattle | **unranked** | 0.00% | 0 | 0 | 3,627 |
| chicago | **unranked** | 0.00% | 0 | 0 | 14,943 |
| dc | **unranked** | 0.00% | 0 | 0 | 977 |
| nyc | **unranked** | 0.00% | 0 | 0 | 856,614 |

## Every ranked gap

Ordered by land area. 204 of the 653 — the rest are unranked below.

| # | city | code | features | by area | by count |
|---:|---|---|---:|---:|---:|
| 1 | sf | `P` | 795 | **30.729%** | 7.488% |
| 2 | miami | `CI` | 112 | **8.221%** | 9.912% |
| 3 | miami | `CS` | 121 | **5.746%** | 10.708% |
| 4 | miami | `T5-O` | 100 | **4.586%** | 8.850% |
| 5 | lasvegas | `C-1` | 2,177 | **4.165%** | 1.047% |
| 6 | miami | `T4-R` | 71 | **4.073%** | 6.283% |
| 7 | columbus | `LM` | 260 | **3.424%** | 1.383% |
| 8 | lasvegas | `NO_ZONE` | 460 | **2.756%** | 0.221% |
| 9 | columbus | `LAR12` | 185 | **2.726%** | 0.984% |
| 10 | sf | `PDR-2` | 128 | **2.610%** | 1.206% |
| 11 | miami | `T5-R` | 45 | **2.466%** | 3.982% |
| 12 | miami | `T5-L` | 79 | **2.440%** | 6.991% |
| 13 | columbus | `CAC` | 269 | **2.434%** | 1.431% |
| 14 | miami | `D1` | 47 | **2.280%** | 4.159% |
| 15 | austin | `LA` | 104 | **2.249%** | 0.475% |
| 16 | sf | `HP-RA` | 3 | **2.098%** | 0.028% |
| 17 | austin | `SF2` | 715 | **2.021%** | 3.263% |
| 18 | lasvegas | `C-2` | 1,343 | **1.905%** | 0.646% |
| 19 | miami | `T4-L` | 97 | **1.844%** | 8.584% |
| 20 | columbus | `LR2` | 126 | **1.796%** | 0.670% |
| 21 | denver | `R-2-A` | 85 | **1.648%** | 2.252% |
| 22 | miami | `T1` | 34 | **1.491%** | 3.009% |
| 23 | charlotte | `MX-2` | 48 | **1.413%** | 0.845% |
| 24 | columbus | `LC4` | 252 | **1.398%** | 1.340% |
| 25 | miami | `D2` | 11 | **1.392%** | 0.973% |
| 26 | columbus | `LARLD` | 99 | **1.360%** | 0.526% |
| 27 | charlotte | `MX-1` | 37 | **1.354%** | 0.651% |
| 28 | denver | `R-2` | 55 | **1.348%** | 1.457% |
| 29 | miami | `CI-HD` | 1 | **1.299%** | 0.088% |
| 30 | denver | `R-1` | 52 | **1.280%** | 1.377% |
| 31 | columbus | `LUCRPD` | 36 | **1.271%** | 0.191% |
| 32 | charlotte | `MX-1(INNOV)` | 20 | **1.268%** | 0.352% |
| 33 | columbus | `RAC` | 48 | **1.153%** | 0.255% |
| 34 | charlotte | `CC` | 122 | **1.142%** | 2.148% |
| 35 | austin | `UNZ` | 65 | **1.132%** | 0.297% |
| 36 | sf | `TI-OS` | 6 | **1.109%** | 0.057% |
| 37 | sf | `MB-RA` | 10 | **1.108%** | 0.094% |
| 38 | charlotte | `MX-3` | 5 | **0.882%** | 0.088% |
| 39 | sf | `PDR-1-G` | 97 | **0.878%** | 0.914% |
| 40 | columbus | `LM2` | 42 | **0.831%** | 0.223% |
| 41 | austin | `NBG` | 45 | **0.801%** | 0.205% |
| 42 | charlotte | `R-9PUD` | 6 | **0.790%** | 0.106% |
| 43 | charlotte | `MX-2(INNOV)` | 31 | **0.780%** | 0.546% |
| 44 | columbus | `LSR` | 74 | **0.774%** | 0.394% |
| 45 | lasvegas | `M` | 588 | **0.753%** | 0.283% |
| 46 | charlotte | `R-15PUD` | 9 | **0.750%** | 0.158% |
| 47 | miami | `T4-O` | 48 | **0.707%** | 4.248% |
| 48 | denver | `O-1` | 20 | **0.677%** | 0.530% |
| 49 | columbus | `UCT` | 511 | **0.668%** | 2.718% |
| 50 | columbus | `LAR1` | 69 | **0.655%** | 0.367% |
| 51 | miami | `D3` | 10 | **0.492%** | 0.885% |
| 52 | columbus | `UGN-1` | 545 | **0.486%** | 2.898% |
| 53 | austin | `ERC` | 57 | **0.451%** | 0.260% |
| 54 | lasvegas | `R-4` | 777 | **0.451%** | 0.374% |
| 55 | charlotte | `NS` | 155 | **0.421%** | 2.729% |
| 56 | columbus | `PC` | 14 | **0.412%** | 0.074% |
| 57 | lasvegas | `R-MHP` | 18 | **0.393%** | 0.009% |
| 58 | columbus | `LR` | 15 | **0.386%** | 0.080% |
| 59 | charlotte | `R-20MF` | 40 | **0.384%** | 0.704% |
| 60 | denver | `B-3` | 28 | **0.382%** | 0.742% |
| 61 | charlotte | `R-12PUD` | 13 | **0.381%** | 0.229% |
| 62 | sf | `PM-R` | 53 | **0.364%** | 0.499% |
| 63 | sf | `CMUO` | 33 | **0.348%** | 0.311% |
| 64 | denver | `R-3` | 30 | **0.325%** | 0.795% |
| 65 | denver | `B-8` | 21 | **0.321%** | 0.556% |
| 66 | charlotte | `B-1SCD` | 51 | **0.320%** | 0.898% |
| 67 | sf | `YBI-OS` | 4 | **0.307%** | 0.038% |
| 68 | denver | `B-4` | 35 | **0.304%** | 0.927% |
| 69 | columbus | `LARO` | 26 | **0.299%** | 0.138% |
| 70 | sf | `TI-R` | 32 | **0.275%** | 0.301% |
| 71 | charlotte | `MX-3(INNOV)` | 2 | **0.274%** | 0.035% |
| 72 | austin | `AG` | 4 | **0.268%** | 0.018% |
| 73 | columbus | `UCR` | 173 | **0.244%** | 0.920% |
| 74 | denver | `GTWY` | 10 | **0.241%** | 0.265% |
| 75 | columbus | `LI` | 24 | **0.233%** | 0.128% |
| 76 | columbus | `LC2` | 67 | **0.225%** | 0.356% |
| 77 | lasvegas | `P-R` | 570 | **0.222%** | 0.274% |
| 78 | lasvegas | `C-M` | 205 | **0.201%** | 0.099% |
| 79 | austin | `TOD` | 136 | **0.189%** | 0.621% |
| 80 | lasvegas | `R-A` | 127 | **0.175%** | 0.061% |
| 81 | sf | `PDR-1-D` | 20 | **0.174%** | 0.188% |
| 82 | sf | `SALI` | 30 | **0.166%** | 0.283% |
| 83 | sf | `TI-MU` | 15 | **0.164%** | 0.141% |
| 84 | sf | `SB-DTR` | 7 | **0.162%** | 0.066% |
| 85 | sf | `Job Corps` | 1 | **0.160%** | 0.009% |
| 86 | sf | `P70-MU` | 2 | **0.155%** | 0.019% |
| 87 | denver | `R-X` | 4 | **0.149%** | 0.106% |
| 88 | sf | `S-MU` | 3 | **0.145%** | 0.028% |
| 89 | sf | `RH DTR` | 14 | **0.129%** | 0.132% |
| 90 | dallas | `CD-13` | 1 | **0.127%** | 0.026% |
| 91 | denver | `I-0` | 4 | **0.118%** | 0.106% |
| 92 | sf | `PPS-MU` | 1 | **0.114%** | 0.009% |
| 93 | denver | `B-2` | 36 | **0.111%** | 0.954% |
| 94 | sf | `MR-MU` | 2 | **0.104%** | 0.019% |
| 95 | columbus | `LRR` | 29 | **0.098%** | 0.154% |
| 96 | sf | `PDR-1-B` | 36 | **0.098%** | 0.339% |
| 97 | sf | `TI-PCI` | 3 | **0.098%** | 0.028% |
| 98 | denver | `R-5` | 4 | **0.094%** | 0.106% |
| 99 | sf | `PM-OS` | 24 | **0.093%** | 0.226% |
| 100 | dallas | `CD-9` | 1 | **0.088%** | 0.026% |
| 101 | denver | `I-2` | 1 | **0.087%** | 0.026% |
| 102 | dallas | `CD-6` | 1 | **0.086%** | 0.026% |
| 103 | charlotte | `R-PUD` | 1 | **0.082%** | 0.018% |
| 104 | columbus | `LR2F` | 26 | **0.076%** | 0.138% |
| 105 | dallas | `CD-15` | 1 | **0.075%** | 0.026% |
| 106 | sf | `BR-MU` | 1 | **0.073%** | 0.009% |
| 107 | dallas | `CD-2` | 1 | **0.073%** | 0.026% |
| 108 | dallas | `CD-10` | 1 | **0.065%** | 0.026% |
| 109 | columbus | `LAR3` | 10 | **0.065%** | 0.053% |
| 110 | charlotte | `MX-2 INNOV` | 3 | **0.064%** | 0.053% |
| 111 | charlotte | `R-RPUD` | 1 | **0.064%** | 0.018% |
| 112 | denver | `R-4` | 21 | **0.060%** | 0.556% |
| 113 | denver | `H-1-A` | 8 | **0.060%** | 0.212% |
| 114 | dallas | `CD-1` | 1 | **0.057%** | 0.026% |
| 115 | sf | `YBI-R` | 5 | **0.054%** | 0.047% |
| 116 | columbus | `LMHP` | 1 | **0.054%** | 0.005% |
| 117 | columbus | `LR4` | 4 | **0.053%** | 0.021% |
| 118 | dallas | `CD-8` | 1 | **0.052%** | 0.026% |
| 119 | dallas | `CD-12` | 1 | **0.051%** | 0.026% |
| 120 | columbus | `UCR-R` | 31 | **0.050%** | 0.165% |
| 121 | sf | `MB-O` | 1 | **0.050%** | 0.009% |
| 122 | denver | `H-1-B` | 2 | **0.049%** | 0.053% |
| 123 | columbus | `LR1` | 9 | **0.049%** | 0.048% |
| 124 | sf | `TB DTR` | 9 | **0.048%** | 0.085% |
| 125 | dallas | `CD-11` | 1 | **0.044%** | 0.026% |
| 126 | lasvegas | `R-5` | 28 | **0.043%** | 0.013% |
| 127 | charlotte | `TOD-MO` | 25 | **0.042%** | 0.440% |
| 128 | columbus | `UGN-2` | 42 | **0.041%** | 0.223% |
| 129 | nashville | `I` | 1 | **0.041%** | 0.017% |
| 130 | charlotte | `CC(ANDO)` | 2 | **0.035%** | 0.035% |
| 131 | columbus | `LAR2` | 6 | **0.034%** | 0.032% |
| 132 | dallas | `WMU-5` | 4 | **0.033%** | 0.105% |
| 133 | dallas | `CD-20` | 1 | **0.032%** | 0.026% |
| 134 | charlotte | `R-6PUD` | 1 | **0.032%** | 0.018% |
| 135 | sf | `PM-MU1` | 13 | **0.031%** | 0.122% |
| 136 | denver | `R-3-X` | 3 | **0.030%** | 0.079% |
| 137 | charlotte | `MX-2(INNOV) SPA` | 1 | **0.030%** | 0.018% |
| 138 | sf | `YBI-MU` | 3 | **0.028%** | 0.028% |
| 139 | denver | `I-1` | 2 | **0.027%** | 0.053% |
| 140 | dallas | `WMU-3` | 2 | **0.025%** | 0.052% |
| 141 | charlotte | `TOD-RO` | 9 | **0.025%** | 0.158% |
| 142 | dallas | `P(A)` | 66 | **0.022%** | 1.728% |
| 143 | charlotte | `MX-2(ANDO)` | 1 | **0.021%** | 0.018% |
| 144 | columbus | `LC3` | 21 | **0.018%** | 0.112% |
| 145 | austin | `TND` | 2 | **0.017%** | 0.009% |
| 146 | denver | `B-1` | 8 | **0.016%** | 0.212% |
| 147 | denver | `R-4-X` | 2 | **0.016%** | 0.053% |
| 148 | dallas | `CD-3` | 1 | **0.016%** | 0.026% |
| 149 | columbus | `UCRPD` | 10 | **0.015%** | 0.053% |
| 150 | denver | `B-8-G` | 4 | **0.014%** | 0.106% |
| 151 | sf | `PM-MU2` | 7 | **0.014%** | 0.066% |
| 152 | charlotte | `R/W` | 1 | **0.013%** | 0.018% |
| 153 | charlotte | `R-I` | 4 | **0.013%** | 0.070% |
| 154 | charlotte | `CAC-1 BVO` | 1 | **0.012%** | 0.018% |
| 155 | columbus | `LAR4` | 1 | **0.012%** | 0.005% |
| 156 | dallas | `CD-7` | 1 | **0.011%** | 0.026% |
| 157 | sf | `YBI-PCI` | 1 | **0.011%** | 0.009% |
| 158 | columbus | `LRRR` | 2 | **0.010%** | 0.011% |
| 159 | columbus | `LP1` | 25 | **0.010%** | 0.133% |
| 160 | dallas | `CD-21` | 1 | **0.009%** | 0.026% |
| 161 | dallas | `CD-17` | 1 | **0.008%** | 0.026% |
| 162 | dallas | `WR-5` | 4 | **0.008%** | 0.105% |
| 163 | dallas | `CD-14` | 1 | **0.008%** | 0.026% |
| 164 | sf | `PM-CF` | 1 | **0.007%** | 0.009% |
| 165 | columbus | `LC5` | 9 | **0.007%** | 0.048% |
| 166 | charlotte | `N2-B BVO` | 1 | **0.007%** | 0.018% |
| 167 | dallas | `UC-2` | 1 | **0.006%** | 0.026% |
| 168 | charlotte | `RE-3` | 3 | **0.005%** | 0.053% |
| 169 | charlotte | `CC SPA` | 1 | **0.005%** | 0.018% |
| 170 | denver | `O-2` | 2 | **0.005%** | 0.053% |
| 171 | lasvegas | `N-S` | 6 | **0.005%** | 0.003% |
| 172 | denver | `H-2` | 4 | **0.005%** | 0.106% |
| 173 | dallas | `CD-16` | 1 | **0.005%** | 0.026% |
| 174 | denver | `P-1` | 2 | **0.004%** | 0.053% |
| 175 | sf | `PM-S` | 1 | **0.004%** | 0.009% |
| 176 | denver | `R-0` | 2 | **0.004%** | 0.053% |
| 177 | dallas | `WMU-8` | 2 | **0.004%** | 0.052% |
| 178 | dallas | `WR-20` | 1 | **0.003%** | 0.026% |
| 179 | denver | `MS-3` | 1 | **0.003%** | 0.026% |
| 180 | dallas | `CD-4` | 1 | **0.003%** | 0.026% |
| 181 | charlotte | `RR-CD` | 1 | **0.003%** | 0.018% |
| 182 | denver | `MS-1` | 2 | **0.003%** | 0.053% |
| 183 | denver | `MS-2` | 1 | **0.002%** | 0.026% |
| 184 | charlotte | `NS(SPA)` | 1 | **0.002%** | 0.018% |
| 185 | charlotte | `NS(ANDO)` | 1 | **0.002%** | 0.018% |
| 186 | denver | `R-2-B` | 2 | **0.002%** | 0.053% |
| 187 | charlotte | `TOD-MO SPA` | 1 | **0.002%** | 0.018% |
| 188 | dallas | `PFD-1` | 1 | **0.001%** | 0.026% |
| 189 | charlotte | `TOC-NC` | 1 | **0.001%** | 0.018% |
| 190 | denver | `B-8-A` | 1 | **0.001%** | 0.026% |
| 191 | columbus | `LC1` | 2 | **0.001%** | 0.011% |
| 192 | columbus | `LM1` | 2 | **0.001%** | 0.011% |
| 193 | dallas | `MU=1` | 1 | **0.001%** | 0.026% |
| 194 | denver | `CCN` | 1 | **0.001%** | 0.026% |
| 195 | dallas | `MF-2 Chap 51` | 1 | **0.001%** | 0.026% |
| 196 | dallas | `WR-3` | 2 | **0.001%** | 0.052% |
| 197 | dallas | `GR Chap 51` | 1 | **0.001%** | 0.026% |
| 198 | dallas | `O-2 Chap 51` | 1 | **0.000%** | 0.026% |
| 199 | charlotte | `TOD-RO(HDO)` | 1 | **0.000%** | 0.018% |
| 200 | columbus | `LP2` | 1 | **0.000%** | 0.005% |
| 201 | denver | `B-5` | 1 | **0.000%** | 0.026% |
| 202 | denver | `OS-1` | 1 | **0.000%** | 0.026% |
| 203 | charlotte | `TOD-MO(HDO)` | 1 | **0.000%** | 0.018% |
| 204 | charlotte | `NS(HDO)` | 1 | **0.000%** | 0.018% |

## Measured against a layer that is not citywide zoning

These sit on a code table or a single-purpose overlay, so their share is of
that layer and not of the city. Kept out of the ranking rather than mixed in.

| city | field | code | features | share of that layer |
|---|---|---|---:|---:|
| sanjose | `HEIGHTLIMIT` | `Determined by FAA` | 3 | 15.000% |

## Unranked

These have no land share, so they are not placed in the order above. **Unranked
is not last and it is not zero.** The count column is still shown, and is still
the only thing measured about them.

| city | code | features | by count | why |
|---|---|---:|---:|---|
| la | `R1-1` | 7,257 | 12.306% | layer publishes no area column — this gap's land share is unmeasured, not small |
| phoenix | `P-1` | 409 | 4.238% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RS-1` | 2,438 | 4.134% | layer publishes no area column — this gap's land share is unmeasured, not small |
| phoenix | `C-O` | 367 | 3.803% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1` | 1,566 | 2.655% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1` | 1,276 | 2.164% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-RIO` | 1,089 | 1.847% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1` | 848 | 1.438% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-HCR` | 814 | 1.380% | layer publishes no area column — this gap's land share is unmeasured, not small |
| phoenix | `IND.PK.` | 122 | 1.264% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1V2` | 711 | 1.206% | layer publishes no area column — this gap's land share is unmeasured, not small |
| phoenix | `WU` | 89 | 0.922% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-CUGU` | 435 | 0.738% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-O` | 401 | 0.680% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE15-1-H` | 349 | 0.592% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-CPIO` | 291 | 0.493% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-CUGU` | 287 | 0.487% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-HPOZ` | 253 | 0.429% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-RFA` | 212 | 0.359% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-K` | 192 | 0.326% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE15-1-H-HCR` | 191 | 0.324% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-O` | 176 | 0.298% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-O-HPOZ` | 149 | 0.253% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE9-1` | 140 | 0.237% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1V2-O` | 136 | 0.231% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RS-1-RIO` | 135 | 0.229% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `CW` | 123 | 0.209% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-H` | 123 | 0.209% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1` | 118 | 0.200% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-O-CUGU` | 116 | 0.197% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE15-1-HCR` | 114 | 0.193% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)R1-1` | 107 | 0.181% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1-H-HCR` | 105 | 0.178% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RS-1` | 93 | 0.158% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-HPOZ` | 92 | 0.156% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1-H` | 91 | 0.154% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1R3-CPIO` | 89 | 0.151% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1R3-RG` | 85 | 0.144% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-HCR` | 77 | 0.131% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE20-1` | 71 | 0.120% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-WH1-6][I1-N]` | 71 | 0.120% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-HPOZ-HCR` | 70 | 0.119% | layer publishes no area column — this gap's land share is unmeasured, not small |
| phoenix | `FH` | 11 | 0.114% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1V1` | 67 | 0.114% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE20-1-H-HCR` | 67 | 0.114% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-CDO` | 66 | 0.112% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RS-1-O` | 65 | 0.110% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `UI(CA)` | 62 | 0.105% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE20-1-HCR` | 60 | 0.102% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `UV(CA)` | 60 | 0.102% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-O-HPOZ` | 59 | 0.100% | layer publishes no area column — this gap's land share is unmeasured, not small |
| phoenix | `COUNTY` | 9 | 0.093% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1-HCR` | 55 | 0.093% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RS-1-CUGU` | 55 | 0.093% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `MU(EC)` | 52 | 0.088% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-CDO-HCR` | 51 | 0.086% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-WH1-6][I2-N]` | 50 | 0.085% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1V3` | 49 | 0.083% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB1-CDF1-5][IX4-FA][CPIO]` | 48 | 0.081% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE15-1` | 47 | 0.080% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LB1-WH1-5][IX2-FA]` | 44 | 0.075% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1V3-RG` | 42 | 0.071% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-CUGU` | 41 | 0.070% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1H1` | 40 | 0.068% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1R3-RG-O` | 37 | 0.063% | layer publishes no area column — this gap's land share is unmeasured, not small |
| phoenix | `PSCOD` | 6 | 0.062% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1R3-O-CPIO` | 36 | 0.061% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-RIO` | 36 | 0.061% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-HPOZ` | 36 | 0.061% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-SH1-5][IX1-FA][CPIO]` | 36 | 0.061% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-H` | 35 | 0.059% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `NI(EC)` | 33 | 0.056% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE9-1-HCR` | 33 | 0.056% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MM1-CDF1-5][IX4-FA][CPIO]` | 33 | 0.056% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `GW(CA)` | 32 | 0.054% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-O-CPIO` | 32 | 0.054% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE15-1-HPOZ` | 32 | 0.054% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `LAX` | 31 | 0.053% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1-K` | 30 | 0.051% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `C2(PV)` | 29 | 0.049% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)R1-1` | 28 | 0.047% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-O-RFA` | 28 | 0.047% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-MK1-5][IX3-FA][CPIO]` | 25 | 0.042% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-SH1-5][CX3-FA][CPIO]` | 25 | 0.042% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[VF1-WH1-5][OS1-N]` | 25 | 0.042% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `FWY` | 23 | 0.039% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE9-1-HPOZ` | 23 | 0.039% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB1-G1-5][CX3-FA][CPIO]` | 23 | 0.039% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-G1-5][CX3-FA][CPIO]` | 23 | 0.039% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-SH1-5][CX4-FA][CPIO]` | 23 | 0.039% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE9-1-H` | 21 | 0.036% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1V3-O` | 20 | 0.034% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-RIO` | 20 | 0.034% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE15-1-H-RPD-HCR` | 20 | 0.034% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)R1-1-RIO` | 19 | 0.032% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-RIO` | 19 | 0.032% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-K` | 19 | 0.032% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-G1-5][IX3-FA][CPIO]` | 19 | 0.032% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-G1-5][P2-FA][CPIO]` | 19 | 0.032% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-O` | 18 | 0.031% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-G1-5][CX2-FA][CPIO-O]` | 18 | 0.031% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LM2-MU2-5][RX1-FA][CPIO]` | 18 | 0.031% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-G1-5][IX1-FA][CPIO]` | 18 | 0.031% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-SH1-5][IX3-FA][CPIO]` | 17 | 0.029% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LM1-CDF1-5][IX4-FA][CPIO]` | 17 | 0.029% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `C2-CSA1` | 16 | 0.027% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `FWY-O` | 16 | 0.027% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R4(PV)` | 16 | 0.027% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `UC(CA)` | 16 | 0.027% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-AL1-5][IX3-FA][CPIO]` | 15 | 0.025% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM4-CHC1-5][CX2-FA][CPIO]` | 15 | 0.025% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RS-1` | 13 | 0.022% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RE11-1` | 13 | 0.022% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RAS3(UV)` | 13 | 0.022% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-WH1-5][P2-FA]` | 13 | 0.022% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RA-1-K` | 12 | 0.020% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `ADP` | 12 | 0.020% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `LASED` | 12 | 0.020% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `NMU(EC)-POD` | 12 | 0.020% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1R3` | 12 | 0.020% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R3(EC)` | 12 | 0.020% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-G1-5][CX2-FA][CPIO]` | 12 | 0.020% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-G1-5][CX3-FA][CPIO-O]` | 12 | 0.020% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-CHC1-5][P2-FA][CPIO]` | 12 | 0.020% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(WC)RIVER-SN-RIO` | 11 | 0.019% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-HCR` | 11 | 0.019% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE20-1-H` | 11 | 0.019% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM4-CHC1-5][CX4-FA][CPIO-SN-CDO]` | 11 | 0.019% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB2-G1-5][CX2-FA][CPIO-O]` | 11 | 0.019% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-G1-5][CX2-FA][CPIO]` | 11 | 0.019% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM1-CHC1-5][CX3-FA][CPIO]` | 11 | 0.019% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `OS` | 10 | 0.017% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `PPSP` | 10 | 0.017% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-CDO-RIO` | 10 | 0.017% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-2` | 10 | 0.017% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-RIO-CUGU` | 10 | 0.017% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-K-HPOZ` | 10 | 0.017% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-G1-5][CX2-FA][CPIO]` | 10 | 0.017% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-AL2-5][CX1-FA][CPIO-O]` | 10 | 0.017% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(WC)DOWNTOWN-SN` | 9 | 0.015% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `OSP` | 9 | 0.015% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `PF` | 9 | 0.015% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-O-K` | 9 | 0.015% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-H-O` | 9 | 0.015% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RS-1-K` | 9 | 0.015% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `UC(CA)-CDO` | 9 | 0.015% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-G1-5][CX2-FA][CPIO]` | 9 | 0.015% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LN1-MU1-5][RG1-FA][CPIO]` | 9 | 0.015% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-SH1-5][CX2-FA][CPIO]` | 9 | 0.015% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(WC)NORTHVILLAGE-SN-RIO` | 8 | 0.014% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `OS(PV)` | 8 | 0.014% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `OS(UV)` | 8 | 0.014% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-K-RIO` | 8 | 0.014% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE20-1-K` | 8 | 0.014% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-G1-5][CX2-FA][CPIO-O]` | 8 | 0.014% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-WH1-5][P2-FA][CPIO]` | 8 | 0.014% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-G1-5][P2-FA][CPIO]` | 8 | 0.014% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-SH2-5][CX1-FA][CPIO-O-CDO]` | 8 | 0.014% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)R1-1-CUGU` | 7 | 0.012% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(WC)TOPANGA-SN-RIO` | 7 | 0.012% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-O-CUGU` | 7 | 0.012% | layer publishes no area column — this gap's land share is unmeasured, not small |
| phoenix | `GCP` | 1 | 0.010% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RE11-1` | 6 | 0.010% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RA-1` | 6 | 0.010% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `HJ(EC)` | 6 | 0.010% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-K` | 6 | 0.010% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-O-CUGU` | 6 | 0.010% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM3-CHC1-5][CX2-FA][CPIO]` | 6 | 0.010% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RA-1-K` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RS-1-O` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RS-1-RIO` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(WC)PARK-SN` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(WC)TOPANGA-SN` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1H1-O` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1V3-RG-O` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R3(UV)` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `SL-O` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `VARIOUS` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-SH1-5][CX2-FA][CPIO-O]` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-WH1-5][I1-N]` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LN1-MU2-5][RG1-FA][CPIO-O]` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LN1-MU2-5][RG1-FA][CPIO]` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MM1-CDR1-6][I1-N]` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-AL2-5][CX1-FA][CPIO]` | 5 | 0.008% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RE11-1-H` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(WC)COLLEGE-SN` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(WC)COMMERCE-SN` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(WC)UPTOWN-SN-RIO` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `CCA-SN-O` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `DNSP-SN` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `FRWY` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-O-CPIO` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1V2-HPOZ` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-H-K` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-RFA` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-H-K` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-K-RIO` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-O` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE20-1-H-K` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE9-1-K` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RS-1-HCR` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `SL` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `USC-1B` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-SH1-5][CX2-FA][CPIO-O]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-SH2-5][CX2-FA][CPIO]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB2-G1-5][CX3-FA][CPIO-O]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-G1-5][CX3-FA][CPIO-SN-O]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-SH1-5][CX3-FA][CPIO-O]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-G1-5][CX4-FA][CPIO]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-SH1-5][CX3-FA][CPIO-SN-CDO]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM1-CHC1-5][CX2-FA][CPIO]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM2-CHC1-5][CX4-FA][CPIO-SN-O]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-WH1-5][P2-FA][TCN]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-WH1-6][P2-FA]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LM2-G1-5][CX1-FA][CPIO]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LM2-SH2-5][CX1-FA][CPIO]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-SH1-5][P2-FA][CPIO]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-SH1-5][CX1-FA][CPIO]` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]RE20-1-H` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[T]RE-1` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[T]RE20-1` | 4 | 0.007% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(F)R2-1-RIO` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RA-1-H` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RA-1-H` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RE11-1-K` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `HR(EC)` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `LACFCD` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `M(PV)` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1R3-1-CPIO` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE20-1-O` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE20-1-O-K` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1-H-K` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1-H-RPD-HCR` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1-O-K` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-AL1-5][CX3-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-SH2-5][CX1-FA][CPIO-CDO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB2-G1-5][P2-FA][CPIO-O]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-G1-5][CX3-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-SH1-5][CX3-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-G1-5][CX3-FA][CPIO-O]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-SH1-5][CX4-FA][CPIO-O]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-SH1-5][CX4-FA][CPIO-SN-O]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM2-CHC1-5][CX2-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM2-CHC1-5][CX3-FA][CPIO-SN-CDO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LB2-CDR1-5][IX4-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LM2-MU2-5][RG1-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LN1-MU2-5][RX1-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB1-CDF1-5][P2-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MM1-CDR1-5][P2-FA]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MM1-CDR1-5][P2-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-G1-5][CX1-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-MK1-5][CX1-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-SH2-5][CX1-FA][CPIO]` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]R2-1` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]R2-1-O` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[T]RE11-1-H` | 3 | 0.005% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(F)RE11-1` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)R1-1-K` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)R1-1-RIO` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)R2-1` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RE11-1-K` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RE20-1-K` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)R1-1-K` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RE40-1` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RE9-1` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `ADP-TCN` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `C1(PV)` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `CM(UV)` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `LAX-TCN` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `NI(EC)-O` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `NMU(EC)-O-POD` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `PF(UV)` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-CA-HCR` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-K-RIO` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1P-1` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1V1-O` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-CDO` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-CDO-HCR` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R3(PV)` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R4` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R4(PV)-10` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R4(PV)-15` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE-1` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-H-O-K` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1-H-RIO` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE9-1-O-HPOZ` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE9-1-RIO` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DF1-WH1-5][P2-FA][CPIO-CDO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DF1-WH1-5][P2-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-G1-5][CX3-FA][CPIO-SN]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-G1-5][CX3-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-MK1-5][IX3-FA][CPIO-SN]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-SH1-5][CX3-FA][CPIO-SN]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-SH1-5][CX3-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-G1-5][CX2-FA][CPIO-CDO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-G1-5][CX2-FA][CPIO-O-CDO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-MK1-5][CX1-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-SH2-5][CX1-FA][CPIO-O-CDO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-SH2-5][CX2-FA][CPIO-CDO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-SH2-5][CX2-FA][CPIO-O-CDO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM3-CHC1-5][CX3-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM4-CHC1-5][CX4-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB2-G1-5][CX3-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-G1-5][CX2-FA][CPIO-SN-O]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB4-G1-5][P2-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-G1-5][CX4-FA][CPIO-O]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-G1-5][P2-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-SH1-5][CX4-FA][CPIO-SN]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-SH1-5][P2-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM2-CHC1-5][CX2-FA][CPIO-SN-CDO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM2-CHC1-5][CX3-FA][CPIO-SN]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM2-CHC1-5][CX3-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM2-CHC1-5][CX4-FA][CPIO-SN-CDO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LB2-CDR1-6][I1-N]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LM2-G1-5][CX2-FA][CPIO-O]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LM2-G1-5][CX2-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LN1-MU1-5][RX1-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-G1-5][CX3-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-G1-5][IX4-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-SH1-5][IX3-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-SH1-5][IX4-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MM1-CDR1-5][IX4-FA][CPIO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-G1-5][CX1-FA][CPIO-CDO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-SH2-5][CX1-FA][CPIO-CDO]` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]C2-2L-CDO-CUGU` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]R1-1-CDO` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]R1-1-CDO-CUGU` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[T]R1-1` | 2 | 0.003% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)M2-EZ1VL-CUGU` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)M2-EZ1VL-G-CUGU` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)R1-1-CUGU` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RA-1` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RE11-1-HCR` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RE11-1-K-RIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RE20-1-H` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RE40-1-O-K` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RE9-1` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RE9-1-K` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RS-1-K` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(Q)RS-1-RFA` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)R1-1-O` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)R1-1-RFA` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RE11-1-K-RIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RE9-1-H` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RS-1-CUGU` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `(T)RS-1-K` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `A1` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `A1(UV)` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `A2(PV)` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `GW(CA)-CDO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `HJ(EC)-O` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `HR(EC)-O` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `M2` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `M2(PV)` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `M3` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `MU(EC)-O` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `PF-O` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `PVSP` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `QRA-1-K` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-G-CUGU` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-1-K-RFA` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-2-RIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1-4` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R1P-2` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-1-CDO-RIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R2-2-RIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `R4-2L` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-CPIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-G-CUGU` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-HCR` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RA-1-K-CUGU` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RAP-1` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RAP-1-CUGU` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE11-1-H-RIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE15-1-H#-HCR` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE15-1-RPD-2.9-H` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE20-1-RIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1-K-CUGU` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE40-1-O` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE9-1-CDO-HCR` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE9-1-H-RPD-HCR` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `RE9-1-RFA` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `USC-1A` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-G1-5][P2-FA][CPIO-O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-G1-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-SH1-5][IX3-FA][CPIO-SN-O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM1-SH1-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-G1-5][CX1-FA][CPIO-CDO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-G1-5][CX1-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-G1-5][CX2-][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-G1-5][P2-FA][CPIO-CDO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM2-SH2-5][CX1-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM4-CHC1-5][P2-FA][CPIO-CDO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM4-SH1-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[DM5-SH2-5][CX1-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB2-G1-5][CX2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-G1-5][P2-FA][CPIO-O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB3-SH1-5][CX2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB4-SH1-5][CX3-FA][CPIO-SN]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-G1-5][CX3-FA][CPIO-CDO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-G1-5][CX4-FA][CPIO-SN-O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-G1-5][CX4-FA][CPIO-SN]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-G1-5][P2-FA][TCN]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HB5-SH1-5][CX3-FA][CPIO-TCN]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM1-CHC1-5][CX3-FA][CPIO-O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM1-CHC1-5][P2-FA][CPIO-O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM1-CHC1-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM2-CHC1-5][CX2-FA][CPIO-O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM2-CHC1-5][CX4-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[HM2-G1-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LB1-G1-5][P2-FA]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LB1-WH1-5][IX2-FA][SN-O-TCN]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LB1-WH1-5][IX2-FA][SN-O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-SH1-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-WH1-5][A1-1L]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-WH1-6][I1-N][O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LF1-WH1-6][P2-N]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LM2-G1-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LM2-MU1-5][CX1-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LM2-MU1-5][CX2-FA][CPIO-O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LN1-MU1-5][RG1-FA][CPIO-O]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LN1-MU2-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[LN1-SH2-5][RX1-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB1-CDR1-5][IX4-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-G1-5][CX3-FA][TCN]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MB2-SH1-5][P2-FA][CPIO-TCN]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MM1-CDF1-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MM1-CDR1-5][P2-FA][TCN]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-CHC1-5][CX1-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-G1-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-SH1-5][P2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-SH2-5][CX2-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[MN1-SH2-5][RX1-FA][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]CCS-O` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]PF-CDO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]R1-1` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]R1-2-CDO-RIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]R2-1-CDO-RIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]R2P-1-CDO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[Q]RA-1-CDO-RIO` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[T]RA-1-H` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[T]RE11-1` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[T]RE9-1` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[T]RS-1` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[VF1-G1-5][OS1-N]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[VF1-WH1-5][OS1-N][CPIO]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |
| la | `[VF1-WH1-6][I1-N]` | 1 | 0.002% | layer publishes no area column — this gap's land share is unmeasured, not small |

## How each layer was counted

| city | field | layer | features | method | blank | area column | reconciles |
|---|---|---|---:|---|---:|---|---|
| atlanta | `ZONECLASS` | Zoning District (Feature Layer) | 2,979 | per-value | 0 (null-or-empty) | `SHAPE.AREA` — unusable | yes |
| austin | `BASE_ZONE` | Current_Zoning_20190923 (Feature Layer) | 21,915 | grouped | 0 (null-or-empty) | `SHAPE__Area` | yes |
| charlotte | `ZoneDes` | Zoning (Feature Layer) | 5,680 | grouped | 0 (null-or-empty) | `SHAPE.STArea()` | yes |
| chicago | `ZONE_CLASS` | Zoning (Feature Layer) | 14,943 | per-value — grouped was 68 short | 0 (null-only) | `SHAPE.AREA` — unusable | yes |
| columbus | `CLASSIFICATION` | Base Zoning (Feature Layer) | 18,804 | grouped | 0 (null-or-empty) | `SHAPE.STArea()` | yes |
| dallas | `LONG_ZONE_DIST` | Base Zoning (Feature Layer) | 3,819 | grouped | 0 (null-or-empty) | `SHAPE.STArea()` | yes |
| dc | `ZR16` | Specific Zone (Feature Layer) | 977 | grouped | 1 (null-or-empty) | none published | yes |
| denver | `ZONE_DISTRICT` | Zoning (Feature Layer) | 3,775 | grouped | 0 (null-or-empty) | `SHAPE_Area` | yes |
| la | `ZONE_CMPLT` | Generalized Zoning (Feature Layer) | 58,973 | grouped | 0 (null-or-empty) | none published | yes |
| lasvegas | `ZONE` | Zoning (Feature Layer) | 207,834 | grouped | 1 (null-or-empty) | `SHAPE_Area` | yes |
| miami | `M21_ZONE` | Primary Zoning (Feature Layer) | 1,130 | grouped | 0 (null-or-empty) | `Shape.STArea()` | yes |
| milwaukee | `Zoning` | Zoning with downtown subdistricts (Feature Layer) | 148,087 | grouped | 0 (null-or-empty) | none published | yes |
| minneapolis | `Abbrv` | Planning_Zoning_Built_Form (Feature Layer) | 791 | grouped | 0 (null-or-empty) | `Shape__Area` | yes |
| nashville | `ZONE_DESC` | Zoning (Feature Layer) | 5,992 | grouped | 0 (null-or-empty) | `SHAPE.STArea()` | yes |
| nyc | `ZoneDist1` | MAPPLUTO (Feature Layer) | 856,614 | grouped | 13 (null-or-empty) | `Shape__Area` — unusable | yes |
| philadelphia | `MaxFAR` | ZoningCodeCharacteristics (Table) | 36 | grouped | 21 (null-or-empty) | none published | yes |
| philadelphia | `MaxHeight` | ZoningCodeCharacteristics (Table) | 36 | grouped | 11 (null-or-empty) | none published | yes |
| phoenix | `ZONING` | Zoning (Feature Layer) | 9,650 | grouped | 3 (null-or-empty) | none published | yes |
| raleigh | `ZONING` | Raleigh Zoning (Feature Layer) | 3,580 | grouped | 0 (null-or-empty) | `SHAPE.AREA` | yes |
| sandiego | `ZONE_NAME` | Official Zoning Map (Feature Layer) | 3,706 | grouped | 0 (null-or-empty) | `Shape_Area` | yes |
| sanjose | `HEIGHTLIMIT` | Specific Height Restriction (Feature Layer) | 20 | grouped | 0 (null-or-empty) | `SHAPE_Area` | yes |
| seattle | `ZONING` | DPD.ZONING_PV (Feature Layer) | 3,627 | grouped | 0 (null-or-empty) | none published | yes |
| sf | `zoning` | Zoning Map - Zoning Districts (Feature Layer) | 10,617 | grouped | 0 (null-or-empty) | `shape_Area` | yes |

