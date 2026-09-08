import { describe, expect, it } from 'vitest';
import { sampleYears } from '../defaults';
import { computeMetrics } from '../formulas';
import { compareScenarios } from '../scenario';
import { DEFAULT_SCENARIO_PARAMS } from '../scenario';
import {
	ORG_NAME_MAX,
	mergeYears,
	parseHeadcountBasis,
	parseInputRows,
	parseNumber,
	parseOrgName
} from './fromRows';
import { buildTemplateBuffer, buildWorkbookBuffer, readInputSheet, readWorkbook } from './io';
import { BASIS_SHEET, INPUT_COLUMNS, ORG_SHEET, headerText } from './schema';
import { inputRows, scenarioSheet, summaryRows } from './toRows';
import { DEFAULT_HEADCOUNT_BASIS, type HeadcountBasis } from '../types';

const header = INPUT_COLUMNS.map(headerText);
const col = (key: string) => INPUT_COLUMNS.findIndex((c) => c.key === key);
function row(values: Partial<Record<string, unknown>>): unknown[] {
	const r: unknown[] = new Array(INPUT_COLUMNS.length).fill(null);
	for (const [k, v] of Object.entries(values)) r[col(k)] = v;
	return r;
}
const sheet = (...data: unknown[][]) => [header, header.map(() => '단위 설명'), ...data];

describe('parseNumber', () => {
	it('숫자·콤마 문자열·단위 접미사·빈값·해석불가를 구분한다', () => {
		expect(parseNumber(14100000000)).toBe(14100000000);
		expect(parseNumber('14,100,000,000')).toBe(14100000000);
		expect(parseNumber(' 36 명')).toBe(36);
		expect(parseNumber('')).toBeNull();
		expect(parseNumber(null)).toBeNull();
		expect(parseNumber('십사억')).toBeNaN();
		expect(parseNumber('1.5억')).toBeNaN(); // 억 단위 입력은 받지 않는다
	});
});

