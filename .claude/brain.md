# brain.md — 결정된 사항 (현재 유효한 것만)

> **역할**: 이 프로젝트에서 *이미 결정되어 다시 논의하지 않는 것*의 최신 요약.
> 시간순 이력은 [docs/decision-log.md](../docs/decision-log.md), 상세 명세는 [docs/spec.md](../docs/spec.md).
> 진행 상황·할 일은 [state.md](state.md) 로 분리 — 여기에는 "무엇을 어떻게 하기로 했는가"만 적는다.
> 새 결정이 나오면 ① 여기 갱신 ② decision-log 에 날짜와 함께 추가 ③ 필요 시 spec.md 반영.

## 1. 프로젝트 정체성

- **독립 프로젝트**. `hcroi-simulator` 폴더/레포 단독. 개발자의 다른 프로젝트와 코드·DB·MCP·세션 모두 분리.
- 대상 사용자: 사내 인사담당자. 현재 단계: **프로토타입** (계산 엔진 + 대시보드 + 시뮬레이터, 브라우저 저장).
- 개발자: pulunick 단독.
- git 기본 브랜치는 **`main`**. 커밋·푸시는 사용자가 명시적으로 지시할 때만 (Claude 임의 커밋 금지).
- 원격: **개인 계정 `pulunick/hcroi-simulator` (public)**. 이 PC 의 gh 기본 활성 계정은 회사 계정이므로 **push 전 `gh auth switch --user pulunick`, push 후 회사 계정으로 복귀** (repo 로컬 credential.helper = gh). 회사 계정으로 이 저장소에 push 하지 않는다.
- **공개 저장소** — 커밋·문서에 개인 이메일, 회사명, 다른 프로젝트 식별자(Supabase ref 등), 실제 회사 재무 수치를 넣지 않는다. 샘플 데이터는 가상 수치만.
- 배포: Vercel (adapter-vercel). import 는 사용자가 대시보드에서 직접.

## 2. 스택

- SvelteKit + **Svelte 5 runes** + TypeScript + Tailwind CSS v4 + vitest. 어댑터 vercel.
- 설정은 `vite.config.ts` 한 곳 (svelte.config.js 없음).
- 차트는 **인라인 SVG** 직접 구현. 외부 차트 라이브러리 도입하지 않음.
- 명령: `npm run dev` / `check` / `lint` / `format` / `test`.

## 3. 도메인 규칙 (수식·표기)

- 수식은 **spec.md §2 원문 그대로**. `src/lib/hcroi/formulas.ts` 가 단일 계산 소스 — UI 에서 지표 재계산 금지.
  - HCROI = (영업이익 + 총 인건비) ÷ 총 인건비
  - HCVA = (영업이익 + 총 인건비) ÷ 총 임직원 수
  - 총 인건비 = 기본급 + 성과급/수당 + 퇴직급여 + 법정후생비 + 기타 복리후생비 + 교육훈련비
- HCROI 표기: **배수 1차**(1.35배), % 는 괄호 보조(135%). 요구사항의 "HCROI(%)" 는 배수×100 으로 해석.
- 등급은 **3단계** (`HCROI_THRESHOLDS`): <1.0 위험 · 1.0–1.5 보통 · ≥1.5 우수.
  1.3–1.5 "양호" 구간은 확장 지침(Martin 2.0, 2026-09-03)에 따라 폐지하고 보통에 통합.
- 단위 통일: 금액 = **원 단위 정수**, 비율 = **% 숫자**(3 → 3%). 화면 표기는 `format.ts` 만 사용, 단위(원·%·명·배) 항상 명시.
- **지표는 저장하지 않는다.** 입력값만 저장, 항상 재계산.
- 요구사항 출처는 spec.md 와 **확장 지침 "Martin's HCROI Simulator 2.0"**(docs/ PDF, 요약 `docs/plans/martin-2.0-extensions.md`). 둘이 충돌하면 확장 지침을 따르고 decision-log 에 기록한다.

## 4. 시뮬레이터 모델링 가정 (`scenario.ts`, spec §4)

