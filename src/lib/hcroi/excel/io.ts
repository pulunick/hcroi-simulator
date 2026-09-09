import type ExcelJS from 'exceljs';
import { compareScenarios } from '../scenario';
import type { HeadcountBasis, PeriodRecord, Scenario } from '../types';
import { YEAR_MAX, YEAR_MIN, allPeriodTexts, periodLabel } from '../period';
import {
	DEFAULT_HEADCOUNT_BASIS,
	HEADCOUNT_KEYS,
	HEADCOUNT_OPTIONAL_KEYS,
	HC_COST_KEYS
} from '../types';
import { sampleRecords } from '../defaults';
import {
	BASIS_SHEET,
	CHECK_COLUMN,
	CUMULATIVE_SHEET,
	INPUT_COLUMNS,
	INPUT_FIRST_DATA_ROW,
	INPUT_HEADER_ROW,
	INPUT_PREPARED_ROWS,
	INPUT_UNIT_ROW,
	NUM_FMT,
	ORG_ROWS,
	ORG_SHEET,
	SHEET,
	UNIT_SHEET,
	columnLetter,
	headerText,
	type InputColumnKey
} from './schema';
import {
	FORMULA_LINES,
	SUMMARY_COLUMNS,
	inputRows,
	scenarioSheet,
	summaryRows,
	type CellValue,
	type LabeledRow
} from './toRows';

/**
 * exceljs 입출력. 브라우저 번들 크기(~900KB) 때문에 exceljs 는 여기서만, 동적으로 불러온다.
 * 행 데이터 생성/해석은 toRows.ts · fromRows.ts (순수 함수) 에 있다.
 *
 * 입력 시트에는 작성 편의 장치가 들어간다(docs/plans/rollup-and-excel.md §6):
 * 기간 드롭다운 · 셀 유효성 · 검증 열(수식) + 조건부 서식 · 머리글 메모 · 시트 보호(입력 칸만 열림).
 * 전부 안내용이고 규칙의 원본은 앱의 `validateRecord` 다.
 */

type Excel = typeof ExcelJS;
let excelPromise: Promise<Excel> | null = null;
async function loadExcel(): Promise<Excel> {
	excelPromise ??= import('exceljs').then(
		(m) => ((m as { default?: Excel }).default ?? m) as Excel
	);
	return excelPromise;
}

const HEADER_FILL: ExcelJS.Fill = {
	type: 'pattern',
	pattern: 'solid',
	fgColor: { argb: 'FFEAF2FC' }
};
const ERROR_FILL: ExcelJS.Fill = {
	type: 'pattern',
	pattern: 'solid',
	bgColor: { argb: 'FFFDE2E1' },
	fgColor: { argb: 'FFFDE2E1' }
};
const NOTE_FONT: Partial<ExcelJS.Font> = { italic: true, color: { argb: 'FF7B8294' }, size: 10 };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF111318' } };
/** 보호된 시트에서 입력 가능한 칸 */
const UNLOCKED: Partial<ExcelJS.Protection> = { locked: false };
/** 비밀번호 없는 보호 — 구조(머리글·검증 열)만 지키고 편집은 전부 허용 */
const PROTECT_OPTIONS: Partial<ExcelJS.WorksheetProtection> = {
	selectLockedCells: true,
	selectUnlockedCells: true,
	formatCells: true,
	formatColumns: true,
	formatRows: true,
	insertRows: true,
	deleteRows: true,
	sort: true,
	autoFilter: true
};

function styleHeaderRow(row: ExcelJS.Row) {
	row.font = HEADER_FONT;
	row.eachCell((c) => {
		c.fill = HEADER_FILL;
		c.alignment = { vertical: 'middle', wrapText: true };
	});
}

function setCells(
	row: ExcelJS.Row,
	values: CellValue[],
	numFmt?: string | ((col: number) => string)
) {
	values.forEach((v, i) => {
		const cell = row.getCell(i + 1);
		cell.value = v;
		const fmt = typeof numFmt === 'function' ? numFmt(i) : numFmt;
		if (fmt && typeof v === 'number') cell.numFmt = fmt;
	});
}