describe('parseInputRows', () => {
	it('정상 행 → YearRecord (영업비용 우선, 세부 없으면 breakdown null)', () => {
		const r = parseInputRows(
			sheet(
				row({
					year: 2025,
					revenue: '14,100,000,000',
					operatingCost: 13254000000,
					headcount: 36,
					hcCost: 3384000000,
					memo: '결산'
				})
			)
		);
		expect(r.headerError).toBeNull();
		expect(r.errors).toEqual([]);
		expect(r.records).toHaveLength(1);
		const rec = r.records[0].record;
		expect(rec).toEqual({
			year: 2025,
			inputs: {
				revenue: 14100000000,
				operatingCost: 13254000000,
				hcCost: 3384000000,
				headcount: 36
			},
			breakdown: null,
			headcountBreakdown: null,
			memo: '결산'
		});
		expect(computeMetrics(rec.inputs).hcroi).toBeCloseTo(1.25, 2);
	});

	it('영업이익만 있으면 영업비용 = 매출 − 영업이익', () => {
		const r = parseInputRows(
			sheet(
				row({ year: 2024, revenue: 10_000, operatingProfit: 800, headcount: 10, hcCost: 2_000 })
			)
		);
		expect(r.errors).toEqual([]);
		expect(r.records[0].record.inputs.operatingCost).toBe(9_200);
	});

	it('세부 6항목이 있으면 합계로 총 인건비를 채우고, 총액과 어긋나면 오류', () => {
		const parts = {
			baseSalary: 620,
			incentives: 140,
			retirement: 80,
			statutoryWelfare: 90,
			otherWelfare: 50,
			training: 20
		};
		const ok = parseInputRows(
			sheet(row({ year: 2024, revenue: 10_000, operatingCost: 9_000, headcount: 10, ...parts }))
		);
		expect(ok.errors).toEqual([]);
		expect(ok.records[0].record.inputs.hcCost).toBe(1_000);
		expect(ok.records[0].record.breakdown).toEqual(parts);

		// 합계가 총액보다 "큰" 경우만 오류 (적은 경우는 미분류 허용 — 아래 별도 describe 참조)
		const bad = parseInputRows(
			sheet(
				row({
					year: 2024,
					revenue: 10_000,
					operatingCost: 9_000,
					headcount: 10,
					hcCost: 800,
					...parts
				})
			)
		);
		expect(bad.records).toEqual([]);
		expect(bad.errors[0].messages[0]).toMatch(/세부 합계\(1,000\)가 총 인건비\(800\)보다 큽니다/);
	});

	it('필수 누락·비숫자·인건비>영업비용·연도 중복은 행 단위 오류, 빈 행은 무시', () => {
		const r = parseInputRows(
			sheet(
				row({ year: 2023, revenue: 10_000, operatingCost: 9_000, headcount: 10, hcCost: 2_000 }),
				[],
				row({ year: 2023, revenue: 10_000, operatingCost: 9_000, headcount: 10, hcCost: 2_000 }),
				row({ year: 2024, revenue: null, operatingCost: 9_000, headcount: 10, hcCost: 2_000 }),
				row({ year: 2025, revenue: 'abc', operatingCost: 9_000, headcount: 10, hcCost: 2_000 }),
				row({ year: 2026, revenue: 10_000, operatingCost: 1_000, headcount: 10, hcCost: 2_000 }),
				row({ year: 2027, revenue: 10_000, headcount: 10, hcCost: 2_000 })
			)
		);
		expect(r.records.map((x) => x.record.year)).toEqual([2023]);
		expect(r.errors.map((e) => e.row)).toEqual([5, 6, 7, 8, 9]);
		expect(r.errors[0].messages[0]).toContain('중복');
		expect(r.errors[1].messages[0]).toContain('매출액이 비어');
		expect(r.errors[2].messages[0]).toContain('숫자로 읽을 수 없');
		expect(r.errors[3].messages[0]).toContain('영업비용보다 클 수 없');
		expect(r.errors[4].messages[0]).toContain('영업비용 또는 영업이익');
	});

	it('헤더가 없거나 필수 열이 빠지면 headerError', () => {
		expect(parseInputRows([['아무거나', '값']]).headerError).toMatch(/필수 열/);
		expect(parseInputRows([]).headerError).toMatch(/필수 열/);
		const noHc = header.filter((h) => !h.startsWith('총 인건비'));
		expect(parseInputRows([noHc]).headerError).toContain('총 인건비');
	});

	it('헤더는 단위·별표·공백 차이를 무시하고 매칭한다', () => {
		const loose = [
			'연도',
			'매출액',
			' 영업비용(인건비 포함) ',
			'영업이익',
			'총임직원수',
			'총 인건비 (원)'
		];
		const r = parseInputRows([loose, [], [2025, 100, 90, null, 1, 10]]);
		expect(r.headerError).toBeNull();
		expect(r.records[0].record.inputs).toEqual({
			revenue: 100,
			operatingCost: 90,
			hcCost: 10,
			headcount: 1
		});
	});
});

describe('toRows ↔ fromRows 왕복', () => {
	it('샘플 3개년을 내보낸 행을 다시 파싱하면 입력값이 그대로 복원된다', () => {
		const years = sampleYears();
		const rows = inputRows(years).map((r) => INPUT_COLUMNS.map((c) => r[c.key]));
		const parsed = parseInputRows(sheet(...rows));
		expect(parsed.errors).toEqual([]);
		expect(parsed.records.map((p) => p.record)).toEqual(
			years.map(({ year, inputs, breakdown, memo }) => ({
				year,
				inputs,
				breakdown,
				headcountBreakdown: null,
				memo
			}))
		);
	});

	it('summaryRows 는 지표 값을 계산해 넣는다 (2025 HCROI 1.25)', () => {
		const rows = summaryRows(sampleYears());
		expect(rows).toHaveLength(3);
		expect(rows[2][0]).toBe(2025);
		expect(rows[2][1]).toBeCloseTo(1.25, 2);
		expect(rows[2][3]).toBe('보통');
	});

	it('scenarioSheet 는 파라미터 8행 + 지표 9행, 증감은 시나리오−기준', () => {
		const base = sampleYears()[2];
		const cmp = compareScenarios(base.inputs, [
			{ id: 'a', name: 'A', params: { ...DEFAULT_SCENARIO_PARAMS, headcountPct: 10 } },
			{ id: 'b', name: 'B', params: { ...DEFAULT_SCENARIO_PARAMS, headcountPct: -5 } }
		]);
		const s = scenarioSheet(base.year, cmp);
		expect(s.paramHeader).toEqual(['항목', 'A', 'B']);
		expect(s.params).toHaveLength(8);
		expect(s.metricHeader).toEqual(['지표', '기준(2025)', 'A', '증감', 'B', '증감']);
		expect(s.metrics).toHaveLength(9);
		const hc = s.metrics.find((m) => m.label.startsWith('총 임직원'))!;
		expect(hc.values).toEqual([36, 40, 4, 34, -2]);
	});
});

