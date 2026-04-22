# Pixel Office Asset Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI가 생성한 24개의 픽셀아트 이미지를 타일 그리드에 맞는 크기로 리사이즈하고 픽셀 오피스 게임 엔진에 가구로 적용한다.

**Architecture:** `content-automation/processed_assets/`의 원본 이미지를 Pillow nearest-neighbor로 목표 픽셀 크기로 다운스케일 → `web/frontend/public/assets/furniture/{ID}/{ID}.png`에 배치 → `furniture-catalog.json`에서 기존 14개 항목 치수 수정 + 신규 10개 항목 추가.

**Tech Stack:** Python 3 + Pillow (이미지 리사이즈), Node.js/Next.js (게임 프론트엔드)

**Working Directory:** `/Users/minsoopark/Downloads/바이브코딩` (모든 경로는 이 루트 기준)

---

## 파일 변경 목록

| 동작 | 경로 | 역할 |
|---|---|---|
| Create | `resize_assets.py` | 24개 이미지 리사이즈 및 복사 스크립트 |
| Create | `update_catalog.py` | furniture-catalog.json 업데이트 스크립트 |
| Overwrite | `web/frontend/public/assets/furniture/WHITEBOARD/WHITEBOARD.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/DESK/DESK_FRONT.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/PC/PC_FRONT_OFF.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/COFFEE/COFFEE.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_BACK.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/LARGE_PAINTING/LARGE_PAINTING.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/SMALL_PAINTING/SMALL_PAINTING.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/PLANT/PLANT.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/PLANT_2/PLANT_2.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/LARGE_PLANT/LARGE_PLANT.png` | 기존 교체 (치수 동일, 이미지만) |
| Overwrite | `web/frontend/public/assets/furniture/POT/POT.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/CACTUS/CACTUS.png` | 기존 교체 |
| Overwrite | `web/frontend/public/assets/furniture/HANGING_PLANT/HANGING_PLANT.png` | 기존 교체 |
| Create dir+file | `web/frontend/public/assets/furniture/WATER_DISPENSER/WATER_DISPENSER.png` | 신규 |
| Create dir+file | `web/frontend/public/assets/furniture/ROBOT_VACUUM/ROBOT_VACUUM.png` | 신규 |
| Create dir+file | `web/frontend/public/assets/furniture/BOSS_MONITOR/BOSS_MONITOR.png` | 신규 |
| Create dir+file | `web/frontend/public/assets/furniture/SERVER_RACK/SERVER_RACK.png` | 신규 |
| Create dir+file | `web/frontend/public/assets/furniture/PLANT_3/PLANT_3.png` | 신규 |
| Create dir+file | `web/frontend/public/assets/furniture/PLANT_4/PLANT_4.png` | 신규 |
| Create dir+file | `web/frontend/public/assets/furniture/PLANT_5/PLANT_5.png` | 신규 |
| Create dir+file | `web/frontend/public/assets/furniture/CHART_1/CHART_1.png` | 신규 |
| Create dir+file | `web/frontend/public/assets/furniture/CHART_2/CHART_2.png` | 신규 |
| Create dir+file | `web/frontend/public/assets/furniture/CHART_3/CHART_3.png` | 신규 |
| Modify | `web/frontend/public/assets/furniture-catalog.json` | 치수 수정 + 신규 항목 추가 |

---

## Task 1: Pillow 설치 확인

**Files:**
- 없음 (환경 설정만)

- [ ] **Step 1: Pillow 설치 확인 및 설치**

```bash
python3 -c "import PIL; print(PIL.__version__)"
```

출력이 없거나 에러가 나면:

```bash
pip3 install Pillow
```

- [ ] **Step 2: 재확인**

```bash
python3 -c "from PIL import Image; print('Pillow OK')"
```

Expected: `Pillow OK`

---

## Task 2: 기존 에셋 백업

**Files:**
- 없음 (기존 폴더 복사만)

- [ ] **Step 1: furniture 폴더 전체 백업**

```bash
cp -r web/frontend/public/assets/furniture web/frontend/public/assets/furniture_backup_$(date +%Y%m%d)
```

- [ ] **Step 2: 백업 확인**

```bash
ls web/frontend/public/assets/ | grep furniture
```

Expected: `furniture`와 `furniture_backup_20260420` (날짜는 실행일 기준) 두 항목이 보여야 함.

---

## Task 3: 리사이즈 스크립트 작성

**Files:**
- Create: `resize_assets.py`

- [ ] **Step 1: resize_assets.py 파일 생성**

