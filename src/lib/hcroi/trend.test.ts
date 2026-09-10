import { describe, expect, it } from 'vitest';
import { defaultTrendRange, referenceYears, trendSeries } from './trend';
import type { Period, PeriodRecord } from './types';

const Y = (year: number): Period => ({ year, type: 'Y', index: 1 });
const H = (year: number, index: number): Period => ({ year, type: 'H', index });
const Q = (year: number, index: number): Period => ({ year, type: 'Q', index });
const M = (year: number, index: number): Period => ({ year, type: 'M', index });

function rec(period: Period, derived = false): PeriodRecord {
	const id = `${derived ? 'derived:' : ''}${period.year}-${period.type}${period.index}`;
	return {
		id,
		period,
		inputs: { revenue: 1000, operatingCost: 900, hcCost: 300, headcount: 10 },
		breakdown: null,
		headcountBreakdown: null,
		memo: '',
		...(derived ? { derived: { method: 'sum', from: 'Q', count: 4 } } : {})
	} as PeriodRecord;
}

const key = (p: { record: PeriodRecord; reference: boolean }) =>
	`${p.record.period.year}${p.record.period.type}${p.record.period.index}${p.reference ? '*' : ''}`;

// 샘플과 같은 구성: 연간 2023·2024 + 2025 분기 4개(+ 합산으로 생긴 2025 반기·연간)
const sampleLike = [
	rec(Y(2023)),
	rec(Y(2024)),
	rec(Q(2025, 1)),
	rec(Q(2025, 2)),
	rec(Q(2025, 3)),
	rec(Q(2025, 4)),
	rec(H(2025, 1), true),
	rec(H(2025, 2), true),
	rec(Y(2025), true)
];

describe('trendSeries — 한 유형 + 연간 참조점', () => {
	it('연간 추이는 연간만, 참조점 없음', () => {
		const s = trendSeries(sampleLike, 'Y', 'all');
		expect(s.map(key)).toEqual(['2023Y1', '2024Y1', '2025Y1']);
		expect(referenceYears(s)).toEqual([]);
	});

	it('분기 추이: 분기가 없는 해는 연간 값을 참조점으로, 시간순', () => {
		const s = trendSeries(sampleLike, 'Q', 'all');
		expect(s.map(key)).toEqual(['2023Y1*', '2024Y1*', '2025Q1', '2025Q2', '2025Q3', '2025Q4']);
		expect(referenceYears(s)).toEqual([2023, 2024]);
	});

	it('반기 추이: 합산된 반기도 본체, 2025 연간은 참조하지 않는다', () => {
		const s = trendSeries(sampleLike, 'H', 'all');
		expect(s.map(key)).toEqual(['2023Y1*', '2024Y1*', '2025H1', '2025H2']);
	});

	it('그 해에 본체 유형이 하나라도 있으면 연간을 참조하지 않는다 (쪼개 추정 금지)', () => {
		const s = trendSeries([rec(Y(2024)), rec(Q(2024, 4)), rec(Q(2025, 1))], 'Q', 'all');
		expect(s.map(key)).toEqual(['2024Q4', '2025Q1']);
	});

	it('표시 범위: 마지막 해 기준 최근 N년(달력 연도), 참조점도 같이 잘린다', () => {
		expect(trendSeries(sampleLike, 'Q', 2).map(key)).toEqual([
			'2024Y1*',
			'2025Q1',
			'2025Q2',
			'2025Q3',
			'2025Q4'
		]);
		expect(trendSeries(sampleLike, 'Y', 2).map(key)).toEqual(['2024Y1', '2025Y1']);
	});

	it('범위 기준은 시리즈의 마지막 해 — 미래 연도가 아니라 자료가 있는 마지막 해', () => {
		const s = trendSeries([rec(Y(2019)), rec(Y(2020)), rec(Y(2021))], 'Y', 2);
		expect(s.map(key)).toEqual(['2020Y1', '2021Y1']);
	});

	it('월 추이 기본 범위 2년: 3년치 월 자료면 앞 해가 빠진다', () => {
		const months = [2023, 2024, 2025].flatMap((y) => [1, 6, 12].map((i) => rec(M(y, i))));
		const s = trendSeries(months, 'M');
		expect(s.every((p) => p.record.period.year >= 2024)).toBe(true);
		expect(s).toHaveLength(6);
	});

	it('자료가 없으면 빈 배열', () => {
		expect(trendSeries([], 'Q')).toEqual([]);
		expect(trendSeries([rec(Q(2025, 1))], 'M', 'all')).toEqual([]);
	});

	it('기본 표시 범위는 유형별', () => {
		expect(defaultTrendRange('M')).toBe(2);
		expect(defaultTrendRange('Q')).toBe(3);
		expect(defaultTrendRange('H')).toBe(5);
		expect(defaultTrendRange('Y')).toBe('all');
	});
});
