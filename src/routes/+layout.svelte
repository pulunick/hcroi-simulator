<script lang="ts">
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { workspace } from '$lib/state/workspace.svelte';

	let { children } = $props();

	onMount(() => workspace.load());
	// 상태가 바뀔 때마다 localStorage 에 저장 (로드 전에는 save() 가 무시)
	$effect(() => {
		workspace.save();
	});

	const nav = [
		{ href: resolve('/'), label: '대시보드' },
		{ href: resolve('/simulator'), label: '시뮬레이터' },
		{ href: resolve('/data'), label: '데이터 관리' },
		{ href: resolve('/guide'), label: '산식·가이드' }
	];
	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a
	href="#main"
	class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-white"
	>본문으로 건너뛰기</a
>

<header class="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
	<div class="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-4 sm:px-6">
		<a href={resolve('/')} class="flex items-center gap-2 font-bold text-ink">
			<span class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.4"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><path d="M3 17l5-6 4 4 8-9" /><path d="M14 6h6v6" /></svg
				>
			</span>
			<span class="hidden sm:inline">HCROI 시뮬레이터</span>
		</a>
		<nav aria-label="주 메뉴" class="flex flex-1 items-center gap-1 overflow-x-auto">
			{#each nav as n (n.href)}
				<a
					href={n.href}
					aria-current={isActive(n.href) ? 'page' : undefined}
					class="rounded-md px-3 py-1.5 text-[15px] font-medium whitespace-nowrap transition-colors {isActive(
						n.href
					)
						? 'bg-brand-tint text-brand-ink'
						: 'text-ink-2 hover:bg-surface-2 hover:text-ink'}">{n.label}</a
				>
			{/each}
		</nav>
		<span class="hidden text-xs text-muted md:inline"
			>프로토타입 · 데이터는 이 브라우저에만 저장됩니다</span
		>
	</div>
</header>

<main id="main" class="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8">
	{@render children()}
</main>

<footer class="mx-auto max-w-[1240px] px-4 pb-8 text-xs text-muted sm:px-6">
	HCROI = (영업이익 + 총 인건비) ÷ 총 인건비 · HCVA = (영업이익 + 총 인건비) ÷ 총 임직원 수 — 자세한
	산식은
	<a href={resolve('/guide')} class="underline">산식·가이드</a> 참조
</footer>
