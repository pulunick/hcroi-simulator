import type { BaseInputs, HcCostBreakdown, PeerCompany, Period, PeriodRecord } from './types';

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

/**
 * 샘플 데이터 — 첫 방문 시 화면이 비어 보이지 않도록 하는 가상의 회사.
 * 연간 2개년(2023·2024) + 2025년 분기 4개. 2025년 연간은 저장하지 않고 합산으로 보여 준다(`rollup.ts`).
 * 인원은 기간 평균이라 분기마다 조금씩 다르다(평균 35.5 → 36).
 */
export function sampleRecords(): PeriodRecord[] {
	const mk = (
		id: string,
		period: Period,
		revenue: number,
		operatingProfit: number,
		hcCost: number,
		headcount: number
	): PeriodRecord => ({
		id,
		period,
		inputs: { revenue, operatingCost: revenue - operatingProfit, hcCost, headcount },
		breakdown: splitHcCost(hcCost),
		headcountBreakdown: null,
		memo: '샘플 데이터 — 자사 실적으로 교체하세요'
	});
	const Y = (year: number): Period => ({ year, type: 'Y', index: 1 });
	const Q = (year: number, index: number): Period => ({ year, type: 'Q', index });
	return [
		mk('sample-2023', Y(2023), 12_000_000_000, 960_000_000, 2_640_000_000, 30),
		mk('sample-2024', Y(2024), 13_200_000_000, 924_000_000, 3_036_000_000, 33),
		// 2025 는 분기 4개만 — 연간(매출 141억 · 영업이익 8.46억 · 인건비 33.84억 · 인원 36)은 합산으로 나온다.
		// 하반기로 갈수록 매출·이익이 커지는 계절성
		mk('sample-2025-q1', Q(2025, 1), 3_200_000_000, 150_000_000, 820_000_000, 34),
		mk('sample-2025-q2', Q(2025, 2), 3_400_000_000, 190_000_000, 830_000_000, 35),
		mk('sample-2025-q3', Q(2025, 3), 3_600_000_000, 230_000_000, 850_000_000, 36),
		mk('sample-2025-q4', Q(2025, 4), 3_900_000_000, 276_000_000, 884_000_000, 37)
	];
}

/**
 * 동종업계 샘플 — 실제 회사가 아닌 **가상의 회사 3곳**(2024·2025 연간).
 * 샘플 자사(`sampleRecords`)의 HCROI(2024 약 1.30배 · 2025 약 1.25배)와 견주었을 때
 * A사는 높고(1.55~1.60배), B사는 낮고(약 1.05배), C사는 비슷하게(1.26~1.30배) 잡아
 * 비교 화면의 평균·중앙값·순위가 한눈에 들어오게 했다. 세부 내역은 넣지 않는다(공시 합계만 넣는 전제).
 */
export function samplePeers(): PeerCompany[] {
	const rec = (
		companyId: string,
		year: number,
		revenue: number,
		operatingProfit: number,
		hcCost: number,
		headcount: number
	): PeriodRecord => ({
		id: `${companyId}-${year}`,
		period: { year, type: 'Y', index: 1 },
		inputs: { revenue, operatingCost: revenue - operatingProfit, hcCost, headcount },
		breakdown: null,
		headcountBreakdown: null
	});
	const company = (
		id: string,
		name: string,
		rows: [year: number, revenue: number, operatingProfit: number, hcCost: number, head: number][]
	): PeerCompany => ({
		id,
		name,
		memo: '가상 · 참고용',
		records: rows.map(([y, rev, op, hc, head]) => rec(id, y, rev, op, hc, head))
	});
	return [
		// HCROI 1.55배 → 1.60배 (자사보다 높음)
		company('sample-peer-a', '가상 A사', [
			[2024, 15_000_000_000, 1_650_000_000, 3_000_000_000, 36],
			[2025, 16_200_000_000, 1_944_000_000, 3_240_000_000, 38]
		]),
		// HCROI 1.05배 → 1.04배 (자사보다 낮음)
		company('sample-peer-b', '가상 B사', [
			[2024, 11_000_000_000, 143_000_000, 2_860_000_000, 32],
			[2025, 11_500_000_000, 124_000_000, 3_100_000_000, 34]
		]),
		// HCROI 1.30배 → 1.26배 (자사와 비슷)
		company('sample-peer-c', '가상 C사', [
			[2024, 12_600_000_000, 870_000_000, 2_900_000_000, 31],
			[2025, 13_400_000_000, 819_000_000, 3_150_000_000, 33]
		])
	];
}
