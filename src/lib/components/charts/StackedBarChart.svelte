<script lang="ts">
	import { niceTicks } from '$lib/hcroi/format';
	import Legend from './Legend.svelte';

	interface Series {
		key: string;
		label: string;
		color: string;
	}
	interface Props {
		categories: string[];
		series: Series[];
		/** values[categoryIdx][seriesIdx] — 음수는 기준선 아래로 쌓인다 */
		values: number[][];
		format: (v: number) => string;
		height?: number;
		ariaLabel: string;
		totalLabel?: string;
		/** 막대 두께(px) */
		barWidth?: number;
	}

	let {
		categories,
		series,
		values,
		format,
		height = 280,
		ariaLabel,
		totalLabel = '합계',
		barWidth = 32
	}: Props = $props();

	let width = $state(0);
	const pad = { top: 24, right: 16, bottom: 30, left: 60 };
	const W = $derived(Math.max(width, 240));
	const innerW = $derived(W - pad.left - pad.right);
	const innerH = $derived(height - pad.top - pad.bottom);

	const stacks = $derived(
		values.map((row) => {
			let up = 0;
			let down = 0;
			const segs = row.map((v, s) => {
				if (v >= 0) {
					const y0 = up;
					up += v;
					return { s, v, from: y0, to: up };
				}
				const y0 = down;
				down += v;
				return { s, v, from: down, to: y0 };
			});
			return { segs, up, down, total: row.reduce((a, b) => a + b, 0) };
		})
	);
	const ticks = $derived.by(() => {
		const hi = Math.max(0, ...stacks.map((s) => s.up));
		const lo = Math.min(0, ...stacks.map((s) => s.down));
		return niceTicks(lo, hi * 1.08, 5, true);
	});
	const yMin = $derived(ticks[0]);
	const yMax = $derived(ticks[ticks.length - 1]);
	const band = $derived(categories.length ? innerW / categories.length : innerW);
	const bw = $derived(Math.min(barWidth, band * 0.6));

	function cx(i: number) {
		return pad.left + band * i + band / 2;
	}
	function y(v: number) {
		return pad.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
	}

	let hover = $state<number | null>(null);
	const tipLeft = $derived(hover === null ? 0 : Math.min(W - 110, Math.max(110, cx(hover))));
	/** 포인터 x 좌표 → 카테고리 인덱스 (히트영역 = 밴드 전체) */
	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const px = e.clientX - rect.left - pad.left;
		const i = Math.floor(px / band);
		hover = i >= 0 && i < categories.length ? i : null;
	}
</script>

<div class="relative w-full" bind:clientWidth={width}>
	{#if categories.length === 0}
		<p class="py-10 text-center text-sm text-muted">표시할 데이터가 없습니다.</p>
	{:else}
		<svg
			width={W}
			{height}
			role="img"
			aria-label={ariaLabel}
			class="block touch-none select-none"
			onpointermove={onMove}
			onpointerleave={() => (hover = null)}
		>
			{#each ticks as t (t)}
				<line
					x1={pad.left}
					x2={W - pad.right}
					y1={y(t)}
					y2={y(t)}
					stroke={t === 0 ? 'var(--color-axis)' : 'var(--color-grid)'}
					stroke-width="1"
				/>
				<text
					x={pad.left - 8}
					y={y(t)}
					dy="0.35em"
					text-anchor="end"
					font-size="12"
					fill="var(--color-muted)"
					class="tabular">{format(t)}</text
				>
			{/each}
			{#each categories as c, i (c)}
				{@const st = stacks[i]}
				<!-- 호버 밴드 하이라이트 -->
				{#if hover === i}
					<rect
						x={cx(i) - band / 2}
						y={pad.top}
						width={band}
						height={innerH}
						fill="var(--color-surface-2)"
						pointer-events="none"
					/>
				{/if}
				{#each st.segs as seg (seg.s)}
					{#if seg.v !== 0}
						<rect
							x={cx(i) - bw / 2}
							y={y(seg.to)}
							width={bw}
							height={Math.max(0, y(seg.from) - y(seg.to))}
							fill={series[seg.s].color}
							stroke="var(--color-surface)"
							stroke-width="2"
							pointer-events="none"
						/>
					{/if}
				{/each}
				<!-- 합계 직접 라벨 -->
				<text
					x={cx(i)}
					y={y(st.up) - 6}
					text-anchor="middle"
					font-size="12"
					font-weight="600"
					fill="var(--color-ink)"
					class="tabular"
					pointer-events="none">{format(st.total)}</text
				>
				<text
					x={cx(i)}
					y={height - 8}
					text-anchor="middle"
					font-size="12"
					fill="var(--color-muted)"
					pointer-events="none">{c}</text
				>
			{/each}
		</svg>
		{#if hover !== null}
			{@const st = stacks[hover]}
			<div
				class="pointer-events-none absolute top-2 z-10 min-w-[200px] -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-md"
				style="left:{tipLeft}px"
				role="status"
			>
				<div class="mb-1 font-semibold text-ink">{categories[hover]}</div>
				<dl class="space-y-0.5">
					{#each series as s, si (s.key)}
						<div class="flex items-center justify-between gap-4">
							<dt class="flex items-center gap-1.5 text-ink-2">
								<span class="inline-block h-2.5 w-2.5 rounded-sm" style="background:{s.color}"
								></span>{s.label}
							</dt>
							<dd class="tabular text-ink">{format(values[hover][si])}</dd>
						</div>
					{/each}
					<div class="mt-1 flex items-center justify-between gap-4 border-t border-line pt-1">
						<dt class="text-ink-2">{totalLabel}</dt>
						<dd class="tabular font-semibold text-ink">{format(st.total)}</dd>
					</div>
				</dl>
			</div>
		{/if}
	{/if}
</div>
<div class="mt-2">
	<Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
</div>
