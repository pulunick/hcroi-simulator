import { describe, expect, it } from 'vitest';
import {
	assumptionText,
	changeWord,
	efficiencySentence,
	gapSentence,
	gradeRangeText,
	hcroiPerWon,
	nextPeriod,
	pctChange,
	profitGapToExcellent,
	reportBlocker,
	reportHeadline,
	reportKpis,
	reportScenarioRows,
	reportTrendRows,
	sameTypeUpTo,
	scenarioHeading,
	shortScenarioName,
	splitMultiple,
	todayText,
	topInsights,
	trendHeading,
	variableCostCaution,
	verdictTail
} from './data';
import { sampleRecords } from '../hcroi/defaults';
import { rollup } from '../hcroi/rollup';
import { DEFAULT_SCENARIO_PARAMS } from '../hcroi/scenario';
import { computeMetrics } from '../hcroi/formulas';
import {
	DEFAULT_HEADCOUNT_BASIS,
	type Insight,
	type PeriodRecord,
	type Scenario
} from '../hcroi/types';

const effective = rollup(sampleRecords(), DEFAULT_HEADCOUNT_BASIS);
const find = (label: string) =>
	effective.find((r) => `${r.period.year}-${r.period.type}${r.period.index}` === label)!;
const y2025 = find('2025-Y1');
const y2024 = find('2024-Y1');

const scenarios: Scenario[] = [
	{
		id: 'a',
		name: '시나리오 A',
		params: { ...DEFAULT_SCENARIO_PARAMS, headcountPct: 10, wageIncreasePct: 5 }
	},
	{
		id: 'b',
		name: '시나리오 B',
		params: { ...DEFAULT_SCENARIO_PARAMS, wageIncreasePct: 3, productivityPct: 8 }
	}
];

describe('표기 보조', () => {
	it('todayText 는 YYYY-MM-DD', () => {
		expect(todayText(new Date(2026, 8, 14))).toBe('2026-09-14');
	});

	it('pctChange 는 증감률(%)을 주고 기준 0 이면 null', () => {
		expect(pctChange(100, 110)).toBeCloseTo(10, 10);
		expect(pctChange(0, 10)).toBeNull();
		expect(pctChange(100, null)).toBeNull();
	});

	it('splitMultiple·hcroiPerWon 은 formatMultiple 의 숫자를 그대로 쓴다', () => {
		expect(splitMultiple(1.25)).toEqual({ value: '1.25', unit: '배' });
		expect(splitMultiple(null)).toEqual({ value: '—', unit: '' });
		expect(hcroiPerWon(1.25)).toBe('1.25원');
	});

	it('gradeRangeText 는 HCROI_THRESHOLDS 경계를 쓴다', () => {
		expect(gradeRangeText('critical')).toBe('1.0 미만');
		expect(gradeRangeText('warning')).toBe('1.0–1.5');
		expect(gradeRangeText('excellent')).toBe('1.5 이상');
	});

	it('changeWord 는 미세 변동을 무시한다', () => {
		expect(changeWord(0.06)).toBe('높아');
		expect(changeWord(-0.06)).toBe('낮아');
		expect(changeWord(0.001)).toBeNull();
		expect(changeWord(null)).toBeNull();
	});

	it('nextPeriod 는 previousPeriod 의 반대다', () => {
		expect(nextPeriod({ year: 2025, type: 'Y', index: 1 })).toEqual({
			year: 2026,
			type: 'Y',
			index: 1
		});
		expect(nextPeriod({ year: 2025, type: 'Q', index: 4 })).toEqual({
			year: 2026,
			type: 'Q',
			index: 1
		});
		expect(nextPeriod({ year: 2025, type: 'Q', index: 2 })).toEqual({
			year: 2025,
			type: 'Q',
			index: 3
		});
	});
});

