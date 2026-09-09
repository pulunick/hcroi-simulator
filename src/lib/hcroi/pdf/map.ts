/**
 * 찾은 표 → 입력 칸별 후보 값 (순수 함수). docs/plans/pdf-to-excel.md §4 `map.ts`, §5.
 *
 * 계정명 사전(동의어 정규식)으로 행을 고르고, 열은 "당기 그룹의 3개월/누적" 을 옵션대로 고른다.
 * 값은 표 단위를 곱해 **원 단위 정수**로 만든다. 후보는 여러 개일 수 있고(연결/별도, 3개월/누적, 표가 두 번 나올 때)
 * `preferred` 가 옵션에 맞는 첫 후보다 — 최종 선택은 화면에서 사람이 한다.
 */

import type { CoverInfo, DocScan, FoundTable, TableKind } from './locate';
import type { UnitScale } from './types';
import type { Period } from '../types';

export type FieldKey =
	| 'revenue'
	| 'operatingCost'
	| 'cogs'
	| 'sga'
	| 'operatingProfit'
	| 'baseSalary'
	| 'incentives'
	| 'retirement'
	| 'statutoryWelfare'
	| 'otherWelfare'
	| 'training'
	| 'stockComp'
	| 'longTermBenefit';

export const FIELD_LABELS: Record<FieldKey, string> = {
	revenue: '매출액',
	operatingCost: '영업비용',
	cogs: '매출원가',
	sga: '판매비와관리비',
	operatingProfit: '영업이익',
	baseSalary: '급여(기본급)',
	incentives: '상여·성과급',
	retirement: '퇴직급여',
	statutoryWelfare: '법정복리후생비',
	otherWelfare: '복리후생비',
	training: '교육훈련비',
	stockComp: '주식보상비용',
	longTermBenefit: '장기종업원급여'
};

/** 인건비 구성 후보 항목 — 카드 체크리스트 순서 */
export const HC_ITEM_KEYS = [
	'baseSalary',
	'incentives',
	'retirement',
	'statutoryWelfare',
	'otherWelfare',
	'training',
	'stockComp',
	'longTermBenefit'
] as const;
export type HcItemKey = (typeof HC_ITEM_KEYS)[number];

/** 기본 포함 — 주식보상·장기급여는 제외(§5.3) */
export const DEFAULT_HC_INCLUDE: Record<HcItemKey, boolean> = {
	baseSalary: true,
	incentives: true,
	retirement: true,
	statutoryWelfare: true,
	otherWelfare: true,
	training: true,
	stockComp: false,
	longTermBenefit: false
};

/** 회사별로 기억하는 PDF 읽기 설정 — 다음 분기 파일부터 자동 적용 (`workspace.pdfPrefs[회사명]`) */
export interface PdfPrefs {
	consolidated: boolean;
	column: 'period' | 'cumulative';
	include: Record<HcItemKey, boolean>;
}

/** 저장값(localStorage·JSON)에서 읽은 설정을 검증한다. 모양이 다르면 버린다 */
export function normalizePdfPrefs(v: unknown): Record<string, PdfPrefs> {
	const out: Record<string, PdfPrefs> = {};
	if (!v || typeof v !== 'object') return out;
	for (const [name, raw] of Object.entries(v as Record<string, unknown>)) {
		if (!raw || typeof raw !== 'object') continue;
		const r = raw as Record<string, unknown>;
		if (typeof r.consolidated !== 'boolean') continue;
		if (r.column !== 'period' && r.column !== 'cumulative') continue;
		const inc = (r.include ?? {}) as Record<string, unknown>;
		const include = { ...DEFAULT_HC_INCLUDE };
		for (const k of HC_ITEM_KEYS) if (typeof inc[k] === 'boolean') include[k] = inc[k] as boolean;
		out[name] = { consolidated: r.consolidated, column: r.column, include };
	}
	return out;
}

interface DictEntry {
	key: FieldKey;
	kind: TableKind;
	re: RegExp;
	exclude?: RegExp;
}

/** 계정명 사전 — 위에서부터 첫 일치. 라벨은 `normalizeLabel` + 앞 번호("Ⅰ.", "1.") 제거 후 비교 */
export const ACCOUNT_DICT: readonly DictEntry[] = [
	{
		key: 'revenue',
		kind: 'pl',
		re: /^(매출액|매출|영업수익|수익\(매출액\)|매출액\(영업수익\)|수익|영업수익\(매출액\))$/
	},
	{ key: 'operatingCost', kind: 'pl', re: /^영업비용$/ },
	{ key: 'cogs', kind: 'pl', re: /^매출원가$/ },
	{ key: 'sga', kind: 'pl', re: /^(판매비와관리비|판매비및관리비|판매비와일반관리비|판관비)$/ },
	{
		key: 'operatingProfit',
		kind: 'pl',
		re: /^(영업이익|영업이익\(손실\)|영업손실|영업손익|영업이익\(손실\)\(\S*\))$/
	},
	{ key: 'statutoryWelfare', kind: 'expenseByNature', re: /법정복리|4대보험|사회보험/ },
	{
		key: 'baseSalary',
		kind: 'expenseByNature',
		re: /^(급여|급료|임금|종업원급여|종업원급여비용|단기종업원급여|급여및상여|급여와상여|급여및제수당|급여와제수당|인건비|급여등|급여비용)$/
	},
	{ key: 'incentives', kind: 'expenseByNature', re: /^(상여|상여금|성과급|인센티브|제수당)$/ },
	{
		key: 'retirement',
		kind: 'expenseByNature',
		re: /퇴직급여/,
		exclude: /부채|자산|채무|충당|납입/
	},
	{ key: 'otherWelfare', kind: 'expenseByNature', re: /^(복리후생비|복리비|복리후생)$/ },
	{ key: 'training', kind: 'expenseByNature', re: /교육훈련비|교육비|훈련비/ },
	{ key: 'stockComp', kind: 'expenseByNature', re: /주식보상|주식기준보상/ },
	{ key: 'longTermBenefit', kind: 'expenseByNature', re: /장기종업원급여/ }
];

