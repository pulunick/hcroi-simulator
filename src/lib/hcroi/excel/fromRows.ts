import {
	sumHcCost,
	sumHeadcount,
	validateBreakdown,
	validateHeadcountBreakdown,
	validateInputs
} from '../formulas';
import {
	DEFAULT_HEADCOUNT_BASIS,
	HC_COST_KEYS,
	HEADCOUNT_KEYS,
	HEADCOUNT_OPTIONAL_KEYS,
	type HcCostBreakdown,
	type HeadcountBasis,
	type HeadcountBreakdown,
	type Period,
	type PeriodRecord
} from '../types';
import {
	YEAR_MAX,
	YEAR_MIN,
	comparePeriods,
	isValidYear,
	parsePeriodText,
	periodKey,
	periodLabel,
	periodText
} from '../period';
import {
	BASIS_SHEET,
	CUMULATIVE_SHEET,
	INPUT_COLUMN_BY_HEADER,
	INPUT_COLUMNS,
	INPUT_FIRST_DATA_ROW,
	INPUT_HEADER_ROW,
	ORG_SHEET,
	UNIT_SHEET,
	normalizeHeader,
	type InputColumnKey
} from './schema';

/**
 * 시트 ② 행 → PeriodRecord (순수 함수, exceljs 무관).
 * 입력: 셀 원시값 2차원 배열 (rows[0] = 엑셀 1행, rows[r][0] = A열). io.ts 가 exceljs 셀을 원시값으로 풀어서 넘긴다.
 */

export interface ParsedRecord {
	/** 엑셀 행 번호 (1-based) */
	row: number;
	record: Omit<PeriodRecord, 'id'>;
	warnings: string[];
}

export interface RowError {
	row: number;
	/** 읽힌 기간 (연도조차 못 읽었으면 null) */
	period: Period | null;
	messages: string[];
}

export interface ParseResult {
	records: ParsedRecord[];
	errors: RowError[];
	/** 헤더 자체를 못 찾은 경우 — records/errors 는 비어 있다 */
	headerError: string | null;
}

