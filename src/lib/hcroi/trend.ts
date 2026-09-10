import { comparePeriods } from './period';
import type { PeriodRecord, PeriodType } from './types';

/**
 * 추이(차트·표·인사이트)에 올릴 기간 시리즈 — 순수 함수.
 *
 * 규칙 (spec §2 "추이 다개년 표시", 2026-09-10):
 * - 추이는 여전히 **한 유형**이 본체다. 분기 추이에 연간 금액을 섞어 비교하지 않는다.
 * - 다만 반기·분기·월 추이에서 **그 유형 자료가 하나도 없는 해**에 연간 레코드(직접 입력 또는 합산)가 있으면
 *   그 해는 연간 값을 **참조점**(`reference: true`)으로 같은 시간축에 올린다. 몇 해치 자료가 연간으로만 있을 때
 *   추이가 최근 한 해만 보이는 문제를 막기 위해서다. 참조점은 비율 지표(HCROI)와 표에만 쓰고,
 *   금액 누적 막대·추이 인사이트는 본체 유형만 쓴다(기간 길이가 달라 금액 비교가 안 된다).
 * - 어떤 해에 본체 유형 레코드가 하나라도 있으면(분기 2개만 있어도) 그 해는 참조하지 않는다 — 연간을 분기로 쪼개 추정하지 않는다.
 * - **표시 범위**는 "최근 N년"(마지막 해 기준, 달력 연도) 또는 전체. 기본은 유형별로 다르다(월 2년 · 분기 3년 · 반기 5년 · 연간 전체).
 */

export type TrendRange = 2 | 3 | 5 | 'all';

export const TREND_RANGES: readonly { value: TrendRange; label: string }[] = [
	{ value: 2, label: '최근 2년' },
	{ value: 3, label: '최근 3년' },
	{ value: 5, label: '최근 5년' },
	{ value: 'all', label: '전체' }
];

/** 유형별 기본 표시 범위 — 점이 너무 많아지지 않는 선 (월 24개 · 분기 12개 · 반기 10개) */
export function defaultTrendRange(type: PeriodType): TrendRange {
	switch (type) {
		case 'M':
			return 2;
		case 'Q':
			return 3;
		case 'H':
			return 5;
		default:
			return 'all';
	}
}

export interface TrendPoint {
	record: PeriodRecord;
	/** true 면 본체 유형 자료가 없는 해를 대신하는 연간 값 */
	reference: boolean;
}

export function trendSeries(
	effective: PeriodRecord[],
	type: PeriodType,
	range: TrendRange = defaultTrendRange(type)
): TrendPoint[] {
	const own = effective.filter((r) => r.period.type === type);
	const points: TrendPoint[] = own.map((record) => ({ record, reference: false }));
	if (type !== 'Y') {
		const ownYears = new Set(own.map((r) => r.period.year));
		for (const r of effective) {
			if (r.period.type === 'Y' && !ownYears.has(r.period.year)) {
				points.push({ record: r, reference: true });
			}
		}
	}
	points.sort((a, b) => comparePeriods(a.record.period, b.record.period));
	if (range === 'all' || points.length === 0) return points;
	const lastYear = points[points.length - 1].record.period.year;
	const minYear = lastYear - range + 1;
	return points.filter((p) => p.record.period.year >= minYear);
}

/** 참조점으로 들어간 연도 목록 (캡션용, 오름차순) */
export function referenceYears(points: TrendPoint[]): number[] {
	return points.filter((p) => p.reference).map((p) => p.record.period.year);
}
