/**
 * 문서 안에서 필요한 표를 찾는다 (순수 함수). docs/plans/pdf-to-excel.md §4 `locate.ts`, §5.
 *
 * - 표지: 사업연도 "YYYY년 MM월 DD일 부터 … 까지" → 기간, "회사명", 보고서 종류
 * - 손익계산서(`pl`) · 비용의 성격별 분류(`expenseByNature`) · 직원 등 현황(`employees`)
 * - 표마다 단위 `(단위 : 천원)`, 열 머리글(3개월/누적 × 당기/전기), 데이터 행(라벨 + 열별 값)
 * - 표가 쪽 끝에서 잘리면 다음 쪽 첫 부분을 이어 읽는다(한 쪽만)
 * - 연결/별도: 손익계산서는 제목의 "연결"로, 주석 표는 목차의 쪽 범위 + 바닥글 "Page N" 으로 판별(없으면 null)
 */

import type { Period } from '../types';
import {
	CELL_GAP,
	normalizeLabel,
	pageRows,
	parseUnitScale,
	rowLabel,
	rowNumbers,
	rowText
} from './table';
import type { Cell, PageText, Row, UnitScale } from './types';

export type TableKind = 'pl' | 'expenseByNature' | 'employees';

export interface TableColumn {
	/** 예: "제 15 기 반기 3개월" */
	label: string;
	/** 상위 머리글(당기/전기 그룹) 순번 — 0 이 가장 왼쪽(대개 당기). 그룹이 없으면 열 순번 */
	group: number;
	/** 하위 머리글 텍스트 ("3개월" · "누적" · "제 15 기" …) */
	sub: string;
}

export interface TableRow {
	label: string;
	/** 공백·(주n) 제거한 라벨 */
	norm: string;
	/** 열 순번별 값 (열을 못 정하면 순서대로) */
	values: (number | null)[];
	/** 행이 있는 쪽 (이어 읽은 행은 다음 쪽) */
	page: number;
	y: number;
}

export interface FoundTable {
	kind: TableKind;
	page: number;
	/** 앵커 행 텍스트 */
	title: string;
	/** true 연결 · false 별도 · null 판별 불가 */
	consolidated: boolean | null;
	unitScale: UnitScale | null;
	columns: TableColumn[];
	rows: TableRow[];
}

/** 직원 등 현황 합계 행에서 읽은 값 (`employees` 표 전용) */
export interface EmployeeTotals {
	page: number;
	unitScale: UnitScale | null;
	/** 기준일 텍스트 ("2026.06.30") */
	asOf: string | null;
	regular: number | null;
	contract: number | null;
	/** 직원수 합계 */
	total: number | null;
	/** 소속 외 근로자 계 */
	external: number | null;
	/** 급여 총액 (표 단위 그대로) */
	payroll: number | null;
	/** 합계 = 정규직 + 기간제 검산이 맞았는지 */
	sumVerified: boolean;
}

export interface CoverInfo {
	page: number | null;
	companyName: string | null;
	reportKind: 'annual' | 'half' | 'quarter' | null;
	/** 제 N 기 */
	term: number | null;
	start: { y: number; m: number; d: number } | null;
	end: { y: number; m: number; d: number } | null;
	/** 사업연도 범위에서 정한 기간. 1–9월이면 3분기(`spanMonths` 9) */
	period: Period | null;
	spanMonths: number | null;
}

export interface DocScan {
	cover: CoverInfo;
	tables: FoundTable[];
	employees: EmployeeTotals[];
	/** 목차에서 읽은 연결재무제표 인쇄 쪽 범위 [시작, 끝) — 없으면 null */
	consolidatedRange: [number, number] | null;
}

const FOOTER_RE = /dart\.fss\.or\.kr|^Page\s*\d+$/;
const TOC_LEADER_RE = /\.{5,}/;
const NOTE_RE = /^(주\s*\d*\)|※|\*)/;
const TITLE_RE =
	/(계산서|재무상태표|자본변동표|현금흐름표|주석|현황)$|^\d+(-\d+)?\.\S|^[IVXⅠⅡⅢⅣⅤ]+\./;
