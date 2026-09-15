<script lang="ts">
	/**
	 * 설정 화면의 한 절 — 왼쪽 360px(번호 라벨 · 제목 · 한 줄 설명) + 오른쪽 내용(최대 720px).
	 * 시안(docs/design/commercial/Settings.dc.html)의 `.sec`: 48px 상하 여백 + 64px 간격 + 1px 아래 선.
	 * ≤768px 에서는 한 줄로 쌓인다.
	 */
	import type { Snippet } from 'svelte';

	let {
		label,
		title,
		hint,
		last = false,
		children
	}: {
		/** "01 · 금액 표시 단위" */
		label: string;
		/** 지금 고른 값을 보여 주는 제목 */
		title: string;
		hint: string;
		/** 마지막 절이면 아래 선을 그리지 않는다 */
		last?: boolean;
		children: Snippet;
	} = $props();
</script>

<section
	class="grid items-start gap-6 py-8 md:grid-cols-[360px_minmax(0,1fr)] md:gap-16 md:py-12 {last
		? ''
		: 'border-b border-line'}"
>
	<div class="flex flex-col gap-2 md:gap-3">
		<span class="text-xs font-semibold tracking-wide text-muted">{label}</span>
		<h2 class="text-xl leading-[1.35] font-semibold text-ink">{title}</h2>
		<p class="text-[13px] text-muted">{hint}</p>
	</div>
	<div class="max-w-[720px] min-w-0">
		{@render children()}
	</div>
</section>
