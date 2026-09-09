import {
	PERIODS_PER_YEAR,
	PERIOD_TYPES,
	PERIOD_TYPE_LABELS,
	type Period,
	type PeriodType
} from './types';

/**
 * 분석 기간(연간·반기·분기·월) 유틸 — 순수 함수.
 * 라벨·정렬·비교·텍스트 파싱·상하위 관계를 여기서만 처리해 화면·엑셀·인사이트·합산이 같은 규칙을 쓴다.
 */

/** 회계연도 허용 범위 — 화면 입력·엑셀 가져오기·저장값 이행이 모두 이 상수를 쓴다 */
export const YEAR_MIN = 1990;
export const YEAR_MAX = 2100;

export function isValidYear(y: unknown): y is number {
	return typeof y === 'number' && Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX;
}

/** 유형별 순번 범위: Y 1 · H 1–2 · Q 1–4 · M 1–12 */
export function periodIndexCount(type: PeriodType): number {
	return PERIODS_PER_YEAR[type];
}

export function isValidPeriod(p: Period): boolean {
	return (
		isValidYear(p.year) &&
		PERIOD_TYPES.includes(p.type) &&
		Number.isInteger(p.index) &&
		p.index >= 1 &&
		p.index <= periodIndexCount(p.type)
	);
}

/** 고유 키 — 같은 기간인지 비교·중복 검사용 ("2025-Y1", "2025-Q3") */
export function periodKey(p: Period): string {
	return `${p.year}-${p.type}${p.index}`;
}

export function samePeriod(a: Period, b: Period): boolean {
	return a.year === b.year && a.type === b.type && a.index === b.index;
}

/** 기간의 시작 월(1–12)·끝 월 */
export function periodMonths(p: Period): { start: number; end: number } {
	const len = 12 / periodIndexCount(p.type);
	const start = (p.index - 1) * len + 1;
	return { start, end: start + len - 1 };
}

/**
 * 시간순 정렬. 끝 월 기준이라 한 해의 월·분기·반기 다음에 연간(합계)이 온다:
 *   2025 M1 · M2 · M3 · Q1 · … · Q2 · H1 · … · Q4 · H2 · 2025 연간 · 2026 M1 …
 * 같은 끝 월이면 세분 단위가 먼저(M → Q → H → Y).
 */
export function comparePeriods(a: Period, b: Period): number {
	if (a.year !== b.year) return a.year - b.year;
	const ea = periodMonths(a).end;
	const eb = periodMonths(b).end;
	if (ea !== eb) return ea - eb;
	return periodIndexCount(b.type) - periodIndexCount(a.type);
}

/** 화면용 라벨: "2025년" · "2025년 상반기" · "2025년 3분기" · "2025년 3월" */
export function periodLabel(p: Period): string {
	if (p.type === 'Y') return `${p.year}년`;
	if (p.type === 'H') return `${p.year}년 ${p.index === 1 ? '상반기' : '하반기'}`;
	if (p.type === 'M') return `${p.year}년 ${p.index}월`;
	return `${p.year}년 ${p.index}분기`;
}

/** 축·좁은 칸용 짧은 라벨: "2025" · "2025 H1" · "2025 Q3" · "2025.03" */
export function periodShortLabel(p: Period): string {
	if (p.type === 'Y') return `${p.year}`;
	if (p.type === 'M') return `${p.year}.${String(p.index).padStart(2, '0')}`;
	return `${p.year} ${p.type}${p.index}`;
}

/** 엑셀 `기간` 칸에 쓰는 텍스트: "연간" · "상반기" · "3분기" · "3월" — parsePeriodText 로 다시 읽힌다 */
export function periodText(p: Period): string {
	if (p.type === 'Y') return PERIOD_TYPE_LABELS.Y;
	if (p.type === 'H') return p.index === 1 ? '상반기' : '하반기';
	if (p.type === 'M') return `${p.index}월`;
	return `${p.index}분기`;
}

/** 엑셀 `기간` 드롭다운에 넣는 모든 텍스트 (연간 · 반기 2 · 분기 4 · 월 12) */
export function allPeriodTexts(): string[] {
	return PERIOD_TYPES.flatMap((type) =>
		Array.from({ length: periodIndexCount(type) }, (_, i) =>
			periodText({ year: 0, type, index: i + 1 })
		)
	);
}

