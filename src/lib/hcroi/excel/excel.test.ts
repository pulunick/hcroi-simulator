import { describe, expect, it } from 'vitest';
import { sampleYears } from '../defaults';
import { computeMetrics } from '../formulas';
import { compareScenarios } from '../scenario';
import { DEFAULT_SCENARIO_PARAMS } from '../scenario';
import { mergeYears, parseInputRows, parseNumber } from './fromRows';
import { buildTemplateBuffer, buildWorkbookBuffer, readInputSheet } from './io';
import { INPUT_COLUMNS, headerText } from './schema';
import { inputRows, scenarioSheet, summaryRows } from './toRows';

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

		const bad = parseInputRows(
			sheet(
				row({
					year: 2024,
					revenue: 10_000,
					operatingCost: 9_000,
					headcount: 10,
					hcCost: 1_500,
					...parts
				})
			)
		);
		expect(bad.records).toEqual([]);
		expect(bad.errors[0].messages[0]).toMatch(/세부 합계\(1,000\)가 총 인건비\(1,500\)/);
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
			years.map(({ year, inputs, breakdown, memo }) => ({ year, inputs, breakdown, memo }))
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
			baseYear: years[2]
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

	it('템플릿(샘플 포함/빈)도 같은 헤더로 읽힌다', async () => {
		const withSample = await readInputSheet(await buildTemplateBuffer({ withSample: true }));
		expect(parseInputRows(withSample).records).toHaveLength(3);
		const empty = await readInputSheet(await buildTemplateBuffer({ withSample: false }));
		const p = parseInputRows(empty);
		expect(p.headerError).toBeNull();
		expect(p.records).toEqual([]);
	});
});
