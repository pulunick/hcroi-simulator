import { describe, expect, it } from 'vitest';
import { computeMetrics } from './formulas';
import {
	DEFAULT_SCENARIO_PARAMS,
	applyScenario,
	breakEvenProductivityPct,
	compareScenarios,
	maxWageIncreasePct,
	runScenario,
	scenarioHeadcount
} from './scenario';
import type { BaseInputs, ScenarioParams } from './types';

// 매출 100억 / 영업비용 92억 / 인건비 30억 / 40명 → HCROI = (8+30)/30 = 1.2667
const base: BaseInputs = {
	revenue: 10_000_000_000,
	operatingCost: 9_200_000_000,
	hcCost: 3_000_000_000,
	headcount: 40
};
const P = (patch: Partial<ScenarioParams>): ScenarioParams => ({
	...DEFAULT_SCENARIO_PARAMS,
	...patch
});

describe('scenarioHeadcount', () => {
	it('비율 모드는 반올림, 증감 모드는 가감', () => {
		expect(scenarioHeadcount(40, P({ headcountPct: 10 }))).toBe(44);
		expect(scenarioHeadcount(33, P({ headcountPct: 10 }))).toBe(36); // 36.3 → 36
		expect(scenarioHeadcount(40, P({ headcountMode: 'delta', headcountDelta: -3 }))).toBe(37);
	});
	it('0명 미만으로 내려가지 않는다', () => {
		expect(scenarioHeadcount(5, P({ headcountMode: 'delta', headcountDelta: -10 }))).toBe(0);
	});
});

describe('applyScenario — 모델링 가정', () => {
	it('변수가 모두 0이면 기준값과 동일', () => {
		const n = applyScenario(base, DEFAULT_SCENARIO_PARAMS);
		expect(n).toEqual(base);
	});

	it('임금 인상률만 적용 → 인건비만 증가, 매출·비인건비 불변', () => {
		const n = applyScenario(base, P({ wageIncreasePct: 10 }));
		expect(n.hcCost).toBeCloseTo(3_300_000_000, 0);
		expect(n.revenue).toBe(base.revenue);
		expect(n.operatingCost - n.hcCost).toBeCloseTo(base.operatingCost - base.hcCost, 0);
		expect(n.headcount).toBe(40);
	});

	it('생산성 변화율만 적용 → 매출만 증가, 비인건비는 고정(변동비 0%)', () => {
		const n = applyScenario(base, P({ productivityPct: 10 }));
		expect(n.revenue).toBeCloseTo(11_000_000_000, 0);
		expect(n.hcCost).toBe(base.hcCost);
		expect(n.operatingCost - n.hcCost).toBeCloseTo(6_200_000_000, 0);
	});

	it('변동비 비율 100% 이면 비인건비가 매출에 비례해 움직인다', () => {
		const n = applyScenario(base, P({ productivityPct: 10, variableCostRatioPct: 100 }));
		expect(n.operatingCost - n.hcCost).toBeCloseTo(6_200_000_000 * 1.1, 0);
	});

	it('변동비 비율 50% 이면 절반만 연동된다', () => {
		const n = applyScenario(base, P({ productivityPct: 20, variableCostRatioPct: 50 }));
		// 고정 31억 + 변동 31억 × 1.2 = 68.2억
		expect(n.operatingCost - n.hcCost).toBeCloseTo(3_100_000_000 + 3_100_000_000 * 1.2, 0);
	});

	it('인원 증가 → 인당 인건비·인당 매출 유지된 채 총액이 비례 증가', () => {
		const n = applyScenario(base, P({ headcountPct: 10 }));
		expect(n.headcount).toBe(44);
		expect(n.hcCost).toBeCloseTo((3_000_000_000 / 40) * 44, 0);
		expect(n.revenue).toBeCloseTo((10_000_000_000 / 40) * 44, 0);
	});

	it('복합 시나리오: 인원 +10%, 임금 +5%, 생산성 +3%', () => {
		const n = applyScenario(base, P({ headcountPct: 10, wageIncreasePct: 5, productivityPct: 3 }));
		expect(n.headcount).toBe(44);
		expect(n.hcCost).toBeCloseTo(44 * 75_000_000 * 1.05, 0);
		expect(n.revenue).toBeCloseTo(44 * 250_000_000 * 1.03, 0);
		expect(n.operatingCost).toBeCloseTo(6_200_000_000 + n.hcCost, 0);
	});
});