/** exceljs 타입 정의에 dataValidations 가 빠져 있어 좁혀서 쓴다 (런타임에는 있다) */
function addValidation(ws: ExcelJS.Worksheet, range: string, dv: ExcelJS.DataValidation) {
	(
		ws as unknown as { dataValidations: { add(range: string, dv: ExcelJS.DataValidation): void } }
	).dataValidations.add(range, dv);
}

function note(cell: ExcelJS.Cell, text: string) {
	cell.note = { texts: [{ text }], margins: { insetmode: 'auto' } };
}

/** 열 키 → 엑셀 열 문자 (검증 수식용) */
const COL = Object.fromEntries(INPUT_COLUMNS.map((c, i) => [c.key, columnLetter(i)])) as Record<
	InputColumnKey,
	string
>;
const CHECK_COL_INDEX = INPUT_COLUMNS.length; // 0-based → 맨 끝
const CHECK_COL = columnLetter(CHECK_COL_INDEX);
const LAST_DATA_ROW = INPUT_FIRST_DATA_ROW + INPUT_PREPARED_ROWS - 1;

/**
 * 행 하나의 검증 수식. 앱의 validateRecord/parseInputRows 와 같은 규칙을 엑셀 수식으로 —
 * 필수 누락 · 세부 합계>총액 · 총원≠구분 합계(조직 정보 시트의 포함 설정 반영) · 인건비>영업비용.
 */
function checkFormula(r: number): string {
	const c = (k: InputColumnKey) => `${COL[k]}${r}`;
	const org = `'${SHEET.org}'`;
	const parts = HC_COST_KEYS.map(c);
	const breakdownSum = `SUM(${parts[0]}:${parts[parts.length - 1]})`;
	const heads = HEADCOUNT_KEYS.map(c);
	const headsSum = `SUM(${heads[0]}:${heads[heads.length - 1]})`;
	const basisSum =
		c('regular') +
		HEADCOUNT_OPTIONAL_KEYS.map(
			(k) => `+IF(${org}!$B$${ORG_ROWS.include[k]}="${BASIS_SHEET.yes}",${c(k)},0)`
		).join('');
	const rule = (cond: string, msg: string) => `IF(${cond},"${msg} ","")`;
	const body = [
		rule(`AND(${c('operatingCost')}="",${c('operatingProfit')}="")`, '영업비용/영업이익 없음'),
		rule(`AND(${c('headcount')}="",${headsSum}=0)`, '임직원 수 없음'),
		rule(`AND(${c('hcCost')}="",${breakdownSum}=0)`, '총 인건비 없음'),
		rule(`AND(${c('hcCost')}<>"",${breakdownSum}>${c('hcCost')})`, '세부 합계>총 인건비'),
		rule(
			`AND(${c('headcount')}<>"",${headsSum}>0,${c('headcount')}<>${basisSum})`,
			'총원≠인원 구분 합계'
		),
		rule(
			`AND(${c('hcCost')}<>"",${c('operatingCost')}<>"",${c('hcCost')}>${c('operatingCost')})`,
			'인건비>영업비용'
		),
		rule(`${c('revenue')}=""`, '매출액 없음')
	].join('&');
	return `IF(${c('year')}="","",TRIM(${body}))`;
}

