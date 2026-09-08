import { describe, expect, it } from 'vitest';
import {
	computeMetrics,
	diagnose,
	gradeOf,
	operatingCostFromProfit,
	sumHcCost,
	sumHeadcount,
	validateInputs
} from './formulas';
import { splitHcCost, sampleRecords } from './defaults';
import {
	amountUnitLabel,
	formatAmount,
	formatKrwCompact,
	formatSigned,
	headcountBasisLabel,
	niceTicks
} from './format';
import { DEFAULT_HEADCOUNT_BASIS, type BaseInputs, type HeadcountBasis } from './types';

const base: BaseInputs = { revenue: 100, operatingCost: 90, hcCost: 30, headcount: 10 };

describe('computeMetrics — 핵심 수식', () => {
	it('영업이익·인적자본 투입 전 이익·HCROI·HCVA 를 정의대로 산출한다', () => {
		const m = computeMetrics(base);
		expect(m.operatingProfit).toBe(10);
		expect(m.nonHcCost).toBe(60);
		expect(m.profitBeforeHc).toBe(40); // 100 - (90 - 30)
		expect(m.hcroi).toBeCloseTo(40 / 30, 10);
		expect(m.hcva).toBe(4);
		expect(m.revenuePerHead).toBe(10);
		expect(m.hcCostPerHead).toBe(3);
		expect(m.operatingMargin).toBeCloseTo(10, 10);
		expect(m.hcCostToRevenue).toBeCloseTo(30, 10);
		expect(m.hcCostShareOfOpCost).toBeCloseTo((30 / 90) * 100, 10);
	});

	it('[매출액 - (영업비용 - 인건비)] 와 [영업이익 + 인건비] 두 표현이 항상 일치한다', () => {
		for (const y of sampleRecords()) {
			const m = computeMetrics(y.inputs);
			expect(m.profitBeforeHc).toBeCloseTo(m.operatingProfit + y.inputs.hcCost, 6);
		}
	});

	it('분모가 0이면 해당 지표는 null', () => {
		expect(computeMetrics({ ...base, hcCost: 0 }).hcroi).toBeNull();
		expect(computeMetrics({ ...base, headcount: 0 }).hcva).toBeNull();
		expect(computeMetrics({ ...base, headcount: 0 }).revenuePerHead).toBeNull();
		expect(computeMetrics({ ...base, revenue: 0 }).operatingMargin).toBeNull();
	});

	it('영업손실이면 HCROI 가 1.0 미만이 된다', () => {
		const m = computeMetrics({ ...base, operatingCost: 105 });
		expect(m.operatingProfit).toBe(-5);
		expect(m.hcroi!).toBeLessThan(1);
	});

	it('영업이익 → 영업비용 환산', () => {
		expect(operatingCostFromProfit(100, 10)).toBe(90);
	});
});

describe('진단 등급', () => {
	it('경계값: <1.0 위험 / 1.0~1.5 보통 / ≥1.5 우수 (2026-09-03: 양호 구간 폐지)', () => {
		expect(gradeOf(0.99)).toBe('critical');
		expect(gradeOf(1.0)).toBe('warning');
		expect(gradeOf(1.3)).toBe('warning');
		expect(gradeOf(1.49)).toBe('warning');
		expect(gradeOf(1.5)).toBe('excellent');
		expect(gradeOf(null)).toBeNull();
	});
	it('diagnose 는 등급명과 수치가 포함된 요약을 준다', () => {
		const d = diagnose(1.25)!;
		expect(d.label).toBe('보통');
		expect(d.summary).toContain('1.25');
	});
});

describe('총 인건비 구성', () => {
	it('6개 항목 합계', () => {
		expect(
			sumHcCost({
				baseSalary: 1,
				incentives: 2,
				retirement: 3,
				statutoryWelfare: 4,
				otherWelfare: 5,
				training: 6
			})
		).toBe(21);
	});
	it('splitHcCost 는 합계가 정확히 총액과 같다 (반올림 잔차 보정)', () => {
		for (const total of [1, 999, 1_000_003, 3_384_000_000]) {
			expect(sumHcCost(splitHcCost(total))).toBe(total);
		}
	});
});

describe('validateInputs', () => {
	it('정상 입력은 오류 없음', () => {
		expect(validateInputs(base)).toEqual([]);
	});
	it('인건비 > 영업비용, 인원 0, 인건비 0 을 잡아낸다', () => {
		expect(validateInputs({ ...base, hcCost: 95 }).join()).toContain('영업비용보다 클 수 없습니다');
		expect(validateInputs({ ...base, headcount: 0 }).join()).toContain('임직원 수');
		expect(validateInputs({ ...base, hcCost: 0 }).join()).toContain('총 인건비');
	});
});

