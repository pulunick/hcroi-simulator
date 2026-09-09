import { describe, expect, it } from 'vitest';
import { periodFromRange, scanDocument } from './locate';
import {
	columnKindOf,
	currentColumns,
	mapFields,
	matchAccount,
	normalizePdfPrefs,
	periodForColumn
} from './map';
import { buildRecord } from './toRecord';
import { DEFAULT_HC_INCLUDE } from './map';
import { DEFAULT_HEADCOUNT_BASIS } from '../types';
import type { PageText, TextItem } from './types';
import reportA from './fixtures/report-a.json';
import reportB from './fixtures/report-b.json';

const pagesA = reportA as PageText[];
const pagesB = reportB as PageText[];

describe('periodFromRange', () => {
	it('사업연도 범위 → 기간', () => {
		expect(periodFromRange({ y: 2026, m: 1 }, { y: 2026, m: 6 })).toEqual({
			period: { year: 2026, type: 'H', index: 1 },
			spanMonths: 6
		});
		expect(periodFromRange({ y: 2026, m: 1 }, { y: 2026, m: 12 })?.period).toEqual({
			year: 2026,
			type: 'Y',
			index: 1
		});
		expect(periodFromRange({ y: 2026, m: 4 }, { y: 2026, m: 6 })?.period).toEqual({
			year: 2026,
			type: 'Q',
			index: 2
		});
		expect(periodFromRange({ y: 2026, m: 1 }, { y: 2026, m: 9 })).toEqual({
			period: { year: 2026, type: 'Q', index: 3 },
			spanMonths: 9
		});
		expect(periodFromRange({ y: 2026, m: 1 }, { y: 2027, m: 6 })).toBeNull();
	});
});

describe('scanDocument — report-b (별도 반기보고서)', () => {
	const scan = scanDocument(pagesB);
	it('표지: 기간·회사명·보고서 종류·기수', () => {
		expect(scan.cover).toMatchObject({
			page: 3,
			companyName: '주식회사 샘플비',
			reportKind: 'half',
			term: 15,
			start: { y: 2026, m: 1, d: 1 },
			end: { y: 2026, m: 6, d: 30 },
			period: { year: 2026, type: 'H', index: 1 },
			spanMonths: 6
		});
	});
	it('손익계산서: 별도 · 원 · 4열 머리글 · 매출/영업비용/영업이익 행', () => {
		const pl = scan.tables.find((t) => t.kind === 'pl');
		expect(pl).toBeDefined();
		expect(pl!.page).toBe(85);
		expect(pl!.consolidated).toBe(false);
		expect(pl!.unitScale).toBe(1);
		expect(pl!.columns.map((c) => c.label)).toEqual([
			'제 15 기 반기 3개월',
			'제 15 기 반기 누적',
			'제 14 기 반기 3개월',
			'제 14 기 반기 누적'
		]);
		expect(pl!.columns.map((c) => c.group)).toEqual([0, 0, 1, 1]);
		const row = (re: RegExp) => pl!.rows.find((r) => re.test(r.norm))!;
		expect(row(/^영업수익/).values).toEqual([
			7_411_650_639, 4_914_278_608, 7_021_198_127, 7_643_077_761
		]);
		expect(row(/^영업비용/).values[0]).toBe(9_960_938_741);
		expect(row(/^영업이익/).values).toEqual([
			-4_718_171_717, -1_267_962_852, -4_278_162_973, -8_239_854_077
		]);
	});
	it('성격별 비용: 천원 · 당반기/전반기 × 3개월/누적 · 같은 표를 두 번 넣지 않는다', () => {
		const ex = scan.tables.filter((t) => t.kind === 'expenseByNature');
		expect(ex.length).toBe(1);
		const t = ex[0];
		expect(t.page).toBe(119);
		expect(t.unitScale).toBe(1000);
		expect(t.columns.map((c) => c.label)).toEqual([
			'당반기 3개월',
			'당반기 누적',
			'전반기 3개월',
			'전반기 누적'
		]);
		expect(t.rows.find((r) => r.norm === '종업원급여')!.values).toEqual([
			7_776_373, 4_759_849, 7_497_172, 4_238_613
		]);
		expect(t.rows.find((r) => r.norm === '복리후생비')!.values).toEqual([
			446_777, 894_695, 701_597, 121_128
		]);
		expect(t.consolidated).toBeNull();
	});
	it('직원 등 현황: 합계 행 검산으로 정규직·기간제·합계·급여총액', () => {
		expect(scan.employees).toHaveLength(1);
		expect(scan.employees[0]).toMatchObject({
			page: 152,
			unitScale: 1000,
			asOf: '2026.06.30',
			regular: 91,
			contract: 4,
			total: 95,
			payroll: 9_405_170,
			external: null,
			sumVerified: true
		});
	});
});