function addInputSheet(wb: ExcelJS.Workbook, records: PeriodRecord[]) {
	const ws = wb.addWorksheet(SHEET.input);
	ws.columns = [...INPUT_COLUMNS.map((c) => ({ width: c.width })), { width: CHECK_COLUMN.width }];
	const header = ws.getRow(INPUT_HEADER_ROW);
	setCells(header, [...INPUT_COLUMNS.map(headerText), CHECK_COLUMN.header]);
	styleHeaderRow(header);
	INPUT_COLUMNS.forEach((c, i) => note(header.getCell(i + 1), c.note));
	note(header.getCell(CHECK_COL_INDEX + 1), CHECK_COLUMN.note);
	const unit = ws.getRow(INPUT_UNIT_ROW);
	setCells(unit, [...INPUT_COLUMNS.map((c) => c.note), CHECK_COLUMN.note]);
	unit.font = NOTE_FONT;
	unit.eachCell((c) => (c.alignment = { wrapText: true, vertical: 'top' }));
	unit.height = 30;

	const rows = inputRows(records);
	rows.forEach((r, i) => {
		const row = ws.getRow(INPUT_FIRST_DATA_ROW + i);
		setCells(
			row,
			INPUT_COLUMNS.map((c) => r[c.key]),
			(col) => {
				const c = INPUT_COLUMNS[col];
				return c.key === 'year'
					? NUM_FMT.year
					: c.key === 'period' || c.key === 'memo'
						? '@'
						: c.unit === '원'
							? NUM_FMT.won
							: c.unit === '명'
								? '0'
								: '@';
			}
		);
	});

	// 입력 칸 열기 + 검증 수식 (미리 준비한 행까지)
	for (let r = INPUT_FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
		const row = ws.getRow(r);
		for (let ci = 1; ci <= INPUT_COLUMNS.length; ci++) row.getCell(ci).protection = UNLOCKED;
		const check = row.getCell(CHECK_COL_INDEX + 1);
		check.value = { formula: checkFormula(r) };
		check.font = { color: { argb: 'FFB42318' }, size: 10 };
	}

	// 셀 유효성 — 기간 드롭다운, 연도 범위, 금액 0 이상, 인원 0 이상 정수
	const range = (k: InputColumnKey) => `${COL[k]}${INPUT_FIRST_DATA_ROW}:${COL[k]}${LAST_DATA_ROW}`;
	addValidation(ws, range('year'), {
		type: 'whole',
		operator: 'between',
		formulae: [YEAR_MIN, YEAR_MAX],
		showErrorMessage: true,
		errorTitle: '연도',
		error: `${YEAR_MIN}~${YEAR_MAX} 사이의 정수를 넣으세요.`
	});
	addValidation(ws, range('period'), {
		type: 'list',
		allowBlank: true,
		formulae: [`"${allPeriodTexts().join(',')}"`],
		showErrorMessage: true,
		errorTitle: '기간',
		error: '목록에서 고르세요 (비우면 연간).'
	});
	for (const c of INPUT_COLUMNS) {
		if (c.unit === '원')
			addValidation(ws, range(c.key), {
				type: 'decimal',
				operator: 'greaterThanOrEqual',
				formulae: [0],
				showErrorMessage: true,
				errorTitle: c.header,
				error: '0 이상의 숫자를 넣으세요 (단위는 조직 정보 시트).'
			});
		else if (c.unit === '명')
			addValidation(ws, range(c.key), {
				type: 'whole',
				operator: 'greaterThanOrEqual',
				formulae: [0],
				showErrorMessage: true,
				errorTitle: c.header,
				error: '0 이상의 정수를 넣으세요.'
			});
	}
	// 검증 열에 내용이 있으면 행 전체를 붉게
	ws.addConditionalFormatting({
		ref: `A${INPUT_FIRST_DATA_ROW}:${CHECK_COL}${LAST_DATA_ROW}`,
		rules: [
			{
				type: 'expression',
				priority: 1,
				formulae: [`$${CHECK_COL}${INPUT_FIRST_DATA_ROW}<>""`],
				style: { fill: ERROR_FILL }
			}
		]
	});
	ws.views = [{ state: 'frozen', xSplit: 2, ySplit: INPUT_UNIT_ROW }];
	return ws;
}

