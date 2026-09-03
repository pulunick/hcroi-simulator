import { computeMetrics, GRADE_LABEL, gradeOf } from '../formulas';
import type { Comparison } from '../scenario';
import { HC_COST_KEYS, type Metrics, type YearRecord } from '../types';
import { NUM_FMT, type InputColumnKey } from './schema';

/**
 * 작업공간 → 시트 행 (순수 함수, exceljs 무관).
 * 지표는 여기서 `computeMetrics` 로 계산해 "값" 으로만 내보낸다 — 파일에 저장된 지표는 가져오기 때 읽지 않는다.
 */

export type CellValue = number | string | null;
export type InputRow = Record<InputColumnKey, CellValue>;

/** 시트 ② `입력 데이터` — 템플릿과 같은 구조라 그대로 다시 가져올 수 있다 */
export function inputRows(years: YearRecord[]): InputRow[] {
	return [...years]
		.sort((a, b) => a.year - b.year)
		.map((y) => {
			const row: InputRow = {
				year: y.year,
				revenue: y.inputs.revenue,
				operatingCost: y.inputs.operatingCost,
				operatingProfit: y.inputs.revenue - y.inputs.operatingCost,
				headcount: y.inputs.headcount,
				hcCost: y.inputs.hcCost,
				baseSalary: null,
				incentives: null,
				retirement: null,
				statutoryWelfare: null,
				otherWelfare: null,
				training: null,
				memo: y.memo ?? null
			};
			if (y.breakdown) for (const k of HC_COST_KEYS) row[k] = y.breakdown[k];
			return row;
		});
}

export interface SummaryColumn {
	header: string;
	numFmt: string;
	pick: (y: YearRecord, m: Metrics) => CellValue;
	width: number;
}

const gradeText = (m: Metrics) => {
	const g = gradeOf(m.hcroi);
	return g ? GRADE_LABEL[g] : '—';
};

/** 시트 ① `지표 요약` 열 정의 */
export const SUMMARY_COLUMNS: readonly SummaryColumn[] = [
	{ header: '연도', numFmt: NUM_FMT.year, pick: (y) => y.year, width: 8 },
	{ header: 'HCROI(배)', numFmt: NUM_FMT.multiple, pick: (_, m) => m.hcroi, width: 11 },
	{
		header: 'HCROI(%)',
		numFmt: NUM_FMT.pct,
		pick: (_, m) => (m.hcroi === null ? null : m.hcroi * 100),
		width: 11
	},
	{ header: '등급', numFmt: '@', pick: (_, m) => gradeText(m), width: 8 },
	{ header: 'HCVA(원/인)', numFmt: NUM_FMT.won, pick: (_, m) => m.hcva, width: 16 },
	{ header: '매출액(원)', numFmt: NUM_FMT.won, pick: (y) => y.inputs.revenue, width: 18 },
	{ header: '영업이익(원)', numFmt: NUM_FMT.won, pick: (_, m) => m.operatingProfit, width: 16 },
	{ header: '총 인건비(원)', numFmt: NUM_FMT.won, pick: (y) => y.inputs.hcCost, width: 16 },
	{
		header: '비인건비 영업비용(원)',
		numFmt: NUM_FMT.won,
		pick: (_, m) => m.nonHcCost,
		width: 20
	},
	{ header: '총 임직원 수(명)', numFmt: NUM_FMT.count, pick: (y) => y.inputs.headcount, width: 14 },
	{ header: '인당 매출(원/인)', numFmt: NUM_FMT.won, pick: (_, m) => m.revenuePerHead, width: 16 },
	{ header: '인당 인건비(원/인)', numFmt: NUM_FMT.won, pick: (_, m) => m.hcCostPerHead, width: 16 },
	{ header: '영업이익률(%)', numFmt: NUM_FMT.pct, pick: (_, m) => m.operatingMargin, width: 13 },
	{
		header: '매출 대비 인건비율(%)',
		numFmt: NUM_FMT.pct,
		pick: (_, m) => m.hcCostToRevenue,
		width: 18
	}
];

export function summaryRows(years: YearRecord[]): CellValue[][] {
	return [...years]
		.sort((a, b) => a.year - b.year)
		.map((y) => {
			const m = computeMetrics(y.inputs);
			return SUMMARY_COLUMNS.map((c) => c.pick(y, m));
		});
}

/** 시트 ③ 한 행: 라벨 + 값들 + 이 행의 숫자 서식 */
export interface LabeledRow {
	label: string;
	values: CellValue[];
	numFmt: string;
}

export interface ScenarioSheet {
	/** 열 헤더: ['항목', '시나리오 A', '시나리오 B'] */
	paramHeader: string[];
	params: LabeledRow[];
	/** 열 헤더: ['지표', '기준(2025)', '시나리오 A', '증감', '시나리오 B', '증감'] */
	metricHeader: string[];
	metrics: LabeledRow[];
}

