/**
 * 결산서 표지·목차 문구에서 **보고 대상 기간**을 읽는다 (순수 함수, pdf.js 무관).
 * docs/plans/pdf-to-excel.md §5.1.
 *
 * 규칙 두 가지만 쓴다.
 * ① 문서 종류 → 기간 유형: 사업보고서 Y · 반기보고서 H · 분기보고서 Q
 * ② 기간 문구의 **종료 월** → 순번: 03 Q1 · 06 H1(반기)/Q2(분기) · 09 Q3 · 12 Y. 연도는 **종료일 연도**.
 * `제 N 기`(기수)는 회사마다 결산월이 달라 순번 계산에 쓰지 않고 근거 문구에만 넣는다.
 *
 * 12월 결산이 아닌 회사(예: 3월 결산)도 종료 월 기준 순번을 그대로 제안하되 `confidence: 'low'` 로 표시한다.
 * 어떤 경우에도 **자동 반영은 없다** — 화면이 셀렉트를 미리 채우고 사람이 확인한다.
 */

import { isValidPeriod } from '../period';
import type { Period, PeriodType } from '../types';
import { clusterRows } from './table';
import type { PageText } from './types';

export type PeriodConfidence = 'high' | 'low';
export type ReportKind = 'annual' | 'half' | 'quarter';

export interface PeriodDetection {
	period: Period;
	/** 근거 문구 — "반기보고서 · 제 14 기 · 2026.01.01~2026.06.30" */
	evidence: string;
	/** 표준(12월 결산 · 종료 월이 기간 끝)이면 high, 추정이 섞였으면 low */
	confidence: PeriodConfidence;
}

/** 표지·목차만 본다 — 뒤쪽 재무제표 머리글에도 기간 문구가 있어 멀리 가면 오히려 틀린다 */
export const MAX_COVER_PAGES = 8;

const KIND_RE = /(사업|반기|분기)보고서/;
const KIND_TYPE: Record<ReportKind, PeriodType> = { annual: 'Y', half: 'H', quarter: 'Q' };
const KIND_LABEL: Record<ReportKind, string> = {
	annual: '사업보고서',
	half: '반기보고서',
	quarter: '분기보고서'
};

/** 날짜 하나: 2026년01월01일 · 2026.01.01 · 2026-01-01 · 2026/01/01 */
const DATE = String.raw`(\d{4})(?:년|[.\-/])(\d{1,2})(?:월|[.\-/])(\d{1,2})일?`;
const FROM_RE = new RegExp(DATE + '부터');
const TO_RE = new RegExp(DATE + '까지');
/** "2026.01.01 ~ 2026.06.30" — 공백은 미리 지운다 */
const RANGE_RE = new RegExp(DATE + '[~∼〜–—]' + DATE);
/** 붙임표를 범위 기호로 쓴 "2026.01.01-2026.06.30" (날짜 구분은 . 또는 년월일일 때만) */
const RANGE_DASH_RE = new RegExp(
	String.raw`(\d{4})[.년](\d{1,2})[.월](\d{1,2})일?-(\d{4})[.년](\d{1,2})[.월](\d{1,2})일?`
);
const TERM_RE = /제(\d+)기/;
const YEAR_RE = /(?:19|20)\d{2}/g;

export interface Ymd {
	y: number;
	m: number;
	d: number;
}

function ymd(y: string, m: string, d: string): Ymd | null {
	const v = { y: Number(y), m: Number(m), d: Number(d) };
	if (v.m < 1 || v.m > 12 || v.d < 1 || v.d > 31) return null;
	return v;
}

function formatYmd(v: Ymd): string {
	return `${v.y}.${String(v.m).padStart(2, '0')}.${String(v.d).padStart(2, '0')}`;
}

/**
 * 한 쪽의 조각을 읽는 순서(위→아래, 왼→오른쪽)로 이어 붙이고 공백을 지운 문자열.
 * DART 표지는 "2026년 06월 30일 / 까지" 와 "2026년 01월 01일 / 부터" 가 **다른 줄**에 있어
 * 줄 단위로 보면 범위를 못 읽는다 — 쪽 전체를 한 줄로 만들어 `…부터` · `…까지` 를 각각 찾는다.
 */
export function coverText(page: PageText): string {
	return clusterRows(page.items)
		.map((r) => r.cells.map((c) => c.text).join(''))
		.join('')
		.replace(/[\s\u3000]/g, '');
}

/** 종료 월 → 순번. Y 는 언제나 1, H 는 상/하반기, Q 는 분기 */
export function indexForEndMonth(type: PeriodType, endMonth: number): number {
	if (type === 'Y') return 1;
	if (type === 'M') return Math.min(12, Math.max(1, endMonth));
	if (type === 'H') return endMonth <= 6 ? 1 : 2;
	return Math.min(4, Math.max(1, Math.ceil(endMonth / 3)));
}

/** 종류 문구가 없을 때 기간 폭으로 유형을 추정한다 (1–9월 누적 = 3분기) */
function typeFromSpan(start: Ymd, end: Ymd): PeriodType | null {
	if (start.y !== end.y) return null;
	const span = end.m - start.m + 1;
	if (span === 12) return 'Y';
	if (span === 6) return 'H';
	if (span === 3 || span === 9) return 'Q';
	if (span === 1) return 'M';
	return null;
}