function addSummarySheet(wb: ExcelJS.Workbook, records: PeriodRecord[]) {
	const ws = wb.addWorksheet(SHEET.summary);
	ws.columns = SUMMARY_COLUMNS.map((c) => ({ width: c.width }));
	const note = ws.getRow(1);
	note.getCell(1).value =
		'계산 결과 스냅샷입니다 (가져오기 시 무시). "(합산)" 은 하위 기간에서 계산된 기간. 입력을 고치려면 "입력 데이터" 시트를 수정하세요. HCROI = (영업이익 + 총 인건비) ÷ 총 인건비';
	note.font = NOTE_FONT;
	ws.mergeCells(1, 1, 1, SUMMARY_COLUMNS.length);
	const header = ws.getRow(2);
	setCells(
		header,
		SUMMARY_COLUMNS.map((c) => c.header)
	);
	styleHeaderRow(header);
	summaryRows(records).forEach((vals, i) => {
		setCells(ws.getRow(3 + i), vals, (col) => SUMMARY_COLUMNS[col].numFmt);
	});
	ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];
}

function addScenarioSheet(wb: ExcelJS.Workbook, base: PeriodRecord, scenarios: Scenario[]) {
	const ws = wb.addWorksheet(SHEET.scenarios);
	const sheet = scenarioSheet(periodLabel(base.period), compareScenarios(base.inputs, scenarios));
	ws.columns = [
		{ width: 26 },
		{ width: 16 },
		{ width: 16 },
		{ width: 14 },
		{ width: 16 },
		{ width: 14 }
	];

	let r = 1;
	ws.getRow(r).getCell(1).value =
		`기준 기간 ${periodLabel(base.period)}${base.derived ? ' (합산)' : ''} · 내보내기 시점의 시나리오 파라미터와 결과 (가져오기 시 무시)`;
	ws.getRow(r).font = NOTE_FONT;
	r += 2;

	ws.getRow(r).getCell(1).value = '시나리오 파라미터';
	ws.getRow(r).font = HEADER_FONT;
	r++;
	setCells(ws.getRow(r), sheet.paramHeader);
	styleHeaderRow(ws.getRow(r));
	r++;
	const put = (row: LabeledRow) => {
		setCells(ws.getRow(r), [row.label, ...row.values], (col) => (col === 0 ? '@' : row.numFmt));
		r++;
	};
	sheet.params.forEach(put);
	r++;

	ws.getRow(r).getCell(1).value = '결과 비교';
	ws.getRow(r).font = HEADER_FONT;
	r++;
	setCells(ws.getRow(r), sheet.metricHeader);
	styleHeaderRow(ws.getRow(r));
	r++;
	sheet.metrics.forEach(put);
}

function addFormulaSheet(wb: ExcelJS.Workbook) {
	const ws = wb.addWorksheet(SHEET.formulas);
	ws.columns = [{ width: 110 }];
	FORMULA_LINES.forEach((line, i) => {
		const cell = ws.getRow(i + 1).getCell(1);
		cell.value = line;
		cell.alignment = { wrapText: true };
		if (line && !line.startsWith(' ') && !/[=×÷]/.test(line) && line.length < 12)
			cell.font = HEADER_FONT;
	});
}

/**
 * 시트 ⑤ `조직 정보` — 회사/조직 이름 + 임직원 수 산정 기준 + 금액 단위 + 손익 입력 방식.
 * 가져오기 때 다시 읽는 값은 이 시트와 `입력 데이터` 뿐이다. 행 번호는 ORG_ROWS(검증 수식이 참조).
 */
