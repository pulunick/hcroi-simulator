import {
	HC_COST_KEYS,
	HEADCOUNT_KEYS,
	type HcCostBreakdown,
	type HeadcountBasis,
	type HeadcountBreakdown,
	type Period,
	type PeriodRecord,
	type PeriodType
} from './types';
import { validateInputs, validateRecord } from './formulas';
import {
	childPeriods,
	childType,
	comparePeriods,
	parentPeriod,
	periodIndexCount,
	periodKey,
	periodMonths
} from './period';

/**
 * 기간 합산 — 순수 함수. 저장된(직접 입력한) 레코드에서 상위 기간을 **읽을 때** 계산한다.
 * 계산 결과는 저장하지 않는다(지표 미저장 원칙과 같은 선). 규칙은 docs/plans/rollup-and-excel.md.
 *
 * - 사슬: 월×3 → 분기, 분기×2 → 반기, 반기×2 → 연간. 중간 단위가 직접 입력이면 그것을 쓴다(직접 입력 우선).
 * - 하위 기간이 모두 있을 때만 만든다. 빠진 기간을 추정하지 않는다.
 * - **검증 오류인 기간(`validateRecord`)은 "빠진 기간"과 똑같이 취급한다** — 그 기간이 든 상위 기간은
 *   합산도 차감도 만들지 않는다(2026-09-15). 오류 레코드를 빼고 조용히 작아진 합계가 지표·리포트로
 *   나가는 것이 빠진 합계보다 위험하기 때문. 오류 레코드 자체는 목록에 그대로 남는다(화면이 고칠 수 있게).
 * - 차감: 직접 입력한 상위 기간이 있고 하위 기간이 하나만 비면 `상위 − 나머지 합` 으로 그 하나를 만든다
 *   (사업보고서의 4분기 = 연간 − 1~3분기). 검증을 통과할 때만.
 * - 금액은 합계. 임직원 수는 산정 방식을 따른다 — 기간 평균이면 하위 기간 평균(반올림), 기말이면 마지막 하위 기간 값.
 */

export const DERIVED_ID_PREFIX = 'derived:';

export function derivedId(p: Period): string {
	return `${DERIVED_ID_PREFIX}${periodKey(p)}`;
}

export function isDerivedId(id: string): boolean {
	return id.startsWith(DERIVED_ID_PREFIX);
}

