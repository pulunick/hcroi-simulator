# 동종업계 비교 (C안: 수기 입력 → 엑셀 시트) — 기획설계

> 작성 2026-09-17. 상태: **구현 완료(2026-09-17)** — spec §2·§7·§8 · user-guide §8 · requirements-coverage 로 흡수했다. 이 문서는 설계 기록으로 남긴다.
> 배경: 2026-09-08 결정 "동종업계 비교는 엑셀 수기 입력(8개사)으로 시작, 반복이 확정되면 DART Open API". 2026-09-17 사용자 확인으로 착수.
> DART Open API 는 **자사 입력 대체가 아니다**(2026-09-17 조사: 재무제표 API 에 인건비 주석이 없고, 직원현황 API 의 연간급여총액은 급여만이라 spec 의 인건비 정의와 다르며, 공시 법인만 있다). 자사는 PDF 경로 유지, API 는 동종업계 자동 채우기 후보로만 남긴다(§7).

## 0. 한 줄 요약

상대 회사(동종업계)의 기간별 4개 값(매출액 · 영업비용/영업이익 · 총 인건비 · 총 임직원 수)을 화면 또는 엑셀 `동종업계` 시트로 넣으면, 같은 기간의 자사 지표를 각 사·업계 평균·중앙값과 나란히 보여 준다. 계산은 기존 코어 함수 그대로, 새 수식은 **평균·중앙값·순위** 뿐이다.

## 1. 데이터 모델 (`src/lib/hcroi/types.ts`)

```ts
/** 동종업계 회사 하나. records 는 자사와 같은 기간 레코드(세부 내역은 대개 null) */
export interface PeerCompany {
	id: string;
	name: string; // 회사명 (필수, 40자, 작업공간 안에서 유일)
	memo?: string; // 예: "코스닥 · 의료 AI"
	records: PeriodRecord[]; // 직접 입력한 기간만. 상위 기간은 rollup 이 읽을 때 합산
}
```

- `PeriodRecord` 를 그대로 재사용한다 → `validateRecord`·`computeMetrics`·`rollup`·`period.ts` 가 변경 없이 동작한다.
- 인원 산정 기준은 작업공간 것(`headcountBasis`)을 합산 규칙에만 쓴다. 상대 회사의 인원은 공시 "직원 등 현황" 합계를 그대로 넣는 전제(세부 구분 입력 없음).
- 저장: `workspace.peers: PeerCompany[]`(localStorage `Persisted.peers`, JSON 백업 포함). `wipeAll()`·`startFresh()` 는 비운다. `resetToSample()` 은 가상 회사 3곳(`defaults.ts` `samplePeers()`, 회사명 "가상 A사·B사·C사", 2024·2025 연간)을 넣는다. 옛 저장값에 `peers` 가 없으면 빈 배열.

## 2. 비교 계산 (`src/lib/hcroi/peers.ts`, 순수 함수 + `peers.test.ts`)

```ts
export const PEER_METRIC_KEYS = [
	'hcroi',
	'hcva',
	'revenuePerHead',
	'hcCostPerHead',
	'hcCostToRevenue',
	'operatingMargin'
] as const;

export interface PeerRow {
	id: string;
	name: string;
	record: PeriodRecord | null;
	metrics: Metrics | null;
	isSelf: boolean;
}
export interface PeerStat {
	mean: number | null;
	median: number | null;
	count: number;
}
export interface PeerComparison {
	period: Period;
	self: PeerRow; // 자사 (record 없으면 metrics null)
	peers: PeerRow[]; // 이름 순
	stats: Record<PeerMetricKey, PeerStat>; // 자사 제외, 유효 레코드만
	rank: Record<PeerMetricKey, { rank: number; of: number } | null>; // 자사 포함 순위 (1 = 가장 좋음)
}
/** 합산(rollup)까지 끝난 상대 회사 하나 — 작업공간의 `peerEffective` 가 만든다 */
export interface PeerEffective {
	id: string;
	name: string;
	effective: PeriodRecord[];
}
export function comparePeers(
	selfEffective: PeriodRecord[],
	peers: PeerEffective[],
	period: Period
): PeerComparison;
export function peerPeriods(selfEffective: PeriodRecord[], peers: PeerEffective[]): Period[]; // 비교 가능한 기간(자사 또는 상대 중 하나라도 있는 기간, 정렬)
/** 회사 이름 순(ko) — 비교 표·엑셀 내보내기·가져오기가 모두 이 하나를 쓴다 */
export function sortPeersByName<T extends { name: string }>(list: readonly T[]): T[];
```

규칙(spec §2 에 추가):

