# 프론트엔드 에셋 및 레이아웃 무결성 적용 플랜 (Frontend Execution Plan)

본 문서는 새롭게 배경이 제거된 에셋(가구, 캐릭터)을 픽셀 오피스 엔진에 적용하고, 에러 없이 프론트엔드가 구동되도록 보장하기 위한 단계별 실행 계획입니다.

## 1. 투명화된 에셋 매핑 및 덮어쓰기 (Asset Replacement)
- **대상**: `content-automation/processed_assets/`에 생성된 33개의 배경 투명화 처리된 PNG 파일.
- **방식**: 기존 픽셀 오피스의 `web/frontend/public/assets/` 내부 경로에 맞춰 파일명과 크기(규격)를 똑같이 유지하여 덮어쓰기 합니다.

### 1.1 에셋 매핑 테이블 (Mapping Table)
작업 시 혼선을 방지하기 위해 다음 매핑을 기준으로 덮어쓰기를 진행합니다.
*참고: Slice 파일들은 완성본 이미지에서 분할된 추가 에셋들로, 크기 및 용도에 맞게 매핑 또는 신규 추가해야 합니다.*

| 원본 파일명 (processed_assets) | 목적지 경로 (public/assets/furniture/...) | 대상 가구 ID |
|:---|:---|:---|
| 화이트보드.png | WHITEBOARD/WHITEBOARD.png | WHITEBOARD |
| 커피머신.png | COFFEE/COFFEE.png | COFFEE |
| 사장 책상.png | DESK/DESK_FRONT.png | DESK_FRONT |
| 컴퓨터, 마우스, 키보드.png | PC/PC_FRONT_OFF.png | PC_FRONT_OFF |
| 식물1.png | PLANT/PLANT.png | PLANT |
| 식물2.png | PLANT_2/PLANT_2.png | PLANT_2 |
| 식물3.png | LARGE_PLANT/LARGE_PLANT.png | LARGE_PLANT |
| 식물4.png | POT/POT.png | POT |
| 식물5.png | CACTUS/CACTUS.png | CACTUS |
| 식물6.png | HANGING_PLANT/HANGING_PLANT.png | HANGING_PLANT |
| 의자 앞쪽.png | CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png | CUSHIONED_CHAIR_FRONT |
| 의자 뒤쪽.png | CUSHIONED_CHAIR/CUSHIONED_CHAIR_BACK.png | CUSHIONED_CHAIR_BACK |
| 정수기.png | BIN/BIN.png (대체 활용 검토) | BIN |
| 그림.png | SMALL_PAINTING/SMALL_PAINTING.png | SMALL_PAINTING |
| 그림2.png | LARGE_PAINTING/LARGE_PAINTING.png | LARGE_PAINTING |

### 1.2 경로 및 규격 무결성 검증 (Pre-flight Validation)
덮어쓰기 전에 반드시 스크립트나 수작업을 통해 다음을 검증합니다:
- `processed_assets/`의 이미지가 덮어씌울 목적지 경로(`public/assets/...`)에 실제로 존재하는지 구조 일치 여부 확인.
- `furniture-catalog.json`에 명시된 가로/세로 규격(`width`, `height`)과 덮어씌울 새 이미지의 픽셀 크기가 100% 일치하는지 확인. (불일치 시 엔진의 스프라이트 렌더링이 깨짐)

## 2. '튀어나온 벽' 레이아웃 도면 설계 (Layout Engineering)
- **에셋 유지**: 벽 타일은 추가 렌더링 에러를 방지하기 위해 기존 `wall_0.png` 에셋을 100% 재활용합니다.
- **도면 수정**: `default-layout-1.json`의 `"tiles"` 배열은 1차원 배열로 된 바둑판(Grid) 지도입니다. 
  - 숫자 `0`: 벽 (통과 불가)
  - 숫자 `255` 또는 `1~9`: 바닥 (통과 가능)
- **적용**: 완성본 레퍼런스 이미지를 참고하여, 방 한가운데 파티션이나 튀어나온 벽 구조가 필요한 좌표에 숫자 `0`을 찍어 물리 엔진(A* Pathfinding)과 시각적 렌더링이 일치하도록 도면을 수정합니다.

## 3. UI 조작 버그 및 크래시 예방 (Crash Prevention)
에셋 적용 후 클릭 인터랙션에서 프론트엔드가 뻗지 않도록 다음 사항들을 적용합니다.

- **미등록 에이전트 클릭 크래시 방지**: 백엔드의 WebSocket 통신 전 캐릭터를 클릭 시 앱이 죽는 이슈를 막기 위해, 초기 스폰되는 에이전트 ID(1~7)를 명시적으로 하드코딩 매핑해 둡니다.
- **벽걸이 가구(화이트보드) 힛박스 보정**: 벽(`0` 타일)에 배치되는 가구는 시각적인 위치와 실제 물리 타일 위치가 다릅니다. 현재 코드베이스에 `getFurnitureAt` 함수가 명시적으로 존재하지 않으므로, 클릭 이벤트 처리 로직을 구현할 때 보정값을 적용해야 합니다.
  - **초기 보정값 설정**: 시각적으로 위로 튀어나와 보이므로 Y축으로 **-16px (1타일 높이)** 또는 클릭된 Row에서 **-1 타일**을 오프셋으로 먼저 적용하여 실험적 탐색 시간을 최소화합니다.
- **캔버스 정렬**: 화면 최상단에서부터 오피스가 시작되도록 컨테이너 레이아웃을 `alignItems: 'flex-start'`, `paddingTop: 80px` 등으로 조정하여 오버레이 UI와의 간섭을 최소화합니다.

## 4. 실행 순서 요약
1. 현재 `public/assets/` 내 기존 파일들 백업 (안전성 확보)
2. [사전 검증] 규격 및 경로 구조 매칭 확인 (무결성 체크)
3. 매핑 테이블에 따라 `processed_assets/` 파일들을 `public/assets/...` 내부로 복사 및 덮어쓰기
4. `default-layout-1.json` 파일의 `tiles` 배열 구조 변경 (벽 추가)
5. `getFurnitureAt` 등 누락된 클릭 히트박스 판별 로직 추가 및 Y축 보정(-16px) 적용
6. 앱 실행 및 브라우저에서 충돌(Collision) 테스트 및 클릭 인터랙션 검증
