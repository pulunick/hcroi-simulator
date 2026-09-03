# HCROI & 인건비 시뮬레이터

기업의 인적자본 투자효율(HCROI)을 산출하고, 인원·임금·생산성 시나리오에 따른 인건비·영업이익·HCROI 변화를
실시간으로 시뮬레이션하는 사내 HR 분석 도구. **현재 프로토타입 단계** (브라우저 localStorage 저장, 로그인 없음).

## 실행

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # 수식·시나리오·인사이트 단위 테스트
npm run check      # svelte-check
npm run lint
```

첫 실행 시 가상의 3개년 샘플 데이터가 들어 있다. `데이터 관리` 에서 자사 실적으로 교체하거나 JSON 으로 가져올 수 있다.

## 화면

| 경로         | 기능                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`          | HCROI 대시보드 — 기준 데이터 입력(실시간 재계산), HCROI·등급 진단, HCVA/인당 매출/인당 인건비, 연도별 HCROI 추이(라인), 인건비 vs 영업이익 비중(누적 막대), 추이 인사이트                                          |
| `/simulator` | 인건비 & 정원 시뮬레이터 — 시나리오 A/B (인원 변동율 또는 증감 인원, 임금 인상률, 인당 생산성 변화율, [고급] 변동비 비율) → 예상 총 인건비·영업이익·HCROI, Baseline vs A/B 비교 차트·표, 원인 분석·개선책 인사이트 |
| `/data`      | 연도별 데이터 관리 — 행 클릭 선택·편집·삭제, 총 인건비 6항목 세부 입력, **엑셀 내보내기/템플릿/가져오기**(미리보기·되돌리기), JSON(고급)                                                                           |
| `/guide`     | 산식·등급 기준·시뮬레이션 가정·기본값                                                                                                                                                                              |

## 핵심 수식

- 인적자본 투입 전 이익 = 영업이익 + 총 인건비 = 매출액 − (영업비용 − 총 인건비)
- **HCROI** = (영업이익 + 총 인건비) ÷ 총 인건비
- **HCVA** = (영업이익 + 총 인건비) ÷ 총 임직원 수
- 총 인건비 = 기본급 + 성과급/수당 + 퇴직급여 + 법정후생비 + 기타 복리후생비 + 교육훈련비
- 등급: < 1.0 위험 · 1.0~1.5 보통 · ≥ 1.5 우수 (3등급, 2026-09-03 확장 지침 반영)

사용 설명서: [docs/user-guide.md](docs/user-guide.md) · 전체 명세·가정: [docs/spec.md](docs/spec.md) · 결정 이력: [docs/decision-log.md](docs/decision-log.md) · 요구사항 대조: [docs/requirements-coverage.md](docs/requirements-coverage.md)

## 구조

```
src/lib/hcroi/          계산 엔진 (프레임워크 무관, 테스트 포함)
  types.ts              도메인 타입
  formulas.ts           핵심 수식·등급 진단·검증
  scenario.ts           시나리오 적용, 손익분기 생산성/최대 임금 인상률 역산
  insights.ts           규칙 기반 인사이트 (원인 분석·개선책)
  defaults.ts           표준 레퍼런스 기본값·샘플 데이터
  format.ts             원/억/만·%·배 표기
  excel/                엑셀 스키마·행 변환(순수)·exceljs 입출력(동적 로드) + 테스트
src/lib/state/          workspace.svelte.ts — 작업공간 상태 + localStorage
src/lib/components/     charts/ (인라인 SVG) · ui/
src/routes/             / · /simulator · /data · /guide
supabase/               hcroi 전용 스키마 마이그레이션 (아직 미적용, README 참조)
docs/                   spec · decision-log
```

## 다음 단계 (Phase 2 후보)

1. Supabase `hcroi` 스키마 연동 + 로그인/조직 권한 (supabase/README.md)
2. LLM(Claude API) 기반 인사이트 서술 — 현재 규칙 엔진 산출치를 근거로 전달
3. PDF 리포트, 부서/직군별 분해, 다년 예측