describe('scanDocument — report-a (두 줄 라벨 · 백만원 인원표)', () => {
	const scan = scanDocument(pagesA);
	it('표지', () => {
		expect(scan.cover).toMatchObject({
			companyName: '주식회사 샘플에이',
			reportKind: 'half',
			term: 14,
			period: { year: 2026, type: 'H', index: 1 }
		});
	});
	it('손익계산서 영업손실 행', () => {
		const pl = scan.tables.find((t) => t.kind === 'pl')!;
		expect(pl.columns.map((c) => c.label)[0]).toBe('제 14 기 반기 3개월');
		expect(pl.rows.find((r) => r.norm === '영업수익')!.values.slice(0, 2)).toEqual([
			2_189_041_346, 71_898_864_157
		]);
		expect(pl.rows.find((r) => r.norm === '영업손실')!.values[0]).toBe(-72_018_703_775);
	});
	it('성격별: "당반기 (단위 : 천원)" 행이 단위로 읽히고 두 줄 라벨 퇴직급여 행이 살아 있다', () => {
		const t = scan.tables.find((x) => x.kind === 'expenseByNature')!;
		expect(t.unitScale).toBe(1000);
		expect(t.columns.map((c) => c.label)).toEqual(['3개월', '누적']);
		expect(t.rows.find((r) => /퇴직급여/.test(r.norm))!.values).toEqual([113_551, 659_731]);
		expect(t.rows.find((r) => r.norm === '종업원급여비용')!.values).toEqual([1_509_336, 6_568_774]);
	});
	it('직원 등 현황 (백만원, 근속연수 소수 건너뜀)', () => {
		expect(scan.employees[0]).toMatchObject({
			unitScale: 1_000_000,
			regular: 232,
			contract: 11,
			total: 243,
			payroll: 77_886,
			sumVerified: true
		});
	});
});

describe('map — 계정 사전 · 열 선택 · 후보', () => {
	it('matchAccount', () => {
		expect(matchAccount('영업수익', 'pl')).toBe('revenue');
		expect(matchAccount('Ⅰ.매출액', 'pl')).toBe('revenue');
		expect(matchAccount('영업이익(손실)', 'pl')).toBe('operatingProfit');
		expect(matchAccount('영업손실', 'pl')).toBe('operatingProfit');
		expect(matchAccount('판매비와관리비', 'pl')).toBe('sga');
		expect(matchAccount('종업원급여비용', 'expenseByNature')).toBe('baseSalary');
		expect(matchAccount('당기손익에포함되는퇴직급여비용', 'expenseByNature')).toBe('retirement');
		expect(matchAccount('퇴직급여충당부채전입', 'expenseByNature')).toBeNull();
		expect(matchAccount('법정복리후생비', 'expenseByNature')).toBe('statutoryWelfare');
		expect(matchAccount('복리후생비', 'expenseByNature')).toBe('otherWelfare');
		expect(matchAccount('주식보상비용', 'expenseByNature')).toBe('stockComp');
		expect(matchAccount('감가상각비', 'expenseByNature')).toBeNull();
	});
	it('columnKindOf / currentColumns', () => {
		expect(columnKindOf('3개월')).toBe('period');
		expect(columnKindOf('누적')).toBe('cumulative');
		expect(columnKindOf('제 15 기')).toBeNull();
		const scan = scanDocument(pagesB);
		const pl = scan.tables.find((t) => t.kind === 'pl')!;
		expect(currentColumns(pl, 'period')).toEqual([0, 1]);
		expect(currentColumns(pl, 'cumulative')).toEqual([1, 0]);
	});
	it('mapFields: 별도·3개월 선호 → 원 단위 값과 출처', () => {
		const scan = scanDocument(pagesB);
		const fields = mapFields(scan, { consolidated: false, column: 'period' });
		const f = (k: string) => fields.find((x) => x.key === k)!;
		expect(f('revenue').candidates[0]).toMatchObject({
			value: 7_411_650_639,
			page: 85,
			column: '제 15 기 반기 3개월',
			columnKind: 'period',
			preferred: true
		});
		expect(f('revenue').candidates[1].columnKind).toBe('cumulative');
		expect(f('baseSalary').candidates[0]).toMatchObject({
			value: 7_776_373_000,
			raw: 7_776_373,
			unitScale: 1000,
			rowLabel: '종업원급여',
			column: '당반기 3개월'
		});
		expect(f('otherWelfare').candidates[0].value).toBe(446_777_000);
		expect(f('stockComp').candidates[0].rowLabel).toBe('주식보상비용');
		expect(f('cogs').candidates).toEqual([]);
	});
	it('periodForColumn: 반기보고서 3개월 열은 2분기, 누적은 상반기', () => {
		const cover = scanDocument(pagesB).cover;
		expect(periodForColumn(cover, 'period')).toEqual({ year: 2026, type: 'Q', index: 2 });
		expect(periodForColumn(cover, 'cumulative')).toEqual({ year: 2026, type: 'H', index: 1 });
	});
});

