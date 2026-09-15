/**
 * 표지에서 보고 기간 읽기 (docs/plans/pdf-to-excel.md §5.1).
 * 문구는 전부 **가상**이다 — 실제 회사명·실 수치는 쓰지 않는다(공개 저장소 규칙).
 */
import { describe, expect, it } from 'vitest';
import { detectPeriod, indexForEndMonth, periodForThreeMonthColumn } from './detectPeriod';
import type { PageText } from './types';
import reportA from './fixtures/report-a.json';
import reportB from './fixtures/report-b.json';

/** 줄 목록 → 한 쪽. 한 줄에 조각 하나, 위에서 아래로 20pt 간격 */
function page(lines: string[], pageNo = 1): PageText {
	return {
		page: pageNo,
		width: 595,
		height: 842,
		items: lines.map((s, i) => ({ s, x: 60, y: 760 - i * 20, w: s.length * 11, h: 11 }))
	};
}

/** DART 표지 배치: "…까지" 줄이 "…부터" 줄보다 위에 온다 */
function dartCover(kind: string, term: number, from: string, to: string): PageText {
	return page([
		kind,
		`(제 ${term} 기)`,
		`${to} 까지`,
		'사업연도',
		`${from} 부터`,
		'회 사 명 : 가상회사'
	]);
}

describe('indexForEndMonth', () => {
	it('종료 월 → 순번', () => {
		expect(indexForEndMonth('Y', 12)).toBe(1);
		expect(indexForEndMonth('H', 6)).toBe(1);
		expect(indexForEndMonth('H', 12)).toBe(2);
		expect([3, 6, 9, 12].map((m) => indexForEndMonth('Q', m))).toEqual([1, 2, 3, 4]);
	});
});

describe('periodForThreeMonthColumn', () => {
	it('3개월 열을 고르면 반기 → 그 반기의 끝 분기', () => {
		expect(periodForThreeMonthColumn({ year: 2026, type: 'H', index: 1 })).toEqual({
			year: 2026,
			type: 'Q',
			index: 2
		});
		expect(periodForThreeMonthColumn({ year: 2026, type: 'H', index: 2 })).toEqual({
			year: 2026,
			type: 'Q',
			index: 4
		});
		const q = { year: 2026, type: 'Q', index: 3 } as const;
		expect(periodForThreeMonthColumn(q)).toEqual(q);
		const y = { year: 2026, type: 'Y', index: 1 } as const;
		expect(periodForThreeMonthColumn(y)).toEqual(y);
	});
});

describe('detectPeriod', () => {
	it('반기보고서 · 년월일 표기 → 그 해 상반기 (high)', () => {
		const d = detectPeriod([
			dartCover('반 기 보 고 서', 14, '2026년 01월 01일', '2026년 06월 30일')
		]);
		expect(d).toMatchObject({
			period: { year: 2026, type: 'H', index: 1 },
			confidence: 'high'
		});
		expect(d?.evidence).toBe('반기보고서 · 제 14 기 · 2026.01.01~2026.06.30');
	});

	it('분기보고서 · 1분기 · 점 표기 → Q1 (high)', () => {
		const d = detectPeriod([page(['분 기 보 고 서', '제 9 기', '2025.01.01 ~ 2025.03.31'])]);
		expect(d).toMatchObject({
			period: { year: 2025, type: 'Q', index: 1 },
			confidence: 'high'
		});
	});

	it('분기보고서 · 종료 6월 → Q2 (반기보고서와 갈리는 자리)', () => {
		const d = detectPeriod([
			dartCover('분 기 보 고 서', 9, '2025년 01월 01일', '2025년 06월 30일')
		]);
		expect(d?.period).toEqual({ year: 2025, type: 'Q', index: 2 });
		expect(d?.confidence).toBe('high');
	});

	it('분기보고서 · 1~9월 누적이어도 3분기 (high)', () => {
		const d = detectPeriod([
			dartCover('분 기 보 고 서', 9, '2025년 01월 01일', '2025년 09월 30일')
		]);
		expect(d?.period).toEqual({ year: 2025, type: 'Q', index: 3 });
		expect(d?.confidence).toBe('high');
	});

	it('사업보고서 · 붙임표 표기 → 연간 (high)', () => {
		const d = detectPeriod([page(['사 업 보 고 서', '제 30 기', '2024-01-01 ~ 2024-12-31'])]);
		expect(d).toMatchObject({
			period: { year: 2024, type: 'Y', index: 1 },
			confidence: 'high'
		});
	});

	it('3월 결산 사업보고서 → 종료일 연도 + 연간, 확인 필요(low)', () => {
		const d = detectPeriod([
			dartCover('사 업 보 고 서', 42, '2025년 04월 01일', '2026년 03월 31일')
		]);
		expect(d?.period).toEqual({ year: 2026, type: 'Y', index: 1 });
		expect(d?.confidence).toBe('low');
		expect(d?.evidence).toContain('2025.04.01~2026.03.31');
	});

	it('종류 문구만 있으면 가장 최근 연도로 추정 (low)', () => {
		const d = detectPeriod([page(['반 기 보 고 서', '제 7 기', '2025년 08월 14일 제출'])]);
		expect(d).toMatchObject({
			period: { year: 2025, type: 'H', index: 1 },
			confidence: 'low'
		});
		expect(d?.evidence).toBe('반기보고서 · 제 7 기 · 2025년');
	});

	it('종류 없이 기간 문구만 있으면 폭으로 추정 (low)', () => {
		const d = detectPeriod([page(['결 산 보 고 서', '2026.07.01 ~ 2026.12.31'])]);
		expect(d).toMatchObject({
			period: { year: 2026, type: 'H', index: 2 },
			confidence: 'low'
		});
	});

	it('아무것도 못 찾으면 null', () => {
		expect(detectPeriod([page(['목 차', '1. 회사의 개요', '2. 사업의 내용'])])).toBeNull();
		expect(detectPeriod([])).toBeNull();
	});

	it('표지가 앞쪽에 없으면(범위 밖) 읽지 않는다', () => {
		const filler = Array.from({ length: 8 }, (_, i) => page(['목 차'], i + 1));
		const cover = dartCover('반 기 보 고 서', 14, '2026년 01월 01일', '2026년 06월 30일');
		expect(detectPeriod([...filler, cover])).toBeNull();
		expect(detectPeriod([...filler, cover], { maxPages: 9 })?.period).toEqual({
			year: 2026,
			type: 'H',
			index: 1
		});
	});

	it('픽스처(실 좌표 · 가상 수치) 두 반기보고서 표지', () => {
		for (const pages of [reportA as PageText[], reportB as PageText[]]) {
			expect(detectPeriod(pages)).toMatchObject({
				period: { year: 2026, type: 'H', index: 1 },
				confidence: 'high'
			});
		}
	});
});
