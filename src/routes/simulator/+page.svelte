<script lang="ts">
	import { resolve } from '$app/paths';
	import { workspace } from '$lib/state/workspace.svelte';
	import { compareScenarios } from '$lib/hcroi/scenario';
	import { scenarioInsights } from '$lib/hcroi/insights';
	import { gradeOf } from '$lib/hcroi/formulas';
	import {
		formatHeadcount,
		formatKrwCompact,
		formatMultiple,
		formatPct,
		formatSigned
	} from '$lib/hcroi/format';
	import SliderField from '$lib/components/ui/SliderField.svelte';
	import GradeBadge from '$lib/components/ui/GradeBadge.svelte';
	import InsightList from '$lib/components/ui/InsightList.svelte';
	import BarPanel from '$lib/components/charts/BarPanel.svelte';
	import Legend from '$lib/components/charts/Legend.svelte';

	const SERIES_COLORS = ['var(--color-series-1)', 'var(--color-series-2)', 'var(--color-series-3)'];

	const base = $derived(workspace.baseYear);
	const cmp = $derived(base ? compareScenarios(base.inputs, workspace.scenarios) : null);
	const b = $derived(cmp?.baseline.metrics ?? null);

	const legend = $derived([
		{ label: `기준 (${base?.year ?? '—'})`, color: SERIES_COLORS[0] },
		...workspace.scenarios.map((s, i) => ({ label: s.name, color: SERIES_COLORS[i + 1] }))
	]);

	type Row = {
		label: string;
		unit: string;
		pick: (m: NonNullable<typeof b>, inputs: NonNullable<typeof base>['inputs']) => number | null;
		fmt: (v: number) => string;
		goodWhenUp: boolean;
		deltaFmt?: (v: number) => string;
	};
	const rows: Row[] = [
		{
			label: 'HCROI',
			unit: '배',
			pick: (m) => m.hcroi,
			fmt: formatMultiple,
			goodWhenUp: true,
			deltaFmt: formatMultiple
		},
		{
			label: '총 인건비',
			unit: '원',
			pick: (_, i) => i.hcCost,
			fmt: (v) => formatKrwCompact(v),
			goodWhenUp: false
		},
		{
			label: '영업이익',
			unit: '원',
			pick: (m) => m.operatingProfit,
			fmt: (v) => formatKrwCompact(v),
			goodWhenUp: true
		},
		{
			label: '매출액',
			unit: '원',
			pick: (_, i) => i.revenue,
			fmt: (v) => formatKrwCompact(v),
			goodWhenUp: true
		},
		{
			label: '총 임직원 수',
			unit: '명',
			pick: (_, i) => i.headcount,
			fmt: formatHeadcount,
			goodWhenUp: true
		},
		{
			label: 'HCVA (인당 부가가치)',
			unit: '원/인',
			pick: (m) => m.hcva,
			fmt: (v) => formatKrwCompact(v),
			goodWhenUp: true
		},
		{
			label: '인당 매출액',
			unit: '원/인',
			pick: (m) => m.revenuePerHead,
			fmt: (v) => formatKrwCompact(v),
			goodWhenUp: true
		},
		{
			label: '인당 인건비',
			unit: '원/인',
			pick: (m) => m.hcCostPerHead,
			fmt: (v) => formatKrwCompact(v),
			goodWhenUp: false
		},
		{
			label: '영업이익률',
			unit: '%',
			pick: (m) => m.operatingMargin,
			fmt: (v) => formatPct(v),
			goodWhenUp: true,
			deltaFmt: (v) => `${v.toFixed(1)}%p`
		}
	];

	function deltaClass(d: number | null, goodWhenUp: boolean) {
		if (d === null || Math.abs(d) < 1e-9) return 'text-muted';
		return d > 0 === goodWhenUp ? 'text-status-good-ink' : 'text-status-critical-ink';
	}
</script>

