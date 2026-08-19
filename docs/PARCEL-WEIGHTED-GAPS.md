# The 653 gaps, reordered by how much of each city they cover

*Derived from `scripts/__fixtures__/parcelWeights/` — measured 2026-08-19.*
*Regenerate with `npx vite-node scripts/write-parcel-weighted-gaps.ts`. Do not edit by hand.*

## What the number is

Each row is one district code the parser-domain sweep cannot explain, weighted
by the features carrying it in that city's principal zoning layer — the same
layer and field the provider reads to answer "what is this parcel zoned".

**Shares are within one city and do not compare across cities.** A feature is a
tax lot in New York (856,614 of them) and a zoning polygon in Denver (3,775).
Both are legitimate weights for ordering work inside a city; neither converts
to the other, and no total across cities appears anywhere below.

## Two columns, and they answer different questions

**A polygon count is not a land share, and on a district-grain layer the two
diverge hard in both directions.** Miami's thirteen gap codes are 68.67% of its
polygons and 37.04% of its land — near a factor of two. San Francisco's `P` is
7.49% of polygons and 30.73% of area — a factor of four the other way, because
public land comes in a few enormous parcels.

Count is what was asked for and is the right unit for "how many records does
this code touch". Area is the right unit for "how much of the city". Neither is
a correction of the other, so both are published and neither is called the
headline. An empty area cell means the layer publishes no usable area column —
unmeasured, not zero. Areas are in each layer's own projected units and are
never converted; only the within-city share is used, which is unit-free.

Every count reconciles against its own layer: the per-code counts plus the
measured null/blank bucket equal the layer's own `count(1=1)`, exactly, for all
23 targets. A target that did not reconcile would be excluded rather than shown.

## Cities, by the share sitting under a gap

| city | features under a gap | layer total | share by count | share by area | gap codes |
|---|---:|---:|---:|---:|---:|
| miami | 776 | 1,130 | 68.67% | 37.04% | 13 |
| la | 24,229 | 58,973 | 41.08% | — | 440 |
| columbus | 3,066 | 18,804 | 16.31% | 21.37% | 37 |
| sf | 1,361 | 10,617 | 12.82% | 41.91% | 33 |
| denver | 455 | 3,775 | 12.05% | 7.39% | 34 |
| charlotte | 602 | 5,680 | 10.60% | 10.62% | 36 |
| phoenix | 1,014 | 9,650 | 10.51% | — | 8 |
| austin | 1,128 | 21,915 | 5.15% | 7.13% | 8 |
| lasvegas | 6,299 | 207,834 | 3.03% | 11.07% | 11 |
| dallas | 105 | 3,819 | 2.75% | 0.92% | 31 |
| nashville | 1 | 5,992 | 0.02% | 0.04% | 1 |
| atlanta | 0 | 2,979 | 0.00% | — | 0 |
| milwaukee | 0 | 148,087 | 0.00% | — | 0 |
| raleigh | 0 | 3,580 | 0.00% | 0.00% | 0 |
| sandiego | 0 | 3,706 | 0.00% | 0.00% | 0 |
| seattle | 0 | 3,627 | 0.00% | — | 0 |
| chicago | 0 | 14,943 | 0.00% | — | 0 |
| dc | 0 | 977 | 0.00% | — | 0 |
| nyc | 0 | 856,614 | 0.00% | — | 0 |

## Every ranked gap

Ordered by share of polygon count, the decided denominator. The area column
is shown beside it, never blended into it.