describe('인건비 세부 항목이 6개 미만인 회사', () => {
	// 실무 확인(2026-09-03): 기본급·성과급·퇴직급여·기타 복리후생비 4항목만 분리되는 경우가 있다
	const fourParts = {
		year: 2025,
		revenue: 14_100_000_000,
		operatingCost: 13_254_000_000,
		headcount: 36,
		hcCost: 3_384_000_000,
		baseSalary: 2_100_000_000,
		incentives: 470_000_000,
		retirement: 270_000_000,
		otherWelfare: 170_000_000
	};

	it('세부 합계가 총액보다 적으면 경고만 내고 총액을 그대로 쓴다', () => {
		const p = parseInputRows(sheet(row(fourParts)));
		expect(p.errors).toEqual([]);
		expect(p.records).toHaveLength(1);
		const rec = p.records[0];
		expect(rec.record.inputs.hcCost).toBe(3_384_000_000); // 합계(3,010,000,000)로 덮어쓰지 않는다
		expect(rec.warnings.join(' ')).toMatch(/미분류/);
		expect(rec.record.breakdown?.statutoryWelfare).toBe(0);
	});

	it('세부 합계가 총액보다 크면 여전히 오류다', () => {
		const p = parseInputRows(sheet(row({ ...fourParts, hcCost: 1_000_000_000 })));
		expect(p.records).toEqual([]);
		expect(p.errors[0].messages.join(' ')).toMatch(/보다 큽니다/);
	});

	it('총액을 비우면 종전대로 세부 합계를 총액으로 쓴다', () => {
		const p = parseInputRows(sheet(row({ ...fourParts, hcCost: null })));
		expect(p.errors).toEqual([]);
		expect(p.records[0].record.inputs.hcCost).toBe(3_010_000_000);
	});
});

describe('인원 구분 · 임직원 수 산정 기준', () => {
	const base = {
		year: 2025,
		revenue: 14_100_000_000,
		operatingCost: 13_254_000_000,
		hcCost: 3_384_000_000
	};
	const parts = { regular: 30, contract: 4, dispatched: 3, executive: 2 };
	const basis = (patch: Partial<HeadcountBasis['include']> = {}): HeadcountBasis => ({
		method: 'average',
		include: { ...DEFAULT_HEADCOUNT_BASIS.include, ...patch }
	});

	it('총원을 비워도 인원 구분 합계로 채운다 (기본: 정규직만)', () => {
		const p = parseInputRows(sheet(row({ ...base, ...parts })), DEFAULT_HEADCOUNT_BASIS);
		expect(p.errors).toEqual([]);
		expect(p.records[0].record.inputs.headcount).toBe(30);
		expect(p.records[0].record.headcountBreakdown).toEqual(parts);
	});

	it('포함 기준을 켜면 합계가 달라진다', () => {
		const p = parseInputRows(sheet(row({ ...base, ...parts })), basis({ contract: true }));
		expect(p.records[0].record.inputs.headcount).toBe(34);
	});

	it('총원 칸이 구분 합계와 다르면 합계를 쓰고 경고한다', () => {
		const p = parseInputRows(
			sheet(row({ ...base, ...parts, headcount: 39 })),
			DEFAULT_HEADCOUNT_BASIS
		);
		expect(p.errors).toEqual([]);
		expect(p.records[0].record.inputs.headcount).toBe(30);
		expect(p.records[0].warnings.join(' ')).toMatch(/인원 구분 합계/);
	});

	it('인원 구분이 없으면 종전대로 총원 칸을 쓴다', () => {
		const p = parseInputRows(sheet(row({ ...base, headcount: 36 })));
		expect(p.records[0].record.inputs.headcount).toBe(36);
		expect(p.records[0].record.headcountBreakdown).toBeNull();
	});

	it('총원도 인원 구분도 없으면 오류', () => {
		const p = parseInputRows(sheet(row(base)));
		expect(p.records).toEqual([]);
		expect(p.errors[0].messages.join(' ')).toMatch(/총 임직원 수가 비어 있습니다/);
	});

	it('조직 정보 시트에서 산정 기준을 읽는다', () => {
		const rows = [
			[ORG_SHEET.label, '가나다'],
			[],
			[],
			[BASIS_SHEET.method.label, BASIS_SHEET.method.periodEnd],
			[BASIS_SHEET.include.contract, BASIS_SHEET.yes],
			[BASIS_SHEET.include.dispatched, BASIS_SHEET.no],
			[BASIS_SHEET.include.executive, BASIS_SHEET.yes]
		];
		expect(parseHeadcountBasis(rows)).toEqual({
			method: 'periodEnd',
			include: { contract: true, dispatched: false, executive: true }
		});
	});

	it('기준 행이 없는 옛 파일은 null (현재 설정을 건드리지 않는다)', () => {
		expect(parseHeadcountBasis(null)).toBeNull();
		expect(parseHeadcountBasis([[ORG_SHEET.label, '가나다']])).toBeNull();
	});
});