/** 시트 ③ `시나리오 비교` — 내보내기 전용(가져오기 대상 아님) */
export function scenarioSheet(baseYear: number, cmp: Comparison): ScenarioSheet {
	const names = cmp.results.map((r) => r.scenario.name);
	const p = (f: (r: Comparison['results'][number]) => CellValue) => cmp.results.map(f);

	const params: LabeledRow[] = [
		{
			label: '인원 조정 방식',
			values: p((r) => (r.scenario.params.headcountMode === 'pct' ? '비율(%)' : '인원(명)')),
			numFmt: '@'
		},
		{
			label: '인원 변동율(%)',
			values: p((r) => r.scenario.params.headcountPct),
			numFmt: NUM_FMT.pct
		},
		{
			label: '변동 인원(명)',
			values: p((r) => r.scenario.params.headcountDelta),
			numFmt: NUM_FMT.count
		},
		{
			label: '평균 임금 인상률(%)',
			values: p((r) => r.scenario.params.wageIncreasePct),
			numFmt: NUM_FMT.pct
		},
		{
			label: '인당 생산성 변화율(%)',
			values: p((r) => r.scenario.params.productivityPct),
			numFmt: NUM_FMT.pct
		},
		{
			label: '비인건비 중 변동비 비율(%)',
			values: p((r) => r.scenario.params.variableCostRatioPct),
			numFmt: NUM_FMT.pct
		},
		{
			label: '손익분기 생산성 변화율(%)',
			values: p((r) => r.breakEvenProductivityPct),
			numFmt: NUM_FMT.pct
		},
		{ label: '임금 인상 상한(%)', values: p((r) => r.maxWageIncreasePct), numFmt: NUM_FMT.pct }
	];

	const b = cmp.baseline;
	const metricRow = (
		label: string,
		numFmt: string,
		pick: (m: Metrics, i: Comparison['baseline']['inputs']) => number | null
	): LabeledRow => {
		const base = pick(b.metrics, b.inputs);
		const values: CellValue[] = [base];
		for (const r of cmp.results) {
			const v = pick(r.metrics, r.inputs);
			values.push(v, v === null || base === null ? null : v - base);
		}
		return { label, values, numFmt };
	};

	const metrics: LabeledRow[] = [
		metricRow('HCROI(배)', NUM_FMT.multiple, (m) => m.hcroi),
		metricRow('총 인건비(원)', NUM_FMT.won, (_, i) => i.hcCost),
		metricRow('영업이익(원)', NUM_FMT.won, (m) => m.operatingProfit),
		metricRow('매출액(원)', NUM_FMT.won, (_, i) => i.revenue),
		metricRow('총 임직원 수(명)', NUM_FMT.count, (_, i) => i.headcount),
		metricRow('HCVA(원/인)', NUM_FMT.won, (m) => m.hcva),
		metricRow('인당 매출액(원/인)', NUM_FMT.won, (m) => m.revenuePerHead),
		metricRow('인당 인건비(원/인)', NUM_FMT.won, (m) => m.hcCostPerHead),
		metricRow('영업이익률(%)', NUM_FMT.pct, (m) => m.operatingMargin)
	];

	const metricHeader = ['지표', `기준(${baseYear})`];
	for (const n of names) metricHeader.push(n, '증감');

	return { paramHeader: ['항목', ...names], params, metricHeader, metrics };
}

/** 시트 ④ `산식·가정` 본문 (spec §2~§4 요약) */
export const FORMULA_LINES: readonly string[] = [
	'핵심 수식',
	'1. 인적자본 투입 전 이익 = 영업이익 + 총 인건비 = 매출액 − (영업비용 − 총 인건비)',
	'2. HCROI = (영업이익 + 총 인건비) ÷ 총 인건비  — 인건비 1원당 회수액(배). 1.0배 = 인건비만 회수',
	'3. HCVA = (영업이익 + 총 인건비) ÷ 총 임직원 수  (원/인)',
	'4. 총 인건비 = 기본급 + 성과급/수당 + 퇴직급여 + 법정후생비 + 기타 복리후생비 + 교육훈련비',
	'',
	'HCROI 등급',
	'1.0배 미만 위험(영업손실) · 1.0~1.5배 보통 · 1.5배 이상 우수',
	'',
	'시뮬레이션 가정',
	"인원' = 기준 인원 × (1 + 인원 변동율) 또는 기준 인원 ± 변동 인원 (정수 반올림, 최소 0)",
	"총 인건비' = 인원' × 기준 인당 인건비 × (1 + 임금 인상률)",
	"매출액' = 인원' × 기준 인당 매출 × (1 + 생산성 변화율)",
	"비인건비' = 고정비 + 변동비 × (매출액' ÷ 매출액)  — 변동비 비율 기본 0% (전액 고정비)",
	"영업이익' = 매출액' − 비인건비' − 총 인건비'. HCROI'·HCVA' 는 핵심 수식으로 재계산",
	'신규 인원 램프업, 채용·퇴직 일회성 비용, 세금·금융비용은 모델에 포함하지 않음',
	'',
	'이 파일의 "지표 요약"·"시나리오 비교" 시트는 내보내기 시점의 계산 결과 스냅샷이며, 가져오기 시 읽지 않습니다.',
	'입력을 고치려면 "입력 데이터" 시트를 수정해 다시 가져오세요.'
];
