<script lang="ts">
	import { niceTicks } from '$lib/hcroi/format';

	/** reference = 본체 유형이 아닌 참조값(예: 분기 추이의 연간 값) — 속 빈 마커·점선으로 구분해 그린다 */
	type Point = { label: string; value: number | null; reference?: boolean; note?: string };
	interface Props {
		points: Point[];
		format: (v: number) => string;
		/** 기준선 (예: HCROI 1.0 / 1.3 / 1.5) */
		thresholds?: { value: number; label: string }[];
		height?: number;
		ariaLabel: string;
		includeZero?: boolean;
		color?: string;
	}

	let {
		points,
		format,
		thresholds = [],
		height = 260,
		ariaLabel,
		includeZero = false,
		color = 'var(--color-series-1)'
	}: Props = $props();

	let width = $state(0);
	const pad = { top: 20, right: 72, bottom: 30, left: 48 };
	const W = $derived(Math.max(width, 240));
	const innerW = $derived(W - pad.left - pad.right);
	const innerH = $derived(height - pad.top - pad.bottom);

	const values = $derived(points.flatMap((p) => (p.value === null ? [] : [p.value])));
	const ticks = $derived.by(() => {
		const all = [...values, ...thresholds.map((t) => t.value)];
		if (all.length === 0) return [0, 1];
		const lo = Math.min(...all);
		const hi = Math.max(...all);
		const padY = (hi - lo || Math.abs(hi) || 1) * 0.15;
		return niceTicks(lo - padY, hi + padY, 5, includeZero);
	});
	const yMin = $derived(ticks[0]);
	const yMax = $derived(ticks[ticks.length - 1]);

	function x(i: number) {
		return pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
	}
	function y(v: number) {
		return pad.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
	}

	/**
	 * 선은 이웃한 두 점을 잇는 구간의 모음 — 값이 없는 점에서는 끊긴다.
	 * 한쪽이라도 참조점이면 점선(`dashed`)으로 그려 본체 추이와 구분한다.
	 */
	const segments = $derived.by(() => {
		const out: { d: string; dashed: boolean }[] = [];
		let prevIdx = -1;
		points.forEach((p, i) => {
			if (p.value === null) {
				prevIdx = -1;
				return;
			}
			if (prevIdx >= 0) {
				const q = points[prevIdx];
				out.push({
					d: `M${x(prevIdx).toFixed(1)},${y(q.value as number).toFixed(1)} L${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
					dashed: Boolean(p.reference || q.reference)
				});
			}
			prevIdx = i;
		});
		return out;
	});

	const lastIdx = $derived.by(() => {
		for (let i = points.length - 1; i >= 0; i--) if (points[i].value !== null) return i;
		return -1;
	});

	let hover = $state<number | null>(null);
	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const px = e.clientX - rect.left;
		let best = -1;
		let bd = Infinity;
		points.forEach((p, i) => {
			if (p.value === null) return;
			const d = Math.abs(x(i) - px);
			if (d < bd) {
				bd = d;
				best = i;
			}
		});
		hover = best >= 0 ? best : null;
	}
	const hoverPoint = $derived(hover === null ? null : points[hover]);
	const tipLeft = $derived(hover === null ? 0 : Math.min(W - 80, Math.max(80, x(hover))));
</script>

<div class="relative w-full" bind:clientWidth={width}>
	{#if points.length === 0}
		<p class="py-10 text-center text-sm text-muted">표시할 데이터가 없습니다.</p>
	{:else}
		<svg
			width={W}
			{height}
			role="img"
			aria-label={ariaLabel}
			class="block max-w-full touch-none select-none"
			onpointermove={onMove}
			onpointerleave={() => (hover = null)}
		>
			<!-- 격자 · y축 눈금 -->
			{#each ticks as t (t)}
				<line
					x1={pad.left}
					x2={W - pad.right}
					y1={y(t)}
					y2={y(t)}
					stroke="var(--color-grid)"
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
			<!-- 기준선 -->
			{#each thresholds as th (th.label)}
				<line
					x1={pad.left}
					x2={W - pad.right}
					y1={y(th.value)}
					y2={y(th.value)}
					stroke="var(--color-axis)"
					stroke-width="1"
				/>
				<text
					x={W - pad.right + 8}
					y={y(th.value)}
					dy="0.35em"
					font-size="12"
					fill="var(--color-muted)">{th.label}</text
				>
			{/each}
			<!-- x축 라벨 -->
			{#each points as p, i (p.label)}
				<text x={x(i)} y={height - 8} text-anchor="middle" font-size="12" fill="var(--color-muted)"
					>{p.label}</text
				>
			{/each}
			<!-- 크로스헤어 -->
			{#if hover !== null}
				<line
					x1={x(hover)}
					x2={x(hover)}
					y1={pad.top}
					y2={pad.top + innerH}
					stroke="var(--color-axis)"
					stroke-width="1"
				/>
			{/if}
			<!-- 선 (참조점에 닿는 구간은 점선) -->
			{#each segments as s, i (i)}
				<path
					d={s.d}
					fill="none"
					stroke={color}
					stroke-width="2"
					stroke-linecap="round"
					stroke-dasharray={s.dashed ? '4 4' : undefined}
				/>
			{/each}
			<!-- 마커 (2px 서피스 링) · 참조점은 속 빈 원 -->
			{#each points as p, i (p.label)}
				{#if p.value !== null}
					<circle
						cx={x(i)}
						cy={y(p.value)}
						r={hover === i ? 6 : 4.5}
						fill={p.reference ? 'var(--color-surface)' : color}
						stroke={p.reference ? color : 'var(--color-surface)'}
						stroke-width="2"
					/>
				{/if}
			{/each}
			<!-- 끝점 직접 라벨 -->
			{#if lastIdx >= 0 && hover === null}
				{@const v = points[lastIdx].value as number}
				{@const prevV = lastIdx > 0 ? points[lastIdx - 1].value : null}
				<!-- 우측 기준선 라벨과 겹치지 않도록 점의 왼쪽에 배치. 하락 추세면 선 아래로 내려 기준선 라벨과의 충돌을 피한다 -->
				<text
					x={x(lastIdx) - 8}
					y={prevV !== null && prevV > v ? y(v) + 20 : y(v) - 12}
					text-anchor="end"
					font-size="13"
					font-weight="600"
					fill="var(--color-ink)"
					class="tabular">{format(v)}</text
				>
			{/if}
		</svg>
		{#if hoverPoint && hoverPoint.value !== null}
			<div
				class="pointer-events-none absolute z-10 -translate-x-1/2 rounded-[2px] border border-line bg-surface px-3 py-2 text-sm"
				style="left:{tipLeft}px; top:{Math.max(0, y(hoverPoint.value) - 56)}px"
				role="status"
			>
				<div class="text-muted">{hoverPoint.label}</div>
				<div class="tabular font-semibold text-ink">{format(hoverPoint.value)}</div>
				{#if hoverPoint.note}<div class="text-xs text-muted">{hoverPoint.note}</div>{/if}
			</div>
		{/if}
	{/if}
</div>