const PREFIX_RE = /^[IVXⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ\d]+\.\s*/;

export function matchAccount(norm: string, kind: TableKind): FieldKey | null {
	const label = norm.replace(PREFIX_RE, '');
	for (const e of ACCOUNT_DICT) {
		if (e.kind !== kind) continue;
		if (e.re.test(label) && !(e.exclude && e.exclude.test(label))) return e.key;
	}
	return null;
}

export interface Candidate {
	key: FieldKey;
	/** 원 단위 (표 단위 × 배수) */
	value: number;
	/** 표에 적힌 값 */
	raw: number;
	unitScale: UnitScale;
	/** 표에 단위 문구가 없어 원으로 가정했음 */
	unitAssumed: boolean;
	page: number;
	table: string;
	rowLabel: string;
	/** 열 머리글 ("제 15 기 반기 3개월"). 머리글이 없으면 "" */
	column: string;
	/** 3개월 열인지 누적 열인지 (판별 안 되면 null) */
	columnKind: 'period' | 'cumulative' | null;
	consolidated: boolean | null;
	/** 옵션(연결/별도·열)에 맞는 후보 */
	preferred: boolean;
}

export interface MapOptions {
	/** 연결(true)/별도(false) 중 선호 */
	consolidated: boolean;
	/** 3개월(period) / 누적(cumulative) 중 선호 */
	column: 'period' | 'cumulative';
}

export interface FieldMatch {
	key: FieldKey;
	label: string;
	/** 선호 후보가 앞에 오도록 정렬 */
	candidates: Candidate[];
}

export function columnKindOf(sub: string): 'period' | 'cumulative' | null {
	const s = sub.replace(/\s/g, '');
	if (/3개월|당분기|당기\b/.test(s) && !/누적/.test(s)) return 'period';
	if (/누적|누계/.test(s)) return 'cumulative';
	return null;
}

/** 당기(가장 왼쪽 그룹) 열들의 순번 — 옵션에 맞는 열이 먼저 */
export function currentColumns(table: FoundTable, prefer: 'period' | 'cumulative'): number[] {
	if (table.columns.length === 0) return [0];
	const minGroup = Math.min(...table.columns.map((c) => c.group));
	const idx = table.columns
		.map((c, i) => ({ c, i }))
		.filter(({ c }) => c.group === minGroup)
		.map(({ i }) => i);
	return idx.sort((a, b) => {
		const ka = columnKindOf(table.columns[a].sub) === prefer ? 0 : 1;
		const kb = columnKindOf(table.columns[b].sub) === prefer ? 0 : 1;
		return ka - kb || a - b;
	});
}

function candidatesOf(table: FoundTable, options: MapOptions): Candidate[] {
	const out: Candidate[] = [];
	const cols = currentColumns(table, options.column);
	const scale = table.unitScale ?? 1;
	for (const row of table.rows) {
		const key = matchAccount(row.norm, table.kind);
		if (!key) continue;
		for (const ci of cols) {
			const raw = row.values[ci];
			if (raw === null || raw === undefined) continue;
			const col = table.columns[ci];
			const kind = col ? columnKindOf(col.sub) : null;
			const consolidatedOk =
				table.consolidated === null || table.consolidated === options.consolidated;
			const columnOk = kind === null || kind === options.column;
			out.push({
				key,
				value: Math.round(raw * scale),
				raw,
				unitScale: scale,
				unitAssumed: table.unitScale === null,
				page: table.page,
				table: table.title,
				rowLabel: row.label,
				column: col?.label ?? '',
				columnKind: kind,
				consolidated: table.consolidated,
				preferred: consolidatedOk && columnOk
			});
		}
	}
	return out;
}

/** 문서 전체에서 입력 칸별 후보를 모은다. 후보가 하나도 없는 칸은 빈 배열로 남긴다 */
export function mapFields(scan: DocScan, options: MapOptions): FieldMatch[] {
	const all = scan.tables.flatMap((t) => candidatesOf(t, options));
	const byKey = new Map<FieldKey, Candidate[]>();
	for (const c of all) byKey.set(c.key, [...(byKey.get(c.key) ?? []), c]);
	const rank = (c: Candidate) =>
		(c.preferred ? 0 : 2) +
		(c.consolidated === options.consolidated ? 0 : c.consolidated === null ? 0.5 : 1) +
		(c.columnKind === options.column ? 0 : c.columnKind === null ? 0.25 : 0.5);
	return (Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => ({
		key,
		label: FIELD_LABELS[key],
		candidates: (byKey.get(key) ?? []).slice().sort((a, b) => rank(a) - rank(b))
	}));
}

/**
 * 고른 열이 나타내는 기간. 반기보고서의 "3개월" 열은 2분기, "누적" 열은 상반기.
 * 3분기 보고서의 누적(1–9월)은 기간 유형이 없어 null.
 */
export function periodForColumn(
	cover: CoverInfo,
	columnKind: 'period' | 'cumulative' | null
): Period | null {
	if (!cover.period || !cover.end) return null;
	const year = cover.period.year;
	if (columnKind === 'period') {
		if (cover.spanMonths === 3 || cover.spanMonths === 1 || cover.spanMonths === 12)
			return cover.period;
		return { year, type: 'Q', index: Math.ceil(cover.end.m / 3) };
	}
	if (columnKind === 'cumulative') return cover.spanMonths === 9 ? null : cover.period;
	return cover.period;
}