const PL_TITLE_RE = /^(\d+-\d+\.)?(반기|분기|중간|연결)*(포괄)?손익계산서$/;
const EXPENSE_ANCHOR_RE = /성격별/;
const EMPLOYEES_ANCHOR_RE = /직원등의?현황/;
const HEADER_TOKEN_RE =
	/3개월|누적|당기|전기|당반기|전반기|당분기|전분기|제\s*\d+\s*기|기말|반기|분기/;
/** 머리글 조각("누 | 적")을 붙이는 빈틈 */
const HEADER_GAP = 12;

function norm(row: Row): string {
	return normalizeLabel(rowText(row));
}
function isFooter(row: Row): boolean {
	return FOOTER_RE.test(rowText(row).trim());
}
function isLabelOnly(row: Row): boolean {
	return row.cells.length > 0 && row.cells.every((c) => c.num === null && !c.dash);
}
function isDataRow(row: Row): boolean {
	return rowLabel(row) !== '' && rowNumbers(row).length > 0;
}
function isTitleRow(row: Row): boolean {
	return isLabelOnly(row) && TITLE_RE.test(norm(row));
}
function isNoteRow(row: Row): boolean {
	return NOTE_RE.test(rowText(row).trim());
}

/** 머리글 행의 잘게 쪼개진 조각("누" "적")을 붙인다 */
function mergeHeaderCells(cells: Cell[]): Cell[] {
	const out: Cell[] = [];
	for (const c of cells) {
		const last = out[out.length - 1];
		if (last && c.x0 - last.x1 <= HEADER_GAP && c.x0 - last.x1 >= CELL_GAP - 0.01) {
			out[out.length - 1] = { ...last, text: `${last.text}${c.text}`, x1: c.x1 };
		} else if (last && c.x0 - last.x1 < CELL_GAP) {
			out[out.length - 1] = { ...last, text: `${last.text}${c.text}`, x1: c.x1 };
		} else out.push({ ...c });
	}
	return out;
}

function center(c: Cell): number {
	return (c.x0 + c.x1) / 2;
}

/**
 * 머리글 아래에 값 배치. 열 수와 셀 수가 같으면 순서대로, 아니면
 * 값이 다 찬 행들에서 얻은 열별 오른쪽 끝(anchor)에 가장 가까운 열로.
 */
function assignValues(columns: Cell[], dataRows: Row[]): (number | null)[][] {
	const n = columns.length;
	const cellsOf = (r: Row) => r.cells.filter((c) => c.num !== null || c.dash);
	if (n === 0) return dataRows.map((r) => rowNumbers(r).map((c) => c.num));
	const full = dataRows.filter((r) => cellsOf(r).length === n);
	const anchors: number[] = columns.map((c, i) => {
		const xs = full.map((r) => cellsOf(r)[i].x1).sort((a, b) => a - b);
		return xs.length ? xs[Math.floor(xs.length / 2)] : c.x1;
	});
	return dataRows.map((r) => {
		const cells = cellsOf(r);
		const values: (number | null)[] = Array.from({ length: n }, () => null);
		if (cells.length === n) {
			cells.forEach((c, i) => (values[i] = c.num));
			return values;
		}
		for (const c of cells) {
			let best = -1;
			let bestD = Infinity;
			anchors.forEach((a, i) => {
				const d = Math.abs(a - c.x1);
				if (d < bestD) {
					bestD = d;
					best = i;
				}
			});
			if (best >= 0 && values[best] === null) values[best] = c.num;
		}
		return values;
	});
}

interface PagedRow {
	row: Row;
	page: number;
	/** 다음 쪽에서 이어 읽는 행 */
	cont: boolean;
}

/**
 * 앵커 행 뒤의 단위·머리글·데이터 행을 읽어 표로 만든다.
 * 앵커 쪽 끝까지 표가 끝나지 않았으면(제목·주석·다른 단위를 만나지 않음) 다음 쪽을 이어 읽는다 —
 * 이어 읽는 쪽에서는 첫 데이터 행 전의 라벨 행(반복 머리글)·단위 행을 건너뛴다.
 */
