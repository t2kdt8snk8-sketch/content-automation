# Hermes 적용 가이드 — 웹 대시보드를 trading-system 프로젝트에 붙이기

이 폴더(`content-automation/trading-system/`)의 **`api/`, `web/`, `pyproject.toml`** 은
원래 `trading-system` 레포(백엔드)에 얹을 프론트엔드입니다.
(여기 `content-automation`에 올린 건 전달용일 뿐. 실제 적용 대상은 `trading-system` 레포.)

## Hermes에게 시킬 일

> 아래를 그대로 시키면 됩니다.

1. **이 레포를 클론**해서 새 파일을 가져온다:
   ```bash
   git clone https://github.com/t2kdt8snk8-sketch/content-automation.git _delivery
   cd _delivery && git checkout claude/plan-file-review-strategy-enr4nl && cd ..
   ```

2. **trading-system 프로젝트 루트로 복사**한다 (`api/`, `web/` 통째로):
   ```bash
   cp -r _delivery/trading-system/api   ./api
   cp -r _delivery/trading-system/web   ./web
   ```

3. **`pyproject.toml`** 에 두 줄만 추가한다 (없으면 `_delivery/trading-system/pyproject.toml`로 덮어쓰기):
   - `[project.optional-dependencies]` 아래:
     `api = ["fastapi>=0.110", "uvicorn[standard]>=0.27"]`
   - `[tool.setuptools.packages.find]` 의 `include` 를:
     `include = ["data*", "api*"]`

4. **설치 & 실행** (`web/README.md`에 동일 내용 있음):
   ```bash
   pip install -e ".[api]"
   cd web && npm install && cd ..
   # 터미널 2개:
   uvicorn api.main:app --reload --port 8011
   cd web && npm run dev          # http://localhost:3000
   ```

5. 정리: `_delivery/` 폴더는 지운다. 그리고 trading-system 레포에 커밋.

## 주의
- 첫 실행 시 화면 위 데이터 모드가 **"실데이터"** 인지 확인. 데이터 다운로드로 몇 분 걸림(이후 `data/cache/`에 캐시).
- 화면만 빨리 보려면 **"데모"** — 단 ⚠️ 합성 데이터라 숫자는 무의미.
- 실데이터를 못 받으면 화면에 **에러를 그대로 표시**합니다(가짜 성공 없음).
