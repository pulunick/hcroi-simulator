# HCROI & 인건비 시뮬레이터 (hcroi-simulator)

기업 인적자본 투자효율(HCROI) 분석 + 인건비/정원 시나리오 시뮬레이션 도구. 인사담당자용. main = 사내 배포, `product/commercial` = 공개판(Headroom). 계정·DB 없이 브라우저 저장.
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
- 데이터 단위는 **기간 레코드**(`PeriodRecord.period = {year, type: Y|H|Q|M, index}`). 라벨·정렬·기간 텍스트 파싱·전기/전년 동기·상하위 관계는 `src/lib/hcroi/period.ts` 만 쓴다. 값은 기간 실적 그대로(연율화 금지), 추이는 한 유형만
- **상위 기간은 저장하지 않는다.** 직접 입력한 레코드(`workspace.records`)에서 `src/lib/hcroi/rollup.ts` 가 읽을 때 합산한다. 화면은 `workspace.effective`, 저장·엑셀 입력 시트·JSON 은 `records`. 합산 규칙(직접 입력 우선·차감·인원 산정 방식) 변경 시 rollup 테스트 + docs/spec.md §2 함께
- 레코드 검증은 `validateRecord`(formulas.ts) 한 곳 — 화면과 엑셀 가져오기가 같은 규칙. 인원 총원 = 산정 기준 적용 합계 는 레이아웃 `$effect(applyHeadcountBasis)` 가 유지하므로 화면에서 따로 맞추지 말 것
- 동종업계 비교(평균·중앙값·순위)는 `src/lib/hcroi/peers.ts` 만 — 화면에서 재계산 금지
- 표기 규칙(표 칸/열 머리글/입력 힌트 단위)은 `format.ts` 의 `formatCellAmount·columnUnitSuffix·hintAmountUnit` 만 — 화면에 복제 금지
- 차트: 이중축 금지, 범주형 색 고정 순서(Baseline=series-1, A=series-2, B=series-3), 범례+직접 라벨+표 병행
- **DB 는 아직 없음.** `supabase/migrations` 는 준비만 된 상태. 대상은 **개발자 개인 Supabase 계정**(프로젝트 ref 는 연동 착수 시 확정). 연동 절차: `supabase init`(config.toml 생성, 기존 migrations 폴더 유지) → `supabase link --project-ref <ref>` → `supabase db push` → Data API exposed schemas 에 `hcroi` 추가. **push 는 사람이 직접 실행**, Claude 가 임의 실행 금지
- ⚠️ 이 개발자의 다른 프로젝트용 Supabase MCP/프로젝트가 같은 계정에 있을 수 있음 — 사용자가 지정한 ref 외에는 연결·조회하지 말 것
- 상태는 `src/lib/state/workspace.svelte.ts` 한 곳 (localStorage). DB 연동 시 이 모듈만 교체
- 원격은 개인 계정 `pulunick/hcroi-simulator`(public). push 는 `gh auth switch --user pulunick` 후에만, 끝나면 회사 계정으로 복귀 (.claude/brain.md §1)

## 참고 자료 (PDF)

- 결산·공시 PDF 는 `docs/` 에 두되 **커밋하지 않는다**(`.gitignore` `docs/*.pdf`). Claude 는 PDF 를 대화에 올리지 말고 `pdftotext -layout` 로 스크래치패드에 추출한 뒤 `grep`/`sed` 로 필요한 구간만 읽는다(컨텍스트 초과 방지)
- DART PDF 표는 `pdftotext -layout` 에서만 정렬이 깨진다 — 파싱은 좌표 기반(`-table` / pdf.js)만. **결산서 PDF → 엑셀 입력 시트 변환이 최우선 과제**(계획 docs/plans/pdf-to-excel.md, 사람 확인 필수·자동 반영 금지). 동종업계 비교는 엑셀 수기 입력(C안)

## 테스트

- `src/lib/hcroi/*.test.ts` — 수식·시나리오·손익분기 역산·인사이트·기간·합산·동종업계. **계산 로직 변경 시 테스트 없이 커밋 금지**
- `src/lib/hcroi/excel/excel.test.ts` — 엑셀 행 변환·검증·병합·exceljs 왕복. 시트 구조(`schema.ts`) 변경 시 user-guide §4 도 갱신
- `src/lib/hcroi/pdf/*.test.ts` — 표 복원·표 찾기·매핑·레코드. 픽스처(`pdf/fixtures/*.json`)는 실 PDF 좌표에 **가상 수치**(4자리 이상 숫자 치환, 회사명 치환) — 실 수치·실 PDF 커밋 금지
- UI 컴포넌트는 테스트 강제하지 않음
- `tests/qa/` — Playwright 브라우저 QA(`npm run qa`, dev 서버 필요, 로컬 Chrome). 커밋 전 필수는 아님

## 문서

