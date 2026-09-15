<script lang="ts">
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import wordmark from '$lib/assets/headroom-wordmark.svg';
	import wordmarkLight from '$lib/assets/headroom-wordmark-light.svg';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { workspace } from '$lib/state/workspace.svelte';
	import { SITE_ENABLED } from '$lib/site-config';

	let { children } = $props();

	onMount(() => {
		workspace.load();
		return workspace.startClock();
	});
	// 인원 구분을 쓴 기간의 총 임직원 수는 언제나 "산정 기준을 적용한 합계" — 기준·구분이 어디서 바뀌든 여기서 맞춘다
	$effect(() => {
		workspace.applyHeadcountBasis();
	});
	// 상태가 바뀔 때마다 localStorage 에 저장 (로드 전에는 save() 가 무시)
	$effect(() => {
		workspace.save();
	});
	// 화면 테마를 <html data-theme> 에 반영한다. 'system' 이면 속성을 지워 기기 설정(prefers-color-scheme)에 맡긴다.
	// 첫 렌더 전 세팅은 app.html 의 인라인 스크립트가 하고, 여기서는 설정 변경만 따라간다.
	$effect(() => {
		const t = workspace.theme;
		if (t === 'system') delete document.documentElement.dataset.theme;
		else document.documentElement.dataset.theme = t;
	});

	const nav = [
		{ href: resolve('/'), label: '대시보드' },
		{ href: resolve('/simulator'), label: '시뮬레이터' },
		{ href: resolve('/data'), label: '데이터' },
		{ href: resolve('/report'), label: '리포트' },
		{ href: resolve('/settings'), label: '설정' },
		{ href: resolve('/guide'), label: '가이드' }
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

	// 소개(랜딩) 페이지는 자기 헤더·푸터를 직접 그린다 — 앱 크롬을 씌우지 않는다.
	// 사내 배포(SITE_ENABLED=false)에는 /intro 자체가 없으니(404) 앱 헤더를 항상 쓴다.
	const isSite = $derived(SITE_ENABLED && page.url.pathname.startsWith('/intro'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if isSite}
	{@render children()}
{:else}
	<a
		href="#main"
		class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-on-brand"
		>본문으로 건너뛰기</a
	>

	<header class="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
		<!--
			모바일(≤640px)에서는 탭 6개가 한 줄에 들어가지 않는다. 가로 스크롤로 숨기면 리포트·설정·가이드에
			닿을 수 없으므로(QA 7) 줄바꿈(flex-wrap)으로 두 줄에 모두 보이게 한다. 넓은 화면에서는 그대로 한 줄.
		-->
		<div
			class="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 sm:min-h-14 sm:gap-x-6 sm:px-6 sm:py-0"
		>
			<div class="flex shrink-0 items-center gap-2">
				{#if SITE_ENABLED}
					<a
						href={resolve('/intro')}
						aria-label="Headroom 소개"
						title="Headroom 소개"
						class="block"
					>
						<img src={wordmark} alt="Headroom" class="wordmark-light block h-[20px] w-auto" />
						<img src={wordmarkLight} alt="Headroom" class="wordmark-dark h-[20px] w-auto" />
					</a>
					<span class="h-5 w-px shrink-0 bg-line" aria-hidden="true"></span>
				{:else}
					<a
						href={resolve('/')}
						aria-label="대시보드"
						class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-on-brand"
					>
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
					</a>
				{/if}
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
							class="field-input w-48 py-1 text-sm"
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
					<!-- 이름을 아직 넣지 않았으면 도구 이름 대신 흐린 플레이스홀더를 보여 준다 (표시만 — workspace.brand 는 그대로) -->
					<button
						type="button"
						class="rounded-md px-1 py-0.5 text-[15px] whitespace-nowrap hover:bg-surface-2 hover:text-brand {workspace.orgName.trim()
							? 'font-bold text-ink'
							: 'text-muted'}"
						title="회사/조직 이름 넣기 — 대시보드 제목·탭·엑셀 파일명에 반영"
						aria-label={workspace.orgName.trim()
							? `${workspace.orgName.trim()} — 회사 이름 수정`
							: '회사 이름 넣기'}
						onclick={startEdit}>{workspace.orgName.trim() || '회사 이름 넣기'}</button
					>
				{/if}
			</div>
			<nav
				aria-label="주 메뉴"
				class="-mx-1 flex w-full flex-wrap items-center gap-1 sm:mx-0 sm:w-auto sm:flex-1"
			>
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
			{#if workspace.saveError}
				<span class="shrink-0 text-xs font-semibold text-status-critical-ink" role="status"
					>저장 실패 · 변경사항 미저장</span
				>
			{:else}
				<span class="hidden shrink-0 text-xs text-muted lg:inline"
					>이 PC 에만 저장 · {workspace.savedLabel}</span
				>
			{/if}
		</div>
	</header>

	<main id="main" class="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-[1240px] px-4 pb-8 text-xs text-muted sm:px-6">
		HCROI = (영업이익 + 총 인건비) ÷ 총 인건비 · HCVA = (영업이익 + 총 인건비) ÷ 총 임직원 수 —
		자세한 산식은
		<a href={resolve('/guide')} class="underline">가이드</a> 참조
		{#if SITE_ENABLED}
			· <a href={resolve('/intro')} class="underline">소개</a>
		{/if}
	</footer>
{/if}
