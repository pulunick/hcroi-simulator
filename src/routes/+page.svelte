<script lang="ts">
	import { resolve } from '$app/paths';
	import { workspace } from '$lib/state/workspace.svelte';
	import { computeMetrics, diagnose, gradeOf, validateInputs } from '$lib/hcroi/formulas';
	import { trendInsights } from '$lib/hcroi/insights';
	import {
		formatHeadcount,
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

	let selectedId = $state<string | null>(null);
	const year = $derived(workspace.years.find((y) => y.id === selectedId) ?? workspace.latestYear);
	const metrics = $derived(year ? computeMetrics(year.inputs) : null);
	const diag = $derived(diagnose(metrics?.hcroi ?? null));
	const errors = $derived(year ? validateInputs(year.inputs) : []);

	const prev = $derived.by(() => {
		if (!year) return null;
		const idx = workspace.sortedYears.findIndex((y) => y.id === year.id);
		return idx > 0 ? workspace.sortedYears[idx - 1] : null;
	});
	const prevMetrics = $derived(prev ? computeMetrics(prev.inputs) : null);

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
			text: `${formatSigned(d, fmt)} vs ${prev?.year}년`,
			direction:
				Math.abs(d) < 1e-9 ? ('flat' as const) : d > 0 ? ('up' as const) : ('down' as const),
			goodWhenUp
		};
	}

	// 차트 데이터
	const linePoints = $derived(
		workspace.sortedYears.map((y) => ({
			label: `${y.year}`,
			value: computeMetrics(y.inputs).hcroi
		}))
	);
	const stackSeries = [
		{ key: 'hc', label: '총 인건비', color: 'var(--color-series-1)' },
		{ key: 'nonhc', label: '비인건비 영업비용', color: 'var(--color-series-4)' },
		{ key: 'op', label: '영업이익', color: 'var(--color-series-3)' }
	];
	const stackValues = $derived(
		workspace.sortedYears.map((y) => {
			const m = computeMetrics(y.inputs);
			return [y.inputs.hcCost, m.nonHcCost, m.operatingProfit];
		})
	);
	const thresholds = [
		{ value: 1.0, label: '보통 1.0' },
		{ value: 1.3, label: '양호 1.3' },
		{ value: 1.5, label: '우수 1.5' }
	];
	const trend = $derived(trendInsights(workspace.years));
	const oneDecimalBil = (v: number) => (v === 0 ? '0억' : formatKrwCompact(v, ''));
</script>