- **업계 평균 = 각 사 지표의 단순 평균**(합산 후 나누기가 아님). 규모가 큰 회사에 끌리지 않게 하고, 중앙값을 병기한다. 대상은 그 기간에 **검증 통과 레코드**가 있는 상대 회사만(`validateRecord` 오류·해당 기간 없음은 제외, 개수 `count` 표시). 자사는 평균에 넣지 않는다.
- 지표 6개: HCROI · HCVA · 인당 매출 · 인당 인건비 · 인건비율(매출 대비) · 영업이익률. 인건비율은 낮을수록 좋음으로 순위를 매긴다. 나머지는 높을수록 좋음.
- 순위는 자사 포함 유효 회사 중 순위(동점은 같은 순위). 상대가 0곳이면 `null`.
- 기간은 자사와 상대의 `rollup` 결과(합산 포함)에서 `samePeriod` 로 찾는다. **합산은 코어 밖에서** 회사마다 한 번만 한다 —
  작업공간이 `peerEffective = peers.map(p => ({id, name, effective: rollup(p.records, basis)}))` 를 `$derived` 로 들고 있고, 화면은 그것을 넘긴다(검증은 코어 안에서). 반기·분기도 같은 방식이라 기간 유형 제한은 없다. 기간 길이가 달라 섞이지 않게 **한 기간만** 비교한다(추이 비교는 이번 범위 밖).

## 3. 화면 `/peers` (탭 "동종업계", `/data` 와 `/report` 사이)

1. **기간 선택** — `peerPeriods` 목록에서 셀렉트(기본: 자사 최신 기간). 기간이 하나도 없으면 빈 상태 안내("상대 회사를 추가하거나 엑셀 동종업계 시트로 넣으세요").
2. **비교 표** — 행: 자사(강조) · 각 사(이름 순) · **업계 평균** · **중앙값**. 열: 매출액 · 영업이익 · 총 인건비 · 총 임직원 수(입력값) + 지표 6개. 금액은 `formatCellAmount`·열 머리글 `columnUnitSuffix`(작업공간 단위). HCROI 는 `GradeBadge`. 자사 행 아래 "평균 대비 ±" 줄(`formatSigned`). 그 기간 값이 없는 회사는 "—" 와 "이 기간 없음".
3. **HCROI 막대** — 회사별 가로 막대 1개 패널(기존 `BarPanel` 재사용 가능하면 재사용, 아니면 인라인 SVG). 자사 = series-1, 상대 = 중립 회색, 평균 = 점선 세로 기준선 + 직접 라벨. 이중축 금지. 범례 + 직접 라벨 + 표 병행(표는 2번).
4. **회사 목록 편집** — 회사 카드(이름·메모·기간 수) 추가/이름 변경/삭제(확인). 카드 펼치면 기간 표: 연도 · 기간(셀렉트) · 매출액 · 영업이익 · 총 인건비 · 총 임직원 수 · 메모, 행 추가/삭제. 영업이익으로 입력받아 `operatingCostFromProfit` 로 영업비용을 저장한다(자사 데이터 화면과 같은 규칙). 금액 힌트 단위는 `hintAmountUnit`. 검증은 `validateRecord` 로 행 옆에 오류 표시. 같은 회사 안에서 같은 기간 중복 금지.
5. 순위·평균 개수("8곳 중 3위 · 평균은 7곳 기준")를 표 위 한 줄로.
6. 모바일(390px): 표는 `overflow-x: auto`, 카드는 세로.

문구는 인사담당자 말로(개발 용어 금지). 대시보드·시뮬레이터·리포트는 이번에 손대지 않는다(리포트 동종업계 절은 §7).

## 4. 엑셀 `동종업계` 시트 (`excel/schema.ts` `PEER_COLUMNS`, `SHEET.peers`)

| 열                        | 필수 | 비고                                                 |
| ------------------------- | ---- | ---------------------------------------------------- |
| 회사명                    | \*   | 같은 이름 행은 같은 회사. 40자                       |
| 연도                      | \*   | 입력 데이터 시트와 같음                              |
| 기간                      |      | 비우면 연간. 드롭다운 같음                           |
| 매출액(원)                | \*   | 단위는 `조직 정보` 금액 단위를 따른다                |
| 영업비용(인건비 포함)(원) |      | 영업이익과 둘 중 하나                                |
| 영업이익(원)              |      |                                                      |
| 총 임직원 수(명)          | \*   |                                                      |
| 총 인건비(원)             | \*   |                                                      |
| 메모                      |      | 회사 메모가 아니라 기간 메모. 회사 메모는 화면에서만 |

- 내보내기: 항상 포함(회사가 없으면 머리글 2행만). 템플릿(`withSample`)은 가상 회사 2곳 × 2행 예시. 시트 순서: 지표 요약 · 입력 데이터 · 시나리오 비교 · **동종업계** · 조직 정보 · 산식·가정.
- 가져오기: `parsePeerRows(rows, options)` — `parseInputRows` 와 같은 헤더 매핑·숫자·기간 텍스트·단위 배수·누계 규칙(회사별로 앞 순번을 뺀다). 결과 `{ companies: PeerCompany[], errors: RowError[] }`. 검증은 `validateRecord`.
- 병합 규칙: **회사명이 같은 회사는 시트 내용으로 통째 교체**, 시트에 없는 기존 회사는 유지. 미리보기에 "동종업계: 신규 N곳 · 교체 M곳 · 행 K개" 와 체크박스("동종업계 시트도 반영", 기본 켬). 시트가 없는 옛 파일은 동종업계를 건드리지 않는다. 오류 행이 있으면 입력 데이터와 같은 규칙(반영 차단 또는 "오류 행 건너뛰기").
- 검증 열(수식)·조건부 서식은 이번에 넣지 않는다(입력 데이터 시트에만). 드롭다운(기간)·셀 유효성(연도·숫자)은 넣는다.
- 되돌리기(`UNDO_KEY` 스냅샷)는 `exportJson` 전체를 쓰므로 자동으로 동종업계도 되돌린다.