/** 파싱 옵션 — `조직 정보` 시트가 나르는 값들 (없으면 기본: 정규직만 · 원 · 기간 실적) */
export interface ParseOptions {
	/** 인원 구분 합계를 낼 때 쓸 산정 기준 (파일의 `조직 정보` 시트 값 → 없으면 현재 설정) */
	basis?: HeadcountBasis;
	/** 금액 칸에 곱할 배수 (천원이면 1000). 기본 1 */
	scale?: number;
	/** 손익(매출·영업비용·영업이익·인건비·세부)이 누계로 적혀 있으면 true — 앞 순번을 빼서 기간 실적으로 만든다 */
	cumulative?: boolean;
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

/** parseNumber 결과가 실제 숫자인지 (null·NaN 제외) */
function isNum(x: number | null): x is number {
	return x !== null && Number.isFinite(x);
}

/**
 * 세부 항목 열 묶음(인건비 6항목 · 인원 구분 4항목) 공통 파서.
 * 하나도 없으면 `parts: null`, 숫자로 못 읽는 칸이 있으면 `error`, 빈 칸은 0 으로 채우고 `blank` 표시.
 */
function parseParts<K extends string>(
	values: (number | null)[],
	keys: readonly K[],
	what: string
): { parts: Record<K, number> | null; error: string | null; blank: boolean } {
	if (values.every((p) => p === null)) return { parts: null, error: null, blank: false };
	if (values.some((p) => p !== null && Number.isNaN(p)))
		return { parts: null, error: `${what} 중 숫자로 읽을 수 없는 값이 있습니다.`, blank: false };
	const parts = Object.fromEntries(keys.map((k, i) => [k, values[i] ?? 0])) as Record<K, number>;
	return { parts, error: null, blank: values.some((p) => p === null) };
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

/** 옛 호출 형태(두 번째 인자가 산정 기준)도 받는다 */
function toOptions(o: HeadcountBasis | ParseOptions | undefined): Required<ParseOptions> {
	const opts: ParseOptions = o && 'method' in o ? { basis: o } : (o ?? {});
	return {
		basis: opts.basis ?? DEFAULT_HEADCOUNT_BASIS,
		scale: opts.scale && Number.isFinite(opts.scale) && opts.scale > 0 ? opts.scale : 1,
		cumulative: opts.cumulative ?? false
	};
}

export function parseInputRows(
	rows: unknown[][],
	options?: HeadcountBasis | ParseOptions
): ParseResult {
	const { basis, scale, cumulative } = toOptions(options);
	const headerCells = rows[INPUT_HEADER_ROW - 1] ?? [];
	const { index, error } = mapHeader(headerCells);
	if (error) return { records: [], errors: [], headerError: error };

	const cell = (r: unknown[], key: InputColumnKey): unknown => {
		const i = index[key];
		return i === undefined ? null : r[i];
	};
	// 금액 칸은 파일 단위(원·천원·백만원)를 원으로 환산해 읽는다
	const amount = (r: unknown[], key: InputColumnKey): number | null => {
		const v = parseNumber(cell(r, key));
		return isNum(v) ? v * scale : v;
	};

	const records: ParsedRecord[] = [];
	const errors: RowError[] = [];
	const seen = new Map<string, number>();

	for (let r = INPUT_FIRST_DATA_ROW - 1; r < rows.length; r++) {
		const cells = rows[r] ?? [];
		if (isBlankRow(cells)) continue;
		const rowNo = r + 1;
		const messages: string[] = [];
		const warnings: string[] = [];

		const year = parseNumber(cell(cells, 'year'));
		if (!isValidYear(year)) messages.push(`연도는 ${YEAR_MIN}~${YEAR_MAX} 사이의 정수여야 합니다.`);

		// 기간: 빈 칸 = 연간. 옛 파일(기간 열 없음)도 자연히 연간으로 읽힌다
		const pt = parsePeriodText(cell(cells, 'period'));
		if (pt === null)
			messages.push(
				`기간 "${String(cell(cells, 'period')).trim()}" 을(를) 읽을 수 없습니다 (1분기~4분기 · 상반기/하반기 · 1월~12월 · 연간 또는 빈 칸).`
			);
		// 연도·기간 텍스트가 모두 유효할 때만 기간이 만들어진다 (파서가 낸 유형·순번은 항상 범위 안)
		const period: Period | null = isValidYear(year) && pt ? { year, ...pt } : null;
		if (period && seen.has(periodKey(period)))
			messages.push(
				`${periodLabel(period)}이(가) ${seen.get(periodKey(period))}행에도 있습니다 (파일 내 중복).`
			);

		const revenue = amount(cells, 'revenue');
		if (revenue === null) messages.push('매출액이 비어 있습니다.');
		else if (Number.isNaN(revenue)) messages.push('매출액을 숫자로 읽을 수 없습니다.');

		// 총 임직원 수 / 인원 구분 4항목
		const headTotalCell = parseNumber(cell(cells, 'headcount'));
		if (headTotalCell !== null && Number.isNaN(headTotalCell))
			messages.push('총 임직원 수를 숫자로 읽을 수 없습니다.');
		const hp = parseParts(
			HEADCOUNT_KEYS.map((k) => parseNumber(cell(cells, k))),
			HEADCOUNT_KEYS,
			'인원 구분'
		);
		if (hp.error) messages.push(hp.error);
		const headcountBreakdown: HeadcountBreakdown | null = hp.parts;
		let headcount: number | null = isNum(headTotalCell) ? headTotalCell : null;
		if (headcountBreakdown) {
			if (hp.blank) warnings.push('비어 있는 인원 구분은 0으로 처리했습니다.');
			const bad = validateHeadcountBreakdown(headcountBreakdown);
			if (bad.length) messages.push(...bad);
			else {
				// 구분을 쓴 기간의 총원은 산정 기준을 적용한 합계가 정답이다 (총원 칸은 참고값).
				// 반영 시점의 기준으로 다시 계산되므로(workspace.replaceRecords) 여기서 쓴 basis 는 미리보기용이다.
				const sum = sumHeadcount(headcountBreakdown, basis);
				if (headcount !== null && Math.abs(headcount - sum) > 0.5)
					warnings.push(
						`총 임직원 수(${headcount.toLocaleString()}명)가 산정 기준을 적용한 인원 구분 합계` +
							`(${sum.toLocaleString()}명)와 달라 합계를 사용했습니다.`
					);
				headcount = sum;
			}
		} else if (headTotalCell === null) {
			messages.push('총 임직원 수가 비어 있습니다 (인원 구분으로 대신 입력할 수도 있습니다).');
		}

		// 영업비용 or 영업이익
		const opCost = amount(cells, 'operatingCost');
		const opProfit = amount(cells, 'operatingProfit');
		if (Number.isNaN(opCost)) messages.push('영업비용을 숫자로 읽을 수 없습니다.');
		if (Number.isNaN(opProfit)) messages.push('영업이익을 숫자로 읽을 수 없습니다.');
		let operatingCost: number | null = null;
		if (isNum(opCost)) {
			operatingCost = opCost;
			if (isNum(opProfit) && isNum(revenue) && Math.abs(revenue - opProfit - opCost) > 1)
				warnings.push(
					`영업비용(${opCost.toLocaleString()})과 영업이익(${opProfit.toLocaleString()})이 맞지 않아 영업비용을 사용했습니다.`
				);
		} else if (isNum(opProfit)) {
			if (isNum(revenue)) operatingCost = revenue - opProfit;
		} else {
			messages.push('영업비용 또는 영업이익 중 하나는 있어야 합니다.');
		}

		// 총 인건비 / 세부 6항목
		const hcTotalCell = amount(cells, 'hcCost');
		if (Number.isNaN(hcTotalCell)) messages.push('총 인건비를 숫자로 읽을 수 없습니다.');
		const cp = parseParts(
			HC_COST_KEYS.map((k) => amount(cells, k)),
			HC_COST_KEYS,
			'인건비 세부 항목'
		);
		if (cp.error) messages.push(cp.error);
		const breakdown: HcCostBreakdown | null = cp.parts;
		let hcCost: number | null = isNum(hcTotalCell) ? hcTotalCell : null;
		if (breakdown) {
			if (cp.blank) warnings.push('비어 있는 인건비 세부 항목은 0으로 처리했습니다.');
			const sum = sumHcCost(breakdown);
			if (hcCost === null) hcCost = sum;
			else if (hcCost - sum > 1)
				// 6항목을 다 쓰지 않는 회사(예: 법정후생비·교육훈련비 미분리)를 위해 허용한다.
				// 총 인건비를 그대로 쓰고 차액은 미분류로 남긴다 — 지표는 총액으로 계산되므로 영향 없음.
				// (합계 > 총액은 validateRecord 와 같은 규칙으로 아래에서 오류 처리)
				warnings.push(
					`인건비 세부 합계(${sum.toLocaleString()})가 총 인건비(${hcCost.toLocaleString()})보다 ` +
						`${(hcCost - sum).toLocaleString()} 적습니다. 총 인건비를 사용하고 차액은 미분류로 둡니다.`
				);
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
			const rounded = breakdown ? roundParts(breakdown, HC_COST_KEYS) : null;
			messages.push(...validateInputs(inputs), ...validateBreakdown(inputs, rounded));
			if (messages.length === 0) {
				seen.set(periodKey(period as Period), rowNo);
				records.push({
					row: rowNo,
					record: {
						period: period as Period,
						inputs,
						breakdown: rounded,
						headcountBreakdown,
						memo
					},
					warnings
				});
				continue;
			}
		}
		errors.push({ row: rowNo, period, messages });
	}

	if (cumulative) return { ...deCumulate(records), headerError: null };
	return { records, errors, headerError: null };
}

function roundParts<K extends string>(
	parts: Record<K, number>,
	keys: readonly K[]
): Record<K, number> {
	return Object.fromEntries(keys.map((k) => [k, Math.round(parts[k])])) as Record<K, number>;
}

/**
 * 누계 → 기간 실적. 같은 연도·같은 유형 안에서 순번 i 의 손익 = 누계 i − 누계 i−1 (1순번은 그대로).
 * 앞 순번이 파일에 없으면 그 행은 오류(추정하지 않는다). 인원은 누계가 아니므로 손대지 않는다.
 */
function deCumulate(parsed: ParsedRecord[]): { records: ParsedRecord[]; errors: RowError[] } {
	const byKey = new Map(parsed.map((p) => [periodKey(p.record.period), p]));
	const records: ParsedRecord[] = [];
	const errors: RowError[] = [];
	for (const p of parsed) {
		const { period } = p.record;
		if (period.type === 'Y' || period.index === 1) {
			records.push(p);
			continue;
		}
		const prevPeriod: Period = { ...period, index: period.index - 1 };
		const prev = byKey.get(periodKey(prevPeriod));
		if (!prev) {
			errors.push({
				row: p.row,
				period,
				messages: [
					`누계 입력인데 앞 순번(${periodText(prevPeriod)})이 파일에 없어 ${periodText(period)} 실적을 만들 수 없습니다.`
				]
			});
			continue;
		}
		const a = p.record;
		const b = prev.record; // 누계값 그대로 (byKey 는 변환 전 레코드를 가리킨다)
		const inputs = {
			revenue: a.inputs.revenue - b.inputs.revenue,
			operatingCost: a.inputs.operatingCost - b.inputs.operatingCost,
			hcCost: a.inputs.hcCost - b.inputs.hcCost,
			headcount: a.inputs.headcount
		};
		const breakdown =
			a.breakdown && b.breakdown
				? (Object.fromEntries(
						HC_COST_KEYS.map((k) => [
							k,
							(a.breakdown as HcCostBreakdown)[k] - (b.breakdown as HcCostBreakdown)[k]
						])
					) as unknown as HcCostBreakdown)
				: a.breakdown;
		const messages = [...validateInputs(inputs), ...validateBreakdown(inputs, breakdown)];
		if (messages.length) {
			errors.push({
				row: p.row,
				period,
				messages: [`누계에서 앞 순번을 뺀 값이 이상합니다: ${messages.join(' ')}`]
			});
			continue;
		}
		records.push({
			row: p.row,
			record: { ...a, inputs, breakdown },
			warnings: [...p.warnings, `누계 − ${periodText(prevPeriod)} 누계로 기간 실적을 만들었습니다.`]
		});
	}
	return { records, errors };
}

export interface MergeOptions {
	/** 같은 기간이 이미 있으면 덮어쓴다 (false 면 건너뜀) */
	overwrite: boolean;
	newId: () => string;
}

export interface MergeResult {
	records: PeriodRecord[];
	added: number;
	updated: number;
	skipped: number;
}

/** 파싱된 레코드를 기존 목록에 병합 (순수 함수). 기간(연도+유형+순번)으로 매칭하며 덮어쓸 때 기존 id 를 유지한다 */
export function mergeRecords(
	existing: PeriodRecord[],
	parsed: ParsedRecord[],
	opt: MergeOptions
): MergeResult {
	const records = existing.map((y) => ({
		...y,
		inputs: { ...y.inputs },
		breakdown: y.breakdown ? { ...y.breakdown } : null,
		headcountBreakdown: y.headcountBreakdown ? { ...y.headcountBreakdown } : null
	}));
	// 기간 키 → 위치. parseInputRows 가 파일 안 중복을 이미 걸렀으므로 한 번만 만들면 된다
	const index = new Map(records.map((r, i) => [periodKey(r.period), i]));
	let added = 0,
		updated = 0,
		skipped = 0;
	for (const p of parsed) {
		const key = periodKey(p.record.period);
		const i = index.get(key) ?? -1;
		if (i >= 0) {
			if (!opt.overwrite) {
				skipped++;
				continue;
			}
			records[i] = { ...p.record, id: records[i].id };
			updated++;
		} else {
			index.set(key, records.length);
			records.push({ ...p.record, id: opt.newId() });
			added++;
		}
	}
	records.sort((a, b) => comparePeriods(a.period, b.period));
	return { records, added, updated, skipped };
}

/** 조직명 최대 길이 — 대시보드 제목이 한 줄을 넘지 않도록 자른다 */
export const ORG_NAME_MAX = 40;

/**
 * `조직 정보` 시트에서 라벨 칸을 찾아 그 오른쪽 첫 비어 있지 않은 칸을 돌려준다.
 * 라벨이 없으면 null, 라벨은 있고 값이 비었으면 ''. parseOrgName·parseHeadcountBasis 등이 같은 규칙을 쓴다.
 */
function findLabelValue(rows: unknown[][], label: string): string | null {
	const want = normalizeHeader(label);
	for (const cells of rows.slice(0, ORG_SHEET.scanRows)) {
		const row = cells ?? [];
		const i = row.findIndex((c) => normalizeHeader(c) === want);
		if (i < 0) continue;
		const raw = row.slice(i + 1).find((c) => c !== null && c !== undefined && String(c).trim());
		return raw === undefined ? '' : String(raw).trim();
	}
	return null;
}

/**
 * 시트 ⑤ `조직 정보` → 회사/조직 이름 (순수 함수).
 * - 시트 자체가 없으면 `null` — 제목을 건드리지 않는다 (조직 정보 시트가 없던 옛 파일 호환)
 * - 라벨은 있고 값이 비었으면 `''` — 기본 제목("HCROI 대시보드")으로 되돌린다는 뜻
 */
export function parseOrgName(rows: unknown[][] | null): string | null {
	if (!rows) return null;
	const v = findLabelValue(rows, ORG_SHEET.label);
	return v === null ? null : v.slice(0, ORG_NAME_MAX);
}

/**
 * 시트 ⑤ `조직 정보` → 임직원 수 산정 기준 (순수 함수).
 * 기준 행이 하나도 없으면 `null` — 옛 파일이므로 현재 설정을 그대로 둔다.
 */
export function parseHeadcountBasis(rows: unknown[][] | null): HeadcountBasis | null {
	if (!rows) return null;
	const basis: HeadcountBasis = structuredClone(DEFAULT_HEADCOUNT_BASIS);
	let found = false;

	const method = findLabelValue(rows, BASIS_SHEET.method.label);
	if (method !== null) {
		found = true;
		if (normalizeHeader(method) === normalizeHeader(BASIS_SHEET.method.periodEnd))
			basis.method = 'periodEnd';
	}
	const yes = normalizeHeader(BASIS_SHEET.yes);
	for (const k of HEADCOUNT_OPTIONAL_KEYS) {
		const v = findLabelValue(rows, BASIS_SHEET.include[k]);
		if (v === null) continue;
		found = true;
		basis.include[k] = normalizeHeader(v) === yes;
	}
	return found ? basis : null;
}

/** `조직 정보` 시트의 금액 단위. 라벨이 없거나 비었거나 모르는 값이면 원(1) — 옛 파일은 전부 원 단위였다 */
export function parseAmountUnit(rows: unknown[][] | null): { label: string; scale: number } {
	const fallback = { label: UNIT_SHEET.options[0].label, scale: 1 };
	if (!rows) return fallback;
	const v = findLabelValue(rows, UNIT_SHEET.label);
	if (!v) return fallback;
	const hit = UNIT_SHEET.options.find((o) => normalizeHeader(o.label) === normalizeHeader(v));
	return hit ? { label: hit.label, scale: hit.scale } : fallback;
}

/** `조직 정보` 시트의 손익 입력 방식. "누계" 일 때만 true */
export function parseCumulative(rows: unknown[][] | null): boolean {
	if (!rows) return false;
	const v = findLabelValue(rows, CUMULATIVE_SHEET.label);
	return v !== null && normalizeHeader(v) === normalizeHeader(CUMULATIVE_SHEET.cumulative);
}