<svelte:head><title>HCROI 대시보드</title></svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold text-ink">HCROI 대시보드</h1>
		<p class="mt-1 text-[15px] text-ink-2">
			재무·HR 데이터를 입력하면 인적자본 투자효율 지표가 실시간으로 산출됩니다.
		</p>
	</div>
	{#if workspace.years.length}
		<label class="flex items-center gap-2 text-sm font-semibold text-ink-2">
			조회 연도
			<select
				class="field-input w-auto py-1.5"
				value={year?.id ?? ''}
				onchange={(e) => (selectedId = (e.currentTarget as HTMLSelectElement).value || null)}
			>
				{#each workspace.sortedYears as y (y.id)}
					<option value={y.id}>{y.year}년</option>
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
				<h2 id="input-h" class="text-lg font-semibold text-ink">{year.year}년 기준 데이터</h2>
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
							help="영업이익 {formatKrwCompact(metrics.operatingProfit)}"
						/>
					{:else}
						<NumberField
							label="영업이익"
							bind:value={
								() => year.inputs.revenue - year.inputs.operatingCost,
								(v) => (year.inputs.operatingCost = year.inputs.revenue - v)
							}
							help="영업비용 {formatKrwCompact(year.inputs.operatingCost)}"
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
				<NumberField label="총 임직원 수" bind:value={year.inputs.headcount} unit="명" min={1} />
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
					</div>
					<GradeBadge grade={gradeOf(metrics.hcroi)} size="lg" />
				</div>
				<p class="mt-3 text-[15px] leading-relaxed text-ink-2">
					{diag?.summary ?? '총 인건비가 0이어서 HCROI 를 계산할 수 없습니다.'}
				</p>
				<p class="tabular mt-2 text-sm text-muted">
					산식: (영업이익 {formatKrwCompact(metrics.operatingProfit)} + 총 인건비 {formatKrwCompact(
						year.inputs.hcCost
					)}) ÷ 총 인건비 {formatKrwCompact(year.inputs.hcCost)}
				</p>
			</section>

			<div class="grid gap-4 sm:grid-cols-3">
				<StatTile
					label="HCVA (인당 부가가치)"
					value={formatKrwCompact(metrics.hcva)}
					sub="/인"
					delta={delta(metrics.hcva, prevMetrics?.hcva, (n) => formatKrwCompact(n))}
				/>
				<StatTile
					label="인당 매출액"
					value={formatKrwCompact(metrics.revenuePerHead)}
					sub="/인"
					delta={delta(metrics.revenuePerHead, prevMetrics?.revenuePerHead, (n) =>
						formatKrwCompact(n)
					)}
				/>
				<StatTile
					label="인당 인건비"
					value={formatKrwCompact(metrics.hcCostPerHead)}
					sub="/인"
					delta={delta(
						metrics.hcCostPerHead,
						prevMetrics?.hcCostPerHead,
						(n) => formatKrwCompact(n),
						false
					)}
				/>
			</div>
			<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatTile
					label="영업이익"
					value={formatKrwCompact(metrics.operatingProfit)}
					delta={delta(metrics.operatingProfit, prevMetrics?.operatingProfit, (n) =>
						formatKrwCompact(n)
					)}
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
			<h2 id="line-h" class="text-base font-semibold text-ink">연도별 HCROI 추이</h2>
			<p class="mb-2 text-sm text-muted">배수 · 가로선은 등급 기준선</p>
			<LineChart
				points={linePoints}
				format={(v) => v.toFixed(2)}
				{thresholds}
				ariaLabel="연도별 HCROI 추이 라인 차트"
			/>
		</section>
		<section class="card px-5 py-4" aria-labelledby="stack-h">
			<h2 id="stack-h" class="text-base font-semibold text-ink">인건비 vs 영업이익 비중</h2>
			<p class="mb-2 text-sm text-muted">
				매출액 구성 (억원) — 총 인건비 + 비인건비 영업비용 + 영업이익 = 매출액
			</p>
			<StackedBarChart
				categories={workspace.sortedYears.map((y) => `${y.year}`)}
				series={stackSeries}
				values={stackValues}
				format={oneDecimalBil}
				totalLabel="매출액"
				ariaLabel="연도별 인건비·비인건비·영업이익 누적 막대 차트"
			/>
		</section>
	</div>

	<!-- 추이 인사이트 + 표 -->
	<div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
		<section aria-labelledby="trend-h">
			<h2 id="trend-h" class="mb-3 text-lg font-semibold text-ink">추이 인사이트</h2>
			<InsightList
				insights={trend}
				emptyText="2개년 이상 데이터가 있으면 추이 인사이트가 표시됩니다."
			/>
		</section>
		<section class="card overflow-x-auto" aria-labelledby="table-h">
			<h2 id="table-h" class="px-5 pt-4 pb-2 text-lg font-semibold text-ink">연도별 지표 표</h2>
			<table class="w-full min-w-[640px] text-[15px]">
				<thead>
					<tr class="border-y border-line bg-surface-2 text-left text-sm text-ink-2">
						<th scope="col" class="px-4 py-2 font-semibold">연도</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">매출액</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">영업이익</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">총 인건비</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">인원</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">HCROI</th>
						<th scope="col" class="px-3 py-2 text-right font-semibold">HCVA</th>
					</tr>
				</thead>
				<tbody>
					{#each workspace.sortedYears as y (y.id)}
						{@const m = computeMetrics(y.inputs)}
						<tr
							class="border-b border-line last:border-0 {y.id === year.id
								? 'bg-brand-tint/60'
								: ''}"
						>
							<th scope="row" class="px-4 py-2 text-left font-semibold text-ink">{y.year}</th>
							<td class="tabular px-3 py-2 text-right">{formatKrwCompact(y.inputs.revenue)}</td>
							<td class="tabular px-3 py-2 text-right">{formatKrwCompact(m.operatingProfit)}</td>
							<td class="tabular px-3 py-2 text-right">{formatKrwCompact(y.inputs.hcCost)}</td>
							<td class="tabular px-3 py-2 text-right">{formatHeadcount(y.inputs.headcount)}</td>
							<td class="tabular px-3 py-2 text-right font-semibold">{formatMultiple(m.hcroi)}</td>
							<td class="tabular px-3 py-2 text-right">{formatKrwCompact(m.hcva)}</td>
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
