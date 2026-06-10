"""Compose the Red Tape Index social share card (1200x630).

Bone background, the burgundy piranha fish tucked in a corner, a serif headline
"THE RED TAPE INDEX", a subhead, and a horizontal bar chart of the ten cities'
"process months" — ranked ascending (least red tape on top).

Nothing about the chart is hard-coded. The months are re-derived from the SAME
constants src/lib/redTapeIndex.ts scores against: for each city,
  processMonths = lifecycleMonths[city].apartment + reliefAddMonthsByCity[city]
Both tables are regex-parsed straight out of src/config/estimates.ts, so this
card can never drift from the published index — change a constant and re-run.

Run: python3 scripts/make_redtape_card.py
"""
import re
from PIL import Image, ImageDraw, ImageFont

ESTIMATES = "src/config/estimates.ts"
FISH = "public/logo/piranha-fish-burgundy.png"
OUT = "public/logo/og-redtape.png"

# Brand palette (src/index.css).
BONE = (245, 241, 234)
BURGUNDY = (122, 27, 46)
INK = (38, 30, 30)
MUTED = (120, 104, 104)
BAR_BG = (228, 221, 210)

# Short labels for the chart, keyed by city slug.
SHORT = {
    "minneapolis": "Mpls",
    "austin": "Austin",
    "denver": "Denver",
    "chicago": "Chicago",
    "dc": "DC",
    "boston": "Boston",
    "seattle": "Seattle",
    "la": "LA",
    "nyc": "NYC",
    "sf": "SF",
}


def parse_constants():
    """Regex-parse lifecycleMonths (apartment) + reliefAddMonthsByCity from the TS."""
    src = open(ESTIMATES, encoding="utf-8").read()

    def block(name):
        # Grab the object literal body between the first `{` after the name and
        # its matching close at the start of a line (`}`), good enough for these
        # flat, hand-formatted tables.
        m = re.search(name + r"[^=]*=\s*\{(.*?)\n\}", src, re.S)
        if not m:
            raise SystemExit(f"could not locate {name} in {ESTIMATES}")
        return m.group(1)

    # lifecycleMonths: each line like `austin: { single: 15, multi: 24, apartment: 38 },`
    apartment = {}
    for slug, ap in re.findall(
        r"(\w+):\s*\{[^}]*apartment:\s*(\d+)[^}]*\}", block("lifecycleMonths")
    ):
        apartment[slug] = int(ap)

    # reliefAddMonthsByCity: each line like `sf: 12,`
    relief = {}
    for slug, n in re.findall(r"(\w+):\s*(\d+)\s*,", block("reliefAddMonthsByCity")):
        relief[slug] = int(n)

    cities = []
    for slug, ap in apartment.items():
        if slug not in SHORT:
            continue  # skip any non-city key that slipped through
        cities.append((slug, ap + relief.get(slug, 0)))
    cities.sort(key=lambda c: c[1])  # ascending: least red tape first
    return cities


def load_font(size, bold=True):
    """Best available DejaVu serif; fall back to the boldest sans cleanly."""
    candidates = (
        ["/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"]
        if bold
        else ["/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"]
    )
    candidates += [
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def fit(img, target_w, target_h):
    r = min(target_w / img.width, target_h / img.height)
    return img.resize((max(1, round(img.width * r)), max(1, round(img.height * r))), Image.LANCZOS)


def main():
    cities = parse_constants()
    if len(cities) != 10:
        raise SystemExit(f"expected 10 cities, derived {len(cities)}: {cities}")

    W, H = 1200, 630
    card = Image.new("RGBA", (W, H), BONE + (255,))
    draw = ImageDraw.Draw(card)

    headline_font = load_font(64, bold=True)
    subhead_font = load_font(28, bold=False)
    label_font = load_font(24, bold=True)
    value_font = load_font(22, bold=False)

    # ── Header ───────────────────────────────────────────────────────────────
    margin = 64
    draw.text((margin, 54), "THE RED TAPE INDEX", font=headline_font, fill=BURGUNDY)
    draw.text((margin, 132), "Ten cities ranked by the cost of permission",
              font=subhead_font, fill=MUTED)

    # Burgundy fish in the top-right corner (small).
    fish = fit(Image.open(FISH).convert("RGBA"), 200, 150)
    card.alpha_composite(fish, (W - margin - fish.width, 40))

    # ── Horizontal bar chart ─────────────────────────────────────────────────
    chart_top = 196
    chart_bottom = H - 48
    n = len(cities)
    row_h = (chart_bottom - chart_top) / n
    bar_h = min(28, row_h * 0.62)

    label_w = 96                       # left gutter for the city label
    bar_x0 = margin + label_w
    value_w = 92                       # right gutter for "NN mo"
    bar_max_w = W - margin - value_w - bar_x0

    max_months = max(m for _, m in cities)

    for i, (slug, months) in enumerate(cities):
        cy = chart_top + row_h * i + row_h / 2
        y0 = cy - bar_h / 2

        # City label (right-aligned into the gutter).
        lab = SHORT[slug]
        lbb = draw.textbbox((0, 0), lab, font=label_font)
        draw.text((bar_x0 - 14 - (lbb[2] - lbb[0]), cy - (lbb[3] - lbb[1]) / 2 - lbb[1]),
                  lab, font=label_font, fill=INK)

        # Track + filled bar.
        full_w = bar_max_w
        fill_w = max(2, bar_max_w * months / max_months)
        draw.rounded_rectangle([bar_x0, y0, bar_x0 + full_w, y0 + bar_h],
                               radius=bar_h / 2, fill=BAR_BG)
        draw.rounded_rectangle([bar_x0, y0, bar_x0 + fill_w, y0 + bar_h],
                               radius=bar_h / 2, fill=BURGUNDY)

        # Value label just past the bar end.
        val = f"{months} mo"
        vbb = draw.textbbox((0, 0), val, font=value_font)
        draw.text((bar_x0 + fill_w + 12, cy - (vbb[3] - vbb[1]) / 2 - vbb[1]),
                  val, font=value_font, fill=MUTED)

    card.convert("RGB").save(OUT, "PNG")
    print("wrote", OUT, card.size, "— cities:", [(s, m) for s, m in cities])


if __name__ == "__main__":
    main()