```python
#!/usr/bin/env python3
"""
픽셀 오피스 에셋 리사이즈 스크립트
processed_assets/ 이미지를 목표 픽셀 크기로 nearest-neighbor 리사이즈 후
web/frontend/public/assets/furniture/ 에 배치한다.
"""
import os
from PIL import Image

ASSETS_DIR = "content-automation/processed_assets"
DEST_DIR = "web/frontend/public/assets/furniture"

# (원본 파일명, 목적지 폴더명, 목적지 파일명, 목표 width px, 목표 height px)
MAPPINGS = [
    # 기존 ID 교체
    ("화이트보드.png",              "WHITEBOARD",       "WHITEBOARD.png",       96, 64),
    ("사장 책상.png",               "DESK",             "DESK_FRONT.png",       80, 48),
    ("컴퓨터, 마우스, 키보드.png",   "PC",               "PC_FRONT_OFF.png",     48, 48),
    ("커피머신.png",                "COFFEE",           "COFFEE.png",           32, 48),
    ("의자 앞쪽.png",               "CUSHIONED_CHAIR",  "CUSHIONED_CHAIR_FRONT.png", 32, 32),
    ("의자 뒤쪽.png",               "CUSHIONED_CHAIR",  "CUSHIONED_CHAIR_BACK.png",  32, 32),
    ("그림.png",                    "LARGE_PAINTING",   "LARGE_PAINTING.png",   64, 48),
    ("그림2.png",                   "SMALL_PAINTING",   "SMALL_PAINTING.png",   48, 48),
    ("식물1.png",                   "PLANT",            "PLANT.png",            32, 64),
    ("식물2.png",                   "PLANT_2",          "PLANT_2.png",          32, 64),
    ("식물3.png",                   "LARGE_PLANT",      "LARGE_PLANT.png",      32, 48),
    ("식물4.png",                   "POT",              "POT.png",              32, 64),
    ("식물5.png",                   "CACTUS",           "CACTUS.png",           32, 48),
    ("식물6.png",                   "HANGING_PLANT",    "HANGING_PLANT.png",    32, 64),
    # 신규 ID
    ("정수기.png",                  "WATER_DISPENSER",  "WATER_DISPENSER.png",  32, 64),
    ("로봇청소기.png",              "ROBOT_VACUUM",     "ROBOT_VACUUM.png",     32, 32),
    ("오른쪽 방 테이블.png",         "BOSS_MONITOR",     "BOSS_MONITOR.png",     48, 80),
    ("왼쪽방 테이블.png",            "SERVER_RACK",      "SERVER_RACK.png",      32, 64),
    ("식물7.png",                   "PLANT_3",          "PLANT_3.png",          32, 64),
    ("식물8.png",                   "PLANT_4",          "PLANT_4.png",          32, 64),
    ("식물9.png",                   "PLANT_5",          "PLANT_5.png",          32, 64),
    ("그래프 차트1.png",             "CHART_1",          "CHART_1.png",          64, 64),
    ("그래프 차트2.png",             "CHART_2",          "CHART_2.png",          96, 64),
    ("그래프 차트3.png",             "CHART_3",          "CHART_3.png",          64, 64),
]

def resize_and_copy(src_name, dest_folder, dest_file, target_w, target_h):
    src_path = os.path.join(ASSETS_DIR, src_name)
    dest_dir = os.path.join(DEST_DIR, dest_folder)
    dest_path = os.path.join(dest_dir, dest_file)

    if not os.path.exists(src_path):
        print(f"  [SKIP] 원본 없음: {src_path}")
        return False

    os.makedirs(dest_dir, exist_ok=True)

    img = Image.open(src_path).convert("RGBA")
    resized = img.resize((target_w, target_h), Image.NEAREST)
    resized.save(dest_path, "PNG")

    actual_w, actual_h = resized.size
    print(f"  [OK] {src_name} → {dest_folder}/{dest_file} ({actual_w}×{actual_h}px)")
    return True

def main():
    ok_count = 0
    skip_count = 0
    for (src, folder, fname, w, h) in MAPPINGS:
        success = resize_and_copy(src, folder, fname, w, h)
        if success:
            ok_count += 1
        else:
            skip_count += 1

    print(f"\n완료: {ok_count}개 처리, {skip_count}개 건너뜀")
    if skip_count > 0:
        print("⚠️  건너뜀 항목이 있음. processed_assets/ 파일명 확인 필요.")

if __name__ == "__main__":
    main()
```

---

## Task 4: 리사이즈 스크립트 실행 및 검증

**Files:**
- 없음 (Task 3 스크립트 실행)

- [ ] **Step 1: 스크립트 실행**

