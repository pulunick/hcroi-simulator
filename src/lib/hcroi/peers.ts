import { computeMetrics, validateRecord } from './formulas';
import { comparePeriods, periodKey, samePeriod } from './period';
import type { Metrics, Period, PeriodRecord } from './types';

/**
 * 동종업계 비교 — 순수 함수 (docs/plans/peer-comparison.md §2).
 *
 * 새 수식은 **평균 · 중앙값 · 순위** 뿐이다. 지표 자체는 언제나 코어 `computeMetrics` 가 낸다.
 * - 업계 평균 = 각 사 지표의 **단순 평균**(합산 후 나누기가 아니다) — 규모가 큰 회사에 끌리지 않게 하고 중앙값을 병기한다.
 * - 대상은 그 기간에 **검증 통과 레코드**가 있는 상대 회사만(`validateRecord`). 자사는 평균·중앙값에 넣지 않는다.
 * - 기간은 자사·상대 모두 **합산까지 끝난 목록**(`rollup` 결과)에서 `samePeriod` 로 찾는다 —
 *   상대가 분기만 넣어도 연간으로 비교된다. 기간 길이가 섞이지 않도록 **한 기간만** 비교한다.
 *
 * 합산(`rollup`)은 이 파일이 하지 않는다 — 회사마다 한 번만 하도록 부르는 쪽(작업공간의 `peerEffective`)이
 * 미리 만들어 넘긴다. 검증(`validateRecord`)만 여기서 한다.
 */

export const PEER_METRIC_KEYS = [
	'hcroi',
	'hcva',
	'revenuePerHead',
	'hcCostPerHead',
	'hcCostToRevenue',
	'operatingMargin'
] as const;

export type PeerMetricKey = (typeof PEER_METRIC_KEYS)[number];

/** 화면 표기 — 단위는 표의 열 머리글에서 붙인다(format.ts) */
export const PEER_METRIC_LABELS: Record<PeerMetricKey, string> = {
	hcroi: 'HCROI',
	hcva: 'HCVA',
	revenuePerHead: '인당 매출액',
	hcCostPerHead: '인당 인건비',
	hcCostToRevenue: '인건비율',
	operatingMargin: '영업이익률'
};

/**
 * 낮을수록 좋은 지표 — 매출 대비 인건비율뿐이다(순위를 거꾸로 매긴다).
 * 인당 인건비는 낮다고 좋은 것이 아니라(인력 구성·임금 수준의 결과) 높을수록 좋음으로 둔다.
 */
export const PEER_METRIC_LOWER_IS_BETTER: Record<PeerMetricKey, boolean> = {
	hcroi: false,
	hcva: false,
	revenuePerHead: false,
	hcCostPerHead: false,
	hcCostToRevenue: true,
	operatingMargin: false
};

/** 비교 표의 자사 행 id — 상대 회사 id 와 겹치지 않도록 고정값을 쓴다 */
export const SELF_ROW_ID = 'self';
/** 자사 행의 기본 이름 (화면이 회사/조직 이름으로 바꿔 보여 줄 수 있다) */
export const SELF_ROW_NAME = '자사';

/** 비교 표 한 행 = 회사 하나. 그 기간 레코드가 없으면 `record`·`metrics` 가 null */
export interface PeerRow {
	id: string;
	name: string;
	/** 그 기간 레코드 (합산 포함). 검증 오류가 있어도 담는다 — 화면이 "오류" 로 표시할 수 있게 */
	record: PeriodRecord | null;
	/** 검증을 통과한 레코드의 지표. 레코드가 없거나 오류면 null */
	metrics: Metrics | null;
	isSelf: boolean;
}

export interface PeerStat {
	mean: number | null;
	median: number | null;
	/** 이 지표를 낸 상대 회사 수 (자사 제외) */
	count: number;
}

export interface PeerRank {
	/** 1 = 가장 좋음 (동점은 같은 순위) */
	rank: number;
	/** 순위를 매긴 회사 수 (자사 포함) */
	of: number;
}

