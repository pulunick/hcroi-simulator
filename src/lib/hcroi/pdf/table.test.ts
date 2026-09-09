import { describe, expect, it } from 'vitest';
import {
	clusterRows,
	mergeMultilineLabels,
	nearestColumn,
	normalizeLabel,
	pageRows,
	parseCellNumber,
	parseUnitScale,
	rowLabel,
	rowNumbers,
	rowText
} from './table';
import type { PageText, Row } from './types';
import reportA from './fixtures/report-a.json';
import reportB from './fixtures/report-b.json';

/**
 * 픽스처는 DART 반기보고서 2부에서 뽑은 텍스트 좌표에 **가상 수치**를 넣은 것(숫자 자리 치환, 회사명 치환).
 * 실제 수치·회사명은 없다. 좌표·레이아웃만 진짜다.
 */
const pagesA = reportA as PageText[];
const pagesB = reportB as PageText[];
const pageOf = (pages: PageText[], n: number) => {
	const p = pages.find((x) => x.page === n);
	if (!p) throw new Error(`fixture page ${n}`);
	return p;
};
const findRow = (rows: Row[], re: RegExp) => {
	const r = rows.find((row) => re.test(normalizeLabel(rowLabel(row))));
	if (!r) throw new Error(`row ${re}`);
	return r;
};

describe('parseCellNumber', () => {
	it('콤마·괄호·△·앞 하이픈 음수를 읽는다', () => {
		expect(parseCellNumber('1,244,970,983')).toBe(1_244_970_983);
		expect(parseCellNumber('(2,145,414,141)')).toBe(-2_145_414_141);
		expect(parseCellNumber('△1,000')).toBe(-1000);
		expect(parseCellNumber('-1,000')).toBe(-1000);
		expect(parseCellNumber('3.5')).toBe(3.5);
		expect(parseCellNumber('95')).toBe(95);
	});
	it('숫자가 아닌 것은 null', () => {
		expect(parseCellNumber('-')).toBeNull();
		expect(parseCellNumber('2026.06.30')).toBeNull();
		expect(parseCellNumber('4년 10개월')).toBeNull();
		expect(parseCellNumber('영업수익 (주4)')).toBeNull();
		expect(parseCellNumber('')).toBeNull();
	});
});

describe('normalizeLabel / parseUnitScale', () => {
	it('공백과 (주n) 주석을 뗀다', () => {
		expect(normalizeLabel('합 계')).toBe('합계');
		expect(normalizeLabel('영업수익 (주4,24,31)')).toBe('영업수익');
		expect(normalizeLabel('영업이익(손실)')).toBe('영업이익(손실)');
	});
	it('단위 문구 → 배수', () => {
		expect(parseUnitScale('(단위 : 원)')).toBe(1);
		expect(parseUnitScale('(단위: 천원)')).toBe(1000);
		expect(parseUnitScale('(단위 : 백만원)')).toBe(1_000_000);
		expect(parseUnitScale('(단위 : 명)')).toBeNull();
		expect(parseUnitScale('영업수익')).toBeNull();
	});
});

describe('clusterRows — 손익계산서 (report-b p85)', () => {
	const rows = pageRows(pageOf(pagesB, 85));
	it('라벨 + 4개 숫자(3개월·누적 × 당기·전기)가 한 행에 제자리로 모인다', () => {
		const rev = findRow(rows, /^영업수익/);
		expect(rowNumbers(rev).map((c) => c.num)).toEqual([
			7_411_650_639, 4_914_278_608, 7_021_198_127, 7_643_077_761
		]);
		const op = findRow(rows, /^영업이익\(손실\)/);
		expect(rowNumbers(op).map((c) => c.num)).toEqual([
			-4_718_171_717, -1_267_962_852, -4_278_162_973, -8_239_854_077
		]);
	});
	it('머리글 행(3개월 | 누적 | 3개월 | 누적)과 단위 행을 찾을 수 있다', () => {
		const header = rows.find(
			(r) => r.cells.map((c) => c.text).join('|') === '3개월|누적|3개월|누적'
		);
		expect(header).toBeDefined();
		const unit = rows.find((r) => parseUnitScale(rowText(r)) !== null);
		expect(unit && parseUnitScale(rowText(unit))).toBe(1);
	});
	it('숫자 셀은 오른쪽 정렬이라 머리글 열에 매핑된다', () => {
		const header = rows.find(
			(r) => r.cells.map((c) => c.text).join('|') === '3개월|누적|3개월|누적'
		)!;
		const rev = findRow(rows, /^영업수익/);
		expect(rowNumbers(rev).map((c) => nearestColumn(header.cells, c))).toEqual([0, 1, 2, 3]);
	});
});

