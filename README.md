# HCROI & 인건비 시뮬레이터

기업의 인적자본 투자효율(HCROI)을 산출하고, 인원·임금·생산성 시나리오에 따른 인건비·영업이익·HCROI 변화를
시뮬레이션하는 인사담당자용 도구. 공개판 이름은 **Headroom** — https://hcroi-simulator.vercel.app

DART 결산서 PDF 한 부를 올리면 매출액·영업이익·인건비·임직원 수를 추출해 HCROI를 계산하고, 정원·임금
시나리오와 A4 한 장 리포트까지 이어진다. **계정도 서버도 없다** — 데이터는 브라우저(localStorage)와
직접 내보낸 파일(엑셀·JSON)에만 남는다.

## 실행

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # 수식·시나리오·인사이트 단위 테스트
npm run check      # svelte-check
npm run lint
npm run qa         # Playwright 브라우저 QA — dev 서버 + 로컬 Chrome 필요 (tests/qa/README.md)
```

공개판 배포에 필요한 환경변수는 `.env.example` 참조(값은 호스팅 대시보드에만 넣는다).

첫 실행 시 가상의 3개년 샘플 데이터가 들어 있다. `데이터 관리` 에서 자사 실적으로 교체하거나
결산서 PDF·엑셀·JSON 으로 가져올 수 있다.

## 화면

| 경로         | 기능                                                                                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`          | HCROI 대시보드 — 기준 데이터 입력(실시간 재계산), HCROI·등급 진단, HCVA/인당 매출/인당 인건비, 기간별(연간·반기·분기) HCROI 추이(라인), 인건비 vs 영업이익 비중(누적 막대), 추이 인사이트                                   |
| `/simulator` | 인건비 & 정원 시뮬레이터 — 시나리오 A/B (인원 변동율 또는 증감 인원, 임금 인상률, 인당 생산성 변화율, [고급] 변동비 비율) → 예상 총 인건비·영업이익·HCROI, Baseline vs A/B 비교 차트·표, 원인 분석·개선책 인사이트          |
| `/data`      | 기간별(연간·반기·분기) 데이터 관리 — 행 클릭 선택·편집·삭제, 총 인건비 6항목 세부 입력, **엑셀 내보내기/템플릿/가져오기**(미리보기·되돌리기), **결산서 PDF 가져오기**(텍스트 PDF → 값 후보 카드 → 확인 후 반영), JSON(고급) |
| `/report`    | 경영진 리포트 — A4 한 장으로 인쇄/PDF 저장(브라우저 인쇄 기능, 별도 PDF 라이브러리 없음). 회사 이름·주요 지표를 한 장에 요약                                                                                                |
| `/settings`  | 설정 — 금액 표시 단위(원/억/만 자동·고정), 임직원 수 산정 기준, 화면 테마(밝게/어둡게), 백업 파일(.json) 저장·데이터 초기화                                                                                                 |
| `/guide`     | 산식·등급 기준·시뮬레이션 가정·기본값                                                                                                                                                                                       |
| `/intro`     | 소개 — 공개판(Headroom)에만 있음. 첫 방문자에게 무엇을 하는 도구인지 보여준다                                                                                                                                               |

## 핵심 수식

- 인적자본 투입 전 이익 = 영업이익 + 총 인건비 = 매출액 − (영업비용 − 총 인건비)
- **HCROI** = (영업이익 + 총 인건비) ÷ 총 인건비
- **HCVA** = (영업이익 + 총 인건비) ÷ 총 임직원 수
- 총 인건비 = 기본급 + 성과급/수당 + 퇴직급여 + 법정후생비 + 기타 복리후생비 + 교육훈련비
- 등급: < 1.0 위험 · 1.0~1.5 보통 · ≥ 1.5 우수 (3등급, 2026-09-03 확장 지침 반영)

사용 설명서: [docs/user-guide.md](docs/user-guide.md) · 전체 명세·가정: [docs/spec.md](docs/spec.md) · 결정 이력: [docs/decision-log.md](docs/decision-log.md) · 요구사항 대조: [docs/requirements-coverage.md](docs/requirements-coverage.md)

## 데이터 입력 3가지

1. **결산서 PDF** — DART 등에서 받은 텍스트 PDF에서 표를 복원해 값 후보를 뽑고, 사람이 확인한 뒤에만 반영한다(`src/lib/hcroi/pdf/`).
2. **엑셀 양식** — 템플릿을 내려받아 채운 뒤 가져온다. 왕복(내보내기 → 가져오기) 검증 포함(`src/lib/hcroi/excel/`).
3. **직접 입력** — `/data` 화면에서 기간별로 행을 직접 추가·수정한다.

## 브랜치

- **main** — 첫 사용자(인사담당자) 배포용.
- **product/commercial** — 공개판(Headroom).

두 브랜치의 차이는 `src/lib/site-config.ts` 의 `SITE_ENABLED` 한 줄(소개 페이지·헤더 워드마크·제품명)뿐이다.
자세한 전략은 [docs/plans/branch-strategy.md](docs/plans/branch-strategy.md) 참고.

## 구조

```
src/lib/hcroi/          계산 엔진 (프레임워크 무관, 테스트 포함)
  types.ts              도메인 타입
  formulas.ts           핵심 수식·등급 진단·검증
  scenario.ts           시나리오 적용, 손익분기 생산성/최대 임금 인상률 역산
  insights.ts           규칙 기반 인사이트 (원인 분석·개선책)
  defaults.ts           표준 레퍼런스 기본값·샘플 데이터
  format.ts             원/억/만·%·배 표기
  period.ts             기간 레코드 라벨·정렬·전기/전년 동기
  rollup.ts             상위 기간(연·반기 등) 합산
  excel/                엑셀 스키마·행 변환(순수)·exceljs 입출력(동적 로드) + 테스트
  pdf/                  결산서 PDF → 입력 레코드: 표 복원·표 찾기·계정 매핑·레코드 변환(순수) + pdf.js 추출(동적 로드) + 픽스처 테스트
src/lib/report/         경영진 리포트(A4) — 코어 함수만 사용, 별도 계산 없음
src/lib/state/          workspace.svelte.ts — 작업공간 상태 + localStorage
src/lib/site-config.ts  main/product 공개판 차이 한 줄(SITE_ENABLED)
src/lib/components/     charts/ (인라인 SVG) · ui/ · site/
src/routes/             / · /simulator · /data · /report · /settings · /guide · /intro
tests/qa/               Playwright 브라우저 QA (npm run qa, 커밋 전 필수는 아님)
supabase/               hcroi 전용 스키마 마이그레이션 (아직 미적용, supabase/README.md 참조)
docs/                   spec · user-guide · decision-log · requirements-coverage · plans
```

## 다음 단계 (Phase 2 후보)

1. Supabase `hcroi` 스키마 연동 + 로그인/조직 권한 (supabase/README.md)
2. LLM(Claude API) 기반 인사이트 서술 — 현재 규칙 엔진 산출치를 근거로 전달
3. 부서/직군별 분해, 다년 예측
