import { describe, expect, it } from 'vitest';
import {
	allPeriodTexts,
	childPeriods,
	childType,
	comparePeriods,
	isValidPeriod,
	parentPeriod,
	parentType,
	parsePeriodText,
	periodKey,
	periodLabel,
	periodMonths,
	periodShortLabel,
	periodText,
	periodUnitWord,
	prevWord,
	previousPeriod,
	yearAgoPeriod
} from './period';
import type { Period } from './types';

const Y = (year: number): Period => ({ year, type: 'Y', index: 1 });
const H = (year: number, index: number): Period => ({ year, type: 'H', index });
const Q = (year: number, index: number): Period => ({ year, type: 'Q', index });
const M = (year: number, index: number): Period => ({ year, type: 'M', index });

describe('period — 라벨·키·유효성', () => {
	it('라벨', () => {
		expect(periodLabel(Y(2025))).toBe('2025년');
		expect(periodLabel(H(2025, 1))).toBe('2025년 상반기');
		expect(periodLabel(H(2025, 2))).toBe('2025년 하반기');
		expect(periodLabel(Q(2025, 3))).toBe('2025년 3분기');
		expect(periodShortLabel(Y(2025))).toBe('2025');
		expect(periodShortLabel(Q(2025, 3))).toBe('2025 Q3');
	});
	it('키는 기간마다 고유하다', () => {
		expect(periodKey(Y(2025))).toBe('2025-Y1');
		expect(periodKey(Q(2025, 4))).toBe('2025-Q4');
		expect(periodKey(Q(2025, 4))).not.toBe(periodKey(H(2025, 2)));
	});
	it('순번 범위를 검사한다', () => {
		expect(isValidPeriod(Q(2025, 4))).toBe(true);
		expect(isValidPeriod(Q(2025, 5))).toBe(false);
		expect(isValidPeriod(H(2025, 3))).toBe(false);
		expect(isValidPeriod({ year: 2025, type: 'Y', index: 2 })).toBe(false);
		expect(isValidPeriod(Y(1800))).toBe(false);
		expect(isValidPeriod(M(2025, 12))).toBe(true);
		expect(isValidPeriod(M(2025, 13))).toBe(false);
		// 알 수 없는 유형은 거부한다 — 저장값 이행에서 조용히 통과하면 안 된다
		expect(isValidPeriod({ year: 2025, type: 'W' as never, index: 3 })).toBe(false);
	});
	it('시작·끝 월', () => {
		expect(periodMonths(Q(2025, 3))).toEqual({ start: 7, end: 9 });
		expect(periodMonths(H(2025, 2))).toEqual({ start: 7, end: 12 });
		expect(periodMonths(Y(2025))).toEqual({ start: 1, end: 12 });
	});
});

describe('period — 정렬', () => {
	it('끝 월 기준, 같은 끝이면 세분 단위 먼저 → 한 해의 분기·반기 뒤에 연간이 온다', () => {
		const sorted = [Y(2025), Q(2025, 4), H(2025, 2), Q(2025, 1), H(2025, 1), Q(2024, 4), Q(2025, 2)]
			.sort(comparePeriods)
			.map(periodKey);
		expect(sorted).toEqual([
			'2024-Q4',
			'2025-Q1',
			'2025-Q2',
			'2025-H1',
			'2025-Q4',
			'2025-H2',
			'2025-Y1'
		]);
	});
});

describe('period — 엑셀 기간 텍스트', () => {
	it('여러 표기를 받아들이고 빈 칸은 연간', () => {
		expect(parsePeriodText('')).toEqual({ type: 'Y', index: 1 });
		expect(parsePeriodText(null)).toEqual({ type: 'Y', index: 1 });
		expect(parsePeriodText('연간')).toEqual({ type: 'Y', index: 1 });
		expect(parsePeriodText('1분기')).toEqual({ type: 'Q', index: 1 });
		expect(parsePeriodText(' q3 ')).toEqual({ type: 'Q', index: 3 });
		expect(parsePeriodText('4Q')).toEqual({ type: 'Q', index: 4 });
		expect(parsePeriodText('상반기')).toEqual({ type: 'H', index: 1 });
		expect(parsePeriodText('H2')).toEqual({ type: 'H', index: 2 });
		expect(parsePeriodText('하반기')).toEqual({ type: 'H', index: 2 });
	});
	it('못 읽는 표기는 null', () => {
		expect(parsePeriodText('5분기')).toBeNull();
		expect(parsePeriodText('3반기')).toBeNull();
		expect(parsePeriodText('13월')).toBeNull();
		expect(parsePeriodText('Q')).toBeNull();
	});
	it('periodText ↔ parsePeriodText 왕복', () => {
		for (const p of [
			Y(2025),
			H(2025, 1),
			H(2025, 2),
			Q(2025, 1),
			Q(2025, 4),
			M(2025, 1),
			M(2025, 12)
		]) {
			expect(parsePeriodText(periodText(p))).toEqual({ type: p.type, index: p.index });
		}
	});
});