function readTable(
	kind: TableKind,
	page: number,
	rows: Row[],
	anchorIndex: number,
	consolidated: boolean | null,
	next?: { page: number; rows: Row[] }
): FoundTable | null {
	let unitScale: UnitScale | null = null;
	// 앵커 위 3행 안의 단위도 인정 (제목 위에 단위가 있는 양식)
	for (let i = Math.max(0, anchorIndex - 3); i < anchorIndex; i++) {
		unitScale = parseUnitScale(rowText(rows[i])) ?? unitScale;
	}
	const seq: PagedRow[] = rows.slice(anchorIndex + 1).map((row) => ({ row, page, cont: false }));
	if (next) seq.push(...next.rows.map((row) => ({ row, page: next.page, cont: true })));

	const headerRows: Row[] = [];
	const data: { row: Row; page: number }[] = [];
	let contStarted = false;
	for (const { row, page: rowPage, cont } of seq) {
		if (isFooter(row)) continue;
		const unit = parseUnitScale(rowText(row));
		if (cont && !contStarted) {
			// 이어 읽기 시작: 제목이 먼저 나오면 표는 앞 쪽에서 끝난 것
			if (isTitleRow(row) || (isNoteRow(row) && data.length > 0)) break;
			if (isDataRow(row)) {
				contStarted = true;
				data.push({ row, page: rowPage });
			}
			continue;
		}
		if (data.length === 0) {
			if (unit !== null) {
				unitScale = unit;
				continue;
			}
			if (isDataRow(row)) data.push({ row, page: rowPage });
			else if (isTitleRow(row) && headerRows.length > 0) break;
			else if (isLabelOnly(row)) headerRows.push(row);
			continue;
		}
		if (unit !== null || isTitleRow(row) || isNoteRow(row)) break;
		if (isDataRow(row)) data.push({ row, page: rowPage });
	}
	if (data.length === 0) return null;

	const candidates = headerRows
		.map((r) => mergeHeaderCells(r.cells))
		.filter((cells) => cells.length >= 2 && cells.some((c) => HEADER_TOKEN_RE.test(c.text)));
	const subCells = candidates[candidates.length - 1] ?? [];
	const groupCells = candidates.length >= 2 ? candidates[candidates.length - 2] : [];
	const columns: TableColumn[] = subCells.map((c, i) => {
		if (groupCells.length === 0) return { label: c.text, group: i, sub: c.text };
		let g = 0;
		let best = Infinity;
		groupCells.forEach((gc, gi) => {
			const d = Math.abs(center(gc) - center(c));
			if (d < best) {
				best = d;
				g = gi;
			}
		});
		return { label: `${groupCells[g].text} ${c.text}`, group: g, sub: c.text };
	});
	const values = assignValues(
		subCells,
		data.map((d) => d.row)
	);
	return {
		kind,
		page,
		title: rowText(rows[anchorIndex]).trim(),
		consolidated,
		unitScale,
		columns,
		rows: data.map((d, i) => ({
			label: rowLabel(d.row),
			norm: normalizeLabel(rowLabel(d.row)),
			values: values[i],
			page: d.page,
			y: d.row.y
		}))
	};
}

/** 바닥글 "Page N" → 인쇄 쪽 번호 */
function printedPage(rows: Row[]): number | null {
	for (const r of rows) {
		const m = rowText(r).match(/Page\s*(\d+)/);
		if (m) return Number(m[1]);
	}
	return null;
}

/** 목차(앞쪽 몇 쪽, 점선 지시자 행)에서 "연결재무제표 … 48" / "재무제표 … 82" 인쇄 쪽 → 연결 범위 */
function tocConsolidatedRange(pages: Row[][]): [number, number] | null {
	let start: number | null = null;
	let end: number | null = null;
	for (const rows of pages.slice(0, 8)) {
		const tocRows = rows.filter((r) => TOC_LEADER_RE.test(rowText(r)));
		if (tocRows.length < 5) continue;
		for (const r of tocRows) {
			// "2. 연결재무제표 ........ 48" — 점선과 쪽 번호가 한 셀로 붙기도 하므로 행 전체 텍스트로 읽는다
			const text = rowText(r);
			const m = text.match(/^(.*?)\.{5,}\s*(\d+)\s*$/);
			if (!m) continue;
			const label = normalizeLabel(m[1]);
			const pageNo = Number(m[2]);
			if (/^\d+\.연결재무제표$/.test(label) && start === null) start = pageNo;
			else if (/^\d+\.재무제표$/.test(label) && start !== null && end === null) end = pageNo;
		}
		if (start !== null && end !== null) return [start, end];
	}
	return null;
}

