<script lang="ts">
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { workspace } from '$lib/state/workspace.svelte';

	let { children } = $props();

	onMount(() => workspace.load());
	// 인원 구분을 쓴 기간의 총 임직원 수는 언제나 "산정 기준을 적용한 합계" — 기준·구분이 어디서 바뀌든 여기서 맞춘다
	$effect(() => {
		workspace.applyHeadcountBasis();
	});
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

	// 헤더 로고 자리의 이름 편집 — 회사/조직 이름은 `workspace.orgName` 한 곳에 저장되어
	// 대시보드 제목·브라우저 탭·엑셀 파일명·조직 정보 시트가 모두 따라간다 (서버 전송 없음)
	let editingBrand = $state(false);
	let brandInput = $state<HTMLInputElement | null>(null);
	function startEdit() {
		editingBrand = true;
		queueMicrotask(() => brandInput?.focus());
	}
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
			{#if !editingBrand}<span class="hidden sm:inline">{workspace.brand}</span>{/if}
		</a>
		{#if editingBrand}
			<form
				class="flex items-center gap-1"
				onsubmit={(e) => {
					e.preventDefault();
					editingBrand = false;
				}}
			>
				<input
					bind:this={brandInput}
					class="field-input w-56 py-1 text-sm"
					placeholder="회사/조직 이름 (비우면 기본)"
					aria-label="회사/조직 이름"
					bind:value={workspace.orgName}
					onkeydown={(e) => {
						if (e.key === 'Escape') editingBrand = false;
					}}
					onblur={() => (editingBrand = false)}
				/>
				<button type="submit" class="btn py-1 text-sm btn-primary">확인</button>
			</form>
		{:else}
			<button
				type="button"
				class="-ml-4 btn p-1.5 btn-ghost text-muted hover:text-ink"
				aria-label="회사/조직 이름 수정"
				title="회사/조직 이름 넣기 — 대시보드 제목·탭·엑셀 파일명에 반영"
				onclick={startEdit}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg
				>
			</button>
		{/if}
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
