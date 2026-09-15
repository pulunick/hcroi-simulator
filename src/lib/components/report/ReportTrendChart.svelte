<script lang="ts">
	/**
	 * 리포트 1번 항목의 HCROI 꺾은선 — 인쇄용 인라인 SVG (외부 차트 라이브러리 없음).
	 * 흑백 인쇄를 전제로 색이 아니라 **선·점·값 라벨**로 읽히게 그린다.
	 * 기준선은 등급 경계 두 개(1.0 · 1.5)를 점선으로 깔고 왼쪽에 눈금을 붙인다.
	 */
	import { HCROI_THRESHOLDS } from '$lib/hcroi/formulas';

	interface Point {
		label: string;
		value: number | null;
		/** 그 유형 자료가 없는 해를 대신한 연간 참조점 — 속 빈 점으로 그린다 */
		reference?: boolean;
	}

	let {
		points,
		width = 250,
		height = 116,
		ariaLabel
	}: { points: Point[]; width?: number; height?: number; ariaLabel?: string } = $props();

	// 내부 좌표계 (디자인 시안과 동일한 viewBox)
	const VB_W = 340;
	const VB_H = 158;
	const LEFT = 50;
	const RIGHT = 332;
	const TOP = 30;
	const BASE = 120;

	const values = $derived(points.map((p) => p.value).filter((v): v is number => v !== null));
	const lo = $derived(Math.min(HCROI_THRESHOLDS.warning, ...values) - 0.15);
	const hi = $derived(Math.max(HCROI_THRESHOLDS.excellent, ...values) + 0.15);

	const xAt = (i: number) =>
		points.length <= 1
			? (LEFT + RIGHT) / 2
			: LEFT + ((i + 0.5) * (RIGHT - LEFT)) / Math.max(points.length, 1);
	const yAt = (v: number) => BASE - ((v - lo) / Math.max(hi - lo, 1e-9)) * (BASE - TOP);

	const plotted = $derived(
		points
			.map((p, i) => ({ ...p, x: xAt(i), y: p.value === null ? null : yAt(p.value) }))
			.filter((p): p is typeof p & { y: number; value: number } => p.y !== null)
	);
	const line = $derived(plotted.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));

	const rules = [
		{ value: HCROI_THRESHOLDS.excellent, text: HCROI_THRESHOLDS.excellent.toFixed(1) },
		{ value: HCROI_THRESHOLDS.warning, text: HCROI_THRESHOLDS.warning.toFixed(1) }
	];

	const autoLabel = $derived(
		`HCROI 추이: ${points
			.map((p) => `${p.label} ${p.value === null ? '—' : p.value.toFixed(2)}`)
			.join(
				', '
			)} — 기준선 ${HCROI_THRESHOLDS.excellent.toFixed(1)} 우수, ${HCROI_THRESHOLDS.warning.toFixed(1)} 위험`
	);
</script>

<svg
	{width}
	{height}
	viewBox="0 0 {VB_W} {VB_H}"
	role="img"
	aria-label={ariaLabel ?? autoLabel}
	class="chart"
>
	<line x1={LEFT - 6} y1={BASE} x2={RIGHT} y2={BASE} stroke="var(--r-ink)" stroke-width="1" />
	{#each rules as r (r.value)}
		<line
			x1={LEFT - 6}
			y1={yAt(r.value)}
			x2={RIGHT}
			y2={yAt(r.value)}
			stroke="var(--r-muted)"
			stroke-width="1"
			stroke-dasharray="3 3"
		/>
		<text
			x={LEFT - 12}
			y={yAt(r.value) + 4}
			font-size="13"
			fill="var(--r-muted)"
			text-anchor="end"
			font-family="var(--font-mono)">{r.text}</text
		>
	{/each}

	{#if plotted.length > 1}
		<polyline
			points={line}
			fill="none"
			stroke="var(--r-ink)"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
	{/if}
	{#each plotted as p (p.label)}
		<circle
			cx={p.x}
			cy={p.y}
			r="4"
			fill={p.reference ? 'var(--r-paper)' : 'var(--r-ink)'}
			stroke="var(--r-ink)"
			stroke-width="1.5"
		/>
		<text
			x={p.x}
			y={p.y - 12}
			font-size="14"
			font-weight="600"
			fill="var(--r-ink)"
			text-anchor="middle"
			font-family="var(--font-mono)">{p.value.toFixed(2)}</text
		>
	{/each}
	{#each points as p, i (p.label)}
		<text
			x={xAt(i)}
			y={BASE + 22}
			font-size="14"
			fill="var(--r-ink-2)"
			text-anchor="middle"
			font-family="var(--font-mono)">{p.label}</text
		>
	{/each}
</svg>

<style>
	.chart {
		display: block;
		flex-shrink: 0;
	}
</style>
