import { computeMetrics } from './formulas';
import type { BaseInputs, Metrics, Scenario, ScenarioParams, ScenarioResult } from './types';

export const DEFAULT_SCENARIO_PARAMS: ScenarioParams = {
	headcountMode: 'pct',
	headcountPct: 0,
	headcountDelta: 0,
	wageIncreasePct: 0,
	productivityPct: 0,
	variableCostRatioPct: 0
};

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
}

/** 시나리오 적용 후 인원 (정수, 최소 0명) */
export function scenarioHeadcount(base: number, p: ScenarioParams): number {
	const next =
		p.headcountMode === 'pct'
			? Math.round(base * (1 + p.headcountPct / 100))
			: base + p.headcountDelta;
	return Math.max(0, Math.round(next));
}

/**
 * 시나리오 모델링 가정 (docs/spec.md §시뮬레이션 가정 참조)
 *  1. 인당 인건비는 기준연도 값에 임금 인상률을 곱해 유지된다.  총 인건비' = 인원' × 인당 인건비 × (1 + 임금인상률)
 *  2. 인당 매출은 기준연도 값에 생산성 변화율을 곱해 유지된다.  매출액'   = 인원' × 인당 매출 × (1 + 생산성변화율)
 *  3. 비인건비 영업비용은 고정비(불변)와 변동비(매출 비례)로 분해된다. 변동비 비율은 variableCostRatioPct.
 *     비인건비' = 고정비 + 변동비 × (매출액' / 매출액)
 *  4. 영업비용' = 비인건비' + 총 인건비',  영업이익' = 매출액' - 영업비용'
 */
export function applyScenario(base: BaseInputs, p: ScenarioParams): BaseInputs {
	const headcount = scenarioHeadcount(base.headcount, p);
	const hcCostPerHead = base.headcount > 0 ? base.hcCost / base.headcount : 0;
	const revenuePerHead = base.headcount > 0 ? base.revenue / base.headcount : 0;

	const hcCost = headcount * hcCostPerHead * (1 + p.wageIncreasePct / 100);
	const revenue = headcount * revenuePerHead * (1 + p.productivityPct / 100);

	const nonHcCost = base.operatingCost - base.hcCost;
	const variableRatio = clamp(p.variableCostRatioPct, 0, 100) / 100;
	const variableCost = nonHcCost * variableRatio;
	const fixedCost = nonHcCost - variableCost;
	const revenueScale = base.revenue > 0 ? revenue / base.revenue : 1;
	const nextNonHcCost = fixedCost + variableCost * revenueScale;

	return {
		revenue,
		operatingCost: nextNonHcCost + hcCost,
		hcCost,
		headcount
	};
}

function diffNullable(a: number | null, b: number | null): number | null {
	return a === null || b === null ? null : a - b;
}

/**
 * HCROI 를 기준선(targetHcroi)과 같게 만드는 인당 생산성 변화율(%).
 *
 * 매출액' = H'·rph·(1+g),  비인건비' = F + V·(매출액'/R)
 * HCROI' = (매출액' − 비인건비') / 인건비'  =  (매출액'·(1 − V/R) − F) / 인건비'
 * ⇒ 매출액' = (target·인건비' + F) / (1 − V/R)  ⇒  g = 매출액' / (H'·rph) − 1
 */
export function breakEvenProductivityPct(
	base: BaseInputs,
	p: ScenarioParams,
	targetHcroi: number | null
): number | null {
	if (targetHcroi === null || base.headcount <= 0 || base.revenue <= 0) return null;
	const headcount = scenarioHeadcount(base.headcount, p);
	if (headcount <= 0) return null;
	const hcCost = headcount * (base.hcCost / base.headcount) * (1 + p.wageIncreasePct / 100);
	const nonHcCost = base.operatingCost - base.hcCost;
	const variableRatio = clamp(p.variableCostRatioPct, 0, 100) / 100;
	const V = nonHcCost * variableRatio;
	const F = nonHcCost - V;
	const denom = 1 - V / base.revenue;
	if (denom <= 0) return null;
	const requiredRevenue = (targetHcroi * hcCost + F) / denom;
	const revenuePerHead = base.revenue / base.headcount;
	return (requiredRevenue / (headcount * revenuePerHead) - 1) * 100;
}

/**
 * 현재 인원·생산성 조건에서 HCROI 를 기준선(targetHcroi)과 같게 유지하는 최대 임금 인상률(%).
 * HCROI' = (매출액' − 비인건비') / 인건비'  ⇒  인건비'_max = (매출액' − 비인건비') / target
 */
export function maxWageIncreasePct(
	base: BaseInputs,
	p: ScenarioParams,
	targetHcroi: number | null
): number | null {
	if (targetHcroi === null || targetHcroi <= 0 || base.headcount <= 0) return null;
	const next = applyScenario(base, { ...p, wageIncreasePct: 0 });
	if (next.hcCost <= 0) return null;
	const profitBeforeHc = next.revenue - (next.operatingCost - next.hcCost);
	const maxHcCost = profitBeforeHc / targetHcroi;
	return (maxHcCost / next.hcCost - 1) * 100;
}

export function runScenario(base: BaseInputs, scenario: Scenario): ScenarioResult {
	const baseMetrics = computeMetrics(base);
	const inputs = applyScenario(base, scenario.params);
	const metrics = computeMetrics(inputs);
	return {
		scenario,
		inputs,
		metrics,
		delta: {
			headcount: inputs.headcount - base.headcount,
			hcCost: inputs.hcCost - base.hcCost,
			revenue: inputs.revenue - base.revenue,
			operatingProfit: metrics.operatingProfit - baseMetrics.operatingProfit,
			hcroi: diffNullable(metrics.hcroi, baseMetrics.hcroi),
			hcva: diffNullable(metrics.hcva, baseMetrics.hcva)
		},
		breakEvenProductivityPct: breakEvenProductivityPct(base, scenario.params, baseMetrics.hcroi),
		maxWageIncreasePct: maxWageIncreasePct(base, scenario.params, baseMetrics.hcroi)
	};
}

export interface Comparison {
	baseline: { inputs: BaseInputs; metrics: Metrics };
	results: ScenarioResult[];
}

export function compareScenarios(base: BaseInputs, scenarios: Scenario[]): Comparison {
	return {
		baseline: { inputs: base, metrics: computeMetrics(base) },
		results: scenarios.map((s) => runScenario(base, s))
	};
}
