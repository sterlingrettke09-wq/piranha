"""Compose the social share card: burgundy fish + stacked wordmark on cream.
Backgrounds are flood-filled to transparent from the corners (so the fish's
interior white teeth survive), then composited on a 1200x630 cream canvas.
Run: python3 scripts/make_og_card.py
"""
from PIL import Image, ImageDraw, ImageEnhance

LOGO = "public/logo/the-piranha-project-stacked.png"
FISH = "public/logo/piranha-fish.png"
OUT = "public/logo/og-card.png"

CREAM = (241, 237, 226)          # card background (piranha-bone)
SENTINEL = (255, 0, 255, 255)    # magenta marker for keyed-out pixels


def key_out_bg(path, thresh=46):
    """Flood-fill the light background from all four corners, return RGBA."""
    img = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(img)
    w, h = img.size
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(img, corner, SENTINEL[:3], thresh=thresh)
    rgba = img.convert("RGBA")
    px = rgba.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][:3] == SENTINEL[:3]:
                px[x, y] = (0, 0, 0, 0)
    return rgba


def bbox_crop(rgba):
    """Trim transparent margins."""
    bbox = rgba.getbbox()
    return rgba.crop(bbox) if bbox else rgba


# Fish — key bg, deepen toward burgundy, crop.
fish = bbox_crop(key_out_bg(FISH))
fish = ImageEnhance.Color(fish).enhance(0.82)       # desaturate a touch
fish = ImageEnhance.Brightness(fish).enhance(0.78)  # darken red -> burgundy

# Standalone transparent burgundy fish (used on the homepage hero, no CSS blend).
fish.save("public/logo/piranha-fish-burgundy.png", "PNG")

# Logo — key bg, crop.
logo = bbox_crop(key_out_bg(LOGO))


def fit(img, target_w, target_h):
    r = min(target_w / img.width, target_h / img.height)
    return img.resize((max(1, round(img.width * r)), max(1, round(img.height * r))), Image.LANCZOS)


card = Image.new("RGBA", (1200, 630), CREAM + (255,))

fish_r = fit(fish, 300, 230)
logo_r = fit(logo, 760, 300)

# Fish centered up top, wordmark centered below it.
fish_x = (1200 - fish_r.width) // 2
fish_y = 48
card.alpha_composite(fish_r, (fish_x, fish_y))

logo_y = fish_y + fish_r.height + 28
logo_x = (1200 - logo_r.width) // 2
card.alpha_composite(logo_r, (logo_x, logo_y))

card.convert("RGB").save(OUT, "PNG")
print("wrote", OUT, card.size)