describe('판단 문장', () => {
	it('reportHeadline 은 코어 등급·전기 대비 차이를 준다', () => {
		const h = reportHeadline(y2025, y2024);
		const m2025 = computeMetrics(y2025.inputs);
		const m2024 = computeMetrics(y2024.inputs);
		expect(h.hcroi).toBe(m2025.hcroi);
		expect(h.grade).toBe('warning');
		expect(h.gradeLabel).toBe('보통');
		expect(h.gradeRange).toBe('1.0–1.5');
		expect(h.prevWord).toBe('전년');
		expect(h.prevDelta).toBeCloseTo(m2025.hcroi! - m2024.hcroi!, 10);
		expect(h.prevLabel).toBe('2024년');
	});

	it('전기가 없으면 전기 대비는 null', () => {
		expect(reportHeadline(y2025, null).prevDelta).toBeNull();
	});

	it('verdictTail 은 등급 낱말 뒤 문장을 만든다', () => {
		expect(verdictTail(reportHeadline(y2025, y2024))).toBe('이며, 전년보다 0.05배 낮아졌습니다.');
		expect(verdictTail(reportHeadline(y2025, null))).toBe('입니다. 비교할 전년 자료는 없습니다.');
		expect(verdictTail(reportHeadline(y2025, y2025))).toBe('이며, 전년과 거의 같은 수준입니다.');
	});

	it('efficiencySentence 는 인당 인건비·인당 매출 증가율을 비교한다', () => {
		const s = efficiencySentence(y2025, y2024)!;
		expect(s).toContain('인당 인건비');
		expect(s).toContain('인당 매출');
		// 샘플: 인당 인건비 +2.2% vs 인당 매출 −2.1% → 효율 하락
		expect(s).toContain('효율이 떨어졌습니다');
		expect(efficiencySentence(y2025, null)).toBeNull();
	});

	it('profitGapToExcellent 는 HCROI 1.5 까지 필요한 영업이익을 준다', () => {
		// 2025 합산: 인건비 3,384,000,000 · 영업이익 846,000,000
		// HCROI 1.5 ⇒ (영업이익+인건비)/인건비 = 1.5 ⇒ 영업이익 = 1,692,000,000 → 부족분 846,000,000
		expect(profitGapToExcellent(y2025.inputs)).toBeCloseTo(846_000_000, 0);
		expect(gapSentence(y2025.inputs, 'thousand')).toBe(
			'우수 등급(1.50배)까지는 영업이익 846,000천원이 더 필요합니다.'
		);
	});

	it('이미 우수 등급이면 부족분 문장은 없다', () => {
		const strong = { revenue: 10_000, operatingCost: 5_000, hcCost: 2_000, headcount: 10 };
		expect(computeMetrics(strong).hcroi).toBeGreaterThan(1.5);
		expect(profitGapToExcellent(strong)).toBeNull();
		expect(gapSentence(strong, 'won')).toBeNull();
	});
});

describe('KPI · 추이', () => {
	it('reportKpis 는 4개이고 인원만 증감 인원으로 비교한다', () => {
		const kpis = reportKpis(y2025, y2024, '기간 평균(FTE) · 정규직만');
		expect(kpis).toHaveLength(4);
		expect(kpis.map((k) => k.label)).toEqual([
			'HCVA (인당 부가가치)',
			'인당 매출',
			'인당 인건비',
			'임직원 수'
		]);
		expect(kpis[0].value).toBe(computeMetrics(y2025.inputs).hcva);
		expect(kpis[0].deltaPct).not.toBeNull();
		expect(kpis[3].kind).toBe('headcount');
		expect(kpis[3].deltaCount).toBe(y2025.inputs.headcount - y2024.inputs.headcount);
		expect(kpis[3].note).toBe('기간 평균(FTE) · 정규직만');
	});

	it('reportTrendRows 는 같은 유형 최근 3개만 준다', () => {
		const rows = reportTrendRows(effective, y2025.period);
		expect(rows).toHaveLength(3);
		expect(rows.map((r) => r.record.period.year)).toEqual([2023, 2024, 2025]);
		expect(rows.every((r) => r.record.period.type === 'Y')).toBe(true);
		expect(rows[2].metrics.hcroi).toBe(computeMetrics(y2025.inputs).hcroi);
	});

	it('분기 추이는 보고 기간으로 끝나는 최근 3개 분기 (뒤 기간은 넣지 않는다)', () => {
		const q3 = find('2025-Q3');
		const rows = reportTrendRows(effective, q3.period);
		expect(rows.map((r) => r.record.period.index)).toEqual([1, 2, 3]);
		expect(sameTypeUpTo(effective, q3.period).map((r) => r.period.index)).toEqual([1, 2, 3]);
	});

	it('trendHeading 은 유형에 맞춘다', () => {
		expect(trendHeading('Y', 3)).toBe('3개년 추이');
		expect(trendHeading('Q', 3)).toBe('최근 3개 분기 추이');
	});
});

