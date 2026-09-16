<script lang="ts">
	import { resolve } from '$app/paths';
	import wordmark from '$lib/assets/headroom-wordmark.svg';
	import wordmarkLight from '$lib/assets/headroom-wordmark-light.svg';

	// 소개 페이지(/intro) 전용 헤더 — 앱 헤더(+layout.svelte)와 별개다.
	// 768px 미만에서는 링크 셋을 "메뉴" 토글 아래로 접는다 (JS 는 이 불리언 하나뿐).
	let menuOpen = $state(false);

	// 앱 진입 링크에는 `?start=app` 을 붙인다 — "소개로 되돌리지 말고 그냥 열어라"는 신호로,
	// 대시보드가 처리 후 쿼리를 지운다. (첫 방문자는 / 에서 /intro 로 보내지므로 표시가 없으면 되튕긴다)
	const appHref = resolve('/');
	const introHref = resolve('/intro');
	const guideHref = resolve('/guide');
	const linkClass = 'flex min-h-11 items-center text-[15px] text-ink-2 hover:text-brand';
	const startClass =
		'flex min-h-11 items-center text-[15px] font-semibold text-brand hover:text-brand-hover';
</script>

<header class="border-b border-line bg-surface">
	<div class="mx-auto max-w-[1200px] px-5 sm:px-6">
		<div class="flex h-14 items-center justify-between gap-4 md:h-16">
			<!-- 다크에서는 밝은 글자 SVG 로 교체 (layout.css 의 .wordmark-light/.wordmark-dark) -->
			<a href={introHref} aria-label="Headroom 소개" title="Headroom 소개" class="block shrink-0">
				<img
					src={wordmark}
					alt="Headroom"
					class="wordmark-light block h-[22px] w-auto md:h-[26px]"
				/>
				<img src={wordmarkLight} alt="Headroom" class="wordmark-dark h-[22px] w-auto md:h-[26px]" />
			</a>

			<!-- 데스크톱 (≥768) -->
			<nav aria-label="소개 페이지 메뉴" class="hidden items-center gap-8 md:flex">
				<a href="#formula" class={linkClass}>산식</a>
				<a href="#privacy" class={linkClass}>데이터 보관</a>
				<a href={guideHref} class={linkClass}>가이드</a>
				<a href="{appHref}?start=app" class="btn btn-primary">시작하기</a>
			</nav>

			<!-- 모바일 (<768) -->
			<div class="flex items-center gap-5 md:hidden">
				<a href="{appHref}?start=app" class={startClass}>시작하기</a>
				<button
					type="button"
					class="flex min-h-11 items-center text-[15px] text-ink-2 hover:text-brand"
					aria-expanded={menuOpen}
					aria-controls="site-menu"
					onclick={() => (menuOpen = !menuOpen)}>{menuOpen ? '닫기' : '메뉴'}</button
				>
			</div>
		</div>

		{#if menuOpen}
			<nav
				id="site-menu"
				aria-label="소개 페이지 메뉴 (펼침)"
				class="flex flex-col border-b border-line md:hidden"
			>
				<a
					href="#formula"
					onclick={() => (menuOpen = false)}
					class="{linkClass} border-b border-line">산식</a
				>
				<a
					href="#privacy"
					onclick={() => (menuOpen = false)}
					class="{linkClass} border-b border-line">데이터 보관</a
				>
				<a href={guideHref} onclick={() => (menuOpen = false)} class={linkClass}>가이드</a>
			</nav>
		{/if}
	</div>
</header>
