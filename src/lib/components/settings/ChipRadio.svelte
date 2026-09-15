<script lang="ts" generics="T extends string">
	/**
	 * 세그먼트 컨트롤로 보이는 라디오 그룹 (네이티브 input 을 숨기고 라벨을 칩으로 꾸민다).
	 * 대시보드 `비용 입력 방식` 토글과 같은 모양 — 테두리 안에 칩을 넣고 고른 칩은 파랑으로 채운다.
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

<div
	class="inline-flex flex-wrap gap-1 rounded-lg border border-line-2 p-1"
	role="radiogroup"
	aria-label={ariaLabel}
>
	{#each options as o (o.key)}
		<label
			class="inline-flex h-10 items-center rounded-md px-3.5 text-[15px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand {value ===
			o.key
				? 'bg-brand font-semibold text-on-brand'
				: 'text-ink-2 hover:bg-surface-2 hover:text-ink'}"
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