export interface PeerComparison {
	period: Period;
	/** 자사 */
	self: PeerRow;
	/** 상대 회사 — 이름 순 */
	peers: PeerRow[];
	/** 자사 제외 · 검증 통과 레코드만으로 낸 업계 평균·중앙값 */
	stats: Record<PeerMetricKey, PeerStat>;
	/** 자사 포함 순위. 자사 지표가 없거나 상대가 0곳이면 null */
	rank: Record<PeerMetricKey, PeerRank | null>;
}

/**
 * 한 상대 회사 — **합산까지 끝난** 기간 목록을 들고 온다.
 * 작업공간이 `rollup` 을 회사마다 한 번만 돌려 만들고(`peerEffective`), 이 파일은 그 결과만 읽는다.
 */
export interface PeerEffective {
	id: string;
	name: string;
	/** `rollup(company.records, basis)` 결과 — 직접 입력 기간 + 합산 기간 */
	effective: PeriodRecord[];
}

/** 회사 이름 순(ko) — 표·차트·엑셀·가져오기가 모두 이 한 곳을 쓴다 */
export function sortPeersByName<T extends { name: string }>(list: readonly T[]): T[] {
	return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/** 검증을 통과한 레코드만 */
function usableRecords(effective: PeriodRecord[]): PeriodRecord[] {
	return effective.filter((r) => validateRecord(r).length === 0);
}

/**
 * 비교할 수 있는 기간 — 자사 또는 상대 중 **한 곳이라도** 검증 통과 레코드를 가진 기간 (시간순, 중복 제거).
 * 합산으로만 존재하는 기간(분기 4개 → 연간)도 포함된다.
 */
export function peerPeriods(selfEffective: PeriodRecord[], peers: PeerEffective[]): Period[] {
	const found = new Map<string, Period>();
	const add = (records: PeriodRecord[]) => {
		for (const r of usableRecords(records)) found.set(periodKey(r.period), r.period);
	};
	add(selfEffective);
	for (const p of peers) add(p.effective);
	return [...found.values()].sort(comparePeriods);
}

/** 한 회사의 그 기간 행 (합산까지 끝난 목록에서 찾는다) */
function rowOf(
	id: string,
	name: string,
	effective: PeriodRecord[],
	period: Period,
	isSelf: boolean
): PeerRow {
	const record = effective.find((r) => samePeriod(r.period, period)) ?? null;
	const ok = record !== null && validateRecord(record).length === 0;
	return { id, name, record, metrics: ok ? computeMetrics(record.inputs) : null, isSelf };
}

function mean(values: number[]): number | null {
	return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

/** 짝수 개면 가운데 두 값의 평균 */
function median(values: number[]): number | null {
	if (!values.length) return null;
	const s = [...values].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * 한 기간의 자사 ↔ 동종업계 비교.
 * `selfEffective` 는 자사의 합산 포함 목록(`workspace.effective`), `peers` 는 상대 회사의 같은 목록.
 */
export function comparePeers(
	selfEffective: PeriodRecord[],
	peers: PeerEffective[],
	period: Period
): PeerComparison {
	const selfRow = rowOf(SELF_ROW_ID, SELF_ROW_NAME, selfEffective, period, true);
	const peerRows = sortPeersByName(peers).map((p) =>
		rowOf(p.id, p.name, p.effective, period, false)
	);

	const stats = {} as Record<PeerMetricKey, PeerStat>;
	const rank = {} as Record<PeerMetricKey, PeerRank | null>;
	for (const key of PEER_METRIC_KEYS) {
		// 자사 제외 · 검증 통과 · 그 지표가 null 이 아닌 값만
		const peerValues = peerRows
			.map((r) => r.metrics?.[key] ?? null)
			.filter((v): v is number => v !== null && Number.isFinite(v));
		stats[key] = { mean: mean(peerValues), median: median(peerValues), count: peerValues.length };

		const own = selfRow.metrics?.[key] ?? null;
		if (own === null || !Number.isFinite(own) || peerValues.length === 0) {
			rank[key] = null;
			continue;
		}
		const better = PEER_METRIC_LOWER_IS_BETTER[key]
			? (v: number) => v < own
			: (v: number) => v > own;
		rank[key] = { rank: 1 + peerValues.filter(better).length, of: peerValues.length + 1 };
	}

	return { period, self: selfRow, peers: peerRows, stats, rank };
}
