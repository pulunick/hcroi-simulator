import { sumHcCost, validateInputs } from '../formulas';
import { HC_COST_KEYS, type HcCostBreakdown, type YearRecord } from '../types';
import {
	INPUT_COLUMN_BY_HEADER,
	INPUT_COLUMNS,
	INPUT_FIRST_DATA_ROW,
	INPUT_HEADER_ROW,
	normalizeHeader,
	type InputColumnKey
} from './schema';

/**
 * 시트 ② 행 → YearRecord (순수 함수, exceljs 무관).
 * 입력: 셀 원시값 2차원 배열 (rows[0] = 엑셀 1행, rows[r][0] = A열). io.ts 가 exceljs 셀을 원시값으로 풀어서 넘긴다.
 */

export interface ParsedRecord {
	/** 엑셀 행 번호 (1-based) */
	row: number;
	record: Omit<YearRecord, 'id'>;
	warnings: string[];
}

export interface RowError {
	row: number;
	year: number | null;
	messages: string[];
}

export interface ParseResult {
	records: ParsedRecord[];
	errors: RowError[];
	/** 헤더 자체를 못 찾은 경우 — records/errors 는 비어 있다 */
	headerError: string | null;
}

/** 숫자 셀 파싱: 숫자 그대로, 문자열은 콤마·공백·단위 제거. 빈 값은 null, 해석 불가면 NaN */
export function parseNumber(v: unknown): number | null {
	if (v === null || v === undefined) return null;
	if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
	if (typeof v === 'boolean') return NaN;
	const s = String(v)
		.replace(/[,\s]/g, '')
		.replace(/(원|명|%)$/u, '');
	if (s === '') return null;
	if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return NaN;
	return Number(s);
}

function isBlankRow(cells: unknown[]): boolean {
	return cells.every((c) => c === null || c === undefined || String(c).trim() === '');
}

/** 헤더 행에서 열 인덱스 매핑을 만든다. 필수 열이 없으면 오류 문자열 */
export function mapHeader(headerCells: unknown[]): {
	index: Partial<Record<InputColumnKey, number>>;
	error: string | null;
} {
	const index: Partial<Record<InputColumnKey, number>> = {};
	headerCells.forEach((h, i) => {
		const col = INPUT_COLUMN_BY_HEADER.get(normalizeHeader(h));
		if (col && index[col.key] === undefined) index[col.key] = i;
	});
	const missing = INPUT_COLUMNS.filter((c) => c.required && index[c.key] === undefined);
	if (index.year === undefined || missing.length > 0) {
		return {
			index,
			error:
				`1행에서 필수 열을 찾지 못했습니다: ${missing.map((c) => c.header).join(', ') || '연도'}. ` +
				'"엑셀 템플릿" 을 내려받아 그 형식으로 작성하세요.'
		};
	}
	return { index, error: null };
}