describe('성격별 비용 (report-b p119)', () => {
	const rows = pageRows(pageOf(pagesB, 119));
	it('종업원급여·복리후생비 행과 (단위: 천원)', () => {
		expect(rowNumbers(findRow(rows, /^종업원급여$/)).map((c) => c.num)).toEqual([
			7_776_373, 4_759_849, 7_497_172, 4_238_613
		]);
		expect(rowNumbers(findRow(rows, /^복리후생비$/)).map((c) => c.num)).toEqual([
			446_777, 894_695, 701_597, 121_128
		]);
		const unitRow = rows.find((r) => /단위/.test(rowText(r)));
		expect(unitRow && parseUnitScale(rowText(unitRow))).toBe(1000);
	});
	it('글자가 띄어진 머리글 "구 분" 도 정규화하면 붙는다', () => {
		expect(rows.some((r) => normalizeLabel(rowLabel(r)) === '구분')).toBe(true);
	});
});

describe('두 줄 라벨 병합 (report-a p171)', () => {
	const page = pageOf(pagesA, 171);
	it('"당기손익에 포함되는 퇴직급여 / 숫자 / 비용" 세 줄이 한 행이 된다', () => {
		const raw = clusterRows(page.items);
		const numbersOnly = raw.find(
			(r) =>
				r.cells.length === 2 && r.cells.every((c) => c.num !== null) && r.cells[0].num === 113_551
		);
		expect(numbersOnly).toBeDefined();
		const merged = mergeMultilineLabels(raw);
		const ret = findRow(merged, /당기손익에포함되는퇴직급여비용/);
		expect(rowNumbers(ret).map((c) => c.num)).toEqual([113_551, 659_731]);
		expect(merged.length).toBeLessThan(raw.length);
	});
	it('한 줄 라벨 행은 그대로', () => {
		const rows = pageRows(page);
		expect(rowNumbers(findRow(rows, /^종업원급여비용$/)).map((c) => c.num)).toEqual([
			1_509_336, 6_568_774
		]);
	});
});

describe('직원 등 현황 합계 행', () => {
	it('report-a p224: 합계 행에 인원·급여총액이 순서대로', () => {
		const rows = pageRows(pageOf(pagesA, 224));
		const total = findRow(rows, /^합계$/);
		// 정규직 전체 · (단시간) · 기간제 전체 · (단시간) · 합계 · 근속연수 · 연간급여총액 · 1인평균
		expect(rowNumbers(total).map((c) => c.num)).toEqual([232, 2, 11, 8, 243, 3.5, 77_886, 46]);
		const unitRow = rows.find((r) => /단위/.test(rowText(r)));
		expect(unitRow && parseUnitScale(rowText(unitRow))).toBe(1_000_000);
	});
	it('report-b p152: "합 계" 처럼 띄어진 라벨도 찾고 "-" 는 숫자로 세지 않는다', () => {
		const rows = pageRows(pageOf(pagesB, 152));
		const total = findRow(rows, /^합계$/);
		expect(rowNumbers(total).map((c) => c.num)).toEqual([91, 4, 95, 9_405_170, 94_336]);
		expect(total.cells.filter((c) => c.dash).length).toBeGreaterThanOrEqual(2);
	});
});