/** 12월 결산 + 종료 월이 기간 끝에 맞는 표준 범위인가 */
function isStandardRange(type: PeriodType, start: Ymd, end: Ymd): boolean {
	if (start.y !== end.y) return false;
	if (type === 'Y') return start.m === 1 && end.m === 12;
	if (type === 'H') return (start.m === 1 && end.m === 6) || (start.m === 7 && end.m === 12);
	if (type === 'M') return start.m === end.m;
	// Q: 연초 누적(1–3 · 1–6 · 1–9) 또는 달력 분기 한 칸(1–3 · 4–6 · 7–9 · 10–12)
	if (end.m % 3 !== 0) return false;
	return start.m === 1 || (end.m - start.m === 2 && (start.m - 1) % 3 === 0);
}

interface Scan {
	kind: ReportKind | null;
	term: number | null;
	start: Ymd | null;
	end: Ymd | null;
	/** 기간 문구가 없을 때 쓰는 가장 최근 4자리 연도 */
	year: number | null;
}

function scanText(text: string): Scan {
	const kindM = text.match(KIND_RE);
	const kind: ReportKind | null =
		kindM?.[1] === '사업'
			? 'annual'
			: kindM?.[1] === '반기'
				? 'half'
				: kindM?.[1] === '분기'
					? 'quarter'
					: null;

	let start: Ymd | null = null;
	let end: Ymd | null = null;
	const fromM = text.match(FROM_RE);
	const toM = text.match(TO_RE);
	if (fromM) start = ymd(fromM[1], fromM[2], fromM[3]);
	if (toM) end = ymd(toM[1], toM[2], toM[3]);
	if (!start || !end) {
		const r = text.match(RANGE_RE) ?? text.match(RANGE_DASH_RE);
		if (r) {
			start = ymd(r[1], r[2], r[3]) ?? start;
			end = ymd(r[4], r[5], r[6]) ?? end;
		}
	}

	const termM = text.match(TERM_RE);
	const years = [...text.matchAll(YEAR_RE)].map((m) => Number(m[0]));
	return {
		kind,
		term: termM ? Number(termM[1]) : null,
		start,
		end,
		year: years.length > 0 ? Math.max(...years) : null
	};
}

/** 쪽 고르기용 점수 — 종류 + 기간 문구가 다 있는 쪽이 표지다 */
function score(s: Scan): number {
	const hasRange = s.start !== null && s.end !== null;
	if (s.kind && hasRange) return 3;
	if (hasRange) return 2;
	if (s.kind) return 1;
	return 0;
}

function toDetection(s: Scan): PeriodDetection | null {
	const type: PeriodType | null =
		(s.kind ? KIND_TYPE[s.kind] : null) ?? (s.start && s.end ? typeFromSpan(s.start, s.end) : null);
	if (!type) return null;

	const end = s.end;
	const year = end ? end.y : s.year;
	if (year === null) return null;
	const endMonth = end ? end.m : type === 'Y' ? 12 : 0;
	const period: Period = {
		year,
		type,
		index: endMonth > 0 ? indexForEndMonth(type, endMonth) : 1
	};
	if (!isValidPeriod(period)) return null;

	const parts: string[] = [];
	if (s.kind) parts.push(KIND_LABEL[s.kind]);
	if (s.term !== null) parts.push(`제 ${s.term} 기`);
	if (s.start && end) parts.push(`${formatYmd(s.start)}~${formatYmd(end)}`);
	else if (end) parts.push(`${formatYmd(end)} 까지`);
	else parts.push(`${year}년`);

	const standard =
		s.kind !== null && s.start !== null && end !== null && isStandardRange(type, s.start, end);
	return { period, evidence: parts.join(' · '), confidence: standard ? 'high' : 'low' };
}

/**
 * 손익 열로 **3개월(해당 분기)** 을 고르면 반기·연간 보고서라도 값은 그 분기 실적이다 —
 * 감지한 기간을 열에 맞춰 옮긴다(상반기 → 2분기, 하반기 → 4분기). 나머지 유형은 그대로.
 * (표지 스캔이 되는 경우의 같은 판단은 `map.ts` 의 `periodForColumn`)
 */
export function periodForThreeMonthColumn(p: Period): Period {
	if (p.type !== 'H') return p;
	return { year: p.year, type: 'Q', index: p.index * 2 };
}

/**
 * 표지에서 기간을 읽는다. 못 읽으면 `null` — 화면은 빈 셀렉트를 두고 사용자가 고르게 한다.
 * `pages` 는 `extractPages()` 결과. 앞 `maxPages` 쪽(기본 {@link MAX_COVER_PAGES})만 본다.
 */
export function detectPeriod(
	pages: PageText[],
	options: { maxPages?: number } = {}
): PeriodDetection | null {
	const limit = Math.min(pages.length, options.maxPages ?? MAX_COVER_PAGES);
	let best: Scan | null = null;
	let bestScore = 0;
	for (let i = 0; i < limit; i++) {
		const s = scanText(coverText(pages[i]));
		const sc = score(s);
		if (sc > bestScore) {
			best = s;
			bestScore = sc;
			if (sc === 3) break;
		}
	}
	return best ? toDetection(best) : null;
}