describe('시나리오 비교', () => {
	it('assumptionText 는 가정을 한 줄로 요약한다', () => {
		expect(assumptionText(scenarios[0].params)).toBe('인원 +10% · 임금 +5% · 생산성 ±0%');
		expect(
			assumptionText({
				...DEFAULT_SCENARIO_PARAMS,
				headcountMode: 'delta',
				headcountDelta: -3,
				variableCostRatioPct: 30
			})
		).toBe('인원 -3명 · 임금 ±0% · 생산성 ±0% · 변동비 30%');
	});

	it('shortScenarioName 은 "시나리오 A" 를 "A" 로 줄인다', () => {
		expect(shortScenarioName('시나리오 A')).toBe('A');
		expect(shortScenarioName('증원안')).toBe('증원안');
	});

	it('reportScenarioRows 는 기준 + 시나리오이고 값은 코어 compareScenarios 와 같다', () => {
		const rows = reportScenarioRows(y2025, scenarios);
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({ name: '기준', baseline: true, gradeLabel: '보통' });
		expect(rows[0].metrics.hcroi).toBe(computeMetrics(y2025.inputs).hcroi);
		expect(rows[0].assumption).toBe('2025년 실적 유지');
		expect(rows[1].name).toBe('A');
		expect(rows[1].inputs.headcount).toBe(Math.round(y2025.inputs.headcount * 1.1));
		expect(rows[2].name).toBe('B');
	});

	it('scenarioHeading 은 기준의 다음 기간을 쓴다', () => {
		expect(scenarioHeading(y2025.period)).toBe('2026년 시나리오 비교');
	});

	it('variableCostCaution 은 코어 인사이트 문장을 그대로 가져온다', () => {
		const caution = variableCostCaution(y2025.inputs, scenarios, 'thousand')!;
		expect(caution).toContain('변동비 비율 0%');
		expect(caution.startsWith('A: ')).toBe(true);
	});

	it('매출이 늘지 않는 시나리오만 있으면 주석은 없다', () => {
		const flat: Scenario[] = [{ id: 'f', name: '동결', params: { ...DEFAULT_SCENARIO_PARAMS } }];
		expect(variableCostCaution(y2025.inputs, flat, 'thousand')).toBeNull();
	});
});

describe('판단과 제안', () => {
	const mk = (tone: Insight['tone'], title: string): Insight => ({ tone, title, body: title });

	it('topInsights 는 심각한 것부터 3개, 중복은 제거한다', () => {
		const picked = topInsights(
			[
				[mk('positive', 'p'), mk('warning', 'w1')],
				[mk('critical', 'c'), mk('warning', 'w1'), mk('neutral', 'n')]
			],
			3
		);
		expect(picked.map((i) => i.title)).toEqual(['c', 'w1', 'n']);
		// 제목이 같으면 첫 번째만 남는다 (세 칸을 같은 경고로 채우지 않는다)
		expect(picked.filter((i) => i.title === 'w1')).toHaveLength(1);
	});

	it('빈 목록이면 빈 배열', () => {
		expect(topInsights([[], []])).toEqual([]);
	});
});

describe('reportBlocker', () => {
	it('데이터가 없으면 no-data', () => {
		expect(reportBlocker(null)).toEqual({ kind: 'no-data' });
	});

	it('검증 오류가 있으면 invalid', () => {
		const bad: PeriodRecord = {
			...y2025,
			inputs: { ...y2025.inputs, hcCost: 0 }
		};
		const b = reportBlocker(bad);
		expect(b?.kind).toBe('invalid');
	});

	it('정상 레코드면 null', () => {
		expect(reportBlocker(y2025)).toBeNull();
	});
});
