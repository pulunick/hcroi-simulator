<script lang="ts">
	/**
	 * 체크박스 — 네이티브 input 은 sr-only 로 숨기고 옆 박스를 시안(Settings.dc.html `.box`/`.box.on`)대로
	 * 직접 그린다. 아이콘 없이 채움만: 미체크는 테두리만(먹색 1px), 체크는 먹색으로 채움.
	 *
	 * ChipRadio.svelte 와 같은 패턴(네이티브 요소 숨김 + 라벨 안에서 상태를 직접 그림)을 쓴 이유:
	 * 원래 네이티브 `input[type=checkbox]` + `@tailwindcss/forms` 조합은 (1) forms 플러그인이
	 * `:checked` 에 흰색 체크 아이콘 SVG 를 넣어 "채움만" 시안과 어긋나고, (2) `bg-transparent` 같은
	 * 유틸리티 클래스가 Tailwind 의 utilities 레이어에 있어 플러그인의 base 레이어 `:checked` 배경색을
	 * 레이어 우선순위로 항상 덮어써 버려(특이도와 무관) 체크해도 채움이 보이지 않았다.
	 */
	let {
		checked = $bindable(false),
		label,
		id
	}: {
		checked: boolean;
		label: string;
		id?: string;
	} = $props();
</script>

<label
	for={id}
	class="inline-flex min-h-11 items-center gap-2.5 text-[15px] text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand"
>
	<input {id} type="checkbox" class="sr-only" bind:checked />
	<span
		class="inline-block h-4 w-4 shrink-0 rounded-[2px] border border-ink {checked ? 'bg-ink' : ''}"
		aria-hidden="true"
	></span>
	{label}
</label>
