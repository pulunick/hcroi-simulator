import { HC_COST_KEYS, HC_COST_LABELS, type HcCostBreakdown } from '../types';

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
	formulas: '산식·가정'
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
	| 'hcCost'
	| keyof HcCostBreakdown
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
	note: '선택. 6항목을 채우면 합계가 총 인건비와 같아야 함',
	width: 16
}));

export const INPUT_COLUMNS: readonly InputColumn[] = [
	{ key: 'year', header: '연도', unit: '', required: true, note: '예: 2025', width: 8 },
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
	{ key: 'headcount', header: '총 임직원 수', unit: '명', required: true, note: '정수', width: 14 },
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