function addOrgSheet(wb: ExcelJS.Workbook, orgName: string, basis: HeadcountBasis) {
	const ws = wb.addWorksheet(SHEET.org);
	ws.columns = [{ width: 26 }, { width: 40 }];

	const put = (r: number, label: string, value: string | null, options?: readonly string[]) => {
		const row = ws.getRow(r);
		const l = row.getCell(1);
		l.value = label;
		l.font = HEADER_FONT;
		l.fill = HEADER_FILL;
		const v = row.getCell(2);
		v.value = value;
		v.numFmt = '@';
		v.protection = UNLOCKED;
		if (options)
			addValidation(ws, `B${r}`, {
				type: 'list',
				allowBlank: true,
				formulae: [`"${options.join(',')}"`],
				showErrorMessage: true,
				error: `목록에서 고르세요: ${options.join(' / ')}`
			});
	};
	const noteRow = (r: number, text: string) => {
		const c = ws.getRow(r).getCell(1);
		c.value = text;
		c.font = NOTE_FONT;
		c.alignment = { wrapText: true };
		ws.mergeCells(r, 1, r, 2);
	};

	put(ORG_ROWS.name, ORG_SHEET.label, orgName.trim() || null);
	noteRow(ORG_ROWS.name + 1, ORG_SHEET.note);
	put(
		ORG_ROWS.method,
		BASIS_SHEET.method.label,
		basis.method === 'periodEnd' ? BASIS_SHEET.method.periodEnd : BASIS_SHEET.method.average,
		[BASIS_SHEET.method.average, BASIS_SHEET.method.periodEnd]
	);
	HEADCOUNT_OPTIONAL_KEYS.forEach((k) =>
		put(
			ORG_ROWS.include[k],
			BASIS_SHEET.include[k],
			basis.include[k] ? BASIS_SHEET.yes : BASIS_SHEET.no,
			[BASIS_SHEET.yes, BASIS_SHEET.no]
		)
	);
	noteRow(ORG_ROWS.include.executive + 1, BASIS_SHEET.note);
	put(
		ORG_ROWS.unit,
		UNIT_SHEET.label,
		UNIT_SHEET.options[0].label,
		UNIT_SHEET.options.map((o) => o.label)
	);
	noteRow(ORG_ROWS.unit + 1, UNIT_SHEET.note);
	put(ORG_ROWS.cumulative, CUMULATIVE_SHEET.label, CUMULATIVE_SHEET.period, [
		CUMULATIVE_SHEET.period,
		CUMULATIVE_SHEET.cumulative
	]);
	noteRow(ORG_ROWS.cumulative + 1, CUMULATIVE_SHEET.note);
	return ws;
}

/** 입력 대상 시트를 보호한다 — 비밀번호 없음. 머리글·검증 열·라벨만 잠기고 입력 칸은 열려 있다 */
async function protectInputSheets(sheets: ExcelJS.Worksheet[]) {
	for (const ws of sheets) await ws.protect('', PROTECT_OPTIONS);
}

export interface ExportData {
	/** 직접 입력한 기간 — `입력 데이터` 시트 */
	records: PeriodRecord[];
	scenarios: Scenario[];
	/** 시나리오 시트의 기준 기간 (없으면 시나리오 시트 생략) */
	base: PeriodRecord | null;
	/** 대시보드 제목에 붙는 회사/조직 이름 (빈 문자열이면 빈 칸으로 내보낸다) */
	orgName?: string;
	/** 임직원 수 산정 기준 — 인원 구분을 쓴 연도의 총원이 이 기준으로 정해진다 */
	headcountBasis?: HeadcountBasis;
	/** `지표 요약` 시트에 실을 목록 (합산 레코드 포함). 없으면 records */
	summaryRecords?: PeriodRecord[];
}

/** 작업공간 전체 → .xlsx (시트 ①②③ + 조직 정보 + 산식) */
export async function buildWorkbookBuffer(data: ExportData): Promise<ArrayBuffer> {
	const Excel = await loadExcel();
	const wb = new Excel.Workbook();
	wb.creator = 'HCROI 시뮬레이터';
	wb.created = new Date();
	addSummarySheet(wb, data.summaryRecords ?? data.records);
	const input = addInputSheet(wb, data.records);
	if (data.base) addScenarioSheet(wb, data.base, data.scenarios);
	const org = addOrgSheet(wb, data.orgName ?? '', data.headcountBasis ?? DEFAULT_HEADCOUNT_BASIS);
	addFormulaSheet(wb);
	await protectInputSheets([input, org]);
	return toArrayBuffer(await wb.xlsx.writeBuffer());
}

