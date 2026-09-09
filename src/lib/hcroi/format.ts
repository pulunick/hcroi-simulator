/** 숫자 표기 유틸 — 모든 결과 표시는 단위(원, %, 명)를 명시한다. */
import {
	HEADCOUNT_LABELS,
	HEADCOUNT_METHOD_LABELS,
	HEADCOUNT_OPTIONAL_KEYS,
	PERIOD_TYPE_LABELS,
	type DerivedInfo,
	type HeadcountBasis
} from './types';

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

/**
 * 금액 표시 단위 — 저장·계산은 언제나 원 단위 정수이고, 이 값은 **표시에만** 쓴다.
 * `auto` 는 조/억/만 자동 축약(`formatKrwCompact`), 나머지는 고정 단위로 나눠 표기한다.
 */
export type AmountUnit = 'auto' | 'won' | 'thousand' | 'million' | 'billion';
type FixedUnit = Exclude<AmountUnit, 'auto'>;

/** 고정 단위 정의: 나눗수 · 숫자 뒤 단위어 · 기본 소수 자릿수 */
const FIXED_UNITS: Record<FixedUnit, { divisor: number; word: string; digits: 0 | 1 }> = {
	won: { divisor: 1, word: '', digits: 0 },
	thousand: { divisor: 1e3, word: '천', digits: 0 },
	million: { divisor: 1e6, word: '백만', digits: 0 },
	billion: { divisor: 1e8, word: '억', digits: 1 }
};

/** 선택 UI 용 목록 */
export const AMOUNT_UNITS: { key: AmountUnit; label: string }[] = [
	{ key: 'auto', label: '자동 (억·만 축약)' },
	{ key: 'won', label: '원' },
	{ key: 'thousand', label: '천원' },
	{ key: 'million', label: '백만원' },
	{ key: 'billion', label: '억원' }
];

export const DEFAULT_AMOUNT_UNIT: AmountUnit = 'thousand';

export function isAmountUnit(v: unknown): v is AmountUnit {
	return v === 'auto' || (typeof v === 'string' && v in FIXED_UNITS);
}

/**
 * 고정 단위로 나눈 숫자만 (단위어·통화어 없음).
 * 0 은 언제나 "0". 자릿수가 적게 남는 값(인당 지표를 억원으로 보는 경우 등)은 소수를 더 보여
 * 기간 간 차이가 뭉개지지 않게 하고, 1 미만도 0 으로 잘리지 않는다.
 */
function scaleAmount(v: number, unit: FixedUnit): string {
	const u = FIXED_UNITS[unit];
	const scaled = v / u.divisor;
	const abs = Math.abs(scaled);
	const f = scaled === 0 ? nf0 : u.digits === 0 ? (abs >= 1 ? nf0 : nf2) : abs >= 10 ? nf1 : nf2;
	return f.format(scaled);
}

/**
 * 선택한 단위로 금액을 표기한다. 원 단위 정수를 받아 표시 문자열만 만든다.
 *  formatAmount(14_100_000_000, 'thousand') → "14,100,000천원"
 *  formatAmount(14_100_000_000, 'billion')  → "141.0억원"
 *  formatAmount(14_100_000_000, 'auto')     → "141.0억원"
 * `suffix` 를 ''  로 주면 통화어("원")를 뺀다 — 단위를 헤더·축 라벨이 이미 밝힌 경우.
 */
export function formatAmount(
	v: number | null | undefined,
	unit: AmountUnit = 'auto',
	suffix = '원'
): string {
	if (!isFiniteNumber(v)) return '—';
	if (unit === 'auto') return formatKrwCompact(v, suffix);
	return `${scaleAmount(v, unit)}${FIXED_UNITS[unit].word}${suffix}`;
}

/**
 * 표 칸용 — 열 머리글이 단위를 이미 밝힌 경우의 숫자만 표기.
 * 고정 단위는 단위어까지 떼고("14,100,000"), `auto` 는 축약이 곧 단위라 "141.0억" 을 그대로 쓴다.
 */
export function formatAmountBare(v: number | null | undefined, unit: AmountUnit = 'auto'): string {
	if (!isFiniteNumber(v)) return '—';
	return unit === 'auto' ? formatKrwCompact(v, '') : scaleAmount(v, unit);
}

/** 선택한 단위의 표기용 이름: 'thousand' → "천원" */
export function amountUnitLabel(unit: AmountUnit): string {
	return unit === 'auto' ? '원' : `${FIXED_UNITS[unit].word}원`;
}

/**
 * 표 칸의 금액 규칙 (모든 화면 공통): 고정 단위를 고르면 단위는 열 머리글이 밝히고 칸에는 숫자만,
 * 자동 축약이면 칸에 "141.0억원" 처럼 단위까지.
 */
export function formatCellAmount(v: number | null | undefined, unit: AmountUnit): string {
	return unit === 'auto' ? formatAmount(v, unit) : formatAmountBare(v, unit);
}

/** 열 머리글에 붙일 단위: " (천원)" — 자동 축약이면 빈 문자열 */
export function columnUnitSuffix(unit: AmountUnit): string {
	return unit === 'auto' ? '' : ` (${amountUnitLabel(unit)})`;
}

/** 입력칸 아래 힌트용 단위 — 표시 단위가 '원' 이면 입력값과 같아 의미가 없으므로 축약으로 보여 준다 */
export function hintAmountUnit(unit: AmountUnit): AmountUnit {
	return unit === 'won' ? 'auto' : unit;
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

/**
 * 임직원 수 산정 기준 한 줄 표기.
 *  → "기간 평균(FTE) · 정규직만" / "기말 인원 · 정규직+계약직·기간제"
 */
export function headcountBasisLabel(basis: HeadcountBasis): string {
	const method = HEADCOUNT_METHOD_LABELS[basis.method];
	const extra = HEADCOUNT_OPTIONAL_KEYS.filter((k) => basis.include[k]).map(
		(k) => HEADCOUNT_LABELS[k]
	);
	return `${method} · ${extra.length ? `정규직+${extra.join('+')}` : '정규직만'}`;
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

/** 합산 레코드 표기: "합산 (분기 4개)" · "차감 (연간 − 나머지 분기)" */
export function derivedLabel(d: DerivedInfo): string {
	return d.method === 'sum'
		? `합산 (${PERIOD_TYPE_LABELS[d.from]} ${d.count}개)`
		: `차감 (${PERIOD_TYPE_LABELS[d.from]} − 나머지)`;
}