describe('runScenario — 결과·변화량', () => {
	it('기준 대비 delta 가 일관된다', () => {
		const r = runScenario(base, { id: 'a', name: 'A', params: P({ wageIncreasePct: 5 }) });
		const b = computeMetrics(base);
		expect(r.delta.hcCost).toBeCloseTo(150_000_000, 0);
		expect(r.delta.operatingProfit).toBeCloseTo(-150_000_000, 0);
		expect(r.delta.hcroi!).toBeCloseTo(r.metrics.hcroi! - b.hcroi!, 10);
		expect(r.delta.hcroi!).toBeLessThan(0);
	});

	it('임금 인상만 있으면 HCROI 는 반드시 하락한다 (인건비↑, 인적자본 투입 전 이익 불변)', () => {
		const r = runScenario(base, { id: 'a', name: 'A', params: P({ wageIncreasePct: 3 }) });
		expect(r.metrics.profitBeforeHc).toBeCloseTo(computeMetrics(base).profitBeforeHc, 0);
		expect(r.delta.hcroi!).toBeLessThan(0);
	});

	it('임금 인상률 == 생산성 변화율이고 비인건비가 전액 변동비(100%)면 HCROI 불변', () => {
		const r = runScenario(base, {
			id: 'a',
			name: 'A',
			params: P({ wageIncreasePct: 4, productivityPct: 4, variableCostRatioPct: 100 })
		});
		expect(r.delta.hcroi!).toBeCloseTo(0, 10);
	});
});

describe('손익분기 역산', () => {
	const cases: ScenarioParams[] = [
		P({ wageIncreasePct: 5 }),
		P({ headcountPct: 10, wageIncreasePct: 5, productivityPct: 1 }),
		P({ headcountMode: 'delta', headcountDelta: -4, wageIncreasePct: 3, variableCostRatioPct: 40 }),
		P({ headcountPct: 25, wageIncreasePct: 8, productivityPct: -2, variableCostRatioPct: 70 })
	];

	it('breakEvenProductivityPct 를 적용하면 HCROI 가 기준선과 같아진다', () => {
		const target = computeMetrics(base).hcroi!;
		for (const p of cases) {
			const g = breakEvenProductivityPct(base, p, target);
			expect(g).not.toBeNull();
			const n = applyScenario(base, { ...p, productivityPct: g! });
			expect(computeMetrics(n).hcroi!).toBeCloseTo(target, 8);
		}
	});

	it('maxWageIncreasePct 를 적용하면 HCROI 가 기준선과 같아진다', () => {
		const target = computeMetrics(base).hcroi!;
		for (const p of cases) {
			const w = maxWageIncreasePct(base, p, target);
			expect(w).not.toBeNull();
			const n = applyScenario(base, { ...p, wageIncreasePct: w! });
			expect(computeMetrics(n).hcroi!).toBeCloseTo(target, 8);
		}
	});

	it('기준 HCROI 가 null 이면 null', () => {
		expect(breakEvenProductivityPct(base, cases[0], null)).toBeNull();
		expect(maxWageIncreasePct(base, cases[0], null)).toBeNull();
	});
});

describe('compareScenarios', () => {
	it('Baseline + N개 시나리오 결과를 돌려준다', () => {
		const c = compareScenarios(base, [
			{ id: 'a', name: 'A', params: P({ headcountPct: 10 }) },
			{ id: 'b', name: 'B', params: P({ headcountPct: -10 }) }
		]);
		expect(c.results).toHaveLength(2);
		expect(c.baseline.metrics.hcroi).toBeCloseTo(38 / 30, 10);
		// 인원만 바뀌고 비인건비가 고정이면: 증원 → 고정비 레버리지로 HCROI 상승, 감원 → 하락
		expect(c.results[0].metrics.hcroi!).toBeGreaterThan(c.baseline.metrics.hcroi!);
		expect(c.results[1].metrics.hcroi!).toBeLessThan(c.baseline.metrics.hcroi!);
	});
});