/** 입력 템플릿 (.xlsx) — 시트 ② 구조 + 샘플 행 + 조직 정보 + 산식 시트 */
export async function buildTemplateBuffer(opts: { withSample: boolean } = { withSample: true }) {
	const Excel = await loadExcel();
	const wb = new Excel.Workbook();
	wb.creator = 'HCROI 시뮬레이터';
	const input = addInputSheet(wb, opts.withSample ? sampleRecords() : []);
	const org = addOrgSheet(wb, '', DEFAULT_HEADCOUNT_BASIS);
	addFormulaSheet(wb);
	await protectInputSheets([input, org]);
	return toArrayBuffer(await wb.xlsx.writeBuffer());
}

/** exceljs 셀 값 → 원시값 (수식 결과, 리치텍스트, 하이퍼링크, 날짜 등을 평탄화) */
export function cellToPrimitive(v: ExcelJS.CellValue): unknown {
	if (v === null || v === undefined) return null;
	if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
	if (v instanceof Date) return v.getFullYear();
	if (typeof v === 'object') {
		// 수식 셀: 엑셀에서 한 번 열어 저장하기 전에는 결과가 없다 → 빈 칸 (템플릿의 검증 열이 여기 해당)
		if ('formula' in v || 'sharedFormula' in v)
			return 'result' in v ? cellToPrimitive(v.result as ExcelJS.CellValue) : null;
		if ('result' in v) return cellToPrimitive(v.result as ExcelJS.CellValue);
		if ('richText' in v) return v.richText.map((t) => t.text).join('');
		if ('text' in v)
			return typeof v.text === 'string' ? v.text : cellToPrimitive(v.text as ExcelJS.CellValue);
		if ('error' in v) return null;
	}
	return String(v);
}

/** 시트 하나 → 2차원 원시값 배열 (rows[0] = 1행, rows[r][0] = A열) */
function sheetRows(ws: ExcelJS.Worksheet): unknown[][] {
	const rows: unknown[][] = [];
	ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
		const cells: unknown[] = [];
		row.eachCell({ includeEmpty: true }, (cell, col) => {
			cells[col - 1] = cellToPrimitive(cell.value);
		});
		rows[rowNumber - 1] = cells;
	});
	for (let i = 0; i < rows.length; i++) rows[i] ??= [];
	return rows;
}

export interface ReadResult {
	/** 시트 ② `입력 데이터` (없으면 첫 시트) */
	input: unknown[][];
	/** 시트 ⑤ `조직 정보` — 시트가 없으면 null (= 제목을 건드리지 않음) */
	org: unknown[][] | null;
}

/**
 * 업로드된 .xlsx 에서 가져오기 대상 시트들을 원시값 배열로 읽는다.
 * `입력 데이터` 시트가 없으면 첫 시트를 사용한다 (사용자가 시트명을 바꾼 경우 대비).
 */
export async function readWorkbook(buffer: ArrayBuffer): Promise<ReadResult> {
	const Excel = await loadExcel();
	const wb = new Excel.Workbook();
	await wb.xlsx.load(buffer);
	const input = wb.getWorksheet(SHEET.input) ?? wb.worksheets[0];
	const org = wb.getWorksheet(SHEET.org);
	return { input: input ? sheetRows(input) : [], org: org ? sheetRows(org) : null };
}

/** 시트 ② 만 필요할 때 */
export async function readInputSheet(buffer: ArrayBuffer): Promise<unknown[][]> {
	return (await readWorkbook(buffer)).input;
}

function toArrayBuffer(buf: ArrayBuffer | Uint8Array): ArrayBuffer {
	if (buf instanceof ArrayBuffer) return buf;
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 브라우저 다운로드 (JSON 내보내기와 같은 패턴) */
export function downloadBuffer(buffer: ArrayBuffer, filename: string) {
	const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