describe('parseOrgName', () => {
	const L = ORG_SHEET.label;
	it('라벨 오른쪽 칸의 이름을 읽는다', () => {
		expect(parseOrgName([[L, '  가나다 주식회사  ']])).toBe('가나다 주식회사');
	});
	it('시트가 없으면 null (제목을 건드리지 않는다)', () => {
		expect(parseOrgName(null)).toBeNull();
	});
	it('라벨을 못 찾으면 null', () => {
		expect(parseOrgName([['엉뚱한 칸', '값']])).toBeNull();
	});
	it('라벨은 있고 값이 비면 빈 문자열 (기본 제목으로 되돌림)', () => {
		expect(parseOrgName([[L, null]])).toBe('');
		expect(parseOrgName([[L, '   ']])).toBe('');
	});
	it('위쪽에 줄이 끼어 있어도 찾고, 너무 긴 이름은 자른다', () => {
		expect(parseOrgName([[], ['메모'], [L, '나다라']])).toBe('나다라');
		expect(parseOrgName([[L, '가'.repeat(80)]])).toHaveLength(ORG_NAME_MAX);
	});
});

describe('mergeYears', () => {
	const existing = sampleYears();
	const parsed = parseInputRows(
		sheet(
			row({ year: 2025, revenue: 1, operatingCost: 1, headcount: 1, hcCost: 1 }),
			row({ year: 2026, revenue: 2, operatingCost: 2, headcount: 1, hcCost: 1 })
		)
	).records;

	it('덮어쓰기: 기존 연도는 id 유지하고 교체, 새 연도는 추가, 연도순 정렬', () => {
		const r = mergeYears(existing, parsed, { overwrite: true, newId: () => 'new' });
		expect([r.added, r.updated, r.skipped]).toEqual([1, 1, 0]);
		expect(r.years.map((y) => y.year)).toEqual([2023, 2024, 2025, 2026]);
		expect(r.years[2]).toMatchObject({ id: 'sample-2025', inputs: { revenue: 1 } });
		expect(r.years[3].id).toBe('new');
		expect(existing[2].inputs.revenue).toBe(14_100_000_000); // 원본 불변
	});

	it('덮어쓰기 끔: 기존 연도는 건너뛴다', () => {
		const r = mergeYears(existing, parsed, { overwrite: false, newId: () => 'new' });
		expect([r.added, r.updated, r.skipped]).toEqual([1, 0, 1]);
		expect(r.years[2].inputs.revenue).toBe(14_100_000_000);
	});
});

