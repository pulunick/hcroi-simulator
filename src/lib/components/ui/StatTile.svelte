<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		value: string;
		/** 값 옆 보조 표기 (예: "= 143%") */
		sub?: string;
		/**
		 * 변화량 텍스트 + 방향 (up 이 좋은지 여부는 goodWhenUp).
		 * `neutral` 이면 좋고 나쁨을 판정하지 않고 회색으로만 쓴다 — 총 임직원 수처럼 증감 자체에
		 * 좋고 나쁨이 없는 값(2026-09-15 결정). 화살표는 그대로 방향을 보여 준다.
		 */
		delta?: {
			text: string;
			direction: 'up' | 'down' | 'flat';
			goodWhenUp?: boolean;
			neutral?: boolean;
		} | null;
		hero?: boolean;
		children?: Snippet;
	}
	let { label, value, sub, delta = null, hero = false, children }: Props = $props();

	const deltaClass = $derived.by(() => {
		if (!delta || delta.neutral || delta.direction === 'flat') return 'text-muted';
		const good = (delta.direction === 'up') === (delta.goodWhenUp ?? true);
		return good ? 'text-status-good-ink' : 'text-status-critical-ink';
	});
</script>

<div class="card flex flex-col gap-1 px-5 py-4" class:col-span-2={hero}>
	<div class="text-sm font-medium text-ink-2">{label}</div>
	<div class="flex flex-wrap items-baseline gap-x-2">
		<div class="font-semibold tracking-tight text-ink" class:text-5xl={hero} class:text-2xl={!hero}>
			{value}
		</div>
		{#if sub}<div class="text-sm text-muted">{sub}</div>{/if}
	</div>
	{#if delta}
		<div class="flex items-start gap-1 text-sm font-medium break-keep {deltaClass}">
			{#if delta.direction === 'up'}
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="mt-1 shrink-0"
					aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg
				>
			{:else if delta.direction === 'down'}
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="mt-1 shrink-0"
					aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7" /></svg
				>
			{:else}
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					class="mt-1 shrink-0"
					aria-hidden="true"><path d="M5 12h14" /></svg
				>
			{/if}
			<span class="break-keep">{delta.text}</span>
		</div>
	{/if}
	{#if children}{@render children()}{/if}
</div>
