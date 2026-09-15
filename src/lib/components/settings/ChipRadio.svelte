<script lang="ts" generics="T extends string">
	/**
	 * 글자 칩으로 보이는 라디오 그룹 (아이콘 0 규칙 — 네이티브 input 을 숨기고 라벨을 칩으로 꾸민다).
	 * 고른 칩은 먹색 테두리 · 굵은 글자 · 패널 배경. 높이 44px 은 시안(`.opt`) 그대로.
	 */
	let {
		name,
		options,
		value = $bindable(),
		ariaLabel
	}: {
		/** 같은 그룹임을 브라우저에 알리는 이름 (화면에는 안 보인다) */
		name: string;
		options: readonly { key: T; label: string }[];
		value: T;
		ariaLabel: string;
	} = $props();
</script>

<div class="flex flex-wrap gap-2" role="radiogroup" aria-label={ariaLabel}>
	{#each options as o (o.key)}
		<label
			class="inline-flex h-11 items-center rounded-[2px] border px-4 text-[15px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand {value ===
			o.key
				? 'border-ink bg-panel font-semibold text-ink'
				: 'border-line text-ink-2 hover:border-line-2 hover:text-ink'}"
		>
			<input
				type="radio"
				{name}
				class="sr-only"
				value={o.key}
				checked={value === o.key}
				onchange={() => (value = o.key)}
			/>
			{o.label}
		</label>
	{/each}
</div>
