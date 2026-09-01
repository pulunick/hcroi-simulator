/** 숫자 표기 유틸 — 모든 결과 표시는 단위(원, %, 명)를 명시한다. */

const nf0 = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function isFiniteNumber(v: unknown): v is number {
	return typeof v === 'number' && Number.isFinite(v);
}

/** 정수 콤마 표기: 1234567 → "1,234,567" */
export function formatInt(v: number | null | undefined): string {
	return isFiniteNumber(v) ? nf0.format(Math.round(v)) : '—';
}

/** 원 단위 전체 표기: "1,234,567원" */
export function formatWon(v: number | null | undefined): string {
	return isFiniteNumber(v) ? `${nf0.format(Math.round(v))}원` : '—';
}

/**
 * 한국식 축약 금액: 조/억/만 단위. 음수 지원.
 *  152_340_000_000 → "1,523.4억원"
 *  85_000_000      → "8,500만원"
 *  12_345          → "12,345원"
 */
export function formatKrwCompact(v: number | null | undefined, unit = '원'): string {
	if (!isFiniteNumber(v)) return '—';
	const sign = v < 0 ? '-' : '';
	const abs = Math.abs(v);
	if (abs >= 1e12) return `${sign}${nf1.format(abs / 1e12)}조${unit}`;
	// 1억~10억 구간(인당 지표가 주로 여기)은 소수 둘째 자리까지 — 연도 간 차이가 보이도록
	if (abs >= 1e8) return `${sign}${(abs < 1e9 ? nf2 : nf1).format(abs / 1e8)}억${unit}`;
	if (abs >= 1e4) {
		const man = abs / 1e4;
		return `${sign}${(Number.isInteger(man) ? nf0 : nf1).format(man)}만${unit}`;
	}
	return `${sign}${nf0.format(abs)}${unit}`;
}

/** 배수 표기: 1.4321 → "1.43배" */
export function formatMultiple(v: number | null | undefined): string {
	return isFiniteNumber(v) ? `${nf2.format(v)}배` : '—';
}

/** 퍼센트 표기(값은 이미 % 단위): 12.345 → "12.3%" */
export function formatPct(v: number | null | undefined, digits: 0 | 1 | 2 = 1): string {
	if (!isFiniteNumber(v)) return '—';
	const f = digits === 0 ? nf0 : digits === 1 ? nf1 : nf2;
	return `${f.format(v)}%`;
}

/** 부호를 명시한 변화량 표기 */
export function formatSigned(v: number | null | undefined, fmt: (n: number) => string): string {
	if (!isFiniteNumber(v)) return '—';
	if (v === 0) return `±${fmt(0)}`;
	return `${v > 0 ? '+' : '-'}${fmt(Math.abs(v))}`;
}

/** 인원 표기: 123 → "123명" */
export function formatHeadcount(v: number | null | undefined): string {
	return isFiniteNumber(v) ? `${nf0.format(Math.round(v))}명` : '—';
}

/** 배수를 %로 환산한 보조 표기: 1.43 → "143%" */
export function multipleToPct(v: number | null | undefined): string {
	return isFiniteNumber(v) ? `${nf0.format(v * 100)}%` : '—';
}

/**
 * 축 눈금용 "깔끔한" 숫자 계산.
 * includeZero=true(기본)면 0을 포함하도록 범위를 확장한다 (막대 차트용).
 * 비율 추이(HCROI 라인)처럼 0 기준이 불필요하면 false.
 */
export function niceTicks(min: number, max: number, count = 5, includeZero = true): number[] {
	if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
	if (includeZero) {
		min = Math.min(0, min);
		max = Math.max(0, max);
	}
	if (min === max) return includeZero || min === 0 ? [0, 1] : [min - 1, min + 1];
	const span = max - min;
	const rough = span / Math.max(1, count - 1);
	const mag = Math.pow(10, Math.floor(Math.log10(rough)));
	const norm = rough / mag;
	const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
	const start = Math.floor(min / step) * step;
	const end = Math.ceil(max / step) * step;
	const ticks: number[] = [];
	for (let t = start; t <= end + step / 2; t += step) ticks.push(Number(t.toFixed(10)));
	return ticks;
}