```bash
python3 resize_assets.py
```

Expected 출력 예시:
```
  [OK] 화이트보드.png → WHITEBOARD/WHITEBOARD.png (96×64px)
  [OK] 사장 책상.png → DESK/DESK_FRONT.png (80×48px)
  ...
완료: 24개 처리, 0개 건너뜀
```

건너뜀이 0이어야 한다. 파일명 오타나 누락이 있으면 이 단계에서 확인.

- [ ] **Step 2: 출력 파일 치수 검증**

```bash
python3 -c "
from PIL import Image
import os
checks = [
    ('web/frontend/public/assets/furniture/WHITEBOARD/WHITEBOARD.png', 96, 64),
    ('web/frontend/public/assets/furniture/DESK/DESK_FRONT.png', 80, 48),
    ('web/frontend/public/assets/furniture/PC/PC_FRONT_OFF.png', 48, 48),
    ('web/frontend/public/assets/furniture/COFFEE/COFFEE.png', 32, 48),
    ('web/frontend/public/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png', 32, 32),
    ('web/frontend/public/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_BACK.png', 32, 32),
    ('web/frontend/public/assets/furniture/LARGE_PAINTING/LARGE_PAINTING.png', 64, 48),
    ('web/frontend/public/assets/furniture/SMALL_PAINTING/SMALL_PAINTING.png', 48, 48),
    ('web/frontend/public/assets/furniture/PLANT/PLANT.png', 32, 64),
    ('web/frontend/public/assets/furniture/PLANT_2/PLANT_2.png', 32, 64),
    ('web/frontend/public/assets/furniture/LARGE_PLANT/LARGE_PLANT.png', 32, 48),
    ('web/frontend/public/assets/furniture/POT/POT.png', 32, 64),
    ('web/frontend/public/assets/furniture/CACTUS/CACTUS.png', 32, 48),
    ('web/frontend/public/assets/furniture/HANGING_PLANT/HANGING_PLANT.png', 32, 64),
    ('web/frontend/public/assets/furniture/WATER_DISPENSER/WATER_DISPENSER.png', 32, 64),
    ('web/frontend/public/assets/furniture/ROBOT_VACUUM/ROBOT_VACUUM.png', 32, 32),
    ('web/frontend/public/assets/furniture/BOSS_MONITOR/BOSS_MONITOR.png', 48, 80),
    ('web/frontend/public/assets/furniture/SERVER_RACK/SERVER_RACK.png', 32, 64),
    ('web/frontend/public/assets/furniture/PLANT_3/PLANT_3.png', 32, 64),
    ('web/frontend/public/assets/furniture/PLANT_4/PLANT_4.png', 32, 64),
    ('web/frontend/public/assets/furniture/PLANT_5/PLANT_5.png', 32, 64),
    ('web/frontend/public/assets/furniture/CHART_1/CHART_1.png', 64, 64),
    ('web/frontend/public/assets/furniture/CHART_2/CHART_2.png', 96, 64),
    ('web/frontend/public/assets/furniture/CHART_3/CHART_3.png', 64, 64),
]
all_ok = True
for path, ew, eh in checks:
    img = Image.open(path)
    w, h = img.size
    status = 'OK' if (w == ew and h == eh) else 'FAIL'
    if status == 'FAIL':
        all_ok = False
    print(f'  [{status}] {path.split(\"/\")[-1]}: {w}x{h} (expected {ew}x{eh})')
print('모두 정상' if all_ok else '실패 항목 있음 — 스크립트 재확인 필요')
"
```

Expected: 모든 항목 `[OK]`, 마지막 줄 `모두 정상`

- [ ] **Step 3: 커밋**

```bash
git add web/frontend/public/assets/furniture/
git commit -m "feat: AI 생성 가구 이미지 24개 nearest-neighbor 리사이즈 후 적용"
```

---

## Task 5: furniture-catalog.json 업데이트 스크립트 작성

**Files:**
- Create: `update_catalog.py`

이 파일은 JSON을 파싱해 기존 항목의 치수를 수정하고 신규 항목 10개를 추가한다.

- [ ] **Step 1: update_catalog.py 작성**

```python
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
```

---

## Task 6: 카탈로그 업데이트 실행 및 검증

**Files:**
- Modify: `web/frontend/public/assets/furniture-catalog.json`

- [ ] **Step 1: 스크립트 실행**

```bash
python3 update_catalog.py
```

Expected 출력:
```
기존 항목 업데이트: 13개
  WHITEBOARD: 96×64px (6×4 tiles)
  DESK_FRONT: 80×48px (5×3 tiles)
  ...
신규 항목 추가: 10개
  WATER_DISPENSER
  ...
완료. 총 항목 수: 46개
```