/**
 * `기간` 칸 텍스트 → 유형·순번. 빈 칸은 연간.
 * 허용: 연간·Y·연 / 1분기·Q1·1Q·분기1 / 상반기·하반기·H1·H2·1반기·2반기 / 3월·M3·3M·월3. 못 읽으면 null.
 */
export function parsePeriodText(raw: unknown): Pick<Period, 'type' | 'index'> | null {
	const t = String(raw ?? '')
		.trim()
		.toUpperCase()
		.replace(/\s+/g, '');
	if (t === '' || t === '연간' || t === '연' || t === 'Y' || t === 'FY' || t === '전체') {
		return { type: 'Y', index: 1 };
	}
	if (t === '상반기' || t === '1반기' || t === 'H1' || t === '1H') return { type: 'H', index: 1 };
	if (t === '하반기' || t === '2반기' || t === 'H2' || t === '2H') return { type: 'H', index: 2 };
	const q = t.match(/^(?:Q([1-4])|([1-4])Q|([1-4])분기|분기([1-4]))$/);
	if (q) {
		const n = Number(q[1] ?? q[2] ?? q[3] ?? q[4]);
		return { type: 'Q', index: n };
	}
	const m = t.match(/^(?:M(\d{1,2})|(\d{1,2})M|(\d{1,2})월|월(\d{1,2}))$/);
	if (m) {
		const n = Number(m[1] ?? m[2] ?? m[3] ?? m[4]);
		return n >= 1 && n <= 12 ? { type: 'M', index: n } : null;
	}
	return null;
}

/** 같은 유형의 바로 앞 기간 (2025 Q1 → 2024 Q4, 2025 M1 → 2024 M12, 2025 Y → 2024 Y) */
export function previousPeriod(p: Period): Period {
	const n = periodIndexCount(p.type);
	return p.index > 1 ? { ...p, index: p.index - 1 } : { year: p.year - 1, type: p.type, index: n };
}

/** 전년 동기 (2025 Q3 → 2024 Q3). 연간은 전년과 같다 */
export function yearAgoPeriod(p: Period): Period {
	return { ...p, year: p.year - 1 };
}

/** 추이 문구에서 기간 하나를 부르는 말: 연간 "년" · 월 "개월" · 반기·분기 "기" */
export function periodUnitWord(type: PeriodType): string {
	return type === 'Y' ? '년' : type === 'M' ? '개월' : '기';
}

/** "전년 대비" / "전월 대비" / "전기 대비" */
export function prevWord(type: PeriodType): string {
	return type === 'Y' ? '전년' : type === 'M' ? '전월' : '전기';
}

/** 굵은 단위부터: Y → H → Q → M */
const GRANULARITY: readonly PeriodType[] = ['Y', 'H', 'Q', 'M'];

/** 바로 아래 단위 (Y → H → Q → M). 월은 더 나눌 수 없어 null */
export function childType(type: PeriodType): PeriodType | null {
	const i = GRANULARITY.indexOf(type);
	return i >= 0 && i < GRANULARITY.length - 1 ? GRANULARITY[i + 1] : null;
}

/** 바로 위 단위 (M → Q → H → Y). 연간은 null */
export function parentType(type: PeriodType): PeriodType | null {
	const i = GRANULARITY.indexOf(type);
	return i > 0 ? GRANULARITY[i - 1] : null;
}

/** 이 기간을 이루는 바로 아래 단위의 기간들 (2025 H1 → 2025 Q1 · Q2). 월이면 빈 배열 */
export function childPeriods(p: Period): Period[] {
	const type = childType(p.type);
	if (!type) return [];
	const { start, end } = periodMonths(p);
	const len = 12 / periodIndexCount(type);
	const out: Period[] = [];
	for (let m = start; m <= end; m += len)
		out.push({ year: p.year, type, index: (m - 1) / len + 1 });
	return out;
}

/** 이 기간을 품는 상위 단위의 기간 (2025 Q3, 'Y' → 2025 연간). 같은 단위이거나 더 잘면 null */
export function parentPeriod(p: Period, type: PeriodType): Period | null {
	if (periodIndexCount(type) >= periodIndexCount(p.type)) return null;
	const len = 12 / periodIndexCount(type);
	return { year: p.year, type, index: Math.floor((periodMonths(p).start - 1) / len) + 1 };
}
