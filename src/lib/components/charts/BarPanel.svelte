<script lang="ts">
	import { niceTicks } from '$lib/hcroi/format';

	/**
	 * 소형 막대 패널 — "시나리오 비교" 를 지표별 small multiple 로 그린다.
	 * (지표마다 단위가 달라 한 축에 못 담으므로 이중축 대신 패널을 나눈다)
	 */
	interface Item {
		label: string;
		value: number | null;
		color: string;
	}
	interface Props {
		title: string;
		unit?: string;
		items: Item[];
		format: (v: number) => string;
		height?: number;
	}
	let { title, unit, items, format, height = 200 }: Props = $props();

	let width = $state(0);
	const pad = { top: 26, right: 8, bottom: 26, left: 8 };
	const W = $derived(Math.max(width, 160));
	const innerW = $derived(W - pad.left - pad.right);
	const innerH = $derived(height - pad.top - pad.bottom);

	const nums = $derived(items.flatMap((i) => (i.value === null ? [] : [i.value])));
	const ticks = $derived(
		nums.length ? niceTicks(Math.min(...nums), Math.max(...nums) * 1.05, 4, true) : [0, 1]
	);
	const yMin = $derived(ticks[0]);
	const yMax = $derived(ticks[ticks.length - 1]);
	const band = $derived(items.length ? innerW / items.length : innerW);
	const bw = $derived(Math.min(28, band * 0.55));
	const r = 4;

	function cx(i: number) {
		return pad.left + band * i + band / 2;
	}
	function y(v: number) {
		return pad.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
	}
	/** 데이터 끝만 4px 라운드, 기준선 쪽은 각진 막대 */
	function barPath(i: number, v: number): string {
		const x0 = cx(i) - bw / 2;
		const x1 = x0 + bw;
		const yb = y(0);
		const yt = y(v);
		const h = Math.abs(yb - yt);
		if (h < r * 1.5) return `M${x0},${yb} L${x0},${yt} L${x1},${yt} L${x1},${yb} Z`;
		if (v >= 0) {
			return `M${x0},${yb} L${x0},${yt + r} Q${x0},${yt} ${x0 + r},${yt} L${x1 - r},${yt} Q${x1},${yt} ${x1},${yt + r} L${x1},${yb} Z`;
		}
		return `M${x0},${yb} L${x0},${yt - r} Q${x0},${yt} ${x0 + r},${yt} L${x1 - r},${yt} Q${x1},${yt} ${x1},${yt - r} L${x1},${yb} Z`;
	}

	let hover = $state<number | null>(null);
	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const px = e.clientX - rect.left - pad.left;
		const i = Math.floor(px / band);
		hover = i >= 0 && i < items.length ? i : null;
	}
	const hovered = $derived(hover === null ? null : items[hover]);
</script>

<div class="card px-4 pt-3 pb-2">
	<div class="mb-1 flex items-baseline justify-between">
		<h3 class="text-sm font-semibold text-ink-2">{title}</h3>
		{#if unit}<span class="text-xs text-muted">{unit}</span>{/if}
	</div>
	<div class="relative w-full" bind:clientWidth={width}>
		<svg
			width={W}
			{height}
			role="img"
			aria-label="{title} 시나리오 비교"
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
			{/each}
			{#each items as it, i (it.label)}
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
				{#if it.value !== null}
					<path d={barPath(i, it.value)} fill={it.color} pointer-events="none" />
					<text
						x={cx(i)}
						y={it.value >= 0 ? y(it.value) - 6 : y(it.value) + 14}
						text-anchor="middle"
						font-size="12"
						font-weight="600"
						fill="var(--color-ink)"
						class="tabular"
						pointer-events="none">{format(it.value)}</text
					>
				{:else}
					<text x={cx(i)} y={y(0) - 6} text-anchor="middle" font-size="12" fill="var(--color-muted)"
						>—</text
					>
				{/if}
				<text
					x={cx(i)}
					y={height - 8}
					text-anchor="middle"
					font-size="12"
					fill="var(--color-muted)"
					pointer-events="none">{it.label}</text
				>
			{/each}
		</svg>
		{#if hovered && hovered.value !== null}
			<div
				class="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm shadow-md"
				role="status"
			>
				<span class="text-muted">{hovered.label}</span>
				<span class="tabular ml-2 font-semibold text-ink"
					>{format(hovered.value)}{unit ? ` ${unit}` : ''}</span
				>
			</div>
		{/if}
	</div>
</div>
