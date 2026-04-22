import json

LAYOUT_PATH = 'content-automation/web/frontend/public/assets/default-layout-1.json'

with open(LAYOUT_PATH, 'r', encoding='utf-8') as f:
    layout = json.load(f)

cols = layout['cols'] # 21
rows = layout['rows'] # 22
tiles = layout['tiles']

def set_tile(c, r, val):
    if 0 <= c < cols and 0 <= r < rows:
        tiles[r * cols + c] = val

# Reset walls
for r in range(rows):
    for c in range(cols):
        # 0 = wall, 1-9 = floor, 255 = void
        if r < 10:
            set_tile(c, r, 255)
        elif r == 10 or r == 20 or c == 0 or c == 20:
            set_tile(c, r, 0)
        else:
            set_tile(c, r, 1)

# L-shape: Fill bottom-left with walls (cols 0 to 10, rows 16 to 20)
for r in range(16, 21):
    for c in range(0, 11):
        set_tile(c, r, 0)

# Vertical partition between top-left and top-right (cols 10, rows 10 to 15)
for r in range(10, 16):
    set_tile(10, r, 0)
    
# Make an opening in the partition so agents can walk through!
# Let's open col 10, row 15
set_tile(10, 15, 1)

layout['tiles'] = tiles

with open(LAYOUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(layout, f, ensure_ascii=False, indent=2)

print("Layout updated to match the L-shape (bottom-left blocked, middle partition with a door).")
