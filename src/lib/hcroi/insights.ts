import { HCROI_THRESHOLDS, computeMetrics, gradeOf } from './formulas';
import { formatKrwCompact, formatMultiple, formatPct, formatSigned } from './format';
import type { BaseInputs, HcroiGrade, Insight, Metrics, ScenarioResult, YearRecord } from './types';

const GRADE_RANK: HcroiGrade[] = ['critical', 'warning', 'excellent'];
const GRADE_KO: Record<HcroiGrade, string> = {
	critical: '위험',
	warning: '보통',
	excellent: '우수'
};

function rank(g: HcroiGrade | null): number {
	return g === null ? -1 : GRADE_RANK.indexOf(g);
}
function label(g: HcroiGrade | null): string {
	return g === null ? '—' : GRADE_KO[g];
}
/** HCROI 증감 표기 — 배수 차이는 %p 와 혼동되지 않도록 "배" 단위로 쓴다 */
const pp = (n: number) => formatMultiple(n);

/**
 * 규칙 기반 인사이트 생성기.
 * 요구사항 §응답규칙: 수치 악화 시 원인 분석 + 구조적 개선책(인당 생산성 제고, 고정비 절감 등) 제시.
 * (Phase 2 에서 LLM 서술로 대체/보강 예정 — 규칙은 그대로 프롬프트 근거로 재사용)
 */