function parseDate(text: string): { y: number; m: number; d: number } | null {
	const m = text.replace(/\s/g, '').match(/(\d{4})[.년](\d{1,2})[.월](\d{1,2})/);
	return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

/** 사업연도 시작·끝 → 기간. 1–12 연간, 6개월 반기, 3개월 분기, 1–9월은 3분기(누적 9개월) */
export function periodFromRange(
	start: { y: number; m: number },
	end: { y: number; m: number }
): { period: Period; spanMonths: number } | null {
	if (start.y !== end.y || end.m < start.m) return null;
	const span = end.m - start.m + 1;
	const year = start.y;
	if (start.m === 1 && end.m === 12)
		return { period: { year, type: 'Y', index: 1 }, spanMonths: 12 };
	if (span === 6 && (start.m === 1 || start.m === 7))
		return { period: { year, type: 'H', index: start.m === 1 ? 1 : 2 }, spanMonths: 6 };
	if (span === 3 && (start.m - 1) % 3 === 0)
		return { period: { year, type: 'Q', index: Math.ceil(end.m / 3) }, spanMonths: 3 };
	if (start.m === 1 && end.m === 9) return { period: { year, type: 'Q', index: 3 }, spanMonths: 9 };
	if (span === 1) return { period: { year, type: 'M', index: start.m }, spanMonths: 1 };
	return null;
}

function scanCover(pages: Row[][], pageNos: number[]): CoverInfo {
	const empty: CoverInfo = {
		page: null,
		companyName: null,
		reportKind: null,
		term: null,
		start: null,
		end: null,
		period: null,
		spanMonths: null
	};
	for (let i = 0; i < Math.min(pages.length, 10); i++) {
		const rows = pages[i];
		const texts = rows.map((r) => rowText(r));
		const fromIdx = texts.findIndex((t) => /부터/.test(t) && parseDate(t));
		const toIdx = texts.findIndex((t) => /까지/.test(t) && parseDate(t));
		if (fromIdx < 0 || toIdx < 0) continue;
		const start = parseDate(texts[fromIdx]);
		const end = parseDate(texts[toIdx]);
		const joined = texts.map((t) => t.replace(/\s/g, '')).join('\n');
		const kindM = joined.match(/(사업|반기|분기)보고서/);
		const termM = joined.match(/제(\d+)기/);
		const nameRow = texts.find((t) => /회\s*사\s*명/.test(t));
		let companyName: string | null = null;
		if (nameRow) {
			const after = nameRow.split(/[:：]/).slice(1).join(':').trim();
			companyName = after || null;
		}
		if (!companyName) {
			const co = texts.find((t) => /^(주식회사|\(주\))\s*\S+/.test(t.trim()));
			companyName = co ? co.trim() : null;
		}
		const pr = start && end ? periodFromRange(start, end) : null;
		return {
			page: pageNos[i],
			companyName,
			reportKind:
				kindM?.[1] === '사업'
					? 'annual'
					: kindM?.[1] === '반기'
						? 'half'
						: kindM?.[1] === '분기'
							? 'quarter'
							: null,
			term: termM ? Number(termM[1]) : null,
			start,
			end,
			period: pr?.period ?? null,
			spanMonths: pr?.spanMonths ?? null
		};
	}
	return empty;
}

/** 직원 등 현황: 합계 행을 검산(합계 = 정규직 + 기간제)으로 찾는다 */
function readEmployees(page: number, rows: Row[], anchorIndex: number): EmployeeTotals | null {
	let unitScale: UnitScale | null = null;
	let asOf: string | null = null;
	for (let i = anchorIndex + 1; i < Math.min(rows.length, anchorIndex + 40); i++) {
		const row = rows[i];
		const text = rowText(row);
		if (unitScale === null) unitScale = parseUnitScale(text);
		if (asOf === null && /기준일/.test(text)) {
			const d = parseDate(text);
			if (d) asOf = `${d.y}.${String(d.m).padStart(2, '0')}.${String(d.d).padStart(2, '0')}`;
		}
		if (!/^합계/.test(normalizeLabel(rowLabel(row)))) continue;
		const cells = row.cells.filter((c) => c.num !== null || c.dash);
		const v = cells.map((c) => (c.dash ? 0 : (c.num as number)));
		if (v.length < 3) continue;
		// [정규직, (단시간), 기간제, (단시간), 합계, 근속연수?, 급여총액, 1인평균, 소속외…]
		let k = -1;
		let regular: number | null = null;
		let contract: number | null = null;
		if (v.length >= 5 && v[4] === v[0] + v[2]) {
			k = 4;
			regular = v[0];
			contract = v[2];
		} else if (v[2] === v[0] + v[1]) {
			k = 2;
			regular = v[0];
			contract = v[1];
		}
		const sumVerified = k >= 0;
		const total = k >= 0 ? v[k] : null;
		let rest = k >= 0 ? cells.slice(k + 1) : cells;
		// 근속연수(작은 수·소수)는 건너뛴다
		if (rest.length && rest[0].num !== null && rest[0].num < 100 && !Number.isInteger(rest[0].num))
			rest = rest.slice(1);
		const bigIdx = rest.findIndex((c) => c.num !== null && c.num >= 100);
		const payroll = bigIdx >= 0 ? (rest[bigIdx].num as number) : null;
		const afterAvg = bigIdx >= 0 ? rest.slice(bigIdx + 2) : [];
		const externalNums = afterAvg.filter((c) => c.num !== null).map((c) => c.num as number);
		const external =
			externalNums.length >= 3
				? externalNums[2]
				: externalNums.length === 1
					? externalNums[0]
					: null;
		return {
			page,
			unitScale,
			asOf,
			regular,
			contract,
			total,
			external,
			payroll,
			sumVerified
		};
	}
	return null;
}

export function scanDocument(pages: PageText[]): DocScan {
	const rowsByPage = pages.map((p) => pageRows(p));
	const pageNos = pages.map((p) => p.page);
	const consolidatedRange = tocConsolidatedRange(rowsByPage);
	const cover = scanCover(rowsByPage, pageNos);
	const tables: FoundTable[] = [];
	const employees: EmployeeTotals[] = [];

	rowsByPage.forEach((rows, pi) => {
		const page = pageNos[pi];
		const next =
			pi + 1 < rowsByPage.length && pageNos[pi + 1] === page + 1
				? { page: pageNos[pi + 1], rows: rowsByPage[pi + 1] }
				: undefined;
		const printed = printedPage(rows);
		const inConsolidatedRange =
			consolidatedRange && printed !== null
				? printed >= consolidatedRange[0] && printed < consolidatedRange[1]
				: null;

		// 손익계산서: 같은 쪽에 "4-2. 포괄손익계산서" 와 "포괄손익계산서" 가 연달아 나오면 데이터에 가까운 쪽(마지막)만
		let plAnchor = -1;
		rows.forEach((r, i) => {
			if (isLabelOnly(r) && !TOC_LEADER_RE.test(rowText(r)) && PL_TITLE_RE.test(norm(r)))
				plAnchor = i;
		});
		if (plAnchor >= 0) {
			const t = readTable('pl', page, rows, plAnchor, /연결/.test(norm(rows[plAnchor])), next);
			if (t && t.rows.some((r) => /매출|영업수익|수익/.test(r.norm))) tables.push(t);
		}

		rows.forEach((r, i) => {
			if (rowNumbers(r).length > 0 || TOC_LEADER_RE.test(rowText(r))) return;
			const n = norm(r);
			if (EXPENSE_ANCHOR_RE.test(n)) {
				const t = readTable('expenseByNature', page, rows, i, inConsolidatedRange, next);
				if (
					t &&
					t.rows.length >= 3 &&
					!tables.some((x) => x.page === page && x.kind === t.kind && x.rows[0]?.y === t.rows[0]?.y)
				)
					tables.push(t);
			} else if (EMPLOYEES_ANCHOR_RE.test(n)) {
				const e = readEmployees(page, rows, i);
				if (e) employees.push(e);
			}
		});
	});
	return { cover, tables, employees, consolidatedRange };
}
