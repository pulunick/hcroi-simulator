/**
 * 경영진 리포트(/report) 데이터 조립 — 순수 함수.
 *
 * 지표·등급·시나리오 적용·손익분기 역산·인사이트는 **전부 코어**(`src/lib/hcroi/**`)가 계산한다.
 * 이 모듈은 그 결과를 A4 한 장 배치에 맞게 **고르고 엮기만** 한다 (수식을 새로 쓰지 않는다).
 * 문자열 표기는 언제나 `format.ts` 를 거친다 — 화면 컴포넌트는 여기서 나온 값을 그대로 얹는다.
 */
import {
	HCROI_THRESHOLDS,
	computeMetrics,
	gradeOf,
	validateRecord,
	GRADE_LABEL
} from '../hcroi/formulas';
import {
	DEFAULT_SCENARIO_PARAMS,
	applyScenario,
	breakEvenProductivityPct,
	compareScenarios
} from '../hcroi/scenario';
import { scenarioInsights, trendInsights } from '../hcroi/insights';
import { comparePeriods, periodIndexCount, periodLabel, prevWord } from '../hcroi/period';
import { trendSeries } from '../hcroi/trend';
import {
	formatAmount,
	formatMultiple,
	formatPct,
	formatSigned,
	type AmountUnit
} from '../hcroi/format';
import {
	PERIOD_TYPE_LABELS,
	type BaseInputs,
	type HcroiGrade,
	type Insight,
	type InsightTone,
	type Metrics,
	type Period,
	type PeriodRecord,
	type PeriodType,
	type Scenario,
	type ScenarioParams,
	type ScenarioResult
} from '../hcroi/types';

/** 리포트가 한 장에 올리는 추이 기간 수 */
export const TREND_COUNT = 3;

/* ───────────────────────── 표기 보조 ───────────────────────── */

/** 오늘 날짜 (작성일) — "2026-09-14" */
export function todayText(d: Date = new Date()): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 증감률(%) — 표시 계층 전용 계산이다(지표가 아니다).
 * 기준이 0이거나 값이 없으면 null.
 */
export function pctChange(before: number | null | undefined, after: number | null | undefined) {
	if (
		typeof before !== 'number' ||
		typeof after !== 'number' ||
		!Number.isFinite(before) ||
		!Number.isFinite(after) ||
		before === 0
	) {
		return null;
	}
	return ((after - before) / Math.abs(before)) * 100;
}

/**
 * 배수 표기를 숫자와 단위로 나눈다 — 리포트 HCROI 박스가 숫자만 크게 쓰기 위해서.
 * 숫자 문자열의 출처는 언제나 `formatMultiple` 이다(자릿수 규칙을 복제하지 않는다).
 */
export function splitMultiple(v: number | null | undefined): { value: string; unit: string } {
	const text = formatMultiple(v);
	return text.endsWith('배') ? { value: text.slice(0, -1), unit: '배' } : { value: text, unit: '' };
}

/** "인건비 1원당 ○원" 의 ○ — `formatMultiple` 의 숫자를 그대로 쓴다 */
export function hcroiPerWon(v: number | null | undefined): string {
	return `${splitMultiple(v).value}원`;
}

/** 등급 구간 표기 — 경계는 `HCROI_THRESHOLDS` 한 곳에서만 읽는다 */
export function gradeRangeText(grade: HcroiGrade | null): string {
	const w = HCROI_THRESHOLDS.warning.toFixed(1);
	const e = HCROI_THRESHOLDS.excellent.toFixed(1);
	if (grade === 'critical') return `${w} 미만`;
	if (grade === 'warning') return `${w}–${e}`;
	if (grade === 'excellent') return `${e} 이상`;
	return '—';
}

/** 증감 방향 낱말 — 판단 문장의 "높아/낮아" */
export function changeWord(delta: number | null): '높아' | '낮아' | null {
	if (delta === null || !Number.isFinite(delta) || Math.abs(delta) < 0.005) return null;
	return delta > 0 ? '높아' : '낮아';
}

/**
 * 같은 유형의 **다음** 기간 (`period.ts` 의 `previousPeriod` 의 반대).
 * 코어는 이 브랜치에서 고치지 않으므로 리포트 전용으로 두되, 순번 개수는 코어(`periodIndexCount`)를 쓴다.
 */
export function nextPeriod(p: Period): Period {
	const n = periodIndexCount(p.type);
	return p.index < n ? { ...p, index: p.index + 1 } : { year: p.year + 1, type: p.type, index: 1 };
}

/* ───────────────────────── 머리 · 판단 문장 ───────────────────────── */

