<script lang="ts">
	/**
	 * 동종업계 비교 화면 (계획 docs/plans/peer-comparison.md §3).
	 * - 지표·평균·중앙값·순위는 전부 `peers.ts` 의 `comparePeers` 결과만 쓴다 (화면에서 다시 계산하지 않는다)
	 * - 금액·비율·인원 표기는 `format.ts` 한 곳 (열 머리글 단위는 `columnUnitSuffix`)
	 * - 상대 회사 값은 화면에서 직접 넣거나 엑셀 `동종업계` 시트로 들어온다 (저장은 `workspace.peers`)
	 */
	import { resolve } from '$app/paths';
	import { newId, workspace } from '$lib/state/workspace.svelte';
	import {
		PEER_METRIC_KEYS,
		PEER_METRIC_LABELS,
		comparePeers,
		type PeerMetricKey,
		type PeerRow
	} from '$lib/hcroi/peers';
	import {
		YEAR_MAX,
		YEAR_MIN,
		isValidPeriod,
		isValidYear,
		periodIndexCount,
		periodKey,
		periodLabel,
		periodText,
		samePeriod
	} from '$lib/hcroi/period';
	import {
		computeMetrics,
		gradeOf,
		operatingCostFromProfit,
		validateRecord
	} from '$lib/hcroi/formulas';
	import {
		PERIOD_TYPES,
		PERIOD_TYPE_LABELS,
		PEER_NAME_MAX,
		type Period,
		type PeriodRecord,
		type PeriodType
	} from '$lib/hcroi/types';
	import {
		amountUnitLabel,
		columnUnitSuffix,
		formatAmount,
		formatCellAmount,
		formatHeadcount,
		formatMultiple,
		formatPct,
		formatSigned,
		hintAmountUnit
	} from '$lib/hcroi/format';
	import GradeBadge from '$lib/components/ui/GradeBadge.svelte';

	const colUnit = $derived(columnUnitSuffix(workspace.amountUnit));
	const hintUnit = $derived(hintAmountUnit(workspace.amountUnit));
	const cellWon = (v: number | null | undefined) => formatCellAmount(v, workspace.amountUnit);
	/** 비교 표의 자사 행 이름 — 회사 이름을 넣지 않았으면 "자사" */
	const selfName = $derived(workspace.orgName.trim() || '자사');

	/* ───────────── 기간 선택 (화면에서만 쓰는 상태 — 저장하지 않는다) ───────────── */

	let chosenKey = $state<string | null>(null);
	const periodList = $derived(workspace.peerPeriodList);
	const period = $derived.by<Period | null>(() => {
		const list = periodList;
		if (list.length === 0) return null;
		const chosen = chosenKey ? list.find((p) => periodKey(p) === chosenKey) : undefined;
		if (chosen) return chosen;
		// 기본은 자사 최신 기간, 목록에 없으면 가장 최근 기간
		const own = workspace.latest?.period;
		return (own && list.find((p) => samePeriod(p, own))) ?? list[list.length - 1];
	});

	const comparison = $derived(
		period ? comparePeers(workspace.effective, workspace.peerEffective, period) : null
	);

	/* ───────────── 지표 표기 (단위는 지표마다 다르다 — format.ts 만 쓴다) ───────────── */

	type MetricShape = 'multiple' | 'amount' | 'pct';
	const METRIC_SHAPE: Record<PeerMetricKey, MetricShape> = {
		hcroi: 'multiple',
		hcva: 'amount',
		revenuePerHead: 'amount',
		hcCostPerHead: 'amount',
		hcCostToRevenue: 'pct',
		operatingMargin: 'pct'
	};
	/** 열 머리글에 붙는 단위 — 금액 지표만 작업공간 표시 단위를 밝힌다 (비율·배수는 칸에 단위가 있다) */
	function metricUnit(key: PeerMetricKey): string {
		return METRIC_SHAPE[key] === 'amount' ? colUnit : '';
	}
	function metricText(key: PeerMetricKey, v: number | null | undefined): string {
		const shape = METRIC_SHAPE[key];
		if (shape === 'multiple') return formatMultiple(v);
		if (shape === 'pct') return formatPct(v);
		return cellWon(v);
	}
	/** 업계 평균 대비 차이 — 부호를 앞에 붙인다 */
	function metricDiff(key: PeerMetricKey, own: number | null, mean: number | null): string {
		if (own === null || mean === null) return '—';
		return formatSigned(own - mean, (n) => metricText(key, n));
	}

	const rankLine = $derived.by(() => {
		const c = comparison;
		if (!c) return null;
		const r = c.rank.hcroi;
		if (!r) return null;
		return `${r.of}곳 중 ${r.rank}위 · 평균은 ${c.stats.hcroi.count}곳 기준 (HCROI)`;
	});

	/** 그 기간 값이 있는 회사만 (막대 차트용) */
	const chartRows = $derived.by(() => {
		const c = comparison;
		if (!c) return [] as PeerRow[];
		return [c.self, ...c.peers].filter((r) => r.metrics?.hcroi != null);
	});
	const chartMean = $derived(comparison?.stats.hcroi.mean ?? null);
	let chartWidth = $state(0);
	const CHART_LABEL_W = 92;
	const CHART_ROW_H = 30;
	const CHART_TOP = 24;
	const chartW = $derived(Math.max(chartWidth, 280));
	const chartH = $derived(CHART_TOP + chartRows.length * CHART_ROW_H + 8);
	const chartMax = $derived.by(() => {
		const values = chartRows.map((r) => r.metrics?.hcroi ?? 0);
		if (chartMean !== null) values.push(chartMean);
		const max = values.length ? Math.max(...values) : 1;
		return max > 0 ? max * 1.18 : 1;
	});
	const barX0 = CHART_LABEL_W;
	const barX1 = $derived(chartW - 16);
	function barWidth(v: number): number {
		const span = Math.max(barX1 - barX0, 10);
		return Math.max(2, (Math.max(v, 0) / chartMax) * span);
	}
	function shortName(name: string): string {
		return name.length > 7 ? `${name.slice(0, 6)}…` : name;
	}

	/* ───────────── 회사 편집 ───────────── */

	let message = $state<string | null>(null);
	let newName = $state('');
	let openId = $state<string | null>(null);
	/** 이름·메모를 고치는 중인 회사 */
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editMemo = $state('');

	function addCompany() {
		const company = workspace.addPeer(newName);
		if (!company) {
			message = newName.trim()
				? `"${newName.trim()}" 은(는) 이미 있는 회사입니다.`
				: '회사 이름을 넣으세요.';
			return;
		}
		message = `${company.name} 을(를) 추가했습니다. 기간을 추가해 값을 넣으세요.`;
		newName = '';
		openId = company.id;
	}
	function startEdit(id: string, name: string, memo: string | undefined) {
		editingId = id;
		editName = name;
		editMemo = memo ?? '';
	}
	function saveEdit(id: string) {
		if (!workspace.renamePeer(id, editName, editMemo)) {
			message = editName.trim()
				? `"${editName.trim()}" 은(는) 이미 있는 회사입니다.`
				: '회사 이름을 넣으세요.';
			return;
		}
		message = null;
		editingId = null;
	}
	function removeCompany(id: string, name: string) {
		if (!confirm(`${name} 을(를) 삭제할까요? 넣은 기간 값도 함께 지워집니다.`)) return;
		workspace.removePeer(id);
		if (openId === id) openId = null;
		if (editingId === id) editingId = null;
		message = `${name} 을(를) 삭제했습니다.`;
	}

	/* ── 기간 행 추가 ── */
	let rowYear = $state<number | null>(null);
	let rowType = $state<PeriodType>('Y');
	let rowIndex = $state(1);
	const defaultYear = $derived(workspace.latest?.period.year ?? new Date().getFullYear() - 1);
	const addPeriod = $derived<Period>({
		year: rowYear ?? defaultYear,
		type: rowType,
		index: rowIndex
	});
	function addRow(peerId: string) {
		if (!isValidYear(addPeriod.year) || !isValidPeriod(addPeriod)) {
			message = `연도는 ${YEAR_MIN}~${YEAR_MAX} 사이의 정수여야 합니다.`;
			return;
		}
		const rec: PeriodRecord = {
			id: newId(),
			period: { ...addPeriod },
			inputs: { revenue: 0, operatingCost: 0, hcCost: 0, headcount: 0 },
			breakdown: null,
			headcountBreakdown: null
		};
		if (!workspace.addPeerRecord(peerId, rec)) {
			message = `${periodLabel(addPeriod)} 은(는) 이 회사에 이미 있습니다.`;
			return;
		}
		message = null;
	}

	/**
	 * 한 칸을 고쳐 레코드를 통째로 다시 저장한다 (같은 기간이 겹치면 `updatePeerRecord` 가 막는다).
	 * 성공하면 true — 연도·기간 칸은 실패했을 때 입력 요소를 저장값으로 되돌리는 데 쓴다.
	 */
	function patchRow(
		peerId: string,
		rec: PeriodRecord,
		patch: Partial<PeriodRecord['inputs']> & { period?: Period; memo?: string }
	): boolean {
		const { period: nextPeriod, memo, ...inputs } = patch;
		const current = $state.snapshot(rec);
		const next: PeriodRecord = {
			...current,
			period: nextPeriod ?? { ...current.period },
			inputs: { ...current.inputs, ...inputs },
			memo: memo === undefined ? current.memo : memo || undefined
		};
		if (!workspace.updatePeerRecord(peerId, next)) {
			message = `${periodLabel(next.period)} 은(는) 이 회사에 이미 있습니다.`;
			return false;
		}
		message = null;
		return true;
	}

	/**
	 * 연도·기간 칸 전용 — 값이 **기간으로서 온전할 때만** 저장한다 (2 → 20 → 202 같은 중간값을 막는다).
	 * 저장하지 못하면 입력 요소를 저장값으로 되돌려 화면과 상태가 어긋나지 않게 한다.
	 */
	function patchPeriod(
		peerId: string,
		rec: PeriodRecord,
		next: Period,
		revert: () => void,
		badMessage: string
	) {
		if (!isValidYear(next.year) || !isValidPeriod(next)) {
			message = badMessage;
			revert();
			return;
		}
		if (!patchRow(peerId, rec, { period: next })) revert();
	}
	/** 숫자 칸 — 비우는 중에는 값을 건드리지 않는다 (0 이 밀려 들어오지 않게) */
	function numberOf(e: Event): number | null {
		const raw = (e.currentTarget as HTMLInputElement).value.trim();
		if (raw === '') return null;
		const n = Number(raw);
		return Number.isFinite(n) ? Math.round(n) : null;
	}
	function removeRow(peerId: string, rec: PeriodRecord) {
		if (!confirm(`${periodLabel(rec.period)} 행을 삭제할까요?`)) return;
		workspace.removePeerRecord(peerId, rec.id);
	}
	/** 행 옆에 붙이는 짧은 오류 문구 */
	function rowError(rec: PeriodRecord): string | null {
		const errs = validateRecord(rec);
		if (errs.length === 0) return null;
		return errs.length === 1 ? errs[0] : `${errs[0]} 외 ${errs.length - 1}건`;
	}
