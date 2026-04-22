import os
import glob
import json
from PIL import Image

ASSETS_SRC = 'content-automation/processed_assets'
PUBLIC_FURNITURE_DIR = 'content-automation/web/frontend/public/assets/furniture'
CATALOG_PATH = 'content-automation/web/frontend/public/assets/furniture-catalog.json'
LAYOUT_PATH = 'content-automation/web/frontend/public/assets/default-layout-1.json'
TILE_SIZE = 16

# Map user Korean names to internal IDs and categories
ASSET_MAPPING = {
    '사장 책상.png': {'id': 'BOSS_DESK', 'name': 'Boss Desk', 'category': 'desks', 'footprintW': 4, 'footprintH': 2},
    '오른쪽 방 테이블.png': {'id': 'RIGHT_ROOM_TABLE', 'name': 'Right Room Table', 'category': 'desks', 'footprintW': 4, 'footprintH': 2},
    '왼쪽방 테이블.png': {'id': 'LEFT_ROOM_TABLE', 'name': 'Left Room Table', 'category': 'desks', 'footprintW': 4, 'footprintH': 2},
    '추가_직원들 책상 1(가로버전).png': {'id': 'STAFF_DESK_H', 'name': 'Staff Desk', 'category': 'desks', 'footprintW': 4, 'footprintH': 2},
    '추가_테이블.png': {'id': 'EXTRA_TABLE', 'name': 'Extra Table', 'category': 'desks', 'footprintW': 2, 'footprintH': 2},
    '추가_원형 테이블.png': {'id': 'ROUND_TABLE', 'name': 'Round Table', 'category': 'desks', 'footprintW': 2, 'footprintH': 2},
    '화이트보드.png': {'id': 'WHITEBOARD_NEW', 'name': 'Whiteboard New', 'category': 'wall', 'footprintW': 2, 'footprintH': 1, 'canPlaceOnWalls': True},
    '정수기.png': {'id': 'WATER_COOLER', 'name': 'Water Cooler', 'category': 'decor', 'footprintW': 1, 'footprintH': 2},
    '커피머신.png': {'id': 'COFFEE_MACHINE', 'name': 'Coffee Machine', 'category': 'decor', 'footprintW': 1, 'footprintH': 1},
    '로봇청소기.png': {'id': 'ROBOT_VACUUM', 'name': 'Robot Vacuum', 'category': 'decor', 'footprintW': 1, 'footprintH': 1},
    '의자 앞쪽.png': {'id': 'CHAIR_FRONT_NEW', 'name': 'Chair Front', 'category': 'chairs', 'footprintW': 1, 'footprintH': 1},
    '의자 뒤쪽.png': {'id': 'CHAIR_BACK_NEW', 'name': 'Chair Back', 'category': 'chairs', 'footprintW': 1, 'footprintH': 1},
    '모니터, 마우스, 키보드.png': {'id': 'PC_NEW', 'name': 'PC Setup', 'category': 'decor', 'footprintW': 1, 'footprintH': 1, 'canPlaceOnSurfaces': True},
    '그림.png': {'id': 'PAINTING_1', 'name': 'Painting 1', 'category': 'wall', 'footprintW': 2, 'footprintH': 1, 'canPlaceOnWalls': True},
    '그림2.png': {'id': 'PAINTING_2', 'name': 'Painting 2', 'category': 'wall', 'footprintW': 2, 'footprintH': 1, 'canPlaceOnWalls': True},
}

with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
    catalog = json.load(f)

existing_ids = {item['id'] for item in catalog}

# 1. Process Assets
for korean_name, meta in ASSET_MAPPING.items():
    src_path = os.path.join(ASSETS_SRC, korean_name)
    if not os.path.exists(src_path):
        print(f"Skipping {korean_name} (not found)")
        continue
        
    furniture_id = meta['id']
    target_dir = os.path.join(PUBLIC_FURNITURE_DIR, furniture_id)
    os.makedirs(target_dir, exist_ok=True)
    
    # Calculate physical width/height
    w = meta['footprintW'] * TILE_SIZE
    h = meta['footprintH'] * TILE_SIZE
    
    # Read and resize image
    img = Image.open(src_path).convert("RGBA")
    # Resize with LANCZOS to maintain quality, ensuring exact bounds
    img = img.resize((w, h), Image.Resampling.LANCZOS)
    
    out_path = os.path.join(target_dir, f"{furniture_id}.png")
    img.save(out_path)
    
    # Register in catalog
    if furniture_id not in existing_ids:
        entry = {
            "id": furniture_id,
            "name": meta['name'],
            "label": meta['name'],
            "category": meta['category'],
            "file": f"{furniture_id}.png",
            "furniturePath": f"furniture/{furniture_id}/{furniture_id}.png",
            "width": w,
            "height": h,
            "footprintW": meta['footprintW'],
            "footprintH": meta['footprintH'],
            "isDesk": meta['category'] == 'desks',
            "canPlaceOnWalls": meta.get('canPlaceOnWalls', False),
            "canPlaceOnSurfaces": meta.get('canPlaceOnSurfaces', False),
            "backgroundTiles": 0,
            "groupId": furniture_id
        }
        catalog.append(entry)
        existing_ids.add(furniture_id)
        
with open(CATALOG_PATH, 'w', encoding='utf-8') as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print("✅ Assets resized and catalog updated!")

# 2. Layout Mod
with open(LAYOUT_PATH, 'r', encoding='utf-8') as f:
    layout = json.load(f)

cols = layout['cols']
rows = layout['rows']
tiles = layout['tiles']

def set_tile(c, r, val):
    if 0 <= c < cols and 0 <= r < rows:
        tiles[r * cols + c] = val

# Build the custom wall partition according to the new layout
# The inverted L shape partition: 
# Let's say top half is divided into two rooms. 
# Row 0-9 are 255. Walls start at row 10.
# We will draw a vertical partition at col 10 from row 10 to row 16.
for r in range(10, 17):
    set_tile(10, r, 0)
# Draw a horizontal partition for the boss room? The user said "right room table down, boss desk between whiteboard and table"
# Let's assume the whiteboard is at col 16, row 9.
# We will place Boss desk at col 14, row 11.
# And right room table at col 14, row 16.

# Remove existing furniture that might conflict
new_furniture = []
for f in layout['furniture']:
    # Remove old right room elements
    if f['col'] >= 11 and f['row'] >= 10:
        continue
    new_furniture.append(f)

# Add new custom furniture
new_furniture.extend([
    {"uid": "f-custom-boss-desk", "type": "BOSS_DESK", "col": 14, "row": 12},
    {"uid": "f-custom-right-table", "type": "RIGHT_ROOM_TABLE", "col": 14, "row": 17},
    {"uid": "f-custom-whiteboard", "type": "WHITEBOARD_NEW", "col": 16, "row": 9},
    {"uid": "f-custom-water", "type": "WATER_COOLER", "col": 12, "row": 10},
    {"uid": "f-custom-coffee", "type": "COFFEE_MACHINE", "col": 13, "row": 10},
    {"uid": "f-custom-robot", "type": "ROBOT_VACUUM", "col": 18, "row": 12},
])

layout['furniture'] = new_furniture
layout['layoutRevision'] = layout.get('layoutRevision', 1) + 1

with open(LAYOUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(layout, f, ensure_ascii=False, indent=2)

print("✅ Layout updated with new walls and custom furniture!")