describe('buildRecord', () => {
	const scan = scanDocument(pagesB);
	const fields = mapFields(scan, { consolidated: false, column: 'period' });
	const values = Object.fromEntries(
		fields.filter((f) => f.candidates.length > 0).map((f) => [f.key, f.candidates[0].value])
	);
	it('후보 첫 값으로 레코드를 만들고 검증 경고를 낸다', () => {
		const r = buildRecord({
			period: { year: 2026, type: 'Q', index: 2 },
			values,
			include: DEFAULT_HC_INCLUDE,
			employees: scan.employees[0],
			basis: DEFAULT_HEADCOUNT_BASIS,
			payrollMonths: 6
		});
		expect(r.missing).toEqual([]);
		expect(r.record.inputs.revenue).toBe(7_411_650_639);
		expect(r.record.inputs.operatingCost).toBe(9_960_938_741);
		// 급여 + 퇴직급여 + 복리후생비 (주식보상 제외)
		expect(r.record.inputs.hcCost).toBe(
			(values.baseSalary ?? 0) + (values.retirement ?? 0) + (values.otherWelfare ?? 0)
		);
		expect(r.record.breakdown?.baseSalary).toBe(7_776_373_000);
		expect(r.record.headcountBreakdown).toEqual({
			regular: 91,
			contract: 4,
			dispatched: 0,
			executive: 0
		});
		expect(r.record.inputs.headcount).toBe(91); // 기본 기준: 정규직만
		expect(r.warnings.some((w) => /기말/.test(w))).toBe(true);
		// 급여 총액(6개월)을 3개월로 환산하면 총 인건비와 같은 자릿수 — 단위 오판 경고가 나지 않는다
		expect(r.warnings.some((w) => /크게 다릅니다/.test(w))).toBe(false);
	});
	it('빠진 값은 missing 으로', () => {
		const r = buildRecord({
			period: { year: 2026, type: 'Q', index: 2 },
			values: { revenue: 1 },
			include: DEFAULT_HC_INCLUDE,
			employees: null,
			basis: DEFAULT_HEADCOUNT_BASIS
		});
		expect(r.missing).toEqual(['영업비용 또는 영업이익', '총 인건비(인건비 항목)', '총 임직원 수']);
	});
});

