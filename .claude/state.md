# state.md — 진행 상황

> **역할**: 지금 어디까지 왔고, 다음에 뭘 할지. 세션마다 갱신한다.
> 결정된 사항(바뀌지 않는 규칙)은 [brain.md](brain.md) 에만 적는다 — 여기에 중복하지 않는다.
> 형식: 상단 "현재 상태" 스냅샷 → "다음 할 일" → 하단에 세션 로그 누적.

## 현재 상태 (2026-09-17 세션 14 진행 중)

| 항목            | 상태                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 단계            | 프로토타입 + 실무 회신 반영 + 전체 검수 + **기간 합산(월→분기→연간)·엑셀 작성 편의**(2026-09-09). **결산서 PDF 가져오기 구현**(2026-09-09). 남은 큰 것: 부서별 · 동종업계 · PDF 수동 셀 지정. **공개판(이 브랜치)**: 2026-09-14 밤 **방향 전환 — 판매가 아니라 인사담당자가 웹에서 써보는 무료 공개판**(초점: DART 결산서→엑셀 수기 입력의 자동화, 다크모드·반응형 필수). 워드마크 B·주홍 확정, 랜딩(1440/390)·설정·리포트 공개판 시안 완료 → **코드 이행 완료**(토큰·다크·헤더·설정·리포트·랜딩·정리, 세션 11~12) |
| `npm test`      | ✅ 13 파일 / 222 passed (formulas · scenario · insights · period · rollup · excel · pdf table · locate · detectPeriod · report data · guide slug/markdown) + probe(skip)                                                                                                                                                                                                                                                                                                                                           |
| `npm run check` | ✅ 0 errors / 0 warnings (445 files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run lint`  | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| git             | 원격 **github.com/pulunick/hcroi-simulator (public)**, 브랜치 **main** 3c79c66 (push 2026-09-17, 동종업계) + **미커밋: 공개판 배포·검색·분석(M1–M3) + public-deploy 계획서**. product/commercial 6ef9bd2 = main + `SITE_ENABLED=true`                                                                                                                                                                                                                                                                              |
| DB              | 없음(보류). 마이그레이션 SQL 준비만 됨, 어느 프로젝트에도 미적용                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 원격 저장소     | pulunick/hcroi-simulator (public). push 절차는 brain §1 참조                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

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
- [x] **등급 3단계 전환** (2026-09-03): <1.0 위험 · 1.0–1.5 보통 · ≥1.5 우수. `fair`(양호) 타입·배지·기준선·문서 전부 제거
- [x] **대시보드 제목 커스터마이징** (2026-09-03): `workspace.orgName`(localStorage) → h1 · 브라우저 탭 · 엑셀 파일명. DB 불필요
- [x] **인건비 세부 항목 부분 입력 허용** (2026-09-08, 커밋 `c22a597`): 세부 합계 < 총액이면 경고만 + 차액 미분류. 합계 > 총액만 오류
- [x] **금액 표시 단위 옵션** (2026-09-08): 자동·원·천원·백만원·억원 (`workspace.amountUnit`, 기본 천원).
      표시 계층 전용 — 표는 단위를 열 머리글로, 차트 축은 자동 축약 유지. `formatAmount` / `formatAmountBare`
- [x] **기간 레코드(분기·반기)** (2026-09-08): `YearRecord` → `PeriodRecord`(`period.ts` 헬퍼). 조회 기간·추이 단위 선택, 전기/전년 동기 비교,
      기간 추가 폼(연도+유형+순번), 엑셀 `기간` 열, 옛 localStorage 자동 이행, 샘플 2025 분기 4개. 연율화 토글은 미도입(결정 기록)
- [x] **임직원 수 산정 기준** (2026-09-08): `workspace.headcountBasis`(기간 평균/기말 + 계약직·파견·등기임원 포함 토글) + 연도별 선택 입력 `headcountBreakdown`(정규직·계약직·파견·등기임원). 총원 자동 계산·화면 기준 표기·엑셀 왕복
- [x] **기간 합산 + 월 단위 + 엑셀 작성 편의** (2026-09-09): `rollup.ts`(합산·차감·불일치), `workspace.effective`, 월(M) 유형, 대시보드/데이터/시뮬레이터에 합산 레코드,
      엑셀 `조직 정보` 금액 단위·누계 칸, 템플릿 드롭다운·유효성·검증 열·조건부 서식·메모·보호. 계획서 docs/plans/rollup-and-excel.md
- [x] **결산서 PDF 가져오기** (2026-09-09): `src/lib/hcroi/pdf/`(extract·table·locate·map·toRecord) + `components/data/PdfImport.svelte` + `/data` 버튼·미리보기 합류 + `workspace.pdfPrefs`.
      픽스처 테스트, 실 PDF 프로브(반기보고서 2부 4개 값 정답 일치), 브라우저 E2E 2종. 계획서 docs/plans/pdf-to-excel.md
- [x] **엑셀 `조직 정보` 시트** (2026-09-03): 회사명을 엑셀이 운반 → 가져오기 시 제목까지 복원(미리보기 체크박스로 확인). `readWorkbook`/`parseOrgName` 추가, 테스트 57건

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

> 2026-09-08 사용자 결정 반영. 확정된 기준은 [brain.md §3 · §11](brain.md) 참조.

### 완료된 작은 것

1. ~~인건비 세부 4항목만 입력 허용~~ (커밋 `c22a597`)
2. ~~금액 단위 표기~~ → **표시 단위 옵션**으로 구현 (커밋 `03a6f31`)
3. ~~임직원 수 산정 기준 옵션~~ → 기준 설정 + 연도별 인원 구분 입력 + 엑셀 왕복까지 구현

### 다음

4. ~~분기 단위 지원~~ → **기간 레코드로 구현 완료** (2026-09-08). 월(M) 단위는 요구 확인 시 같은 구조로 추가
5. ~~결산서 PDF → 엑셀 입력 시트 변환~~ → **M1–M4 구현 완료**(2026-09-09). 남은 것: (a) 담당자 자사 결산서로 실전 확인(질문지 §6) (b) 내부 결산서 양식이 다르면 계획서 §6 수동 셀 지정 모드 (c) Vercel 배포 후 pdf.js worker 자산 로드 확인
6. **부서별 HCROI** — 배부율 α = 인건비 비중(확정), 단위 본부–팀(보유 확인됨). 부서 마스터 입력 화면 필요
7. ~~동종업계 비교 (C안 확정)~~ → **구현 완료(2026-09-17, main)**: `peers.ts` + `/peers` + 엑셀 `동종업계` 시트. 다음: PDF→동종업계 회사 바로 넣기, 리포트 한 줄, DART API 자동 채우기(계획 §7)
8. **공개판 별도 배포 · 검색 노출 · 유입 측정 · 광고** — 계획서 [docs/plans/public-deploy.md](../docs/plans/public-deploy.md)(2026-09-17 초안). 사용자 결정 §11(호스팅 Cloudflare Pages 추천 · 도메인 · 분석 도구 · 광고 보류 · `/` canonical) 뒤 M1 배포 분리부터
9. **DART Open API 자동화 (B안, 선택)** — 6번이 매 분기 반복으로 굳어지면 착수.
   `fnlttSinglAcntAll`(재무제표) + `empSttus`(직원수·연간급여총액). Vercel 서버 라우트 1개 + 무료 API 키 필요

### 완료

- ~~md 포맷 정리~~ / ~~첫 커밋~~ / ~~화면 육안 점검·이슈 9건~~ / ~~엑셀 내보내기·가져오기~~ / ~~원격 저장소~~ / ~~등급 3단계~~ / ~~대시보드 제목·조직 정보 시트~~
- **Vercel 배포** — 사용자가 대시보드에서 pulunick/hcroi-simulator import (SvelteKit 기본 설정)

## 막힌 것 / 사용자 결정 대기

> 2026-09-08 회신으로 기존 4건 모두 해소 (본부-팀 보유 확인 · 결산서 8개사 확보 가능 · 단위는 옵션으로 구현 · 분기 3개년 보유).

- 없음. 3번(임직원 수 기준 옵션)부터 순서대로 진행하면 된다.

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

### 2026-09-03 — 세션 3 (확장 지침 반영)

- 확장 지침 PDF("Martin's HCROI Simulator 2.0", 10쪽 이미지 PDF) 전 쪽 검토 → **텍스트 요약본** `docs/plans/martin-2.0-extensions.md` 작성 (다음 세션에 PDF 재분할 불필요).
- **등급 3단계 전환**: 원문 케이스 스터디가 1.33·1.40 을 "보통"으로 표기 → 1.3–1.5 "양호" 폐지. `HCROI_THRESHOLDS`·`HcroiGrade`·GradeBadge·insights·대시보드 기준선·guide 등급표·엑셀 산식 시트·spec §3·user-guide·README·CLAUDE.md·brain 반영.
- **대시보드 제목 커스터마이징**: `workspace.orgName` 추가(localStorage, JSON 내보내기 포함). h1 옆 연필 아이콘 → 인라인 편집, 브라우저 탭 제목, 엑셀 파일명(`hcroi-<조직명>-YYYY-MM-DD.xlsx`)에 반영. **DB 불필요** 확인.
- 검증: test 51/51 ✅ · check 0 ✅ · lint ✅ · 브라우저 E2E 8건 PASS(등급 표기·제목 저장/복원/초기화·엑셀 파일명).
- 확장 지침 나머지(기간별·부서별·OCR)는 미착수 — Phase 2 후보로 접수만. **로드맵 STEP1(ERP/HRIS 연동·결산서 파서)·STEP2(에이전트 프롬프트 이식) 도 미착수**.
- **엑셀 `조직 정보` 시트 추가**(사용자 요청 "엑셀을 DB처럼"): 내보내기·템플릿에 `회사/조직 이름` 한 칸 포함, 가져오기 때 `parseOrgName` 으로 읽어 미리보기 체크박스 확인 후 제목 반영. 시트 없는 옛 파일은 제목 무변경. test 57 ✅ check 0 ✅ lint ✅.
- 육안 점검용 dev 서버(5173) 켜 둔 상태.

### 2026-09-03 — 세션 4 (엑셀 조직명 · 인사담당자 회신)

- 엑셀에 **`조직 정보` 시트** 추가 — 회사명을 파일이 운반해 가져오기 시 대시보드 제목까지 복원. `readWorkbook`/`parseOrgName` 신설, 미리보기 체크박스로 확인 후 반영. test 57 ✅ check 0 ✅ lint ✅
- 인사담당자용 **확인 요청서**(18문항)를 아티팩트로 공유 → 답변 회신 받음. 내부 준비용 질문지와 공유용을 분리해 작성
- **보류 중이던 결정 3건 모두 확정**: DB 도입 안 함 / 배부율 α = 인건비 비중 / 분기 단위 필수.
  램프업·일회성 비용 미반영, 금액 천원 단위, 인원 기간 평균(FTE) 도 함께 확정 → brain §11 · decision-log 기록
- **신규 요구 2건 접수**: 결산서 PDF 로 변동비 반영, 동종업계 평균 비교. 원본 PDF 수령이 확인돼 서버 없이 가능한지 검증이 선행 과제
- 발견: 엑셀 가져오기가 인건비 **세부 4항목만 채운 파일을 오류로 거부**한다(담당자 실제 보유 항목이 4개). 다음 세션 우선 처리

### 2026-09-08 — 세션 5 (금액 단위 옵션 · 결산서 파싱 실측)

- **컨텍스트 이슈 해결**: 결산서 PDF(2.8MB·1.4MB)를 대화에 올리면 컨텍스트가 넘친다.
  `pdftotext -layout` 로 텍스트만 스크래치패드에 추출(16,909줄 / 9,647줄)하고 `grep`/`sed` 로 필요한 구간만 읽는 방식으로 전환. **이 방식을 앞으로 유지한다.**
- **PDF 파싱 실측**(루닛·코어라인소프트 반기보고서): 이미지 스캔 아님(텍스트 레이어 있음, 클라이언트 추출 가능).
  그러나 DART 표는 셀 정렬이 깨져 **라벨과 숫자가 어긋난다** — 코어라인 영업수익 28.8억인데 `영업이익(손실)` 행에 83.5억이 붙는 식.
  직원 등 현황 표만 합계 행이 안정적(루닛 243명/11,559백만원, 코어라인 95명/3,207,410천원). 단위가 회사마다 달라 `(단위 : …)` 파싱 필수.
  → **동종업계 비교는 C안(엑셀 수기 입력) 확정**, 자동화가 필요해지면 DART Open API(B안).
- 커밋 `c22a597`: 조직 정보 시트 + 인건비 세부 부분 입력 허용 + `.gitignore` 에 `docs/*.pdf`.
- **금액 표시 단위 옵션 구현**: `format.ts` 에 `AmountUnit`·`formatAmount`·`formatAmountBare`·`amountUnitLabel`,
  `workspace.amountUnit`(localStorage·JSON 내보내기 포함), `/data` 상단 선택 UI, 4개 화면 + `insights.ts` + `NumberField` 힌트 연결.
- 육안 점검(Chrome + Playwright, 1440px·390px): 단위 전환·새로고침 유지·표 열 머리글 단위 표기 정상, 콘솔 에러 없음(favicon 404 제외).
  발견·수정: 천원 표기가 길어져 표 칸에서 글자 단위로 줄바꿈 → `table .tabular` / `table thead th` 에 `nowrap`.
  (처음엔 `.tabular` 전역에 걸었다가 390px 에서 카드가 문서 폭을 528px 로 밀어내 표 안으로 범위를 좁혔다.)
- 검증: test 61 ✅ · check 0 ✅ · lint ✅. dev 서버는 5174 포트(5173 사용 중)로 켜 둔 상태.

### 2026-09-08 — 세션 5 (이어서: 이전 세션 잔여 점검 · 임직원 수 산정 기준)

- **이전 세션(컨텍스트로 중단) 잔여 점검**: 코드는 전부 반영돼 있었다(조직 정보 시트 export/template/import/미리보기,
  세부 부분 입력 + 미분류 UI, 테스트). **`docs/requirements-coverage.md` 만 세션 3 시점에 멈춰** 있어 갱신(커밋 `0d2ef1b`) —
  폐지된 "양호" 등급이 남아 있었고, 실무 회신 요구 8건과 확장 지침(Martin 2.0) 대조표가 없었다.
- **임직원 수 산정 기준 구현**:
  - `types.ts` `HeadcountBreakdown`·`HeadcountBasis`·`DEFAULT_HEADCOUNT_BASIS`, `formulas.ts` `sumHeadcount`, `format.ts` `headcountBasisLabel`
  - `workspace.headcountBasis`(작업공간 단위) + `setHeadcountBreakdown` / `applyHeadcountBasis`
  - `/data` 상단 기준 컨트롤 + 편집 패널 `인원 구분으로 입력`(인건비 세부와 같은 패턴). 대시보드·가이드에 기준 표기, 총원은 구분 사용 시 읽기 전용
  - 엑셀: `입력 데이터` 에 인원 구분 4열, `조직 정보` 시트에 산정 기준 4행. 가져오기 때 파일 기준으로 파싱하고 미리보기에서 확인 후 적용
  - 파견·도급을 포함하고 실제 인원이 있을 때만 "인건비에는 안 잡힌다" 경고
- 검증: test 74 ✅ · check 0 ✅ · lint ✅ · 브라우저 실측(구분 입력→총원 36→40, 기준 유지, 엑셀 내보내기→되가져오기 3행 정상, 콘솔 에러 없음)

### 2026-09-08 — 세션 5 (이어서, fable): 기간 레코드 전환

- **`YearRecord` → `PeriodRecord`** 전면 전환. `period.ts` 신설(라벨·정렬·기간 텍스트 파싱·전기/전년 동기, 테스트 16건).
  workspace API 개명: `records/sorted/latest/base/baseId/addPeriod/removeRecord/getRecord/hasPeriod/replaceRecords` + `ofType/previousOf/yearAgoOf`.
- 옛 localStorage(`years`+`year`) 자동 이행 — 브라우저에서 실측(옛 형식 주입 → 새로고침 → `records`+`baseId` 로 저장됨).
- 대시보드: 조회 기간 셀렉트(8개), 추이 단위 셀렉트(유형 둘 이상일 때), 전기 비교 라벨(`vs 2025년 3분기`), 전년 동기 줄, 표 헤더 "기간".
- 데이터 관리: 기간 추가 폼(연도+유형+순번, 순번 자동 증가, 중복 검사), 같은 유형 값 복사(2026 Q1 ← 2025 Q4 39억 확인), 표·편집 헤더 라벨.
- 시뮬레이터: 기준 기간 셀렉트·라벨(`기준 (2025 Q2)`).
- 엑셀: `기간` 열 왕복(연간/1분기…), 지표 요약 시트 첫 열은 기간 라벨 텍스트, 시나리오 시트 `기준(2025년)`. 브라우저 내보내기→되가져오기 8행 정상.
- 검증: test 86 ✅ · check 0 ✅ · lint ✅ · 콘솔 에러 0. 문서(spec·user-guide·brain·decision-log·coverage·martin plan·README) 갱신.

### 2026-09-09 — 세션 5 (이어서, fable): 전체 검수

- `/code-review high src` 7개 관점(재사용·단순화·효율·고도·삭제된 동작·라인 스캔·교차 파일) 결과를 한 번에 반영. 8번째(관례) 에이전트는 세션 한도로 실패.
- 실제 결함 6건(인원 기준 불일치 경로 3종, 화면-가져오기 검증 불일치, 대시보드 총 인건비 잠금·라벨 오류, 빈 레코드가 기본 기간이 되는 문제, 0 표기, 이행 시 조용한 유실)과
  구조 정리(표기 규칙 집중, 라벨 상수화, 파서 공통화, 전기 정의, 시리즈 지표 1회 계산) — 상세는 decision-log 2026-09-09.
- 검증: test 91 ✅ · check 0 ✅ · lint ✅ · 브라우저 E2E 3종(기간·인원 기준·엑셀 왕복) 재통과, 콘솔 에러 0.
- dev 서버 5174 켜 둔 상태. **다음**: 5. 부서별 HCROI(본부–팀, α = 인건비 비중) → 6. 동종업계 시트(C안).

### 2026-09-09 — 세션 5 마무리

- 작업 트리 클린, 커밋 6건(`c22a597`→`d8b201b`) 로컬. dev 서버 종료. CLAUDE.md 에 기간 레코드·검증·표기 규칙·PDF 취급 규칙 추가.
- **다음 세션 시작점**:
  1. (선택) push — `gh auth switch --user pulunick` → push → 회사 계정 복귀. Vercel 재배포 확인
  2. **⑤ 부서별 HCROI** 착수 전 결정: 부서 마스터(본부–팀 2단계)를 어디에 두나(작업공간 설정 vs 기간별), 부서 인건비·인원을 기간 레코드 밑에 붙이나 별도 레코드로 두나,
     Profit center 직접 영업이익 입력 vs 전부 배부(α = 인건비 비중 확정). 계획서 `docs/plans/departments.md` 먼저 쓰고 사용자 확인
  3. **⑥ 동종업계 시트** — 엑셀 `동종업계` 시트(회사·기간·매출·영업이익·인건비·인원) 수기 8개사 → 비교 화면. 결산서 2부는 `docs/*.pdf`(커밋 제외), 텍스트는 `pdftotext -layout`
  4. 회귀 확인용 브라우저 스크립트는 옛 스크래치패드 `c85dd2b1…/scratchpad/check-*.mjs` (playwright 설치돼 있음). dev 서버 포트는 5173 이 비어 있으면 5173

### 2026-09-09 — 세션 6 (인사담당자 시연 준비)

- 1차 회신 18문항 대조: 구현 4건(4항목·인원 기준·분기·천원/배수) + 결정 반영 8건 완료. **미착수 3건** — 부서별(9), 동종업계(14: 원 요청은 PDF 업로드→평균, C안 수기 입력으로 변경됨), 변동비 결산서 반영(16: 미결정). 월 단위 미도입.
- **결정: ⑤⑥ 착수 전에 지금 상태로 시연**하고 위 3건을 확인받는다(재작업 방지).
- push 완료 `e51feb3..e64ce9a`(pulunick → 회사 계정 복귀). Vercel 은 자동 재배포(URL 미기록).
- `docs/requirements-coverage.md` 임직원 수 기준 행 ⏳→✅ 정정.
- `docs/user-guide.md` 갱신: 연도→기간 표현, 기준선 1.0/1.5(1.3 잔재 제거), 표시 단위 힌트, 인원 기준 표기, §7 표, **§8 결산서에서 값 옮기기** 신설.
- `docs/samples/hcroi-sample-3y-quarterly.xlsx` 생성(가상 "샘플전자", 분기 12행 + 연간 3행, 인건비 4항목 → 5% 미분류, 인원 구분, 기준 평균·정규직만).
  프로젝트 `buildWorkbookBuffer` 로 만들었고 `readWorkbook→parseInputRows→validateRecord` 왕복 확인(15행, 오류 0, 미분류 경고만).
  생성 스크립트는 스크래치패드 `make-sample.ts`(esbuild 번들 → node). 다시 만들 일 있으면 같은 방식.
- `docs/plans/review-2-questions.md` — 시연 시 확인할 3가지(동종업계 입력 방식 · 부서별 데이터 형태 · 변동비 정의) + 시연 순서.
- **다음**: 시연 → 회신 반영해 `docs/plans/departments.md` 계획서 → ⑤ 부서별 → ⑥ 동종업계.

### 2026-09-09 — 세션 6 (이어서): 기간 합산 · 월 단위 · 엑셀 작성 편의

- 사용자 지적("월 넣으면 분기·연간이 자동으로 나와야") → 계획서 `docs/plans/rollup-and-excel.md` → 구현.
- `rollup.ts` 신설(순수 함수, 테스트 9건): 합산(M→Q→H→Y, 하위가 다 있을 때만), 직접 입력 우선 + `rollupMismatch`, 차감(직접 입력 상위 − 나머지, 어느 하위 단위든 하나만 빌 때), 인원은 산정 방식(평균은 사슬에서 반올림 전 값 유지).
- `period.ts`: M 유형, `childType/parentType/childPeriods/parentPeriod/allPeriodTexts`, 라벨 "2025년 3월"/"2025.03"/"3월", 전월·N개월.
- `workspace`: `records`(직접 입력)와 `effective`(합산 포함) 분리. latest/base/ofType/findByPeriod/periodTypes 는 effective, hasPeriod/getRecord 는 records. `materialize(id)`, `mismatchOf(rec)`.
- 화면: 대시보드 조회 기간에 `· 합산`, 합산이면 카드 읽기 전용 + "직접 입력으로 전환", 불일치 노란 경고. 데이터 관리 표에 `합산` 배지(삭제 불가), 합산 패널(읽기 전용 요약), 월 추가. 시뮬레이터 기준 기간에 합산 포함.
- 엑셀: `조직 정보` 에 금액 단위(원/천원/백만원)·손익 입력 방식(기간 실적/누계) 드롭다운(ORG_ROWS 10·13행). 가져오기 `parseInputRows(rows, {basis, scale, cumulative})`(옛 basis 인자도 됨), `deCumulate`.
  입력 시트: 기간 드롭다운 19개, 연도/금액/인원 유효성, 맨 끝 `검증` 열 수식(조직 정보 B5~B7 참조) + 조건부 서식, 머리글 메모, 300행 입력 칸 열고 시트 보호(비밀번호 없음). exceljs 타입에 `dataValidations` 가 없어 `addValidation` 헬퍼로 좁혀 호출.
  `cellToPrimitive`: 결과 없는 수식 셀 → null(템플릿 검증 열이 빈 행으로 읽히게). 지표 요약 시트는 `summaryRecords`(effective)로 "(합산)" 표시.
- 샘플: 2025년 연간 레코드 제거(분기 4개에서 합산). insights/excel 테스트 기대값 갱신. 샘플 엑셀 재생성(분기 12행만) → **docs/samples 파일이 엑셀에서 열려 있어(EBUSY) 덮어쓰지 못함**, 새 파일은 스크래치패드 `hcroi-sample-3y-quarterly.xlsx`. 엑셀 닫고 복사 필요.
- 발견·수정: 가져오기 반영 메시지가 `$derived` 를 상태 변경 후 읽어 "제목 기본값으로"로 잘못 찍히던 버그(값을 미리 잡아 둠).
- 검증: test 112 ✅ · check 0 ✅ · lint ✅ · 브라우저 E2E(스크래치패드 `check-rollup.mjs`, 옛 스크래치패드의 playwright 로 실행): 합산 행 9개 표시, 기본 조회 기간 "2025년 · 합산" HCROI 1.25, 읽기 전용 4칸, 전환 후 불일치 경고, 월 추가, 샘플 엑셀 12행 가져오기(합산 6/22), 템플릿 다운로드, 콘솔 에러 0.
- 문서: spec §2·§7, user-guide §0·§2·§4·§6·§7, brain §11, decision-log 2026-09-09, coverage, CLAUDE.md 절대 규칙(상위 기간 미저장), 계획서.
- 샘플 xlsx 복사 완료(엑셀 닫은 뒤). 사용자 확인: **시연 아님, 담당자가 직접 써 보는 방식** · **개인 소장용, 전사 관리 대상 아님** → 질문지·아티팩트·brain §1 문구 갱신.
- 사용자 보충: 담당자가 이직해도 계속 쓰고 업체마다 보여 주는 형태 → brain §1 에 기록. 회사별 작업공간 전환은 Phase 2 후보로만.
- 커밋 `91dfabe` + push 완료(pulunick → 회사 계정 복귀). Vercel 자동 재배포.
- **다음**: (1) 담당자에게 링크·샘플·설명서·질문지 전달 → 회신 반영 (2) ⑤ 부서별 계획서 (3) 작은 것: "마지막 내보내기 이후 변경됨" 백업 안내.

### 2026-09-09 — 세션 6 마무리

- 2차 질문지를 1차와 같은 방식(항목별 답변칸 → 답변 모으기 → 복사, localStorage 임시 저장)으로 재작성. 5주제 15항목(동종업계·부서별·변동비·엑셀 양식·소감). `docs/plans/review-2-questions.md` 에 "회신 받은 뒤 할 일" 포함.
- **세션 마무리 절차를 스킬로 등록**: `.claude/skills/wrap-up/SKILL.md` (`/wrap-up`). CLAUDE.md 세션 운영 절에 연결.
- 계획서 `rollup-and-excel.md` 완료 표기. dev 서버 종료 확인.
- **다음 세션 시작점**:
  1. 담당자에게 전달: 앱 링크(Vercel) · `docs/samples/hcroi-sample-3y-quarterly.xlsx` · `docs/user-guide.md` · 질문지 아티팩트(https://claude.ai/code/artifact/237de666-b299-40b1-88e3-48fd74653f40)
  2. 회신 오면 `review-2-questions.md` "회신 받은 뒤" 절대로 → `docs/plans/departments.md` 계획서 → ⑤ 부서별 → ⑥ 동종업계
  3. 작은 것: "마지막 엑셀 내보내기 이후 변경됨" 백업 안내 · 질문 5-2 가 예산 역산이면 시뮬레이터 역산 모드 계획
  4. 회귀 확인 스크립트: 옛 스크래치패드 `c85dd2b1…/scratchpad/check-rollup.mjs`(playwright 설치돼 있음). 샘플 엑셀 생성 스크립트는 세션 6 스크래치패드 `335d81cf…/scratchpad/make-sample.ts`(esbuild 번들 → node)

### 2026-09-09 — 세션 7 (결산서 PDF → 엑셀 기획설계)

- 인사담당자 논의 결과 접수: **PDF 결산서를 엑셀 양식으로 옮기는 수기 작업 제거가 최우선**(부서별·동종업계보다 앞). 기획설계 요청.
- 2026-09-08 "PDF 파싱 미채택" 근거 재검증: `pdftotext -table` + **pdf.js 4.10 좌표 추출**(스크래치패드 `spike.mjs`, 반기보고서 2부)로 손익계산서·성격별 비용·직원 등 현황 3표가 제자리로 복원됨을 확인.
  이전 "어긋남"은 `-layout` 줄 접합 문제. 남는 과제는 표 찾기·계정 사전·단위·3개월/누적·연결/별도·다줄 라벨·내부 결산서 양식(미확인).
- 계획서 `docs/plans/pdf-to-excel.md` 작성: 사용자 흐름(카드 확인 → 기존 미리보기 합류 / 엑셀 저장), 모듈 `src/lib/hcroi/pdf/`(extract·table·locate·map·toRecord, pdf.js 동적 import), 표별 추출 규칙, 마일스톤 M1–M5, 리스크, 확인 질문 6개.
- brain §11 정정·최우선 요구 추가, decision-log, martin-2.0-extensions 표, review-2-questions §6 갱신. 코드 변경 없음(test/check 영향 없음).
- **다음**: §9 질문 6개 답 받기(특히 받는 PDF 가 DART 인지 내부 결산서인지 + 샘플 1부) → M1·M2 착수(답 없이도 가능).

### 2026-09-09 — 세션 7 (이어서): 결산서 PDF 가져오기 구현 (M1–M4)

- 사용자 결정: 받은 PDF(DART 반기보고서 2부) 기준으로 바로 착수. LLM 불필요(규칙 기반) 확인.
- `pdfjs-dist@4.10` 의존성 추가. `src/lib/hcroi/pdf/`: `types.ts` · `table.ts`(y 클러스터·셀 병합·숫자/단위 파싱·두 줄 라벨) · `locate.ts`(표지·손익계산서·성격별·직원 현황, 쪽 이어 읽기, 목차+바닥글로 연결/별도) · `map.ts`(계정 사전·열 선택·후보·`PdfPrefs`) · `toRecord.ts`(레코드+검증 경고) · `extract.ts`(pdf.js 동적 import, worker `?url`).
- 픽스처 `pdf/fixtures/report-a.json`·`report-b.json`: 실 PDF 좌표 + 4자리 이상 숫자 치환 + 회사명 치환(생성 스크립트는 스크래치패드 `fixture.mjs`). 테스트 144 passed.
- 실 PDF 프로브(`probe.test.ts`, `HCROI_PDF=`·`HCROI_PDF_OUT=`): 2부 모두 별도 손익계산서·별도 성격별·직원 현황 합계가 정답과 일치, 연결/별도 판별 OK. 발견·수정: 목차 점선과 쪽 번호가 한 셀로 붙음, 표가 다음 쪽으로 이어짐, 급여총액 교차검증은 기간 길이 환산 필요.
- UI `components/data/PdfImport.svelte`: 파일 여러 개, 카드(회사·보고서·기간 / 별도·연결 / 3개월·누적 / 기간 선택 / 항목별 값·출처·후보 select·직접 입력 / 인건비 체크리스트 / 인원 / 경고) → 기존 미리보기 `fromPdf` 합류. 회사별 설정 기억 `workspace.pdfPrefs`.
- 브라우저 E2E(스크래치패드 `e2e-pdf.mjs`·`e2e-pdf-prefs.mjs`, Chrome): 182쪽 PDF 2.4초, 값·기간 전환·직접 입력·미리보기·반영·되돌리기·새로고침 후 설정 자동 적용 모두 OK, 콘솔 에러 0(favicon 404 제외).
- 문서: user-guide §4·§7·§8 재작성, spec §8, README, coverage, CLAUDE.md, brain §11, 계획서 상태, decision-log.
- 커밋 `f69acfd` push 완료(pulunick → 회사 계정 복귀), dev 서버 종료. 담당자 전달문은 채팅으로 정리(배포 링크 + 사용 순서 + 질문지 §6).
- **다음 세션 시작점**: ① Vercel 재배포 후 `/data` 에서 PDF 가져오기 1회 실측(worker 자산 로드) ② 담당자 회신(질문지 §6: 자사 PDF 종류·샘플) → 필요 시 계획서 §6 수동 셀 지정 모드 ③ 그 뒤 ⑤ 부서별 → ⑥ 동종업계

### 2026-09-10 — 세션 8 (회사 이름 편집을 헤더로)

- 사용자 제안("헤더를 바꾸면 아래도 바뀌게", 로고 자리): 편집 지점을 대시보드 h1 연필에서 **헤더 로고 자리**로 이동. `workspace.brand`·`pageTitle(section)` 추가, 대시보드 h1·데이터 관리·시뮬레이터·가이드 탭 제목이 모두 따라감. 로고 이미지는 안 함(글자만).
- 검증: check 0 · lint ✅ · 브라우저 E2E(`e2e-brand.mjs`): 편집→헤더·h1·탭 반영, 새로고침 유지, 비우면 기본 이름, ESC 닫힘, 390px 문서 폭 390. 콘솔 에러 0.
- 문서: user-guide §2 연필 위치, brain §7, decision-log. 커밋 `865f36d` push 완료(pulunick → 회사 계정 복귀), dev 서버 종료.
- **다음 세션 시작점**: ① Vercel 재배포 확인(헤더 편집 + PDF 가져오기 worker 로드) ② 담당자 회신(질문지 §6: 자사 PDF 종류·샘플, 4-1 가로형 여부) ③ 회신에 따라 PDF 수동 셀 지정 / 엑셀 열 매핑(헤더 별칭) 검토 → ⑤ 부서별 → ⑥ 동종업계

### 2026-09-10 — 세션 9 (상용화 기획 착수, 브랜치 `product/commercial`)

- 사용자: 사내 수정은 main 에서 계속, 판매·유료 웹·설치형 제품은 새 브랜치에서 기획부터. UI 는 Claude Design.
- 브랜치 `product/commercial` 생성(main bd1ac6e 에서). 이 state.md 는 **이 브랜치 전용**(`.gitattributes` `merge=ours`, `git config merge.ours.driver true` 설정 완료) — main 진행 상황은 main 의 state.md 에.
- 문서: `docs/plans/commercial-product.md`(기획서 — 타깃·형태 비교·추천안 아키텍처·티어·로드맵 M0–M8·UI 원칙·리스크·미결 §10), `docs/plans/branch-strategy.md`(main → product 단방향, 코어는 main 에서만, 충돌 파일 처리, 세션 루틴, 저장소 분리 시), brain §12, CLAUDE.md 브랜치 절, decision-log.
- Claude Design 캔버스 "HCROI 제품 화면 시안": https://claude.ai/code/artifact/1637dbb7-3c9e-42d9-9b60-db22f38fdbd9 — 작업 파일 `docs/design/commercial/*.dc.html` + `canvas.json`(랜딩 A/B·홈·온보딩·대시보드·A4 리포트). 수정은 파일 편집 → 재발행.
- 코드 변경 없음. 커밋 `88b7893`(문서) · `e3569cc`(디자인) → `origin/product/commercial` push 완료(pulunick → 회사 계정 복귀). **branch-strategy.md · CLAUDE.md 브랜치 절 · decision-log 항목은 main 에도 들어가야 한다**(공유 규칙) → main 에서 먼저 커밋 후 이 브랜치가 머지하는 순서 권장.
- **다음**: 기획서 §10 결정 7개 답 → brain §12 확정 → M1(다중 작업공간·온보딩) 착수. 저장소 분리 결정 전에는 라이선스·결제 코드 금지.

### 2026-09-10 — 세션 9 (이어서): 수익 가설 · 개인 프로젝트 정리 · main 머지

- main 에서 추이 다개년 표시(연간 참조점·표시 범위, 커밋 1b9ff99)를 만든 뒤 이 브랜치에 **머지**(16cb4be, decision-log 충돌은 양쪽 항목 유지·37cf9ef 서식). 머지 후 test 153 · check 0 · lint ✅. state.md 는 `merge=ours` 로 이 브랜치 것 유지 확인.
- 사용자 질문 "판매 vs 무료+부가 수익" → 기획서 **§11 수익 전략 가설 3가지**(H1 무료 도구+유료 서비스 · H2 결과물 과금 · H3 파트너 화이트라벨), 추천 H1 → H2, H3 접촉 병행. 첫 공개는 무료.
- 사용자 확인: **회사와 아무 연관 없는 개인 프로젝트**, 담당자 수익화 허락 → 기획서 §12 정리(체크리스트 6개: 허락 문서화 · 위생 · 제품명 · 무료 공개 · 매출 직전 사업자 등록 · 담당자 관계), §8-2·§10-6 "정리됨", §0 요약 갱신. brain §12 · decision-log 반영.
- 디자인 시안 2차 점검 반영본 발행(위 링크 동일).
- **다음 세션 시작점**:
  1. `git merge main` 으로 코어 최신화(브랜치 전략 §4 루틴)
  2. 기획서 §10 남은 결정: 제품명(5) · 1순위 타깃(3) · 디자인 범위(7). §12-1 담당자 허락 문서화는 사용자가 직접
  3. H1 준비 = **무료 공개**: 문의 폼 1개 + 랜딩(디자인 캔버스 방향 A) → M1 다중 작업공간·온보딩 착수. 결제·라이선스 코드는 아직 아님
  4. branch-strategy.md · CLAUDE.md 브랜치 절 · decision-log 브랜치 항목을 main 에도 넣기(main 세션에서, 지시 시)

### 2026-09-14 — 세션 10 (수익 모델 좁힘 · Headroom 워드마크·랜딩 2차)

- 사용자 질문 흐름: 봐야 할 문서 확인 → Cyberduck 수익 구조 → 가장 효과적인 수익화 → 부업이면 웹? → UI/UX 는 Claude Design 으로 → 1차 시안 점검 "AI 티, 로고도".
- 결정(기획서 §10-1·3·4·5·7, §11 개정, §7.4 · brain §12 · decision-log): 로컬 우선 웹 · 컨설턴트 1순위(담당자 영구 무료) · 수동 결제 · 제품명 후보 **Headroom** · 랜딩+워드마크 먼저 · 프론트 리뷰는 Claude 가 Codex MCP 에 위임(이 세션엔 Codex MCP 미연결 — 연결 필요).
- 디자인 2차 발행(같은 캔버스, 라벨 "2차 · Headroom 워드마크·랜딩"): `Wordmark.dc.html`(3방향 + 강조색 2후보) · `Landing.dc.html` 전면 재작성(섹션 4개, tweak `mark`·`accent`, 실제 대시보드 스크린샷 `dashboard-hero.jpg` 54KB) · `canvas.json` 2페이지(브랜드·랜딩 / 9/10 앱 화면). 스크린샷은 스크래치패드 Playwright(`shot-dashboard.cjs`, Chrome channel)로 dev 서버 5173 에서. 로고 프롬프트는 채팅으로 전달(나노바나나/GPT 용, 타이포 전용).
- 코드 변경 없음. 미커밋: `docs/design/commercial/{Landing,Wordmark}.dc.html`, `canvas.json`, `dashboard-hero.jpg`, 기획서·brain·decision-log·state.
- **다음 세션 시작점**:
  1. ~~워드마크 방향 선택~~ → **B 확정**. 로고는 **SVG 실물로 확정**(`headroom-wordmark*.svg`, 기본 먹색 바탕, 스크립트 `make-wordmark.py` 스크래치패드 — fontTools·uharfbuzz pip 설치). 남은 것: Headroom 도메인·상표 확인, 강조색(주홍 기본), 랜딩 헤더도 검게 할지
     1-1. 랜딩 **03 누구에게 · 04 가격 문구 수정**(사용자 의견 받아서) — 01·02·히어로는 확인됨
  2. 방향 확정 → 랜딩 확정본 → 홈·리포트·설정 아트보드를 같은 규칙으로(3차) → 코드 이행 순서 M4 랜딩 → M1 홈 → M3 리포트
  3. 기획서 §11 개정 순서대로: 랜딩 + 문의 폼 → 컨설턴트 10곳 발송 목록(사용자)
  4. 커밋은 지시 시(계정 전환 절차 brain §1). branch-strategy·CLAUDE.md 브랜치 절은 여전히 main 에도 넣어야 함

### 2026-09-14 — 세션 11 (강조색·헤더 확정 · 홈·설정·리포트 3차 아트보드)

- 시작 시 사용자가 지난 세션 "다음 할 일" 5줄을 그대로 붙여 넣음 → 순서대로.
- **Codex 확인**: MCP 툴로는 안 뜨고 **플러그인**으로 로드됨(스킬 `codex:rescue` · 서브에이전트 `codex:codex-rescue`, 로컬 CLI 0.154 + 인증). brain §12 · CLAUDE.md · 메모리 문구를 "Codex MCP"→"Codex 플러그인"으로 정정.
- **결정 3건**(AskUserQuestion): 랜딩 헤더 **현재 유지**(1px 밑줄) · 강조색 **주홍 `#c24a2c` 확정**(녹색 폐기) · 03/04 문구 제안은 **보류**(가격 확정 후). brain §12 + decision-log 기록. 제안 문구는 decision-log 에 남겨 둠.
- **3차 아트보드**(같은 캔버스, 새 페이지 "앱 화면 3차 (9/14 브랜드 적용)", 라벨 "3차 · 홈·설정·리포트 브랜드 적용"):
  `Home.dc.html` 재작성(장부식 목록 · 등급 글자 칩 · 백업 절), `Settings.dc.html` 신규(라이선스·금액 단위·인원 산정·리포트 표기·백업 5절), `Report.dc.html` 재작성(A4 흑백 전제, `tier` 레버 free/consultant). 옛 홈·리포트 9/10 시안은 새 파일로 대체(git 이력에만 남음). `canvas.json` 3페이지.
  프레임 높이는 로컬 Chrome 실측(홈 946→960, 설정 2059→2080). 리포트는 처음 제목·표 머리글 줄바꿈, 차트 라벨 겹침·잘림, A4 폭 넘침(809px) → 머리 블록 세로 배치·th 본문 서체 11px nowrap·차트 240px + 좌측 눈금으로 수정, 794px 확인.
  스크린샷 스크립트 스크래치패드 `shot-artboards.cjs`(playwright 는 세션 50919ce8 스크래치패드 node_modules 재사용, `NODE_PATH`).
- 캔버스 발행 OK(contract 0.1.31, 저장 가능 유지) → 사용자 점검 후 **방향 전환**(아래).
- **방향 전환(사용자, 세션 후반)**: "지금 계획이 너무 어렵게 간다. 판매가 아니라 인사담당자들이 써볼 수 있는 형태로 웹에 제공하는 게 우선. UI/UX 는 쓰기 쉽고 예쁘게. 라이선스는 고려 대상 아님" + "다크모드·반응형 필수" + "초점은 DART 를 엑셀에 하나씩 치던 것을 자동화하는 것".
  사용자 선택: 랜딩은 소개+시작만 · 리포트는 tier 없이 포함 · 설정은 별도 화면.
  → brain §12 를 "공개 웹 버전"으로 다시 씀(핵심 가치·UI 목표·화면 구성·다크 토큰), decision-log, 기획서 상단 배너 + §7.5. 판매 문서(§5·§10·§11)는 보류 이력으로만.
  → 시안 재작성: `Landing.dc.html`(가격·대상 삭제, 히어로 "DART 결산서를 엑셀에 한 칸씩…", 시작 3가지 목록, `dark` 레버 = CSS 변수 토큰), `LandingMobile.dc.html`(390, 신규), `Settings.dc.html`(금액 단위·인원 산정·화면 테마·백업 4절, 앱 헤더에 회사명 편집·6탭, `dark` 레버), `Report.dc.html`(tier·로고 제거), **`Home.dc.html` 삭제**(회사 1곳이라 작업공간 목록 불필요). 다크용 워드마크 `headroom-wordmark-light.svg`(투명·#f0ece4) 추가. canvas.json 3페이지(공개판 랜딩·워드마크 / 설정·리포트 / 지난 9/10).
  → 로컬 Chrome 실측: 랜딩 3031(프레임 3040)·모바일 2700·설정 1700·A4 794×1123, 라이트·다크 7장 모두 넘침 없음. 캔버스 재발행.
- **코드 이행 착수(사용자 "시안 OK")**. 역할 고정: 코드는 opus/sonnet 서브에이전트, Fable 은 총괄(메모리·brain·CLAUDE.md 기록).
  - 1단계(opus) ✅ 브랜드 토큰·다크모드(`hcroi:theme` 별도 키 + app.html 인라인 스크립트, `@theme inline` + `:root`/`[data-theme]`/`prefers-color-scheme` 3중)·Google Fonts(Plex Sans KR/Mono·함렛)·헤더(워드마크 SVG `src/lib/assets/`, 회사명 편집, 탭 6개, `savedLabel`)·`/report`·`/settings` 스텁. 상태색 `-ink/-bg` 만 다크 변형(핵심 4색·범주색 유지). 본문 폭 1200.
  - Codex 리뷰(플러그인) ✅ 중간 2(다크 버튼 글자 대비 3.4:1 → `--on-accent` 먹색 필요 · 저장 실패 시 "방금" 오표시) · 낮음 2(회사명 버튼 aria-label · 대시보드 "연필" 문구) → 정리 에이전트에 위임 예정.
  - 2단계(opus) ✅ `/settings` 4절(`components/settings/SettingsSection·ChipRadio`), `lastBackupAt`·`markBackedUp`·`storageBytes`, 헤더 빈 회사명 플레이스홀더. 남긴 것: `/data` 상단 단위·산정 셀렉트 중복, JSON/엑셀 내보내기 함수가 `/data` 와 중복(`src/lib/` 추출 필요), `.hcroi` 확장자 미도입(`.json` 유지).
  - 스윕(sonnet) ✅ 11 파일 ~40곳 `rounded-*` → 2px, `GradeBadge` 알약 → 사각 칩(아이콘 제거), 그림자 제거, h1/pageTitle "시뮬레이터·데이터·가이드" 통일(대시보드 제목은 `workspace.pageTitle()` 소관 → 정리 에이전트).
  - 3단계(opus) ✅ `/report` A4: `src/lib/report/data.ts`(+27 테스트, 코어 함수만 사용) · `components/report/ReportPaper·ReportTrendChart` · `reportAuthor/reportOrg` · `@media print` A4 1장(PDF `/Type /Page` 1개) · 종이는 다크에서도 흰색. 대시보드·시뮬레이터와 수치 전부 일치.
  - 4단계(opus) ✅ `/intro` 랜딩: `components/site/SiteHeader·SiteFooter`, `+layout.svelte` 는 `/intro` 에서 앱 헤더 미렌더, `static/hero-dashboard.jpg`(실제 화면 1100×764, 87 KB, 가상 회사명), 390/768/1024/1440 넘침 없음.
  - 정리(sonnet, 세션 한도로 1회 중단 → 재개 완료) ✅ 다크 버튼 `--on-accent` 먹색(대비 4.76:1, 위험 4.69:1) · `saveError` + 헤더 "저장 실패 · 변경사항 미저장" · 회사명 버튼 aria-label · 대시보드 제목 "대시보드"(`pageTitle`) · `/data` 상단 단위·산정 컨트롤 → 요약+`설정에서 바꾸기` · `src/lib/state/io.ts`(JSON/엑셀 내보내기·가져오기 공용, `/data`·`/settings` 사용) · 앵커 `/data#pdf`(자동 펼침)·`/guide#formula` · 랜딩 시작 3가지 열 폭. 라이트 위험 버튼 4.41:1 은 기존값(범위 밖).
  - Codex 최종 리뷰(전체 변경분) ✅ 높음 1 · 중간 4 · 낮음 2 → sonnet 수정 완료(프로세스 종료로 1회 중단 → 재개): `wipeAll()`(회사명·작성자·PDF 설정·되돌리기 키까지 삭제, `hcroi:theme` 만 유지) · 저장 실패 경고 전 폭 노출 · 이름 있는 `@page report`(`/` 인쇄 영향 없음 확인) · 리포트 `ResizeObserver` 2단계 압축(compact → compact2 추이 표 생략) · 우수 배지 옅은 배경+진한 글자(라이트 6.62:1 · 다크 7.62:1) · JSON 읽기 실패 `ImportResult` + `finally` 초기화 · 소개 페이지 `.json` 안내.
  - 백그라운드 Codex 결과는 총괄이 `codex-companion.mjs status/result <task-id>` 로 직접 받는다(메모리 기록).
  - 문서 ✅ user-guide(공개판 안내·§9 리포트·§10 설정·§11 소개·FAQ 다크/모바일·§7 표), requirements-coverage §3-B.
  - 매 단계 Fable 재검수: 153 tests · check 0 · lint OK · 스크린샷(스크래치패드 `step1/ step2/ sweep/`).
- 커밋 안 함(지시 대기).
- 최종 검수(Fable): format 적용(state·decision-log) · lint OK · check 430 files 0 errors · test 180 passed. 식별자 스캔 이상 없음.
- **사용자 화면 점검 → 수정 5건(sonnet)**: 시작 경로(`/data?start=pdf` 샘플 비움·확인 / `/?start=sample` 샘플 적재, `isSampleOnly`·`startFresh`) · 앱 ↔ 소개 왕복(워드마크 → `/intro`, 푸터 `소개`) · PDF 카드 기간 셀렉트 `w-auto` · 리포트 인쇄 여백(종이 패딩 14/16mm 유지 + `@page report` 여백 0, 최소 여백 14.3mm) · 설정 02 `Checkbox.svelte`. 리포트 기간 선택은 이미 있어 수정 없음.
- **사용자 결정(2026-09-15)**: (1) 공개판 UI 를 main 에도 — product → main 1회 역머지, main 은 intro·소개 링크 제거 + 헤더 워드마크 대신 회사 이름. (2) PDF 기간 자동 감지(표지 문구 추정 + 사용자 확인)를 main 코어에 구현. 문서 개정: brain §12 · CLAUDE.md · branch-strategy §1 · decision-log.
- **다음 세션 시작점**:
  1. 사용자가 실제 화면 점검(`npm run dev` → `/intro`, `/`, `/settings`, `/report`, 다크·390px) → 지적 반영(코드는 서브에이전트)
  2. **커밋·push**(지시 시, brain §1 계정 전환) — 미커밋 범위: 디자인 11 + 문서 7 + 코드(신규 라우트 3 · 컴포넌트 3 그룹 · `lib/report` · `state/io.ts` · 토큰/헤더/스윕 수정 15 파일 · `static/hero-dashboard.jpg`)
  3. **Vercel 배포**(사용자 대시보드에서 import) → 배포 URL 에서 pdf.js worker 로드·다크·인쇄 재확인. 진입 동선(`/` ↔ `/intro`) 결정: 지금은 `/` = 대시보드, `/intro` 링크 없음
  4. 사용자 몫: Headroom 도메인·상표 확인, 라이트 위험 버튼 대비 4.41:1(기존값) 손볼지
  5. main 에도 넣어야 할 것: branch-strategy·CLAUDE.md 브랜치 절. 코어 밖 보조 함수(`pctChange`·`nextPeriod`·`splitMultiple`)를 코어로 옮길지는 main 에서 판단

### 2026-09-15 — 세션 12 (main): 공개판 UI 역머지 · 사이트 플래그 · PDF 기간 감지

- product/commercial 의 두 커밋(6c6fc26 docs · 25d6633 feat: 브랜드 토큰·다크모드·앱 헤더·`/settings`·`/report`·`/intro`·`state/io.ts`)을 **main 으로 역머지**(충돌 없음, state.md 는 main 것 유지). 사용자 결정: "intro 만 빼면 담당자 쪽에도 반영, 대시보드에서 Headroom 은 빼고 회사 이름이 그 자리".
- 브랜치 차이는 `src/lib/site-config.ts` `SITE_ENABLED`(main false / product true) 한 줄로 — intro 라우트 404 · 워드마크 대신 회사 이름 · 소개 링크 없음. 파일 삭제 안 함(머지 안전). brain §12 · CLAUDE.md · branch-strategy §1 · decision-log 개정.
- 코어 변경(main 전용): `src/lib/hcroi/pdf/detectPeriod.ts` — 표지 문구(보고서 종류 + "YYYY.MM.DD ~ YYYY.MM.DD")로 연도·유형·순번 제안, `PdfImport` 미리 채움 + 근거 표시, 못 읽으면 빈 값·사용자 선택 강제. 픽스처 테스트 + 실 PDF 프로브.
- 역할: 코드는 sonnet/opus 서브에이전트, Fable 총괄(brain §12).
- QA 세션(다른 Claude, 인사담당자 시점 Playwright)이 20건 보고 → 19건 처리(14번 색 의미는 사용자 판단 보류): 오류 레코드 지표 제외 + 합산 차단 규칙 · `copiedFrom` 칩 · 인원 0 강제 승격 제거 · 연도 +2 · 표 잘림 · 모바일 탭 두 줄 · 행 클릭 스크롤 · 샘플 칩 · `?start=excel` · `PRODUCT_NAME` 플래그 · 오타 · 앱 인쇄 CSS · 콘솔 경고 0 등. 리포트 "삭제된 데이터 출력"의 실제 경로는 `wipeAll()` 샘플 재적재 → 빈 상태로 변경.
- 코어 `pdf/table.ts` 정규식 오타(`[\s3000]` → `[\s　]`) 수정 + 회귀 테스트, 실 PDF 프로브 전후 동일.
- **룩 복귀(사용자 결정, 담당자 비교 "기존이 더 전문적")**: 앱 화면·소개 페이지를 `1b9ff99` 디자인 시스템(흰 카드·그림자·14px·파랑·고딕·Pretendard)으로 되돌림 + 다크 팔레트 재정의(page `#0f1115` · surface `#171a21` · brand `#5b9cf0`), 종이·먹·주홍·함렛·Mono 는 앱에서 제거(워드마크 SVG 만 유지). 히어로 재촬영. 설명서 반영.
- 검수: PowerShell `npm test` 200 passed · check 435 files 0 errors · lint OK · 7화면×3모드 스크린샷 · 콘솔 0.
- 다음: (1) main 커밋 → QA 세션에 해시 전달(1차 재검증) (2) product/commercial 에서 `git merge main` → `SITE_ENABLED = true` 커밋 → test/check → QA 2차 (3) push 는 지시 시(brain §1 계정 전환) (4) Vercel 배포는 product 브랜치 (5) 보류: QA 14번 증감 색 의미 · `excel/io.ts` `wb.creator` 제품명 · 라이트 `btn-primary` 대비 4.46:1(기존값) · 디자인 캔버스 아트보드는 9/14 이력.
- (이어서 2026-09-16) QA 세션 2차 신규 2건 + 14번 + 다크 입력칸 → 508280c. QA 1차(main)·2차(product) 전 항목 PASS(20/20 + 신규 2). CLAUDE.md 낡은 문구 정리 9e44274. `npm run build`(adapter-vercel) 통과.
- **잔여(결정·취향)**: 엑셀 `wb.creator` 제품명 · 라이트 기본 버튼 대비 4.46:1 · favicon.ico · 가이드 "쓰는 법" 섹션(QA 10) · 리포트 보조 함수 코어 이동 · 디자인 캔버스는 9/14 룩 이력. **배포 후 확인**: Vercel 에서 pdf.js worker·폰트·인쇄. **자사 결산서로 전 흐름** 1회.
- **다음 세션 시작점**: 1) 위 잔여 중 사용자가 고른 것 2) 자사 결산서 실전 확인 3) Vercel 배포(product) 4) 가이드 "쓰는 법" 섹션

### 2026-09-16 — 세션 13 (main): 공개판 겉면 정리

- 사용자 질문 "상용화 버전 더 개선할 것?" → 점검 결과 앱 기능은 갖춰졌고 **공개 웹 제품의 겉면**이 빠져 있었다 → "쭉 진행" 지시로 main 에서 작업(코어 무변경), 서브에이전트 5개(sonnet 3 · opus 2), Fable 은 총괄·검수·문서.
- 구현: README 재작성 · 소개 푸터 `문제 신고` · `wb.creator = PRODUCT_NAME` / 공유 메타(og·twitter·canonical, `+layout.svelte`) + `/intro` SSR · `+error.svelte` · 첫 방문 `/`→`/intro`(`hadStoredData`, `?start=app`) · 헤더 `백업 권장 →` / `/guide/manual`(user-guide.md 렌더, `src/lib/guide/` 슬러그·링크 변환 테스트 16건, `static/samples/`) + `/guide` 탭 / Pretendard 자체 호스팅(`pretendard` npm, woff2 92개) · `--accent` 4.66:1 / favicon 404 정리. 상세는 decision-log 2026-09-16.
- **프로덕션 실측**: hcroi-simulator.vercel.app 은 **main 빌드**(제목 "HCROI 대시보드") — pdf.js worker·PDF 카드·엑셀 다운로드 정상. 공개판 배포는 Vercel Production Branch 변경 필요(사용자).
- 문서: user-guide(§0·§5·§6·§10·§11) · brain §12 겉면 규칙 · decision-log · requirements-coverage §3-B · CLAUDE.md.
- 검증: test 222 · check 445 files 0 · lint OK · build OK · `npm run qa` sweep/items/baseline/branch PASS, dark 는 favicon 404 한 건 → 정리 후 재실행(아래).
- **사용자 결정 대기**: (1) LICENSE 파일(README 에 절 없음, 소개 푸터 "소스 코드" 링크는 유지) (2) 사용량 파악(Vercel Analytics 등) 쓸지 (3) Vercel Production Branch → `product/commercial`.
- **다음**: product/commercial 에 `git merge main` → test/check/`npm run qa:site` → 커밋·push 는 지시 시.
- **QA 세션(hcroi-simulator-46) 재검증 완료**: 제품 결함 0건. main 변형(qa 전 항목 + 항목 1·2·3·6) PASS, 공개판 변형(`SITE_ENABLED=true` 임시, 되튕김 정밀 5/5·SSR og·390·다크) PASS. 실패 2건은 스크립트 결함 → sonnet 이 보정: `site.mjs` 진입 `/?start=app` + "첫 방문 `/`→`/intro`" 항목 신설(12/12), `sweep.mjs` 모바일 폭은 overflow 래퍼(cue) 있으면 통과(`W=390` 38/38). `site-config.ts` 2행은 false 로 복구 확인.
- (이어서) 사용자 평 "가이드가 어렵다" → `docs/user-guide.md` 전면 재작성(인사담당자 말, H2 12·백틱 0, opus) · `/guide` 산식 탭 쉬운 말 우선(sonnet) · 소개 h2 `break-keep` + 문구 단축("방법은 셋, 결과는 하나" · "귀사 데이터는 귀사 PC 안에만"). decision-log 2026-09-16 둘째 항목.

### 2026-09-17 — 세션 14 (main): 동종업계 비교 C안 구현

- 시작: 남은 할 일 점검(코드·문서 잔여 없음, 사용자 몫만: Vercel Production Branch · LICENSE · 도메인 · 담당자 허락 문서). 미추적 `.agents/skills/patch-notes/` 는 Codex 플러그인이 만든 깨진 사본("claude"→"Codex" 치환) — 커밋 금지, 삭제는 지시 대기.
- 사용자 질문(시장에 비슷한 것 있나 · DART Open API 가 더 정확한가) 조사 → decision-log 2026-09-17. 결론: 자사는 PDF 유지, 동종업계는 C안 착수, API 는 동종업계 자동 채우기 후보. 사용자 "그렇게 진행하자".
- 계획서 `docs/plans/peer-comparison.md` 작성 → 1단계(opus): `types.ts` `PeerCompany` · `defaults.ts` `samplePeers()` · `peers.ts`(comparePeers·peerPeriods, 13 tests) · workspace `peers` 상태/저장/이행/편집 API · 엑셀 `동종업계` 시트(schema·toRows·fromRows `parsePeerRows`·`mergePeers`·io, 13 tests). 248 tests.
- 2단계(opus): `/peers` 화면(비교 표·HCROI 가로 막대·회사 카드 편집) · 헤더 탭 7개 · `/data` 가져오기 미리보기 동종업계 카드(체크박스·병합 수·오류 행) · 문서(spec §2·§7·§8, user-guide 새 §8 + 번호 밀기, coverage, CLAUDE.md).
- 검수 수정 2건: 동종업계 시트만 있는 파일도 반영 가능 · 범례 "자사 (자사)" 중복.
- Fable 검수: 248 tests · check 0 · lint OK · `peers.ts`·`parsePeerRows`·`mergePeers`·`normalizePeer` 직접 읽어 이상 없음. **Codex 리뷰는 사용량 한도로 실패**(task-mu4x98iz-rsn9aq, 2026-09-17 14:40 이후 재시도 가능) — 재시도 필요.
- QA 세션(hcroi-simulator-d8)에 13개 항목 검증 지시 발송(결과 대기).
- Codex 는 토큰 소진(사용자 확인) → **Claude `/code-review medium` 로 대체**(탐색 8관점). 결과를 아래 수정 목록으로 확정. 사용자 지시로 여기서 중단(2시간 뒤 재개).
- **다음 세션 시작점 — 리뷰 수정 목록(opus 서브에이전트 1회에 위임, 이후 test/check/lint + 스크린샷)**
  - 버그(높음)
    1. `excel/io.ts` `readWorkbook` 폴백 `wb.worksheets[0]` 이 `동종업계` 시트를 자사 입력 시트로 읽음(머리글이 필수 열을 다 만족) → 폴백은 `SHEET` 의 다른 이름(동종업계·조직 정보·지표 요약·시나리오 비교·산식·가정)이 아닌 첫 시트만, 없으면 `null`(입력 시트 없음 = 행 0 으로 취급, 오류 아님).
    2. `/data` `canApply`: 입력 데이터 **머리글 오류는 다시 차단**(옛 규칙 복원). 단 입력 시트가 아예 없거나 비어 있으면 오류 없이 "행 없음". 동종업계 오류 행은 **체크가 켜진 경우만** `errorRowCount` 에 포함(끄면 반영 가능). 미리보기 머리글의 "정상 N행 · 오류 M행" 도 같은 값으로.
    3. `workspace.svelte.ts` 이행: `Persisted.peers` 가 **없는** 옛 JSON 백업·되돌리기 스냅샷을 적용하면 현재 동종업계가 `[]` 로 지워짐 → `Migrated.peers: PeerCompany[] | null`, `applyMigrated` 는 null 이면 현재 목록 유지 + `ImportResult.warning` "이 백업에는 동종업계가 없어 현재 목록을 유지했습니다". `load()` 는 null → `[]`.
    4. `/peers` 연도 칸 `oninput` 이 중간값(2→20→202)을 저장 → `patchRow` 에서 `isValidYear`/`isValidPeriod` 통과할 때만 반영(연도·기간 셀은 `onchange`), 같은 기간 충돌 시 입력값을 되돌려 화면과 상태 불일치 제거.
  - 문구(중간) 5. 반영 메시지: 입력 시트 행이 전부 오류로 건너뛴 경우와 "행 없음" 구분("입력 데이터 오류 N행은 반영하지 않았습니다" / "입력 데이터 시트에 행이 없어 동종업계만 반영했습니다"). 동종업계 머리글 오류로 건너뛴 경우 "동종업계 시트는 머리글 오류로 반영하지 않았습니다" 를 메시지에 포함.
  - 성능(중간) 6. `peerPeriods`·`comparePeers` 가 호출마다 회사별 `rollup`+`validateRecord` 를 2회 → 워크스페이스에 `peerEffective = $derived(peers.map(p => ({...p, effective: rollup(p.records, basis)})))` 하나를 두고 코어 함수는 **합산 끝난 목록**을 받게 시그니처 변경(자사는 `workspace.effective`). `peers.test.ts` 갱신. `patchRow` 의 `$state.snapshot` 두 번 → 한 번, `updatePeerRecord` 는 기간이 바뀔 때만 재정렬.
  - 정리(낮음) 7. `replacePeers(companies, mode)` → `replacePeers(companies)` 로 최종 목록만 대입(`replaceRecords` 와 같은 모양). `/data` 는 이미 계산한 `peerMerge.result` 를 넘겨 병합 두 번 실행 제거. workspace 의 `excel/fromRows` import 제거. 8. `fromRows.ts` `newRowId()` 복제 제거 → `ParseOptions.newId?: () => string`(`MergeOptions.newId` 와 같은 주입 방식), 페이지가 workspace `newId` 전달. `mergePeers` 는 깊은 복사 없이 유지 회사는 참조 재사용. 9. `schema.ts`: `DataColumn<K>` 하나로 `InputColumn`·`PeerColumn` 통일, `PEER_COLUMNS` 는 `INPUT_COLUMNS` 에서 골라 만들기(회사명 열만 신규), `PEER_HEADER_ROW` 등 별칭 삭제(`INPUT_*` 직접 사용 또는 `DATA_*` 로 한 번 개명). `addColumnValidations`·`dataNumFmt`·`mapHeaderWith`·`headerText` 가 그 타입을 받게. `addPeerSheet` 의 안 쓰는 `return ws` 제거. 10. `toRows.ts` 의 `PeerRow` → `PeerInputRow` 로 개명(`peers.ts` `PeerRow` 와 충돌). 회사 이름 정렬 `localeCompare('ko')` 4곳 → `peers.ts` 의 `sortPeersByName` 하나. 11. `/peers` 비교 표의 자사 행·상대 행 마크업 중복(~40줄) → `{#each [c.self, ...c.peers]}` + `isSelf` 분기 또는 snippet. `$lib/hcroi/peers` 중복 import 정리. `parsePeerRows` 의 이중 `if (messages.length === 0)` 를 `parseInputRows` 모양으로 평탄화. 12. 선택: 기간 선택 UI(`/data` 기간 추가 · `/peers` 행/추가 폼)를 `components/ui/PeriodPicker.svelte` 로 추출, `/data` 동종업계 오류 표를 입력 미리보기 오류 행과 같은 컴포넌트로. `excel.test.ts` 의 `peerHeader/pcol/prow/peerSheet` 헬퍼를 `sheetHelpers(columns)` 로 매개변수화.
  - QA(hcroi-simulator-d8) 결과: **13/13 PASS, 막는 버그 0**, `npm run qa` 전부 통과. 작은 개선 4건(같은 위임에 포함): 13. `/data` 동종업계 머리글 오류 시 체크박스가 비활성이어도 체크된 모양 → 오류면 체크를 끄고 비활성(또는 숨김). 14. 설정 "이 PC 의 데이터 지우기" 확인창의 지워지는 목록에 "동종업계 회사" 추가(`settings/+page.svelte` `clearThisPc`). 15. `/peers` 범례의 "업계 평균" 점선 견본 색이 `border-line-2` 라 라이트에서 안 보임 → 차트 선과 같은 `ink-2`. 16. 평균 점선이 값이 비슷한 막대 라벨(1.25·1.26배) 글자를 가로지름 → 라벨을 선 뒤로 두거나 라벨 배경/오프셋.
    QA 산출물: `…\Temp\claude\c--Users-user-Desktop-hcroi-simulatord4d37ac-b8fe-4828-9024-90b9ea07a14b\scratchpad\out\` (재현 `qa1.mjs` 화면 · `qa2.mjs` 엑셀).
    환경: QA 가 소문자 경로로 띄운 dev 서버(PID 58308, 127.0.0.1:5173)는 Pretendard 404 를 내지만 앱 버그 아님 — 재개 시 종료. [::1]:5173(PID 35328) 도 남아 있음.
  - **2026-09-17 오후 재개 — 1~16번 처리 완료(opus)**: 12번은 테스트 헬퍼 통일만 하고 `PeriodPicker` 추출·오류 표 컴포넌트 공용화는 미실시(선택, 이득 작음). 시그니처 변경: `peerPeriods(selfEffective, peers: PeerEffective[])`·`comparePeers(selfEffective, peers, period)`, workspace `peerEffective` derived, `replacePeers(companies)`, `ParseOptions.newId`, `DataColumn<K>`·`DATA_*_ROW`, `PeerInputRow`, `sortPeersByName`. Fable 검증: 250 tests · check 0 · lint OK · 스크린샷(`fix-*.png`) · 식별자 스캔 이상 없음. QA 세션이 띄운 소문자 경로 dev 서버(PID 58308) 종료, `[::1]:5173`(PID 35328) 유지.
  - 그 뒤: 커밋(지시 시) → product/commercial 에 `git merge main` → 패치노트(`/patch-notes`, 지시 시).
- 남긴 것: workspace 이행 테스트(`.svelte.ts` 테스트 환경 없음) · 리포트/대시보드 미반영.
- **공개판 배포 계획(세션 14 후반)**: 사용자 요청 "공개판은 지금 Vercel 이 아닌 별도 배포 + 구글 검색 + 방문자 측정 + 광고 가능성" → `docs/plans/public-deploy.md` 초안. 요지: Cloudflare Pages(무료·상업 허용 — Vercel Hobby 는 광고 불가) · 색인은 소개/가이드/설명서 프리렌더 3장만, 앱 화면 noindex · 사내판 robots 전면 차단(현재 전부 허용 = 버그) · 쿠키 없는 분석(Cloudflare WA, 이벤트는 Umami) + `/privacy` · 광고는 월 1,000명 3개월 조건부 보류. 코드 변경 11건 표(§8), 결정 7건(§11) 대기.
- **사용자 결정(같은 세션)**: 추천안대로 진행(Cloudflare Pages · canonical `/`→`/intro` · 쿠키 없는 분석 · 광고 보류) + **문의는 개인 Gmail**(저장소 미기재, `PUBLIC_CONTACT_EMAIL` 환경변수) + **후원(커피 한 잔) 링크 오픈**(`PUBLIC_DONATE_URL`, 주소 미정). brain §12 · decision-log 2026-09-17 · 계획서 §11 갱신. 이메일 실값은 Claude 메모리에만.
- **M1–M3 구현 완료(opus 위임, main)**: `vite.config.ts` 어댑터 분기(`HCROI_ADAPTER`, adapter-cloudflare 7.2.9 devDep — lockfile 에 workerd 바이너리 항목 다수 추가) · `/intro`(prerender=SITE_ENABLED)·`/guide`·`/guide/manual`·`/privacy` 프리렌더 · `src/lib/site/env.ts`(`$env/dynamic/public` 유일 지점, `INDEXABLE = SITE_ENABLED && PUBLIC_SITE_ORIGIN`) · `src/lib/site/analytics.ts` `track(name)` + 호출 5곳(intro CTA 2 · data 반영 · report 인쇄) · 레이아웃 `<title>` 통일(8개 페이지의 `<title>` 제거, `SECTIONS` 표) + noindex/canonical/페이지별 description/JSON-LD/소유확인 메타/분석 스크립트 · `robots.txt`·`sitemap.xml` 서버 라우트(`static/robots.txt` 삭제; 사내판·프리뷰는 `Disallow: /`) · `/privacy` 페이지 · 푸터(소개·앱) 개인정보·문의·후원 링크 · 소개 "서버로 보내는 것" 문구 정정 · `.env.example` · 문서(spec §7, coverage, user-guide 2줄, README 1줄).
  Fable 검증: 250 tests · check 0/0 · lint OK · 기본 빌드 + Cloudflare 빌드(`.svelte-kit/cloudflare`, robots `Disallow: /`) 통과. 식별자 스캔 0. **Codex 리뷰 2건 반영(sonnet)**: ① Umami 가 페이지 제목(회사명 포함)을 보내던 것 → `app.html` `hcroiAnalyticsBeforeSend` 로 제목 제거(`data-before-send`; Cloudflare 비컨은 제목을 안 보냄 — 문서 기준, 배포 후 네트워크 탭 확인) ② 정식 주소 없는 빌드에서 canonical·og:image 가 `sveltekit-prerender` 로 구워지던 것 → `building` 이면 origin 의존 태그 생략. 재검증 250 tests · check 0 · lint · 빌드 OK.
  미실시: `static/og.jpg` 1200×630(별도) · `/settings` 문의 링크(푸터만). **커밋·product 머지는 지시 대기.** 배포 후 확인 목록은 계획서 §2.4·서브에이전트 보고(5).
