import type ExcelJS from 'exceljs';
import { compareScenarios } from '../scenario';
import type { Scenario, YearRecord } from '../types';
import { sampleYears } from '../defaults';
import {
	INPUT_COLUMNS,
	INPUT_FIRST_DATA_ROW,
	INPUT_HEADER_ROW,
	INPUT_UNIT_ROW,
	NUM_FMT,
	SHEET,
	headerText
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
const NOTE_FONT: Partial<ExcelJS.Font> = { italic: true, color: { argb: 'FF7B8294' }, size: 10 };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF111318' } };

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

function addInputSheet(wb: ExcelJS.Workbook, years: YearRecord[]) {
	const ws = wb.addWorksheet(SHEET.input);
	ws.columns = INPUT_COLUMNS.map((c) => ({ width: c.width }));
	const header = ws.getRow(INPUT_HEADER_ROW);
	setCells(header, INPUT_COLUMNS.map(headerText));
	styleHeaderRow(header);
	const unit = ws.getRow(INPUT_UNIT_ROW);
	setCells(
		unit,
		INPUT_COLUMNS.map((c) => c.note)
	);
	unit.font = NOTE_FONT;
	unit.eachCell((c) => (c.alignment = { wrapText: true, vertical: 'top' }));
	unit.height = 30;

	const rows = inputRows(years);
	rows.forEach((r, i) => {
		const row = ws.getRow(INPUT_FIRST_DATA_ROW + i);
		setCells(
			row,
			INPUT_COLUMNS.map((c) => r[c.key]),
			(col) => {
				const c = INPUT_COLUMNS[col];
				return c.key === 'year'
					? NUM_FMT.year
					: c.unit === '원'
						? NUM_FMT.won
						: c.unit === '명'
							? '0'
							: '@';
			}
		);
	});
	ws.views = [{ state: 'frozen', xSplit: 1, ySplit: INPUT_UNIT_ROW }];
	return ws;
}

function addSummarySheet(wb: ExcelJS.Workbook, years: YearRecord[]) {
	const ws = wb.addWorksheet(SHEET.summary);
	ws.columns = SUMMARY_COLUMNS.map((c) => ({ width: c.width }));
	const note = ws.getRow(1);
	note.getCell(1).value =
		'계산 결과 스냅샷입니다 (가져오기 시 무시). 입력을 고치려면 "입력 데이터" 시트를 수정하세요. HCROI = (영업이익 + 총 인건비) ÷ 총 인건비';
	note.font = NOTE_FONT;
	ws.mergeCells(1, 1, 1, SUMMARY_COLUMNS.length);
	const header = ws.getRow(2);
	setCells(
		header,
		SUMMARY_COLUMNS.map((c) => c.header)
	);
	styleHeaderRow(header);
	summaryRows(years).forEach((vals, i) => {
		setCells(ws.getRow(3 + i), vals, (col) => SUMMARY_COLUMNS[col].numFmt);
	});
	ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];
}

function addScenarioSheet(wb: ExcelJS.Workbook, baseYear: YearRecord, scenarios: Scenario[]) {
	const ws = wb.addWorksheet(SHEET.scenarios);
	const sheet = scenarioSheet(baseYear.year, compareScenarios(baseYear.inputs, scenarios));
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
		`기준연도 ${baseYear.year}년 · 내보내기 시점의 시나리오 파라미터와 결과 (가져오기 시 무시)`;
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

export interface ExportData {
	years: YearRecord[];
	scenarios: Scenario[];
	/** 시나리오 시트의 기준연도 (없으면 시나리오 시트 생략) */
	baseYear: YearRecord | null;
}

/** 작업공간 전체 → .xlsx (시트 ①②③④) */
export async function buildWorkbookBuffer(data: ExportData): Promise<ArrayBuffer> {
	const Excel = await loadExcel();
	const wb = new Excel.Workbook();
	wb.creator = 'HCROI 시뮬레이터';
	wb.created = new Date();
	addSummarySheet(wb, data.years);
	addInputSheet(wb, data.years);
	if (data.baseYear) addScenarioSheet(wb, data.baseYear, data.scenarios);
	addFormulaSheet(wb);
	return toArrayBuffer(await wb.xlsx.writeBuffer());
}

/** 입력 템플릿 (.xlsx) — 시트 ② 구조 + 샘플 3행 + 산식 시트 */
export async function buildTemplateBuffer(opts: { withSample: boolean } = { withSample: true }) {
	const Excel = await loadExcel();
	const wb = new Excel.Workbook();
	wb.creator = 'HCROI 시뮬레이터';
	addInputSheet(wb, opts.withSample ? sampleYears() : []);
	addFormulaSheet(wb);
	return toArrayBuffer(await wb.xlsx.writeBuffer());
}

/** exceljs 셀 값 → 원시값 (수식 결과, 리치텍스트, 하이퍼링크, 날짜 등을 평탄화) */
export function cellToPrimitive(v: ExcelJS.CellValue): unknown {
	if (v === null || v === undefined) return null;
	if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
	if (v instanceof Date) return v.getFullYear();
	if (typeof v === 'object') {
		if ('result' in v) return cellToPrimitive(v.result as ExcelJS.CellValue);
		if ('richText' in v) return v.richText.map((t) => t.text).join('');
		if ('text' in v)
			return typeof v.text === 'string' ? v.text : cellToPrimitive(v.text as ExcelJS.CellValue);
		if ('error' in v) return null;
	}
	return String(v);
}

/**
 * 업로드된 .xlsx 에서 시트 ② 를 2차원 원시값 배열로 읽는다.
 * `입력 데이터` 시트가 없으면 첫 시트를 사용한다 (사용자가 시트명을 바꾼 경우 대비).
 */
export async function readInputSheet(buffer: ArrayBuffer): Promise<unknown[][]> {
	const Excel = await loadExcel();
	const wb = new Excel.Workbook();
	await wb.xlsx.load(buffer);
	const ws = wb.getWorksheet(SHEET.input) ?? wb.worksheets[0];
	if (!ws) return [];
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
