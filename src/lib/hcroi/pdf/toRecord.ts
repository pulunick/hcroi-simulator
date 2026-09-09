/**
 * 확인된 후보 값 → 입력 레코드 (순수 함수). docs/plans/pdf-to-excel.md §4 `toRecord.ts`.
 * 이후는 기존 엑셀 가져오기와 같다: `validateRecord` → 미리보기 → `mergeRecords`.
 */

import { sumHeadcount } from '../formulas';
import type { HcCostBreakdown, HeadcountBasis, Period, PeriodRecord } from '../types';
import type { EmployeeTotals } from './locate';
import { FIELD_LABELS, HC_ITEM_KEYS, type FieldKey, type HcItemKey } from './map';

export interface Selection {
	period: Period;
	/** 입력 칸별 확정 값 (원 단위). 없으면 빠진 것 */
	values: Partial<Record<FieldKey, number>>;
	/** 인건비 구성에 넣을 항목 */
	include: Record<HcItemKey, boolean>;
	employees: EmployeeTotals | null;
	basis: HeadcountBasis;
	/** 직원 현황 급여 총액이 덮는 개월 수(보고서 사업연도 범위, 반기보고서 6). 교차검증 때 레코드 기간과 맞춘다 */
	payrollMonths?: number | null;
	memo?: string;
}

const PERIOD_MONTHS: Record<Period['type'], number> = { Y: 12, H: 6, Q: 3, M: 1 };

export interface BuildResult {
	record: Omit<PeriodRecord, 'id'>;
	warnings: string[];
	/** 필수 값이 빠져 그대로는 저장할 수 없음 */
	missing: string[];
}

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

export function buildRecord(sel: Selection): BuildResult {
	const v = sel.values;
	const warnings: string[] = [];
	const missing: string[] = [];

	const revenue = v.revenue ?? 0;
	if (v.revenue === undefined) missing.push(FIELD_LABELS.revenue);

	let operatingCost: number;
	if (v.operatingCost !== undefined) operatingCost = v.operatingCost;
	else if (v.cogs !== undefined && v.sga !== undefined) {
		operatingCost = v.cogs + v.sga;
		warnings.push(`영업비용은 매출원가 + 판매비와관리비로 계산했습니다 (${won(operatingCost)}).`);
	} else if (v.operatingProfit !== undefined && v.revenue !== undefined) {
		operatingCost = revenue - v.operatingProfit;
		warnings.push(`영업비용은 매출액 − 영업이익으로 계산했습니다 (${won(operatingCost)}).`);
	} else {
		operatingCost = 0;
		missing.push('영업비용 또는 영업이익');
	}
	if (v.operatingCost !== undefined && v.operatingProfit !== undefined && v.revenue !== undefined) {
		const diff = revenue - v.operatingCost - v.operatingProfit;
		if (Math.abs(diff) > 1)
			warnings.push(
				`매출액 − 영업비용 ≠ 영업이익 (차이 ${won(diff)}). 같은 표의 같은 열인지 확인하세요.`
			);
	}

	// 인건비: 포함 항목 합계. 표준 6항목만 세부에 넣고 나머지(주식보상 등)는 미분류로 남는다
	let hcCost = 0;
	let anyItem = false;
	for (const k of HC_ITEM_KEYS) {
		if (!sel.include[k] || v[k] === undefined) continue;
		hcCost += v[k] as number;
		anyItem = true;
	}
	const breakdown: HcCostBreakdown | null = anyItem
		? {
				baseSalary: sel.include.baseSalary ? (v.baseSalary ?? 0) : 0,
				incentives: sel.include.incentives ? (v.incentives ?? 0) : 0,
				retirement: sel.include.retirement ? (v.retirement ?? 0) : 0,
				statutoryWelfare: sel.include.statutoryWelfare ? (v.statutoryWelfare ?? 0) : 0,
				otherWelfare: sel.include.otherWelfare ? (v.otherWelfare ?? 0) : 0,
				training: sel.include.training ? (v.training ?? 0) : 0
			}
		: null;
	if (!anyItem) missing.push('총 인건비(인건비 항목)');
	if (anyItem && v.baseSalary !== undefined && v.incentives === undefined)
		warnings.push(
			'급여 항목에 상여·성과급이 섞여 있을 수 있습니다(결산서가 나누지 않음). 세부는 참고용입니다.'
		);

	// 인원
	let headcount = 0;
	let headcountBreakdown: PeriodRecord['headcountBreakdown'] = null;
	const e = sel.employees;
	if (e && e.regular !== null) {
		headcountBreakdown = {
			regular: e.regular,
			contract: e.contract ?? 0,
			dispatched: e.external ?? 0,
			executive: 0
		};
		headcount = sumHeadcount(headcountBreakdown, sel.basis);
		if (!e.sumVerified)
			warnings.push('직원 현황 합계 검산(정규직 + 기간제)이 맞지 않아 열 위치를 추정했습니다.');
	} else if (e && e.total !== null) {
		headcount = e.total;
	} else {
		missing.push('총 임직원 수');
	}
	if (e) {
		warnings.push(
			`임직원 수는 직원 등 현황의 **기말**(${e.asOf ?? '기준일 미확인'}) 인원입니다` +
				(sel.basis.method === 'average'
					? ' — 산정 기준이 기간 평균이면 인사 시스템 평균 인원으로 바꿔 넣으세요.'
					: '.')
		);
		if (e.payroll !== null && hcCost > 0) {
			// 급여 총액은 보고서 기간(반기보고서면 6개월) 기준이므로 레코드 기간 길이에 맞춰 비교한다
			const months = PERIOD_MONTHS[sel.period.type];
			const scale = sel.payrollMonths ? months / sel.payrollMonths : 1;
			const payroll = Math.round(e.payroll * (e.unitScale ?? 1) * scale);
			const ratio = payroll / hcCost;
			if (ratio > 2 || ratio < 0.5)
				warnings.push(
					`직원 현황 급여 총액(${won(payroll)}${scale !== 1 ? `, ${months}개월 환산` : ''})과 총 인건비(${won(hcCost)})가 크게 다릅니다. 단위·기간(3개월/누적)을 확인하세요.`
				);
		}
	}

	return {
		record: {
			period: sel.period,
			inputs: { revenue, operatingCost, hcCost, headcount },
			breakdown,
			headcountBreakdown,
			memo: sel.memo
		},
		warnings,
		missing
	};
}