describe('period — 전기·전년 동기', () => {
	it('같은 유형의 바로 앞 기간', () => {
		expect(previousPeriod(Q(2025, 1))).toEqual(Q(2024, 4));
		expect(previousPeriod(Q(2025, 3))).toEqual(Q(2025, 2));
		expect(previousPeriod(H(2025, 1))).toEqual(H(2024, 2));
		expect(previousPeriod(Y(2025))).toEqual(Y(2024));
	});
	it('전년 동기', () => {
		expect(yearAgoPeriod(Q(2025, 3))).toEqual(Q(2024, 3));
		expect(yearAgoPeriod(Y(2025))).toEqual(Y(2024));
	});
});

describe('period — 월 단위', () => {
	it('라벨·텍스트·파싱', () => {
		expect(periodLabel(M(2025, 3))).toBe('2025년 3월');
		expect(periodShortLabel(M(2025, 3))).toBe('2025.03');
		expect(periodText(M(2025, 12))).toBe('12월');
		for (const t of ['3월', 'M3', '3M', '월3', ' m3 '])
			expect(parsePeriodText(t)).toEqual({ type: 'M', index: 3 });
		expect(parsePeriodText('0월')).toBeNull();
		expect(periodMonths(M(2025, 7))).toEqual({ start: 7, end: 7 });
	});
	it('드롭다운 텍스트는 19개이고 전부 다시 읽힌다', () => {
		const texts = allPeriodTexts();
		expect(texts).toHaveLength(1 + 2 + 4 + 12);
		expect(texts.every((t) => parsePeriodText(t) !== null)).toBe(true);
	});
	it('정렬: 월 → 분기 → 반기 → 연간, 전기는 전월', () => {
		expect(
			[Q(2025, 1), M(2025, 3), M(2025, 1), Y(2025)].sort(comparePeriods).map(periodKey)
		).toEqual(['2025-M1', '2025-M3', '2025-Q1', '2025-Y1']);
		expect(previousPeriod(M(2025, 1))).toEqual(M(2024, 12));
		expect(yearAgoPeriod(M(2025, 5))).toEqual(M(2024, 5));
		expect(periodUnitWord('M')).toBe('개월');
		expect(prevWord('M')).toBe('전월');
		expect(prevWord('Q')).toBe('전기');
	});
});

describe('period — 상하위 관계 (합산용)', () => {
	it('childType / parentType', () => {
		expect(childType('Y')).toBe('H');
		expect(childType('Q')).toBe('M');
		expect(childType('M')).toBeNull();
		expect(parentType('M')).toBe('Q');
		expect(parentType('Y')).toBeNull();
	});
	it('하위 기간 목록', () => {
		expect(childPeriods(Y(2025)).map(periodKey)).toEqual(['2025-H1', '2025-H2']);
		expect(childPeriods(H(2025, 2)).map(periodKey)).toEqual(['2025-Q3', '2025-Q4']);
		expect(childPeriods(Q(2025, 4)).map(periodKey)).toEqual(['2025-M10', '2025-M11', '2025-M12']);
		expect(childPeriods(M(2025, 1))).toEqual([]);
	});
	it('상위 기간', () => {
		expect(parentPeriod(Q(2025, 3), 'Y')).toEqual(Y(2025));
		expect(parentPeriod(Q(2025, 3), 'H')).toEqual(H(2025, 2));
		expect(parentPeriod(M(2025, 8), 'Q')).toEqual(Q(2025, 3));
		expect(parentPeriod(M(2025, 8), 'H')).toEqual(H(2025, 2));
		expect(parentPeriod(Q(2025, 1), 'Q')).toBeNull();
		expect(parentPeriod(Y(2025), 'Q')).toBeNull();
	});
});