- [ ] **Step 2: JSON 유효성 검증**

```bash
python3 -c "
import json
with open('web/frontend/public/assets/furniture-catalog.json') as f:
    data = json.load(f)
print(f'항목 수: {len(data)}개')

# 치수 일관성 체크: width == footprintW * 16, height == footprintH * 16
errors = []
for e in data:
    if e['width'] != e['footprintW'] * 16:
        errors.append(f'{e[\"id\"]}: width {e[\"width\"]} != footprintW {e[\"footprintW\"]} * 16')
    if e['height'] != e['footprintH'] * 16:
        errors.append(f'{e[\"id\"]}: height {e[\"height\"]} != footprintH {e[\"footprintH\"]} * 16')

if errors:
    print('치수 오류:')
    for err in errors:
        print(f'  {err}')
else:
    print('치수 일관성 OK (모든 항목 width=footprintW×16, height=footprintH×16)')
"
```

Expected: `치수 일관성 OK`

오류가 나오면 update_catalog.py의 UPDATES 딕셔너리에서 해당 ID 수정 후 재실행.

- [ ] **Step 3: 신규 ID 존재 확인**

```bash
python3 -c "
import json
with open('web/frontend/public/assets/furniture-catalog.json') as f:
    data = json.load(f)
ids = {e['id'] for e in data}
new_ids = ['WATER_DISPENSER','ROBOT_VACUUM','BOSS_MONITOR','SERVER_RACK','PLANT_3','PLANT_4','PLANT_5','CHART_1','CHART_2','CHART_3']
for nid in new_ids:
    status = 'OK' if nid in ids else 'MISSING'
    print(f'  [{status}] {nid}')
"
```

Expected: 모든 항목 `[OK]`

- [ ] **Step 4: 커밋**

```bash
git add web/frontend/public/assets/furniture-catalog.json update_catalog.py resize_assets.py
git commit -m "feat: furniture-catalog.json 13개 치수 수정, 신규 10개 ID 추가"
```

---

## Task 7: 앱 실행 및 시각적 검증

**Files:**
- 없음 (실행 및 확인)

- [ ] **Step 1: 프론트엔드 개발 서버 실행**

```bash
cd web/frontend && npm run dev
```

서버가 뜨면 브라우저에서 `http://localhost:3000` (또는 콘솔에 표시된 포트) 접속.

- [ ] **Step 2: 가구 배치 패널 열어서 신규/변경 에셋 확인**

게임 내 가구 배치 UI에서 다음 항목 클릭 후 배치 시도:
- WHITEBOARD → 96×64px 크기로 보이는지 확인
- DESK_FRONT → 80×48px으로 사장 책상 이미지 표시되는지 확인
- WATER_DISPENSER → 목록에 새로 등장하는지 확인
- BOSS_MONITOR → 목록에 새로 등장하는지 확인
- CHART_1 / CHART_2 / CHART_3 → 벽에 배치 가능한지 확인

- [ ] **Step 3: 콘솔 에러 확인**

브라우저 개발자 도구(F12) → Console 탭에서 빨간 에러 없는지 확인.

흔한 에러:
- `Failed to load resource: .../WATER_DISPENSER.png` → Task 4 이미지 경로 재확인
- `Cannot read properties of undefined` → catalog 항목 누락 → Task 6 재실행

- [ ] **Step 4: 기존 기능 회귀 확인**

- 캐릭터 이동 및 충돌 정상 작동하는지 클릭해서 확인
- 기존 가구 (BIN, BOOKSHELF 등 변경하지 않은 가구) 배치 시 정상 표시되는지 확인

---

## 참고: 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| 이미지 깨짐(blur 없이 계단) | 정상 — nearest-neighbor 픽셀아트 | 무시 |
| 가구 이미지가 실제보다 크거나 작게 보임 | catalog width/height vs 실제 이미지 px 불일치 | Task 4 Step 2 검증 재실행 |
| 가구 클릭 히트박스 어긋남 | footprint 크기 변경으로 인한 자연스러운 결과 | 레이아웃 재배치 필요 |
| 벽걸이 가구(WHITEBOARD, CHART) 배치 안 됨 | canPlaceOnWalls 미설정 | catalog에서 해당 ID의 canPlaceOnWalls가 true인지 확인 |
| CUSHIONED_CHAIR_SIDE 이미지 깨짐 | 기존 16×16 파일 유지했으므로 크기 불일치 | 설계상 의도된 한계 — 기존 파일 사용 |
