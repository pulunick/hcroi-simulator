import type { BaseInputs, HcCostBreakdown, YearRecord } from './types';

/**
 * 표준 HR 레퍼런스 기본값 (요구사항 §응답규칙: 데이터 누락 시 기본값 안내)
 *
 * 아래 비율은 국내 중견 서비스업 일반 사례를 바탕으로 한 "안내용" 가정치이며,
 * 반드시 자사 실적으로 교체해야 한다. (근거는 docs/spec.md §기본값 참조)
 */
export const REFERENCE_DEFAULTS = {
	/** 매출 대비 총 인건비 비율 (%) */
	hcCostToRevenuePct: 22,
	/** 영업이익률 (%) */
	operatingMarginPct: 8,
	/** 인당 매출액 (원/인) */
	revenuePerHead: 400_000_000,
	/** 총 인건비 구성비 (%, 합계 100) — 총액만 알 때 세부내역 분배용 */
	breakdownSharePct: {
		baseSalary: 62,
		incentives: 14,
		retirement: 8,
		statutoryWelfare: 9,
		otherWelfare: 5,
		training: 2
	} satisfies Record<keyof HcCostBreakdown, number>
} as const;

/** 총액을 기본 구성비로 분배 (마지막 항목에서 반올림 잔차 보정 → 합계 = total) */
export function splitHcCost(total: number): HcCostBreakdown {
	const share = REFERENCE_DEFAULTS.breakdownSharePct;
	const keys = Object.keys(share) as (keyof HcCostBreakdown)[];
	const out = {} as HcCostBreakdown;
	let acc = 0;
	keys.forEach((k, idx) => {
		if (idx === keys.length - 1) {
			out[k] = total - acc;
		} else {
			out[k] = Math.round((total * share[k]) / 100);
			acc += out[k];
		}
	});
	return out;
}

/** 매출액(·인원)만 알 때 나머지 기본값 추정 */
export function estimateFromRevenue(revenue: number, headcount?: number): BaseInputs {
	const hcCost = Math.round((revenue * REFERENCE_DEFAULTS.hcCostToRevenuePct) / 100);
	const operatingProfit = Math.round((revenue * REFERENCE_DEFAULTS.operatingMarginPct) / 100);
	return {
		revenue,
		operatingCost: revenue - operatingProfit,
		hcCost,
		headcount: headcount ?? Math.max(1, Math.round(revenue / REFERENCE_DEFAULTS.revenuePerHead))
	};
}

/** 샘플 데이터 — 첫 방문 시 화면이 비어 보이지 않도록 하는 가상의 회사 (3개년) */
export function sampleYears(): YearRecord[] {
	const mk = (
		id: string,
		year: number,
		revenue: number,
		operatingProfit: number,
		hcCost: number,
		headcount: number
	): YearRecord => ({
		id,
		year,
		inputs: { revenue, operatingCost: revenue - operatingProfit, hcCost, headcount },
		breakdown: splitHcCost(hcCost),
		memo: '샘플 데이터 — 자사 실적으로 교체하세요'
	});
	return [
		mk('sample-2023', 2023, 12_000_000_000, 960_000_000, 2_640_000_000, 30),
		mk('sample-2024', 2024, 13_200_000_000, 924_000_000, 3_036_000_000, 33),
		mk('sample-2025', 2025, 14_100_000_000, 846_000_000, 3_384_000_000, 36)
	];
}
