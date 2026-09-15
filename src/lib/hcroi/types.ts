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

/**
 * 임직원 수 세부 구성 (선택 입력).
 * 값이 있으면 `HeadcountBasis.include` 설정에 따라 총 임직원 수를 계산한다.
 * 없으면 총 임직원 수를 직접 입력한 값으로 본다.
 */
export interface HeadcountBreakdown {
	/** 정규직 — 항상 포함 */
	regular: number;
	/** 계약직·기간제 */
	contract: number;
	/** 파견·도급 등 소속 외 근로자 */
	dispatched: number;
	/** 등기임원 */
	executive: number;
}

export const HEADCOUNT_KEYS = [
	'regular',
	'contract',
	'dispatched',
	'executive'
] as const satisfies readonly (keyof HeadcountBreakdown)[];

export const HEADCOUNT_LABELS: Record<keyof HeadcountBreakdown, string> = {
	regular: '정규직',
	contract: '계약직·기간제',
	dispatched: '파견·도급(소속 외)',
	executive: '등기임원'
};

/** 산정 방식 라벨 — 화면·엑셀 `조직 정보` 시트·가이드가 모두 이 문구를 쓴다 (한 곳만 바꾸면 왕복이 깨진다) */
export const HEADCOUNT_METHOD_LABELS: Record<'average' | 'periodEnd', string> = {
	average: '기간 평균(FTE)',
	periodEnd: '기말 인원'
};

/** 총 임직원 수에 포함할 수 있는 구분 (정규직은 선택 대상이 아니라 항상 포함) */
export const HEADCOUNT_OPTIONAL_KEYS = ['contract', 'dispatched', 'executive'] as const;

/**
 * 임직원 수 산정 기준 — 작업공간 전체에 적용된다 (연도마다 다르면 추이 비교가 무의미해진다).
 * `method` 는 표기용 메타데이터로, 계산에는 영향을 주지 않는다.
 */
export interface HeadcountBasis {
	/** 기간 평균(FTE) | 기말 인원 */
	method: 'average' | 'periodEnd';
	/** 총 임직원 수에 포함할 구분 — 실무 기준상 셋 다 기본 제외 */
	include: Record<(typeof HEADCOUNT_OPTIONAL_KEYS)[number], boolean>;
}

export const DEFAULT_HEADCOUNT_BASIS: HeadcountBasis = {
	method: 'average',
	include: { contract: false, dispatched: false, executive: false }
};

/** 산정 기준이 같은지 — 값으로 비교한다 (라벨 문자열 비교에 기대지 않는다) */
export function sameHeadcountBasis(a: HeadcountBasis, b: HeadcountBasis): boolean {
	return (
		a.method === b.method && HEADCOUNT_OPTIONAL_KEYS.every((k) => a.include[k] === b.include[k])
	);
}

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

/**
 * 분석 기간 단위. 연간(Y) · 반기(H) · 분기(Q) · 월(M).
 * 실무 확인(2026-09-03): 분기 필수, 월 선택. 결산이 없는 분기는 반기 실적만 있음 → 반기 값을 반기 레코드로 그대로 둔다(분기로 쪼개 추정하지 않음).
 * 상위 기간(분기→반기→연간)은 저장하지 않고 `rollup.ts` 가 하위 기간에서 읽을 때 계산한다(2026-09-09).
 */
export type PeriodType = 'Y' | 'H' | 'Q' | 'M';

/** 굵은 단위부터 (셀렉트·추이 단위 순서) */
export const PERIOD_TYPES: readonly PeriodType[] = ['Y', 'H', 'Q', 'M'];

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
	Y: '연간',
	H: '반기',
	Q: '분기',
	M: '월'
};

/** 유형별 한 해의 기간 수 = 연율화 계수 N (확장 지침 §1-(1): 연=1, 반기=2, 분기=4, 월=12) */
export const PERIODS_PER_YEAR: Record<PeriodType, number> = { Y: 1, H: 2, Q: 4, M: 12 };

/** 분석 기간 = 회계연도 + 유형 + 순번 (Y 는 항상 1, H 는 1–2, Q 는 1–4) */
export interface Period {
	year: number;
	type: PeriodType;
	index: number;
}

/** 기간별 데이터 레코드 (대시보드 추이·시뮬레이터 기준 기간). 값은 모두 **그 기간의 실적**이며 연율화하지 않는다 */
export interface PeriodRecord {
	id: string;
	period: Period;
	inputs: BaseInputs;
	/**
	 * 인건비 세부 내역 (총액만 입력하면 null).
	 * 6항목을 다 쓰지 않는 회사가 있어 **세부 합계 ≤ inputs.hcCost** 만 요구한다 — 차액은 "미분류".
	 * 지표는 언제나 총액(inputs.hcCost)으로 계산한다. 합계가 총액보다 크면 오류(`validateBreakdown`).
	 */
	breakdown: HcCostBreakdown | null;
	/**
	 * 임직원 수 세부 구성. 값이 있으면 `inputs.headcount` 는 산정 기준(`HeadcountBasis`)을 적용한
	 * 합계와 같아야 한다. 총원만 입력하는 경우 null.
	 */
	headcountBreakdown: HeadcountBreakdown | null;
	memo?: string;
	/**
	 * 기간을 새로 추가할 때 **직전 기간 값을 복사해 왔다**는 표시 (출처 기간).
	 * 복사된 값은 아직 실적이 아니므로 화면이 "복사됨 · 확인 필요" 칩을 보여 준다.
	 * 값을 하나라도 고치면 지워진다(`workspace.markEdited`). 저장 대상이다(localStorage·JSON).
	 */
	copiedFrom?: Period | null;
	/**
	 * 하위 기간에서 계산된 레코드 표시 (`rollup.ts`). 직접 입력한 레코드에는 없다.
	 * 계산 레코드는 저장하지 않으며 id 는 `derived:<periodKey>` 로 고정된다.
	 */
	derived?: DerivedInfo;
}

/** 합산 출처: `sum` = 하위 기간 합계, `diff` = 직접 입력한 상위 기간 − 나머지 하위 기간 */
export interface DerivedInfo {
	method: 'sum' | 'diff';
	/** 합산에 쓴 하위 기간 유형과 개수 (diff 면 상위 기간 유형) */
	from: PeriodType;
	count: number;
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
	/** 인원 변동률 (%) — headcountMode === 'pct' 일 때 사용 */
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