describe('sumHeadcount — 임직원 수 산정 기준', () => {
	const hc = { regular: 30, contract: 4, dispatched: 3, executive: 2 };
	const basis = (patch: Partial<HeadcountBasis['include']> = {}): HeadcountBasis => ({
		method: 'average',
		include: { ...DEFAULT_HEADCOUNT_BASIS.include, ...patch }
	});

	it('기본값은 정규직만 센다', () => {
		expect(sumHeadcount(hc, DEFAULT_HEADCOUNT_BASIS)).toBe(30);
	});
	it('포함 토글을 켠 구분만 더한다', () => {
		expect(sumHeadcount(hc, basis({ contract: true }))).toBe(34);
		expect(sumHeadcount(hc, basis({ contract: true, executive: true }))).toBe(36);
		expect(sumHeadcount(hc, basis({ contract: true, dispatched: true, executive: true }))).toBe(39);
	});
	it('기간 평균/기말은 표기용이라 합계를 바꾸지 않는다', () => {
		expect(sumHeadcount(hc, { ...basis(), method: 'periodEnd' })).toBe(
			sumHeadcount(hc, { ...basis(), method: 'average' })
		);
	});
	it('빈 칸(NaN)은 0으로 본다', () => {
		expect(sumHeadcount({ ...hc, contract: NaN }, basis({ contract: true }))).toBe(30);
	});
	it('기준을 한 줄로 표기한다', () => {
		expect(headcountBasisLabel(DEFAULT_HEADCOUNT_BASIS)).toBe('기간 평균(FTE) · 정규직만');
		expect(headcountBasisLabel(basis({ contract: true }))).toBe(
			'기간 평균(FTE) · 정규직+계약직·기간제'
		);
		expect(headcountBasisLabel({ ...basis({ executive: true }), method: 'periodEnd' })).toBe(
			'기말 인원 · 정규직+등기임원'
		);
	});
});

describe('format', () => {
	it('한국식 축약 금액', () => {
		expect(formatKrwCompact(152_340_000_000)).toBe('1,523.4억원');
		expect(formatKrwCompact(85_000_000)).toBe('8,500만원');
		expect(formatKrwCompact(12_345)).toBe('1.2만원');
		expect(formatKrwCompact(9_999)).toBe('9,999원');
		expect(formatKrwCompact(-1_200_000_000)).toBe('-12.0억원');
		expect(formatKrwCompact(null)).toBe('—');
	});
	it('표시 단위 옵션 — 저장값(원)은 그대로 두고 표기만 바꾼다', () => {
		const v = 14_100_000_000; // 141억원
		expect(formatAmount(v, 'won')).toBe('14,100,000,000원');
		expect(formatAmount(v, 'thousand')).toBe('14,100,000천원');
		expect(formatAmount(v, 'million')).toBe('14,100백만원');
		expect(formatAmount(v, 'billion')).toBe('141.0억원');
		// 10억 미만(인당 지표)은 소수 둘째 자리까지 — 연도 간 차이가 보이도록
		expect(formatAmount(117_500_000, 'billion')).toBe('1.18억원');
		expect(formatAmount(v, 'auto')).toBe(formatKrwCompact(v));
		// 단위를 헤더·축이 이미 밝힌 경우 통화어를 뗀다
		expect(formatAmount(v, 'thousand', '')).toBe('14,100,000천');
		// 음수·결측
		expect(formatAmount(-2_000_000, 'thousand')).toBe('-2,000천원');
		expect(formatAmount(null, 'thousand')).toBe('—');
		// 선택 단위보다 작은 금액은 0 으로 뭉개지 않는다
		expect(formatAmount(1_200, 'million')).toBe('0.00백만원');
		expect(amountUnitLabel('thousand')).toBe('천원');
		expect(amountUnitLabel('auto')).toBe('원');
	});
	it('부호 표기', () => {
		expect(formatSigned(3, (n) => `${n}p`)).toBe('+3p');
		expect(formatSigned(-3, (n) => `${n}p`)).toBe('-3p');
		expect(formatSigned(0, (n) => `${n}p`)).toBe('±0p');
	});
	it('niceTicks 는 0을 포함하고 단조 증가한다', () => {
		const t = niceTicks(0.8, 1.6);
		expect(t[0]).toBeLessThanOrEqual(0);
		expect(t[t.length - 1]).toBeGreaterThanOrEqual(1.6);
		for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
		const neg = niceTicks(-500, 1200);
		expect(neg).toContain(0);
	});
});
