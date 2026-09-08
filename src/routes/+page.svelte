<script lang="ts">
	import { resolve } from '$app/paths';
	import { workspace } from '$lib/state/workspace.svelte';
	import { computeMetrics, diagnose, gradeOf, validateInputs } from '$lib/hcroi/formulas';
	import { trendInsights } from '$lib/hcroi/insights';
	import { periodLabel, periodShortLabel } from '$lib/hcroi/period';
	import { PERIOD_TYPE_LABELS, type PeriodType } from '$lib/hcroi/types';
	import {
		amountUnitLabel,
		formatHeadcount,
		headcountBasisLabel,
		formatAmount,
		formatAmountBare,
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

	/** 금액 표기 — 작업공간의 표시 단위 설정을 따른다 (저장값은 언제나 원 단위 정수) */
	const won = (v: number | null | undefined, suffix = '원') =>
		formatAmount(v, workspace.amountUnit, suffix);

	/** 임직원 수 산정 기준 한 줄 표기 — 인원 관련 입력·지표에 함께 붙인다 */
	const basisLabel = $derived(headcountBasisLabel(workspace.headcountBasis));
	/** 표 칸용 금액 — 고정 단위를 고르면 단위는 열 머리글이 밝히고 칸에는 숫자만 둔다 */
	const cellWon = (v: number | null | undefined) =>
		workspace.amountUnit === 'auto' ? won(v) : formatAmountBare(v, workspace.amountUnit);
	/** 열 머리글에 붙일 단위 — 자동 축약일 때는 붙이지 않는다 */
	const colUnit = $derived(
		workspace.amountUnit === 'auto' ? '' : ` (${amountUnitLabel(workspace.amountUnit)})`
	);

	let selectedId = $state<string | null>(null);
	/** 조회 중인 기간 레코드 (연간·반기·분기 중 하나) */
	const year = $derived(workspace.records.find((y) => y.id === selectedId) ?? workspace.latest);
	const metrics = $derived(year ? computeMetrics(year.inputs) : null);
	const diag = $derived(diagnose(metrics?.hcroi ?? null));
	const errors = $derived(year ? validateInputs(year.inputs) : []);

	/** 전기 = 같은 유형의 바로 앞 기간 (연간이면 전년, 분기면 직전 분기) */
	const prev = $derived(year ? workspace.previousOf(year) : null);
	const prevMetrics = $derived(prev ? computeMetrics(prev.inputs) : null);
	/** 전년 동기 — 반기·분기의 계절성 비교용 (연간은 전기와 같아 표시하지 않는다) */
	const yearAgo = $derived(year && year.period.type !== 'Y' ? workspace.yearAgoOf(year) : null);
	const yearAgoMetrics = $derived(yearAgo ? computeMetrics(yearAgo.inputs) : null);

	/**
	 * 추이(차트·표·인사이트)는 한 유형만 본다 — 분기와 연간을 한 줄에 섞으면 비교가 안 된다.
	 * 기본은 조회 중인 기간의 유형, 유형이 둘 이상이면 셀렉트로 바꿀 수 있다.
	 */
	let trendTypeChoice = $state<PeriodType | null>(null);
	const trendType = $derived<PeriodType>(
		trendTypeChoice && workspace.periodTypes.includes(trendTypeChoice)
			? trendTypeChoice
			: (year?.period.type ?? 'Y')
	);
	const series = $derived(workspace.ofType(trendType));
	const trendTitle = $derived(PERIOD_TYPE_LABELS[trendType]);

	/** 영업비용 ↔ 영업이익 입력 모드 */
	let costMode = $state<'cost' | 'profit'>('cost');

	function delta(
		cur: number | null | undefined,
		before: number | null | undefined,
		fmt: (n: number) => string,
		goodWhenUp = true
	) {
		if (cur == null || before == null) return null;
		const d = cur - before;
		return {
			text: `${formatSigned(d, fmt)} vs ${prev ? periodLabel(prev.period) : '—'}`,
			direction:
				Math.abs(d) < 1e-9 ? ('flat' as const) : d > 0 ? ('up' as const) : ('down' as const),
			goodWhenUp
		};
	}

	// 차트 데이터
	const linePoints = $derived(
		series.map((y) => ({
			label: periodShortLabel(y.period),
			value: computeMetrics(y.inputs).hcroi
		}))
	);
	const stackSeries = [
		{ key: 'hc', label: '총 인건비', color: 'var(--color-series-1)' },
		{ key: 'nonhc', label: '비인건비 영업비용', color: 'var(--color-series-4)' },
		{ key: 'op', label: '영업이익', color: 'var(--color-series-3)' }
	];
	const stackValues = $derived(
		series.map((y) => {
			const m = computeMetrics(y.inputs);
			return [y.inputs.hcCost, m.nonHcCost, m.operatingProfit];
		})
	);
	const thresholds = [
		{ value: 1.0, label: '보통 1.0' },
		{ value: 1.5, label: '우수 1.5' }
	];
	const trend = $derived(trendInsights(series));
	const oneDecimalBil = (v: number) => (v === 0 ? '0억' : formatKrwCompact(v, ''));

	// 대시보드 제목 커스터마이징 — 회사/조직 이름은 localStorage 작업공간에만 저장 (서버 전송 없음)
	let editingTitle = $state(false);
	const pageTitle = $derived(
		workspace.orgName.trim() ? `${workspace.orgName.trim()} HCROI 대시보드` : 'HCROI 대시보드'
	);
</script>

<svelte:head><title>{pageTitle}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="flex items-center gap-2 text-2xl font-bold text-ink">
			{pageTitle}
			<button
				type="button"
				class="btn p-1.5 btn-ghost text-muted hover:text-ink"
				aria-label="대시보드 제목 수정"
				title="회사/조직 이름 넣기"
				onclick={() => (editingTitle = !editingTitle)}
			>
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg
				>
			</button>
		</h1>
		{#if editingTitle}
			<form
				class="mt-2 flex items-center gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					editingTitle = false;
				}}
			>
				<input
					class="field-input w-64 py-1.5"
					placeholder="회사/조직 이름 (비우면 기본 제목)"
					bind:value={workspace.orgName}
				/>
				<button type="submit" class="btn py-1.5 btn-primary">확인</button>
			</form>
			<p class="mt-1 text-xs text-muted">이 브라우저에만 저장되며 서버로 전송되지 않습니다.</p>
		{:else}
			<p class="mt-1 text-[15px] text-ink-2">
				재무·HR 데이터를 입력하면 인적자본 투자효율 지표가 실시간으로 산출됩니다.
			</p>
		{/if}
	</div>
	{#if workspace.records.length}
		<label class="flex items-center gap-2 text-sm font-semibold text-ink-2">
			조회 기간
			<select
				class="field-input w-auto py-1.5"
				value={year?.id ?? ''}
				onchange={(e) => (selectedId = (e.currentTarget as HTMLSelectElement).value || null)}
			>
				{#each workspace.sorted as y (y.id)}
					<option value={y.id}>{periodLabel(y.period)}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

{#if !year || !metrics}
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
					{periodLabel(year.period)} 기준 데이터
				</h2>
				<a href={resolve('/data')} class="text-sm font-medium text-brand-ink hover:underline"
					>세부 관리 →</a
				>
			</div>
			<div class="space-y-4">
				<NumberField label="매출액" bind:value={year.inputs.revenue} min={0} />
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
									? 'bg-brand text-white'
									: 'text-ink-2'}"
								aria-pressed={costMode === 'cost'}
								onclick={() => (costMode = 'cost')}>영업비용</button
							>
							<button
								type="button"
								class="rounded px-2.5 py-0.5 font-medium {costMode === 'profit'
									? 'bg-brand text-white'
									: 'text-ink-2'}"
								aria-pressed={costMode === 'profit'}
								onclick={() => (costMode = 'profit')}>영업이익</button
							>
						</div>
					</div>
					{#if costMode === 'cost'}
						<NumberField
							label="영업비용 (인건비 포함)"
							bind:value={year.inputs.operatingCost}
							min={0}
							help="영업이익 {won(metrics.operatingProfit)}"
						/>
					{:else}
						<NumberField
							label="영업이익"
							bind:value={
								() => year.inputs.revenue - year.inputs.operatingCost,
								(v) => (year.inputs.operatingCost = year.inputs.revenue - v)
							}
							help="영업비용 {won(year.inputs.operatingCost)}"
						/>
					{/if}
				</div>
				<NumberField
					label="총 인건비"
					bind:value={year.inputs.hcCost}
					min={0}
					readonly={!!year.breakdown}
					help={year.breakdown
						? '세부 내역 합계 (데이터 관리에서 수정)'
						: '기본급+성과급/수당+퇴직급여+법정후생비+기타 복리후생비+교육훈련비'}
				/>
				<NumberField
					label="총 임직원 수"
					bind:value={year.inputs.headcount}
					unit="명"
					min={1}
					readonly={!!year.headcountBreakdown}
					help={year.headcountBreakdown
						? `인원 구분 합계 · ${basisLabel} (데이터 관리에서 수정)`
						: basisLabel}
				/>
			</div>
			{#if errors.length}
				<ul
					class="mt-4 space-y-1 rounded-md border border-status-critical/40 bg-status-critical-bg px-4 py-3 text-sm text-status-critical-ink"
				>
					{#each errors as e (e)}<li>{e}</li>{/each}
				</ul>
			{/if}
		</section>

		<!-- 지표 -->
		<div class="space-y-4">
			<section class="card px-6 py-5" aria-labelledby="hcroi-h">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h2 id="hcroi-h" class="text-sm font-medium text-ink-2">HCROI (인적자본 투자수익률)</h2>
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
					산식: (영업이익 {won(metrics.operatingProfit)} + 총 인건비 {won(year.inputs.hcCost)}) ÷ 총
					인건비 {won(year.inputs.hcCost)}
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
					value={formatHeadcount(year.inputs.headcount)}
					delta={delta(year.inputs.headcount, prev?.inputs.headcount, (n) => `${n}명`)}
				/>
			</div>
		</div>
	</div>

	<!-- 차트 -->
	<div class="mt-6 grid gap-6 xl:grid-cols-2">
		<section class="card px-5 py-4" aria-labelledby="line-h">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 id="line-h" class="text-base font-semibold text-ink">{trendTitle} HCROI 추이</h2>
				{#if workspace.periodTypes.length > 1}
					<label class="flex items-center gap-1.5 text-xs text-ink-2">
						추이 단위
						<select
							class="field-input w-auto py-0.5 text-xs"
							value={trendType}
							onchange={(e) =>
								(trendTypeChoice = (e.currentTarget as HTMLSelectElement).value as PeriodType)}
						>
							{#each workspace.periodTypes as t (t)}
								<option value={t}>{PERIOD_TYPE_LABELS[t]}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>
			<p class="mb-2 text-sm text-muted">
				배수 · 가로선은 등급 기준선{trendType === 'Y' ? '' : ' · 각 기간 실적 기준(연율화 안 함)'}
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
			</p>
			<StackedBarChart
				categories={series.map((y) => periodShortLabel(y.period))}
				series={stackSeries}
				values={stackValues}
				format={oneDecimalBil}
				totalLabel="매출액"
				ariaLabel="{trendTitle} 인건비·비인건비·영업이익 누적 막대 차트"
			/>
		</section>
	</div>

	<!-- 추이 인사이트 + 표 -->
	<div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
		<section aria-labelledby="trend-h">
			<h2 id="trend-h" class="mb-3 text-lg font-semibold text-ink">추이 인사이트</h2>
			<InsightList
				insights={trend}
				emptyText="같은 단위({trendTitle})의 기간이 2개 이상 있으면 추이 인사이트가 표시됩니다."
			/>
		</section>
		<section class="card overflow-x-auto" aria-labelledby="table-h">
			<h2 id="table-h" class="px-5 pt-4 pb-2 text-lg font-semibold text-ink">
				{trendTitle} 지표 표
			</h2>
			<table class="w-full min-w-[640px] text-[15px]">
				<thead>
					<tr class="border-y border-line bg-surface-2 text-left text-sm text-ink-2">
						<th scope="col" class="px-4 py-2 font-semibold">기간</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">매출액{colUnit}</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">영업이익{colUnit}</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">총 인건비{colUnit}</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">인원</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">HCROI</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">HCVA{colUnit}</th>
					</tr>
				</thead>
				<tbody>
					{#each series as y (y.id)}
						{@const m = computeMetrics(y.inputs)}
						<tr
							class="border-b border-line last:border-0 {y.id === year.id
								? 'bg-brand-tint/60'
								: ''}"
						>
							<th scope="row" class="px-4 py-2 text-left font-semibold whitespace-nowrap text-ink"
								>{periodLabel(y.period)}</th
							>
							<td class="tabular px-3 py-2 text-right">{cellWon(y.inputs.revenue)}</td>
							<td class="tabular px-3 py-2 text-right">{cellWon(m.operatingProfit)}</td>
							<td class="tabular px-3 py-2 text-right">{cellWon(y.inputs.hcCost)}</td>
							<td class="tabular px-3 py-2 text-right">{formatHeadcount(y.inputs.headcount)}</td>
							<td class="tabular px-3 py-2 text-right font-semibold">{formatMultiple(m.hcroi)}</td>
							<td class="tabular px-3 py-2 text-right">{cellWon(m.hcva)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	</div>

	<div class="mt-8 flex justify-end">
		<a href={resolve('/simulator')} class="btn btn-primary">이 데이터로 시나리오 시뮬레이션 →</a>
	</div>
{/if}