export interface ReportHeadline {
	hcroi: number | null;
	grade: HcroiGrade | null;
	gradeLabel: string;
	gradeRange: string;
	/** 전기 대비 HCROI 차이 (배). 전기가 없으면 null */
	prevDelta: number | null;
	/** "전년" · "전기" · "전월" */
	prevWord: string;
	prevLabel: string | null;
}

export function reportHeadline(rec: PeriodRecord, prev: PeriodRecord | null): ReportHeadline {
	const m = computeMetrics(rec.inputs);
	const grade = gradeOf(m.hcroi);
	const pm = prev ? computeMetrics(prev.inputs) : null;
	return {
		hcroi: m.hcroi,
		grade,
		gradeLabel: grade ? GRADE_LABEL[grade] : '—',
		gradeRange: gradeRangeText(grade),
		prevDelta: m.hcroi !== null && pm?.hcroi != null ? m.hcroi - pm.hcroi : null,
		prevWord: prevWord(rec.period.type),
		prevLabel: prev ? periodLabel(prev.period) : null
	};
}

/**
 * 판단 문장에서 등급 낱말 **뒤**에 오는 꼬리.
 * 등급 낱말에 밑줄을 쳐야 해서 문장을 둘로 나눈다 — 앞은 "…등급은", 뒤가 이 문자열이다.
 */
export function verdictTail(h: ReportHeadline): string {
	const word = changeWord(h.prevDelta);
	if (h.prevDelta === null) return `입니다. 비교할 ${h.prevWord} 자료는 없습니다.`;
	if (word === null) return `이며, ${h.prevWord}과 거의 같은 수준입니다.`;
	return `이며, ${h.prevWord}보다 ${splitMultiple(Math.abs(h.prevDelta)).value}배 ${word}졌습니다.`;
}

/**
 * 보조 문장 ① — 인당 인건비 vs 인당 매출 증가율 비교.
 * 전기가 없거나 증가율을 낼 수 없으면 null (그 문장은 리포트에서 생략한다).
 */
export function efficiencySentence(rec: PeriodRecord, prev: PeriodRecord | null): string | null {
	if (!prev) return null;
	const cur = computeMetrics(rec.inputs);
	const before = computeMetrics(prev.inputs);
	const hc = pctChange(before.hcCostPerHead, cur.hcCostPerHead);
	const rev = pctChange(before.revenuePerHead, cur.revenuePerHead);
	if (hc === null || rev === null) return null;
	const hcText = `인당 인건비(${formatSigned(hc, (n) => formatPct(n))})`;
	const revText = `인당 매출(${formatSigned(rev, (n) => formatPct(n))})`;
	if (Math.abs(hc - rev) < 0.05) {
		return `${hcText}와 ${revText}가 비슷한 속도로 움직여 효율은 거의 그대로입니다.`;
	}
	return hc > rev
		? `${hcText}가 ${revText}보다 빠르게 올라 효율이 떨어졌습니다.`
		: `${revText}이 ${hcText}보다 빠르게 올라 효율이 좋아졌습니다.`;
}

/**
 * 우수 등급(HCROI 1.5배)까지 더 필요한 영업이익 (원).
 * 코어의 손익분기 역산(`breakEvenProductivityPct`)으로 목표 HCROI 를 만드는 매출을 구한 뒤,
 * 그 시나리오의 영업이익(`computeMetrics`)과 현재 영업이익의 차이를 돌려준다 — 새 수식을 쓰지 않는다.
 * 이미 우수이거나 계산 불가면 null.
 */
export function profitGapToExcellent(inputs: BaseInputs): number | null {
	const g = breakEvenProductivityPct(inputs, DEFAULT_SCENARIO_PARAMS, HCROI_THRESHOLDS.excellent);
	if (g === null || g <= 0) return null;
	const target = applyScenario(inputs, { ...DEFAULT_SCENARIO_PARAMS, productivityPct: g });
	const gap = computeMetrics(target).operatingProfit - computeMetrics(inputs).operatingProfit;
	return Number.isFinite(gap) && gap > 0 ? gap : null;
}

/** 보조 문장 ② — "우수 등급(1.5배)까지는 영업이익 ○○이 더 필요합니다." 없으면 null */
export function gapSentence(inputs: BaseInputs, unit: AmountUnit): string | null {
	const gap = profitGapToExcellent(inputs);
	if (gap === null) return null;
	return `우수 등급(${formatMultiple(HCROI_THRESHOLDS.excellent)})까지는 영업이익 ${formatAmount(gap, unit)}이 더 필요합니다.`;
}

/* ───────────────────────── KPI 4 ───────────────────────── */

export interface ReportKpi {
	label: string;
	/** 부가 설명 (임직원 수의 산정 기준 등) */
	note?: string;
	value: number | null;
	/** 금액·인당 지표는 증감률(%), 인원은 증감 인원(명) */
	kind: 'amount' | 'headcount';
	deltaPct: number | null;
	deltaCount: number | null;
}

