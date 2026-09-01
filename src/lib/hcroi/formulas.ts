import type { BaseInputs, Diagnosis, HcCostBreakdown, HcroiGrade, Metrics } from './types';
import { HC_COST_KEYS } from './types';

/** 총 인건비 = 기본급 + 성과급/수당 + 퇴직급여 + 법정후생비 + 기타 복리후생비 + 교육훈련비 */
export function sumHcCost(b: HcCostBreakdown): number {
	return HC_COST_KEYS.reduce((acc, k) => acc + (Number.isFinite(b[k]) ? b[k] : 0), 0);
}

function ratio(num: number, den: number): number | null {
	return den === 0 || !Number.isFinite(den) || !Number.isFinite(num) ? null : num / den;
}

/**
 * 핵심 수식 (요구사항 §핵심수식 1~3)
 *  - 영업이익            = 매출액 - 영업비용
 *  - 인적자본 투입 전 이익 = 영업이익 + 총 인건비 = 매출액 - (영업비용 - 총 인건비)
 *  - HCROI              = 인적자본 투입 전 이익 / 총 인건비
 *  - HCVA               = 인적자본 투입 전 이익 / 총 임직원 수
 */
export function computeMetrics(i: BaseInputs): Metrics {
	const operatingProfit = i.revenue - i.operatingCost;
	const nonHcCost = i.operatingCost - i.hcCost;
	const profitBeforeHc = i.revenue - nonHcCost; // === operatingProfit + hcCost

	const pct = (v: number | null) => (v === null ? null : v * 100);

	return {
		operatingProfit,
		profitBeforeHc,
		nonHcCost,
		hcroi: ratio(profitBeforeHc, i.hcCost),
		hcva: ratio(profitBeforeHc, i.headcount),
		revenuePerHead: ratio(i.revenue, i.headcount),
		hcCostPerHead: ratio(i.hcCost, i.headcount),
		operatingMargin: pct(ratio(operatingProfit, i.revenue)),
		hcCostToRevenue: pct(ratio(i.hcCost, i.revenue)),
		hcCostShareOfOpCost: pct(ratio(i.hcCost, i.operatingCost))
	};
}

/** 영업이익을 알고 있을 때 영업비용으로 환산 */
export function operatingCostFromProfit(revenue: number, operatingProfit: number): number {
	return revenue - operatingProfit;
}

/**
 * HCROI 정상성 진단 기준 (요구사항 §주요기능 1 예시 확장)
 *  - 1.0 미만  : 위험 — 인건비 1원당 회수액이 1원 미만 → 인건비 투입이 이익으로 회수되지 않음(영업손실)
 *  - 1.0 ~ 1.3 : 보통
 *  - 1.3 ~ 1.5 : 양호  (요구사항에 명시되지 않은 구간 — 보통/우수 사이로 정의)
 *  - 1.5 이상  : 우수
 */
export const HCROI_THRESHOLDS = { warning: 1.0, fair: 1.3, excellent: 1.5 } as const;

export function gradeOf(hcroi: number | null): HcroiGrade | null {
	if (hcroi === null || !Number.isFinite(hcroi)) return null;
	if (hcroi < HCROI_THRESHOLDS.warning) return 'critical';
	if (hcroi < HCROI_THRESHOLDS.fair) return 'warning';
	if (hcroi < HCROI_THRESHOLDS.excellent) return 'fair';
	return 'excellent';
}

export const GRADE_LABEL: Record<HcroiGrade, string> = {
	critical: '위험',
	warning: '보통',
	fair: '양호',
	excellent: '우수'
};

export function diagnose(hcroi: number | null): Diagnosis | null {
	const grade = gradeOf(hcroi);
	if (grade === null || hcroi === null) return null;
	const v = hcroi.toFixed(2);
	const summaries: Record<HcroiGrade, string> = {
		critical: `인건비 1원당 ${v}원 회수 — 인건비조차 회수하지 못하는 영업손실 구간입니다. 구조적 개선이 시급합니다.`,
		warning: `인건비 1원당 ${v}원 회수 — 인건비는 회수하지만 잉여가 얇습니다. 임금 인상 여력이 제한적입니다.`,
		fair: `인건비 1원당 ${v}원 회수 — 안정 구간입니다. 생산성 제고로 1.5배 이상 진입을 목표로 삼을 수 있습니다.`,
		excellent: `인건비 1원당 ${v}원 회수 — 인적자본 투자효율이 우수합니다. 현 수준 유지와 인재 투자 확대를 검토할 수 있습니다.`
	};
	return { grade, label: GRADE_LABEL[grade], summary: summaries[grade] };
}

/** 입력값 유효성 검사 — 오류 메시지 배열 (빈 배열이면 정상) */
export function validateInputs(i: BaseInputs): string[] {
	const errors: string[] = [];
	const finite = (v: number) => Number.isFinite(v);
	if (!finite(i.revenue) || i.revenue < 0) errors.push('매출액은 0 이상의 숫자여야 합니다.');
	if (!finite(i.operatingCost) || i.operatingCost < 0)
		errors.push('영업비용은 0 이상의 숫자여야 합니다.');
	if (!finite(i.hcCost) || i.hcCost <= 0) errors.push('총 인건비는 0보다 커야 합니다.');
	if (!finite(i.headcount) || i.headcount <= 0 || !Number.isInteger(i.headcount))
		errors.push('총 임직원 수는 1 이상의 정수여야 합니다.');
	if (finite(i.hcCost) && finite(i.operatingCost) && i.hcCost > i.operatingCost)
		errors.push('총 인건비가 영업비용보다 클 수 없습니다 (영업비용은 인건비를 포함한 금액입니다).');
	return errors;
}
