<script lang="ts">
	import { GRADE_LABEL } from '$lib/hcroi/formulas';
	import type { HcroiGrade } from '$lib/hcroi/types';

	interface Props {
		grade: HcroiGrade | null;
		size?: 'sm' | 'lg';
	}
	let { grade, size = 'sm' }: Props = $props();

	const styles: Record<HcroiGrade, { bg: string; ink: string; dot: string }> = {
		excellent: { bg: 'bg-status-good-bg', ink: 'text-status-good-ink', dot: 'bg-status-good' },
		warning: {
			bg: 'bg-status-warning-bg',
			ink: 'text-status-warning-ink',
			dot: 'bg-status-warning'
		},
		critical: {
			bg: 'bg-status-critical-bg',
			ink: 'text-status-critical-ink',
			dot: 'bg-status-critical'
		}
	};
</script>

{#if grade}
	{@const s = styles[grade]}
	<span
		class="inline-flex items-center gap-1.5 rounded-full font-semibold {s.bg} {s.ink} {size === 'lg'
			? 'px-3.5 py-1.5 text-base'
			: 'px-2.5 py-0.5 text-sm'}"
	>
		{#if grade === 'critical'}
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				><path
					d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
				/><path d="M12 9v4M12 17h.01" /></svg
			>
		{:else if grade === 'warning'}
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg
			>
		{:else}
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9Z" /></svg
			>
		{/if}
		<span>{GRADE_LABEL[grade]}</span>
	</span>
{:else}
	<span class="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-sm text-muted"
		>산출 불가</span
	>
{/if}