- docs/spec.md — 요구사항·수식·가정·화면 (원본)
- docs/decision-log.md — 결정 이력 (변경 시 추가)
- docs/user-guide.md — 인사담당자용 사용 설명서 (화면·기능 변경 시 함께 갱신). **앱 `/guide/manual` 이 이 파일을 그대로 렌더한다**(`src/lib/guide/`, marked) — 헤딩 앵커는 GitHub 슬러그, md 상대 링크는 GitHub blob 으로 변환되므로 링크는 `spec.md`·`samples/…` 처럼 docs 기준 상대 경로로 쓴다. svelte 로 복제 금지
- 겉면 규칙: SSR 은 `/intro` 만(`intro/+page.ts`), 앱 화면은 `ssr=false`. 공유 메타·백업 권장 링크는 `+layout.svelte` 한 곳, 문구는 `site-config.ts`. 폰트는 `pretendard` npm 자체 호스팅(CDN 금지). 첫 방문 `/`→`/intro` 는 공개판만(`workspace.hadStoredData`, `?start=` 있으면 건너뜀)
- Vercel 프로덕션(hcroi-simulator.vercel.app)은 2026-09-16 현재 **main 빌드** — 공개판 배포는 Vercel Production Branch 를 `product/commercial` 로 바꿔야 함(사용자 몫)
- docs/requirements-coverage.md — 요구사항(spec) ↔ 구현 대조표
- docs/plans/ — 착수 전 기능 계획서 (구현 시 spec/user-guide 로 흡수)
- supabase/README.md — hcroi 스키마 적용 절차

## Phase 2 후보 (지금 구현하지 말 것)

Supabase 연동(로그인·조직), LLM 인사이트 서술, 부서별 분해, 다년 예측. (경영진 리포트 A4 인쇄는 `/report` 로 구현 완료 2026-09-15 — `src/lib/report/`, 코어 함수만 사용)

엑셀 내보내기/가져오기는 **구현 완료**(2026-09-01, `src/lib/hcroi/excel/`). exceljs 는 `excel/io.ts` 에서만 동적 import — 다른 곳에서 정적 import 금지(번들 크기)

결산서 PDF 가져오기는 **구현 완료**(2026-09-09, `src/lib/hcroi/pdf/`, 계획 docs/plans/pdf-to-excel.md). pdfjs-dist 는 `pdf/extract.ts` 에서만 동적 import. 나머지(table·locate·map·toRecord)는 순수 함수 — 규칙을 바꾸면 픽스처 테스트 + 실 PDF 프로브(`HCROI_PDF=… npx vitest run src/lib/hcroi/pdf/probe`) 둘 다 돌릴 것. **자동 반영 금지** — 항상 카드 확인 → 기존 미리보기 경로

## 세션 운영 (brain / state)

- `.claude/brain.md` — **결정된 사항**의 최신 요약 (규칙·가정·범위). 세션 시작 시 먼저 읽는다
- `.claude/state.md` — **진행 상황**·다음 할 일·세션 로그. 작업 끝날 때마다 갱신한다
- 새 결정 → brain.md 갱신 + docs/decision-log.md 에 날짜와 함께 추가. 진행 변화 → state.md 만
- **패치노트는 `/patch-notes` 스킬**(`.claude/skills/patch-notes/`): 담당자·공개판 사용자 시점 업데이트 안내를 템플릿 HTML 로 채워 Artifact 발행
- **세션 마무리는 `/wrap-up` 스킬**(`.claude/skills/wrap-up/SKILL.md`) 절차대로: 문서 최신화 → test/check/lint → 식별자 스캔 → dev 서버 종료 → 지시 시 커밋·push

## 브랜치 (2026-09-10~)

- **main** = 사내 도구(인사담당자 수정·개선). **`product/commercial`** = **인터넷 공개판**(인사담당자가 바로 써보는 무료 웹 — 2026-09-14 방향 전환, 판매·라이선스는 보류. 이름은 이력 때문에 유지). 규칙은 brain §12, 기획 docs/plans/commercial-product.md §7.5. 전략은 docs/plans/branch-strategy.md
- 머지는 **main → product** 가 기본. 코어 `src/lib/hcroi/**` 는 main 에서만 고친다. 상용 브랜치 작업 시작 시 `git merge main` 후 test/check. **2026-09-15 역머지 이후 두 브랜치 차이는 `/intro`(+소개 링크)와 헤더 워드마크뿐** — main 은 워드마크 없이 회사 이름이 그 자리. 차이는 파일 삭제가 아니라 `src/lib/site-config.ts` 의 `SITE_ENABLED` 한 줄(main false / product true). UI 개선은 main 에서 하고 product 로 머지
- 브랜드 자산은 `docs/design/commercial/`(워드마크 `headroom-wordmark*.svg`, Claude Design 아트보드 `*.dc.html` + `canvas.json`). 규칙은 brain §12. **코드 작성은 opus/sonnet 서브에이전트(Agent 툴)에 위임하고 총괄 모델(Fable)은 설계·브리핑·검수·문서만** — 두 번 실패한 것만 직접(2026-09-14 고정). **프론트 리뷰(에러 잡기·QA)는 Codex 플러그인(`codex:rescue`)에 위임**한다
