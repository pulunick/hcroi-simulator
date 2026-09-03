/**
 * HCROI 도메인 타입.
 * 금액 단위는 모두 "원"(정수 권장), 비율은 "%" 단위 숫자(예: 3 → 3%)로 통일한다.
 */

/** 총 인건비 구성 항목 (요구사항 §핵심수식 4) */
export interface HcCostBreakdown {
	/** 기본급 */
	baseSalary: number;
	/** 성과급/수당 */
	incentives: number;
	/** 퇴직급여 */
	retirement: number;
	/** 법정후생비 (4대보험 사업자부담분 등) */
	statutoryWelfare: number;
	/** 기타 복리후생비 */
	otherWelfare: number;
	/** 교육훈련비 */
	training: number;
}

export const HC_COST_KEYS = [
	'baseSalary',
	'incentives',
	'retirement',
	'statutoryWelfare',
	'otherWelfare',
	'training'
] as const satisfies readonly (keyof HcCostBreakdown)[];

export const HC_COST_LABELS: Record<keyof HcCostBreakdown, string> = {
	baseSalary: '기본급',
	incentives: '성과급/수당',
	retirement: '퇴직급여',
	statutoryWelfare: '법정후생비',
	otherWelfare: '기타 복리후생비',
	training: '교육훈련비'
};

/** HCROI 산출에 필요한 최소 입력값 */
export interface BaseInputs {
	/** 매출액 (원) */
	revenue: number;
	/** 영업비용 (원) — 총 인건비를 포함한 전체 영업비용 */
	operatingCost: number;
	/** 총 인건비 (원) */
	hcCost: number;
	/** 총 임직원 수 (명) */
	headcount: number;
}

/** 연도별 데이터 레코드 (대시보드 추이·시뮬레이터 기준연도) */
export interface YearRecord {
	id: string;
	/** 회계연도 */
	year: number;
	inputs: BaseInputs;
	/**
	 * 인건비 세부 내역. 값이 있으면 inputs.hcCost 는 이 합계와 동일해야 한다.
	 * (세부 내역 없이 총액만 입력하는 경우 null)
	 */
	breakdown: HcCostBreakdown | null;
	memo?: string;
}

export type HcroiGrade = 'critical' | 'warning' | 'excellent';

export interface Diagnosis {
	grade: HcroiGrade;
	/** 화면 표기용 등급명 (위험/보통/우수) */
	label: string;
	/** 한 줄 해설 */
	summary: string;
}

/** 산출 지표 — 분모가 0인 경우 해당 값은 null */
export interface Metrics {
	/** 영업이익 = 매출액 - 영업비용 */
	operatingProfit: number;
	/** 인적자본 투입 전 이익 = 영업이익 + 총 인건비 = 매출액 - (영업비용 - 총 인건비) */
	profitBeforeHc: number;
	/** 비인건비 영업비용 = 영업비용 - 총 인건비 */
	nonHcCost: number;
	/** HCROI = profitBeforeHc / hcCost (배수) */
	hcroi: number | null;
	/** HCVA = profitBeforeHc / headcount (원/인) */
	hcva: number | null;
	/** 인당 매출액 (원/인) */
	revenuePerHead: number | null;
	/** 인당 인건비 (원/인) */
	hcCostPerHead: number | null;
	/** 영업이익률 (%) */
	operatingMargin: number | null;
	/** 매출 대비 인건비 비율 (%) */
	hcCostToRevenue: number | null;
	/** 영업비용 중 인건비 비중 (%) */
	hcCostShareOfOpCost: number | null;
}

/** 시나리오 변수 (요구사항 §주요기능 2) */
export interface ScenarioParams {
	/** 인원 조정 방식: 비율(%) 또는 증감 인원(명) */
	headcountMode: 'pct' | 'delta';
	/** 인원 변동율 (%) — headcountMode === 'pct' 일 때 사용 */
	headcountPct: number;
	/** 변동 인원수 (명, +/-) — headcountMode === 'delta' 일 때 사용 */
	headcountDelta: number;
	/** 평균 임금 인상률 (%) — 인당 인건비에 적용 */
	wageIncreasePct: number;
	/** 인당 생산성(인당 매출) 변화율 (%) */
	productivityPct: number;
	/**
	 * 비인건비 영업비용 중 매출에 연동되는(변동비) 비율 (0~100, %).
	 * 0 이면 비인건비는 전액 고정비로 보고 시나리오에서 불변.
	 */
	variableCostRatioPct: number;
}

export interface Scenario {
	id: string;
	name: string;
	params: ScenarioParams;
}

export interface ScenarioResult {
	scenario: Scenario;
	/** 시나리오 적용 후 입력값 */
	inputs: BaseInputs;
	/** 시나리오 적용 후 지표 */
	metrics: Metrics;
	/** 기준(Baseline) 대비 변화량 */
	delta: {
		headcount: number;
		hcCost: number;
		revenue: number;
		operatingProfit: number;
		/** HCROI 변화 (배수 p) — 어느 한쪽이 null 이면 null */
		hcroi: number | null;
		hcva: number | null;
	};
	/**
	 * HCROI 를 기준선과 동일하게 유지하기 위해 필요한 인당 생산성 변화율 (%).
	 * 계산 불가(분모 0 등) 시 null.
	 */
	breakEvenProductivityPct: number | null;
	/**
	 * 현재 인원·생산성 조건에서 HCROI 를 기준선과 동일하게 유지할 수 있는 최대 임금 인상률 (%).
	 * 계산 불가 시 null.
	 */
	maxWageIncreasePct: number | null;
}

export type InsightTone = 'positive' | 'neutral' | 'warning' | 'critical';

export interface Insight {
	tone: InsightTone;
	title: string;
	body: string;
}
