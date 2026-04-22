# Pixel Office V2 Workflow (Reference Alignment + Validation)

## 목적
`content-automation/processed_assets/완성본1.png` 기준으로 레이아웃 정렬 품질을 반복 가능하게 유지한다.

## 앵커 규칙
- 앵커 1: 좌측 상단 방 외곽 코너 (그리드 시작점 기준)
- 앵커 2: 중앙 파티션 시작점 (col=10 상단)
- 앵커 3: 우측 상단 방 외곽 코너
- 앵커 4: 하단 통로 시작선

모든 재배치 작업은 위 앵커 기준으로 상대 좌표를 조정한다.

## 작업 순서
1. `방 구조.png`와 현재 뷰를 비교해 `tiles` 벽 마스크를 우선 확정한다.
2. 벽걸이 오브젝트(`canPlaceOnWalls=true`)를 먼저 배치한다.
3. 대형 가구(footprint 3x3 이상)를 배치한다.
4. 장식/식물류를 마지막에 채운다.
5. 아래 검증 스크립트를 실행한다.

## 자동 검증
```bash
./tools/pixel-office/validate_layout.py
```

엄격 벽 규칙까지 확인하려면:
```bash
./tools/pixel-office/validate_layout.py --strict-wall
```

## 배포 전 동기화
```bash
./tools/pixel-office/sync_layout_assets.sh
```

동기화 후 5173(dev)와 static 번들 화면 차이를 최종 확인한다.