<svelte:head><title>인건비·정원 시뮬레이터 — HCROI</title></svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold text-ink">인건비 & 정원 시뮬레이터</h1>
		<p class="mt-1 text-[15px] text-ink-2">
			인원·임금·생산성 변수를 조정하면 예상 총 인건비, 영업이익, HCROI 가 즉시 재계산됩니다.
		</p>
	</div>
	<label class="flex items-center gap-2 text-sm font-semibold text-ink-2">
		기준연도
		<select
			class="field-input w-auto py-1.5"
			value={base?.id ?? ''}
			onchange={(e) =>
				(workspace.baseYearId = (e.currentTarget as HTMLSelectElement).value || null)}
		>
			{#each workspace.sortedYears as y (y.id)}
				<option value={y.id}>{y.year}년</option>
			{/each}
		</select>
	</label>
</div>

{#if !base || !cmp || !b}
	<div class="card px-6 py-10 text-center">
		<p class="text-ink-2">기준연도 데이터가 없습니다.</p>
		<a href={resolve('/data')} class="mt-4 btn btn-primary">데이터 입력하기</a>
	</div>
{:else}
	<!-- 기준선 요약 -->
	<section class="card mb-6 px-5 py-4" aria-labelledby="baseline-h">
		<div class="mb-3 flex flex-wrap items-center gap-3">
			<h2 id="baseline-h" class="text-base font-semibold text-ink">
				<span
					class="mr-1.5 inline-block h-3 w-3 rounded-sm align-middle"
					style="background:{SERIES_COLORS[0]}"
				></span>
				기준선 (Baseline) — {base.year}년
			</h2>
			<GradeBadge grade={gradeOf(b.hcroi)} />
		</div>
		<dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-[15px] sm:grid-cols-3 lg:grid-cols-6">
			<div>
				<dt class="text-sm text-muted">HCROI</dt>
				<dd class="tabular font-semibold">{formatMultiple(b.hcroi)}</dd>
			</div>
			<div>
				<dt class="text-sm text-muted">매출액</dt>
				<dd class="tabular font-semibold">{formatKrwCompact(base.inputs.revenue)}</dd>
			</div>
			<div>
				<dt class="text-sm text-muted">영업이익</dt>
				<dd class="tabular font-semibold">{formatKrwCompact(b.operatingProfit)}</dd>
			</div>
			<div>
				<dt class="text-sm text-muted">총 인건비</dt>
				<dd class="tabular font-semibold">{formatKrwCompact(base.inputs.hcCost)}</dd>
			</div>
			<div>
				<dt class="text-sm text-muted">비인건비 영업비용</dt>
				<dd class="tabular font-semibold">{formatKrwCompact(b.nonHcCost)}</dd>
			</div>
			<div>
				<dt class="text-sm text-muted">총 임직원 수</dt>
				<dd class="tabular font-semibold">{formatHeadcount(base.inputs.headcount)}</dd>
			</div>
		</dl>
	</section>

	<!-- 시나리오 컨트롤 -->
	<div class="mb-6 grid gap-5 lg:grid-cols-2">
		{#each workspace.scenarios as s, i (s.id)}
			{@const r = cmp.results[i]}
			{@const color = SERIES_COLORS[i + 1]}
			<section class="card flex flex-col gap-5 px-5 py-5" aria-label={s.name}>
				<div class="flex items-center justify-between gap-3">
					<label class="flex flex-1 items-center gap-2">
						<span
							class="inline-block h-3 w-3 shrink-0 rounded-sm"
							style="background:{color}"
							aria-hidden="true"
						></span>
						<span class="sr-only">시나리오 이름</span>
						<input
							class="field-input border-transparent bg-transparent px-1 py-0.5 text-lg font-bold hover:border-line"
							bind:value={s.name}
						/>
					</label>
					<button
						type="button"
						class="btn py-1 text-sm btn-ghost"
						onclick={() => workspace.resetScenario(s.id)}>초기화</button
					>
				</div>

				<!-- 인원 -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm font-semibold text-ink-2">인원 변동</span>
						<div
							class="inline-flex rounded-md border border-line-2 p-0.5 text-sm"
							role="group"
							aria-label="인원 조정 방식"
						>
							<button
								type="button"
								class="rounded px-2.5 py-0.5 font-medium {s.params.headcountMode === 'pct'
									? 'bg-brand text-white'
									: 'text-ink-2'}"
								aria-pressed={s.params.headcountMode === 'pct'}
								onclick={() => (s.params.headcountMode = 'pct')}>비율(%)</button
							>
							<button
								type="button"
								class="rounded px-2.5 py-0.5 font-medium {s.params.headcountMode === 'delta'
									? 'bg-brand text-white'
									: 'text-ink-2'}"
								aria-pressed={s.params.headcountMode === 'delta'}
								onclick={() => (s.params.headcountMode = 'delta')}>인원(명)</button
							>
						</div>
					</div>
					{#if s.params.headcountMode === 'pct'}
						<SliderField
							label="인원 변동율"
							bind:value={s.params.headcountPct}
							min={-30}
							max={30}
							step={1}
							unit="%"
							help="적용 후 {formatHeadcount(r.inputs.headcount)} ({formatSigned(
								r.delta.headcount,
								(n) => `${n}명`
							)})"
						/>
					{:else}
						<SliderField
							label="변동 인원수"
							bind:value={s.params.headcountDelta}
							min={-50}
							max={50}
							step={1}
							unit="명"
							help="적용 후 {formatHeadcount(r.inputs.headcount)} ({formatSigned(
								r.delta.headcount,
								(n) => `${n}명`
							)})"
						/>
					{/if}
				</div>

				<SliderField
					label="평균 임금 인상률"
					bind:value={s.params.wageIncreasePct}
					min={-20}
					max={20}
					step={0.5}
					unit="%"
					help="인당 인건비 {formatKrwCompact(b.hcCostPerHead)} → {formatKrwCompact(
						r.metrics.hcCostPerHead
					)}"
				/>
				<SliderField
					label="인당 생산성(인당 매출) 변화율"
					bind:value={s.params.productivityPct}
					min={-30}
					max={30}
					step={0.5}
					unit="%"
					help="인당 매출 {formatKrwCompact(b.revenuePerHead)} → {formatKrwCompact(
						r.metrics.revenuePerHead
					)}"
				/>

				<details class="rounded-lg border border-line bg-surface-2 px-4 py-2">
					<summary class="cursor-pointer text-sm font-semibold text-ink-2"
						>고급 가정 — 비인건비 중 변동비 비율</summary
					>
					<div class="pt-3">
						<SliderField
							label="매출 연동 변동비 비율"
							bind:value={s.params.variableCostRatioPct}
							min={0}
							max={100}
							step={5}
							unit="%"
							zeroLabel="전액 고정비"
							help="비인건비 영업비용 {formatKrwCompact(
								b.nonHcCost
							)} 중 매출에 비례해 움직이는 비중. 0%면 고정비로 간주합니다."
						/>
					</div>
				</details>

				<!-- 미니 결과 -->
				<div class="grid grid-cols-3 gap-3 border-t border-line pt-4">
					<div>
						<div class="text-sm text-muted">예상 HCROI</div>
						<div class="flex flex-wrap items-baseline gap-x-1.5">
							<span class="tabular text-2xl font-bold">{formatMultiple(r.metrics.hcroi)}</span>
							<span class="tabular text-sm font-semibold {deltaClass(r.delta.hcroi, true)}"
								>{formatSigned(r.delta.hcroi, formatMultiple)}</span
							>
						</div>
						<div class="mt-1"><GradeBadge grade={gradeOf(r.metrics.hcroi)} /></div>
					</div>
					<div>
						<div class="text-sm text-muted">예상 총 인건비</div>
						<div class="tabular text-lg font-bold">{formatKrwCompact(r.inputs.hcCost)}</div>
						<div class="tabular text-sm font-semibold {deltaClass(r.delta.hcCost, false)}">
							{formatSigned(r.delta.hcCost, (n) => formatKrwCompact(n))}
						</div>
					</div>
					<div>
						<div class="text-sm text-muted">예상 영업이익</div>
						<div class="tabular text-lg font-bold">
							{formatKrwCompact(r.metrics.operatingProfit)}
						</div>
						<div class="tabular text-sm font-semibold {deltaClass(r.delta.operatingProfit, true)}">
							{formatSigned(r.delta.operatingProfit, (n) => formatKrwCompact(n))}
						</div>
					</div>
				</div>
				<p class="text-sm text-muted">
					HCROI 유지 조건: 인당 생산성 <strong class="text-ink-2"
						>{formatPct(r.breakEvenProductivityPct)}</strong
					>
					이상 또는 임금 인상률
					<strong class="text-ink-2">{formatPct(r.maxWageIncreasePct)}</strong> 이하
				</p>
			</section>
		{/each}
	</div>

	<!-- 차트: 지표별 small multiple -->
	<section class="mb-6" aria-labelledby="cmp-chart-h">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
			<h2 id="cmp-chart-h" class="text-lg font-semibold text-ink">
				시나리오 비교 — Baseline vs {workspace.scenarios.map((s) => s.name).join(' / ')}
			</h2>
			<Legend items={legend} />
		</div>
		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<BarPanel
				title="HCROI"
				unit="배"
				format={(v) => v.toFixed(2)}
				items={[
					{ label: '기준', value: b.hcroi, color: SERIES_COLORS[0] },
					...cmp.results.map((r, i) => ({
						label: r.scenario.name,
						value: r.metrics.hcroi,
						color: SERIES_COLORS[i + 1]
					}))
				]}
			/>
			<BarPanel
				title="총 인건비"
				unit="원"
				format={(v) => formatKrwCompact(v, '')}
				items={[
					{ label: '기준', value: base.inputs.hcCost, color: SERIES_COLORS[0] },
					...cmp.results.map((r, i) => ({
						label: r.scenario.name,
						value: r.inputs.hcCost,
						color: SERIES_COLORS[i + 1]
					}))
				]}
			/>
			<BarPanel
				title="영업이익"
				unit="원"
				format={(v) => formatKrwCompact(v, '')}
				items={[
					{ label: '기준', value: b.operatingProfit, color: SERIES_COLORS[0] },
					...cmp.results.map((r, i) => ({
						label: r.scenario.name,
						value: r.metrics.operatingProfit,
						color: SERIES_COLORS[i + 1]
					}))
				]}
			/>
			<BarPanel
				title="HCVA (인당 부가가치)"
				unit="원/인"
				format={(v) => formatKrwCompact(v, '')}
				items={[
					{ label: '기준', value: b.hcva, color: SERIES_COLORS[0] },
					...cmp.results.map((r, i) => ({
						label: r.scenario.name,
						value: r.metrics.hcva,
						color: SERIES_COLORS[i + 1]
					}))
				]}
			/>
		</div>
	</section>

	<!-- 비교표 -->
	<section class="card mb-6 overflow-x-auto" aria-labelledby="cmp-table-h">
		<h2 id="cmp-table-h" class="px-5 pt-4 pb-2 text-lg font-semibold text-ink">비교표</h2>
		<table class="w-full min-w-[720px] text-[15px]">
			<thead>
				<tr class="border-y border-line bg-surface-2 text-left text-sm text-ink-2">
					<th scope="col" class="px-5 py-2 font-semibold">지표</th>
					<th scope="col" class="px-4 py-2 text-right font-semibold">기준 ({base.year})</th>
					{#each cmp.results as r (r.scenario.id)}
						<th scope="col" class="px-4 py-2 text-right font-semibold">{r.scenario.name}</th>
						<th scope="col" class="px-4 py-2 text-right font-semibold text-muted">증감</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.label)}
					{@const bv = row.pick(b, base.inputs)}
					<tr class="border-b border-line last:border-0">
						<th scope="row" class="px-5 py-2 text-left font-medium text-ink"
							>{row.label} <span class="text-xs font-normal text-muted">({row.unit})</span></th
						>
						<td class="tabular px-4 py-2 text-right">{bv === null ? '—' : row.fmt(bv)}</td>
						{#each cmp.results as r (r.scenario.id)}
							{@const sv = row.pick(r.metrics, r.inputs)}
							{@const d = bv === null || sv === null ? null : sv - bv}
							<td class="tabular px-4 py-2 text-right">{sv === null ? '—' : row.fmt(sv)}</td>
							<td
								class="tabular px-4 py-2 text-right text-sm font-semibold {deltaClass(
									d,
									row.goodWhenUp
								)}">{formatSigned(d, row.deltaFmt ?? row.fmt)}</td
							>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<!-- 인사이트 -->
	<section aria-labelledby="ins-h">
		<h2 id="ins-h" class="mb-3 text-lg font-semibold text-ink">분석 인사이트</h2>
		<div class="grid gap-5 lg:grid-cols-2">
			{#each cmp.results as r, i (r.scenario.id)}
				<div>
					<h3 class="mb-2 flex items-center gap-2 text-base font-semibold text-ink">
						<span
							class="inline-block h-3 w-3 rounded-sm"
							style="background:{SERIES_COLORS[i + 1]}"
							aria-hidden="true"
						></span>{r.scenario.name}
					</h3>
					<InsightList insights={scenarioInsights(base.inputs, r)} />
				</div>
			{/each}
		</div>
	</section>
{/if}
