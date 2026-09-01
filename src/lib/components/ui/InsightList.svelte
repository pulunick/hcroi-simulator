<script lang="ts">
	import type { Insight, InsightTone } from '$lib/hcroi/types';

	interface Props {
		insights: Insight[];
		emptyText?: string;
	}
	let { insights, emptyText = '표시할 인사이트가 없습니다.' }: Props = $props();

	const tone: Record<InsightTone, { border: string; ink: string; label: string }> = {
		positive: { border: 'border-l-status-good', ink: 'text-status-good-ink', label: '긍정' },
		neutral: { border: 'border-l-brand', ink: 'text-brand-ink', label: '참고' },
		warning: { border: 'border-l-status-warning', ink: 'text-status-warning-ink', label: '주의' },
		critical: { border: 'border-l-status-critical', ink: 'text-status-critical-ink', label: '위험' }
	};
</script>

{#if insights.length === 0}
	<p class="text-sm text-muted">{emptyText}</p>
{:else}
	<ul class="space-y-3">
		{#each insights as ins, i (i)}
			{@const t = tone[ins.tone]}
			<li class="rounded-lg border border-l-4 border-line {t.border} bg-surface px-4 py-3">
				<div class="mb-1 flex items-center gap-2">
					<span class="text-xs font-bold tracking-wide uppercase {t.ink}">{t.label}</span>
					<h3 class="text-[15px] font-semibold text-ink">{ins.title}</h3>
				</div>
				<p class="text-[15px] leading-relaxed text-ink-2">{ins.body}</p>
			</li>
		{/each}
	</ul>
{/if}