export function reportKpis(
	rec: PeriodRecord,
	prev: PeriodRecord | null,
	basisLabel: string
): ReportKpi[] {
	const m = computeMetrics(rec.inputs);
	const p = prev ? computeMetrics(prev.inputs) : null;
	const amount = (
		label: string,
		cur: number | null,
		before: number | null | undefined
	): ReportKpi => ({
		label,
		value: cur,
		kind: 'amount',
		deltaPct: pctChange(before, cur),
		deltaCount: null
	});
	return [
		amount('HCVA (인당 부가가치)', m.hcva, p?.hcva),
		amount('인당 매출', m.revenuePerHead, p?.revenuePerHead),
		amount('인당 인건비', m.hcCostPerHead, p?.hcCostPerHead),
		{
			label: '임직원 수',
			note: basisLabel,
			value: rec.inputs.headcount,
			kind: 'headcount',
			deltaPct: null,
			deltaCount: prev ? rec.inputs.headcount - prev.inputs.headcount : null
		}
	];
}

/* ───────────────────────── 1. 추이 ───────────────────────── */

export interface ReportTrendRow {
	record: PeriodRecord;
	metrics: Metrics;
	/** 그 유형 자료가 없는 해를 대신한 연간 참조점 (`trend.ts`) */
	reference: boolean;
}

/**
 * 보고 기간까지의 같은 유형 레코드 (그 **뒤** 기간은 리포트에 넣지 않는다 —
 * 3분기 보고서에 4분기 실적이 섞이면 보고 시점과 맞지 않는다).
 */
export function sameTypeUpTo(effective: PeriodRecord[], period: Period): PeriodRecord[] {
	return effective
		.filter((r) => r.period.type === period.type && comparePeriods(r.period, period) <= 0)
		.sort((a, b) => comparePeriods(a.period, b.period));
}

/** 보고 기간으로 끝나는 최근 N개 — 고르는 규칙(참조점 포함)은 코어 `trendSeries` 한 곳 */
export function reportTrendRows(
	effective: PeriodRecord[],
	period: Period,
	limit = TREND_COUNT
): ReportTrendRow[] {
	return trendSeries(effective, period.type, 'all')
		.filter((p) => comparePeriods(p.record.period, period) <= 0)
		.slice(-limit)
		.map((p) => ({
			record: p.record,
			metrics: computeMetrics(p.record.inputs),
			reference: p.reference
		}));
}

/** "3개년 추이" · "최근 4개 분기 추이" */
export function trendHeading(type: PeriodType, count: number): string {
	return type === 'Y' ? `${count}개년 추이` : `최근 ${count}개 ${PERIOD_TYPE_LABELS[type]} 추이`;
}

/* ───────────────────────── 2. 시나리오 비교 ───────────────────────── */

export interface ReportScenarioRow {
	key: string;
	name: string;
	assumption: string;
	inputs: BaseInputs;
	metrics: Metrics;
	grade: HcroiGrade | null;
	gradeLabel: string;
	baseline: boolean;
}

/** "인원 +10% · 임금 +5% · 생산성 0%" (변동비 비율을 쓴 경우만 뒤에 붙인다) */
export function assumptionText(p: ScenarioParams): string {
	const head =
		p.headcountMode === 'pct'
			? `인원 ${formatSigned(p.headcountPct, (n) => formatPct(n, 0))}`
			: `인원 ${formatSigned(p.headcountDelta, (n) => `${n}명`)}`;
	const parts = [
		head,
		`임금 ${formatSigned(p.wageIncreasePct, (n) => formatPct(n, 0))}`,
		`생산성 ${formatSigned(p.productivityPct, (n) => formatPct(n, 0))}`
	];
	if (p.variableCostRatioPct > 0) parts.push(`변동비 ${formatPct(p.variableCostRatioPct, 0)}`);
	return parts.join(' · ');
}

export function reportScenarioRows(base: PeriodRecord, scenarios: Scenario[]): ReportScenarioRow[] {
	const cmp = compareScenarios(base.inputs, scenarios);
	const first: ReportScenarioRow = {
		key: 'baseline',
		name: '기준',
		assumption: `${periodLabel(base.period)} 실적 유지`,
		inputs: cmp.baseline.inputs,
		metrics: cmp.baseline.metrics,
		grade: gradeOf(cmp.baseline.metrics.hcroi),
		gradeLabel: gradeLabelOf(cmp.baseline.metrics.hcroi),
		baseline: true
	};
	return [
		first,
		...cmp.results.map((r) => ({
			key: r.scenario.id,
			name: shortScenarioName(r.scenario.name),
			assumption: assumptionText(r.scenario.params),
			inputs: r.inputs,
			metrics: r.metrics,
			grade: gradeOf(r.metrics.hcroi),
			gradeLabel: gradeLabelOf(r.metrics.hcroi),
			baseline: false
		}))
	];
}

