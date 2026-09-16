<script lang="ts">
	import { resolve } from '$app/paths';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { workspace } from '$lib/state/workspace.svelte';
	import {
		computeMetrics,
		diagnose,
		gradeOf,
		sumHcCost,
		validateRecord
	} from '$lib/hcroi/formulas';
	import { trendInsights } from '$lib/hcroi/insights';
	import {
		TREND_RANGES,
		defaultTrendRange,
		referenceYears,
		trendSeries,
		type TrendRange
	} from '$lib/hcroi/trend';
	import { periodLabel, periodShortLabel } from '$lib/hcroi/period';
	import { PERIOD_TYPE_LABELS, type PeriodType } from '$lib/hcroi/types';
	import {
		columnUnitSuffix,
		formatCellAmount,
		hintAmountUnit,
		formatHeadcount,
		headcountBasisLabel,
		derivedLabel,
		formatAmount,
		formatKrwCompact,
		formatMultiple,
		formatPct,
		formatSigned,
		multipleToPct
	} from '$lib/hcroi/format';
	import NumberField from '$lib/components/ui/NumberField.svelte';
	import StatTile from '$lib/components/ui/StatTile.svelte';
	import GradeBadge from '$lib/components/ui/GradeBadge.svelte';
	import InsightList from '$lib/components/ui/InsightList.svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';

	// 금액 표기는 작업공간의 표시 단위를 따른다 (저장값은 언제나 원 단위 정수). 규칙은 format.ts 한 곳
	const won = (v: number | null | undefined, suffix = '원') =>
		formatAmount(v, workspace.amountUnit, suffix);
	const cellWon = (v: number | null | undefined) => formatCellAmount(v, workspace.amountUnit);
	const colUnit = $derived(columnUnitSuffix(workspace.amountUnit));
	const hintUnit = $derived(hintAmountUnit(workspace.amountUnit));
	/** 임직원 수 산정 기준 한 줄 표기 — 인원 관련 입력·지표에 함께 붙인다 */
	const basisLabel = $derived(headcountBasisLabel(workspace.headcountBasis));

	/**
	 * 소개 페이지 "가상 회사 샘플 열어 보기" 진입점(`/?start=sample`).
	 * `workspace.loaded` 가 켜진 뒤(레이아웃 onMount 가 localStorage 를 읽은 뒤) 한 번만 처리한다 —
	 * 이 페이지의 $effect 는 레이아웃보다 먼저 실행될 수 있어 로드 전 상태(샘플 기본값)만 보일 수 있다.
	 * `routerReady` 도 함께 기다린다 — 하이드레이션 중 첫 $effect 는 SvelteKit 라우터 초기화보다 먼저
	 * 돌 수 있고, 그때 `replaceState` 를 부르면 예외가 나면서 **하이드레이션 전체가 멈춘다**
	 * (화면이 SSR 상태로 굳어 시작 경로가 통째로 안 먹는다). `afterNavigate` 는 라우터 초기화 뒤
	 * 첫 진입(type 'enter')에도 불리므로 이 플래그가 안전 신호가 된다.
	 */
	let routerReady = $state(false);
	afterNavigate(() => {
		routerReady = true;
	});
	let startHandled = false;
	$effect(() => {
		if (!workspace.loaded || !routerReady || startHandled) return;
		startHandled = true;
		const params = new URLSearchParams(window.location.search);
		if (params.get('start') !== 'sample') return;
		if (workspace.records.length === 0) {
			workspace.resetToSample();
		} else if (
			!workspace.isSampleOnly() &&
			confirm('현재 데이터를 가상 회사 샘플로 바꿀까요? (먼저 설정에서 백업하세요)')
		) {
			workspace.resetToSample();
		}
		// 처리 후 쿼리를 지워 새로고침 시 반복되지 않게 한다
		replaceState(resolve('/'), {});
	});

	let selectedId = $state<string | null>(null);
	/** 조회 중인 기간 레코드 (연간·반기·분기·월 중 하나, 하위 기간에서 합산된 것 포함) */
	const rec = $derived(workspace.effective.find((y) => y.id === selectedId) ?? workspace.latest);
	/** 직접 입력한 값이 하위 기간 합산과 다른 항목 (값은 직접 입력이 우선) */
	const mismatch = $derived(rec ? workspace.mismatchOf(rec) : []);
	function editDerived() {
		if (!rec?.derived) return;
		const m = workspace.materialize(rec.id);
		if (m) selectedId = m.id;
	}
	const metrics = $derived(rec ? computeMetrics(rec.inputs) : null);
	const diag = $derived(diagnose(metrics?.hcroi ?? null));
	const errors = $derived(rec ? validateRecord(rec) : []);
	/** 어느 입력 칸이 오류에 걸렸는지 — 칸에는 붉은 테두리만, 문구는 아래 안내 상자에서 한 번만 */
	const fieldInvalid = $derived.by(() => {
		const has = (...needles: string[]) => errors.some((e) => needles.some((n) => e.startsWith(n)));
		return {
			revenue: has('매출액'),
			operatingCost: has('영업비용', '총 인건비가 영업비용보다'),
			hcCost: has('총 인건비', '인건비 세부'),
			headcount: has('총 임직원 수')
		};
	});
	/**
	 * 입력 칸 → 레코드. `rec` 은 $derived 라 프로퍼티를 직접 `bind:` 하면 Svelte 가
	 * `binding_property_non_reactive` 를 경고한다 — get/set 쌍으로 쓴다.
	 * 값을 고치면 "복사됨 · 확인 필요" 표시도 함께 풀린다.
	 */
	function setInput(k: 'revenue' | 'operatingCost' | 'hcCost' | 'headcount', v: number) {
		if (!rec || rec.derived) return;
		rec.inputs[k] = v;
		workspace.markEdited(rec.id);
	}

	/** 전기 = 같은 유형의 바로 앞 기간 (연간이면 전년, 분기면 직전 분기) */
	const prev = $derived(rec ? workspace.previousOf(rec) : null);
	const prevMetrics = $derived(prev ? computeMetrics(prev.inputs) : null);
	/** 전년 동기 — 반기·분기의 계절성 비교용 (연간은 전기와 같아 표시하지 않는다) */
	const yearAgo = $derived(rec && rec.period.type !== 'Y' ? workspace.yearAgoOf(rec) : null);
	const yearAgoMetrics = $derived(yearAgo ? computeMetrics(yearAgo.inputs) : null);

	/**
	 * 추이(차트·표·인사이트)의 본체는 한 유형 — 분기와 연간 금액을 한 줄에 섞어 비교하지 않는다.
	 * 기본은 조회 중인 기간의 유형, 유형이 둘 이상이면 셀렉트로 바꿀 수 있다.
	 * 다개년 표시 규칙(`trend.ts`): 반기·분기·월 추이에서 그 유형 자료가 없는 해는 연간 값을 **참조점**으로 같은 축에 올리고,
	 * 표시 범위는 "최근 N년"(유형별 기본값, 바꿀 수 있음). 참조점은 HCROI 라인과 표에만 — 금액 막대·인사이트는 본체만.
	 */
	let trendTypeChoice = $state<PeriodType | null>(null);
	const trendType = $derived<PeriodType>(
		trendTypeChoice && workspace.periodTypes.includes(trendTypeChoice)
			? trendTypeChoice
			: (rec?.period.type ?? 'Y')
	);
	let trendRangeChoice = $state<TrendRange | null>(null);
	const trendRange = $derived<TrendRange>(trendRangeChoice ?? defaultTrendRange(trendType));
	// 추이·인사이트는 검증을 통과한 레코드만 (오류 레코드는 지표에서 제외 — 2026-09-15)
	const trendPoints = $derived(trendSeries(workspace.validEffective, trendType, trendRange));
	/** 본체 유형만 — 금액 누적 막대·추이 인사이트 (표·라인은 참조점까지 `seriesRows`) */
	const ownSeries = $derived(trendPoints.filter((p) => !p.reference).map((p) => p.record));
	const refYears = $derived(referenceYears(trendPoints));
	const refYearsText = $derived(refYears.map((y) => `${y}년`).join('·'));
	const trendTitle = $derived(PERIOD_TYPE_LABELS[trendType]);

	/** 영업비용 ↔ 영업이익 입력 모드 */
	let costMode = $state<'cost' | 'profit'>('cost');

	/**
	 * 타일의 증감 표기. `neutral` 이면 빨강/초록 대신 회색 — 총 임직원 수처럼 증감 자체에
	 * 좋고 나쁨이 없는 값에 쓴다(2026-09-15 결정). 금액·이익 계열은 지금 색을 그대로 둔다.
	 */
	function delta(
		cur: number | null | undefined,
		before: number | null | undefined,
		fmt: (n: number) => string,
		goodWhenUp = true,
		neutral = false
	) {
		if (cur == null || before == null) return null;
		const d = cur - before;
		return {
			text: `${formatSigned(d, fmt)} vs ${prev ? periodLabel(prev.period) : '—'}`,
			direction:
				Math.abs(d) < 1e-9 ? ('flat' as const) : d > 0 ? ('up' as const) : ('down' as const),
			goodWhenUp,
			neutral
		};
	}

	// 차트·표·인사이트가 같은 계산 결과를 쓴다 (키 입력마다 시리즈 전체를 네 번 계산하지 않도록)
	const seriesRows = $derived(
		trendPoints.map((p) => ({ y: p.record, m: computeMetrics(p.record.inputs), ref: p.reference }))
	);
	const linePoints = $derived(
		seriesRows.map(({ y, m, ref }) => ({
			label: ref ? `${y.period.year} 연간` : periodShortLabel(y.period),
			value: m.hcroi,
			reference: ref,
			note: ref ? `${trendTitle} 자료가 없어 연간 값으로 표시` : undefined
		}))
	);
	const ownRows = $derived(seriesRows.filter((r) => !r.ref));
	const stackSeries = [
		{ key: 'hc', label: '총 인건비', color: 'var(--color-series-1)' },
		{ key: 'nonhc', label: '비인건비 영업비용', color: 'var(--color-series-4)' },
		{ key: 'op', label: '영업이익', color: 'var(--color-series-3)' }
	];
	const stackValues = $derived(
		ownRows.map(({ y, m }) => [y.inputs.hcCost, m.nonHcCost, m.operatingProfit])
	);
	const thresholds = [
		{ value: 1.0, label: '보통 1.0' },
		{ value: 1.5, label: '우수 1.5' }
	];
	const trend = $derived(trendInsights(ownSeries));
	const oneDecimalBil = (v: number) => (v === 0 ? '0억' : formatKrwCompact(v, ''));

	// 대시보드 제목 — 회사/조직 이름은 헤더 로고 자리에서 편집한다(+layout.svelte). 저장은 workspace.orgName 한 곳
	const pageTitle = $derived(workspace.pageTitle());
	/** 아직 가상 회사 샘플뿐인가 — 제목 옆 "샘플 데이터" 칩의 근거 */
	const isSampleOnly = $derived(workspace.records.length > 0 && workspace.isSampleOnly());

	/** 지표 표가 가로로 더 스크롤될 수 있는지 (데이터 화면 표와 같은 방식 — 끝에 닿으면 안내를 숨긴다) */
	let tableScroll = $state<HTMLElement | null>(null);
	let canScrollRight = $state(false);
	function updateScrollHint() {
		const el = tableScroll;
		canScrollRight = !!el && el.scrollWidth - el.clientWidth - el.scrollLeft > 4;
	}
	$effect(() => {
		// 표 내용·표시 단위가 바뀌면 다시 잰다
		void seriesRows;
		void colUnit;
		updateScrollHint();
	});