export function parseInputRows(rows: unknown[][]): ParseResult {
	const headerCells = rows[INPUT_HEADER_ROW - 1] ?? [];
	const { index, error } = mapHeader(headerCells);
	if (error) return { records: [], errors: [], headerError: error };

	const cell = (r: unknown[], key: InputColumnKey): unknown => {
		const i = index[key];
		return i === undefined ? null : r[i];
	};

	const records: ParsedRecord[] = [];
	const errors: RowError[] = [];
	const seenYears = new Map<number, number>();

	for (let r = INPUT_FIRST_DATA_ROW - 1; r < rows.length; r++) {
		const cells = rows[r] ?? [];
		if (isBlankRow(cells)) continue;
		const rowNo = r + 1;
		const messages: string[] = [];
		const warnings: string[] = [];

		const year = parseNumber(cell(cells, 'year'));
		if (
			year === null ||
			Number.isNaN(year) ||
			!Number.isInteger(year) ||
			year < 1990 ||
			year > 2100
		)
			messages.push('연도는 1990~2100 사이의 정수여야 합니다.');
		else if (seenYears.has(year))
			messages.push(`${year}년이 ${seenYears.get(year)}행에도 있습니다 (파일 내 중복).`);

		const revenue = parseNumber(cell(cells, 'revenue'));
		if (revenue === null) messages.push('매출액이 비어 있습니다.');
		else if (Number.isNaN(revenue)) messages.push('매출액을 숫자로 읽을 수 없습니다.');

		const headcount = parseNumber(cell(cells, 'headcount'));
		if (headcount === null) messages.push('총 임직원 수가 비어 있습니다.');
		else if (Number.isNaN(headcount)) messages.push('총 임직원 수를 숫자로 읽을 수 없습니다.');

		// 영업비용 or 영업이익
		const opCost = parseNumber(cell(cells, 'operatingCost'));
		const opProfit = parseNumber(cell(cells, 'operatingProfit'));
		if (Number.isNaN(opCost)) messages.push('영업비용을 숫자로 읽을 수 없습니다.');
		if (Number.isNaN(opProfit)) messages.push('영업이익을 숫자로 읽을 수 없습니다.');
		let operatingCost: number | null = null;
		if (opCost !== null && !Number.isNaN(opCost)) {
			operatingCost = opCost;
			if (
				opProfit !== null &&
				!Number.isNaN(opProfit) &&
				revenue !== null &&
				!Number.isNaN(revenue) &&
				Math.abs(revenue - opProfit - opCost) > 1
			)
				warnings.push(
					`영업비용(${opCost.toLocaleString()})과 영업이익(${opProfit.toLocaleString()})이 맞지 않아 영업비용을 사용했습니다.`
				);
		} else if (opProfit !== null && !Number.isNaN(opProfit)) {
			if (revenue !== null && !Number.isNaN(revenue)) operatingCost = revenue - opProfit;
		} else {
			messages.push('영업비용 또는 영업이익 중 하나는 있어야 합니다.');
		}

		// 총 인건비 / 세부 6항목
		const hcTotalCell = parseNumber(cell(cells, 'hcCost'));
		if (Number.isNaN(hcTotalCell)) messages.push('총 인건비를 숫자로 읽을 수 없습니다.');
		const parts = HC_COST_KEYS.map((k) => parseNumber(cell(cells, k)));
		const anyPart = parts.some((p) => p !== null);
		let breakdown: HcCostBreakdown | null = null;
		let hcCost: number | null =
			hcTotalCell !== null && !Number.isNaN(hcTotalCell) ? hcTotalCell : null;
		if (anyPart) {
			if (parts.some((p) => Number.isNaN(p))) {
				messages.push('인건비 세부 항목 중 숫자로 읽을 수 없는 값이 있습니다.');
			} else {
				breakdown = {} as HcCostBreakdown;
				HC_COST_KEYS.forEach((k, i) => (breakdown![k] = parts[i] ?? 0));
				if (parts.some((p) => p === null))
					warnings.push('비어 있는 인건비 세부 항목은 0으로 처리했습니다.');
				const sum = sumHcCost(breakdown);
				if (hcCost === null) hcCost = sum;
				else if (Math.abs(sum - hcCost) > 1)
					messages.push(
						`인건비 세부 합계(${sum.toLocaleString()})가 총 인건비(${hcCost.toLocaleString()})와 다릅니다.`
					);
			}
		} else if (hcCost === null) {
			messages.push('총 인건비가 비어 있습니다 (세부 6항목으로 대신 입력할 수도 있습니다).');
		}

		const memoRaw = cell(cells, 'memo');
		const memo =
			memoRaw === null || memoRaw === undefined ? undefined : String(memoRaw).trim() || undefined;

		if (messages.length === 0) {
			const inputs = {
				revenue: Math.round(revenue as number),
				operatingCost: Math.round(operatingCost as number),
				hcCost: Math.round(hcCost as number),
				headcount: headcount as number
			};
			messages.push(...validateInputs(inputs));
			if (messages.length === 0) {
				seenYears.set(year as number, rowNo);
				records.push({
					row: rowNo,
					record: { year: year as number, inputs, breakdown, memo },
					warnings
				});
				continue;
			}
		}
		errors.push({ row: rowNo, year: year !== null && !Number.isNaN(year) ? year : null, messages });
	}

	return { records, errors, headerError: null };
}

export interface MergeOptions {
	/** 같은 연도가 이미 있으면 덮어쓴다 (false 면 건너뜀) */
	overwrite: boolean;
	newId: () => string;
}

export interface MergeResult {
	years: YearRecord[];
	added: number;
	updated: number;
	skipped: number;
}

/** 파싱된 레코드를 기존 연도 목록에 병합 (순수 함수). 연도로 매칭하며 덮어쓸 때 기존 id 를 유지한다 */
export function mergeYears(
	existing: YearRecord[],
	parsed: ParsedRecord[],
	opt: MergeOptions
): MergeResult {
	const years = existing.map((y) => ({
		...y,
		inputs: { ...y.inputs },
		breakdown: y.breakdown ? { ...y.breakdown } : null
	}));
	let added = 0,
		updated = 0,
		skipped = 0;
	for (const p of parsed) {
		const i = years.findIndex((y) => y.year === p.record.year);
		if (i >= 0) {
			if (!opt.overwrite) {
				skipped++;
				continue;
			}
			years[i] = { ...p.record, id: years[i].id };
			updated++;
		} else {
			years.push({ ...p.record, id: opt.newId() });
			added++;
		}
	}
	years.sort((a, b) => a.year - b.year);
	return { years, added, updated, skipped };
}