export function scenarioInsights(base: BaseInputs, r: ScenarioResult): Insight[] {
	const b = computeMetrics(base);
	const s = r.metrics;
	const p = r.scenario.params;
	const out: Insight[] = [];

	if (b.hcroi === null || s.hcroi === null) {
		out.push({
			tone: 'warning',
			title: 'HCROI 산출 불가',
			body: '총 인건비가 0이거나 입력이 불완전하여 HCROI 를 계산할 수 없습니다. 기준 데이터를 확인하세요.'
		});
		return out;
	}

	const dHcroi = s.hcroi - b.hcroi;
	const headline =
		`HCROI ${formatMultiple(b.hcroi)} → ${formatMultiple(s.hcroi)} (${formatSigned(dHcroi, pp)}), ` +
		`영업이익 ${formatKrwCompact(b.operatingProfit)} → ${formatKrwCompact(s.operatingProfit)} (${formatSigned(r.delta.operatingProfit, (n) => formatKrwCompact(n))}), ` +
		`총 인건비 ${formatKrwCompact(base.hcCost)} → ${formatKrwCompact(r.inputs.hcCost)} (${formatSigned(r.delta.hcCost, (n) => formatKrwCompact(n))}), ` +
		`인원 ${base.headcount}명 → ${r.inputs.headcount}명.`;

	// 1) 헤드라인 — 등급 변동 포함
	const gBase = gradeOf(b.hcroi);
	const gNext = gradeOf(s.hcroi);
	if (dHcroi < -0.005) {
		out.push({
			tone: s.hcroi < HCROI_THRESHOLDS.warning ? 'critical' : 'warning',
			title:
				rank(gNext) < rank(gBase)
					? `HCROI 악화 — 등급 하락 (${label(gBase)} → ${label(gNext)})`
					: 'HCROI 악화',
			body: headline
		});
	} else if (dHcroi > 0.005) {
		out.push({
			tone: 'positive',
			title:
				rank(gNext) > rank(gBase)
					? `HCROI 개선 — 등급 상승 (${label(gBase)} → ${label(gNext)})`
					: 'HCROI 개선',
			body: headline
		});
	} else {
		out.push({ tone: 'neutral', title: 'HCROI 변동 미미', body: headline });
	}

	// 2) 원인 분석 + 3) 구조적 개선책 (악화 시)
	if (dHcroi < -0.005) {
		const causes: string[] = [];
		if (p.wageIncreasePct > p.productivityPct) {
			causes.push(
				`임금 인상률(${formatPct(p.wageIncreasePct)})이 인당 생산성 변화율(${formatPct(p.productivityPct)})을 ${formatPct(p.wageIncreasePct - p.productivityPct)}p 상회하여 인건비 증가 속도가 부가가치 증가 속도보다 빠릅니다.`
			);
		}
		if (r.delta.headcount > 0 && p.productivityPct <= 0) {
			causes.push(
				`인원이 ${r.delta.headcount}명 증가했으나 인당 생산성이 개선되지 않아, 증원분이 인건비만 늘리고 고정비 레버리지 효과를 만들지 못합니다.`
			);
		}
		if (r.delta.headcount < 0 && p.productivityPct < 0) {
			const fixed = b.nonHcCost * (1 - p.variableCostRatioPct / 100);
			causes.push(
				`인원 감축(${r.delta.headcount}명)과 함께 인당 생산성까지 하락(${formatPct(p.productivityPct)})하여 매출 감소분이 고정비(${formatKrwCompact(fixed)})에 흡수되지 못합니다.`
			);
		}
		if (causes.length === 0) {
			causes.push(
				'인건비 증가분 대비 인적자본 투입 전 이익(영업이익+인건비)의 증가가 부족합니다. 인원·임금·생산성 세 변수의 조합을 재점검하세요.'
			);
		}
		out.push({ tone: 'warning', title: '원인 분석', body: causes.join(' ') });

		const fixes: string[] = [];
		if (r.breakEvenProductivityPct !== null) {
			fixes.push(
				`① 인당 생산성 제고: 인당 매출을 기준연도 대비 ${formatPct(r.breakEvenProductivityPct)} 이상 끌어올리면(현재 시나리오 ${formatPct(p.productivityPct)}) HCROI 가 기준선 ${formatMultiple(b.hcroi)} 이상으로 회복됩니다.`
			);
		}
		if (r.maxWageIncreasePct !== null && p.wageIncreasePct > 0) {
			fixes.push(
				`② 임금 인상률 조정: 현 인원·생산성 조건에서 HCROI 를 지키는 임금 인상 상한은 ${formatPct(r.maxWageIncreasePct)} 입니다(현재 ${formatPct(p.wageIncreasePct)}). 인상분 일부를 성과연동(변동) 보상으로 전환하는 방안을 검토하세요.`
			);
		}
		const nonHcCut = neededNonHcCostCut(r, b.hcroi);
		if (nonHcCut !== null && nonHcCut > 0 && s.nonHcCost > 0) {
			fixes.push(
				`③ 고정비 절감: 비인건비 영업비용을 ${formatKrwCompact(nonHcCut)} (${formatPct((nonHcCut / s.nonHcCost) * 100)}) 절감하면 동일 HCROI 를 유지할 수 있습니다.`
			);
		}
		fixes.push(
			'④ 인력 구조 조정: 저부가 업무 자동화·아웃소싱, 고부가 직무로의 재배치를 통해 인당 부가가치(HCVA)를 높이는 것이 근본적 해법입니다.'
		);
		out.push({ tone: 'neutral', title: '구조적 개선책', body: fixes.join(' ') });
	}

	// 4) 개선 시 — 지속가능성 점검
	if (dHcroi > 0.005) {
		const notes: string[] = [];
		if (r.delta.headcount < 0) {
			notes.push(
				`인원 감축(${r.delta.headcount}명)에 의한 개선은 단기 효과입니다. 남은 인원의 업무 부하 증가로 인당 생산성이 유지되지 않을 위험을 함께 관리해야 합니다.`
			);
		}
		if (p.productivityPct > 5) {
			notes.push(
				`인당 생산성 ${formatPct(p.productivityPct)} 향상은 도전적인 목표입니다. 실행 근거(신규 수주, 단가 인상, 자동화 등)가 뒷받침되어야 합니다.`
			);
		}
		if (p.wageIncreasePct < 0) {
			notes.push(
				'임금 삭감 시나리오는 이직·사기 저하로 생산성 하락을 유발할 수 있어 HCROI 개선 효과가 과대 추정될 수 있습니다.'
			);
		}
		// 매출이 유의미하게(기준 대비 1% 초과) 늘었는데 변동비 비율이 0% 면 늘어난 매출 전부가 이익으로 떨어진다
		// — 고정비 레버리지 가정에 의한 과대 추정 경고
		const dRevenue = r.inputs.revenue - base.revenue;
		if (dRevenue > base.revenue * 0.01 && p.variableCostRatioPct <= 0 && b.nonHcCost > 0) {
			notes.push(
				`이 개선은 비인건비 영업비용 ${formatKrwCompact(b.nonHcCost)} 을 전액 고정비로 가정(변동비 비율 0%)한 결과입니다. 매출이 ${formatKrwCompact(dRevenue)} 늘어도 재료비·외주비 등 변동비가 전혀 따라 늘지 않는다는 뜻이므로 영업이익·HCROI 개선폭이 과대 추정될 수 있습니다. "고급 가정"의 변동비 비율을 조정해 민감도를 확인하세요.`
			);
		}
		if (notes.length)
			out.push({ tone: 'neutral', title: '지속가능성 점검', body: notes.join(' ') });
	}

	// 5) 영업손실 경고
	if (s.operatingProfit < 0) {
		out.push({
			tone: 'critical',
			title: '영업손실 전환',
			body: `시나리오 적용 시 영업이익이 ${formatKrwCompact(s.operatingProfit)} 으로 적자입니다. HCROI ${formatMultiple(s.hcroi)} 는 인건비 1원당 회수액이 1원 미만임을 뜻합니다.`
		});
	}

	return out;
}

