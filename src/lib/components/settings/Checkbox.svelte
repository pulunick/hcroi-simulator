<script lang="ts">
	/**
	 * 설정 화면의 체크박스 — 다른 화면(데이터 관리·PDF 가져오기)과 같은 `@tailwindcss/forms` 네이티브
	 * 체크박스(파랑 채움 + 흰 체크)를 쓴다. 터치 영역만 라벨 높이 44px 로 넉넉히 잡는다.
	 *
	 * 2026-09-15: 브랜드 시안용으로 직접 그리던 "먹색 채움" 박스는 앱 룩 복귀와 함께 폐기.
	 * (당시 문제였던 forms 플러그인 레이어 충돌은 `bg-transparent` 를 쓰지 않으면 생기지 않는다 —
	 *  데이터 화면의 체크박스가 같은 방식으로 잘 동작한다.)
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
	<input
		{id}
		type="checkbox"
		class="h-4 w-4 shrink-0 rounded border-line-2 text-brand focus:ring-brand/30"
		bind:checked
	/>
	{label}
</label>