</script>

<svelte:head><title>{pageTitle}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
			<h1 class="text-2xl font-bold text-ink">{pageTitle}</h1>
			{#if isSampleOnly}
				<span
					class="rounded bg-status-warning-bg px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-status-warning-ink"
					>샘플 데이터</span
				>
				<a href={resolve('/data')} class="text-sm font-medium text-brand-ink hover:underline"
					>데이터 화면에서 자사 실적으로 교체 →</a
				>
			{/if}
		</div>
		<p class="mt-1 text-[15px] text-ink-2">
			재무·HR 데이터를 입력하면 인적자본 투자효율 지표가 실시간으로 산출됩니다. 회사 이름은 상단의
			회사 이름을 눌러 바꿉니다.
		</p>
	</div>
	{#if workspace.records.length}
		<label class="flex items-center gap-2 text-sm font-semibold text-ink-2">
			조회 기간
			<select
				class="field-input w-auto py-1.5"
				value={rec?.id ?? ''}
				onchange={(e) => (selectedId = (e.currentTarget as HTMLSelectElement).value || null)}
			>
				{#each workspace.effective as y (y.id)}
					<option value={y.id}>{periodLabel(y.period)}{y.derived ? ' · 합산' : ''}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

{#if !rec || !metrics}
	<div class="card px-6 py-12 text-center">
		<p class="text-ink-2">아직 입력된 데이터가 없습니다.</p>
		<div class="mt-4 flex justify-center gap-2">
			<a href={resolve('/data')} class="btn btn-primary">데이터 입력하기</a>
			<button type="button" class="btn btn-secondary" onclick={() => workspace.resetToSample()}
				>샘플 데이터로 시작</button
			>
		</div>
	</div>
{:else}
	<div class="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
		<!-- 입력 -->
		<section class="card h-fit px-5 py-5" aria-labelledby="input-h">
			<div class="mb-4 flex items-center justify-between">
				<h2 id="input-h" class="text-lg font-semibold text-ink">
					{periodLabel(rec.period)} 기준 데이터
				</h2>
				<a href={resolve('/data')} class="text-sm font-medium text-brand-ink hover:underline"
					>세부 관리 →</a
				>
			</div>
			{#if rec.derived}
				<p class="mb-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2">
					<strong class="text-ink">{derivedLabel(rec.derived)}</strong> — 하위 기간에서 계산된
					값이라 여기서는 고칠 수 없습니다. 개별 기간을 데이터 관리에서 수정하거나,
					<button type="button" class="font-semibold text-brand-ink underline" onclick={editDerived}
						>직접 입력으로 전환</button
					>하세요.
				</p>
			{/if}
			<div class="space-y-4">
				<NumberField
					{hintUnit}
					label="매출액"
					bind:value={() => rec.inputs.revenue, (v) => setInput('revenue', v)}
					min={0}
					invalid={fieldInvalid.revenue}
					readonly={!!rec.derived}
				/>
				<div>
					<div class="mb-1.5 flex items-center justify-between">
						<span class="text-sm font-semibold text-ink-2">비용 입력 방식</span>
						<div
							class="inline-flex rounded-md border border-line-2 p-0.5 text-sm"
							role="group"
							aria-label="비용 입력 방식"
						>
							<button
								type="button"
								class="rounded px-2.5 py-0.5 font-medium {costMode === 'cost'
									? 'bg-brand text-on-brand'
									: 'text-ink-2'}"
								aria-pressed={costMode === 'cost'}
								onclick={() => (costMode = 'cost')}>영업비용</button
							>
							<button
								type="button"
								class="rounded px-2.5 py-0.5 font-medium {costMode === 'profit'
									? 'bg-brand text-on-brand'
									: 'text-ink-2'}"
								aria-pressed={costMode === 'profit'}
								onclick={() => (costMode = 'profit')}>영업이익</button
							>
						</div>
					</div>
					{#if costMode === 'cost'}
						<NumberField
							{hintUnit}
							label="영업비용 (인건비 포함)"
							bind:value={() => rec.inputs.operatingCost, (v) => setInput('operatingCost', v)}
							min={0}
							invalid={fieldInvalid.operatingCost}
							readonly={!!rec.derived}
							help="영업이익 {won(metrics.operatingProfit)}"
						/>
					{:else}
						<NumberField
							{hintUnit}
							label="영업이익"
							bind:value={
								() => rec.inputs.revenue - rec.inputs.operatingCost,
								(v) => setInput('operatingCost', rec.inputs.revenue - v)
							}
							readonly={!!rec.derived}
							help="영업비용 {won(rec.inputs.operatingCost)}"
						/>
					{/if}
				</div>
				<NumberField
					{hintUnit}
					label="총 인건비"
					bind:value={() => rec.inputs.hcCost, (v) => setInput('hcCost', v)}
					min={0}
					invalid={fieldInvalid.hcCost}
					readonly={!!rec.derived}
					help={rec.breakdown
						? `세부 합계 ${won(sumHcCost(rec.breakdown))}${
								rec.inputs.hcCost - sumHcCost(rec.breakdown) > 0
									? ` · 미분류 ${won(rec.inputs.hcCost - sumHcCost(rec.breakdown))}`
									: ''
							} (세부는 데이터 관리에서 수정)`
						: '기본급+성과급/수당+퇴직급여+법정후생비+기타 복리후생비+교육훈련비'}
				/>
				<NumberField
					{hintUnit}
					label="총 임직원 수"
					bind:value={() => rec.inputs.headcount, (v) => setInput('headcount', v)}
					unit="명"
					min={1}
					invalid={fieldInvalid.headcount}
					readonly={!!rec.headcountBreakdown || !!rec.derived}
					help={rec.headcountBreakdown
						? `인원 구분 합계 · ${basisLabel} (데이터 관리에서 수정)`
						: basisLabel}
				/>
			</div>
			{#if errors.length}
				<ul
					class="mt-4 space-y-1 rounded-md border border-status-critical/40 bg-status-critical-bg px-4 py-3 text-sm text-status-critical-ink"
					role="alert"
				>
					{#each errors as e (e)}<li>{e}</li>{/each}
				</ul>
			{/if}
			{#if mismatch.length}
				<div
					class="mt-4 rounded-md border border-status-warning/40 bg-status-warning-bg px-4 py-3 text-sm text-status-warning-ink"
				>
					<p class="font-semibold">
						직접 입력한 값이 하위 기간 합산과 다릅니다 (직접 입력을 씁니다)
					</p>
					<ul class="mt-1 space-y-0.5">
						{#each mismatch as m (m.field)}
							<li>
								{m.label}: 입력 {m.field === 'headcount'
									? formatHeadcount(m.manual)
									: won(m.manual)} · 합산 {m.field === 'headcount'
									? formatHeadcount(m.derived)
									: won(m.derived)}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>

		<!-- 지표 -->
		<div class="space-y-4">
			{#if errors.length}
				<!--
				  검증 오류 레코드는 지표·등급·추이·시나리오·리포트에서 제외한다 (2026-09-15).
				  저장은 그대로 두되(초안 허용) 여기서는 등급 대신 "어디를 고쳐야 하는지"만 보여 준다.
				-->
				<section
					class="card border-status-critical/40 px-6 py-8"
					aria-labelledby="invalid-h"
					role="alert"
				>
					<h2 id="invalid-h" class="text-lg font-semibold text-status-critical-ink">
						입력 오류 — 데이터 화면에서 수정
					</h2>
					<p class="mt-1 text-[15px] text-ink-2">
						{periodLabel(rec.period)} 입력값에 오류가 있어 HCROI·등급·인사이트를 내지 않습니다. 이 기간은
						추이·시뮬레이터·리포트에서도 빠집니다.
					</p>
					<ul class="mt-3 space-y-1 text-[15px] text-status-critical-ink">
						{#each errors as e (e)}<li>· {e}</li>{/each}
					</ul>
					<a href={resolve('/data')} class="mt-5 btn inline-flex btn-primary"
						>데이터 화면에서 수정 →</a
					>
				</section>
			{:else}
				{#if rec.copiedFrom}
					<p
						class="rounded-md border border-status-warning/40 bg-status-warning-bg px-4 py-2 text-sm text-status-warning-ink"
						role="status"
					>
						<strong>복사됨 · 확인 필요</strong> — {periodLabel(rec.period)} 값은
						{periodLabel(rec.copiedFrom)} 에서 복사해 온 그대로입니다. 실적으로 바꾸기 전까지 지표를 그대로
						믿지 마세요.
						<a href={resolve('/data')} class="font-semibold underline">데이터 화면에서 입력 →</a>
					</p>
				{/if}
				<section class="card px-6 py-5" aria-labelledby="hcroi-h">
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div>
							<h2 id="hcroi-h" class="text-sm font-medium text-ink-2">
								HCROI (인적자본 투자수익률)
							</h2>
							<div class="mt-1 flex flex-wrap items-baseline gap-x-3">
								<span class="tabular text-5xl font-semibold tracking-tight text-ink"
									>{formatMultiple(metrics.hcroi)}</span
								>
								<span class="text-base text-muted">= {multipleToPct(metrics.hcroi)}</span>
							</div>
							{#if prevMetrics}
								{@const d = delta(metrics.hcroi, prevMetrics.hcroi, formatMultiple)}
								{#if d}
									<div
										class="mt-1 text-sm font-medium {d.direction === 'flat'
											? 'text-muted'
											: d.direction === 'up'
												? 'text-status-good-ink'
												: 'text-status-critical-ink'}"
									>
										{d.text}
									</div>
								{/if}
							{/if}
							{#if yearAgo && yearAgoMetrics && yearAgoMetrics.hcroi !== null && metrics.hcroi !== null}
								<!-- 반기·분기는 계절성이 있어 직전 기간보다 전년 동기가 더 공정한 비교다 -->
								<div class="mt-0.5 text-sm text-muted">
									{formatSigned(metrics.hcroi - yearAgoMetrics.hcroi, formatMultiple)} vs 전년 동기({periodLabel(
										yearAgo.period
									)})
								</div>
							{/if}
						</div>
						<GradeBadge grade={gradeOf(metrics.hcroi)} size="lg" />
					</div>
					<p class="mt-3 text-[15px] leading-relaxed text-ink-2">
						{diag?.summary ?? '총 인건비가 0이어서 HCROI 를 계산할 수 없습니다.'}
					</p>
					<p class="tabular mt-2 text-sm text-muted">
						산식: (영업이익 {won(metrics.operatingProfit)} + 총 인건비 {won(rec.inputs.hcCost)}) ÷
						총 인건비 {won(rec.inputs.hcCost)}
					</p>
				</section>

				<div class="grid gap-4 sm:grid-cols-3">
					<StatTile
						label="HCVA (인당 부가가치)"
						value={won(metrics.hcva)}
						sub="/인"
						delta={delta(metrics.hcva, prevMetrics?.hcva, (n) => won(n))}
					/>
					<StatTile
						label="인당 매출액"
						value={won(metrics.revenuePerHead)}
						sub="/인"
						delta={delta(metrics.revenuePerHead, prevMetrics?.revenuePerHead, (n) => won(n))}
					/>
					<StatTile
						label="인당 인건비"
						value={won(metrics.hcCostPerHead)}
						sub="/인"
						delta={delta(metrics.hcCostPerHead, prevMetrics?.hcCostPerHead, (n) => won(n), false)}
					/>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					<StatTile
						label="영업이익"
						value={won(metrics.operatingProfit)}
						delta={delta(metrics.operatingProfit, prevMetrics?.operatingProfit, (n) => won(n))}
					/>
					<StatTile
						label="영업이익률"
						value={formatPct(metrics.operatingMargin)}
						delta={delta(
							metrics.operatingMargin,
							prevMetrics?.operatingMargin,
							(n) => `${n.toFixed(1)}%p`
						)}
					/>
					<StatTile
						label="매출 대비 인건비율"
						value={formatPct(metrics.hcCostToRevenue)}
						delta={delta(
							metrics.hcCostToRevenue,
							prevMetrics?.hcCostToRevenue,
							(n) => `${n.toFixed(1)}%p`,
							false
						)}
					/>
					<StatTile
						label="총 임직원 수"
						value={formatHeadcount(rec.inputs.headcount)}
						delta={delta(rec.inputs.headcount, prev?.inputs.headcount, (n) => `${n}명`, true, true)}
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- 차트 -->
	<div class="mt-6 grid gap-6 xl:grid-cols-2">
		<section class="card px-5 py-4" aria-labelledby="line-h">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 id="line-h" class="text-base font-semibold text-ink">{trendTitle} HCROI 추이</h2>
				<div class="flex flex-wrap items-center gap-3">
					{#if workspace.periodTypes.length > 1}
						<label class="flex items-center gap-1.5 text-xs text-ink-2">
							추이 단위
							<select
								class="field-input w-auto py-0.5 text-xs"
								value={trendType}
								onchange={(e) => {
									trendTypeChoice = (e.currentTarget as HTMLSelectElement).value as PeriodType;
									trendRangeChoice = null; // 단위를 바꾸면 그 단위의 기본 범위로
								}}
							>
								{#each workspace.periodTypes as t (t)}
									<option value={t}>{PERIOD_TYPE_LABELS[t]}</option>
								{/each}
							</select>
						</label>
					{/if}
					<label class="flex items-center gap-1.5 text-xs text-ink-2">
						표시 범위
						<select
							class="field-input w-auto py-0.5 text-xs"
							value={String(trendRange)}
							onchange={(e) => {
								const v = (e.currentTarget as HTMLSelectElement).value;
								trendRangeChoice = v === 'all' ? 'all' : (Number(v) as TrendRange);
							}}
						>
							{#each TREND_RANGES as r (r.value)}
								<option value={String(r.value)}>{r.label}</option>
							{/each}
						</select>
					</label>
				</div>
			</div>
			<p class="mb-2 text-sm text-muted">
				배수 · 가로선은 등급 기준선{trendType === 'Y' ? '' : ' · 각 기간 실적 기준(연율화 안 함)'}
				{#if refYears.length > 0}
					· 속 빈 점({refYearsText})은 {trendTitle} 자료가 없어 <strong>연간 값</strong>으로 표시
				{/if}
			</p>
			<LineChart
				points={linePoints}
				format={(v) => v.toFixed(2)}
				{thresholds}
				ariaLabel="{trendTitle} HCROI 추이 라인 차트"
			/>
		</section>
		<section class="card px-5 py-4" aria-labelledby="stack-h">
			<h2 id="stack-h" class="text-base font-semibold text-ink">인건비 vs 영업이익 비중</h2>
			<p class="mb-2 text-sm text-muted">
				매출액 구성 (억원) — 총 인건비 + 비인건비 영업비용 + 영업이익 = 매출액
				{#if refYears.length > 0}
					· {refYearsText}은 연간 금액이라 {trendTitle} 막대와 섞지 않음(연간 추이에서 확인)
				{/if}
			</p>
			<StackedBarChart
				categories={ownRows.map(({ y }) => periodShortLabel(y.period))}
				series={stackSeries}
				values={stackValues}
				format={oneDecimalBil}
				totalLabel="매출액"
				ariaLabel="{trendTitle} 인건비·비인건비·영업이익 누적 막대 차트"
			/>
		</section>
	</div>

	<!-- 추이 인사이트 + 표 -->
	<div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)]">
		<section aria-labelledby="trend-h">
			<h2 id="trend-h" class="mb-3 text-lg font-semibold text-ink">추이 인사이트</h2>
			<InsightList
				insights={trend}
				emptyText="같은 단위({trendTitle})의 기간이 2개 이상 있으면 추이 인사이트가 표시됩니다."
			/>
		</section>
		<section class="card overflow-hidden" aria-labelledby="table-h">
			<div class="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 pb-2">
				<h2 id="table-h" class="text-lg font-semibold text-ink">{trendTitle} 지표 표</h2>
				{#if canScrollRight}
					<p class="text-[11px] whitespace-nowrap text-muted" aria-hidden="true">옆으로 넘기기 →</p>
				{/if}
			</div>
			<div class="overflow-x-auto" bind:this={tableScroll} onscroll={updateScrollHint}>
				<table class="w-full min-w-[600px] text-[15px]">
					<thead>
						<tr class="border-y border-line bg-surface-2 text-left text-sm text-ink-2">
							<th scope="col" class="px-4 py-2 font-semibold">기간</th>
							<th scope="col" class="px-2.5 py-2 text-right font-semibold">매출액{colUnit}</th>
							<th scope="col" class="px-2.5 py-2 text-right font-semibold">영업이익{colUnit}</th>
							<th scope="col" class="px-2.5 py-2 text-right font-semibold">총 인건비{colUnit}</th>
							<th scope="col" class="px-2.5 py-2 text-right font-semibold">인원</th>
							<th scope="col" class="px-2.5 py-2 text-right font-semibold">HCROI</th>
							<th scope="col" class="px-2.5 py-2 text-right font-semibold">HCVA{colUnit}</th>
						</tr>
					</thead>
					<tbody>
						{#each seriesRows as { y, m, ref } (y.id)}
							<tr
								class="border-b border-line last:border-0 {y.id === rec.id
									? 'bg-brand-tint/60'
									: ''} {ref ? 'text-muted' : ''}"
							>
								<th scope="row" class="px-4 py-2 text-left font-semibold whitespace-nowrap text-ink"
									>{periodLabel(y.period)}{#if ref}<span
											class="ml-1 text-xs font-normal text-muted"
											title="{trendTitle} 자료가 없는 해 — 연간 값(참조)">연간 참조</span
										>{/if}{#if y.derived}<span
											class="ml-1 text-xs font-normal text-muted"
											title={derivedLabel(y.derived)}>합산</span
										>{/if}</th
								>
								<td class="tabular px-2.5 py-2 text-right">{cellWon(y.inputs.revenue)}</td>
								<td class="tabular px-2.5 py-2 text-right">{cellWon(m.operatingProfit)}</td>
								<td class="tabular px-2.5 py-2 text-right">{cellWon(y.inputs.hcCost)}</td>
								<td class="tabular px-2.5 py-2 text-right">{formatHeadcount(y.inputs.headcount)}</td
								>
								<td class="tabular px-2.5 py-2 text-right font-semibold"
									>{formatMultiple(m.hcroi)}</td
								>
								<td class="tabular px-2.5 py-2 text-right">{cellWon(m.hcva)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>

	<div class="mt-8 flex justify-end">
		<a href={resolve('/simulator')} class="btn btn-primary">이 데이터로 시나리오 시뮬레이션 →</a>
	</div>
{/if}
