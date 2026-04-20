#!/usr/bin/env python3
"""
furniture-catalog.json 업데이트 스크립트
- 기존 13개 항목: width/height/footprintW/footprintH 수정
- 신규 10개 항목: 카탈로그 끝에 추가
- LARGE_PLANT는 치수가 이미 32×48(2×3)으로 동일 → 업데이트 불필요
"""
import json

CATALOG_PATH = "web/frontend/public/assets/furniture-catalog.json"

# id → {width, height, footprintW, footprintH} 수정값
# 변경 없는 필드(backgroundTiles, canPlaceOnWalls 등)는 건드리지 않음
UPDATES = {
    "WHITEBOARD":           {"width": 96, "height": 64, "footprintW": 6, "footprintH": 4},
    "DESK_FRONT":           {"width": 80, "height": 48, "footprintW": 5, "footprintH": 3},
    "PC_FRONT_OFF":         {"width": 48, "height": 48, "footprintW": 3, "footprintH": 3},
    "COFFEE":               {"width": 32, "height": 48, "footprintW": 2, "footprintH": 3},
    "CUSHIONED_CHAIR_FRONT":{"width": 32, "height": 32, "footprintW": 2, "footprintH": 2},
    "CUSHIONED_CHAIR_BACK": {"width": 32, "height": 32, "footprintW": 2, "footprintH": 2},
    "LARGE_PAINTING":       {"width": 64, "height": 48, "footprintW": 4, "footprintH": 3},
    "SMALL_PAINTING":       {"width": 48, "height": 48, "footprintW": 3, "footprintH": 3},
    "PLANT":                {"width": 32, "height": 64, "footprintW": 2, "footprintH": 4},
    "PLANT_2":              {"width": 32, "height": 64, "footprintW": 2, "footprintH": 4},
    "POT":                  {"width": 32, "height": 64, "footprintW": 2, "footprintH": 4},
    "CACTUS":               {"width": 32, "height": 48, "footprintW": 2, "footprintH": 3},
    "HANGING_PLANT":        {"width": 32, "height": 64, "footprintW": 2, "footprintH": 4},
}

