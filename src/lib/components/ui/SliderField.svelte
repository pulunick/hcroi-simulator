<script lang="ts">
	interface Props {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		unit?: string;
		help?: string;
		/** 0 기준 표시 — 값이 0이면 "변동 없음" */
		zeroLabel?: string;
	}

	let {
		label,
		value = $bindable(0),
		min,
		max,
		step = 0.5,
		unit = '%',
		help,
		zeroLabel = '변동 없음'
	}: Props = $props();

	const id = $props.id();

	function clamp(n: number) {
		return Math.min(max, Math.max(min, n));
	}
	function onNumber(e: Event) {
		const n = Number((e.currentTarget as HTMLInputElement).value);
		if (Number.isFinite(n)) value = clamp(n);
	}
	function onRange(e: Event) {
		value = Number((e.currentTarget as HTMLInputElement).value);
	}
	const signed = $derived(value === 0 ? zeroLabel : `${value > 0 ? '+' : ''}${value}${unit}`);
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between gap-3">
		<label for={id} class="text-sm font-semibold text-ink-2">{label}</label>
		<div class="flex items-center gap-1.5">
			<input
				type="number"
				class="tabular field-input w-24 py-1 text-right text-sm"
				{min}
				{max}
				{step}
				{value}
				oninput={onNumber}
				aria-label="{label} 직접 입력"
			/>
			<span class="w-5 text-sm text-muted">{unit}</span>
		</div>
	</div>
	<input
		{id}
		type="range"
		class="slider"
		{min}
		{max}
		{step}
		{value}
		oninput={onRange}
		aria-valuetext={signed}
	/>
	<div class="tabular flex justify-between text-xs text-muted">
		<span>{min}{unit}</span>
		<span class="font-semibold text-ink-2">{signed}</span>
		<span>+{max}{unit}</span>
	</div>
	{#if help}<p class="text-sm text-muted">{help}</p>{/if}
</div>