</script>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold text-ink">동종업계</h1>
		<p class="mt-1 max-w-3xl text-[15px] text-ink-2">
			상대 회사의 매출액·영업이익·총 인건비·총 임직원 수를 넣으면 같은 기간의 자사 지표를 각
			회사·업계 평균과 나란히 보여 줍니다. 값은 화면에서 직접 넣거나 엑셀 "동종업계" 시트로
			넣습니다.
		</p>
		<p class="mt-3 text-sm text-ink-2">
			표시 단위 {amountUnitLabel(workspace.amountUnit)} —
			<a href={resolve('/settings')} class="font-medium text-brand-ink hover:underline"
				>설정에서 바꾸기</a
			>
		</p>
	</div>
	{#if periodList.length > 0}
		<label class="flex items-center gap-2 text-sm font-semibold text-ink-2">
			비교 기간
			<select
				class="field-input w-auto py-1.5"
				value={period ? periodKey(period) : ''}
				onchange={(e) => (chosenKey = (e.currentTarget as HTMLSelectElement).value)}
			>
				{#each periodList as p (periodKey(p))}
					<option value={periodKey(p)}>{periodLabel(p)}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

{#if message}
	<p
		class="mb-4 rounded-md border border-line bg-surface px-4 py-2 text-sm text-ink-2"
		role="status"
	>
		{message}
	</p>
{/if}

{#if workspace.peers.length === 0}
	<section class="card mb-6 px-5 py-10 text-center" aria-labelledby="empty-h">
		<h2 id="empty-h" class="text-lg font-semibold text-ink">아직 비교할 회사가 없습니다</h2>
		<p class="mx-auto mt-2 max-w-xl text-[15px] text-ink-2">
			상대 회사를 추가하거나 엑셀 동종업계 시트로 넣으세요. 회사마다 기간별로 매출액·영업이익·총
			인건비·총 임직원 수 네 가지만 있으면 됩니다.
		</p>
		<form
			class="mt-5 flex flex-wrap items-center justify-center gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				addCompany();
			}}
		>
			<input
				class="field-input w-56"
				placeholder="회사 이름"
				aria-label="회사 이름"
				maxlength={PEER_NAME_MAX}
				bind:value={newName}
			/>
			<button type="submit" class="btn btn-primary">회사 추가</button>
			<a href={resolve('/data')} class="btn btn-secondary">엑셀로 넣기</a>
		</form>
	</section>
{:else if comparison && period}
	{@const c = comparison}
	<section class="card mb-6 overflow-hidden" aria-labelledby="compare-h">
		<div class="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-4 pb-3">
			<h2 id="compare-h" class="text-lg font-semibold text-ink">
				{periodLabel(period)} 비교
			</h2>
			{#if rankLine}
				<p class="text-sm font-semibold text-brand-ink">{rankLine}</p>
			{/if}
		</div>
		<div class="relative overflow-x-auto">
			<table class="w-full min-w-[1080px] text-[15px]">
				<thead>
					<tr class="border-y border-line bg-surface-2 text-sm text-ink-2">
						<th scope="col" class="px-4 py-2 text-left font-semibold">회사</th>
						<th scope="col" class="px-3 py-2 text-center font-semibold">매출액{colUnit}</th>
						<th scope="col" class="px-3 py-2 text-center font-semibold">영업이익{colUnit}</th>
						<th scope="col" class="px-3 py-2 text-center font-semibold">총 인건비{colUnit}</th>
						<th scope="col" class="px-3 py-2 text-center font-semibold">임직원 수</th>
						{#each PEER_METRIC_KEYS as key (key)}
							<th scope="col" class="px-3 py-2 text-center font-semibold"
								>{PEER_METRIC_LABELS[key]}{metricUnit(key)}</th
							>
						{/each}
					</tr>
				</thead>
				<tbody>
					<!--
						회사 한 곳 = 한 행. 자사도 상대도 같은 조각을 쓰고 강조만 `isSelf` 로 갈린다
						(값·지표는 전부 `comparePeers` 결과 그대로 — 화면에서 다시 계산하지 않는다).
					-->
					{#snippet companyRow(row: PeerRow)}
						<tr class="border-b border-line {row.isSelf ? 'bg-brand-tint/60' : ''}">
							<th
								scope="row"
								class="px-4 py-2 text-left whitespace-nowrap text-ink {row.isSelf
									? 'font-bold'
									: 'font-semibold'}"
							>
								{row.isSelf ? selfName : row.name}
								{#if row.isSelf && workspace.orgName.trim()}
									<!-- 회사 이름을 넣지 않았으면 행 이름 자체가 "자사" 라 칩을 겹치지 않는다 -->
									<span class="ml-1 rounded bg-surface px-1.5 py-0.5 text-xs font-normal text-muted"
										>자사</span
									>
								{/if}
								{#if !row.record}
									<span class="ml-1 text-xs font-normal text-muted">이 기간 없음</span>
								{:else if !row.metrics}
									<span
										class="ml-1 rounded bg-status-critical-bg px-1.5 py-0.5 text-xs font-normal text-status-critical-ink"
										>입력 오류</span
									>
								{/if}
							</th>
							<td class="tabular px-3 py-2 text-right">{cellWon(row.record?.inputs.revenue)}</td>
							<td class="tabular px-3 py-2 text-right"
								>{row.record ? cellWon(computeMetrics(row.record.inputs).operatingProfit) : '—'}</td
							>
							<td class="tabular px-3 py-2 text-right">{cellWon(row.record?.inputs.hcCost)}</td>
							<td class="tabular px-3 py-2 text-right"
								>{formatHeadcount(row.record?.inputs.headcount)}</td
							>
							{#each PEER_METRIC_KEYS as key (key)}
								<td class="tabular px-3 py-2 text-right {row.isSelf ? 'font-semibold' : ''}">
									{#if key === 'hcroi'}
										<span class="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
											<span class="tabular">{metricText(key, row.metrics?.hcroi)}</span>
											{#if row.metrics}<GradeBadge grade={gradeOf(row.metrics.hcroi)} />{/if}
										</span>
									{:else}
										{metricText(key, row.metrics?.[key])}
									{/if}
								</td>
							{/each}
						</tr>
					{/snippet}
					<!-- 자사 -->
					{@render companyRow(c.self)}
					<!-- 자사 ↔ 업계 평균 차이 -->
					{#if c.self.metrics && c.stats.hcroi.count > 0}
						<tr class="border-b border-line bg-brand-tint/30 text-sm">
							<th scope="row" class="px-4 py-1.5 text-left font-medium whitespace-nowrap text-ink-2"
								>업계 평균 대비</th
							>
							<td colspan="4" class="px-3 py-1.5 text-right text-muted">—</td>
							{#each PEER_METRIC_KEYS as key (key)}
								<td class="tabular px-3 py-1.5 text-right text-ink-2"
									>{metricDiff(key, c.self.metrics[key], c.stats[key].mean)}</td
								>
							{/each}
						</tr>
					{/if}
					<!-- 상대 회사 (이름 순) -->
					{#each c.peers as row (row.id)}
						{@render companyRow(row)}
					{/each}
					<!-- 업계 평균 · 중앙값 (자사 제외) -->
					<tr class="border-t-2 border-line-2 bg-surface-2">
						<th scope="row" class="px-4 py-2 text-left font-semibold whitespace-nowrap text-ink">
							업계 평균
							<span class="ml-1 text-xs font-normal text-muted">{c.stats.hcroi.count}곳</span>
						</th>
						<td colspan="4" class="px-3 py-2 text-right text-muted">—</td>
						{#each PEER_METRIC_KEYS as key (key)}
							<td class="tabular px-3 py-2 text-right font-semibold"
								>{metricText(key, c.stats[key].mean)}</td
							>
						{/each}
					</tr>
					<tr class="bg-surface-2">
						<th scope="row" class="px-4 py-2 text-left font-semibold whitespace-nowrap text-ink-2"
							>중앙값</th
						>
						<td colspan="4" class="px-3 py-2 text-right text-muted">—</td>
						{#each PEER_METRIC_KEYS as key (key)}
							<td class="tabular px-3 py-2 text-right text-ink-2"
								>{metricText(key, c.stats[key].median)}</td
							>
						{/each}
					</tr>
				</tbody>
			</table>
		</div>
		<p class="px-5 py-3 text-xs text-muted">
			업계 평균은 각 회사 지표의 단순 평균입니다. 합계로 다시 계산하지 않습니다. 자사는 평균에 넣지
			않습니다.
		</p>
	</section>

	<!-- HCROI 막대 (범례 + 직접 라벨 + 위 표 병행) -->
	<section class="card mb-6 px-5 py-4" aria-labelledby="bars-h">
		<div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
			<h2 id="bars-h" class="text-lg font-semibold text-ink">HCROI 비교</h2>
			<span class="text-xs text-muted">단위: 배</span>
		</div>
		{#if chartRows.length === 0}
			<p class="py-8 text-center text-muted">이 기간에 값이 있는 회사가 없습니다.</p>
		{:else}
			<ul class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2" aria-label="범례">
				<li class="flex items-center gap-1.5">
					<span
						class="inline-block h-3 w-3 rounded-sm"
						style="background:var(--color-series-1)"
						aria-hidden="true"
					></span>
					<!-- 회사 이름이 없으면 이름 자체가 "자사" 라 괄호를 붙이지 않는다 -->
					<span>{workspace.orgName.trim() ? `${selfName} (자사)` : '자사'}</span>
				</li>
				<li class="flex items-center gap-1.5">
					<span
						class="inline-block h-3 w-3 rounded-sm"
						style="background:var(--color-muted)"
						aria-hidden="true"
					></span>
					<span>상대 회사</span>
				</li>
				<li class="flex items-center gap-1.5">
					<span
						class="inline-block h-3 w-4 border-t-2 border-dashed"
						style="border-color:var(--color-ink-2)"
						aria-hidden="true"
					></span>
					<span>업계 평균</span>
				</li>
			</ul>
			<div class="w-full" bind:clientWidth={chartWidth}>
				<svg
					width={chartW}
					height={chartH}
					role="img"
					aria-label="{periodLabel(period)} 회사별 HCROI 막대 — 자세한 값은 위 표 참조"
					class="block max-w-full"
				>
					{#if chartMean !== null}
						{@const mx = barX0 + barWidth(chartMean)}
						<line
							x1={mx}
							x2={mx}
							y1={CHART_TOP - 6}
							y2={chartH - 4}
							stroke="var(--color-ink-2)"
							stroke-width="1"
							stroke-dasharray="4 3"
						/>
						<text
							x={Math.min(mx + 4, chartW - 4)}
							y={CHART_TOP - 10}
							text-anchor={mx > chartW - 110 ? 'end' : 'start'}
							font-size="11"
							fill="var(--color-ink-2)"
							class="chart-label">업계 평균 {formatMultiple(chartMean)}</text
						>
					{/if}
					{#each chartRows as row, i (row.id)}
						{@const v = row.metrics?.hcroi ?? 0}
						{@const y = CHART_TOP + i * CHART_ROW_H}
						<text
							x={CHART_LABEL_W - 8}
							y={y + 15}
							text-anchor="end"
							font-size="12"
							font-weight={row.isSelf ? '700' : '400'}
							fill={row.isSelf ? 'var(--color-ink)' : 'var(--color-ink-2)'}
							>{shortName(row.isSelf ? selfName : row.name)}</text
						>
						<rect
							x={barX0}
							y={y + 4}
							width={barWidth(v)}
							height={16}
							rx="3"
							fill={row.isSelf ? 'var(--color-series-1)' : 'var(--color-muted)'}
						/>
						<text
							x={barX0 + barWidth(v) + 6}
							y={y + 16}
							font-size="12"
							font-weight="600"
							fill="var(--color-ink)"
							class="tabular chart-label">{formatMultiple(v)}</text
						>
					{/each}
				</svg>
			</div>
		{/if}
	</section>
{:else}
	<section class="card mb-6 px-5 py-10 text-center">
		<p class="text-[15px] text-ink-2">
			비교할 수 있는 기간이 없습니다. 아래에서 상대 회사의 기간 값을 넣으세요.
		</p>
	</section>
{/if}

<!-- 회사 목록 편집 -->
<section class="card px-5 py-5" aria-labelledby="companies-h">
	<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 id="companies-h" class="text-lg font-semibold text-ink">비교할 회사</h2>
			<p class="text-xs text-muted">
				회사 이름을 누르면 기간별 값을 넣을 수 있습니다. 금액은 원 단위로 적습니다.
			</p>
		</div>
		<form
			class="flex flex-wrap items-center gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				addCompany();
			}}
		>
			<input
				class="field-input w-48 py-1.5"
				placeholder="회사 이름"
				aria-label="추가할 회사 이름"
				maxlength={PEER_NAME_MAX}
				bind:value={newName}
			/>
			<button type="submit" class="btn py-1.5 btn-primary">회사 추가</button>
		</form>
	</div>

	<ul class="space-y-3">
		{#each workspace.peers as company (company.id)}
			{@const open = openId === company.id}
			<li class="rounded-lg border border-line bg-surface-2">
				<div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
					{#if editingId === company.id}
						<form
							class="flex flex-wrap items-center gap-2"
							onsubmit={(e) => {
								e.preventDefault();
								saveEdit(company.id);
							}}
						>
							<input
								class="field-input w-40 py-1.5"
								aria-label="회사 이름"
								maxlength={PEER_NAME_MAX}
								bind:value={editName}
							/>
							<input
								class="field-input w-56 py-1.5"
								placeholder="메모 (예: 코스닥 · 의료 AI)"
								aria-label="회사 메모"
								bind:value={editMemo}
							/>
							<button type="submit" class="btn py-1.5 text-sm btn-primary">저장</button>
							<button
								type="button"
								class="btn py-1.5 text-sm btn-ghost"
								onclick={() => (editingId = null)}>취소</button
							>
						</form>
					{:else}
						<button
							type="button"
							class="flex items-center gap-2 text-left"
							aria-expanded={open}
							onclick={() => (openId = open ? null : company.id)}
						>
							<span class="text-[15px] font-semibold text-ink">{company.name}</span>
							{#if company.memo}<span class="text-sm text-muted">{company.memo}</span>{/if}
							<span class="text-xs text-muted">기간 {company.records.length}개</span>
							<span class="text-xs text-brand-ink">{open ? '접기' : '펼치기'}</span>
						</button>
						<div class="flex items-center gap-1">
							<button
								type="button"
								class="btn py-1 text-sm btn-ghost"
								onclick={() => startEdit(company.id, company.name, company.memo)}>이름·메모</button
							>
							<button
								type="button"
								class="btn py-1 text-sm btn-ghost text-status-critical-ink"
								onclick={() => removeCompany(company.id, company.name)}>삭제</button
							>
						</div>
					{/if}
				</div>

				{#if open}
					<div class="border-t border-line px-4 py-3">
						<!-- relative: 표 안 `sr-only` 라벨이 절대 위치라 기준이 없으면 문서 폭을 늘린다(390px 가로 스크롤) -->
						<div class="relative overflow-x-auto">
							<table class="w-full min-w-[880px] text-sm">
								<thead>
									<tr class="border-b border-line text-ink-2">
										<th scope="col" class="px-2 py-2 text-left font-semibold">연도</th>
										<th scope="col" class="px-2 py-2 text-left font-semibold">기간</th>
										<th scope="col" class="px-2 py-2 text-right font-semibold">매출액 (원)</th>
										<th scope="col" class="px-2 py-2 text-right font-semibold">영업이익 (원)</th>
										<th scope="col" class="px-2 py-2 text-right font-semibold">총 인건비 (원)</th>
										<th scope="col" class="px-2 py-2 text-right font-semibold">임직원 수 (명)</th>
										<th scope="col" class="px-2 py-2 text-left font-semibold">메모</th>
										<th scope="col" class="w-10 px-2 py-2"><span class="sr-only">삭제</span></th>
									</tr>
								</thead>
								<tbody>
									{#each company.records as rec (rec.id)}
										{@const m = computeMetrics(rec.inputs)}
										{@const err = rowError(rec)}
										<tr class="border-b border-line align-top last:border-0">
											<td class="px-2 py-2">
												<input
													type="number"
													class="tabular field-input w-24 py-1.5 text-right"
													min={YEAR_MIN}
													max={YEAR_MAX}
													value={rec.period.year}
													aria-label="{company.name} 연도"
													onchange={(e) => {
														const el = e.currentTarget as HTMLInputElement;
														const y = numberOf(e);
														patchPeriod(
															company.id,
															rec,
															{ ...$state.snapshot(rec.period), year: y ?? NaN },
															() => (el.value = String(rec.period.year)),
															`연도는 ${YEAR_MIN}~${YEAR_MAX} 사이의 정수여야 합니다.`
														);
													}}
												/>
											</td>
											<td class="px-2 py-2">
												<div class="flex flex-wrap gap-1">
													<select
														class="field-input w-auto py-1.5"
														aria-label="{company.name} 기간 유형"
														value={rec.period.type}
														onchange={(e) => {
															const el = e.currentTarget as HTMLSelectElement;
															patchPeriod(
																company.id,
																rec,
																{
																	...$state.snapshot(rec.period),
																	type: el.value as PeriodType,
																	index: 1
																},
																() => (el.value = rec.period.type),
																'기간을 바꾸지 못했습니다.'
															);
														}}
													>
														{#each PERIOD_TYPES as t (t)}
															<option value={t}>{PERIOD_TYPE_LABELS[t]}</option>
														{/each}
													</select>
													{#if rec.period.type !== 'Y'}
														<select
															class="field-input w-auto py-1.5"
															aria-label="{company.name} 기간 순번"
															value={rec.period.index}
															onchange={(e) => {
																const el = e.currentTarget as HTMLSelectElement;
																patchPeriod(
																	company.id,
																	rec,
																	{ ...$state.snapshot(rec.period), index: Number(el.value) },
																	() => (el.value = String(rec.period.index)),
																	'기간 순번이 올바르지 않습니다.'
																);
															}}
														>
															{#each Array.from({ length: periodIndexCount(rec.period.type) }, (_, i) => i + 1) as i (i)}
																<option value={i}
																	>{periodText({
																		year: rec.period.year,
																		type: rec.period.type,
																		index: i
																	})}</option
																>
															{/each}
														</select>
													{/if}
												</div>
											</td>
											<td class="px-2 py-2 text-right">
												<input
													type="number"
													class="tabular field-input w-44 py-1.5 text-right"
													value={rec.inputs.revenue}
													aria-label="{company.name} 매출액 (원)"
													oninput={(e) => {
														const v = numberOf(e);
														if (v !== null) patchRow(company.id, rec, { revenue: v });
													}}
												/>
												<span class="mt-0.5 block text-[11px] text-muted"
													>{formatAmount(rec.inputs.revenue, hintUnit)}</span
												>
											</td>
											<td class="px-2 py-2 text-right">
												<input
													type="number"
													class="tabular field-input w-44 py-1.5 text-right"
													value={m.operatingProfit}
													aria-label="{company.name} 영업이익 (원)"
													oninput={(e) => {
														const v = numberOf(e);
														if (v !== null)
															patchRow(company.id, rec, {
																operatingCost: operatingCostFromProfit(rec.inputs.revenue, v)
															});
													}}
												/>
												<span class="mt-0.5 block text-[11px] text-muted"
													>{formatAmount(m.operatingProfit, hintUnit)}</span
												>
											</td>
											<td class="px-2 py-2 text-right">
												<input
													type="number"
													class="tabular field-input w-44 py-1.5 text-right"
													value={rec.inputs.hcCost}
													aria-label="{company.name} 총 인건비 (원)"
													oninput={(e) => {
														const v = numberOf(e);
														if (v !== null) patchRow(company.id, rec, { hcCost: v });
													}}
												/>
												<span class="mt-0.5 block text-[11px] text-muted"
													>{formatAmount(rec.inputs.hcCost, hintUnit)}</span
												>
											</td>
											<td class="px-2 py-2 text-right">
												<input
													type="number"
													class="tabular field-input w-24 py-1.5 text-right"
													value={rec.inputs.headcount}
													aria-label="{company.name} 총 임직원 수 (명)"
													oninput={(e) => {
														const v = numberOf(e);
														if (v !== null) patchRow(company.id, rec, { headcount: v });
													}}
												/>
												<span class="mt-0.5 block text-[11px] text-muted"
													>{formatHeadcount(rec.inputs.headcount)}</span
												>
											</td>
											<td class="px-2 py-2">
												<input
													class="field-input w-40 py-1.5"
													placeholder="예: 사업보고서"
													aria-label="{company.name} 기간 메모"
													value={rec.memo ?? ''}
													oninput={(e) =>
														patchRow(company.id, rec, {
															memo: (e.currentTarget as HTMLInputElement).value
														})}
												/>
												{#if err}
													<span class="mt-0.5 block text-[11px] text-status-critical-ink"
														>{err}</span
													>
												{/if}
											</td>
											<td class="px-2 py-2 text-right">
												<button
													type="button"
													class="btn p-1.5 btn-ghost text-status-critical-ink hover:bg-status-critical-bg"
													aria-label="{company.name} {periodLabel(rec.period)} 행 삭제"
													title="{periodLabel(rec.period)} 행 삭제"
													onclick={() => removeRow(company.id, rec)}
												>
													<svg
														width="16"
														height="16"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														aria-hidden="true"
														><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg
													>
												</button>
											</td>
										</tr>
									{:else}
										<tr
											><td colspan="8" class="px-2 py-4 text-center text-muted"
												>아직 기간이 없습니다. 아래에서 기간을 추가하세요.</td
											></tr
										>
									{/each}
								</tbody>
							</table>
						</div>
						<form
							class="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3"
							onsubmit={(e) => {
								e.preventDefault();
								addRow(company.id);
							}}
						>
							<span class="text-sm font-semibold text-ink-2">기간 추가</span>
							<input
								type="number"
								class="field-input w-24 py-1.5"
								min={YEAR_MIN}
								max={YEAR_MAX}
								value={addPeriod.year}
								aria-label="추가할 연도"
								oninput={(e) => (rowYear = numberOf(e))}
							/>
							<select
								class="field-input w-auto py-1.5"
								bind:value={rowType}
								onchange={() => (rowIndex = 1)}
								aria-label="추가할 기간 유형"
							>
								{#each PERIOD_TYPES as t (t)}
									<option value={t}>{PERIOD_TYPE_LABELS[t]}</option>
								{/each}
							</select>
							{#if rowType !== 'Y'}
								<select
									class="field-input w-auto py-1.5"
									bind:value={rowIndex}
									aria-label="추가할 기간 순번"
								>
									{#each Array.from({ length: periodIndexCount(rowType) }, (_, i) => i + 1) as i (i)}
										<option value={i}
											>{periodText({ year: addPeriod.year, type: rowType, index: i })}</option
										>
									{/each}
								</select>
							{/if}
							<button type="submit" class="btn py-1.5 text-sm btn-secondary">행 추가</button>
							<span class="text-xs text-muted"
								>분기·반기만 넣어도 연간은 자동으로 합산해 비교합니다.</span
							>
						</form>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	<p class="mt-4 text-xs text-muted">
		여러 회사를 한꺼번에 넣으려면 <a href={resolve('/data')} class="text-brand-ink hover:underline"
			>데이터 화면</a
		>
		에서 엑셀 템플릿을 내려받아 "동종업계" 시트를 채운 뒤 엑셀 가져오기로 올리세요.
	</p>
</section>

<style>
	/*
		막대 끝 값·평균 라벨은 평균 점선과 겹칠 수 있다 — 글자 바깥쪽에만 종이색 테두리를 둘러
		선 위에서도 읽히게 한다(`paint-order: stroke` 라 글자 모양은 그대로다).
	*/
	.chart-label {
		paint-order: stroke;
		stroke: var(--color-surface);
		stroke-width: 3px;
		stroke-linejoin: round;
	}
</style>