NEW_ENTRIES = [
    {
        "id": "WATER_DISPENSER", "name": "Water Dispenser", "label": "Water Dispenser",
        "category": "decor", "file": "WATER_DISPENSER.png",
        "furniturePath": "furniture/WATER_DISPENSER/WATER_DISPENSER.png",
        "width": 32, "height": 64, "footprintW": 2, "footprintH": 4,
        "isDesk": False, "canPlaceOnWalls": False, "canPlaceOnSurfaces": False,
        "backgroundTiles": 0, "groupId": "WATER_DISPENSER"
    },
    {
        "id": "ROBOT_VACUUM", "name": "Robot Vacuum", "label": "Robot Vacuum",
        "category": "misc", "file": "ROBOT_VACUUM.png",
        "furniturePath": "furniture/ROBOT_VACUUM/ROBOT_VACUUM.png",
        "width": 32, "height": 32, "footprintW": 2, "footprintH": 2,
        "isDesk": False, "canPlaceOnWalls": False, "canPlaceOnSurfaces": False,
        "backgroundTiles": 0, "groupId": "ROBOT_VACUUM"
    },
    {
        "id": "BOSS_MONITOR", "name": "Boss Monitor", "label": "Boss Monitor",
        "category": "electronics", "file": "BOSS_MONITOR.png",
        "furniturePath": "furniture/BOSS_MONITOR/BOSS_MONITOR.png",
        "width": 48, "height": 80, "footprintW": 3, "footprintH": 5,
        "isDesk": False, "canPlaceOnWalls": False, "canPlaceOnSurfaces": False,
        "backgroundTiles": 0, "groupId": "BOSS_MONITOR"
    },
    {
        "id": "SERVER_RACK", "name": "Server Rack", "label": "Server Rack",
        "category": "misc", "file": "SERVER_RACK.png",
        "furniturePath": "furniture/SERVER_RACK/SERVER_RACK.png",
        "width": 32, "height": 64, "footprintW": 2, "footprintH": 4,
        "isDesk": False, "canPlaceOnWalls": False, "canPlaceOnSurfaces": False,
        "backgroundTiles": 0, "groupId": "SERVER_RACK"
    },
    {
        "id": "PLANT_3", "name": "Plant", "label": "Plant",
        "category": "decor", "file": "PLANT_3.png",
        "furniturePath": "furniture/PLANT_3/PLANT_3.png",
        "width": 32, "height": 64, "footprintW": 2, "footprintH": 4,
        "isDesk": False, "canPlaceOnWalls": False, "canPlaceOnSurfaces": False,
        "backgroundTiles": 1, "groupId": "PLANT_3"
    },
    {
        "id": "PLANT_4", "name": "Plant", "label": "Plant",
        "category": "decor", "file": "PLANT_4.png",
        "furniturePath": "furniture/PLANT_4/PLANT_4.png",
        "width": 32, "height": 64, "footprintW": 2, "footprintH": 4,
        "isDesk": False, "canPlaceOnWalls": False, "canPlaceOnSurfaces": False,
        "backgroundTiles": 1, "groupId": "PLANT_4"
    },
    {
        "id": "PLANT_5", "name": "Plant", "label": "Plant",
        "category": "decor", "file": "PLANT_5.png",
        "furniturePath": "furniture/PLANT_5/PLANT_5.png",
        "width": 32, "height": 64, "footprintW": 2, "footprintH": 4,
        "isDesk": False, "canPlaceOnWalls": False, "canPlaceOnSurfaces": False,
        "backgroundTiles": 1, "groupId": "PLANT_5"
    },
    {
        "id": "CHART_1", "name": "Chart", "label": "Chart",
        "category": "wall", "file": "CHART_1.png",
        "furniturePath": "furniture/CHART_1/CHART_1.png",
        "width": 64, "height": 64, "footprintW": 4, "footprintH": 4,
        "isDesk": False, "canPlaceOnWalls": True, "canPlaceOnSurfaces": False,
        "backgroundTiles": 0, "groupId": "CHART_1"
    },
    {
        "id": "CHART_2", "name": "Chart", "label": "Chart",
        "category": "wall", "file": "CHART_2.png",
        "furniturePath": "furniture/CHART_2/CHART_2.png",
        "width": 96, "height": 64, "footprintW": 6, "footprintH": 4,
        "isDesk": False, "canPlaceOnWalls": True, "canPlaceOnSurfaces": False,
        "backgroundTiles": 0, "groupId": "CHART_2"
    },
    {
        "id": "CHART_3", "name": "Chart", "label": "Chart",
        "category": "wall", "file": "CHART_3.png",
        "furniturePath": "furniture/CHART_3/CHART_3.png",
        "width": 64, "height": 64, "footprintW": 4, "footprintH": 4,
        "isDesk": False, "canPlaceOnWalls": True, "canPlaceOnSurfaces": False,
        "backgroundTiles": 0, "groupId": "CHART_3"
    },
]

def main():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    # 기존 항목 치수 업데이트
    updated_ids = []
    for entry in catalog:
        if entry["id"] in UPDATES:
            entry.update(UPDATES[entry["id"]])
            updated_ids.append(entry["id"])

    print(f"기존 항목 업데이트: {len(updated_ids)}개")
    for eid in updated_ids:
        u = UPDATES[eid]
        print(f"  {eid}: {u['width']}×{u['height']}px ({u['footprintW']}×{u['footprintH']} tiles)")

    # 신규 항목 추가 (이미 존재하는 ID는 건너뜀)
    existing_ids = {e["id"] for e in catalog}
    added = []
    for entry in NEW_ENTRIES:
        if entry["id"] not in existing_ids:
            catalog.append(entry)
            added.append(entry["id"])
        else:
            print(f"  [SKIP] {entry['id']} 이미 존재")

    print(f"신규 항목 추가: {len(added)}개")
    for eid in added:
        print(f"  {eid}")

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False)

    print(f"\n완료. 총 항목 수: {len(catalog)}개")

if __name__ == "__main__":
    main()
