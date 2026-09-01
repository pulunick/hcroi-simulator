import { describe, expect, it } from 'vitest';
import { sampleYears } from './defaults';
import { scenarioInsights, trendInsights } from './insights';
import { DEFAULT_SCENARIO_PARAMS, runScenario } from './scenario';
import type { BaseInputs } from './types';

const base: BaseInputs = {
	revenue: 10_000_000_000,
	operatingCost: 9_200_000_000,
	hcCost: 3_000_000_000,
	headcount: 40
};

describe('scenarioInsights', () => {
	it('악화 시나리오 → 악화 헤드라인 + 원인 분석 + 구조적 개선책(손익분기 수치 포함)', () => {
		const r = runScenario(base, {
			id: 'a',
			name: 'A',
			params: { ...DEFAULT_SCENARIO_PARAMS, wageIncreasePct: 6, productivityPct: 1 }
		});
		const ins = scenarioInsights(base, r);
		const titles = ins.map((i) => i.title);
		expect(titles[0]).toContain('HCROI 악화');
		expect(titles).toContain('원인 분석');
		expect(titles).toContain('구조적 개선책');
		const fix = ins.find((i) => i.title === '구조적 개선책')!;
		expect(fix.body).toContain('인당 생산성 제고');
		expect(fix.body).toContain('임금 인상 상한');
		expect(fix.body).toContain('고정비 절감');
		// 숫자·단위 명시
		expect(ins[0].body).toMatch(/배/);
		expect(ins[0].body).toMatch(/억원|만원|원/);
		expect(ins[0].body).toMatch(/명/);
	});

	it('개선 시나리오 → 긍정 헤드라인, 인원 감축이면 지속가능성 점검', () => {
		const r = runScenario(base, {
			id: 'b',
			name: 'B',
			params: { ...DEFAULT_SCENARIO_PARAMS, headcountPct: -5, productivityPct: 8 }
		});
		const ins = scenarioInsights(base, r);
		expect(ins[0].tone).toBe('positive');
		expect(ins.map((i) => i.title)).toContain('지속가능성 점검');
	});

	it('개선 + 매출 1% 초과 증가 + 변동비 비율 0% → 고정비 가정 과대 추정 경고, 변동비 비율 > 0 이거나 매출 증가 미미하면 없음', () => {
		const params = {
			...DEFAULT_SCENARIO_PARAMS,
			headcountPct: 10,
			wageIncreasePct: 2,
			productivityPct: 3
		};
		const fixedOnly = scenarioInsights(
			base,
			runScenario(base, { id: 'a', name: 'A', params: { ...params, variableCostRatioPct: 0 } })
		);
		expect(fixedOnly[0].title).toContain('HCROI 개선');
		const note = fixedOnly.find((i) => i.title === '지속가능성 점검')!;
		expect(note.body).toContain('전액 고정비로 가정');
		expect(note.body).toContain('변동비 비율 0%');
		expect(note.body).toMatch(/\d억원/); // 비인건비·매출 증가액 숫자 명시

		const withVariable = scenarioInsights(
			base,
			runScenario(base, { id: 'b', name: 'B', params: { ...params, variableCostRatioPct: 30 } })
		);
		const note2 = withVariable.find((i) => i.title === '지속가능성 점검');
		expect(note2?.body ?? '').not.toContain('전액 고정비로 가정');

		// 감원 + 생산성 소폭 개선 → 매출 증가 < 1% 이면 경고하지 않는다 (40명×0.95=38명, 생산성 +5.5% → 매출 +0.2%)
		const tiny = scenarioInsights(
			base,
			runScenario(base, {
				id: 'c',
				name: 'C',
				params: {
					...DEFAULT_SCENARIO_PARAMS,
					headcountPct: -5,
					productivityPct: 5.5,
					variableCostRatioPct: 0
				}
			})
		);
		const note3 = tiny.find((i) => i.title === '지속가능성 점검');
		expect(note3?.body ?? '').not.toContain('전액 고정비로 가정');
	});

	it('영업손실 전환 시 critical 경고', () => {
		const r = runScenario(base, {
			id: 'c',
			name: 'C',
			params: { ...DEFAULT_SCENARIO_PARAMS, wageIncreasePct: 40 }
		});
		const ins = scenarioInsights(base, r);
		expect(ins.some((i) => i.title === '영업손실 전환' && i.tone === 'critical')).toBe(true);
	});

	it('인건비 0 → 산출 불가 안내', () => {
		const zero = { ...base, hcCost: 0 };
		const r = runScenario(zero, { id: 'z', name: 'Z', params: DEFAULT_SCENARIO_PARAMS });
		expect(scenarioInsights(zero, r)[0].title).toBe('HCROI 산출 불가');
	});
});

describe('trendInsights', () => {
	it('샘플 3개년은 2년 연속 하락으로 진단된다', () => {
		const ins = trendInsights(sampleYears());
		expect(ins[0].title).toBe('HCROI 2년 연속 하락');
		expect(ins.some((i) => i.title.includes('인건비 증가율'))).toBe(true);
	});
	it('1개년 이하이면 비어 있다', () => {
		expect(trendInsights(sampleYears().slice(0, 1))).toEqual([]);
	});
});