// exceljs 번들 첫 로드가 수 초 걸린다
describe('exceljs 입출력 (node)', { timeout: 30_000 }, () => {
	it('내보낸 xlsx 를 다시 읽으면 입력 시트가 왕복된다', async () => {
		const years = sampleYears();
		const buf = await buildWorkbookBuffer({
			years,
			scenarios: [
				{ id: 'a', name: '시나리오 A', params: { ...DEFAULT_SCENARIO_PARAMS, headcountPct: 10 } }
			],
			baseYear: years[2],
			orgName: '가나다 주식회사'
		});
		expect(buf.byteLength).toBeGreaterThan(5_000);
		const rows = await readInputSheet(buf);
		expect(rows[0][0]).toBe('연도 *');
		const parsed = parseInputRows(rows);
		expect(parsed.headerError).toBeNull();
		expect(parsed.errors).toEqual([]);
		expect(parsed.records.map((p) => p.record.inputs)).toEqual(years.map((y) => y.inputs));
		expect(parsed.records.map((p) => p.record.breakdown)).toEqual(years.map((y) => y.breakdown));
	});

	it('조직 정보 시트로 회사명이 왕복된다', async () => {
		const years = sampleYears();
		const withName = await readWorkbook(
			await buildWorkbookBuffer({
				years,
				scenarios: [],
				baseYear: null,
				orgName: '가나다 주식회사'
			})
		);
		expect(parseOrgName(withName.org)).toBe('가나다 주식회사');

		// 회사명 없이 내보내면 시트는 있고 값만 비어 있다 → 빈 문자열(기본 제목)
		const blank = await readWorkbook(
			await buildWorkbookBuffer({ years, scenarios: [], baseYear: null })
		);
		expect(parseOrgName(blank.org)).toBe('');

		// 템플릿에도 빈 칸이 들어 있어 사용자가 바로 적을 수 있다
		const tpl = await readWorkbook(await buildTemplateBuffer({ withSample: true }));
		expect(tpl.org).not.toBeNull();
		expect(parseOrgName(tpl.org)).toBe('');
	});

	it('인원 구분과 산정 기준이 파일로 왕복된다', async () => {
		const years = sampleYears().map((y) => ({
			...y,
			headcountBreakdown: {
				regular: y.inputs.headcount - 6,
				contract: 4,
				dispatched: 0,
				executive: 2
			}
		}));
		const basis: HeadcountBasis = {
			method: 'periodEnd',
			include: { contract: true, dispatched: false, executive: false }
		};
		// 총 임직원 수는 기준을 적용한 합계와 맞춰 둔다 (정규직 + 계약직)
		for (const y of years) y.inputs.headcount = y.headcountBreakdown.regular + 4;

		const read = await readWorkbook(
			await buildWorkbookBuffer({
				years,
				scenarios: [],
				baseYear: null,
				orgName: '가나다 주식회사',
				headcountBasis: basis
			})
		);
		expect(parseHeadcountBasis(read.org)).toEqual(basis);

		const parsed = parseInputRows(read.input, parseHeadcountBasis(read.org) ?? undefined);
		expect(parsed.errors).toEqual([]);
		expect(parsed.records.map((p) => p.record.headcountBreakdown)).toEqual(
			years.map((y) => y.headcountBreakdown)
		);
		expect(parsed.records.map((p) => p.record.inputs.headcount)).toEqual(
			years.map((y) => y.inputs.headcount)
		);
		// 기준이 바뀌면 같은 파일에서도 총원이 달라진다 (그래서 기준을 파일에 싣는다)
		const asDefault = parseInputRows(read.input, DEFAULT_HEADCOUNT_BASIS);
		expect(asDefault.records[0].record.inputs.headcount).toBe(years[0].headcountBreakdown.regular);
	});

	it('템플릿(샘플 포함/빈)도 같은 헤더로 읽힌다', async () => {
		const withSample = await readInputSheet(await buildTemplateBuffer({ withSample: true }));
		expect(parseInputRows(withSample).records).toHaveLength(3);
		const empty = await readInputSheet(await buildTemplateBuffer({ withSample: false }));
		const p = parseInputRows(empty);
		expect(p.headerError).toBeNull();
		expect(p.records).toEqual([]);
	});
});
