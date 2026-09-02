# state.md — 진행 상황

> **역할**: 지금 어디까지 왔고, 다음에 뭘 할지. 세션마다 갱신한다.
> 결정된 사항(바뀌지 않는 규칙)은 [brain.md](brain.md) 에만 적는다 — 여기에 중복하지 않는다.
> 형식: 상단 "현재 상태" 스냅샷 → "다음 할 일" → 하단에 세션 로그 누적.

## 현재 상태 (2026-09-01 세션 2 종료 시점)

| 항목            | 상태                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 단계            | 프로토타입 **기능 완료**, 공개 저장소 push 완료. **Vercel 배포 대기**(사용자가 import) → 인사담당자 시연 2단계                          |
| `npm test`      | ✅ 4 파일 / 51 테스트 (formulas · scenario · insights · excel)                                                                          |
| `npm run check` | ✅ 0 errors / 0 warnings (353 files)                                                                                                    |
| `npm run lint`  | ✅                                                                                                                                      |
| git             | 원격 **github.com/pulunick/hcroi-simulator (public)**, 브랜치 `main`. 공개 전 식별자 제거 후 히스토리 단일 커밋으로 재생성 (2026-09-01) |
| DB              | 없음. 마이그레이션 SQL 준비만 됨, 어느 프로젝트에도 미적용                                                                              |
| 원격 저장소     | pulunick/hcroi-simulator (public). push 절차는 brain §1 참조                                                                            |

### 구현 완료

- [x] 계산 엔진 `src/lib/hcroi/` — types · formulas · scenario · insights · defaults · format (+ 테스트 3개 파일)
- [x] 상태 `src/lib/state/workspace.svelte.ts` (localStorage, 스키마 버전 키 `hcroi:workspace:v1`)
- [x] 차트 컴포넌트 (인라인 SVG): BarPanel · LineChart · StackedBarChart · Legend
- [x] UI 컴포넌트: GradeBadge · InsightList · NumberField · SliderField · StatTile
- [x] 화면 4개: `/` 대시보드 · `/simulator` · `/data` · `/guide`
- [x] 문서: CLAUDE.md · README.md · docs/spec.md · docs/decision-log.md · supabase/README.md
- [x] Supabase `hcroi` 스키마 SQL 초안 (organizations / members / fiscal_years / scenarios + RLS)
- [x] `.claude/brain.md` + `.claude/state.md` 운영 체계 도입
- [x] 엑셀 내보내기(4시트)·템플릿·가져오기(미리보기/검증/병합/되돌리기) — `src/lib/hcroi/excel/`, exceljs 4.4 동적 로드, 테스트 14건 + 브라우저 E2E 16건

### 육안 점검 결과 (2026-09-01, 세션 2)

검증 방법: `npm run dev` + 로컬 Chrome(Playwright `channel: 'chrome'`, 스크래치패드 설치) 로 1440px / 390px 스크린샷 + 상호작용 스크립트.

- [x] 4개 화면 데스크톱 렌더링 정상, 콘솔 에러 없음 (favicon.ico 404 제외)
- [x] 390px 모바일: 4개 화면 단일 컬럼으로 정상 접힘. 표는 `overflow-x-auto` 안에서 가로 스크롤(의도)
- [x] 대시보드 매출액 141억→150억 입력 시 HCROI 1.25배→1.52배 즉시 재계산 = 수식 검산 일치 ((9.36+33.84)/33.84)
- [x] localStorage(`hcroi:workspace:v1`) 저장 → 새로고침 후 입력값·시나리오 파라미터 복원
- [x] 시뮬레이터: 인원 변동율 입력/슬라이더 키보드 조작 반영(36명→+20%→43명), 고급 가정 펼침 동작
- [x] JSON 내보내기(`hcroi-workspace-YYYY-MM-DD.json`, keys: years/scenarios/baseYearId) → 수정 → 가져오기 왕복 OK
- [x] 연도 추가(중복 연도 차단)·삭제·샘플로 초기화·잘못된 JSON 에러 문구 OK
- [x] 시나리오 A/B 수치 수기 검산 일치 (A: 40명·39.5억·23.2억·1.59배 / B: 34명·32.9억·9.54억·1.29배)

### 발견 이슈 (2026-09-01 세션 2 후반에 #1~#9 전부 처리 — 아래 표는 이력용)

