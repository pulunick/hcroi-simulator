import { describe, expect, it } from 'vitest';
import { derivedId, rollup, rollupMismatch } from './rollup';
import { periodKey } from './period';
import {
	DEFAULT_HEADCOUNT_BASIS,
	type HeadcountBasis,
	type Period,
	type PeriodRecord
} from './types';

const Y = (year: number): Period => ({ year, type: 'Y', index: 1 });
const Q = (year: number, index: number): Period => ({ year, type: 'Q', index });
const M = (year: number, index: number): Period => ({ year, type: 'M', index });

function rec(
	period: Period,
	revenue: number,
	profit: number,
	hcCost: number,
	headcount: number
): PeriodRecord {
	return {
		id: periodKey(period),
		period,
		inputs: { revenue, operatingCost: revenue - profit, hcCost, headcount },
		breakdown: null,
		headcountBreakdown: null
	};
}
const keys = (rs: PeriodRecord[]) => rs.map((r) => periodKey(r.period));
const find = (rs: PeriodRecord[], key: string) => rs.find((r) => periodKey(r.period) === key)!;
const basis = DEFAULT_HEADCOUNT_BASIS;
const periodEnd: HeadcountBasis = { ...basis, method: 'periodEnd' };

describe('rollup — 합산', () => {
	const quarters = [
		rec(Q(2025, 1), 100, 10, 40, 30),
		rec(Q(2025, 2), 110, 12, 41, 31),
		rec(Q(2025, 3), 120, 14, 42, 33),
		rec(Q(2025, 4), 130, 16, 43, 34)
	];
	it('분기 4개 → 반기 2개 + 연간, 금액은 합계·인원은 평균(반올림)', () => {
		const out = rollup(quarters, basis);
		expect(keys(out)).toEqual([
			'2025-Q1',
			'2025-Q2',
			'2025-H1',
			'2025-Q3',
			'2025-Q4',
			'2025-H2',
			'2025-Y1'
		]);
		const y = find(out, '2025-Y1');
		expect(y.id).toBe(derivedId(Y(2025)));
		expect(y.inputs).toEqual({ revenue: 460, operatingCost: 460 - 52, hcCost: 166, headcount: 32 });
		expect(y.derived).toEqual({ method: 'sum', from: 'H', count: 2 });
		const h1 = find(out, '2025-H1');
		expect(h1.inputs.headcount).toBe(31); // (30+31)/2 = 30.5 → 31
		expect(h1.derived).toEqual({ method: 'sum', from: 'Q', count: 2 });
	});
	it('기말 방식이면 마지막 하위 기간 인원', () => {
		expect(find(rollup(quarters, periodEnd), '2025-Y1').inputs.headcount).toBe(34);
	});
	it('하위 기간이 하나라도 빠지면 만들지 않는다', () => {
		const out = rollup(quarters.slice(0, 3), basis);
		expect(keys(out)).toEqual(['2025-Q1', '2025-Q2', '2025-H1', '2025-Q3']);
	});
	it('월 12개 → 분기 → 반기 → 연간 사슬', () => {
		const months = Array.from({ length: 12 }, (_, i) => rec(M(2025, i + 1), 10, 1, 4, 30 + i));
		const out = rollup(months, basis);
		expect(out).toHaveLength(12 + 4 + 2 + 1);
		expect(find(out, '2025-Y1').inputs.revenue).toBe(120);
		expect(find(out, '2025-Q3').inputs).toEqual({
			revenue: 30,
			operatingCost: 27,
			hcCost: 12,
			headcount: 37
		});
		expect(find(out, '2025-Q3').derived).toEqual({ method: 'sum', from: 'M', count: 3 });
	});
	it('직접 입력한 상위 기간은 그대로 두고(우선), 세부·구분은 모두 있을 때만 합산한다', () => {
		const manualY = rec(Y(2025), 999, 99, 170, 40);
		const withParts = quarters.map((q) => ({
			...q,
			breakdown: {
				baseSalary: 30,
				incentives: 5,
				retirement: 3,
				statutoryWelfare: 0,
				otherWelfare: 2,
				training: 0
			},
			headcountBreakdown: { regular: q.inputs.headcount, contract: 2, dispatched: 1, executive: 3 }
		}));
		const out = rollup([...withParts, manualY], basis);
		const y = find(out, '2025-Y1');
		expect(y).toBe(manualY);
		expect(y.derived).toBeUndefined();
		const h1 = find(out, '2025-H1');
		expect(h1.breakdown?.baseSalary).toBe(60);
		expect(h1.headcountBreakdown).toEqual({
			regular: 31,
			contract: 2,
			dispatched: 1,
			executive: 3
		});
		// 하나라도 세부가 없으면 null
		const mixed = rollup([withParts[0], quarters[1]], basis);
		expect(find(mixed, '2025-H1').breakdown).toBeNull();
	});
	it('직접 입력과 합산이 다르면 항목별 차이를 낸다', () => {
		const manualY = rec(Y(2025), 470, 52, 166, 32); // 매출 +10 → 영업비용도 +10
		expect(rollupMismatch(manualY, quarters, basis)).toEqual([
			{ field: 'revenue', label: '매출액', manual: 470, derived: 460 },
			{ field: 'operatingCost', label: '영업비용', manual: 418, derived: 408 }
		]);
		expect(rollupMismatch(rec(Y(2025), 460, 52, 166, 32), quarters, basis)).toEqual([]);
		// 하위 기간이 없으면 비교하지 않는다
		expect(rollupMismatch(manualY, quarters.slice(1), basis)).toEqual([]);
	});
});

describe('rollup — 차감 (사업보고서의 4분기)', () => {
	const y = rec(Y(2025), 460, 52, 166, 32);
	const q123 = [
		rec(Q(2025, 1), 100, 10, 40, 30),
		rec(Q(2025, 2), 110, 12, 41, 31),
		rec(Q(2025, 3), 120, 14, 42, 33)
	];
	it('연간 − 1~3분기 = 4분기, 반기도 이어서 합산된다', () => {
		const out = rollup([y, ...q123], basis);
		const q4 = find(out, '2025-Q4');
		expect(q4.derived).toEqual({ method: 'diff', from: 'Y', count: 4 });
		expect(q4.inputs).toEqual({ revenue: 130, operatingCost: 114, hcCost: 43, headcount: 34 }); // 4×32−94
		expect(keys(out)).toContain('2025-H2');
		expect(find(out, '2025-H2').inputs.revenue).toBe(250);
	});
	it('기말 방식이면 인원은 연간 값, 평균 결과가 1 미만이면 연간 값', () => {
		expect(find(rollup([y, ...q123], periodEnd), '2025-Q4').inputs.headcount).toBe(32);
		const big = q123.map((q) => ({ ...q, inputs: { ...q.inputs, headcount: 50 } }));
		expect(find(rollup([y, ...big], basis), '2025-Q4').inputs.headcount).toBe(32);
	});
	it('검증에 걸리면(음수 매출 등) 만들지 않고, 둘 이상 비면 만들지 않는다', () => {
		const small = rec(Y(2025), 300, 30, 166, 32); // 300 − 330 < 0
		expect(keys(rollup([small, ...q123], basis))).not.toContain('2025-Q4');
		expect(keys(rollup([y, ...q123.slice(0, 2)], basis))).not.toContain('2025-Q4');
	});
});
