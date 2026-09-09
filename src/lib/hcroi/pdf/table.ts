/**
 * PDF 텍스트 조각 → 행/셀 복원 (순수 함수, pdf.js 무관).
 * docs/plans/pdf-to-excel.md §4 `table.ts`.
 *
 * 규칙
 * ① 기준선 y 가 허용치 안이면 같은 행 ② 행 안에서 x 정렬 ③ 가로로 붙은 조각(빈틈 < 3pt)은 한 셀
 * ④ 숫자 셀: 콤마 제거, 괄호·△·앞 '-' 는 음수, '-' 하나뿐이면 dash
 * ⑤ 라벨만 있는 행이 숫자만 있는 행 바로 위/아래에 붙어 있으면 한 행으로 (두 줄짜리 계정명)
 */

import type { Cell, PageText, Row, TextItem, UnitScale } from './types';

/** 같은 행으로 보는 기준선 y 차이 (pt) */
export const ROW_Y_TOLERANCE = 2.5;
/** 같은 셀로 붙이는 가로 빈틈 (pt) */
export const CELL_GAP = 3;
/** 두 줄 라벨을 합칠 때 허용하는 세로 간격 (pt) — 보통 줄 간격 8~10pt */
export const LABEL_MERGE_GAP = 12;

const NUMBER_RE = /^[(△▲-]?\s*\d{1,3}(,\d{3})*(\.\d+)?\s*\)?$|^[(△▲-]?\s*\d+(\.\d+)?\s*\)?$/;

/** 숫자 셀 파싱. "1,234" → 1234, "(1,234)" · "△1,234" · "-1,234" → -1234. 숫자가 아니면 null */
export function parseCellNumber(text: string): number | null {
	const t = text.trim();
	if (!t || !NUMBER_RE.test(t)) return null;
	const negative = /^[(△▲-]/.test(t);
	const digits = t.replace(/[(),△▲\s-]/g, '');
	if (!digits) return null;
	const n = Number(digits);
	if (!Number.isFinite(n)) return null;
	return negative ? -n : n;
}

/** 라벨 비교용: 공백·전각 공백 제거 ("합 계" ≡ "합계"). 괄호 주석 "(주4,24)" 도 뗀다 */
export function normalizeLabel(text: string): string {
	return text
		.replace(/\(주[^)]*\)/g, '')
		.replace(/[\s3000]/g, '')
		.trim();
}

/** `(단위 : 천원)` 류 문구에서 배수. 없으면 null */
export function parseUnitScale(text: string): UnitScale | null {
	const m = text.replace(/[\s3000]/g, '').match(/\(단위[:：]?([^)]+)\)/);
	if (!m) return null;
	const u = m[1];
	if (/억원/.test(u)) return 100_000_000;
	if (/백만원/.test(u)) return 1_000_000;
	if (/천원/.test(u)) return 1_000;
	if (/원/.test(u)) return 1;
	return null;
}

function makeCell(text: string, x0: number, x1: number): Cell {
	const t = text.trim();
	return { text: t, x0, x1, num: parseCellNumber(t), dash: t === '-' };
}

/** 조각 → 행 (y 클러스터 + x 정렬 + 셀 병합). 위에서 아래 순서 */
export function clusterRows(items: TextItem[]): Row[] {
	const sorted = items
		.filter((i) => i.s.trim() !== '')
		.slice()
		.sort((a, b) => b.y - a.y || a.x - b.x);
	const groups: { y: number; items: TextItem[] }[] = [];
	for (const it of sorted) {
		const g = groups.find((r) => Math.abs(r.y - it.y) < ROW_Y_TOLERANCE);
		if (g) g.items.push(it);
		else groups.push({ y: it.y, items: [it] });
	}
	return groups
		.sort((a, b) => b.y - a.y)
		.map((g) => {
			const its = g.items.slice().sort((a, b) => a.x - b.x);
			const cells: Cell[] = [];
			let cur: { text: string; x0: number; x1: number } | null = null;
			for (const it of its) {
				if (cur && it.x - cur.x1 < CELL_GAP) {
					cur.text += it.s;
					cur.x1 = Math.max(cur.x1, it.x + it.w);
				} else {
					if (cur) cells.push(makeCell(cur.text, cur.x0, cur.x1));
					cur = { text: it.s, x0: it.x, x1: it.x + it.w };
				}
			}
			if (cur) cells.push(makeCell(cur.text, cur.x0, cur.x1));
			return { y: g.y, cells };
		});
}

