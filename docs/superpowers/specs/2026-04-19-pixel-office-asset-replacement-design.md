# 픽셀 오피스 AI 에셋 교체 설계 문서

**날짜:** 2026-04-19  
**접근법:** 접근법 2 — 리사이즈 + 신규 가구 ID 추가  
**레퍼런스:** `content-automation/processed_assets/완성본1.png`

---

## 1. 핵심 전제

- **TILE_SIZE = 16px** (엔진 고정값, 변경 없음)
- 이미지 규격 규칙: `width = footprintW × 16`, `height = footprintH × 16`
- 리사이즈 방식: **nearest-neighbor** (픽셀아트 도트 느낌 유지)
- 모든 에셋은 이미 픽셀아트 스타일로 생성되어 있음 → 별도 도트화 처리 불필요
- 충돌/길찾기(A* Pathfinding) 시스템은 건드리지 않음

---

## 2. 완성본 vs 현재 계획 차이점

| 항목 | 기존 계획 | 실제 완성본 기준 |
|---|---|---|
| 에셋 수 | 15개 | **24개** (필수) |
| 정수기 처리 | BIN으로 대체 임시 활용 | **신규 ID WATER_DISPENSER로 추가** |
| 오른쪽 방 테이블 | 테이블 취급 | **대형 모니터 디스플레이 (BOSS_MONITOR)** |
| 왼쪽방 테이블 | 테이블 취급 | **서버랙/수납 유닛 (SERVER_RACK)** |
| 식물 종류 | 6종 (PLANT~HANGING_PLANT) | **9종 (식물7~9 신규 추가)** |
| 그래프 차트 | 미등록 | **3종 벽면 대시보드 (CHART_1~3)** |
| 로봇청소기 | 미등록 | **신규 ID ROBOT_VACUUM으로 추가** |

---

## 3. 에셋 매핑 및 목표 규격

### 3.1 기존 ID 교체 (catalog의 width/height/footprint 업데이트)

| 파일명 | 원본 크기 | 비율 | 목표 타일 | 목표 px | 기존 ID | 비고 |
|---|---|---|---|---|---|---|
| 화이트보드.png | 482×369 | 1.31 | 6×4 | 96×64 | WHITEBOARD | canPlaceOnWalls:true |
| 사장 책상.png | 2632×1600 | 1.65 | 5×3 | 80×48 | DESK_FRONT | isDesk:true |
| 컴퓨터, 마우스, 키보드.png | 241×250 | 0.96 | 3×3 | 48×48 | PC_FRONT_OFF | canPlaceOnSurfaces:true |
| 커피머신.png | 228×309 | 0.74 | 2×3 | 32×48 | COFFEE | — |
| 의자 앞쪽.png | 195×267 | 0.73 | 2×2 | 32×32 | CUSHIONED_CHAIR_FRONT | orientation:front |
| 의자 뒤쪽.png | 241×256 | 0.94 | 2×2 | 32×32 | CUSHIONED_CHAIR_BACK | orientation:back |
| 그림.png | 331×229 | 1.45 | 4×3 | 64×48 | LARGE_PAINTING | canPlaceOnWalls:true |
| 그림2.png | 211×229 | 0.92 | 3×3 | 48×48 | SMALL_PAINTING | canPlaceOnWalls:true |
| 식물1.png | 392×688 | 0.57 | 2×4 | 32×64 | PLANT | — |
| 식물2.png | 369×688 | 0.54 | 2×4 | 32×64 | PLANT_2 | — |
| 식물3.png | 461×688 | 0.67 | 2×3 | 32×48 | LARGE_PLANT | — |
| 식물4.png | 316×726 | 0.44 | 2×4 | 32×64 | POT | — |
| 식물5.png | 392×657 | 0.60 | 2×3 | 32×48 | CACTUS | — |
| 식물6.png | 346×657 | 0.53 | 2×4 | 32×64 | HANGING_PLANT | canPlaceOnWalls:true |

### 3.2 신규 ID 추가 (furniture-catalog.json에 항목 추가)

| 파일명 | 원본 크기 | 목표 타일 | 목표 px | 신규 ID | 카테고리 | 비고 |
|---|---|---|---|---|---|---|
| 정수기.png | 152×309 | 2×4 | 32×64 | WATER_DISPENSER | decor | — |
| 로봇청소기.png | 193×176 | 2×2 | 32×32 | ROBOT_VACUUM | misc | — |
| 오른쪽 방 테이블.png | 621×1014 | 3×5 | 48×80 | BOSS_MONITOR | electronics | 사장실 대형 모니터 |
| 왼쪽방 테이블.png | 666×1291 | 2×4 | 32×64 | SERVER_RACK | misc | 직원 공간 서버랙 |
| 식물7.png | 223×423 | 2×4 | 32×64 | PLANT_3 | decor | — |
| 식물8.png | 238×423 | 2×4 | 32×64 | PLANT_4 | decor | — |
| 식물9.png | 269×473 | 2×4 | 32×64 | PLANT_5 | decor | — |
| 그래프 차트1.png | 265×301 | 4×4 | 64×64 | CHART_1 | wall | canPlaceOnWalls:true |
| 그래프 차트2.png | 433×301 | 6×4 | 96×64 | CHART_2 | wall | canPlaceOnWalls:true |
| 그래프 차트3.png | 267×301 | 4×4 | 64×64 | CHART_3 | wall | canPlaceOnWalls:true |

### 3.3 선택 에셋 (추가_ 파일 — 여유 있을 때)

| 파일명 | 예상 ID | 비고 |
|---|---|---|
| 추가_원형 테이블.png | ROUND_TABLE | 여유 시 추가 |
| 추가_직원들 책상 1(가로버전).png | EMPLOYEE_DESK | 여유 시 추가 |
| 추가_테이블.png | EXTRA_TABLE | 여유 시 추가 |

---

## 4. 파일 복사 경로

목적지 기준: `web/frontend/public/assets/furniture/`

- **기존 ID 교체:** 해당 폴더의 기존 파일명 그대로 덮어쓰기
  - 예: `WHITEBOARD/WHITEBOARD.png` 에 리사이즈된 화이트보드 이미지 복사
- **신규 ID:** 새 폴더 생성 후 이미지 배치
  - 예: `WATER_DISPENSER/WATER_DISPENSER.png`

---

## 5. 구현 단계 요약

1. **Python 리사이즈 스크립트 작성** — 24개 파일을 목표 px로 nearest-neighbor 축소, 투명 배경 유지
2. **기존 파일 백업** — `public/assets/furniture/` 전체 백업
3. **리사이즈된 이미지 복사** — 매핑 테이블 기준으로 배치
4. **furniture-catalog.json 업데이트**
   - 기존 14개 항목: width/height/footprintW/footprintH 수정
   - 신규 10개 항목: 카탈로그에 추가
5. **앱 실행 및 검증** — 각 가구 클릭·배치·충돌 테스트

---

## 6. 리스크 및 주의사항

- `PC_FRONT_OFF` 외 나머지 PC orientation 파일들(PC_FRONT_ON_1~3, PC_BACK, PC_SIDE)은 이번 교체 범위 밖 — 동작 보장 필요
- `CUSHIONED_CHAIR_SIDE` 파일은 processed_assets에 없음 → **기존 파일 유지**로 확정 (앞/뒤 이미지 교체 범위에서 제외)
- `backgroundTiles` 값은 기존 설정 그대로 유지 (변경 시 렌더링 레이어 순서 틀어짐 위험)
- 그래프 차트 3종은 "창문에 붙일 것"이라는 용도 명시 → 레이아웃 배치 시 창문 위치 참고