## 4-A. 구현 메모 (계획과 달라진 것)

1. `parsePeerRows` 결과에 **`headerError`** 를 두었다(입력 데이터 시트와 같은 모양). 동종업계 시트 머리글이 양식과 다르면 그 문구를 미리보기에 보여 주고 "동종업계 시트도 반영" 체크박스를 잠근다.
2. 순위는 `PeerComparison.rank` 에 **지표별로** 담고, 자사 지표가 없거나 상대가 0곳인 지표는 `null` 이다(비교 전체가 아니라 지표 하나 단위로 빠진다).
3. `mergePeers` 는 이름이 같은 회사를 교체할 때 **기존 회사 id 를 유지한다** — 화면에서 펼쳐 둔 카드·편집 상태가 가져오기 뒤에도 풀리지 않는다.
4. `parsePeerRows` 는 회사·오류 행을 **이름 순 · 행 순**으로 정렬해 돌려준다(시트에 적힌 순서와 무관하게 미리보기가 안정적으로 보이도록).
5. 화면의 기간 행 편집은 금액을 **원 단위 그대로** 입력받고 칸 아래에 표시 단위(`hintAmountUnit`) 축약을 붙인다. 비교 표만 작업공간 표시 단위(`formatCellAmount`·`columnUnitSuffix`)를 쓴다.
6. (2026-09-17 리뷰 반영) 연도·기간 셀은 `oninput` 이 아니라 **`onchange`** 이고, `isValidYear`·`isValidPeriod` 를 통과하고
   같은 회사 안에서 기간이 겹치지 않을 때만 저장한다. 저장하지 못하면 입력 요소를 저장값으로 되돌린다(2 → 20 → 202 같은 중간값이 저장되지 않게).
   금액·인원·메모 칸은 `oninput` 그대로다.
7. (2026-09-17 리뷰 반영) 엑셀 `동종업계` 열 정의는 `입력 데이터` 열에서 골라 만들고(`DataColumn<K>` 하나로 통일), 행 구조 상수는 `DATA_HEADER_ROW`·`DATA_UNIT_ROW`·`DATA_FIRST_DATA_ROW` 를 공유한다.
   `parsePeerRows` 는 `ParseOptions.newId` 로 id 생성기를 주입받고(화면은 작업공간 `newId`), `workspace.replacePeers(companies)` 는 **최종 목록만** 받는다(병합은 화면이 `mergePeers` 로 한 번).

## 5. 테스트

- `peers.test.ts`: 평균·중앙값(짝수 개)·순위(동점·인건비율 역순)·유효 레코드만 집계·자사 없음·상대 0곳·합산 기간(분기 4개 → 연간)으로 비교.
- `excel.test.ts` 추가: 동종업계 행 변환·검증·단위 배수·누계·회사명 그룹핑·병합(교체/유지)·exceljs 왕복(시트 존재·순서·빈 시트).
- `workspace` 이행: `peers` 없는 옛 저장값 → 빈 배열, JSON 왕복.

## 6. 문서

- spec §2 표기 규칙에 "동종업계 평균" 절, §7 에 `/peers` 행, §8 에 `peers`·`동종업계` 시트.
- user-guide: 새 절 "동종업계와 비교하기"(§8 리포트 앞 또는 뒤, 절 구조 "하는 일 → 이렇게 하세요 → 알아 두세요"), §4 엑셀 절의 시트 목록·다시 읽는 시트 목록, §12 에서 "동종업계와 자동 비교" 항목을 "동종업계 값 자동 채우기(DART)" 로 바꿈.
- requirements-coverage 동종업계 행 ✅, CLAUDE.md 테스트 목록에 `peers`, decision-log · brain §11.

## 7. 다음 단계 (이번 범위 밖)

1. **결산서 PDF → 동종업계 회사로 바로 넣기** — `PdfImport` 카드에 대상(자사 / 동종업계 회사) 선택. 상대 8개사 사업보고서 PDF 를 같은 파이프라인으로. 코드 재사용이 커서 C안 다음에 바로 할 만하다.
2. 리포트 A4 에 "동종업계 대비" 한 줄(평균·순위). 1장 제약 안에서 배치 검토.
3. DART Open API 로 동종업계 회사 값 자동 채우기 — 매출·영업이익·직원수는 `fnlttSinglAcntAll`+`empSttus`, 인건비는 공시서류 원본(XML) 주석 파싱. Vercel 서버 라우트 1개 + 무료 키. 회사 데이터는 서버로 보내지 않는다.
4. 추이 비교(여러 기간의 자사 vs 평균 라인).
