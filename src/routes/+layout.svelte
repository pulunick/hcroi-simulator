<script lang="ts">
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import wordmark from '$lib/assets/headroom-wordmark.svg';
	import wordmarkLight from '$lib/assets/headroom-wordmark-light.svg';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { workspace } from '$lib/state/workspace.svelte';

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

	// 헤더 워드마크 옆의 이름 편집 — 회사/조직 이름은 `workspace.orgName` 한 곳에 저장되어
	// 대시보드 제목·브라우저 탭·엑셀 파일명·조직 정보 시트가 모두 따라간다 (서버 전송 없음)
	let editingBrand = $state(false);
	let brandInput = $state<HTMLInputElement | null>(null);
	function startEdit() {
		editingBrand = true;
		queueMicrotask(() => brandInput?.focus());
	}

	// 소개(랜딩) 페이지는 자기 헤더·푸터를 직접 그린다 — 앱 크롬을 씌우지 않는다
	const isSite = $derived(page.url.pathname.startsWith('/intro'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if isSite}
	{@render children()}
{:else}
	<a
		href="#main"
		class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-brand focus:px-3 focus:py-2 focus:text-on-brand"
		>본문으로 건너뛰기</a
	>

	<header class="sticky top-0 z-20 bg-page">
		<div
			class="mx-auto flex h-[72px] max-w-[1200px] items-stretch gap-6 border-b border-ink px-4 sm:px-6"
		>
			<!-- 모바일에서는 워드마크·회사명·탭이 한 줄로 가로 스크롤된다 -->
			<div class="no-scrollbar flex min-w-0 flex-1 items-stretch gap-4 overflow-x-auto md:gap-8">
				<div class="flex shrink-0 items-center gap-4">
					<a
						href={resolve('/intro')}
						aria-label="Headroom 소개"
						title="Headroom 소개"
						class="block"
					>
						<img src={wordmark} alt="Headroom" class="wordmark-light block h-[22px] w-auto" />
						<img src={wordmarkLight} alt="Headroom" class="wordmark-dark h-[22px] w-auto" />
					</a>
					<span class="h-5 w-px shrink-0 bg-line" aria-hidden="true"></span>
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
							class="border-b border-dashed border-muted text-[15px] leading-[1.4] font-semibold whitespace-nowrap hover:border-brand hover:text-brand {workspace.orgName.trim()
								? 'text-ink'
								: 'font-normal text-muted'}"
							title="회사/조직 이름 넣기 — 대시보드 제목·탭·엑셀 파일명에 반영"
							aria-label={workspace.orgName.trim()
								? `${workspace.orgName.trim()} — 회사 이름 수정`
								: '회사 이름 넣기'}
							onclick={startEdit}>{workspace.orgName.trim() || '회사 이름 넣기'}</button
						>
					{/if}
				</div>
				<nav aria-label="주 메뉴" class="flex shrink-0 items-stretch gap-5 md:gap-6">
					{#each nav as n (n.href)}
						<a
							href={n.href}
							aria-current={isActive(n.href) ? 'page' : undefined}
							class="flex items-center border-b-2 text-[15px] whitespace-nowrap transition-colors {isActive(
								n.href
							)
								? 'border-ink font-semibold text-ink'
								: 'border-transparent text-ink-2 hover:text-ink'}">{n.label}</a
						>
					{/each}
				</nav>
			</div>
			{#if workspace.saveError}
				<span
					class="shrink-0 self-center text-xs font-semibold tracking-[0.02em] text-brand"
					role="status">저장 실패 · 변경사항 미저장</span
				>
			{:else}
				<span class="hidden shrink-0 self-center text-xs tracking-[0.02em] text-muted lg:inline"
					>이 PC 에만 저장 · {workspace.savedLabel}</span
				>
			{/if}
		</div>
	</header>

	<main id="main" class="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-[1200px] px-4 pb-8 text-xs text-muted sm:px-6">
		HCROI = (영업이익 + 총 인건비) ÷ 총 인건비 · HCVA = (영업이익 + 총 인건비) ÷ 총 임직원 수 —
		자세한 산식은
		<a href={resolve('/guide')} class="underline">가이드</a> 참조 ·
		<a href={resolve('/intro')} class="underline">소개</a>
	</footer>
{/if}
