"""
Colspan/rowspan-aware table extraction for api.municode.com payloads.

WHY THIS EXISTS
Atlanta's SPI chapters were excluded from zoning/atlanta.ts because their
per-subarea grids "run together when flattened to text". The access half of that
claim expired (the API returns real HTML tables); the READING half did not, because
these headers are three levels deep with merged cells:

    row 0   Midtown Mixed Use (SA #1) | Midtown Residential (SA #2) | Juniper East (SA #3)
    row 1   ................. | Juniper St. Transition | Non-Juniper St. Transition | .....
    row 2   FAR (by right) | Max FAR Bonus | Max FAR with Bonus | FAR (by right) | ...

⚠️ THE COLUMN-COUNT CHECK DOES NOT APPLY HERE, and reaching for it is dangerous.
On San Diego's Table 131-05C the header count, the data count and the live code
count were all six, and their agreement was the proof. Here a merged header cell
legitimately spans several data columns, so the counts SHOULD differ — and
"reconcile the counts" reads as an instruction to make them match, which can only
be done by misreading one side. A grid fixed that way passes the check and
publishes a neighbouring subarea's figure.

THE RECONCILIATION THAT DOES APPLY: COLUMN PATH, NOT COLUMN COUNT.
Expand the merges so every data cell carries its full header path, then check that
the distinct paths map onto the LIVE ZONE CODES. SPI-16 proves it — the enumeration
carries `SPI-16 SA2 JSTA`, and the grid resolves a column whose path is
(Midtown Residential SA #2 -> Juniper St. Transition). JSTA *is* that sub-column.
The identity is the evidence; the counts never had to agree.

    11 grid columns
     4 distinct (subarea, transition) zones
     5 live codes  (the fifth, SPI-16 SA1C, is a "-C" conditional variant, which
                    zoning/atlanta.ts already resolves to its base district)

⚠️ A ROW LABEL IS NOT ALWAYS IN COLUMN 0. Found 2026-08-18: a table may carry a
merged GROUP label in column 0 spanning several rows, with the real row label in
column 1 — SPI-9's FAR rows sit under a "Bulk Limitations" group that way. A scan
reading r[0] sees the group name and never the row, and reports the chapter as
having no FAR at all. That is the same merged-cell hazard this file already warns
about for HEADERS, in the ROW dimension, and it cost two published figures:
FAR rows across the SPI chapters went 27 -> 47 and rows carrying a '%' cell went
5 -> 8 once the scan read the first TWO columns for a label.

So when you scan rows for a label, scan the leading columns, not the leading
column — and take the first that matches, since the group name is broader than
the row name and matching it would attribute the row to the wrong thing.

Run it against a saved CodesContent payload:
    curl -o spi.json 'https://api.municode.com/CodesContent?nodeId=<id>&productId=10376'
    python3 scripts/municodeGrid.py spi.json
"""

import json, re, html, sys
from html.parser import HTMLParser

class Grid(HTMLParser):
    """Expand a table into a dense rows x cols grid, honouring colspan/rowspan."""
    def __init__(self):
        super().__init__(); self.tables=[]; self.cur=None; self.row=None
        self.cell=None; self.pending={}; self.r=0
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='table': self.cur=[]; self.pending={}; self.r=0
        elif tag=='tr' and self.cur is not None: self.row=[]; self.c=0
        elif tag in ('td','th') and self.row is not None:
            self.cell={'txt':'', 'cs':int(a.get('colspan',1) or 1), 'rs':int(a.get('rowspan',1) or 1)}
    def handle_data(self, d):
        if self.cell is not None: self.cell['txt'] += d
    def handle_endtag(self, tag):
        if tag in ('td','th') and self.cell is not None:
            self.row.append(self.cell); self.cell=None
        elif tag=='tr' and self.row is not None:
            # place cells into the dense grid, respecting rowspans carried down
            out=[]; c=0
            def carry():
                nonlocal c
                while (self.r,c) in self.pending:
                    out.append(self.pending.pop((self.r,c))); c+=1
            carry()
            for cell in self.row:
                t=html.unescape(re.sub(r'\s+',' ',cell['txt'])).strip()
                for k in range(cell['cs']):
                    out.append(t); 
                    for rr in range(1, cell['rs']):
                        self.pending[(self.r+rr, c)] = t
                    c+=1
                carry()
            self.cur.append(out); self.r+=1; self.row=None
        elif tag=='table' and self.cur is not None:
            self.tables.append(self.cur); self.cur=None

def tables_from(payload_path):
    s=open(payload_path,encoding='utf-8').read()
    try: s=json.loads(s) if s.strip().startswith('{') or s.strip().startswith('[') else s
    except Exception: pass
    if not isinstance(s,str): s=json.dumps(s)
    s=s.encode().decode('unicode_escape', errors='ignore')
    out=[]
    for m in re.findall(r'<table.*?</table>', s, re.S):
        g=Grid(); g.feed(m); out.extend(g.tables)
    return out


if __name__ == '__main__':
    import sys
    for path in sys.argv[1:]:
        for i, t in enumerate(tables_from(path)):
            widths = sorted(set(len(r) for r in t))
            print(f'--- table {i}: {len(t)} rows, widths {widths}')
            for r in t[:14]:
                print('   ' + ' | '.join((c or '-')[:18].ljust(18) for c in r))