/** 산정 방식에 따른 인원 집계: 기간 평균 → 평균, 기말 → 마지막 값. 반올림은 호출 쪽에서 */
function aggregateHeads(values: number[], basis: HeadcountBasis): number {
	if (basis.method === 'periodEnd') return values[values.length - 1];
	return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * 합산 레코드의 반올림 전 인원. 분기 평균을 반올림한 뒤 다시 반기·연간 평균을 내면 한 명씩 어긋나므로
 * 사슬을 따라 올라갈 때는 이 값을 쓴다 (기간 키 → 정확한 평균).
 */
type ExactHeads = Map<string, number>;

function sumRecords(
	parent: Period,
	children: PeriodRecord[],
	basis: HeadcountBasis,
	exact: ExactHeads
): PeriodRecord {
	const sum = (pick: (r: PeriodRecord) => number) => children.reduce((s, r) => s + pick(r), 0);
	const heads = aggregateHeads(
		children.map((c) => exact.get(periodKey(c.period)) ?? c.inputs.headcount),
		basis
	);
	exact.set(periodKey(parent), heads);
	const breakdown: HcCostBreakdown | null = children.every((c) => c.breakdown)
		? (Object.fromEntries(
				HC_COST_KEYS.map((k) => [k, sum((r) => (r.breakdown as HcCostBreakdown)[k])])
			) as unknown as HcCostBreakdown)
		: null;
	const headcountBreakdown: HeadcountBreakdown | null = children.every((c) => c.headcountBreakdown)
		? (Object.fromEntries(
				HEADCOUNT_KEYS.map((k) => [
					k,
					Math.round(
						aggregateHeads(
							children.map((c) => (c.headcountBreakdown as HeadcountBreakdown)[k]),
							basis
						)
					)
				])
			) as unknown as HeadcountBreakdown)
		: null;
	return {
		id: derivedId(parent),
		period: parent,
		inputs: {
			revenue: sum((r) => r.inputs.revenue),
			operatingCost: sum((r) => r.inputs.operatingCost),
			hcCost: sum((r) => r.inputs.hcCost),
			headcount: Math.round(heads)
		},
		breakdown,
		headcountBreakdown,
		derived: { method: 'sum', from: children[0].period.type, count: children.length }
	};
}

/** 직접 입력한 상위 기간 − 나머지 하위 기간 = 빠진 하위 기간 하나. 검증을 통과하지 못하면 null */
function diffRecord(
	parent: PeriodRecord,
	missing: Period,
	others: PeriodRecord[],
	count: number,
	basis: HeadcountBasis
): PeriodRecord | null {
	const rest = (pick: (r: PeriodRecord) => number) => others.reduce((s, r) => s + pick(r), 0);
	const avgHeads = count * parent.inputs.headcount - rest((r) => r.inputs.headcount);
	const inputs = {
		revenue: parent.inputs.revenue - rest((r) => r.inputs.revenue),
		operatingCost: parent.inputs.operatingCost - rest((r) => r.inputs.operatingCost),
		hcCost: parent.inputs.hcCost - rest((r) => r.inputs.hcCost),
		headcount: basis.method === 'periodEnd' || avgHeads < 1 ? parent.inputs.headcount : avgHeads
	};
	if (validateInputs(inputs).length) return null;
	let breakdown: HcCostBreakdown | null = null;
	if (parent.breakdown && others.every((o) => o.breakdown)) {
		const pb = parent.breakdown;
		breakdown = Object.fromEntries(
			HC_COST_KEYS.map((k) => [k, pb[k] - rest((r) => (r.breakdown as HcCostBreakdown)[k])])
		) as unknown as HcCostBreakdown;
		if (HC_COST_KEYS.some((k) => (breakdown as HcCostBreakdown)[k] < 0)) breakdown = null;
	}
	return {
		id: derivedId(missing),
		period: missing,
		inputs,
		breakdown,
		headcountBreakdown: null,
		derived: { method: 'diff', from: parent.period.type, count }
	};
}

/** 이 기간 안에 드는 `type` 단위 기간 전부 (2025 연간, 'Q' → 1~4분기) */
function descendantPeriods(p: Period, type: PeriodType): Period[] {
	const len = 12 / periodIndexCount(type);
	const { start, end } = periodMonths(p);
	const out: Period[] = [];
	for (let m = start; m <= end; m += len)
		out.push({ year: p.year, type, index: (m - 1) / len + 1 });
	return out;
}

/**
 * 직접 입력한 레코드 + 계산된 상위/차감 레코드 = 화면이 쓰는 전체 목록 (시간순).
 * 직접 입력한 기간은 그대로 두고, 없는 기간만 만든다.
 */
export function rollup(
	records: PeriodRecord[],
	basis: HeadcountBasis,
	/** 내부용 — `true` 면 검증 오류 기간도 정상처럼 써서 합산한다 (`blockedRollups` 의 비교 기준) */
	opts: { ignoreInvalid?: boolean } = {}
): PeriodRecord[] {
	const manual = new Map(records.map((r) => [periodKey(r.period), r]));
	const derived = new Map<string, PeriodRecord>();
	const exact: ExactHeads = new Map();
	const get = (p: Period) => manual.get(periodKey(p)) ?? derived.get(periodKey(p));
	const all = () => [...manual.values(), ...derived.values()];
	// 검증 오류 기간 — 자리는 차지하되(그 위에 합산을 만들지 않는다) 합산 재료로는 쓰지 않는다
	const invalid = new Set(
		opts.ignoreInvalid
			? []
			: records.filter((r) => validateRecord(r).length > 0).map((r) => periodKey(r.period))
	);
	/** 합산 재료로 쓸 수 있는 레코드만 (검증 오류면 없는 것으로 본다) */
	const usable = (r: PeriodRecord | undefined) =>
		r && !invalid.has(periodKey(r.period)) ? r : undefined;

	// 합산 → 차감 → (차감으로 생긴 기간이 새 합산을 만들 수 있으니) 다시 합산. 변화가 없을 때까지, 최대 4회
	for (let pass = 0; pass < 4; pass++) {
		let changed = false;
		// ① 합산: 잘은 단위부터 (M→Q, Q→H, H→Y) — 사슬이 한 번의 pass 안에 이어진다
		for (const parentT of ['Q', 'H', 'Y'] as PeriodType[]) {
			const childT = childType(parentT) as PeriodType;
			const candidates = new Map<string, Period>();
			for (const r of all()) {
				if (r.period.type !== childT || !usable(r)) continue;
				const parent = parentPeriod(r.period, parentT);
				if (parent && !get(parent)) candidates.set(periodKey(parent), parent);
			}
			for (const parent of candidates.values()) {
				const kids = childPeriods(parent).map((p) => usable(get(p)));
				if (kids.every((k): k is PeriodRecord => !!k)) {
					derived.set(periodKey(parent), sumRecords(parent, kids, basis, exact));
					changed = true;
				}
			}
		}
		// ② 차감: 직접 입력한 상위 기간의 하위 기간(반기·분기·월 어느 단위든)이 하나만 빈 경우
		//    연간 + 1~3분기 → 4분기 = 연간 − (1~3분기 합). 하반기는 다음 pass 의 합산이 만든다
		for (const parent of manual.values()) {
			if (!usable(parent)) continue;
			for (let t = childType(parent.period.type); t; t = childType(t)) {
				const kidsP = descendantPeriods(parent.period, t);
				// 오류인 하위 기간이 섞여 있으면 차감도 하지 않는다 (그 값이 빠진 채로 나머지에 몰린다)
				if (kidsP.some((p) => get(p) && !usable(get(p)))) continue;
				const missing = kidsP.filter((p) => !get(p));
				if (missing.length !== 1) continue;
				const others = kidsP.filter((p) => !!get(p)).map((p) => get(p) as PeriodRecord);
				const rec = diffRecord(parent, missing[0], others, kidsP.length, basis);
				if (rec) {
					derived.set(periodKey(missing[0]), rec);
					changed = true;
				}
			}
		}
		if (!changed) break;
	}
	return all().sort((a, b) => comparePeriods(a.period, b.period));
}

/** 검증 오류 때문에 만들지 못한 상위 기간 (데이터 화면이 "합산 없음 — 하위 기간 오류(…)" 로 알린다) */
export interface BlockedRollup {
	/** 만들어졌어야 할 상위 기간 */
	period: Period;
	/** 그 안에서 검증 오류가 난 하위 기간들 */
	blockedBy: Period[];
}

/** `parent` 기간이 `child` 기간을 품는가 (같은 해 · 더 짧은 단위 · 월 범위 포함) */
function containsPeriod(parent: Period, child: Period): boolean {
	if (parent.year !== child.year) return false;
	const p = periodMonths(parent);
	const c = periodMonths(child);
	return c.start >= p.start && c.end <= p.end && c.end - c.start < p.end - p.start;
}

/**
 * 검증 오류가 없었다면 생겼을 상위 기간 중 실제로는 만들어지지 않은 것들.
 * 화면은 이 목록으로 "2025 연간 — 합산 없음(하위 기간 오류: 2025 2분기)" 한 줄을 보여 준다.
 */
export function blockedRollups(records: PeriodRecord[], basis: HeadcountBasis): BlockedRollup[] {
	const invalid = records.filter((r) => validateRecord(r).length > 0);
	if (!invalid.length) return [];
	const actual = new Set(rollup(records, basis).map((r) => periodKey(r.period)));
	return rollup(records, basis, { ignoreInvalid: true })
		.filter((r) => r.derived && !actual.has(periodKey(r.period)))
		.map((r) => ({
			period: r.period,
			blockedBy: invalid.map((iv) => iv.period).filter((p) => containsPeriod(r.period, p))
		}))
		.filter((b) => b.blockedBy.length > 0)
		.sort((a, b) => comparePeriods(a.period, b.period));
}

/** 직접 입력 레코드와 하위 기간 합산이 다른 항목 (값은 직접 입력이 우선이고, 이건 경고용) */
export interface RollupMismatch {
	field: 'revenue' | 'operatingCost' | 'hcCost' | 'headcount';
	label: string;
	manual: number;
	derived: number;
}

const MISMATCH_FIELDS: { field: RollupMismatch['field']; label: string; tol: number }[] = [
	{ field: 'revenue', label: '매출액', tol: 1 },
	{ field: 'operatingCost', label: '영업비용', tol: 1 },
	{ field: 'hcCost', label: '총 인건비', tol: 1 },
	{ field: 'headcount', label: '총 임직원 수', tol: 0.5 }
];

/**
 * 직접 입력한 레코드가 없다고 치고 하위 기간에서 합산한 값과 비교한다.
 * 하위 기간이 다 없어 합산이 안 되면 빈 배열. `records` 는 직접 입력 목록(합산 레코드가 섞여 있어도 무시).
 */
export function rollupMismatch(
	manual: PeriodRecord,
	records: PeriodRecord[],
	basis: HeadcountBasis
): RollupMismatch[] {
	if (manual.derived || !childPeriods(manual.period).length) return [];
	const key = periodKey(manual.period);
	const without = records.filter((r) => !r.derived && periodKey(r.period) !== key);
	const d = rollup(without, basis).find((r) => periodKey(r.period) === key);
	if (!d || d.derived?.method !== 'sum') return [];
	return MISMATCH_FIELDS.flatMap(({ field, label, tol }) =>
		Math.abs(manual.inputs[field] - d.inputs[field]) > tol
			? [{ field, label, manual: manual.inputs[field], derived: d.inputs[field] }]
			: []
	);
}
