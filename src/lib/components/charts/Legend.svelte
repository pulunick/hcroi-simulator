<script lang="ts">
	interface Props {
		items: { label: string; color: string }[];
	}
	let { items }: Props = $props();
</script>

<ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2" aria-label="범례">
	{#each items as it (it.label)}
		<li class="flex items-center gap-1.5">
			<span class="inline-block h-3 w-3 rounded-sm" style="background:{it.color}" aria-hidden="true"
			></span>
			<span>{it.label}</span>
		</li>
	{/each}
</ul>
