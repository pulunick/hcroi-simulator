# HCROI & 인건비 시뮬레이터 (hcroi-simulator)

기업 인적자본 투자효율(HCROI) 분석 + 인건비/정원 시나리오 시뮬레이션 사내 도구. 인사담당자용. 현재 **프로토타입** 단계.
개발자의 다른 프로젝트와 무관한 독립 프로젝트 — 그쪽 코드·DB·MCP 를 건드리지 말 것. **공개 저장소**: 개인 이메일·회사명·타 프로젝트 식별자·실제 재무 수치를 커밋하지 말 것.

## 스택 / 명령어

- SvelteKit (Svelte 5 runes) + TypeScript + Tailwind CSS v4 + vitest. 차트는 인라인 SVG (외부 차트 라이브러리 없음)
- `npm run dev` / `npm run check` / `npm run lint` / `npm run format` / `npm test`
- 설정은 `vite.config.ts` 한 곳 (svelte.config.js 없음). 어댑터 vercel

## 절대 규칙

- **수식은 docs/spec.md §2 정의를 그대로 따른다.** `src/lib/hcroi/formulas.ts` 가 단일 계산 소스. UI 에서 지표를 따로 계산하지 말 것
- HCROI 표기는 배수(1.35배) 우선, % 는 보조. 등급은 3단계 — 경계 1.0 / 1.5 (`HCROI_THRESHOLDS`)
- 금액은 원 단위 정수, 비율은 % 숫자(3 → 3%)로 통일. 화면 표기는 `src/lib/hcroi/format.ts` 사용, 단위(원·%·명·배) 항상 명시
- 시나리오 가정 변경 시 `scenario.ts` 주석 + docs/spec.md §4 + 테스트를 함께 갱신
- 지표는 저장하지 않는다(입력값만 저장, 항상 재계산)
- 차트: 이중축 금지, 범주형 색 고정 순서(Baseline=series-1, A=series-2, B=series-3), 범례+직접 라벨+표 병행
- **DB 는 아직 없음.** `supabase/migrations` 는 준비만 된 상태. 대상은 **개발자 개인 Supabase 계정**(프로젝트 ref 는 연동 착수 시 확정). 연동 절차: `supabase init`(config.toml 생성, 기존 migrations 폴더 유지) → `supabase link --project-ref <ref>` → `supabase db push` → Data API exposed schemas 에 `hcroi` 추가. **push 는 사람이 직접 실행**, Claude 가 임의 실행 금지
- ⚠️ 이 개발자의 다른 프로젝트용 Supabase MCP/프로젝트가 같은 계정에 있을 수 있음 — 사용자가 지정한 ref 외에는 연결·조회하지 말 것
- 상태는 `src/lib/state/workspace.svelte.ts` 한 곳 (localStorage). DB 연동 시 이 모듈만 교체
- 원격은 개인 계정 `pulunick/hcroi-simulator`(public). push 는 `gh auth switch --user pulunick` 후에만, 끝나면 회사 계정으로 복귀 (.claude/brain.md §1)

## 테스트

- `src/lib/hcroi/*.test.ts` — 수식·시나리오·손익분기 역산·인사이트. **계산 로직 변경 시 테스트 없이 커밋 금지**
- `src/lib/hcroi/excel/excel.test.ts` — 엑셀 행 변환·검증·병합·exceljs 왕복. 시트 구조(`schema.ts`) 변경 시 user-guide §4 도 갱신
- UI 컴포넌트는 테스트 강제하지 않음

## 문서

- docs/spec.md — 요구사항·수식·가정·화면 (원본)
- docs/decision-log.md — 결정 이력 (변경 시 추가)
- docs/user-guide.md — 인사담당자용 사용 설명서 (화면·기능 변경 시 함께 갱신)
- docs/requirements-coverage.md — 요구사항(spec) ↔ 구현 대조표
- docs/plans/ — 착수 전 기능 계획서 (구현 시 spec/user-guide 로 흡수)
- supabase/README.md — hcroi 스키마 적용 절차

## Phase 2 후보 (지금 구현하지 말 것)

Supabase 연동(로그인·조직), LLM 인사이트 서술, PDF 리포트, 부서별 분해, 다년 예측

엑셀 내보내기/가져오기는 **구현 완료**(2026-09-01, `src/lib/hcroi/excel/`). exceljs 는 `excel/io.ts` 에서만 동적 import — 다른 곳에서 정적 import 금지(번들 크기)

## 세션 운영 (brain / state)

- `.claude/brain.md` — **결정된 사항**의 최신 요약 (규칙·가정·범위). 세션 시작 시 먼저 읽는다
- `.claude/state.md` — **진행 상황**·다음 할 일·세션 로그. 작업 끝날 때마다 갱신한다
- 새 결정 → brain.md 갱신 + docs/decision-log.md 에 날짜와 함께 추가. 진행 변화 → state.md 만
