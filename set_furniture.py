import json

LAYOUT_PATH = 'content-automation/web/frontend/public/assets/default-layout-1.json'

with open(LAYOUT_PATH, 'r', encoding='utf-8') as f:
    layout = json.load(f)

# Clear old furniture
layout['furniture'] = []

# New Furniture Placement
new_furniture = [
    # ==== 벽 장식 ====
    {"uid": "f-whiteboard", "type": "WHITEBOARD_NEW", "col": 14, "row": 10},
    {"uid": "f-painting1", "type": "PAINTING_1", "col": 3, "row": 10},
    {"uid": "f-painting2", "type": "PAINTING_2", "col": 7, "row": 10},
    
    # ==== 오른쪽 방 (세로로 긴 공간) ====
    # 1. 사장님 책상 (화이트보드 바로 아래, 통로 확보)
    {"uid": "f-boss-desk", "type": "BOSS_DESK", "col": 13, "row": 12},
    # 2. 직원 테이블 (사장님 책상 아래, 사이에 2칸 여유)
    {"uid": "f-right-table", "type": "RIGHT_ROOM_TABLE", "col": 13, "row": 16},
    # 3. 추가 원형 테이블 (오른쪽 구석)
    {"uid": "f-round-table", "type": "ROUND_TABLE", "col": 17, "row": 13},
    
    # ==== 왼쪽 방 (가로로 긴 공간) ====
    # 1. 왼쪽 방 직원 테이블
    {"uid": "f-left-table", "type": "LEFT_ROOM_TABLE", "col": 3, "row": 12},
    
    # ==== 기타 추가 가구 및 소품 ====
    {"uid": "f-water", "type": "WATER_COOLER", "col": 18, "row": 11},
    {"uid": "f-coffee", "type": "COFFEE_MACHINE", "col": 18, "row": 17},
    {"uid": "f-robot", "type": "ROBOT_VACUUM", "col": 11, "row": 18},
    {"uid": "f-extra", "type": "EXTRA_TABLE", "col": 11, "row": 11},
]

layout['furniture'] = new_furniture
layout['layoutRevision'] = layout.get('layoutRevision', 1) + 1

with open(LAYOUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(layout, f, ensure_ascii=False, indent=2)

print("Furniture successfully placed with clearance check.")