export function rowNumbers(row: Row): Cell[] {
	return row.cells.filter((c) => c.num !== null);
}

/** 행 머리 라벨 — 첫 숫자/대시 셀 앞까지의 텍스트 ("합 계 | 91 | - | 4년 6개월" → "합 계") */
export function rowLabel(row: Row): string {
	const lead: string[] = [];
	for (const c of row.cells) {
		if (c.num !== null || c.dash) break;
		lead.push(c.text);
	}
	return lead.join(' ').trim();
}

export function rowText(row: Row): string {
	return row.cells.map((c) => c.text).join(' ');
}

/** 라벨만 있는 행(숫자·대시 없음) */
function isLabelOnly(row: Row): boolean {
	return row.cells.length > 0 && row.cells.every((c) => c.num === null && !c.dash);
}
/** 숫자만 있는 행(라벨 없음) */
function isNumbersOnly(row: Row): boolean {
	return row.cells.length > 0 && row.cells.every((c) => c.num !== null || c.dash);
}

/**
 * 두 줄 라벨 병합: 숫자만 있는 행의 바로 위/아래에 라벨만 있는 행이 `LABEL_MERGE_GAP` 안에 붙어 있으면
 * 그 라벨을 숫자 행에 합친다("당기손익에 포함되는 퇴직급여" / 숫자 / "비용" → 한 행).
 * 헤더 행("3개월 | 누적")은 라벨 행 + 라벨 행이라 건드리지 않는다.
 */
export function mergeMultilineLabels(rows: Row[]): Row[] {
	const out: Row[] = [];
	const used = new Set<number>();
	for (let i = 0; i < rows.length; i++) {
		if (used.has(i)) continue;
		const row = rows[i];
		if (!isNumbersOnly(row)) {
			out.push(row);
			continue;
		}
		const parts: Cell[] = [];
		const above = rows[i - 1];
		if (
			above &&
			!used.has(i - 1) &&
			isLabelOnly(above) &&
			above.y - row.y <= LABEL_MERGE_GAP &&
			out[out.length - 1] === above
		) {
			out.pop();
			parts.push(...above.cells);
		}
		const below = rows[i + 1];
		let tookBelow = false;
		if (below && isLabelOnly(below) && row.y - below.y <= LABEL_MERGE_GAP) {
			// 아래 줄이 다음 계정의 라벨일 수도 있다 — 그 다음 행이 숫자만 있는 행이면 그쪽 것으로 본다
			const next = rows[i + 2];
			const belowBelongsToNext = next && isNumbersOnly(next) && below.y - next.y <= LABEL_MERGE_GAP;
			if (!belowBelongsToNext && parts.length > 0) {
				parts.push(...below.cells);
				tookBelow = true;
			}
		}
		if (parts.length === 0) {
			out.push(row);
			continue;
		}
		const label = makeCell(
			parts.map((c) => c.text).join(' '),
			Math.min(...parts.map((c) => c.x0)),
			Math.max(...parts.map((c) => c.x1))
		);
		out.push({ y: row.y, cells: [label, ...row.cells] });
		if (tookBelow) used.add(i + 1);
	}
	return out;
}

/** 쪽 → 행 목록 (위에서 아래) */
export function pageRows(page: PageText): Row[] {
	return mergeMultilineLabels(clusterRows(page.items));
}

/**
 * 숫자 셀이 어느 열 머리글 아래에 있는지 — 머리글 셀 중 가로 범위가 겹치거나 중심이 가장 가까운 것의 인덱스.
 * 금액 열은 오른쪽 정렬이라 머리글 중심과 숫자 오른쪽 끝을 함께 본다.
 */
export function nearestColumn(headers: Cell[], cell: Cell): number {
	if (headers.length === 0) return -1;
	const center = (cell.x0 + cell.x1) / 2;
	let best = -1;
	let bestDist = Infinity;
	headers.forEach((h, i) => {
		const hc = (h.x0 + h.x1) / 2;
		const overlap = cell.x1 >= h.x0 && cell.x0 <= h.x1;
		const dist = overlap ? 0 : Math.min(Math.abs(center - hc), Math.abs(cell.x1 - h.x1));
		if (dist < bestDist) {
			bestDist = dist;
			best = i;
		}
	});
	return best;
}
