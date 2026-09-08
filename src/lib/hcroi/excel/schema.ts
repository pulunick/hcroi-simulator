import {
	HC_COST_KEYS,
	HC_COST_LABELS,
	HEADCOUNT_KEYS,
	HEADCOUNT_LABELS,
	type HcCostBreakdown,
	type HeadcountBreakdown
} from '../types';

/**
 * 엑셀 파일 구조 정의 — 내보내기·템플릿·가져오기가 모두 이 정의를 공유한다.
 * (docs/plans/excel-export-import.md §3)
 *
 * - 시트 ② `입력 데이터` 만 가져오기 대상. 나머지 시트는 계산 결과 스냅샷(읽기 전용).
 * - 금액은 원 단위 정수. 억 단위 입력은 받지 않는다 (헤더·단위 행에 명시).
 */
export const SHEET = {
	summary: '지표 요약',
	input: '입력 데이터',
	scenarios: '시나리오 비교',
	formulas: '산식·가정',
	org: '조직 정보'
} as const;

/**
 * 시트 ⑤ `조직 정보` — 회사/조직 이름 한 칸.
 * 내보내기·템플릿에 항상 포함되고, 가져오기 시 대시보드 제목에 반영된다(사용자 확인 후).
 */
export const ORG_SHEET = {
	label: '회사/조직 이름',
	note: '대시보드 제목에 붙습니다. 비워 두면 기본 제목("HCROI 대시보드")을 씁니다.',
	/** 라벨을 찾을 때 훑는 행 수 (사용자가 위에 줄을 넣었을 수 있음) */
	scanRows: 12
} as const;

/**
 * `조직 정보` 시트가 함께 나르는 **임직원 수 산정 기준**.
 * 인원 구분(정규직·계약직·파견·등기임원)을 입력한 연도는 이 기준으로 총원이 정해지므로,
 * 기준이 파일에 같이 실려 있지 않으면 다른 PC 에서 열었을 때 총원이 조용히 달라진다.
 */
export const BASIS_SHEET = {
	method: { label: '임직원 수 산정 방식', average: '기간 평균(FTE)', periodEnd: '기말 인원' },
	include: {
		contract: '계약직·기간제 포함',
		dispatched: '파견·도급(소속 외) 포함',
		executive: '등기임원 포함'
	},
	yes: '예',
	no: '아니오',
	note: '인원 구분을 입력한 연도의 총 임직원 수는 이 기준으로 계산됩니다.'
} as const;

/** 시트 ② 행 구조: 1행 헤더, 2행 단위·설명, 3행부터 데이터 */
export const INPUT_HEADER_ROW = 1;
export const INPUT_UNIT_ROW = 2;
export const INPUT_FIRST_DATA_ROW = 3;

export type InputColumnKey =
	| 'year'
	| 'revenue'
	| 'operatingCost'
	| 'operatingProfit'
	| 'headcount'
	| 'period'
	| 'hcCost'
	| keyof HcCostBreakdown
	| keyof HeadcountBreakdown
	| 'memo';

export interface InputColumn {
	key: InputColumnKey;
	/** 헤더 텍스트 (단위·필수 표시 제외) */
	header: string;
	unit: '' | '원' | '명';
	required: boolean;
	/** 2행에 들어가는 설명 */
	note: string;
	/** 열 너비 (문자 수) */
	width: number;
}

const breakdownColumns: InputColumn[] = HC_COST_KEYS.map((k) => ({
	key: k,
	header: HC_COST_LABELS[k],
	unit: '원',
	required: false,
	note: '선택. 일부만 채워도 됨(차액은 미분류). 합계가 총 인건비보다 크면 오류',
	width: 16
}));

const headcountColumns: InputColumn[] = HEADCOUNT_KEYS.map((k) => ({
	key: k,
	header: HEADCOUNT_LABELS[k],
	unit: '명',
	required: false,
	note:
		k === 'regular'
			? '선택. 인원 구분을 쓰면 총 임직원 수는 이 구분들의 합계로 계산됨(정규직은 항상 포함)'
			: '선택. 조직 정보 시트의 산정 기준에서 "포함"으로 둔 구분만 총원에 더해짐',
	width: 14
}));

export const INPUT_COLUMNS: readonly InputColumn[] = [
	{ key: 'year', header: '연도', unit: '', required: true, note: '예: 2025', width: 8 },
	{
		key: 'period',
		header: '기간',
		unit: '',
		required: false,
		note: '비우면 연간. 1분기~4분기 / 상반기·하반기 (Q1·H1 표기도 됨). 값은 그 기간 실적 그대로',
		width: 10
	},
	{ key: 'revenue', header: '매출액', unit: '원', required: true, note: '원 단위 정수', width: 18 },
	{
		key: 'operatingCost',
		header: '영업비용(인건비 포함)',
		unit: '원',
		required: false,
		note: '영업이익과 둘 중 하나만 있으면 됨 (둘 다 있으면 영업비용 우선)',
		width: 22
	},
	{
		key: 'operatingProfit',
		header: '영업이익',
		unit: '원',
		required: false,
		note: '영업비용을 모를 때 대신 입력',
		width: 18
	},
	{
		key: 'headcount',
		header: '총 임직원 수',
		unit: '명',
		required: true,
		note: '정수. 인원 구분을 채우면 비워도 됨(합계로 채움)',
		width: 14
	},
	...headcountColumns,
	{
		key: 'hcCost',
		header: '총 인건비',
		unit: '원',
		required: true,
		note: '세부 6항목을 채우면 비워도 됨(합계로 채움)',
		width: 18
	},
	...breakdownColumns,
	{ key: 'memo', header: '메모', unit: '', required: false, note: '선택', width: 28 }
];

/** 엑셀 헤더 셀 문구 — 예: "매출액(원) *" */
export function headerText(c: InputColumn): string {
	return `${c.header}${c.unit ? `(${c.unit})` : ''}${c.required ? ' *' : ''}`;
}

/** 헤더 비교용 정규화: 공백·별표·단위 괄호 제거 */
export function normalizeHeader(v: unknown): string {
	return String(v ?? '')
		.replace(/\((원|명)\)/g, '')
		.replace(/[\s*＊]/g, '')
		.trim();
}

export const INPUT_COLUMN_BY_HEADER: ReadonlyMap<string, InputColumn> = new Map(
	INPUT_COLUMNS.map((c) => [normalizeHeader(c.header), c])
);

/** 엑셀 숫자 서식 */
export const NUM_FMT = {
	won: '#,##0',
	multiple: '0.00"배"',
	pct: '0.0"%"',
	count: '#,##0"명"',
	year: '0'
} as const;