| # | city | code | features | by count | by area |
|---:|---|---|---:|---:|---:|
| 1 | la | `R1-1` | 7,257 | 12.306% | — |
| 2 | miami | `CS` | 121 | 10.708% | 5.746% |
| 3 | miami | `CI` | 112 | 9.912% | 8.221% |
| 4 | miami | `T5-O` | 100 | 8.850% | 4.586% |
| 5 | miami | `T4-L` | 97 | 8.584% | 1.844% |
| 6 | sf | `P` | 795 | 7.488% | 30.729% |
| 7 | miami | `T5-L` | 79 | 6.991% | 2.440% |
| 8 | miami | `T4-R` | 71 | 6.283% | 4.073% |
| 9 | miami | `T4-O` | 48 | 4.248% | 0.707% |
| 10 | phoenix | `P-1` | 409 | 4.238% | — |
| 11 | miami | `D1` | 47 | 4.159% | 2.280% |
| 12 | la | `RS-1` | 2,438 | 4.134% | — |
| 13 | miami | `T5-R` | 45 | 3.982% | 2.466% |
| 14 | phoenix | `C-O` | 367 | 3.803% | — |
| 15 | austin | `SF2` | 715 | 3.263% | 2.021% |
| 16 | miami | `T1` | 34 | 3.009% | 1.491% |
| 17 | columbus | `UGN-1` | 545 | 2.898% | 0.486% |
| 18 | charlotte | `NS` | 155 | 2.729% | 0.421% |
| 19 | columbus | `UCT` | 511 | 2.718% | 0.668% |
| 20 | la | `R2-1` | 1,566 | 2.655% | — |
| 21 | denver | `R-2-A` | 85 | 2.252% | 1.648% |
| 22 | la | `RA-1` | 1,276 | 2.164% | — |
| 23 | charlotte | `CC` | 122 | 2.148% | 1.142% |
| 24 | la | `R1-1-RIO` | 1,089 | 1.847% | — |
| 25 | dallas | `P(A)` | 66 | 1.728% | 0.022% |
| 26 | denver | `R-2` | 55 | 1.457% | 1.348% |
| 27 | la | `RE11-1` | 848 | 1.438% | — |
| 28 | columbus | `CAC` | 269 | 1.431% | 2.434% |
| 29 | columbus | `LM` | 260 | 1.383% | 3.424% |
| 30 | la | `R1-1-HCR` | 814 | 1.380% | — |
| 31 | denver | `R-1` | 52 | 1.377% | 1.280% |
| 32 | columbus | `LC4` | 252 | 1.340% | 1.398% |
| 33 | phoenix | `IND.PK.` | 122 | 1.264% | — |
| 34 | la | `R1V2` | 711 | 1.206% | — |
| 35 | sf | `PDR-2` | 128 | 1.206% | 2.610% |
| 36 | lasvegas | `C-1` | 2,177 | 1.047% | 4.165% |
| 37 | columbus | `LAR12` | 185 | 0.984% | 2.726% |
| 38 | miami | `D2` | 11 | 0.973% | 1.392% |
| 39 | denver | `B-2` | 36 | 0.954% | 0.111% |
| 40 | denver | `B-4` | 35 | 0.927% | 0.304% |
| 41 | phoenix | `WU` | 89 | 0.922% | — |
| 42 | columbus | `UCR` | 173 | 0.920% | 0.244% |
| 43 | sf | `PDR-1-G` | 97 | 0.914% | 0.878% |
| 44 | charlotte | `B-1SCD` | 51 | 0.898% | 0.320% |
| 45 | miami | `D3` | 10 | 0.885% | 0.492% |
| 46 | charlotte | `MX-2` | 48 | 0.845% | 1.413% |
| 47 | denver | `R-3` | 30 | 0.795% | 0.325% |
| 48 | denver | `B-3` | 28 | 0.742% | 0.382% |
| 49 | la | `R1-1-CUGU` | 435 | 0.738% | — |
| 50 | charlotte | `R-20MF` | 40 | 0.704% | 0.384% |
| 51 | la | `R1-1-O` | 401 | 0.680% | — |
| 52 | columbus | `LR2` | 126 | 0.670% | 1.796% |
| 53 | charlotte | `MX-1` | 37 | 0.651% | 1.354% |
| 54 | lasvegas | `C-2` | 1,343 | 0.646% | 1.905% |
| 55 | austin | `TOD` | 136 | 0.621% | 0.189% |
| 56 | la | `RE15-1-H` | 349 | 0.592% | — |
| 57 | denver | `B-8` | 21 | 0.556% | 0.321% |
| 58 | denver | `R-4` | 21 | 0.556% | 0.060% |
| 59 | charlotte | `MX-2(INNOV)` | 31 | 0.546% | 0.780% |
| 60 | denver | `O-1` | 20 | 0.530% | 0.677% |
| 61 | columbus | `LARLD` | 99 | 0.526% | 1.360% |
| 62 | sf | `PM-R` | 53 | 0.499% | 0.364% |
| 63 | la | `R2-1-CPIO` | 291 | 0.493% | — |
| 64 | la | `R2-1-CUGU` | 287 | 0.487% | — |
| 65 | austin | `LA` | 104 | 0.475% | 2.249% |
| 66 | charlotte | `TOD-MO` | 25 | 0.440% | 0.042% |
| 67 | la | `R1-1-HPOZ` | 253 | 0.429% | — |
| 68 | columbus | `LSR` | 74 | 0.394% | 0.774% |
| 69 | lasvegas | `R-4` | 777 | 0.374% | 0.451% |
| 70 | columbus | `LAR1` | 69 | 0.367% | 0.655% |
| 71 | la | `R1-1-RFA` | 212 | 0.359% | — |
| 72 | columbus | `LC2` | 67 | 0.356% | 0.225% |
| 73 | charlotte | `MX-1(INNOV)` | 20 | 0.352% | 1.268% |
| 74 | sf | `PDR-1-B` | 36 | 0.339% | 0.098% |
| 75 | la | `RA-1-K` | 192 | 0.326% | — |
| 76 | la | `RE15-1-H-HCR` | 191 | 0.324% | — |
| 77 | sf | `CMUO` | 33 | 0.311% | 0.348% |
| 78 | sf | `TI-R` | 32 | 0.301% | 0.275% |
| 79 | la | `R2-1-O` | 176 | 0.298% | — |
| 80 | austin | `UNZ` | 65 | 0.297% | 1.132% |
| 81 | lasvegas | `M` | 588 | 0.283% | 0.753% |
| 82 | sf | `SALI` | 30 | 0.283% | 0.166% |
| 83 | lasvegas | `P-R` | 570 | 0.274% | 0.222% |
| 84 | denver | `GTWY` | 10 | 0.265% | 0.241% |
| 85 | austin | `ERC` | 57 | 0.260% | 0.451% |
| 86 | columbus | `RAC` | 48 | 0.255% | 1.153% |
| 87 | la | `R1-1-O-HPOZ` | 149 | 0.253% | — |
| 88 | la | `RE9-1` | 140 | 0.237% | — |
| 89 | la | `R1V2-O` | 136 | 0.231% | — |
| 90 | la | `RS-1-RIO` | 135 | 0.229% | — |
| 91 | charlotte | `R-12PUD` | 13 | 0.229% | 0.381% |
| 92 | sf | `PM-OS` | 24 | 0.226% | 0.093% |
| 93 | columbus | `LM2` | 42 | 0.223% | 0.831% |
| 94 | columbus | `UGN-2` | 42 | 0.223% | 0.041% |
| 95 | lasvegas | `NO_ZONE` | 460 | 0.221% | 2.756% |
| 96 | denver | `B-1` | 8 | 0.212% | 0.016% |
| 97 | denver | `H-1-A` | 8 | 0.212% | 0.060% |
| 98 | la | `CW` | 123 | 0.209% | — |
| 99 | la | `RE11-1-H` | 123 | 0.209% | — |
| 100 | austin | `NBG` | 45 | 0.205% | 0.801% |
| 101 | la | `RE40-1` | 118 | 0.200% | — |
| 102 | la | `R1-1-O-CUGU` | 116 | 0.197% | — |
| 103 | la | `RE15-1-HCR` | 114 | 0.193% | — |
| 104 | columbus | `LUCRPD` | 36 | 0.191% | 1.271% |
| 105 | sf | `PDR-1-D` | 20 | 0.188% | 0.174% |
| 106 | la | `(T)R1-1` | 107 | 0.181% | — |
| 107 | la | `RE40-1-H-HCR` | 105 | 0.178% | — |
| 108 | columbus | `UCR-R` | 31 | 0.165% | 0.050% |
| 109 | charlotte | `R-15PUD` | 9 | 0.158% | 0.750% |
| 110 | charlotte | `TOD-RO` | 9 | 0.158% | 0.025% |
| 111 | la | `(T)RS-1` | 93 | 0.158% | — |
| 112 | la | `R2-1-HPOZ` | 92 | 0.156% | — |
| 113 | la | `RE40-1-H` | 91 | 0.154% | — |
| 114 | columbus | `LRR` | 29 | 0.154% | 0.098% |
| 115 | la | `R1R3-CPIO` | 89 | 0.151% | — |
| 116 | la | `R1R3-RG` | 85 | 0.144% | — |
| 117 | sf | `TI-MU` | 15 | 0.141% | 0.164% |
| 118 | columbus | `LARO` | 26 | 0.138% | 0.299% |
| 119 | columbus | `LR2F` | 26 | 0.138% | 0.076% |
| 120 | columbus | `LP1` | 25 | 0.133% | 0.010% |
| 121 | sf | `RH DTR` | 14 | 0.132% | 0.129% |
| 122 | la | `RE11-1-HCR` | 77 | 0.131% | — |
| 123 | columbus | `LI` | 24 | 0.128% | 0.233% |
| 124 | sf | `PM-MU1` | 13 | 0.122% | 0.031% |
| 125 | la | `RE20-1` | 71 | 0.120% | — |
| 126 | la | `[LF1-WH1-6][I1-N]` | 71 | 0.120% | — |
| 127 | la | `R1-1-HPOZ-HCR` | 70 | 0.119% | — |
| 128 | phoenix | `FH` | 11 | 0.114% | — |
| 129 | la | `R1V1` | 67 | 0.114% | — |
| 130 | la | `RE20-1-H-HCR` | 67 | 0.114% | — |
| 131 | la | `R1-1-CDO` | 66 | 0.112% | — |
| 132 | columbus | `LC3` | 21 | 0.112% | 0.018% |
| 133 | la | `RS-1-O` | 65 | 0.110% | — |
| 134 | denver | `B-8-G` | 4 | 0.106% | 0.014% |
| 135 | denver | `H-2` | 4 | 0.106% | 0.005% |
| 136 | denver | `I-0` | 4 | 0.106% | 0.118% |
| 137 | denver | `R-5` | 4 | 0.106% | 0.094% |
| 138 | denver | `R-X` | 4 | 0.106% | 0.149% |
| 139 | charlotte | `R-9PUD` | 6 | 0.106% | 0.790% |
| 140 | la | `UI(CA)` | 62 | 0.105% | — |
| 141 | dallas | `WMU-5` | 4 | 0.105% | 0.033% |
| 142 | dallas | `WR-5` | 4 | 0.105% | 0.008% |
| 143 | la | `RE20-1-HCR` | 60 | 0.102% | — |
| 144 | la | `UV(CA)` | 60 | 0.102% | — |
| 145 | la | `R2-1-O-HPOZ` | 59 | 0.100% | — |
| 146 | lasvegas | `C-M` | 205 | 0.099% | 0.201% |
| 147 | sf | `MB-RA` | 10 | 0.094% | 1.108% |
| 148 | phoenix | `COUNTY` | 9 | 0.093% | — |
| 149 | la | `RE40-1-HCR` | 55 | 0.093% | — |
| 150 | la | `RS-1-CUGU` | 55 | 0.093% | — |
| 151 | miami | `CI-HD` | 1 | 0.088% | 1.299% |
| 152 | la | `MU(EC)` | 52 | 0.088% | — |
| 153 | charlotte | `MX-3` | 5 | 0.088% | 0.882% |
| 154 | la | `R1-1-CDO-HCR` | 51 | 0.086% | — |
| 155 | la | `[LF1-WH1-6][I2-N]` | 50 | 0.085% | — |
| 156 | sf | `TB DTR` | 9 | 0.085% | 0.048% |
| 157 | la | `R1V3` | 49 | 0.083% | — |
| 158 | la | `[MB1-CDF1-5][IX4-FA][CPIO]` | 48 | 0.081% | — |
| 159 | columbus | `LR` | 15 | 0.080% | 0.386% |
| 160 | la | `RE15-1` | 47 | 0.080% | — |
| 161 | denver | `R-3-X` | 3 | 0.079% | 0.030% |
| 162 | la | `[LB1-WH1-5][IX2-FA]` | 44 | 0.075% | — |
| 163 | columbus | `PC` | 14 | 0.074% | 0.412% |
| 164 | la | `R1V3-RG` | 42 | 0.071% | — |
| 165 | charlotte | `R-I` | 4 | 0.070% | 0.013% |
| 166 | la | `RA-1-CUGU` | 41 | 0.070% | — |
| 167 | la | `R1H1` | 40 | 0.068% | — |
| 168 | sf | `PM-MU2` | 7 | 0.066% | 0.014% |
| 169 | sf | `SB-DTR` | 7 | 0.066% | 0.162% |
| 170 | la | `R1R3-RG-O` | 37 | 0.063% | — |
| 171 | phoenix | `PSCOD` | 6 | 0.062% | — |
| 172 | lasvegas | `R-A` | 127 | 0.061% | 0.175% |
| 173 | la | `R1R3-O-CPIO` | 36 | 0.061% | — |
| 174 | la | `RA-1-RIO` | 36 | 0.061% | — |
| 175 | la | `RE11-1-HPOZ` | 36 | 0.061% | — |
| 176 | la | `[MB2-SH1-5][IX1-FA][CPIO]` | 36 | 0.061% | — |
| 177 | la | `RA-1-H` | 35 | 0.059% | — |
| 178 | sf | `TI-OS` | 6 | 0.057% | 1.109% |
| 179 | la | `NI(EC)` | 33 | 0.056% | — |
| 180 | la | `RE9-1-HCR` | 33 | 0.056% | — |
| 181 | la | `[MM1-CDF1-5][IX4-FA][CPIO]` | 33 | 0.056% | — |
| 182 | la | `GW(CA)` | 32 | 0.054% | — |
| 183 | la | `R2-1-O-CPIO` | 32 | 0.054% | — |
| 184 | la | `RE15-1-HPOZ` | 32 | 0.054% | — |
| 185 | columbus | `LAR3` | 10 | 0.053% | 0.065% |
| 186 | columbus | `UCRPD` | 10 | 0.053% | 0.015% |
| 187 | denver | `H-1-B` | 2 | 0.053% | 0.049% |
| 188 | denver | `I-1` | 2 | 0.053% | 0.027% |
| 189 | denver | `MS-1` | 2 | 0.053% | 0.003% |
| 190 | denver | `O-2` | 2 | 0.053% | 0.005% |
| 191 | denver | `P-1` | 2 | 0.053% | 0.004% |
| 192 | denver | `R-0` | 2 | 0.053% | 0.004% |
| 193 | denver | `R-2-B` | 2 | 0.053% | 0.002% |
| 194 | denver | `R-4-X` | 2 | 0.053% | 0.016% |
| 195 | charlotte | `MX-2 INNOV` | 3 | 0.053% | 0.064% |
| 196 | charlotte | `RE-3` | 3 | 0.053% | 0.005% |
| 197 | la | `LAX` | 31 | 0.053% | — |
| 198 | dallas | `WMU-3` | 2 | 0.052% | 0.025% |
| 199 | dallas | `WMU-8` | 2 | 0.052% | 0.004% |
| 200 | dallas | `WR-3` | 2 | 0.052% | 0.001% |
| 201 | la | `RE40-1-K` | 30 | 0.051% | — |
| 202 | la | `C2(PV)` | 29 | 0.049% | — |
| 203 | columbus | `LC5` | 9 | 0.048% | 0.007% |
| 204 | columbus | `LR1` | 9 | 0.048% | 0.049% |
| 205 | la | `(Q)R1-1` | 28 | 0.047% | — |
| 206 | la | `R1-1-O-RFA` | 28 | 0.047% | — |
| 207 | sf | `YBI-R` | 5 | 0.047% | 0.054% |
| 208 | la | `[DM1-MK1-5][IX3-FA][CPIO]` | 25 | 0.042% | — |
| 209 | la | `[HB5-SH1-5][CX3-FA][CPIO]` | 25 | 0.042% | — |
| 210 | la | `[VF1-WH1-5][OS1-N]` | 25 | 0.042% | — |
| 211 | la | `FWY` | 23 | 0.039% | — |
| 212 | la | `RE9-1-HPOZ` | 23 | 0.039% | — |
| 213 | la | `[HB1-G1-5][CX3-FA][CPIO]` | 23 | 0.039% | — |
| 214 | la | `[HB5-G1-5][CX3-FA][CPIO]` | 23 | 0.039% | — |
| 215 | la | `[HB5-SH1-5][CX4-FA][CPIO]` | 23 | 0.039% | — |
| 216 | sf | `YBI-OS` | 4 | 0.038% | 0.307% |
| 217 | la | `RE9-1-H` | 21 | 0.036% | — |
| 218 | charlotte | `CC(ANDO)` | 2 | 0.035% | 0.035% |
| 219 | charlotte | `MX-3(INNOV)` | 2 | 0.035% | 0.274% |
| 220 | la | `R1V3-O` | 20 | 0.034% | — |
| 221 | la | `RE11-1-RIO` | 20 | 0.034% | — |
| 222 | la | `RE15-1-H-RPD-HCR` | 20 | 0.034% | — |
| 223 | la | `(T)R1-1-RIO` | 19 | 0.032% | — |
| 224 | la | `R2-1-RIO` | 19 | 0.032% | — |
| 225 | la | `RE11-1-K` | 19 | 0.032% | — |
| 226 | la | `[DM1-G1-5][IX3-FA][CPIO]` | 19 | 0.032% | — |
| 227 | la | `[LF1-G1-5][P2-FA][CPIO]` | 19 | 0.032% | — |
| 228 | columbus | `LAR2` | 6 | 0.032% | 0.034% |
| 229 | la | `RA-1-O` | 18 | 0.031% | — |
| 230 | la | `[HB3-G1-5][CX2-FA][CPIO-O]` | 18 | 0.031% | — |
| 231 | la | `[LM2-MU2-5][RX1-FA][CPIO]` | 18 | 0.031% | — |
| 232 | la | `[MB2-G1-5][IX1-FA][CPIO]` | 18 | 0.031% | — |
| 233 | la | `[DM1-SH1-5][IX3-FA][CPIO]` | 17 | 0.029% | — |
| 234 | la | `[LM1-CDF1-5][IX4-FA][CPIO]` | 17 | 0.029% | — |
| 235 | sf | `HP-RA` | 3 | 0.028% | 2.098% |
| 236 | sf | `S-MU` | 3 | 0.028% | 0.145% |
| 237 | sf | `TI-PCI` | 3 | 0.028% | 0.098% |
| 238 | sf | `YBI-MU` | 3 | 0.028% | 0.028% |
| 239 | la | `C2-CSA1` | 16 | 0.027% | — |
| 240 | la | `FWY-O` | 16 | 0.027% | — |
| 241 | la | `R4(PV)` | 16 | 0.027% | — |
| 242 | la | `UC(CA)` | 16 | 0.027% | — |
| 243 | denver | `B-5` | 1 | 0.026% | 0.000% |
| 244 | denver | `B-8-A` | 1 | 0.026% | 0.001% |
| 245 | denver | `CCN` | 1 | 0.026% | 0.001% |
| 246 | denver | `I-2` | 1 | 0.026% | 0.087% |
| 247 | denver | `MS-2` | 1 | 0.026% | 0.002% |
| 248 | denver | `MS-3` | 1 | 0.026% | 0.003% |
| 249 | denver | `OS-1` | 1 | 0.026% | 0.000% |
| 250 | dallas | `CD-1` | 1 | 0.026% | 0.057% |
| 251 | dallas | `CD-10` | 1 | 0.026% | 0.065% |
| 252 | dallas | `CD-11` | 1 | 0.026% | 0.044% |
| 253 | dallas | `CD-12` | 1 | 0.026% | 0.051% |
| 254 | dallas | `CD-13` | 1 | 0.026% | 0.127% |
| 255 | dallas | `CD-14` | 1 | 0.026% | 0.008% |
| 256 | dallas | `CD-15` | 1 | 0.026% | 0.075% |
| 257 | dallas | `CD-16` | 1 | 0.026% | 0.005% |
| 258 | dallas | `CD-17` | 1 | 0.026% | 0.008% |
| 259 | dallas | `CD-2` | 1 | 0.026% | 0.073% |
| 260 | dallas | `CD-20` | 1 | 0.026% | 0.032% |
| 261 | dallas | `CD-21` | 1 | 0.026% | 0.009% |
| 262 | dallas | `CD-3` | 1 | 0.026% | 0.016% |
| 263 | dallas | `CD-4` | 1 | 0.026% | 0.003% |
| 264 | dallas | `CD-6` | 1 | 0.026% | 0.086% |
| 265 | dallas | `CD-7` | 1 | 0.026% | 0.011% |
| 266 | dallas | `CD-8` | 1 | 0.026% | 0.052% |
| 267 | dallas | `CD-9` | 1 | 0.026% | 0.088% |
| 268 | dallas | `GR Chap 51` | 1 | 0.026% | 0.001% |
| 269 | dallas | `MF-2 Chap 51` | 1 | 0.026% | 0.001% |
| 270 | dallas | `MU=1` | 1 | 0.026% | 0.001% |
| 271 | dallas | `O-2 Chap 51` | 1 | 0.026% | 0.000% |
| 272 | dallas | `PFD-1` | 1 | 0.026% | 0.001% |
| 273 | dallas | `UC-2` | 1 | 0.026% | 0.006% |
| 274 | dallas | `WR-20` | 1 | 0.026% | 0.003% |
| 275 | la | `[DM1-AL1-5][IX3-FA][CPIO]` | 15 | 0.025% | — |
| 276 | la | `[DM4-CHC1-5][CX2-FA][CPIO]` | 15 | 0.025% | — |
| 277 | la | `(Q)RS-1` | 13 | 0.022% | — |
| 278 | la | `(T)RE11-1` | 13 | 0.022% | — |
| 279 | la | `RAS3(UV)` | 13 | 0.022% | — |
| 280 | la | `[LF1-WH1-5][P2-FA]` | 13 | 0.022% | — |
| 281 | columbus | `LR4` | 4 | 0.021% | 0.053% |
| 282 | la | `(T)RA-1-K` | 12 | 0.020% | — |
| 283 | la | `ADP` | 12 | 0.020% | — |
| 284 | la | `LASED` | 12 | 0.020% | — |
| 285 | la | `NMU(EC)-POD` | 12 | 0.020% | — |
| 286 | la | `R1R3` | 12 | 0.020% | — |
| 287 | la | `R3(EC)` | 12 | 0.020% | — |
| 288 | la | `[DM2-G1-5][CX2-FA][CPIO]` | 12 | 0.020% | — |
| 289 | la | `[HB3-G1-5][CX3-FA][CPIO-O]` | 12 | 0.020% | — |
| 290 | la | `[MN1-CHC1-5][P2-FA][CPIO]` | 12 | 0.020% | — |
| 291 | sf | `MR-MU` | 2 | 0.019% | 0.104% |
| 292 | sf | `P70-MU` | 2 | 0.019% | 0.155% |
| 293 | la | `(WC)RIVER-SN-RIO` | 11 | 0.019% | — |
| 294 | la | `R2-1-HCR` | 11 | 0.019% | — |
| 295 | la | `RE20-1-H` | 11 | 0.019% | — |
| 296 | la | `[DM4-CHC1-5][CX4-FA][CPIO-SN-CDO]` | 11 | 0.019% | — |
| 297 | la | `[HB2-G1-5][CX2-FA][CPIO-O]` | 11 | 0.019% | — |
| 298 | la | `[HB3-G1-5][CX2-FA][CPIO]` | 11 | 0.019% | — |
| 299 | la | `[HM1-CHC1-5][CX3-FA][CPIO]` | 11 | 0.019% | — |
| 300 | austin | `AG` | 4 | 0.018% | 0.268% |
| 301 | charlotte | `CAC-1 BVO` | 1 | 0.018% | 0.012% |
| 302 | charlotte | `CC SPA` | 1 | 0.018% | 0.005% |
| 303 | charlotte | `MX-2(ANDO)` | 1 | 0.018% | 0.021% |
| 304 | charlotte | `MX-2(INNOV) SPA` | 1 | 0.018% | 0.030% |
| 305 | charlotte | `N2-B BVO` | 1 | 0.018% | 0.007% |
| 306 | charlotte | `NS(ANDO)` | 1 | 0.018% | 0.002% |
| 307 | charlotte | `NS(HDO)` | 1 | 0.018% | 0.000% |
| 308 | charlotte | `NS(SPA)` | 1 | 0.018% | 0.002% |
| 309 | charlotte | `R-6PUD` | 1 | 0.018% | 0.032% |
| 310 | charlotte | `R-PUD` | 1 | 0.018% | 0.082% |
| 311 | charlotte | `R-RPUD` | 1 | 0.018% | 0.064% |
| 312 | charlotte | `R/W` | 1 | 0.018% | 0.013% |
| 313 | charlotte | `RR-CD` | 1 | 0.018% | 0.003% |
| 314 | charlotte | `TOC-NC` | 1 | 0.018% | 0.001% |
| 315 | charlotte | `TOD-MO SPA` | 1 | 0.018% | 0.002% |
| 316 | charlotte | `TOD-MO(HDO)` | 1 | 0.018% | 0.000% |
| 317 | charlotte | `TOD-RO(HDO)` | 1 | 0.018% | 0.000% |
| 318 | la | `OS` | 10 | 0.017% | — |
| 319 | la | `PPSP` | 10 | 0.017% | — |
| 320 | la | `R1-1-CDO-RIO` | 10 | 0.017% | — |
| 321 | la | `R1-2` | 10 | 0.017% | — |
| 322 | la | `R2-1-RIO-CUGU` | 10 | 0.017% | — |
| 323 | la | `RA-1-K-HPOZ` | 10 | 0.017% | — |
| 324 | la | `[MB2-G1-5][CX2-FA][CPIO]` | 10 | 0.017% | — |
| 325 | la | `[MN1-AL2-5][CX1-FA][CPIO-O]` | 10 | 0.017% | — |
| 326 | nashville | `I` | 1 | 0.017% | 0.041% |
| 327 | la | `(WC)DOWNTOWN-SN` | 9 | 0.015% | — |
| 328 | la | `OSP` | 9 | 0.015% | — |
| 329 | la | `PF` | 9 | 0.015% | — |
| 330 | la | `RA-1-O-K` | 9 | 0.015% | — |
| 331 | la | `RE11-1-H-O` | 9 | 0.015% | — |
| 332 | la | `RS-1-K` | 9 | 0.015% | — |
| 333 | la | `UC(CA)-CDO` | 9 | 0.015% | — |
| 334 | la | `[DM1-G1-5][CX2-FA][CPIO]` | 9 | 0.015% | — |
| 335 | la | `[LN1-MU1-5][RG1-FA][CPIO]` | 9 | 0.015% | — |
| 336 | la | `[MB2-SH1-5][CX2-FA][CPIO]` | 9 | 0.015% | — |
| 337 | la | `(WC)NORTHVILLAGE-SN-RIO` | 8 | 0.014% | — |
| 338 | la | `OS(PV)` | 8 | 0.014% | — |
| 339 | la | `OS(UV)` | 8 | 0.014% | — |
| 340 | la | `RA-1-K-RIO` | 8 | 0.014% | — |
| 341 | la | `RE20-1-K` | 8 | 0.014% | — |
| 342 | la | `[DM2-G1-5][CX2-FA][CPIO-O]` | 8 | 0.014% | — |
| 343 | la | `[LF1-WH1-5][P2-FA][CPIO]` | 8 | 0.014% | — |
| 344 | la | `[MB2-G1-5][P2-FA][CPIO]` | 8 | 0.014% | — |
| 345 | la | `[MN1-SH2-5][CX1-FA][CPIO-O-CDO]` | 8 | 0.014% | — |
| 346 | lasvegas | `R-5` | 28 | 0.013% | 0.043% |
| 347 | la | `(T)R1-1-CUGU` | 7 | 0.012% | — |
| 348 | la | `(WC)TOPANGA-SN-RIO` | 7 | 0.012% | — |
| 349 | la | `R2-1-O-CUGU` | 7 | 0.012% | — |
| 350 | columbus | `LC1` | 2 | 0.011% | 0.001% |
| 351 | columbus | `LM1` | 2 | 0.011% | 0.001% |
| 352 | columbus | `LRRR` | 2 | 0.011% | 0.010% |
| 353 | phoenix | `GCP` | 1 | 0.010% | — |
| 354 | la | `(Q)RE11-1` | 6 | 0.010% | — |
| 355 | la | `(T)RA-1` | 6 | 0.010% | — |
| 356 | la | `HJ(EC)` | 6 | 0.010% | — |
| 357 | la | `R1-1-K` | 6 | 0.010% | — |
| 358 | la | `RA-1-O-CUGU` | 6 | 0.010% | — |
| 359 | la | `[DM3-CHC1-5][CX2-FA][CPIO]` | 6 | 0.010% | — |
| 360 | sf | `BR-MU` | 1 | 0.009% | 0.073% |
| 361 | sf | `Job Corps` | 1 | 0.009% | 0.160% |
| 362 | sf | `MB-O` | 1 | 0.009% | 0.050% |
| 363 | sf | `PM-CF` | 1 | 0.009% | 0.007% |
| 364 | sf | `PM-S` | 1 | 0.009% | 0.004% |
| 365 | sf | `PPS-MU` | 1 | 0.009% | 0.114% |
| 366 | sf | `YBI-PCI` | 1 | 0.009% | 0.011% |
| 367 | austin | `TND` | 2 | 0.009% | 0.017% |
| 368 | lasvegas | `R-MHP` | 18 | 0.009% | 0.393% |
| 369 | la | `(Q)RA-1-K` | 5 | 0.008% | — |
| 370 | la | `(T)RS-1-O` | 5 | 0.008% | — |
| 371 | la | `(T)RS-1-RIO` | 5 | 0.008% | — |
| 372 | la | `(WC)PARK-SN` | 5 | 0.008% | — |
| 373 | la | `(WC)TOPANGA-SN` | 5 | 0.008% | — |
| 374 | la | `R1H1-O` | 5 | 0.008% | — |
| 375 | la | `R1V3-RG-O` | 5 | 0.008% | — |
| 376 | la | `R3(UV)` | 5 | 0.008% | — |
| 377 | la | `SL-O` | 5 | 0.008% | — |
| 378 | la | `VARIOUS` | 5 | 0.008% | — |
| 379 | la | `[HB3-SH1-5][CX2-FA][CPIO-O]` | 5 | 0.008% | — |
| 380 | la | `[LF1-WH1-5][I1-N]` | 5 | 0.008% | — |
| 381 | la | `[LN1-MU2-5][RG1-FA][CPIO-O]` | 5 | 0.008% | — |
| 382 | la | `[LN1-MU2-5][RG1-FA][CPIO]` | 5 | 0.008% | — |
| 383 | la | `[MM1-CDR1-6][I1-N]` | 5 | 0.008% | — |
| 384 | la | `[MN1-AL2-5][CX1-FA][CPIO]` | 5 | 0.008% | — |
| 385 | la | `(T)RE11-1-H` | 4 | 0.007% | — |
| 386 | la | `(WC)COLLEGE-SN` | 4 | 0.007% | — |
| 387 | la | `(WC)COMMERCE-SN` | 4 | 0.007% | — |
| 388 | la | `(WC)UPTOWN-SN-RIO` | 4 | 0.007% | — |
| 389 | la | `CCA-SN-O` | 4 | 0.007% | — |
| 390 | la | `DNSP-SN` | 4 | 0.007% | — |
| 391 | la | `FRWY` | 4 | 0.007% | — |
| 392 | la | `R1-1-O-CPIO` | 4 | 0.007% | — |
| 393 | la | `R1V2-HPOZ` | 4 | 0.007% | — |
| 394 | la | `RA-1-H-K` | 4 | 0.007% | — |
| 395 | la | `RA-1-RFA` | 4 | 0.007% | — |
| 396 | la | `RE11-1-H-K` | 4 | 0.007% | — |
| 397 | la | `RE11-1-K-RIO` | 4 | 0.007% | — |
| 398 | la | `RE11-1-O` | 4 | 0.007% | — |
| 399 | la | `RE20-1-H-K` | 4 | 0.007% | — |
| 400 | la | `RE9-1-K` | 4 | 0.007% | — |
| 401 | la | `RS-1-HCR` | 4 | 0.007% | — |
| 402 | la | `SL` | 4 | 0.007% | — |
| 403 | la | `USC-1B` | 4 | 0.007% | — |
| 404 | la | `[DM2-SH1-5][CX2-FA][CPIO-O]` | 4 | 0.007% | — |
| 405 | la | `[DM2-SH2-5][CX2-FA][CPIO]` | 4 | 0.007% | — |
| 406 | la | `[HB2-G1-5][CX3-FA][CPIO-O]` | 4 | 0.007% | — |
| 407 | la | `[HB3-G1-5][CX3-FA][CPIO-SN-O]` | 4 | 0.007% | — |
| 408 | la | `[HB3-SH1-5][CX3-FA][CPIO-O]` | 4 | 0.007% | — |
| 409 | la | `[HB5-G1-5][CX4-FA][CPIO]` | 4 | 0.007% | — |
| 410 | la | `[HB5-SH1-5][CX3-FA][CPIO-SN-CDO]` | 4 | 0.007% | — |
| 411 | la | `[HM1-CHC1-5][CX2-FA][CPIO]` | 4 | 0.007% | — |
| 412 | la | `[HM2-CHC1-5][CX4-FA][CPIO-SN-O]` | 4 | 0.007% | — |
| 413 | la | `[LF1-WH1-5][P2-FA][TCN]` | 4 | 0.007% | — |
| 414 | la | `[LF1-WH1-6][P2-FA]` | 4 | 0.007% | — |
| 415 | la | `[LM2-G1-5][CX1-FA][CPIO]` | 4 | 0.007% | — |
| 416 | la | `[LM2-SH2-5][CX1-FA][CPIO]` | 4 | 0.007% | — |
| 417 | la | `[MB2-SH1-5][P2-FA][CPIO]` | 4 | 0.007% | — |
| 418 | la | `[MN1-SH1-5][CX1-FA][CPIO]` | 4 | 0.007% | — |
| 419 | la | `[Q]RE20-1-H` | 4 | 0.007% | — |
| 420 | la | `[T]RE-1` | 4 | 0.007% | — |
| 421 | la | `[T]RE20-1` | 4 | 0.007% | — |
| 422 | columbus | `LAR4` | 1 | 0.005% | 0.012% |
| 423 | columbus | `LMHP` | 1 | 0.005% | 0.054% |
| 424 | columbus | `LP2` | 1 | 0.005% | 0.000% |
| 425 | la | `(F)R2-1-RIO` | 3 | 0.005% | — |
| 426 | la | `(Q)RA-1-H` | 3 | 0.005% | — |
| 427 | la | `(T)RA-1-H` | 3 | 0.005% | — |
| 428 | la | `(T)RE11-1-K` | 3 | 0.005% | — |
| 429 | la | `HR(EC)` | 3 | 0.005% | — |
| 430 | la | `LACFCD` | 3 | 0.005% | — |
| 431 | la | `M(PV)` | 3 | 0.005% | — |
| 432 | la | `R1` | 3 | 0.005% | — |
| 433 | la | `R1R3-1-CPIO` | 3 | 0.005% | — |
| 434 | la | `RE20-1-O` | 3 | 0.005% | — |
| 435 | la | `RE20-1-O-K` | 3 | 0.005% | — |
| 436 | la | `RE40-1-H-K` | 3 | 0.005% | — |
| 437 | la | `RE40-1-H-RPD-HCR` | 3 | 0.005% | — |
| 438 | la | `RE40-1-O-K` | 3 | 0.005% | — |
| 439 | la | `[DM1-AL1-5][CX3-FA][CPIO]` | 3 | 0.005% | — |
| 440 | la | `[DM2-SH2-5][CX1-FA][CPIO-CDO]` | 3 | 0.005% | — |
| 441 | la | `[HB2-G1-5][P2-FA][CPIO-O]` | 3 | 0.005% | — |
| 442 | la | `[HB3-G1-5][CX3-FA][CPIO]` | 3 | 0.005% | — |
| 443 | la | `[HB3-SH1-5][CX3-FA][CPIO]` | 3 | 0.005% | — |
| 444 | la | `[HB5-G1-5][CX3-FA][CPIO-O]` | 3 | 0.005% | — |
| 445 | la | `[HB5-SH1-5][CX4-FA][CPIO-O]` | 3 | 0.005% | — |
| 446 | la | `[HB5-SH1-5][CX4-FA][CPIO-SN-O]` | 3 | 0.005% | — |
| 447 | la | `[HM2-CHC1-5][CX2-FA][CPIO]` | 3 | 0.005% | — |
| 448 | la | `[HM2-CHC1-5][CX3-FA][CPIO-SN-CDO]` | 3 | 0.005% | — |
| 449 | la | `[LB2-CDR1-5][IX4-FA][CPIO]` | 3 | 0.005% | — |
| 450 | la | `[LM2-MU2-5][RG1-FA][CPIO]` | 3 | 0.005% | — |
| 451 | la | `[LN1-MU2-5][RX1-FA][CPIO]` | 3 | 0.005% | — |
| 452 | la | `[MB1-CDF1-5][P2-FA][CPIO]` | 3 | 0.005% | — |
| 453 | la | `[MM1-CDR1-5][P2-FA]` | 3 | 0.005% | — |
| 454 | la | `[MM1-CDR1-5][P2-FA][CPIO]` | 3 | 0.005% | — |
| 455 | la | `[MN1-G1-5][CX1-FA][CPIO]` | 3 | 0.005% | — |
| 456 | la | `[MN1-MK1-5][CX1-FA][CPIO]` | 3 | 0.005% | — |
| 457 | la | `[MN1-SH2-5][CX1-FA][CPIO]` | 3 | 0.005% | — |
| 458 | la | `[Q]R2-1` | 3 | 0.005% | — |
| 459 | la | `[Q]R2-1-O` | 3 | 0.005% | — |
| 460 | la | `[T]RE11-1-H` | 3 | 0.005% | — |
| 461 | la | `(F)RE11-1` | 2 | 0.003% | — |
| 462 | la | `(Q)R1-1-K` | 2 | 0.003% | — |
| 463 | la | `(Q)R1-1-RIO` | 2 | 0.003% | — |
| 464 | la | `(Q)R2-1` | 2 | 0.003% | — |
| 465 | la | `(Q)RE11-1-K` | 2 | 0.003% | — |
| 466 | la | `(Q)RE20-1-K` | 2 | 0.003% | — |
| 467 | la | `(T)R1-1-K` | 2 | 0.003% | — |
| 468 | la | `(T)RE40-1` | 2 | 0.003% | — |
| 469 | la | `(T)RE9-1` | 2 | 0.003% | — |
| 470 | la | `ADP-TCN` | 2 | 0.003% | — |
| 471 | la | `C1(PV)` | 2 | 0.003% | — |
| 472 | la | `CM(UV)` | 2 | 0.003% | — |
| 473 | la | `LAX-TCN` | 2 | 0.003% | — |
| 474 | la | `NI(EC)-O` | 2 | 0.003% | — |
| 475 | la | `NMU(EC)-O-POD` | 2 | 0.003% | — |
| 476 | la | `PF(UV)` | 2 | 0.003% | — |
| 477 | la | `R1-1-CA-HCR` | 2 | 0.003% | — |
| 478 | la | `R1-1-K-RIO` | 2 | 0.003% | — |
| 479 | la | `R1P-1` | 2 | 0.003% | — |
| 480 | la | `R1V1-O` | 2 | 0.003% | — |
| 481 | la | `R2-1-CDO` | 2 | 0.003% | — |
| 482 | la | `R2-1-CDO-HCR` | 2 | 0.003% | — |
| 483 | la | `R3(PV)` | 2 | 0.003% | — |
| 484 | la | `R4` | 2 | 0.003% | — |
| 485 | la | `R4(PV)-10` | 2 | 0.003% | — |
| 486 | la | `R4(PV)-15` | 2 | 0.003% | — |
| 487 | la | `RE-1` | 2 | 0.003% | — |
| 488 | la | `RE11-1-H-O-K` | 2 | 0.003% | — |
| 489 | la | `RE40-1-H-RIO` | 2 | 0.003% | — |
| 490 | la | `RE9-1-O-HPOZ` | 2 | 0.003% | — |
| 491 | la | `RE9-1-RIO` | 2 | 0.003% | — |
| 492 | la | `[DF1-WH1-5][P2-FA][CPIO-CDO]` | 2 | 0.003% | — |
| 493 | la | `[DF1-WH1-5][P2-FA][CPIO]` | 2 | 0.003% | — |
| 494 | la | `[DM1-G1-5][CX3-FA][CPIO-SN]` | 2 | 0.003% | — |
| 495 | la | `[DM1-G1-5][CX3-FA][CPIO]` | 2 | 0.003% | — |
| 496 | la | `[DM1-MK1-5][IX3-FA][CPIO-SN]` | 2 | 0.003% | — |
| 497 | la | `[DM1-SH1-5][CX3-FA][CPIO-SN]` | 2 | 0.003% | — |
| 498 | la | `[DM1-SH1-5][CX3-FA][CPIO]` | 2 | 0.003% | — |
| 499 | la | `[DM2-G1-5][CX2-FA][CPIO-CDO]` | 2 | 0.003% | — |
| 500 | la | `[DM2-G1-5][CX2-FA][CPIO-O-CDO]` | 2 | 0.003% | — |
| 501 | la | `[DM2-MK1-5][CX1-FA][CPIO]` | 2 | 0.003% | — |
| 502 | la | `[DM2-SH2-5][CX1-FA][CPIO-O-CDO]` | 2 | 0.003% | — |
| 503 | la | `[DM2-SH2-5][CX2-FA][CPIO-CDO]` | 2 | 0.003% | — |
| 504 | la | `[DM2-SH2-5][CX2-FA][CPIO-O-CDO]` | 2 | 0.003% | — |
| 505 | la | `[DM3-CHC1-5][CX3-FA][CPIO]` | 2 | 0.003% | — |
| 506 | la | `[DM4-CHC1-5][CX4-FA][CPIO]` | 2 | 0.003% | — |
| 507 | la | `[HB2-G1-5][CX3-FA][CPIO]` | 2 | 0.003% | — |
| 508 | la | `[HB3-G1-5][CX2-FA][CPIO-SN-O]` | 2 | 0.003% | — |
| 509 | la | `[HB4-G1-5][P2-FA][CPIO]` | 2 | 0.003% | — |
| 510 | la | `[HB5-G1-5][CX4-FA][CPIO-O]` | 2 | 0.003% | — |
| 511 | la | `[HB5-G1-5][P2-FA][CPIO]` | 2 | 0.003% | — |
| 512 | la | `[HB5-SH1-5][CX4-FA][CPIO-SN]` | 2 | 0.003% | — |
| 513 | la | `[HB5-SH1-5][P2-FA][CPIO]` | 2 | 0.003% | — |
| 514 | la | `[HM2-CHC1-5][CX2-FA][CPIO-SN-CDO]` | 2 | 0.003% | — |
| 515 | la | `[HM2-CHC1-5][CX3-FA][CPIO-SN]` | 2 | 0.003% | — |
| 516 | la | `[HM2-CHC1-5][CX3-FA][CPIO]` | 2 | 0.003% | — |
| 517 | la | `[HM2-CHC1-5][CX4-FA][CPIO-SN-CDO]` | 2 | 0.003% | — |
| 518 | la | `[LB2-CDR1-6][I1-N]` | 2 | 0.003% | — |
| 519 | la | `[LM2-G1-5][CX2-FA][CPIO-O]` | 2 | 0.003% | — |
| 520 | la | `[LM2-G1-5][CX2-FA][CPIO]` | 2 | 0.003% | — |
| 521 | la | `[LN1-MU1-5][RX1-FA][CPIO]` | 2 | 0.003% | — |
| 522 | la | `[MB2-G1-5][CX3-FA][CPIO]` | 2 | 0.003% | — |
| 523 | la | `[MB2-G1-5][IX4-FA][CPIO]` | 2 | 0.003% | — |
| 524 | la | `[MB2-SH1-5][IX3-FA][CPIO]` | 2 | 0.003% | — |
| 525 | la | `[MB2-SH1-5][IX4-FA][CPIO]` | 2 | 0.003% | — |
| 526 | la | `[MM1-CDR1-5][IX4-FA][CPIO]` | 2 | 0.003% | — |
| 527 | la | `[MN1-G1-5][CX1-FA][CPIO-CDO]` | 2 | 0.003% | — |
| 528 | la | `[MN1-SH2-5][CX1-FA][CPIO-CDO]` | 2 | 0.003% | — |
| 529 | la | `[Q]C2-2L-CDO-CUGU` | 2 | 0.003% | — |
| 530 | la | `[Q]R1-1-CDO` | 2 | 0.003% | — |
| 531 | la | `[Q]R1-1-CDO-CUGU` | 2 | 0.003% | — |
| 532 | la | `[T]R1-1` | 2 | 0.003% | — |
| 533 | lasvegas | `N-S` | 6 | 0.003% | 0.005% |
| 534 | la | `(Q)M2-EZ1VL-CUGU` | 1 | 0.002% | — |
| 535 | la | `(Q)M2-EZ1VL-G-CUGU` | 1 | 0.002% | — |
| 536 | la | `(Q)R1-1-CUGU` | 1 | 0.002% | — |
| 537 | la | `(Q)RA-1` | 1 | 0.002% | — |
| 538 | la | `(Q)RE11-1-HCR` | 1 | 0.002% | — |
| 539 | la | `(Q)RE11-1-K-RIO` | 1 | 0.002% | — |
| 540 | la | `(Q)RE20-1-H` | 1 | 0.002% | — |
| 541 | la | `(Q)RE40-1-O-K` | 1 | 0.002% | — |
| 542 | la | `(Q)RE9-1` | 1 | 0.002% | — |
| 543 | la | `(Q)RE9-1-K` | 1 | 0.002% | — |
| 544 | la | `(Q)RS-1-K` | 1 | 0.002% | — |
| 545 | la | `(Q)RS-1-RFA` | 1 | 0.002% | — |
| 546 | la | `(T)R1-1-O` | 1 | 0.002% | — |
| 547 | la | `(T)R1-1-RFA` | 1 | 0.002% | — |
| 548 | la | `(T)RE11-1-K-RIO` | 1 | 0.002% | — |
| 549 | la | `(T)RE9-1-H` | 1 | 0.002% | — |
| 550 | la | `(T)RS-1-CUGU` | 1 | 0.002% | — |
| 551 | la | `(T)RS-1-K` | 1 | 0.002% | — |
| 552 | la | `A1` | 1 | 0.002% | — |
| 553 | la | `A1(UV)` | 1 | 0.002% | — |
| 554 | la | `A2(PV)` | 1 | 0.002% | — |
| 555 | la | `GW(CA)-CDO` | 1 | 0.002% | — |
| 556 | la | `HJ(EC)-O` | 1 | 0.002% | — |
| 557 | la | `HR(EC)-O` | 1 | 0.002% | — |
| 558 | la | `M2` | 1 | 0.002% | — |
| 559 | la | `M2(PV)` | 1 | 0.002% | — |
| 560 | la | `M3` | 1 | 0.002% | — |
| 561 | la | `MU(EC)-O` | 1 | 0.002% | — |
| 562 | la | `PF-O` | 1 | 0.002% | — |
| 563 | la | `PVSP` | 1 | 0.002% | — |
| 564 | la | `QRA-1-K` | 1 | 0.002% | — |
| 565 | la | `R1-1-G-CUGU` | 1 | 0.002% | — |
| 566 | la | `R1-1-K-RFA` | 1 | 0.002% | — |
| 567 | la | `R1-2-RIO` | 1 | 0.002% | — |
| 568 | la | `R1-4` | 1 | 0.002% | — |
| 569 | la | `R1P-2` | 1 | 0.002% | — |
| 570 | la | `R2-1-CDO-RIO` | 1 | 0.002% | — |
| 571 | la | `R2-2-RIO` | 1 | 0.002% | — |
| 572 | la | `R4-2L` | 1 | 0.002% | — |
| 573 | la | `RA-1-CPIO` | 1 | 0.002% | — |
| 574 | la | `RA-1-G-CUGU` | 1 | 0.002% | — |
| 575 | la | `RA-1-HCR` | 1 | 0.002% | — |
| 576 | la | `RA-1-K-CUGU` | 1 | 0.002% | — |
| 577 | la | `RAP-1` | 1 | 0.002% | — |
| 578 | la | `RAP-1-CUGU` | 1 | 0.002% | — |
| 579 | la | `RE11-1-H-RIO` | 1 | 0.002% | — |
| 580 | la | `RE15-1-H#-HCR` | 1 | 0.002% | — |
| 581 | la | `RE15-1-RPD-2.9-H` | 1 | 0.002% | — |
| 582 | la | `RE20-1-RIO` | 1 | 0.002% | — |
| 583 | la | `RE40-1-K-CUGU` | 1 | 0.002% | — |
| 584 | la | `RE40-1-O` | 1 | 0.002% | — |
| 585 | la | `RE9-1-CDO-HCR` | 1 | 0.002% | — |
| 586 | la | `RE9-1-H-RPD-HCR` | 1 | 0.002% | — |
| 587 | la | `RE9-1-RFA` | 1 | 0.002% | — |
| 588 | la | `USC-1A` | 1 | 0.002% | — |
| 589 | la | `[DM1-G1-5][P2-FA][CPIO-O]` | 1 | 0.002% | — |
| 590 | la | `[DM1-G1-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 591 | la | `[DM1-SH1-5][IX3-FA][CPIO-SN-O]` | 1 | 0.002% | — |
| 592 | la | `[DM1-SH1-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 593 | la | `[DM2-G1-5][CX1-FA][CPIO-CDO]` | 1 | 0.002% | — |
| 594 | la | `[DM2-G1-5][CX1-FA][CPIO]` | 1 | 0.002% | — |
| 595 | la | `[DM2-G1-5][CX2-][CPIO]` | 1 | 0.002% | — |
| 596 | la | `[DM2-G1-5][P2-FA][CPIO-CDO]` | 1 | 0.002% | — |
| 597 | la | `[DM2-SH2-5][CX1-FA][CPIO]` | 1 | 0.002% | — |
| 598 | la | `[DM4-CHC1-5][P2-FA][CPIO-CDO]` | 1 | 0.002% | — |
| 599 | la | `[DM4-SH1-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 600 | la | `[DM5-SH2-5][CX1-FA][CPIO]` | 1 | 0.002% | — |
| 601 | la | `[HB2-G1-5][CX2-FA][CPIO]` | 1 | 0.002% | — |
| 602 | la | `[HB3-G1-5][P2-FA][CPIO-O]` | 1 | 0.002% | — |
| 603 | la | `[HB3-SH1-5][CX2-FA][CPIO]` | 1 | 0.002% | — |
| 604 | la | `[HB4-SH1-5][CX3-FA][CPIO-SN]` | 1 | 0.002% | — |
| 605 | la | `[HB5-G1-5][CX3-FA][CPIO-CDO]` | 1 | 0.002% | — |
| 606 | la | `[HB5-G1-5][CX4-FA][CPIO-SN-O]` | 1 | 0.002% | — |
| 607 | la | `[HB5-G1-5][CX4-FA][CPIO-SN]` | 1 | 0.002% | — |
| 608 | la | `[HB5-G1-5][P2-FA][TCN]` | 1 | 0.002% | — |
| 609 | la | `[HB5-SH1-5][CX3-FA][CPIO-TCN]` | 1 | 0.002% | — |
| 610 | la | `[HM1-CHC1-5][CX3-FA][CPIO-O]` | 1 | 0.002% | — |
| 611 | la | `[HM1-CHC1-5][P2-FA][CPIO-O]` | 1 | 0.002% | — |
| 612 | la | `[HM1-CHC1-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 613 | la | `[HM2-CHC1-5][CX2-FA][CPIO-O]` | 1 | 0.002% | — |
| 614 | la | `[HM2-CHC1-5][CX4-FA][CPIO]` | 1 | 0.002% | — |
| 615 | la | `[HM2-G1-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 616 | la | `[LB1-G1-5][P2-FA]` | 1 | 0.002% | — |
| 617 | la | `[LB1-WH1-5][IX2-FA][SN-O-TCN]` | 1 | 0.002% | — |
| 618 | la | `[LB1-WH1-5][IX2-FA][SN-O]` | 1 | 0.002% | — |
| 619 | la | `[LF1-SH1-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 620 | la | `[LF1-WH1-5][A1-1L]` | 1 | 0.002% | — |
| 621 | la | `[LF1-WH1-6][I1-N][O]` | 1 | 0.002% | — |
| 622 | la | `[LF1-WH1-6][P2-N]` | 1 | 0.002% | — |
| 623 | la | `[LM2-G1-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 624 | la | `[LM2-MU1-5][CX1-FA][CPIO]` | 1 | 0.002% | — |
| 625 | la | `[LM2-MU1-5][CX2-FA][CPIO-O]` | 1 | 0.002% | — |
| 626 | la | `[LN1-MU1-5][RG1-FA][CPIO-O]` | 1 | 0.002% | — |
| 627 | la | `[LN1-MU2-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 628 | la | `[LN1-SH2-5][RX1-FA][CPIO]` | 1 | 0.002% | — |
| 629 | la | `[MB1-CDR1-5][IX4-FA][CPIO]` | 1 | 0.002% | — |
| 630 | la | `[MB2-G1-5][CX3-FA][TCN]` | 1 | 0.002% | — |
| 631 | la | `[MB2-SH1-5][P2-FA][CPIO-TCN]` | 1 | 0.002% | — |
| 632 | la | `[MM1-CDF1-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 633 | la | `[MM1-CDR1-5][P2-FA][TCN]` | 1 | 0.002% | — |
| 634 | la | `[MN1-CHC1-5][CX1-FA][CPIO]` | 1 | 0.002% | — |
| 635 | la | `[MN1-G1-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 636 | la | `[MN1-SH1-5][P2-FA][CPIO]` | 1 | 0.002% | — |
| 637 | la | `[MN1-SH2-5][CX2-FA][CPIO]` | 1 | 0.002% | — |
| 638 | la | `[MN1-SH2-5][RX1-FA][CPIO]` | 1 | 0.002% | — |
| 639 | la | `[Q]CCS-O` | 1 | 0.002% | — |
| 640 | la | `[Q]PF-CDO` | 1 | 0.002% | — |
| 641 | la | `[Q]R1-1` | 1 | 0.002% | — |
| 642 | la | `[Q]R1-2-CDO-RIO` | 1 | 0.002% | — |
| 643 | la | `[Q]R2-1-CDO-RIO` | 1 | 0.002% | — |
| 644 | la | `[Q]R2P-1-CDO` | 1 | 0.002% | — |
| 645 | la | `[Q]RA-1-CDO-RIO` | 1 | 0.002% | — |
| 646 | la | `[T]RA-1-H` | 1 | 0.002% | — |
| 647 | la | `[T]RE11-1` | 1 | 0.002% | — |
| 648 | la | `[T]RE9-1` | 1 | 0.002% | — |
| 649 | la | `[T]RS-1` | 1 | 0.002% | — |
| 650 | la | `[VF1-G1-5][OS1-N]` | 1 | 0.002% | — |
| 651 | la | `[VF1-WH1-5][OS1-N][CPIO]` | 1 | 0.002% | — |
| 652 | la | `[VF1-WH1-6][I1-N]` | 1 | 0.002% | — |

## Measured against a layer that is not citywide zoning

These sit on a code table or a single-purpose overlay, so their share is of
that layer and not of the city. Kept out of the ranking rather than mixed in.

| city | field | code | features | share of that layer |
|---|---|---|---:|---:|
| sanjose | `HEIGHTLIMIT` | `Determined by FAA` | 3 | 15.000% |

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