| #                         | 심각도                                  | 위치                          | 내용                                                                                                                                               | 제안                                                                                                                                                                 |
| ------------------------- | --------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                         | 중 (모델링)                             | `/simulator`                  | 변동비 비율 기본 0(전액 고정비)이라 인원 +10% 만으로 영업이익 8.46억→23.2억(×2.7). 시나리오 A 인사이트에 지속가능성 경고 없음                      | spec §5 개선 시 점검 항목에 "개선분 대부분이 비인건비 고정 가정에서 발생" 경고 추가 or 샘플 기본 변동비 비율 >0 — **가정 변경이라 brain/spec/테스트 동시 갱신 필요** |
| 2                         | 하 (버그)                               | `data/+page.svelte:181`       | `{#if y.memo}` 로 "샘플" 칩 표시 → 사용자가 메모만 적어도 "샘플"로 표기됨                                                                          | 샘플 판별을 memo 내용이 아닌 별도 플래그/ID prefix 로                                                                                                                |
| 3                         | 하 (레이아웃)                           | `data/+page.svelte:164`       | 표 헤더 `sr-only` span(position:absolute)이 스크롤 컨테이너 밖으로 나가 문서 폭 566px 로 확장(390px 뷰포트). 화면상 보이진 않지만 가로 스크롤 생김 | `overflow-x-auto` 래퍼에 `relative` 추가                                                                                                                             |
| 4                         | 하 (표기)                               | `/simulator` 비교표·미니 결과 | HCROI 증감 "+0.34p" — %p 와 혼동                                                                                                                   | "+0.34배" 로                                                                                                                                                         |
| 5                         | 하 (표기)                               | `/` 라인차트                  | 직접 라벨 "1.25" 가 우측 "양호 1.3" 기준선 라벨과 근접                                                                                             | 라벨 위치 보정 or 마지막 점 라벨을 좌측으로                                                                                                                          |
| 6                         | 하 (표기)                               | `/guide` 산식 블록            | `font-mono` 블록에서 "교육훈련                                                                                                                     |
| 비" 처럼 단어 중간 줄바꿈 | `break-keep`(word-break: keep-all) 추가 |
| 7                         | 하 (표기)                               | `/` 누적 막대 y축             | "0" 만 단위 없음, 나머지는 "50.0억"                                                                                                                | 0 도 "0억" 또는 축 제목으로 통일                                                                                                                                     |
| 8                         | 무시                                    | 전역                          | `/favicon.ico` 404 — layout 이 `favicon.svg` 를 링크하고 있어 브라우저 자동 요청일 뿐                                                              | 조치 불필요 (원하면 static/favicon.ico 추가)                                                                                                                         |
| 9                         | 하 (모바일)                             | `/data` 표                    | "샘플" 칩이 390px 에서 "샘/플" 로 글자 단위 줄바꿈                                                                                                 | `whitespace-nowrap`                                                                                                                                                  |

## 다음 할 일 (우선순위 순)

1. ~~md 포맷 정리~~ 완료
2. ~~첫 커밋~~ 완료 → **Vercel 배포**: 사용자가 Vercel 대시보드에서 pulunick/hcroi-simulator import (Framework: SvelteKit, 기본 설정 그대로) → URL 을 인사담당자에게 사내 메신저로 전달
3. ~~화면 육안 점검~~ 완료, 발견 이슈 9건 수정 완료. 기획서 **원문 파일**을 `docs/` 에 받아 requirements-coverage.md 를 문장 단위로 재대조
4. ~~엑셀 내보내기/가져오기 구현~~ 완료 (2026-09-01)
5. ~~원격 저장소 연결~~ 완료
6. 그 외 Phase 2 항목 우선순위는 프로토타입 검토 후 사용자 결정

## 막힌 것 / 사용자 결정 대기

- 기획서 원문 파일 제공 여부 (requirements-coverage 재대조용).
- **DB(Supabase) 도입 여부 — 보류.** 2026-09-01 논의: 공유·이력·부서별 분해·로그인 요구가 확인될 때까지 "엑셀 파일이 원본, 앱은 계산기" 구조 유지. 인사담당자 시연 때 공유 필요성 질문으로 확인하기로 함.
- (엑셀 §9 는 답변 완료 — 조직명만 추후 조직 개념 도입 시 재논의)

## 세션 로그