function gradeLabelOf(hcroi: number | null): string {
	const g = gradeOf(hcroi);
	return g ? GRADE_LABEL[g] : '—';
}

/** 표 첫 칸은 좁다 — "시나리오 A" 는 "A" 로 줄이고, 직접 붙인 이름은 그대로 둔다 */
export function shortScenarioName(name: string): string {
	const m = name.trim().match(/^시나리오\s*(.+)$/);
	return m ? m[1] : name.trim();
}

/** 시나리오 표 제목 — 기준 기간의 **다음** 기간 */
export function scenarioHeading(base: Period): string {
	return `${periodLabel(nextPeriod(base))} 시나리오 비교`;
}

/** 본문에서 특정 낱말이 든 첫 문장만 뽑는다 (마침표 포함) */
function sentenceContaining(body: string, needle: string): string | null {
	const parts = body.split(/(?<=\.)\s+/);
	return parts.find((s) => s.includes(needle))?.trim() ?? null;
}

/**
 * 시나리오 표 아래 주석 — "변동비 비율 0%" 고정비 가정 경고.
 * 문구는 **코어 인사이트**(`scenarioInsights`)가 낸 문장을 그대로 쓴다. 해당 경고가 없으면 null.
 */
export function variableCostCaution(
	base: BaseInputs,
	scenarios: Scenario[],
	unit: AmountUnit
): string | null {
	const cmp = compareScenarios(base, scenarios);
	for (const r of cmp.results) {
		for (const ins of scenarioInsights(base, r, unit)) {
			const s = sentenceContaining(ins.body, '변동비 비율 0%');
			if (s) return `${shortScenarioName(r.scenario.name)}: ${s}`;
		}
	}
	return null;
}

/** 시뮬레이터 모델이 반영하지 않는 것 (spec §4) — 주석 끝에 항상 붙인다 */
export const MODEL_CAVEAT = '신규 인원 램프업·채용/퇴직 일회성 비용은 반영하지 않았습니다.';

/* ───────────────────────── 3. 판단과 제안 ───────────────────────── */

const TONE_RANK: Record<InsightTone, number> = {
	critical: 0,
	warning: 1,
	neutral: 2,
	positive: 3
};

/**
 * 코어 인사이트 중 상위 N개 — 문구는 손대지 않는다.
 * 심각한 것부터(critical → warning → neutral → positive), 같은 톤이면 넘어온 순서대로.
 * 자리가 세 칸뿐이라 **제목이 같은 것은 첫 번째만** 남긴다 (시나리오 두 개가 같은 경고를 내면 한 줄로 족하다).
 */
export function topInsights(lists: Insight[][], n = 3): Insight[] {
	const seen = new Set<string>();
	return lists
		.flat()
		.filter((i) => {
			if (seen.has(i.title)) return false;
			seen.add(i.title);
			return true;
		})
		.map((insight, order) => ({ insight, order }))
		.sort((a, b) => TONE_RANK[a.insight.tone] - TONE_RANK[b.insight.tone] || a.order - b.order)
		.slice(0, n)
		.map((x) => x.insight);
}

/** 리포트 3번 항목 — 추이 인사이트 + 시나리오 인사이트를 모아 상위 3개 */
export function reportInsights(
	base: PeriodRecord,
	trendRecords: PeriodRecord[],
	scenarios: Scenario[],
	unit: AmountUnit,
	n = 3
): Insight[] {
	const cmp = compareScenarios(base.inputs, scenarios);
	const fromScenarios: Insight[][] = cmp.results.map((r: ScenarioResult) =>
		scenarioInsights(base.inputs, r, unit)
	);
	return topInsights([trendInsights(trendRecords), ...fromScenarios], n);
}

/* ───────────────────────── 전체 준비 상태 ───────────────────────── */

export type ReportBlocker =
	{ kind: 'no-data' } | { kind: 'invalid'; errors: string[] } | { kind: 'no-metrics' };

/**
 * 리포트를 그릴 수 있는지 — 데이터 없음 / 검증 오류(`validateRecord`) / HCROI 산출 불가.
 * 그릴 수 있으면 null.
 */
export function reportBlocker(rec: PeriodRecord | null | undefined): ReportBlocker | null {
	if (!rec) return { kind: 'no-data' };
	const errors = validateRecord(rec);
	if (errors.length) return { kind: 'invalid', errors };
	return computeMetrics(rec.inputs).hcroi === null ? { kind: 'no-metrics' } : null;
}