- 입력: 인원 변동율(%) 또는 변동 인원수(명), 임금 인상률(%), 인당 생산성 변화율(%), [고급] 비인건비 중 변동비 비율(%, 기본 0).
- 비인건비는 **기본 고정비**. 변동비 비율은 고급 옵션.
- 인원 변동 후 인당 인건비·인당 매출은 **기준연도 값 유지** (램프업 미반영).
- 모델 제외: 신규 인원 램프업, 채용/퇴직 일회성 비용, 세금·금융비용.
- 부가 산출은 닫힌 식 역산: 손익분기 생산성, 최대 임금 인상률 — 테스트로 검증.
- 가정 변경 시 `scenario.ts` 주석 + spec §4 + 테스트 **세 곳 동시 갱신**.

## 5. 인사이트

- **규칙 기반**으로 시작 (`insights.ts`, spec §5). 항상 구체 숫자+단위.
- 개선 시나리오라도 매출 증가 + 변동비 비율 0% 면 "고정비 가정에 의한 과대 추정" 경고를 반드시 낸다 (모델은 그대로, 해석만 보정).
- HCROI 증감은 "+0.34배" (p 표기 금지 — %p 와 혼동).
- LLM(Claude API) 서술은 Phase 2. 그때도 규칙 엔진 산출치를 프롬프트 근거로 전달하는 구조.

## 6. 차트/UI

- **이중축 금지** → 지표별 small-multiple 패널.
- 범주형 색 고정 순서: Baseline = series-1, A = series-2, B = series-3.
- 범례 + 직접 라벨 + 표 병행.

## 7. 저장소 / DB

- 대시보드 제목의 회사/조직 이름(`orgName`)도 localStorage 작업공간에 저장 — 서버 전송 없음. 회사명을 코드·저장소에 하드코딩하지 않는다.
- 프로토타입: **localStorage** (`hcroi:workspace:v1`). 상태 모듈은 `src/lib/state/workspace.svelte.ts` 한 곳 → DB 연동 시 이것만 교체.
- DB 는 **아직 없음**. `supabase/migrations/20260901000000_hcroi_schema.sql` 준비만 됨.
- DB 대상: **개발자 개인 Supabase 계정**. 어느 프로젝트(기존 vs 신규)에 올릴지는 연동 착수 시 확정.
- 전용 스키마 `hcroi` 분리 원칙 유지 (완성 후 회사 클라우드로 이관 대비, `pg_dump -n hcroi`).
- 연동 절차: `supabase init` → `supabase link --project-ref <ref>` → `supabase db push` → Data API exposed schemas 에 `hcroi` 추가.
- **`db push` 는 사람이 직접 실행.** Claude 임의 실행 금지.
- ⚠️ 같은 계정에 있는 다른 프로젝트용 Supabase MCP/프로젝트는 **절대 건드리지 않음**. 사용자가 지정한 ref 외 연결·조회 금지.

## 8. 테스트/품질 규칙

- `src/lib/hcroi/*.test.ts` — 계산 로직 변경 시 **테스트 없이 커밋 금지**.
- UI 컴포넌트 테스트는 강제하지 않음.

## 9. 범위 밖 (Phase 2 후보 — 지금 구현하지 않음)

Supabase 연동(로그인·조직), LLM 인사이트 서술, PDF 리포트, 부서별 분해, 다년 예측.

**예외 — 엑셀 내보내기/가져오기는 Phase 2 후보에서 승격되어 2026-09-01 구현 완료** (2026-09-01, 사용자 결정: 인사담당자에게 JSON 은 어렵고 공유는 엑셀이 표준).
계획은 [docs/plans/excel-export-import.md](../docs/plans/excel-export-import.md). 확정: exceljs · 금액 원 정수만(콤마 허용) · 시나리오는 내보내기만 · 조직명 보류(회사별 사용 가능성 있음). JSON 은 유지하되 고급 기능으로 격하.

## 10. 작업 운영 방식

- 결정사항 = `.claude/brain.md`(이 파일), 진행상황 = `.claude/state.md`. 세션 시작 시 두 파일 먼저 읽는다.
- 이 폴더에서 별도 Claude Code 세션으로 진행 (다른 프로젝트 세션과 분리).