### 2026-09-01 — 세션 1 (프로젝트 생성)

- 프로젝트 골격·계산 엔진·화면 4개·문서·Supabase SQL 초안 생성.
- 결정: 별도 레포, localStorage 프로토타입, HCROI 배수 표기, 1.3~1.5 "양호", 비인건비 고정비 기본, 인라인 SVG 차트, 규칙 기반 인사이트, DB 는 개인 Supabase 계정(프로젝트 미정). → brain.md / decision-log 반영됨.

### 2026-09-01 — 세션 2 (운영 체계)

- `.claude/brain.md`(결정) / `.claude/state.md`(진행) 분리 도입.
- 현재 상태 실측: test 36 ✅ · check 0 ✅ · lint md 3건 ⚠️ · 커밋 0개.
- 브랜치 `master` → `main` 변경 (커밋 없이 `git branch -m`). 커밋은 사용자 지시 대기.
- 육안 점검 수행 (Chrome headless + Playwright). 기능·수치 모두 정상, 소규모 이슈 9건 기록. 스크린샷은 세션 스크래치패드 `shots/` (임시).
- 이슈 #1~#9 수정: 고정비 가정 과대 추정 경고(+테스트, 매출 1% 초과 증가 시만), HCROI 증감 "배" 표기(대시보드·시뮬레이터·인사이트), 샘플 칩 id 기준 판별+nowrap,
  sr-only 오버플로(`relative`), 라인차트 끝 라벨 하락 시 아래 배치, 가이드 `break-keep`, 누적막대 "0억". test 37 ✅ check 0 ✅ lint ✅.
- 문서 추가: `docs/user-guide.md`(사용 설명서), `docs/requirements-coverage.md`(spec ↔ 구현 대조). 기획서 **원문은 미확보** — 이전 세션 기록 접근이 차단되어 spec.md 기준으로만 대조.
- 전역 `cursor: pointer` 규칙을 `layout.css` `@layer base` 에 추가 (버튼·링크·summary·체크박스·라디오·range·select·label). 사용자 요청.
- dev 서버 5173 은 사용자 확인용으로 켜 둔 상태로 세션 종료.
- 엑셀 내보내기/가져오기 **계획 수립** (`docs/plans/excel-export-import.md`), brain §9 예외·decision-log·CLAUDE.md 갱신. 구현은 안 함.
- 엑셀 기능 구현: `excel/schema.ts` `toRows.ts` `fromRows.ts`(순수) + `io.ts`(exceljs 동적 import) + `/data` UI(내보내기·템플릿·가져오기 미리보기·되돌리기·JSON 고급 접힘). workspace 에 `replaceYears/takeSnapshot/restoreSnapshot` 추가. 문서(user-guide §4, spec §8, README, CLAUDE.md, coverage, plan 상태) 갱신.
- 데이터 관리 표 UX: 행 클릭 선택, 편집·삭제는 오른쪽 패널로 이동.
- 슬라이더 범위 대칭화(임금 −20~+20, 생산성 −30~+30) — 0% 가 정중앙. user-guide §3 표 갱신.
- 데이터 관리 표: 휴지통 아이콘 삭제(행별) + 오른쪽 `초기화`(표준 기본값 복원), HCROI 열 우측 기준선 일치.
- 데이터 관리 표 헤더 전체 가운데 정렬(본문 숫자는 우측), HCROI 헤더는 숫자+배지 묶음(9rem) 중앙.
- 첫 커밋 `1923bcc` + 개인 GitHub **pulunick/hcroi-simulator (public)** 생성·push. 빌드(`npm run build`, adapter-vercel) 통과 확인. 다음: 사용자가 Vercel import.

### 2026-09-01 — 세션 2 마무리

- 메모리(`~/.claude/projects/.../memory/`) 5건 저장: 사용자 프로필, gh 계정/push 절차, 공개 저장소 위생, 작업 방식, 육안 점검 방법.
- 로컬 dev 서버(5173) 종료. 작업 트리 클린, 원격과 동기화.
- **다음 세션 시작점**: ① 사용자가 Vercel import 했는지 확인 → 배포 URL 4개 화면·엑셀 다운로드 점검 ② 인사담당자 시연 피드백 반영 ③ 기획서 원문 오면 requirements-coverage 재대조 ④ Phase 2 우선순위 결정.