describe('쪽 넘김 · 목차 기반 연결/별도', () => {
	it('report-b 손익계산서가 다음 쪽(86)까지 이어진다', () => {
		const pl = scanDocument(pagesB).tables.find((t) => t.kind === 'pl')!;
		expect(pl.rows.length).toBeGreaterThan(3);
		expect(pl.rows.some((r) => r.page === 86)).toBe(true);
		expect(pl.rows.some((r) => /당기순|반기순|법인세/.test(r.norm))).toBe(true);
		// 이어 읽은 행도 4열에 배치된다
		expect(pl.rows.filter((r) => r.page === 86).every((r) => r.values.length === 4)).toBe(true);
	});
	it('report-a 성격별 비용이 다음 쪽(172)까지 이어진다', () => {
		const t = scanDocument(pagesA).tables.find((x) => x.kind === 'expenseByNature')!;
		expect(t.rows.length).toBeGreaterThan(5);
		expect(t.rows.some((r) => r.page === 172)).toBe(true);
	});
	it('목차의 연결재무제표/재무제표 쪽 번호와 바닥글 Page N 으로 주석 표의 연결 여부를 정한다', () => {
		const item = (s: string, x: number, y: number): TextItem => ({
			s,
			x,
			y,
			w: s.length * 5,
			h: 9
		});
		const tocLine = (label: string, y: number, page: number) => [
			item(label, 50, y),
			item('..........', 200, y),
			item(String(page), 520, y)
		];
		const toc: PageText = {
			page: 1,
			width: 595,
			height: 842,
			items: [
				...tocLine('1. 요약재무정보', 700, 36),
				...tocLine('2. 연결재무제표', 680, 39),
				...tocLine('3. 연결재무제표 주석', 660, 42),
				...tocLine('4. 재무제표', 640, 82),
				...tocLine('5. 재무제표 주석', 620, 86)
			]
		};
		const expensePage = (page: number, printed: number): PageText => ({
			page,
			width: 595,
			height: 842,
			items: [
				item('25. 성격별 비용', 50, 700),
				item('(단위: 천원)', 480, 680),
				item('당반기', 250, 660),
				item('전반기', 450, 660),
				item('3개월', 200, 640),
				item('누적', 300, 640),
				item('3개월', 400, 640),
				item('누적', 500, 640),
				item('종업원급여', 50, 620),
				item('1,000', 210, 620),
				item('2,000', 310, 620),
				item('900', 410, 620),
				item('1,800', 510, 620),
				item('복리후생비', 50, 600),
				item('100', 215, 600),
				item('200', 315, 600),
				item('90', 415, 600),
				item('180', 515, 600),
				item('감가상각비', 50, 580),
				item('10', 218, 580),
				item('20', 318, 580),
				item('9', 418, 580),
				item('18', 518, 580),
				item('전자공시시스템 dart.fss.or.kr', 50, 20),
				item(`Page ${printed}`, 500, 20)
			]
		});
		const scan = scanDocument([toc, expensePage(40, 60), expensePage(90, 100)]);
		expect(scan.consolidatedRange).toEqual([39, 82]);
		const tables = scan.tables.filter((t) => t.kind === 'expenseByNature');
		expect(tables.map((t) => [t.page, t.consolidated])).toEqual([
			[40, true],
			[90, false]
		]);
		expect(tables[0].rows[0].values).toEqual([1000, 2000, 900, 1800]);
		const fields = mapFields(scan, { consolidated: false, column: 'period' });
		const salary = fields.find((f) => f.key === 'baseSalary')!;
		expect(salary.candidates[0]).toMatchObject({
			page: 90,
			consolidated: false,
			value: 1_000_000,
			preferred: true
		});
		expect(salary.candidates.find((c) => c.page === 40)!.preferred).toBe(false);
	});
});

describe('normalizePdfPrefs', () => {
	it('모양이 맞는 설정만 남기고 항목 포함 여부는 기본값으로 채운다', () => {
		const out = normalizePdfPrefs({
			샘플: { consolidated: true, column: 'cumulative', include: { stockComp: true } },
			깨짐: { consolidated: 'yes', column: 'period' },
			열이상: { consolidated: false, column: '3개월' },
			null값: null
		});
		expect(Object.keys(out)).toEqual(['샘플']);
		expect(out['샘플']).toMatchObject({
			consolidated: true,
			column: 'cumulative',
			include: { baseSalary: true, stockComp: true, longTermBenefit: false }
		});
		expect(normalizePdfPrefs(undefined)).toEqual({});
		expect(normalizePdfPrefs('x')).toEqual({});
	});
});