/** 동일 HCROI 유지를 위해 필요한 비인건비 절감액 (원) */
function neededNonHcCostCut(r: ScenarioResult, targetHcroi: number): number | null {
	if (r.inputs.hcCost <= 0) return null;
	// (revenue − nonHc') / hcCost = target ⇒ nonHc' = revenue − target·hcCost
	const allowedNonHc = r.inputs.revenue - targetHcroi * r.inputs.hcCost;
	return r.metrics.nonHcCost - allowedNonHc;
}

/** 연도별 추이 인사이트 */
export function trendInsights(years: YearRecord[]): Insight[] {
	const sorted = [...years].sort((a, b) => a.year - b.year);
	const rows = sorted.map((y) => ({ year: y.year, m: computeMetrics(y.inputs), i: y.inputs }));
	const out: Insight[] = [];
	if (rows.length < 2) return out;

	const last = rows[rows.length - 1];
	const prev = rows[rows.length - 2];
	if (last.m.hcroi !== null && prev.m.hcroi !== null) {
		const d = last.m.hcroi - prev.m.hcroi;
		const streak = decliningStreak(rows.map((r) => r.m.hcroi));
		if (streak >= 2) {
			const from = rows[rows.length - 1 - streak];
			out.push({
				tone: 'warning',
				title: `HCROI ${streak}년 연속 하락`,
				body: `${from.year}년 ${formatMultiple(from.m.hcroi)} → ${last.year}년 ${formatMultiple(last.m.hcroi)}. 인건비 증가율과 인적자본 부가가치 증가율의 격차를 점검하세요.`
			});
		} else if (d < -0.005) {
			out.push({
				tone: 'warning',
				title: '전년 대비 HCROI 하락',
				body: `${prev.year}년 ${formatMultiple(prev.m.hcroi)} → ${last.year}년 ${formatMultiple(last.m.hcroi)} (${formatSigned(d, pp)}).`
			});
		} else if (d > 0.005) {
			out.push({
				tone: 'positive',
				title: '전년 대비 HCROI 개선',
				body: `${prev.year}년 ${formatMultiple(prev.m.hcroi)} → ${last.year}년 ${formatMultiple(last.m.hcroi)} (${formatSigned(d, pp)}).`
			});
		}
	}

	const hcGrowth = growth(prev.i.hcCost, last.i.hcCost);
	const pbhGrowth = growth(prev.m.profitBeforeHc, last.m.profitBeforeHc);
	if (hcGrowth !== null && pbhGrowth !== null) {
		const worse = hcGrowth > pbhGrowth;
		out.push({
			tone: worse ? 'warning' : 'positive',
			title: '인건비 증가율 vs 부가가치 증가율',
			body: `${last.year}년 총 인건비는 전년 대비 ${formatSigned(hcGrowth, (n) => formatPct(n))}, 인적자본 투입 전 이익(영업이익+인건비)은 ${formatSigned(pbhGrowth, (n) => formatPct(n))} 변동했습니다. ${
				worse
					? '인건비가 부가가치보다 빠르게 늘어 HCROI 를 압박합니다.'
					: '부가가치가 인건비보다 빠르게 늘어 HCROI 에 우호적입니다.'
			}`
		});
	}

	return out;
}

function growth(prev: number, next: number): number | null {
	if (!Number.isFinite(prev) || prev === 0) return null;
	return ((next - prev) / Math.abs(prev)) * 100;
}

function decliningStreak(values: (number | null)[]): number {
	let streak = 0;
	for (let i = values.length - 1; i > 0; i--) {
		const a = values[i];
		const b = values[i - 1];
		if (a === null || b === null || a >= b) break;
		streak++;
	}
	return streak;
}

export function metricsSummaryLine(m: Metrics): string {
	return `HCROI ${formatMultiple(m.hcroi)} · HCVA ${formatKrwCompact(m.hcva)}/인 · 인당 매출 ${formatKrwCompact(m.revenuePerHead)}/인 · 인당 인건비 ${formatKrwCompact(m.hcCostPerHead)}/인`;
}
