# Fonts Folder

이 폴더에는 슬라이드 렌더링용 로컬 폰트 파일을 넣습니다.

권장 구조:

- `pretendard/`
  - `Pretendard-Regular.ttf`
  - `Pretendard-Medium.ttf`
  - `Pretendard-Bold.ttf`
- `noto-serif-kr/`
  - `NotoSerifKR-Bold.ttf`

폰트 파일을 넣은 뒤 슬라이드 템플릿에서 `@font-face`로 연결하면,
Playwright PNG export 시 외부 폰트 네트워크 의존 없이 안정적으로 렌더링할 수 있습니다.
